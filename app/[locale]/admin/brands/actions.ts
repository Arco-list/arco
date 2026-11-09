"use server"

import { revalidatePath } from "next/cache"
import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"
import { logger } from "@/lib/logger"
import { locationToRow, type LocationInput } from "@/lib/locations/types"
import { Firecrawl } from "@mendable/firecrawl-js"
import Anthropic from "@anthropic-ai/sdk"

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

type DiscoveredSeries = { name: string; url: string | null; image_url: string | null; description: string | null }
const DISCOVERED_SERIES_SCHEMA = {
  type: "object",
  properties: {
    series: {
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
  required: ["series"],
  additionalProperties: false,
} as const

// Reading one series page at a time is bulk work: the current Sonnet is
// plenty for "which images show this series" and a fraction of the cost.
const CLAUDE_BULK_MODEL = "claude-sonnet-5-5"
const MAX_PHOTOS_PER_SERIES = 12

type SeriesPageData = {
  description: string | null
  designer: string | null
  launch_year: number | null
  category_slug: string | null
  images: Array<{ url: string; alt: string | null }>
}
const SERIES_PAGE_SCHEMA = {
  type: "object",
  properties: {
    description: { type: ["string", "null"] },
    designer: { type: ["string", "null"] },
    launch_year: { type: ["integer", "null"] },
    category_slug: { type: ["string", "null"] },
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
  required: ["description", "designer", "launch_year", "category_slug", "images"],
  additionalProperties: false,
} as const

type EnrichableFamily = {
  id: string
  name: string
  url: string | null
  description: string | null
  designer: string | null
  launch_year: number | null
  category_id: string | null
}
type CategoryChoice = { slug: string; path: string }

const stripWww = (h: string) => h.replace(/^www\./, "").toLowerCase()

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "brand"
}

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

function absoluteHttpUrl(value: string | null | undefined, base: string): string | null {
  if (!value) return null
  try {
    const u = new URL(value, base)
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null
  } catch {
    return null
  }
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
 * The series on an overview page — what the brand itself calls its lines.
 * Firecrawl renders the page as markdown (links and images inline); Claude
 * picks out the named series and leaves categories, variants and
 * navigation alone. Nothing is stored here; the caller decides.
 */
async function discoverSeries(pageUrl: string, brandName: string, domain: string): Promise<{ series: DiscoveredSeries[] } | { error: string }> {
  let markdown = ""
  try {
    const doc = await firecrawlClient().scrape(pageUrl, {
      formats: ["markdown", "links"],
      timeout: 45000,
      waitFor: 5000,
    }) as any
    markdown = (doc?.markdown ?? "") as string
  } catch (err) {
    logger.error("Series page scrape failed", { url: pageUrl }, err as Error)
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

Below is one page of the brand's website, rendered as markdown. List the brand's SERIES: the named product lines, collections or families the brand itself uses to organise its range. A series is what architects specify and what a photo shows — for a lighting brand "Mito" or "Sento", for a kitchen brand "b3", for a furniture brand "Bart" or "Monster".

Include a series when the page presents it as a named line with its own page or its own group of products.

Do NOT include:
- individual products, sizes, colours or mounting variants ("Mito sospeso" is a variant of the series "Mito");
- generic categories ("Pendant lights", "Outdoor", "Sofas");
- navigation and utility pages (about, contact, dealers, news, downloads, configurators);
- accessories listings or other brands.

For each series give:
- name: as the brand writes it, without the brand name as a prefix;
- url: the absolute URL of its page on this site, or null;
- image_url: the absolute URL of the image shown for it on this page, or null;
- description: one sentence taken from the page, or null.

Keep the page order. At most 80. If the page shows no series, return an empty list.

Page URL: ${pageUrl}

Page content:
${excerpt}`,
      }],
      output_config: { format: { type: "json_schema", schema: DISCOVERED_SERIES_SCHEMA } },
    })
    const parsed = parseStructured<{ series: DiscoveredSeries[] }>(message)
    if (!parsed) return { error: "Could not read the series from the page you pasted; the brand was still saved." }

    const seen = new Set<string>()
    const series: DiscoveredSeries[] = []
    for (const s of parsed.series) {
      const name = s.name.trim()
      if (!name) continue
      const key = slugify(name)
      if (seen.has(key)) continue
      seen.add(key)
      series.push({
        name,
        url: absoluteHttpUrl(s.url, pageUrl),
        image_url: absoluteHttpUrl(s.image_url, pageUrl),
        description: s.description?.trim() || null,
      })
    }
    return { series }
  } catch (err) {
    logger.error("Series extraction failed", { url: pageUrl }, err as Error)
    return { error: claudeErrorMessage(err, "Could not read the series from the page you pasted; the brand was still saved.") }
  }
}

/**
 * One series' own page at the brand: the images that show it, and the
 * designer, year and description the page states. Firecrawl renders the
 * page (main content only) and lists its images; Claude picks.
 */
async function readSeriesPage(pageUrl: string, seriesName: string, brandName: string, categories: CategoryChoice[]): Promise<SeriesPageData | { error: string }> {
  let markdown = ""
  let images: string[] = []
  try {
    const doc = await firecrawlClient().scrape(pageUrl, {
      formats: ["markdown", "images"],
      timeout: 45000,
      waitFor: 3000,
      onlyMainContent: true,
    }) as any
    // 50k tekens is de serie zelf; de rest is "gerelateerd" en footer.
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
    logger.error("Series page scrape failed", { url: pageUrl }, err as Error)
    return { error: "Could not fetch the series page." }
  }
  if (!markdown.trim() && images.length === 0) return { error: "The series page has no readable content." }

  try {
    const message = await anthropicClient().messages.create({
      model: CLAUDE_BULK_MODEL,
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: `This is the page of the series "${seriesName}" by the brand "${brandName}", rendered as markdown, followed by the list of image URLs found on the page. It is being catalogued for an editorial directory of interior and architecture products.

Give:
- description: one or two sentences in English on what defines this series, taken from the page; null if the page says nothing usable.
- designer: the person or studio the page names as its designer, or null.
- launch_year: the year the series was introduced, as a number, or null if not stated.
- category_slug: what kind of product this series is, as one slug from the list of kinds below — the most specific kind that covers the WHOLE series. A family that spans several kinds (a lamp series with pendant, wall and floor versions) gets their common group. Null if nothing fits.
- images: the images on this page that show THIS series — product shots, details, and interiors with it in place. Exclude logos, icons, badges, award seals, portraits of people, PDF or download thumbnails, and images of other series or products in "related", "you may also like" or navigation sections. Keep the page order with the best image first. At most ${MAX_PHOTOS_PER_SERIES}.

Kinds (slug — group › kind):
${categories.map((c) => `${c.slug} — ${c.path}`).join("\n")}

Page URL: ${pageUrl}

Page content:
${markdown}

Image URLs on the page:
${images.join("\n")}`,
      }],
      output_config: { format: { type: "json_schema", schema: SERIES_PAGE_SCHEMA } },
    })
    const data = parseStructured<SeriesPageData>(message)
    if (!data) return { error: "Could not read the series page." }

    const seen = new Set<string>()
    const picked: SeriesPageData["images"] = []
    for (const im of data.images) {
      const url = absoluteHttpUrl(im.url, pageUrl)
      if (!url || seen.has(url)) continue
      seen.add(url)
      picked.push({ url, alt: im.alt?.trim() || null })
    }
    return {
      description: data.description?.trim() || null,
      designer: data.designer?.trim() || null,
      launch_year: data.launch_year,
      category_slug: data.category_slug?.trim() || null,
      images: picked.slice(0, MAX_PHOTOS_PER_SERIES),
    }
  } catch (err) {
    logger.error("Series page extraction failed", { url: pageUrl }, err as Error)
    return { error: claudeErrorMessage(err, "Could not read the series page.") }
  }
}

/**
 * Bring one series up to date from its page at the brand. Fields are only
 * filled where empty — an admin's edit wins over a scrape — and photos are
 * added only for urls the series does not have yet, so running it twice
 * is harmless. Stamps enriched_at (293).
 */
async function enrichFamily(supabase: any, family: EnrichableFamily, brandName: string): Promise<{ photos: number } | { error: string }> {
  if (!family.url) return { error: "This series has no page at the brand." }

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
  const page = await readSeriesPage(family.url, family.name, brandName, catRows.map((c) => ({ slug: c.slug, path: pathOf(c) })))
  if ("error" in page) return page

  const patch: Record<string, unknown> = { enriched_at: new Date().toISOString() }
  if (!family.category_id && page.category_slug) {
    const cat = catRows.find((c) => c.slug === page.category_slug)
    if (cat) patch.category_id = cat.id
  }
  if (!family.description && page.description) patch.description = page.description
  if (!family.designer && page.designer) patch.designer = page.designer
  const thisYear = new Date().getFullYear()
  if (!family.launch_year && page.launch_year && page.launch_year >= 1800 && page.launch_year <= thisYear + 1) patch.launch_year = page.launch_year
  const { error: patchError } = await supabase.from("product_families").update(patch).eq("id", family.id)
  if (patchError) return { error: patchError.message }

  // Copied into our bucket, not linked. source_url remembers where a
  // photo came from, so a second read of the same page recognises what
  // is already here; a copy that fails keeps the external url rather
  // than losing the photo.
  const { data: existing } = await supabase
    .from("product_family_photos")
    .select("url, source_url, is_primary, order_index")
    .eq("family_id", family.id)
  const rows = (existing ?? []) as Array<{ url: string; source_url: string | null; is_primary: boolean; order_index: number }>
  const have = new Set(rows.map((r) => r.source_url ?? r.url))
  const hasPrimary = rows.some((r) => r.is_primary)
  const nextOrder = rows.reduce((m, r) => Math.max(m, r.order_index), -1) + 1
  const fresh = page.images.filter((im) => !have.has(im.url))
  if (fresh.length > 0) {
    const stored = await Promise.all(fresh.map((im) => storeRemoteImage(supabase, im.url, `product-families/${family.id}`)))
    const { error } = await supabase
      .from("product_family_photos")
      .insert(fresh.map((im, i) => ({ family_id: family.id, url: stored[i] ?? im.url, source_url: im.url, alt_text: im.alt, is_primary: !hasPrimary && i === 0, order_index: nextOrder + i })))
    if (error) return { error: error.message }
    await syncFamilyCover(supabase, family.id)
  }
  return { photos: fresh.length }
}

export type AddBrandResult = { brandId: string; name: string; created: boolean } | { error: string }

/**
 * Add brand, step 1 of 3: the brand itself, from the homepage of whatever
 * page was pasted — name, description, country, year, logo. Admin only.
 * A brand that already exists on that domain is returned as it is.
 *
 * The three steps are separate actions so the popup can show where it
 * is: the client calls this, then discoverBrandSeries for the pasted
 * page, then fetchSeriesFromBrandPage per series. Each step stays well
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

export type DiscoverSeriesResult =
  | { seriesFound: number; seriesAdded: number; pending: Array<{ id: string; name: string }> }
  | { error: string }

/**
 * Add brand, step 2 of 3: the series on the pasted page, added where the
 * brand does not have them yet; the image from the overview becomes the
 * cover. Returns the series whose own page has not been read yet
 * (enriched_at empty) — the list step 3 works through. A brand that
 * already has everything comes back with an empty list.
 */
export async function discoverBrandSeries(brandId: string, pageUrl: string): Promise<DiscoverSeriesResult> {
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
  const { data: brand } = await supabase.from("brands").select("id, name, domain").eq("id", brandId).maybeSingle()
  if (!brand) return { error: "Brand not found." }

  const discovered = await discoverSeries(url.toString(), brand.name, brand.domain ?? stripWww(url.hostname))
  if ("error" in discovered) return discovered

  const { data: existingFamilies } = await supabase
    .from("product_families")
    .select("slug")
    .eq("brand_id", brandId)
  const have = new Set(((existingFamilies ?? []) as Array<{ slug: string }>).map((f) => f.slug))

  let added = 0
  for (const s of discovered.series) {
    const familySlug = slugify(s.name)
    if (have.has(familySlug)) continue

    const { data: family, error } = await supabase
      .from("product_families")
      .insert({ brand_id: brandId, slug: familySlug, name: s.name, url: s.url, description: s.description })
      .select("id")
      .single()
    if (error || !family) {
      logger.error("Series insert failed", { brand: brandId, series: s.name }, error as any)
      continue
    }
    have.add(familySlug)
    added++

    // The image from the overview becomes the cover: a photo row, as an
    // uploaded cover would be (292), copied into our bucket.
    if (s.image_url) {
      const stored = await storeRemoteImage(supabase, s.image_url, `product-families/${family.id}`)
      await supabase
        .from("product_family_photos")
        .insert({ family_id: family.id, url: stored ?? s.image_url, source_url: s.image_url, is_primary: true, order_index: 0 })
      await syncFamilyCover(supabase, family.id)
    }
  }

  const { data: toRead } = await supabase
    .from("product_families")
    .select("id, name")
    .eq("brand_id", brandId)
    .not("url", "is", null)
    .is("enriched_at", null)
    .order("name")

  revalidatePath("/admin/brands")
  revalidatePath(`/admin/brands/${brandId}`)
  return { seriesFound: discovered.series.length, seriesAdded: added, pending: (toRead ?? []) as Array<{ id: string; name: string }> }
}

/**
 * Add brand, step 3 of 3 (per series) — and the button on the series
 * page: read the series' own page at the brand for photos it does not
 * have yet, and designer, year and description where still empty.
 */
export async function fetchSeriesFromBrandPage(familyId: string): Promise<{ photos: number } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard
  if (!process.env.FIRECRAWL_API_KEY) return { error: "FIRECRAWL_API_KEY is not configured." }
  if (!process.env.ANTHROPIC_API_KEY) return { error: "ANTHROPIC_API_KEY is not configured." }

  const supabase = createServiceRoleSupabaseClient() as any
  const { data: family } = await supabase
    .from("product_families")
    .select("id, name, url, description, designer, launch_year, category_id, brand_id, brands(name)")
    .eq("id", familyId)
    .maybeSingle()
  if (!family) return { error: "Series not found." }
  if (!family.url) return { error: "Add the series page at the brand first (under Links)." }

  const result = await enrichFamily(supabase, family, family.brands?.name ?? "")
  if ("error" in result) return result
  revalidatePath(`/admin/brands/${family.brand_id}`)
  revalidatePath(`/admin/brands/${family.brand_id}/series/${familyId}`)
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

  const { error } = await (supabase as any).from("brands").update(patch).eq("id", brandId)
  if (error) return { error: error.message }

  revalidatePath("/admin/brands")
  return { ok: true }
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
  const path = `brands/${brandId}/logo.${ext}`

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

/**
 * Resolve or create a product family by name for a given brand. Used by the
 * collection field on the product edit page so editors can type a new name
 * without jumping to the brand page to create it first.
 */
export async function upsertProductFamily(
  brandId: string,
  name: string,
): Promise<{ id: string; name: string } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const trimmed = name.trim()
  if (!trimmed) return { error: "Name is required." }

  const supabase = createServiceRoleSupabaseClient() as any
  const familySlug = slugify(trimmed)

  const { data: existing } = await supabase
    .from("product_families")
    .select("id, name")
    .eq("brand_id", brandId)
    .eq("slug", familySlug)
    .maybeSingle()

  if (existing) return existing

  const { data: inserted, error } = await supabase
    .from("product_families")
    .insert({ brand_id: brandId, slug: familySlug, name: trimmed })
    .select("id, name")
    .single()

  if (error || !inserted) return { error: error?.message ?? "Could not create collection." }
  revalidatePath(`/admin/brands/${brandId}`)
  return inserted
}

/**
 * Rename a collection and/or swap its hero image. Admin only.
 */
export async function updateProductFamily(
  familyId: string,
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
  // Wat een seriepagina toont en een catalogus niet geeft (migratie 289).
  if (fields.description !== undefined) patch.description = fields.description?.trim() || null
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

  const { data: family } = await supabase
    .from("product_families")
    .select("brand_id")
    .eq("id", familyId)
    .maybeSingle()

  const { error } = await supabase.from("product_families").update(patch).eq("id", familyId)
  if (error) return { error: error.message }

  if (family?.brand_id) revalidatePath(`/admin/brands/${family.brand_id}`)
  return { ok: true }
}

// ── Series photos ──────────────────────────────────────────────────────
// Een serie heeft foto's zoals een product ze had (migratie 292): meerdere
// beelden, één primair. hero_image_url op product_families is de kopie van
// de primaire foto voor de kaarten; syncFamilyCover houdt hem bij.

const FAMILY_PHOTO_MAX_BYTES = 10 * 1024 * 1024
const REMOTE_IMAGE_MAX_BYTES = 15 * 1024 * 1024
const IMAGE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/svg+xml": "svg",
}

/**
 * Copy an image from a brand's site into our bucket. Everything we show
 * is ours to keep: a brand's CDN renames, resizes and disappears, and
 * a page that depends on it breaks without anyone changing anything
 * here. Returns our public url, or null when the fetch failed or the
 * response was not an image — the caller decides what to do then.
 * `name` fixes the file name (upsert) for things that exist once, like
 * a logo; otherwise the file gets a unique name.
 */
async function storeRemoteImage(supabase: any, remoteUrl: string, folder: string, name?: string): Promise<string | null> {
  try {
    const res = await fetch(remoteUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ArcoBot/1.0)", Accept: "image/*,*/*;q=0.8" },
      signal: AbortSignal.timeout(20000),
      redirect: "follow",
      cache: "no-store",
    })
    if (!res.ok) return null
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase()
    const ext = IMAGE_EXT[type]
    if (!ext) return null
    const declared = Number(res.headers.get("content-length") ?? 0)
    if (declared > REMOTE_IMAGE_MAX_BYTES) return null
    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.byteLength === 0 || bytes.byteLength > REMOTE_IMAGE_MAX_BYTES) return null

    const file = name ? `${name}.${ext}` : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
    const path = `${folder}/${file}`
    const { error } = await supabase.storage
      .from("company-assets")
      .upload(path, bytes, { cacheControl: "31536000", upsert: Boolean(name), contentType: type })
    if (error) {
      logger.error("Remote image upload failed", { url: remoteUrl, path }, error as any)
      return null
    }
    const { data } = supabase.storage.from("company-assets").getPublicUrl(path)
    return data?.publicUrl ?? null
  } catch (err) {
    logger.error("Remote image fetch failed", { url: remoteUrl }, err as Error)
    return null
  }
}

/** Remove everything under one folder of the bucket (a brand's, a series'). */
async function removeStorageFolder(supabase: any, folder: string): Promise<void> {
  const { data: objects } = await supabase.storage.from("company-assets").list(folder, { limit: 1000 })
  if (objects && objects.length > 0) {
    await supabase.storage.from("company-assets").remove(objects.map((o: { name: string }) => `${folder}/${o.name}`))
  }
}

async function storeFamilyFile(supabase: any, familyId: string, file: File): Promise<{ url: string } | { error: string }> {
  if (file.size > FAMILY_PHOTO_MAX_BYTES) return { error: `${file.name} is over 10MB.` }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
  const rand = Math.random().toString(36).slice(2, 10)
  const path = `product-families/${familyId}/${Date.now()}-${rand}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from("company-assets")
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type })
  if (uploadError) return { error: uploadError.message }

  const { data: urlData } = supabase.storage.from("company-assets").getPublicUrl(path)
  if (!urlData?.publicUrl) return { error: "Could not get public URL." }
  return { url: urlData.publicUrl }
}

/** De cover is de primaire foto, anders de eerste; zonder foto's geen cover. */
async function syncFamilyCover(supabase: any, familyId: string): Promise<void> {
  const { data: primary } = await supabase
    .from("product_family_photos")
    .select("url")
    .eq("family_id", familyId)
    .order("is_primary", { ascending: false })
    .order("order_index", { ascending: true })
    .limit(1)
    .maybeSingle()
  await supabase.from("product_families").update({ hero_image_url: primary?.url ?? null }).eq("id", familyId)
}

async function revalidateFamily(supabase: any, familyId: string): Promise<void> {
  const { data } = await supabase.from("product_families").select("brand_id").eq("id", familyId).maybeSingle()
  if (data?.brand_id) {
    revalidatePath(`/admin/brands/${data.brand_id}`)
    revalidatePath(`/admin/brands/${data.brand_id}/series/${familyId}`)
  }
}

/**
 * Upload a cover for a series: the file becomes a photo of the series and
 * its primary one. Admin only. Used by the card menu on the brand page and
 * by the hero on the series page.
 */
export async function uploadProductFamilyImage(
  familyId: string,
  formData: FormData,
): Promise<{ url: string } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const file = formData.get("file") as File | null
  if (!file) return { error: "No file provided." }

  const supabase = createServiceRoleSupabaseClient() as any
  const stored = await storeFamilyFile(supabase, familyId, file)
  if ("error" in stored) return stored

  const { data: last } = await supabase
    .from("product_family_photos")
    .select("order_index")
    .eq("family_id", familyId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle()

  await supabase.from("product_family_photos").update({ is_primary: false }).eq("family_id", familyId)
  const { error } = await supabase
    .from("product_family_photos")
    .insert({ family_id: familyId, url: stored.url, is_primary: true, order_index: (last?.order_index ?? -1) + 1 })
  if (error) return { error: error.message }

  await syncFamilyCover(supabase, familyId)
  await revalidateFamily(supabase, familyId)
  return { url: stored.url }
}

/**
 * Upload one or more photos for a series. The first becomes the cover when
 * the series has none yet; the rest append in order.
 */
export async function uploadProductFamilyPhotos(
  familyId: string,
  formData: FormData,
): Promise<{ photos: { id: string; url: string }[] } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const files = formData.getAll("files").filter((f): f is File => f instanceof File)
  if (files.length === 0) return { error: "No files provided." }

  const supabase = createServiceRoleSupabaseClient() as any
  const { data: existing } = await supabase
    .from("product_family_photos")
    .select("id, is_primary, order_index")
    .eq("family_id", familyId)
    .order("order_index", { ascending: false })

  let hasPrimary = ((existing ?? []) as Array<{ is_primary: boolean }>).some((r) => r.is_primary)
  let nextOrder = existing && existing.length > 0 ? (existing[0].order_index ?? 0) + 1 : 0
  const inserted: { id: string; url: string }[] = []

  for (const file of files) {
    const stored = await storeFamilyFile(supabase, familyId, file)
    if ("error" in stored) return stored
    const { data: row, error } = await supabase
      .from("product_family_photos")
      .insert({ family_id: familyId, url: stored.url, is_primary: !hasPrimary, order_index: nextOrder++ })
      .select("id, url")
      .single()
    if (error || !row) return { error: error?.message ?? "Could not save photo." }
    hasPrimary = true
    inserted.push({ id: row.id, url: row.url })
  }

  await syncFamilyCover(supabase, familyId)
  await revalidateFamily(supabase, familyId)
  return { photos: inserted }
}

/** Make a photo the cover of its series; only one carries the flag. */
export async function setProductFamilyCover(photoId: string): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const supabase = createServiceRoleSupabaseClient() as any
  const { data: photo } = await supabase.from("product_family_photos").select("id, family_id").eq("id", photoId).maybeSingle()
  if (!photo) return { error: "Photo not found." }

  const { error: clearError } = await supabase.from("product_family_photos").update({ is_primary: false }).eq("family_id", photo.family_id)
  if (clearError) return { error: clearError.message }
  const { error: setError } = await supabase.from("product_family_photos").update({ is_primary: true }).eq("id", photoId)
  if (setError) return { error: setError.message }

  await syncFamilyCover(supabase, photo.family_id)
  await revalidateFamily(supabase, photo.family_id)
  return { ok: true }
}

/**
 * Delete a photo of a series. If it was the cover, the next one takes
 * over. Files in our bucket are removed; external urls are left alone.
 */
export async function deleteProductFamilyPhoto(photoId: string): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const supabase = createServiceRoleSupabaseClient() as any
  const { data: photo } = await supabase
    .from("product_family_photos")
    .select("id, url, is_primary, family_id")
    .eq("id", photoId)
    .maybeSingle()
  if (!photo) return { error: "Photo not found." }

  // .../storage/v1/object/public/company-assets/product-families/<id>/<file>
  const match = (photo.url as string).match(/\/storage\/v1\/object\/public\/company-assets\/(.+)$/)
  if (match?.[1]) await supabase.storage.from("company-assets").remove([match[1]])

  const { error } = await supabase.from("product_family_photos").delete().eq("id", photoId)
  if (error) return { error: error.message }

  if (photo.is_primary) {
    const { data: next } = await supabase
      .from("product_family_photos")
      .select("id")
      .eq("family_id", photo.family_id)
      .order("order_index", { ascending: true })
      .limit(1)
      .maybeSingle()
    if (next) await supabase.from("product_family_photos").update({ is_primary: true }).eq("id", next.id)
  }

  await syncFamilyCover(supabase, photo.family_id)
  await revalidateFamily(supabase, photo.family_id)
  return { ok: true }
}

/**
 * Delete a series. Project links that pointed at it keep their brand:
 * project_brands.family_id is ON DELETE SET NULL (migration 289).
 */
export async function deleteProductFamily(
  familyId: string,
): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const supabase = createServiceRoleSupabaseClient() as any

  const { data: family } = await supabase
    .from("product_families")
    .select("brand_id")
    .eq("id", familyId)
    .maybeSingle()

  // Eigen bestanden onder product-families/<id>/ gaan mee; de fotorijen
  // cascaden met de serie (292).
  await removeStorageFolder(supabase, `product-families/${familyId}`)

  const { error } = await supabase.from("product_families").delete().eq("id", familyId)
  if (error) return { error: error.message }

  if (family?.brand_id) revalidatePath(`/admin/brands/${family.brand_id}`)
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
  // van elke serie onder product-families/<id>/. De rijen cascaden.
  const { data: families } = await supabase.from("product_families").select("id").eq("brand_id", brandId)
  const folders = [`brands/${brandId}`, ...((families ?? []) as Array<{ id: string }>).map((f) => `product-families/${f.id}`)]
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
