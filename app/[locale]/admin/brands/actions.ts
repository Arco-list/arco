"use server"

import { after } from "next/server"
import { ensureHeroFocus } from "@/lib/collections/hero-focus"
import { descriptionTranslations, mergeTranslations, translateToDutch, type Translations } from "@/lib/collections/translate"
import { revalidatePath } from "next/cache"
import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"
import { logger } from "@/lib/logger"
import { locationToRow, type LocationInput } from "@/lib/locations/types"
import { Firecrawl } from "@mendable/firecrawl-js"
import Anthropic from "@anthropic-ai/sdk"
import { syncBrandCategoriesFromCollections } from "@/lib/products/brand-categories"
import { imageSize } from "@/lib/images/image-size"
import { isValidDomain, normalizeDomain } from "@/lib/products/domain"
import { absoluteHttpUrl, slugify, storeRemoteImage, stripWww, syncCollectionCover } from "@/lib/collections/shared"

const CLAUDE_MODEL = "claude-opus-5-5"

// Structured output: Claude's answer is JSON that matches these schemas.
// Hand-written rather than via the SDK's zod helper, which wants zod v4
// while the project runs zod 3. Every object closes with
// additionalProperties: false and lists all properties as required —
// what the API demands of an output schema.
type ExtractedBrand = { name: string; description: string | null; country: string | null; founded_year: number | null }
const EXTRACTED_BRAND_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    description: { type: ["string", "null"] },
    country: { type: ["string", "null"] },
    founded_year: { type: ["integer", "null"] },
  },
  required: ["name", "description", "country", "founded_year"],
  additionalProperties: false,
} as const

type DiscoveredCollection = { name: string; url: string | null; image_url: string | null; description: string | null }
const DISCOVERED_COLLECTION_SCHEMA = {
  type: "object",
  properties: {
    brand_description: { type: ["string", "null"] },
    collections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          url: { type: ["string", "null"] },
          image_url: { type: ["string", "null"] },
          description: { type: ["string", "null"] },
        },
        required: ["name", "url", "image_url", "description"],
        additionalProperties: false,
      },
    },
  },
  required: ["brand_description", "collections"],
  additionalProperties: false,
} as const

// Reading one collection page at a time is bulk work: the current Sonnet is
// plenty for "which images show this collection" and a fraction of the cost.
const CLAUDE_BULK_MODEL = "claude-sonnet-5-5"
const MAX_PHOTOS_PER_COLLECTION = 12

type CollectionPageData = {
  description: string | null
  designer: string | null
  launch_year: number | null
  category_slug: string | null
  kind_slugs: string[]
  products: Array<{ name: string; url: string | null; image_url: string | null }>
  images: Array<{ url: string; alt: string | null }>
}
const COLLECTION_PAGE_SCHEMA = {
  type: "object",
  properties: {
    description: { type: ["string", "null"] },
    designer: { type: ["string", "null"] },
    launch_year: { type: ["integer", "null"] },
    category_slug: { type: ["string", "null"] },
    kind_slugs: { type: "array", items: { type: "string" } },
    products: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, url: { type: ["string", "null"] }, image_url: { type: ["string", "null"] } },
        required: ["name", "url", "image_url"],
        additionalProperties: false,
      },
    },
    images: {
      type: "array",
      items: {
        type: "object",
        properties: { url: { type: "string" }, alt: { type: ["string", "null"] } },
        required: ["url", "alt"],
        additionalProperties: false,
      },
    },
  },
  required: ["description", "designer", "launch_year", "category_slug", "kind_slugs", "products", "images"],
  additionalProperties: false,
} as const

type EnrichableCollection = {
  id: string
  brand_id: string
  name: string
  url: string | null
  description: string | null
  designer: string | null
  launch_year: number | null
  category_id: string | null
}
type CategoryChoice = { slug: string; path: string }

async function requireAdmin(): Promise<{ ok: true } | { error: string }> {
  const supabase = await createServerActionSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "You must be signed in." }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_types, admin_role")
    .eq("id", user.id)
    .maybeSingle()

  if (!isAdminUser(profile?.user_types, profile?.admin_role)) {
    return { error: "Admin access required." }
  }
  return { ok: true }
}

function anthropicClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
}

function firecrawlClient(): Firecrawl {
  return new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY! })
}

/** The JSON Claude returned under a json_schema output format, or null. */
function parseStructured<T>(message: Anthropic.Message): T | null {
  if (message.stop_reason === "refusal") return null
  const text = message.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("")
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

function claudeErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Anthropic.RateLimitError) return "Claude is rate-limited right now; try again in a minute."
  if (err instanceof Anthropic.AuthenticationError) return "ANTHROPIC_API_KEY is not valid."
  // Een leeg tegoed komt als gewone 400 terug; zonder deze regel leest
  // het als "kon de pagina niet lezen" en lijkt het aan de site te liggen.
  if (err instanceof Anthropic.APIError && /credit balance is too low/i.test(err.message)) return "The Anthropic credit balance is too low — top up under Plans & Billing, then run it again."
  return fallback
}

/**
 * Extract brand metadata from a homepage using Claude: name, a short
 * editorial description, country and founding year. Structured output,
 * so there is no JSON to fish out of prose.
 */
async function extractBrandWithClaude(pageText: string, sourceUrl: string): Promise<ExtractedBrand | null> {
  const message = await anthropicClient().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    messages: [{
      role: "user",
      content: `You are extracting brand metadata from a high-end interior products brand's homepage for an editorial directory.

Source URL: ${sourceUrl}

Page content:
${pageText.slice(0, 4000)}

Fill in:
- name: the official brand name, cleaned, no taglines.
- description: one or two editorial sentences on what they make and what they are known for, max 240 characters.
- country: country of origin (e.g. "Netherlands", "Italy", "Germany"), or null if unclear.
- founded_year: the founding year as a number, or null if not stated.

If the page does not appear to be a brand homepage (a retailer, news site or unrelated page), set name to an empty string and everything else to null.`,
    }],
    output_config: { format: { type: "json_schema", schema: EXTRACTED_BRAND_SCHEMA } },
  })
  return parseStructured<ExtractedBrand>(message)
}

/**
 * The collection on an overview page — what the brand itself calls its lines.
 * Firecrawl renders the page as markdown (links and images inline); Claude
 * picks out the named collection and leaves categories, variants and
 * navigation alone. Nothing is stored here; the caller decides.
 */
async function discoverCollections(pageUrl: string, brandName: string, domain: string): Promise<{ collections: DiscoveredCollection[]; brandDescription: string | null } | { error: string }> {
  let markdown = ""
  try {
    const doc = await firecrawlClient().scrape(pageUrl, {
      formats: ["markdown", "links"],
      timeout: 45000,
      waitFor: 5000,
    }) as any
    markdown = (doc?.markdown ?? "") as string
  } catch (err) {
    logger.error("Collection page scrape failed", { url: pageUrl }, err as Error)
    return { error: "Could not fetch the page you pasted; the brand was still saved." }
  }
  if (!markdown.trim()) return { error: "The page you pasted has no readable content; the brand was still saved." }

  // 150k tekens (~38k tokens) dekt ook een lang overzicht met lazy-loaded
  // beelden onderaan; daarboven is het navigatie en footer.
  const excerpt = markdown.slice(0, 150_000)

  try {
    const message = await anthropicClient().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      messages: [{
        role: "user",
        content: `You are cataloguing the brand "${brandName}" (${domain}) for an editorial directory of interior and architecture products.

Below is one page of the brand's website, rendered as markdown. List the brand's COLLECTIONS: the named product lines, series or families the brand itself uses to organise its range. A collection is what architects specify and what a photo shows — for a lighting brand "Mito" or "Sento", for a kitchen brand "b3", for a furniture brand "Bart" or "Monster".

Include a collection when the page presents it as a named line with its own page or its own group of products.

Do NOT include:
- individual products, sizes, colours or mounting variants ("Mito sospeso" is a variant of the collection "Mito");
- generic categories ("Pendant lights", "Outdoor", "Sofas");
- navigation and utility pages (about, contact, dealers, news, downloads, configurators);
- seasonal or yearly groupings that bundle several collections ("Collection 2026", "Novelties", "New arrivals");
- accessories listings or other brands.

For each collection give:
- name: as the brand writes it, without the brand name as a prefix;
- url: the absolute URL of its page on this site, or null;
- image_url: the absolute URL of the image shown for it on this page, or null;
- description: one sentence taken from the page, or null.

Keep the page order. At most 80. If the page shows no collections, return an empty list.

Also give brand_description: one or two editorial sentences on what the brand makes and is known for, max 240 characters, taken from this page; null if the page says nothing usable about the brand.

Page URL: ${pageUrl}

Page content:
${excerpt}`,
      }],
      output_config: { format: { type: "json_schema", schema: DISCOVERED_COLLECTION_SCHEMA } },
    })
    const parsed = parseStructured<{ brand_description: string | null; collections: DiscoveredCollection[] }>(message)
    if (!parsed) return { error: "Could not read the collection from the page you pasted; the brand was still saved." }

    const seen = new Set<string>()
    const collections: DiscoveredCollection[] = []
    for (const s of parsed.collections) {
      const name = s.name.trim()
      if (!name) continue
      const key = slugify(name)
      if (seen.has(key)) continue
      seen.add(key)
      collections.push({
        name,
        url: absoluteHttpUrl(s.url, pageUrl),
        image_url: absoluteHttpUrl(s.image_url, pageUrl),
        description: s.description?.trim() || null,
      })
    }
    return { collections, brandDescription: parsed.brand_description?.trim() || null }
  } catch (err) {
    logger.error("Collection extraction failed", { url: pageUrl }, err as Error)
    return { error: claudeErrorMessage(err, "Could not read the collection from the page you pasted; the brand was still saved.") }
  }
}

/**
 * One collection' own page at the brand: the images that show it, and the
 * designer, year and description the page states. Firecrawl renders the
 * page (main content only) and lists its images; Claude picks.
 */
async function readCollectionPage(pageUrl: string, collectionName: string, brandName: string, categories: CategoryChoice[]): Promise<CollectionPageData | { error: string }> {
  let markdown = ""
  let images: string[] = []
  try {
    const doc = await firecrawlClient().scrape(pageUrl, {
      formats: ["markdown", "images"],
      timeout: 45000,
      waitFor: 3000,
      onlyMainContent: true,
    }) as any
    // 50k tekens is de collectie zelf; de rest is "gerelateerd" en footer.
    markdown = ((doc?.markdown ?? "") as string).slice(0, 50_000)
    const seen = new Set<string>()
    for (const raw of (doc?.images ?? []) as string[]) {
      const u = absoluteHttpUrl(raw, pageUrl)
      if (!u || seen.has(u) || /\.svg(\?|$)/i.test(u)) continue
      seen.add(u)
      images.push(u)
      if (images.length >= 120) break
    }
  } catch (err) {
    logger.error("Collection page scrape failed", { url: pageUrl }, err as Error)
    return { error: "Could not fetch the collection page." }
  }
  if (!markdown.trim() && images.length === 0) return { error: "The collection page has no readable content." }

  try {
    const message = await anthropicClient().messages.create({
      model: CLAUDE_BULK_MODEL,
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: `This is the page of the collection "${collectionName}" by the brand "${brandName}", rendered as markdown, followed by the list of image URLs found on the page. It is being catalogued for an editorial directory of interior and architecture products.

Give:
- description: one or two sentences in English on what defines this collection, taken from the page; null if the page says nothing usable.
- designer: the person or studio the page names as its designer, or null.
- launch_year: the year the collection was introduced, as a number, or null if not stated.
- category_slug: what kind of product this collection is, as one slug from the list of kinds below — the most specific kind that covers the WHOLE collection. A collection that spans several kinds (a lamp collection with pendant, wall and floor versions) gets their common group. Null if nothing fits.
- kind_slugs: the specific kinds of product this collection contains, each as one slug from the list below — the most specific kind that fits (a lounge chair, a sofa, a dining table, a sun lounger), not the group. Outdoor products take the outdoor kinds (garden sofas, garden tables, outdoor table lamps), never their indoor counterparts. Only kinds the page shows; at most 8; the most important first. An empty list if nothing fits.
- products: the individual products of THIS collection that the page lists, one entry each (a lounge chair, a bench, a dining table 320x100) — not colour or finish variants of the same product, and not other collections, accessories or navigation. For each: name as the brand writes it, in normal capitalisation (not ALL CAPS) and without the brand name; url: the absolute address of that product's own page, or null if it has none; image_url: the image the page shows for it, taken from the list of image URLs below, or null. In page order, at most 40. An empty list if the page lists no products.
- images: the images on this page that show THIS collection — product shots, details, and interiors with it in place. Exclude logos, icons, badges, award seals, portraits of people, PDF or download thumbnails, and images of other collections or products in "related", "you may also like" or navigation sections. Put first the image that best shows the collection in a real setting — a wide interior or garden photo — ahead of studio cut-outs on a plain or transparent background; keep the page order otherwise. At most ${MAX_PHOTOS_PER_COLLECTION}.

Kinds (slug — group › kind):
${categories.map((c) => `${c.slug} — ${c.path}`).join("\n")}

Page URL: ${pageUrl}

Page content:
${markdown}

Image URLs on the page:
${images.join("\n")}`,
      }],
      output_config: { format: { type: "json_schema", schema: COLLECTION_PAGE_SCHEMA } },
    })
    const data = parseStructured<CollectionPageData>(message)
    if (!data) return { error: "Could not read the collection page." }

    const seen = new Set<string>()
    const picked: CollectionPageData["images"] = []
    for (const im of data.images) {
      const url = absoluteHttpUrl(im.url, pageUrl)
      if (!url || seen.has(url)) continue
      seen.add(url)
      picked.push({ url, alt: im.alt?.trim() || null })
    }
    // Producten: adressen schoon (geen tracking- of filterparameters, zoals
    // ?itemListName=… bij Flos), dubbelen eruit, en niet de collectiepagina zelf.
    const productSeen = new Set<string>()
    const products: CollectionPageData["products"] = []
    for (const p of Array.isArray(data.products) ? data.products : []) {
      const name = p.name?.trim()
      if (!name) continue
      const key = slugify(name)
      if (!key || productSeen.has(key)) continue
      let url = absoluteHttpUrl(p.url, pageUrl)
      if (url) {
        try { const u = new URL(url); u.search = ""; u.hash = ""; url = u.toString() } catch { url = null }
        if (url && url.replace(/\/$/, "") === pageUrl.split(/[?#]/)[0].replace(/\/$/, "")) url = null
      }
      productSeen.add(key)
      products.push({ name, url, image_url: absoluteHttpUrl(p.image_url, pageUrl) })
      if (products.length >= 40) break
    }
    return {
      description: data.description?.trim() || null,
      designer: data.designer?.trim() || null,
      launch_year: data.launch_year,
      category_slug: data.category_slug?.trim() || null,
      kind_slugs: Array.isArray(data.kind_slugs) ? data.kind_slugs.map((k) => k.trim()).filter(Boolean) : [],
      products,
      images: picked.slice(0, MAX_PHOTOS_PER_COLLECTION),
    }
  } catch (err) {
    logger.error("Collection page extraction failed", { url: pageUrl }, err as Error)
    return { error: claudeErrorMessage(err, "Could not read the collection page.") }
  }
}

/**
 * Bring one collection up to date from its page at the brand. Fields are only
 * filled where empty — an admin's edit wins over a scrape — and photos are
 * added only for urls the collection does not have yet, so running it twice
 * is harmless. Stamps enriched_at (293).
 */
async function enrichCollection(supabase: any, collection: EnrichableCollection, brandName: string): Promise<{ photos: number; products: number } | { error: string }> {
  if (!collection.url) return { error: "This collection has no page at the brand." }

  // De soorten als keuzelijst voor Claude: slug plus het pad erheen
  // (Verlichting › Hanglampen), zodat de keuze leesbaar is.
  const { data: cats } = await supabase.from("product_categories").select("id, slug, name, parent_id")
  const catRows = (cats ?? []) as Array<{ id: string; slug: string; name: string; parent_id: string | null }>
  const catById = new Map(catRows.map((c) => [c.id, c]))
  const pathOf = (c: { name: string; parent_id: string | null }): string => {
    const parts: string[] = []
    let cur: { name: string; parent_id: string | null } | undefined = c
    while (cur) { parts.unshift(cur.name); cur = cur.parent_id ? catById.get(cur.parent_id) : undefined }
    return parts.join(" › ")
  }
  const page = await readCollectionPage(collection.url, collection.name, brandName, catRows.map((c) => ({ slug: c.slug, path: pathOf(c) })))
  if ("error" in page) return page

  const patch: Record<string, unknown> = { enriched_at: new Date().toISOString() }
  if (!collection.category_id && page.category_slug) {
    const cat = catRows.find((c) => c.slug === page.category_slug)
    if (cat) patch.category_id = cat.id
  }
  if (!collection.description && page.description) patch.description = page.description
  if (!collection.designer && page.designer) patch.designer = page.designer
  const thisYear = new Date().getFullYear()
  if (!collection.launch_year && page.launch_year && page.launch_year >= 1800 && page.launch_year <= thisYear + 1) patch.launch_year = page.launch_year
  const { error: patchError } = await supabase.from("product_collections").update(patch).eq("id", collection.id)
  if (patchError) return { error: patchError.message }

  // De soorten die de collectie maakt (stoel, bank, tafel): alleen als er nog
  // geen staan, zodat een latere handmatige keuze niet wordt overschreven.
  if (page.kind_slugs.length > 0) {
    const { count: kindCount } = await supabase.from("product_collection_kinds").select("collection_id", { count: "exact", head: true }).eq("collection_id", collection.id)
    if (!kindCount) {
      const kindIds: string[] = []
      for (const slug of page.kind_slugs) {
        const id = catRows.find((c) => c.slug === slug)?.id
        if (id && !kindIds.includes(id)) kindIds.push(id)
      }
      if (kindIds.length > 0) {
        await supabase.from("product_collection_kinds").insert(kindIds.map((category_id, position) => ({ collection_id: collection.id, category_id, position })))
      }
    }
  }
  // De categorieën van het merk volgen zijn collecties.
  await syncBrandCategoriesFromCollections(supabase, collection.brand_id)

  // Copied into our bucket, not linked. source_url remembers where a
  // photo came from, so a second read of the same page recognises what
  // is already here; a copy that fails keeps the external url rather
  // than losing the photo.
  const { data: existing } = await supabase
    .from("product_collection_photos")
    .select("url, source_url, is_primary, order_index")
    .eq("collection_id", collection.id)
  const rows = (existing ?? []) as Array<{ url: string; source_url: string | null; is_primary: boolean; order_index: number }>
  const have = new Set(rows.map((r) => r.source_url ?? r.url))
  const hasPrimary = rows.some((r) => r.is_primary)
  const nextOrder = rows.reduce((m, r) => Math.max(m, r.order_index), -1) + 1
  const fresh = page.images.filter((im) => !have.has(im.url))
  if (fresh.length > 0) {
    const stored = await Promise.all(fresh.map((im) => storeRemoteImage(supabase, im.url, `product-families/${collection.id}`)))
    const { data: insertedPhotos, error } = await supabase
      .from("product_collection_photos")
      .insert(fresh.map((im, i) => ({ collection_id: collection.id, url: stored[i] ?? im.url, source_url: im.url, alt_text: im.alt, is_primary: !hasPrimary && i === 0, order_index: nextOrder + i })))
      .select("id, url")
    if (error) return { error: error.message }
    await classifyCollectionPhotos(supabase, (insertedPhotos ?? []) as Array<{ id: string; url: string }>)
    await syncCollectionCover(supabase, collection.id)
  }

  // De producten die de collectiepagina toont (naam, productpagina, beeld):
  // alleen wat er nog niet is, zodat een tweede lezing niets dubbel maakt;
  // een product dat nog geen beeld had krijgt het alsnog. Het beeld wordt
  // naar onze opslag gekopieerd onder de collectie.
  let productsAdded = 0
  if (page.products.length > 0) {
    const { data: existingProducts } = await supabase.from("products").select("id, slug, url, image_url").eq("collection_id", collection.id)
    const rowsKnown = (existingProducts ?? []) as Array<{ id: string; slug: string; url: string | null; image_url: string | null }>
    // Herkend op naam én op productpagina: een tweede lezing mag een
    // product iets anders noemen (Nagomi lounge chair / Lounge chair) zonder
    // dat er een dubbele ontstaat.
    const bySlug = new Map(rowsKnown.map((p) => [p.slug, p]))
    const byUrl = new Map(rowsKnown.filter((p) => p.url).map((p) => [p.url as string, p]))
    for (const [i, p] of page.products.entries()) {
      const slug = slugify(p.name)
      const known = bySlug.get(slug) ?? (p.url ? byUrl.get(p.url) : undefined)
      if (known) {
        if (!known.image_url && p.image_url) {
          const stored = await storeRemoteImage(supabase, p.image_url, `product-families/${collection.id}/products`, slug)
          await supabase.from("products").update({ image_url: stored ?? p.image_url, source_image_url: p.image_url }).eq("id", known.id)
        }
        continue
      }
      const stored = p.image_url ? await storeRemoteImage(supabase, p.image_url, `product-families/${collection.id}/products`, slug) : null
      const { error } = await supabase.from("products").insert({
        brand_id: collection.brand_id, collection_id: collection.id, slug, name: p.name, url: p.url,
        image_url: stored ?? p.image_url, source_image_url: p.image_url, position: i,
      })
      if (error) logger.error("Product insert failed", { collection: collection.id, product: p.name }, error as any)
      else productsAdded++
    }
  }
  return { photos: fresh.length, products: productsAdded }
}

export type AddBrandResult = { brandId: string; name: string; created: boolean } | { error: string }

/**
 * Add brand, step 1 of 3: the brand itself, from the homepage of whatever
 * page was pasted — name, description, country, year, logo. Admin only.
 * A brand that already exists on that domain is returned as it is.
 *
 * The three steps are separate actions so the popup can show where it
 * is: the client calls this, then discoverBrandCollections for the pasted
 * page, then fetchCollectionFromBrandPage per collection. Each step stays well
 * inside a server action's limits; one long action could not report
 * anything until it was done.
 */
export async function addBrandFromSite(rawUrl: string): Promise<AddBrandResult> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { error: "Please enter a valid URL (including https://)." }
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    return { error: "Only http/https URLs are supported." }
  }
  if (!process.env.FIRECRAWL_API_KEY) return { error: "FIRECRAWL_API_KEY is not configured." }
  if (!process.env.ANTHROPIC_API_KEY) return { error: "ANTHROPIC_API_KEY is not configured." }

  const domain = stripWww(url.hostname)
  const origin = `${url.protocol}//${url.host}/`
  const supabase = createServiceRoleSupabaseClient() as any

  const { data: existing } = await supabase
    .from("brands")
    .select("id, name")
    .eq("domain", domain)
    .maybeSingle()
  if (existing) return { brandId: existing.id, name: existing.name, created: false }

  let extracted: ExtractedBrand | null = null
  let logoUrl: string | null = null
  try {
    const home = await firecrawlClient().scrape(origin, {
      formats: ["markdown"],
      timeout: 30000,
      waitFor: 5000,
    }) as any
    if (!home || (!home.markdown && !home.metadata)) {
      return { error: "Could not fetch the homepage. Is the site publicly accessible?" }
    }
    // og:image is usually the brand's hero/logo
    logoUrl = absoluteHttpUrl(home.metadata?.ogImage ?? null, origin)
    extracted = await extractBrandWithClaude((home.markdown ?? "").slice(0, 6000), origin)
  } catch (err) {
    logger.error("Brand scrape failed", { url: origin }, err as Error)
    return { error: claudeErrorMessage(err, "Could not extract brand info from the homepage.") }
  }

  if (!extracted?.name) {
    return { error: "Could not identify a brand on this site's homepage." }
  }

  const slug = slugify(extracted.name)
  let finalSlug = slug
  let attempts = 0
  let inserted: { id: string; name: string } | null = null

  while (attempts < 5) {
    const { data, error } = await supabase
      .from("brands")
      .insert({
        slug: finalSlug,
        name: extracted.name,
        domain,
        website: origin,
        logo_url: null,
        description: extracted.description,
        country: extracted.country,
        founded_year: extracted.founded_year,
        status: "unclaimed",
      })
      .select("id, name")
      .single()

    if (!error && data) {
      inserted = data
      break
    }
    if (error?.code === "23505") {
      // unique violation — retry with suffix
      attempts++
      finalSlug = `${slug}-${attempts + 1}`
      continue
    }
    logger.error("Brand insert failed", { url: origin }, error as any)
    return { error: `Could not save brand: ${error?.message ?? "unknown error"}` }
  }

  if (!inserted) return { error: "Could not generate a unique brand slug." }

  // The og:image, copied into brands/<id>/logo — same place and name as an
  // uploaded logo, so a later upload simply replaces it.
  if (logoUrl) {
    const stored = await storeRemoteImage(supabase, logoUrl, `brands/${inserted.id}`, "logo")
    await supabase.from("brands").update({ logo_url: stored ?? logoUrl }).eq("id", inserted.id)
  }

  revalidatePath("/admin/brands")
  return { brandId: inserted.id, name: inserted.name, created: true }
}

export type DiscoverCollectionsResult =
  | { collectionsFound: number; collectionsAdded: number; pending: Array<{ id: string; name: string }> }
  | { error: string }

/**
 * Add brand, step 2 of 3: the collection on the pasted page, added where the
 * brand does not have them yet; the image from the overview becomes the
 * cover. Returns the collection whose own page has not been read yet
 * (enriched_at empty) — the list step 3 works through. A brand that
 * already has everything comes back with an empty list.
 */
export async function discoverBrandCollections(brandId: string, pageUrl: string): Promise<DiscoverCollectionsResult> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard
  if (!process.env.FIRECRAWL_API_KEY) return { error: "FIRECRAWL_API_KEY is not configured." }
  if (!process.env.ANTHROPIC_API_KEY) return { error: "ANTHROPIC_API_KEY is not configured." }

  let url: URL
  try {
    url = new URL(pageUrl)
  } catch {
    return { error: "Please enter a valid URL (including https://)." }
  }

  const supabase = createServiceRoleSupabaseClient() as any
  const { data: brand } = await supabase.from("brands").select("id, name, domain, description").eq("id", brandId).maybeSingle()
  if (!brand) return { error: "Brand not found." }

  const discovered = await discoverCollections(url.toString(), brand.name, brand.domain ?? stripWww(url.hostname))
  if ("error" in discovered) return discovered

  // De omschrijving van het merk komt uit dezelfde pagina, zonder extra
  // aanroep; alleen als er nog geen staat, want een handmatige tekst wint.
  if (!brand.description?.trim() && discovered.brandDescription) {
    await supabase.from("brands").update({ description: discovered.brandDescription }).eq("id", brandId)
  }

  const { data: existingCollections } = await supabase
    .from("product_collections")
    .select("slug")
    .eq("brand_id", brandId)
  const have = new Set(((existingCollections ?? []) as Array<{ slug: string }>).map((f) => f.slug))

  let added = 0
  for (const s of discovered.collections) {
    const collectionSlug = slugify(s.name)
    if (have.has(collectionSlug)) continue

    const { data: collection, error } = await supabase
      .from("product_collections")
      .insert({ brand_id: brandId, slug: collectionSlug, name: s.name, url: s.url, description: s.description })
      .select("id")
      .single()
    if (error || !collection) {
      logger.error("Collection insert failed", { brand: brandId, collection: s.name }, error as any)
      continue
    }
    have.add(collectionSlug)
    added++

    // The image from the overview becomes the cover: a photo row, as an
    // uploaded cover would be (292), copied into our bucket.
    if (s.image_url) {
      const stored = await storeRemoteImage(supabase, s.image_url, `product-families/${collection.id}`)
      const { data: coverRow } = await supabase
        .from("product_collection_photos")
        .insert({ collection_id: collection.id, url: stored ?? s.image_url, source_url: s.image_url, is_primary: true, order_index: 0 })
        .select("id, url")
        .maybeSingle()
      if (coverRow) await classifyCollectionPhotos(supabase, [coverRow])
      await syncCollectionCover(supabase, collection.id)
    }
  }

  const { data: toRead } = await supabase
    .from("product_collections")
    .select("id, name")
    .eq("brand_id", brandId)
    .not("url", "is", null)
    .is("enriched_at", null)
    .order("name")

  revalidatePath("/admin/brands")
  revalidatePath(`/admin/brands/${brandId}`)
  return { collectionsFound: discovered.collections.length, collectionsAdded: added, pending: (toRead ?? []) as Array<{ id: string; name: string }> }
}

/**
 * Add brand, step 3 of 3 (per collection) — and the button on the collection
 * page: read the collection' own page at the brand for photos it does not
 * have yet, and designer, year and description where still empty.
 */
export async function fetchCollectionFromBrandPage(collectionId: string): Promise<{ photos: number; products: number } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard
  if (!process.env.FIRECRAWL_API_KEY) return { error: "FIRECRAWL_API_KEY is not configured." }
  if (!process.env.ANTHROPIC_API_KEY) return { error: "ANTHROPIC_API_KEY is not configured." }

  const supabase = createServiceRoleSupabaseClient() as any
  const { data: collection } = await supabase
    .from("product_collections")
    .select("id, name, url, description, designer, launch_year, category_id, brand_id, brands(name)")
    .eq("id", collectionId)
    .maybeSingle()
  if (!collection) return { error: "Collection not found." }
  if (!collection.url) return { error: "Add the collection page at the brand first (under Links)." }

  const result = await enrichCollection(supabase, collection, collection.brands?.name ?? "")
  if ("error" in result) return result
  revalidatePath(`/admin/brands/${collection.brand_id}`)
  revalidatePath(`/admin/brands/${collection.brand_id}/collections/${collectionId}`)
  return result
}

/**
 * Update a brand's name, description, and/or logo. Admin only.
 */
export async function updateBrand(
  brandId: string,
  fields: { name?: string; description?: string; logo_url?: string; website?: string | null; country?: string | null; founded_year?: number | null },
): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const supabase = createServiceRoleSupabaseClient()
  const patch: Record<string, any> = {}
  if (fields.name !== undefined) patch.name = fields.name
  if (fields.description !== undefined) patch.description = fields.description
  if (fields.logo_url !== undefined) patch.logo_url = fields.logo_url
  if (fields.website !== undefined) patch.website = fields.website?.trim() || null
  if (fields.country !== undefined) patch.country = fields.country?.trim() || null
  if (fields.founded_year !== undefined) {
    if (fields.founded_year !== null && (!Number.isInteger(fields.founded_year) || fields.founded_year < 1500 || fields.founded_year > 2100)) {
      return { error: "Founded year must be a four-digit year." }
    }
    patch.founded_year = fields.founded_year
  }

  if (Object.keys(patch).length === 0) return { ok: true }

  // Een nieuwe (Engelse) beschrijving: meteen als en-tekst, het Nederlands
  // volgt op de achtergrond (migratie 330).
  if (fields.description !== undefined) patch.translations = descriptionTranslations(fields.description?.trim() || null, null)
  const { error } = await (supabase as any).from("brands").update(patch).eq("id", brandId)
  if (error) return { error: error.message }
  if (fields.description?.trim()) {
    const text = fields.description.trim()
    after(async () => {
      const nl = await translateToDutch(text)
      if (nl) await (supabase as any).from("brands").update({ translations: descriptionTranslations(text, nl) }).eq("id", brandId).eq("description", text)
    })
  }

  revalidatePath("/admin/brands")
  return { ok: true }
}

/**
 * Het domein van een merk aanpassen vanuit de tabel, zoals bij bedrijven.
 * De website volgt het domein (dezelfde afspraak als bij bedrijven: de
 * pijltjes naar buiten lezen de website). Leeg laten wist het domein en
 * laat de website staan. Een domein is uniek: staat het al bij een ander
 * merk, dan krijg je dat te horen en blijft alles zoals het was.
 */
export async function updateBrandDomain(brandId: string, raw: string): Promise<{ domain: string | null; website: string | null } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const domain = normalizeDomain(raw)
  if (domain && !isValidDomain(domain)) return { error: `"${raw.trim()}" is not a valid domain (like tribu.com).` }

  const supabase = createServiceRoleSupabaseClient() as any
  const patch: Record<string, unknown> = { domain: domain || null }
  if (domain) patch.website = `https://${domain}/`

  const { data, error } = await supabase.from("brands").update(patch).eq("id", brandId).select("domain, website").maybeSingle()
  if (error) {
    if (error.code === "23505") {
      const { data: other } = await supabase.from("brands").select("name").eq("domain", domain).maybeSingle()
      return { error: other?.name ? `${other.name} already uses ${domain}.` : `${domain} is already used by another brand.` }
    }
    return { error: error.message }
  }
  if (!data) return { error: "Brand not found." }

  revalidatePath("/admin/brands")
  revalidatePath(`/admin/brands/${brandId}`)
  return { domain: data.domain ?? null, website: data.website ?? null }
}

/**
 * Upload a brand logo. Admin only. Uses service role to bypass storage RLS.
 */
export async function uploadBrandLogo(brandId: string, formData: FormData): Promise<{ url: string } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const file = formData.get("file") as File | null
  if (!file) return { error: "No file provided." }
  if (file.size > 5 * 1024 * 1024) return { error: "Logo must be under 5MB." }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png"
  // Elke upload een eigen bestandsnaam. Met een vaste naam (logo.jpg)
  // bleef na een nieuwe upload de oude versie hangen: de browser en het
  // CDN hielden het oude bestand vast, en de logo-fit (lib: brand-logo)
  // onthoudt zijn keuze per url, dus een nieuw wit logo werd behandeld
  // als het oude logo met eigen achtergrond en ingezoomd.
  const path = `brands/${brandId}/logo-${Date.now()}.${ext}`

  const supabase = createServiceRoleSupabaseClient()
  const { error: uploadError } = await supabase.storage
    .from("company-assets")
    .upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type })

  if (uploadError) return { error: uploadError.message }

  const { data: urlData } = supabase.storage.from("company-assets").getPublicUrl(path)
  if (!urlData?.publicUrl) return { error: "Could not get public URL." }

  // Also update the brand row
  await supabase.from("brands").update({ logo_url: urlData.publicUrl }).eq("id", brandId)

  revalidatePath("/admin/brands")
  return { url: urlData.publicUrl }
}

/**
 * Update a brand's status. Admin only.
 */
/** Segment van een merk (migratie 324): luxury, premium, mid of leeg. */
export async function updateBrandSegment(brandId: string, segment: string | null): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard
  if (segment !== null && !["luxury", "premium", "mid"].includes(segment)) return { error: "Invalid segment." }
  const supabase = createServiceRoleSupabaseClient() as any
  const { error } = await supabase.from("brands").update({ market_segment: segment }).eq("id", brandId)
  if (error) return { error: error.message }
  revalidatePath("/admin/brands")
  return { ok: true }
}

export async function updateBrandStatus(brandId: string, status: string): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const validStatuses = ["unclaimed", "prospected", "unlisted", "listed", "deactivated"]
  if (!validStatuses.includes(status)) return { error: "Invalid status." }

  const supabase = createServiceRoleSupabaseClient() as any
  const { error } = await supabase
    .from("brands")
    .update({ status: status as any })
    .eq("id", brandId)

  if (error) return { error: error.message }

  revalidatePath("/admin/brands")
  return { ok: true }
}

/**
 * Replace what the brand makes. Order matters: the first category is the
 * primary one, like primary_service_id on a company (migration 291).
 */
export async function updateBrandCategories(brandId: string, categoryIds: string[]): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const ids = Array.from(new Set(categoryIds.filter(Boolean)))
  const supabase = createServiceRoleSupabaseClient() as any

  const { error: clearError } = await supabase.from("brand_categories").delete().eq("brand_id", brandId)
  if (clearError) return { error: clearError.message }
  if (ids.length > 0) {
    const { error } = await supabase
      .from("brand_categories")
      .insert(ids.map((category_id, position) => ({ brand_id: brandId, category_id, position })))
    if (error) return { error: error.message }
  }

  revalidatePath(`/admin/brands/${brandId}`)
  revalidatePath("/admin/brands")
  return { ok: true }
}

// ── Producten van een collectie: met de hand toevoegen, aanpassen, verwijderen ──
// De producten die het inlezen vindt (enrichCollection) staan in dezelfde
// tabel; dit zijn de handmatige kanten ervan.

const PRODUCT_IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }
const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024

function readProductFields(formData: FormData): { name: string; url: string | null; file: File | null; categoryId: string | null } | { error: string } {
  const name = String(formData.get("name") ?? "").trim()
  if (!name) return { error: "A product needs a name." }
  const rawUrl = String(formData.get("url") ?? "").trim()
  let url: string | null = null
  if (rawUrl) {
    try {
      const u = new URL(rawUrl)
      if (!["http:", "https:"].includes(u.protocol)) throw new Error("protocol")
      url = u.toString()
    } catch {
      return { error: "The page at the brand must be a full address (https://…)." }
    }
  }
  const file = formData.get("file")
  const rawCategory = String(formData.get("category_id") ?? "").trim()
  const categoryId = /^[0-9a-f-]{36}$/i.test(rawCategory) ? rawCategory : null
  return { name, url, file: file instanceof File && file.size > 0 ? file : null, categoryId }
}

async function storeProductImage(supabase: any, collectionId: string, slug: string, file: File): Promise<{ url: string } | { error: string }> {
  const ext = PRODUCT_IMAGE_TYPES[file.type]
  if (!ext) return { error: "The image must be a PNG, JPG or WebP." }
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) return { error: "The image must be under 5MB." }
  // Elke upload een nieuwe naam, zodat een vervangen beeld niet uit de cache komt.
  const path = `product-families/${collectionId}/products/${slug}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from("company-assets").upload(path, file, { cacheControl: "31536000", upsert: false, contentType: file.type })
  if (error) return { error: error.message }
  return { url: supabase.storage.from("company-assets").getPublicUrl(path).data.publicUrl }
}

/** Het opslagpad van een beeld in onze bucket, of null voor een beeld van elders. */
function ownStoragePath(url: string | null): string | null {
  const marker = "/object/public/company-assets/"
  const i = url?.indexOf(marker) ?? -1
  return url && i >= 0 ? decodeURIComponent(url.slice(i + marker.length).split("?")[0]) : null
}

export async function createProduct(collectionId: string, formData: FormData): Promise<{ id: string } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard
  const fields = readProductFields(formData)
  if ("error" in fields) return fields

  const supabase = createServiceRoleSupabaseClient() as any
  const { data: collection } = await supabase.from("product_collections").select("id, brand_id").eq("id", collectionId).maybeSingle()
  if (!collection) return { error: "Collection not found." }

  const slug = slugify(fields.name)
  const { data: existing } = await supabase.from("products").select("slug, position").eq("collection_id", collectionId)
  const rows = (existing ?? []) as Array<{ slug: string; position: number }>
  if (rows.some((r) => r.slug === slug)) return { error: `This collection already has a product called "${fields.name}".` }

  let imageUrl: string | null = null
  if (fields.file) {
    const stored = await storeProductImage(supabase, collectionId, slug, fields.file)
    if ("error" in stored) return stored
    imageUrl = stored.url
  }
  const { data, error } = await supabase
    .from("products")
    .insert({ brand_id: collection.brand_id, collection_id: collectionId, slug, name: fields.name, url: fields.url, category_id: fields.categoryId, image_url: imageUrl, source_image_url: null, position: rows.reduce((m, r) => Math.max(m, r.position), -1) + 1 })
    .select("id")
    .single()
  if (error) return { error: error.message }

  revalidatePath(`/admin/brands/${collection.brand_id}/collections/${collectionId}`)
  return { id: data.id }
}

export async function updateProduct(productId: string, formData: FormData): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard
  const fields = readProductFields(formData)
  if ("error" in fields) return fields

  const supabase = createServiceRoleSupabaseClient() as any
  const { data: product } = await supabase.from("products").select("id, brand_id, collection_id, slug, image_url").eq("id", productId).maybeSingle()
  if (!product) return { error: "Product not found." }

  const slug = slugify(fields.name)
  if (slug !== product.slug) {
    const { data: clash } = await supabase.from("products").select("id").eq("collection_id", product.collection_id).eq("slug", slug).maybeSingle()
    if (clash) return { error: `This collection already has a product called "${fields.name}".` }
  }
  const patch: Record<string, unknown> = { name: fields.name, slug, url: fields.url, category_id: fields.categoryId }
  let oldImage: string | null = null
  if (fields.file) {
    const stored = await storeProductImage(supabase, product.collection_id, slug, fields.file)
    if ("error" in stored) return stored
    patch.image_url = stored.url
    patch.source_image_url = null
    oldImage = ownStoragePath(product.image_url)
  }
  const { error } = await supabase.from("products").update(patch).eq("id", productId)
  if (error) return { error: error.message }
  if (oldImage) await supabase.storage.from("company-assets").remove([oldImage])

  revalidatePath(`/admin/brands/${product.brand_id}/collections/${product.collection_id}`)
  return { ok: true }
}

export async function deleteProduct(productId: string): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const supabase = createServiceRoleSupabaseClient() as any
  const { data: product } = await supabase.from("products").select("brand_id, collection_id, image_url").eq("id", productId).maybeSingle()
  if (!product) return { error: "Product not found." }

  const { error } = await supabase.from("products").delete().eq("id", productId)
  if (error) return { error: error.message }
  const path = ownStoragePath(product.image_url)
  if (path) await supabase.storage.from("company-assets").remove([path])

  revalidatePath(`/admin/brands/${product.brand_id}/collections/${product.collection_id}`)
  return { ok: true }
}

/**
 * De productsoorten van een collectie (Fauteuils, Banken, Ligbedden), in de
 * volgorde van de lijst: dezelfde vorm als de categorieën van een merk.
 * Admin only.
 */
export async function updateProductCollectionKinds(collectionId: string, categoryIds: string[]): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const ids = Array.from(new Set(categoryIds.filter(Boolean)))
  const supabase = createServiceRoleSupabaseClient() as any
  const { data: collection } = await supabase.from("product_collections").select("brand_id").eq("id", collectionId).maybeSingle()
  if (!collection) return { error: "Collection not found." }

  const { error: clearError } = await supabase.from("product_collection_kinds").delete().eq("collection_id", collectionId)
  if (clearError) return { error: clearError.message }
  if (ids.length > 0) {
    const { error } = await supabase
      .from("product_collection_kinds")
      .insert(ids.map((category_id, position) => ({ collection_id: collectionId, category_id, position })))
    if (error) return { error: error.message }
  }

  // De groep waaronder de collectie in het Producten-menu hangt (category_id)
  // volgt de soorten: bij één soort die soort, bij meer de laagste groep
  // die ze allemaal omvat (Fauteuils en Banken → Zitmeubels). Zonder
  // soorten blijft staan wat er was.
  if (ids.length > 0) {
    const { data: cats } = await supabase.from("product_categories").select("id, parent_id")
    const parentOf = new Map(((cats ?? []) as Array<{ id: string; parent_id: string | null }>).map((c) => [c.id, c.parent_id]))
    const chain = (id: string): string[] => { const out: string[] = []; for (let cur: string | null | undefined = id; cur; cur = parentOf.get(cur)) out.push(cur); return out }
    let common = chain(ids[0])
    for (const id of ids.slice(1)) { const own = new Set(chain(id)); common = common.filter((c) => own.has(c)) }
    await supabase.from("product_collections").update({ category_id: common[0] ?? null }).eq("id", collectionId)
  }

  await syncBrandCategoriesFromCollections(supabase, collection.brand_id)
  revalidatePath(`/admin/brands/${collection.brand_id}/collections/${collectionId}`)
  revalidatePath(`/admin/brands/${collection.brand_id}`)
  return { ok: true }
}

/**
 * Resolve or create a product collection by name for a given brand. Used by the
 * collection field on the product edit page so editors can type a new name
 * without jumping to the brand page to create it first.
 */
export async function upsertProductCollection(
  brandId: string,
  name: string,
): Promise<{ id: string; name: string } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const trimmed = name.trim()
  if (!trimmed) return { error: "Name is required." }

  const supabase = createServiceRoleSupabaseClient() as any
  const collectionSlug = slugify(trimmed)

  const { data: existing } = await supabase
    .from("product_collections")
    .select("id, name")
    .eq("brand_id", brandId)
    .eq("slug", collectionSlug)
    .maybeSingle()

  if (existing) return existing

  const { data: inserted, error } = await supabase
    .from("product_collections")
    .insert({ brand_id: brandId, slug: collectionSlug, name: trimmed })
    .select("id, name")
    .single()

  if (error || !inserted) return { error: error?.message ?? "Could not create collection." }
  revalidatePath(`/admin/brands/${brandId}`)
  return inserted
}

/**
 * Rename a collection and/or swap its hero image. Admin only.
 */
export async function updateProductCollection(
  collectionId: string,
  fields: {
    name?: string
    hero_image_url?: string | null
    description?: string | null
    designer?: string | null
    launch_year?: number | null
    url?: string | null
    category_id?: string | null
    is_featured?: boolean
  },
): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const supabase = createServiceRoleSupabaseClient() as any

  const patch: Record<string, any> = {}
  if (fields.name !== undefined) {
    const trimmed = fields.name.trim()
    if (!trimmed) return { error: "Name can't be empty." }
    patch.name = trimmed
    patch.slug = slugify(trimmed)
  }
  if (fields.hero_image_url !== undefined) patch.hero_image_url = fields.hero_image_url
  // Wat een collectiepagina toont en een catalogus niet geeft (migratie 289).
  if (fields.description !== undefined) {
    patch.description = fields.description?.trim() || null
    // Het Nederlands volgt op de achtergrond (migratie 330), zie onder.
    // Samengevoegd met wat er staat: materialen en afwerkingen in het
    // Nederlands (migratie 331) blijven.
    const { data: current } = await supabase.from("product_collections").select("translations").eq("id", collectionId).maybeSingle()
    patch.translations = mergeTranslations(current?.translations, descriptionTranslations(patch.description, null) as Translations)
  }
  if (fields.designer !== undefined) patch.designer = fields.designer?.trim() || null
  if (fields.url !== undefined) patch.url = fields.url?.trim() || null
  if (fields.category_id !== undefined) patch.category_id = fields.category_id
  if (fields.is_featured !== undefined) patch.is_featured = fields.is_featured
  if (fields.launch_year !== undefined) {
    if (fields.launch_year !== null && (!Number.isInteger(fields.launch_year) || fields.launch_year < 1800 || fields.launch_year > 2100)) {
      return { error: "Launch year must be a four-digit year." }
    }
    patch.launch_year = fields.launch_year
  }

  if (Object.keys(patch).length === 0) return { ok: true }

  const { data: collection } = await supabase
    .from("product_collections")
    .select("brand_id")
    .eq("id", collectionId)
    .maybeSingle()

  const { error } = await supabase.from("product_collections").update(patch).eq("id", collectionId)
  if (error) return { error: error.message }
  const text = typeof patch.description === "string" ? patch.description : null
  if (text) {
    after(async () => {
      const nl = await translateToDutch(text)
      if (!nl) return
      const { data: current } = await supabase.from("product_collections").select("translations").eq("id", collectionId).maybeSingle()
      await supabase.from("product_collections").update({ translations: mergeTranslations(current?.translations, descriptionTranslations(text, nl) as Translations) }).eq("id", collectionId).eq("description", text)
    })
  }

  if (collection?.brand_id) revalidatePath(`/admin/brands/${collection.brand_id}`)
  return { ok: true }
}

// ── Collection photos ──────────────────────────────────────────────────────
// Een collectie heeft foto's zoals een product ze had (migratie 292): meerdere
// beelden, één primair. hero_image_url op product_collections is de kopie van
// de primaire foto voor de kaarten; syncCollectionCover houdt hem bij.

const FAMILY_PHOTO_MAX_BYTES = 10 * 1024 * 1024

/** Remove everything under one folder of the bucket (a brand's, a collection'). */
async function removeStorageFolder(supabase: any, folder: string): Promise<void> {
  const { data: objects } = await supabase.storage.from("company-assets").list(folder, { limit: 1000 })
  if (objects && objects.length > 0) {
    await supabase.storage.from("company-assets").remove(objects.map((o: { name: string }) => `${folder}/${o.name}`))
  }
}

async function storeCollectionFile(supabase: any, collectionId: string, file: File): Promise<{ url: string } | { error: string }> {
  if (file.size > FAMILY_PHOTO_MAX_BYTES) return { error: `${file.name} is over 10MB.` }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
  const rand = Math.random().toString(36).slice(2, 10)
  const path = `product-families/${collectionId}/${Date.now()}-${rand}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from("company-assets")
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type })
  if (uploadError) return { error: uploadError.message }

  const { data: urlData } = supabase.storage.from("company-assets").getPublicUrl(path)
  if (!urlData?.publicUrl) return { error: "Could not get public URL." }
  return { url: urlData.publicUrl }
}

/**
 * Soort per collectiefoto (migratie 318): ambiance (sfeerbeeld), product
 * (vrijstaand studiobeeld) of detail (materiaal, staal, close-up). Claude
 * kijkt naar elke foto; zelfde vraag als de eenmalige indeling. Best
 * effort: een foto die niet lukt blijft leeg en de pagina's behandelen
 * hem dan als vroeger.
 */
const PHOTO_KIND_PROMPT = `This photo comes from a furniture or lighting brand's collection page. Classify it into exactly one kind:
- ambiance: the product shown in a real or styled setting (a room, terrace, garden, pool; people or surroundings visible).
- product: the product isolated on a plain white, grey or transparent background (studio cut-out), even if several products are grouped.
- detail: a close-up of material, weave, fabric, finish or colour swatch, or a technical detail, with no full product in view.
Answer with only the one word.`

/** Breedte en hoogte van nieuwe collectiefoto's (migratie 322), zodat de
 *  hero een liggende foto kan kiezen (lib/products/collection-hero). */
async function measureCollectionPhotos(supabase: any, photos: Array<{ id: string; url: string }>): Promise<void> {
  if (photos.length === 0) return
  await Promise.all(photos.map(async (ph) => {
    try {
      const res = await fetch(ph.url)
      if (!res.ok) return
      const size = imageSize(new Uint8Array(await res.arrayBuffer()))
      if (size) await supabase.from("product_collection_photos").update({ width: size.width, height: size.height }).eq("id", ph.id)
    } catch (err) {
      logger.warn("Collection photo size failed", { photoId: ph.id, error: err instanceof Error ? err.message : String(err) })
    }
  }))
}

async function classifyCollectionPhotos(supabase: any, photos: Array<{ id: string; url: string }>): Promise<void> {
  // Maten eerst: die hebben geen API-sleutel nodig.
  await measureCollectionPhotos(supabase, photos)
  if (photos.length === 0 || !process.env.ANTHROPIC_API_KEY) return
  const queue = [...photos]
  const worker = async () => {
    while (queue.length > 0) {
      const ph = queue.shift()!
      try {
        const message = await anthropicClient().messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 1024,
          // Eén woord per foto: weinig denkwerk nodig.
          output_config: { effort: "low" },
          messages: [{ role: "user", content: [
            { type: "image", source: { type: "url", url: ph.url } },
            { type: "text", text: PHOTO_KIND_PROMPT },
          ] }],
        } as any)
        if ((message as any).stop_reason === "refusal") continue
        const text = ((message as any).content as Array<{ type: string; text?: string }>).filter((b) => b.type === "text").map((b) => b.text ?? "").join(" ").toLowerCase()
        const kind = text.match(/\b(ambiance|product|detail)\b/)?.[1]
        if (kind) await supabase.from("product_collection_photos").update({ kind }).eq("id", ph.id)
      } catch (err) {
        logger.warn("Collection photo kind failed", { photoId: ph.id, error: err instanceof Error ? err.message : String(err) })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, photos.length) }, worker))
}

/** Soort van een collectiefoto met de hand aanpassen (bewerkpagina). */
export async function updateCollectionPhotoKind(photoId: string, kind: "ambiance" | "product" | "detail"): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard
  if (!["ambiance", "product", "detail"].includes(kind)) return { error: "Invalid kind." }
  const supabase = createServiceRoleSupabaseClient() as any
  const { data, error } = await supabase.from("product_collection_photos").update({ kind }).eq("id", photoId).select("collection_id").maybeSingle()
  if (error) return { error: error.message }
  if (data?.collection_id) await revalidateCollection(supabase, data.collection_id)
  return { ok: true }
}

async function revalidateCollection(supabase: any, collectionId: string): Promise<void> {
  const { data } = await supabase.from("product_collections").select("brand_id").eq("id", collectionId).maybeSingle()
  if (data?.brand_id) {
    revalidatePath(`/admin/brands/${data.brand_id}`)
    revalidatePath(`/admin/brands/${data.brand_id}/collections/${collectionId}`)
  }
}

/**
 * Upload a cover for a collection: the file becomes a photo of the collection and
 * its primary one. Admin only. Used by the card menu on the brand page and
 * by the hero on the collection page.
 */
export async function uploadProductCollectionImage(
  collectionId: string,
  formData: FormData,
): Promise<{ url: string } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const file = formData.get("file") as File | null
  if (!file) return { error: "No file provided." }

  const supabase = createServiceRoleSupabaseClient() as any
  const stored = await storeCollectionFile(supabase, collectionId, file)
  if ("error" in stored) return stored

  const { data: last } = await supabase
    .from("product_collection_photos")
    .select("order_index")
    .eq("collection_id", collectionId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle()

  await supabase.from("product_collection_photos").update({ is_primary: false }).eq("collection_id", collectionId)
  const { error } = await supabase
    .from("product_collection_photos")
    .insert({ collection_id: collectionId, url: stored.url, is_primary: true, order_index: (last?.order_index ?? -1) + 1 })
  if (error) return { error: error.message }

  await syncCollectionCover(supabase, collectionId)
  await revalidateCollection(supabase, collectionId)
  return { url: stored.url }
}

/**
 * Upload one or more photos for a collection. The first becomes the cover when
 * the collection has none yet; the rest append in order.
 */
export async function uploadProductCollectionPhotos(
  collectionId: string,
  formData: FormData,
): Promise<{ photos: { id: string; url: string }[] } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const files = formData.getAll("files").filter((f): f is File => f instanceof File)
  if (files.length === 0) return { error: "No files provided." }

  const supabase = createServiceRoleSupabaseClient() as any
  const { data: existing } = await supabase
    .from("product_collection_photos")
    .select("id, is_primary, order_index")
    .eq("collection_id", collectionId)
    .order("order_index", { ascending: false })

  let hasPrimary = ((existing ?? []) as Array<{ is_primary: boolean }>).some((r) => r.is_primary)
  let nextOrder = existing && existing.length > 0 ? (existing[0].order_index ?? 0) + 1 : 0
  const inserted: { id: string; url: string }[] = []

  for (const file of files) {
    const stored = await storeCollectionFile(supabase, collectionId, file)
    if ("error" in stored) return stored
    const { data: row, error } = await supabase
      .from("product_collection_photos")
      .insert({ collection_id: collectionId, url: stored.url, is_primary: !hasPrimary, order_index: nextOrder++ })
      .select("id, url")
      .single()
    if (error || !row) return { error: error?.message ?? "Could not save photo." }
    hasPrimary = true
    inserted.push({ id: row.id, url: row.url })
  }

  await classifyCollectionPhotos(supabase, inserted)
  await syncCollectionCover(supabase, collectionId)
  await revalidateCollection(supabase, collectionId)
  return { photos: inserted }
}

/** Make a photo the cover of its collection; only one carries the flag. */
/** Het focuspunt van een foto (0–1): waar de hero omheen bijsnijdt. */
export async function setCollectionPhotoFocus(photoId: string, x: number, y: number): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard
  if (![x, y].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)) return { error: "Invalid focus point." }
  const supabase = createServiceRoleSupabaseClient() as any
  const { data: photo, error } = await supabase.from("product_collection_photos").update({ focus_x: x, focus_y: y }).eq("id", photoId).select("collection_id").maybeSingle()
  if (error) return { error: error.message }
  if (!photo) return { error: "Photo not found." }
  await revalidateCollection(supabase, photo.collection_id)
  return { ok: true }
}

export async function setProductCollectionCover(photoId: string): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const supabase = createServiceRoleSupabaseClient() as any
  const { data: photo } = await supabase.from("product_collection_photos").select("id, collection_id").eq("id", photoId).maybeSingle()
  if (!photo) return { error: "Photo not found." }

  const { error: clearError } = await supabase.from("product_collection_photos").update({ is_primary: false }).eq("collection_id", photo.collection_id)
  if (clearError) return { error: clearError.message }
  const { error: setError } = await supabase.from("product_collection_photos").update({ is_primary: true }).eq("id", photoId)
  if (setError) return { error: setError.message }

  // Meteen terug; het focuspunt van de nieuwe cover zoekt Claude na het
  // antwoord (after), zodat de knop niet op die blik wacht.
  await syncCollectionCover(supabase, photo.collection_id, { focus: false })
  await revalidateCollection(supabase, photo.collection_id)
  after(async () => {
    await ensureHeroFocus(supabase, photo.collection_id)
    await revalidateCollection(supabase, photo.collection_id)
  })
  return { ok: true }
}

/**
 * Delete a photo of a collection. If it was the cover, the next one takes
 * over. Files in our bucket are removed; external urls are left alone.
 */
export async function deleteProductCollectionPhoto(photoId: string): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const supabase = createServiceRoleSupabaseClient() as any
  const { data: photo } = await supabase
    .from("product_collection_photos")
    .select("id, url, is_primary, collection_id")
    .eq("id", photoId)
    .maybeSingle()
  if (!photo) return { error: "Photo not found." }

  // .../storage/v1/object/public/company-assets/product-families/<id>/<file>
  const match = (photo.url as string).match(/\/storage\/v1\/object\/public\/company-assets\/(.+)$/)
  if (match?.[1]) await supabase.storage.from("company-assets").remove([match[1]])

  const { error } = await supabase.from("product_collection_photos").delete().eq("id", photoId)
  if (error) return { error: error.message }

  if (photo.is_primary) {
    const { data: next } = await supabase
      .from("product_collection_photos")
      .select("id")
      .eq("collection_id", photo.collection_id)
      .order("order_index", { ascending: true })
      .limit(1)
      .maybeSingle()
    if (next) await supabase.from("product_collection_photos").update({ is_primary: true }).eq("id", next.id)
  }

  await syncCollectionCover(supabase, photo.collection_id)
  await revalidateCollection(supabase, photo.collection_id)
  return { ok: true }
}

/**
 * Delete a collection. Project links that pointed at it keep their brand:
 * project_brands.collection_id is ON DELETE SET NULL (migration 289).
 */
export async function deleteProductCollection(
  collectionId: string,
): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const supabase = createServiceRoleSupabaseClient() as any

  const { data: collection } = await supabase
    .from("product_collections")
    .select("brand_id")
    .eq("id", collectionId)
    .maybeSingle()

  // Eigen bestanden onder product-families/<id>/ gaan mee; de fotorijen
  // cascaden met de collectie (292).
  await removeStorageFolder(supabase, `product-families/${collectionId}`)
  await removeStorageFolder(supabase, `product-families/${collectionId}/products`)

  const { error } = await supabase.from("product_collections").delete().eq("id", collectionId)
  if (error) return { error: error.message }

  if (collection?.brand_id) {
    await syncBrandCategoriesFromCollections(supabase, collection.brand_id)
    revalidatePath(`/admin/brands/${collection.brand_id}`)
  }
  return { ok: true }
}

/**
 * Delete a brand and all its products + photos (cascade).
 */
export async function deleteBrand(brandId: string): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const supabase = createServiceRoleSupabaseClient() as any
  // Eigen bestanden gaan mee: het logo onder brands/<id>/ en de foto's
  // van elke collectie onder product-families/<id>/. De rijen cascaden.
  const { data: collections } = await supabase.from("product_collections").select("id").eq("brand_id", brandId)
  const folders = [`brands/${brandId}`, ...((collections ?? []) as Array<{ id: string }>).flatMap((f) => [`product-families/${f.id}`, `product-families/${f.id}/products`])]
  for (const folder of folders) await removeStorageFolder(supabase, folder)

  const { error } = await supabase.from("brands").delete().eq("id", brandId)
  if (error) return { error: error.message }

  revalidatePath("/admin/brands")
  return { ok: true }
}

// ── Showrooms van het merk (locations.brand_id, migratie 297) ────────────

export async function saveBrandLocation(brandId: string, input: LocationInput): Promise<{ ok: true } | { error: string }> {
  const auth = await requireAdmin()
  if ("error" in auth) return auth
  if (!input.address) return { error: "An address is required." }
  const supabase = createServiceRoleSupabaseClient() as any
  const row = { ...locationToRow(input), updated_at: new Date().toISOString() }
  if (input.id) {
    const { error } = await supabase.from("locations").update(row).eq("id", input.id).eq("brand_id", brandId)
    if (error) { logger.error("Failed to update brand location", { brandId, id: input.id }, error); return { error: error.message } }
  } else {
    const { count } = await supabase.from("locations").select("id", { count: "exact", head: true }).eq("brand_id", brandId)
    const { error } = await supabase.from("locations").insert({ ...row, brand_id: brandId, position: count ?? 0 })
    if (error) { logger.error("Failed to add brand location", { brandId }, error); return { error: error.message } }
  }
  revalidatePath("/admin/brands")
  revalidatePath(`/admin/brands/${brandId}`)
  return { ok: true }
}

/** Foto van een eigen showroom van het merk (migratie 315). Admin only. */
export async function uploadBrandLocationPhoto(brandId: string, locationId: string, formData: FormData): Promise<{ url: string } | { error: string }> {
  const auth = await requireAdmin()
  if ("error" in auth) return auth
  const file = formData.get("file") as File | null
  if (!file) return { error: "No file provided." }
  if (file.size > 10 * 1024 * 1024) return { error: "Photo must be under 10MB." }
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return { error: "Use a JPG, PNG or WebP image." }
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"
  const path = `brands/${brandId}/locations/${locationId}-${Date.now()}.${ext}`
  const supabase = createServiceRoleSupabaseClient() as any
  const { error: uploadError } = await supabase.storage.from("company-assets").upload(path, file, { cacheControl: "31536000", upsert: false, contentType: file.type })
  if (uploadError) return { error: uploadError.message }
  const { data: urlData } = supabase.storage.from("company-assets").getPublicUrl(path)
  if (!urlData?.publicUrl) return { error: "Could not get public URL." }
  const { error } = await supabase.from("locations").update({ image_url: urlData.publicUrl, updated_at: new Date().toISOString() }).eq("id", locationId).eq("brand_id", brandId)
  if (error) return { error: error.message }
  revalidatePath(`/admin/brands/${brandId}`)
  return { url: urlData.publicUrl }
}

export async function deleteBrandLocation(locationId: string): Promise<{ ok: true } | { error: string }> {
  const auth = await requireAdmin()
  if ("error" in auth) return auth
  const supabase = createServiceRoleSupabaseClient() as any
  const { data: row } = await supabase.from("locations").select("brand_id").eq("id", locationId).maybeSingle()
  const { error } = await supabase.from("locations").delete().eq("id", locationId).not("brand_id", "is", null)
  if (error) { logger.error("Failed to delete brand location", { locationId }, error); return { error: error.message } }
  revalidatePath("/admin/brands")
  if (row?.brand_id) revalidatePath(`/admin/brands/${row.brand_id}`)
  return { ok: true }
}

// ── Merken uit een Apollo-lijst ──────────────────────────────────────────
// De lijst "Brands" in Apollo (een lijst van BEDRIJVEN) is de bron: naam,
// website, adres, telefoon, sociale kanalen, branchecodes en logo staan al
// bij het opgeslagen bedrijf, zonder credits. Opnieuw draaien voegt nieuwe
// merken toe en vult bij bestaande alleen lege velden aan; handmatig
// bewerkte velden blijven staan. Daarna krijgt elk merk zonder categorie een
// koppeling aan de productcategorieën van Arco (brand_categories).

export type ApolloBrandsResult =
  | { found: number; created: number; updated: number; unchanged: number; skipped: number; categorised: number; names: string[]
      /** Volgende blok, of null als de lijst op is. */
      nextPage: number | null
      /** Aantal accounts op de Apollo-lijst. */
      total: number }
  | { error: string }

/** Accounts per aanroep. Per nieuw merk gaat er een logo naar de opslag en
 *  een categorievoorstel naar Claude (samen een paar seconden); 25 past
 *  ruim binnen de 120 seconden die de pagina mag duren. De knop roept de
 *  import blok voor blok aan tot nextPage null is. */
const APOLLO_IMPORT_BATCH = 25

type ApolloAccount = {
  id: string | null; name: string | null; domain: string | null; primary_domain?: string | null
  city: string | null; country: string | null; logo_url: string | null; founded_year: number | null
  street_address: string | null; postal_code: string | null; sanitized_phone?: string | null; phone?: string | null
  linkedin_url: string | null; facebook_url: string | null; twitter_url: string | null
  naics_codes?: string[] | null; sic_codes?: string[] | null
}

const CATEGORY_PICK_SCHEMA = {
  type: "object",
  properties: { slugs: { type: "array", items: { type: "string" } } },
  required: ["slugs"],
  additionalProperties: false,
} as const

/** Productcategorieën voor een merk: wat zijn collecties al zeggen, anders een
 *  voorstel van Claude uit naam, domein en branchecodes (hoogstens drie). */
async function proposeBrandCategories(
  supabase: any,
  brand: { id: string; name: string; domain: string | null; naics: string[]; sic: string[] },
  categories: Array<{ id: string; slug: string; name: string; parent_id: string | null }>,
): Promise<string[]> {
  const bySlug = new Map(categories.map((c) => [c.slug, c.id]))
  const { data: fam } = await supabase.from("product_collections").select("category_id").eq("brand_id", brand.id).not("category_id", "is", null)
  const counts = new Map<string, number>()
  for (const f of (fam ?? []) as Array<{ category_id: string }>) counts.set(f.category_id, (counts.get(f.category_id) ?? 0) + 1)
  if (counts.size > 0) return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id)

  try {
    // Merken hangen aan een groep of subgroep (Verlichting › Binnenverlichting);
    // soorten (Hanglampen) zijn voor collecties. Alleen de bovenste twee
    // niveaus komen in het menu, met hun groep erbij zodat de keuze leesbaar is.
    const parentOf = new Map(categories.map((c) => [c.id, c.parent_id]))
    const slugOf = new Map(categories.map((c) => [c.id, c.slug]))
    const menu = categories
      .filter((c) => !c.parent_id || !parentOf.get(c.parent_id))
      .map((c) => (c.parent_id ? `${c.slug} (in ${slugOf.get(c.parent_id)})` : `${c.slug} (hoofdgroep)`))
      .join(", ")
    const message = await anthropicClient().messages.create({
      model: CLAUDE_BULK_MODEL,
      max_tokens: 300,
      output_config: { format: { type: "json_schema", schema: CATEGORY_PICK_SCHEMA as any } },
      messages: [{
        role: "user",
        content: `Welke productcategorieën maakt dit merk? Merk: ${brand.name}. Website: ${brand.domain ?? "onbekend"}. NAICS: ${brand.naics.join(", ") || "-"}. SIC: ${brand.sic.join(", ") || "-"}. Kies hoogstens drie slugs, de belangrijkste eerst, alleen uit deze lijst: ${menu}. Geef alleen slugs terug waar je zeker van bent; liever een hoofdgroep dan een gok op een subcategorie.`,
      }],
    } as any)
    const parsed = parseStructured<{ slugs: string[] }>(message)
    return (parsed?.slugs ?? []).map((s) => bySlug.get(s)).filter((x): x is string => Boolean(x)).slice(0, 3)
  } catch (err) {
    logger.warn("Brand category proposal failed", { brand: brand.name, error: String(err) })
    return []
  }
}

/** Apollo-verzoek met geduld bij een snelheidslimiet (429): wacht wat
 *  Apollo vraagt (Retry-After), anders 2, 5 en 10 seconden. */
async function apolloFetch(url: string, init: RequestInit): Promise<Response> {
  const waits = [2000, 5000, 10000]
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { ...init, cache: "no-store" })
    if (res.status !== 429 || attempt >= waits.length) return res
    const retryAfter = Number(res.headers.get("retry-after"))
    await new Promise((r) => setTimeout(r, Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 30000) : waits[attempt]))
  }
}

const apolloError = (what: string, status: number) =>
  status === 429
    ? `Apollo's limiet voor verzoeken is bereikt (${what}). Probeer het over een paar minuten opnieuw.`
    : `Apollo ${what}: ${status}`

export async function importBrandsFromApollo(listName = "Brands", page = 1): Promise<ApolloBrandsResult> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard
  const key = process.env.APOLLO_API_KEY?.trim()
  if (!key) return { error: "APOLLO_API_KEY is not configured." }
  const H = { "Content-Type": "application/json", "x-api-key": key }
  const supabase = createServiceRoleSupabaseClient() as any

  const labelsRes = await apolloFetch("https://api.apollo.io/api/v1/labels", { headers: H })
  if (!labelsRes.ok) return { error: apolloError("labels", labelsRes.status) }
  const labels = (await labelsRes.json()) as Array<{ _id: string; name: string; modality: string }>
  const list = labels.find((l) => l.modality === "accounts" && l.name.trim().toLowerCase() === listName.trim().toLowerCase())
  if (!list) return { error: `Geen Apollo-lijst van bedrijven met de naam "${listName}".` }

  // Eén blok van de lijst. Vroeger haalde dit de hele lijst (tot 3000) in
  // één aanroep op en verwerkte hem ook in één keer; bij honderden nieuwe
  // merken liep dat over de tijdslimiet en stopte de import halverwege.
  const res = await apolloFetch("https://api.apollo.io/api/v1/accounts/search", {
    method: "POST", headers: H,
    body: JSON.stringify({ account_label_ids: [list._id], per_page: APOLLO_IMPORT_BATCH, page, sort_by_field: "account_created_at", sort_ascending: true }),
  })
  if (!res.ok) return { error: apolloError("accounts", res.status) }
  const json = (await res.json()) as { accounts?: ApolloAccount[]; pagination?: { total_entries?: number; total_pages?: number } }
  const accounts: ApolloAccount[] = json.accounts ?? []
  const total = json.pagination?.total_entries ?? accounts.length
  const totalPages = json.pagination?.total_pages ?? page
  const nextPage = accounts.length > 0 && page < totalPages ? page + 1 : null

  const { data: catRows } = await supabase.from("product_categories").select("id, slug, name, parent_id")
  const categories = (catRows ?? []) as Array<{ id: string; slug: string; name: string; parent_id: string | null }>

  let created = 0, updated = 0, unchanged = 0, skipped = 0, categorised = 0
  const names: string[] = []
  for (const a of accounts) {
    const name = a.name?.trim()
    const domain = stripWww((a.domain ?? a.primary_domain ?? "").trim())
    if (!name || !domain) { skipped++; continue }
    const phone = (a.sanitized_phone ?? a.phone ?? null) || null
    const extra = {
      street_address: a.street_address || null, postal_code: a.postal_code || null, phone,
      linkedin_url: a.linkedin_url || null, facebook_url: a.facebook_url || null, x_url: a.twitter_url || null,
      naics_codes: a.naics_codes?.length ? a.naics_codes : null, sic_codes: a.sic_codes?.length ? a.sic_codes : null,
      apollo_account_id: a.id || null, city: a.city || null, country: a.country || null, founded_year: a.founded_year ?? null,
    }

    const { data: existing } = await supabase.from("brands").select("*").eq("domain", domain).maybeSingle()
    let brandId: string | null = existing?.id ?? null
    if (existing) {
      const patch: Record<string, unknown> = {}
      if (!existing.website) patch.website = `https://${domain}/`
      for (const [k, v] of Object.entries(extra)) if (v != null && (existing[k] == null || existing[k] === "")) patch[k] = v
      if (!existing.logo_url && a.logo_url) {
        const stored = await storeRemoteImage(supabase, a.logo_url, `brands/${existing.id}`, "logo")
        if (stored) patch.logo_url = stored
      }
      if (Object.keys(patch).length > 0) { await supabase.from("brands").update(patch).eq("id", existing.id); updated++ } else unchanged++
    } else {
      const slug = slugify(name)
      for (let attempt = 0; attempt < 5 && !brandId; attempt++) {
        const { data, error } = await supabase.from("brands").insert({
          slug: attempt === 0 ? slug : `${slug}-${attempt + 1}`, name, domain, website: `https://${domain}/`, status: "unclaimed", ...extra,
        }).select("id").single()
        if (!error && data) brandId = data.id
        else if (error?.code !== "23505") { logger.error("Apollo brand insert failed", { name }, error as any); break }
      }
      if (!brandId) { skipped++; continue }
      if (a.logo_url) {
        const stored = await storeRemoteImage(supabase, a.logo_url, `brands/${brandId}`, "logo")
        if (stored) await supabase.from("brands").update({ logo_url: stored }).eq("id", brandId)
      }
      created++
      names.push(name)
    }

    // Categorie: alleen voor merken die er nog geen hebben.
    if (brandId) {
      const { count } = await supabase.from("brand_categories").select("brand_id", { count: "exact", head: true }).eq("brand_id", brandId)
      if (!count) {
        const ids = await proposeBrandCategories(supabase, { id: brandId, name, domain, naics: a.naics_codes ?? [], sic: a.sic_codes ?? [] }, categories)
        if (ids.length > 0) {
          await supabase.from("brand_categories").insert(ids.map((category_id, position) => ({ brand_id: brandId, category_id, position })))
          categorised++
        }
      }
    }
  }

  revalidatePath("/admin/brands")
  return { found: accounts.length, created, updated, unchanged, skipped, categorised, names, nextPage, total }
}
