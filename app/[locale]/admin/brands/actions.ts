"use server"

import { revalidatePath } from "next/cache"
import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"
import { logger } from "@/lib/logger"
import { Firecrawl } from "@mendable/firecrawl-js"
import Anthropic from "@anthropic-ai/sdk"

export type ScrapeBrandResult =
  | { brandId: string; name: string; created: boolean }
  | { error: string }

interface ExtractedBrand {
  name: string
  description: string | null
  country: string | null
  founded_year: number | null
}

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

/**
 * Extract brand metadata from a homepage using Claude.
 * Returns structured brand info — name, short description, country.
 */
async function extractBrandWithClaude(pageText: string, sourceUrl: string): Promise<ExtractedBrand> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: `You are extracting brand metadata from a high-end interior products brand's homepage for an editorial directory.

Source URL: ${sourceUrl}

Page content:
${pageText.slice(0, 4000)}

Extract the following as JSON. Return ONLY the JSON object, no commentary.

{
  "name": "Official brand name (cleaned, no taglines)",
  "description": "1-2 sentence editorial description of the brand. Focus on what they make and what they're known for. Max 240 characters.",
  "country": "Country of origin (e.g. 'Netherlands', 'Italy', 'Germany') or null if unclear",
  "founded_year": "Year founded as a number, or null if not stated"
}

If the page doesn't appear to be a brand homepage (e.g. it's a retailer, news site, or unrelated page), return: {"name": "", "description": null, "country": null, "founded_year": null}`,
    }],
  })

  const text = message.content[0]?.type === "text" ? message.content[0].text : ""
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("No JSON in Claude response")

  const parsed = JSON.parse(jsonMatch[0])
  return {
    name: parsed.name ?? "",
    description: parsed.description ?? null,
    country: parsed.country ?? null,
    founded_year: typeof parsed.founded_year === "number" ? parsed.founded_year : null,
  }
}

/**
 * Scrape a brand homepage and create a brands row in `unclaimed` state.
 * Admin-only. The product catalog is scraped separately per-product URL.
 */
export async function scrapeBrand(rawUrl: string): Promise<ScrapeBrandResult> {
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

  const domain = stripWww(url.hostname)
  // Cast: brands/products tables exist via migration 129 but Supabase
  // types haven't been regenerated yet. Remove cast after running
  // `supabase gen types typescript`.
  const supabase = createServiceRoleSupabaseClient() as any

  // Check if brand already exists for this domain
  const { data: existing } = await supabase
    .from("brands")
    .select("id, name")
    .eq("domain", domain)
    .maybeSingle()

  if (existing) {
    return { brandId: existing.id, name: existing.name, created: false }
  }

  // Scrape with Firecrawl
  if (!process.env.FIRECRAWL_API_KEY) {
    return { error: "FIRECRAWL_API_KEY is not configured." }
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "ANTHROPIC_API_KEY is not configured." }
  }

  let extracted: ExtractedBrand
  let logoUrl: string | null = null

  try {
    const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY })
    const result = await firecrawl.scrape(url.toString(), {
      formats: ["markdown", "html"],
      timeout: 30000,
      waitFor: 5000,
    }) as any

    if (!result || (!result.markdown && !result.metadata)) {
      return { error: "Could not fetch that page. Is the site publicly accessible?" }
    }

    const pageText = (result.markdown ?? "").slice(0, 6000)

    // og:image is usually the brand's hero/logo
    logoUrl = result.metadata?.ogImage ?? null

    extracted = await extractBrandWithClaude(pageText, url.toString())
  } catch (err) {
    logger.error("Brand scrape failed", { url: url.toString() }, err as Error)
    return { error: "Could not extract brand info. Please try a different page." }
  }

  if (!extracted.name) {
    return { error: "Could not identify a brand on this page. Please link directly to the brand's homepage or about page." }
  }

  const slug = slugify(extracted.name)

  // Insert with retry on slug collision
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
        website: url.toString(),
        logo_url: logoUrl,
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

    logger.error("Brand insert failed", { url: url.toString() }, error as any)
    return { error: `Could not save brand: ${error?.message ?? "unknown error"}` }
  }

  if (!inserted) {
    return { error: "Could not generate a unique brand slug." }
  }

  revalidatePath("/admin/brands")
  return { brandId: inserted.id, name: inserted.name, created: true }
}

/**
 * Scrape a single product page and create a products row.
 * Requires the brand to exist already (admin must scrape the brand first).
 */
export async function scrapeProduct(rawUrl: string, brandId: string): Promise<{ productId: string; name: string } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { error: "Please enter a valid URL." }
  }

  const supabase = createServiceRoleSupabaseClient() as any

  // Verify brand exists
  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, domain")
    .eq("id", brandId)
    .maybeSingle()

  if (!brand) return { error: "Brand not found." }

  // Check for duplicate
  const { data: existing } = await supabase
    .from("products")
    .select("id, name")
    .eq("source_url", url.toString())
    .maybeSingle()

  if (existing) {
    return { productId: existing.id, name: existing.name }
  }

  if (!process.env.FIRECRAWL_API_KEY || !process.env.ANTHROPIC_API_KEY) {
    return { error: "Scraping requires FIRECRAWL_API_KEY and ANTHROPIC_API_KEY." }
  }

  let productData: { name: string; description: string | null; specs: Record<string, any> | null }
  let imageUrls: string[] = []

  try {
    const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY })
    const result = await firecrawl.scrape(url.toString(), {
      formats: ["markdown", "html"],
      timeout: 45000,
      waitFor: 8000,
    }) as any

    if (!result?.markdown && !result?.html) {
      return { error: "Could not fetch product page." }
    }

    // Extract images from markdown
    const imgRegex = /!\[[^\]]*\]\(([^)]+)\)/g
    let match
    const seen = new Set<string>()
    while ((match = imgRegex.exec(result.markdown ?? "")) !== null) {
      try {
        const abs = new URL(match[1], url.toString()).toString()
        if (seen.has(abs)) continue
        if (/\.(svg|ico|gif)(\?|$)/i.test(abs)) continue
        if (/logo|icon|favicon|sprite/i.test(abs)) continue
        seen.add(abs)
        imageUrls.push(abs)
      } catch {}
    }
    imageUrls = imageUrls.slice(0, 15)

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const pageText = (result.markdown ?? "").slice(0, 5000)

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: `Extract product info from this brand product page for an editorial directory.

Brand: ${brand.name}
URL: ${url.toString()}

Page content:
${pageText}

Return ONLY a JSON object:
{
  "name": "Product name (cleaned, no brand prefix unless part of the name)",
  "description": "1-2 sentence editorial description in your own words. Max 280 characters. Don't copy verbatim.",
  "specs": { "key": "value" }
}

specs is a flexible map of attributes (dimensions, material, finish, wattage, etc.) — only include attributes that are actually stated on the page.

If the page is not a product page, return: {"name": "", "description": null, "specs": null}`,
      }],
    })

    const text = message.content[0]?.type === "text" ? message.content[0].text : ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("No JSON in Claude response")

    const parsed = JSON.parse(jsonMatch[0])
    productData = {
      name: parsed.name ?? "",
      description: parsed.description ?? null,
      specs: parsed.specs ?? null,
    }
  } catch (err) {
    logger.error("Product scrape failed", { url: url.toString() }, err as Error)
    return { error: "Could not extract product info." }
  }

  if (!productData.name) {
    return { error: "Could not identify a product on this page." }
  }

  const slug = `${slugify(brand.name)}-${slugify(productData.name)}`
  let finalSlug = slug
  let attempts = 0
  let inserted: { id: string; name: string } | null = null

  while (attempts < 5) {
    const { data, error } = await supabase
      .from("products")
      .insert({
        slug: finalSlug,
        brand_id: brand.id,
        name: productData.name,
        description: productData.description,
        specs: productData.specs,
        source_url: url.toString(),
        status: "listed",
        scraped_at: new Date().toISOString(),
      })
      .select("id, name")
      .single()

    if (!error && data) {
      inserted = data
      break
    }

    if (error?.code === "23505") {
      attempts++
      finalSlug = `${slug}-${attempts + 1}`
      continue
    }

    return { error: `Could not save product: ${error?.message ?? "unknown error"}` }
  }

  if (!inserted) return { error: "Could not generate a unique product slug." }

  // Insert photos
  if (imageUrls.length > 0) {
    const photoRows = imageUrls.map((url, i) => ({
      product_id: inserted!.id,
      url,
      is_primary: i === 0,
      order_index: i,
      attribution: `Image: ${brand.name}`,
    }))
    await supabase.from("product_photos").insert(photoRows)
  }

  revalidatePath("/admin/products")
  revalidatePath(`/admin/brands/${brand.id}`)
  return { productId: inserted.id, name: inserted.name }
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
 * Delete a brand and all its products + photos (cascade).
 */
export async function deleteBrand(brandId: string): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const supabase = createServiceRoleSupabaseClient() as any
  const { error } = await supabase.from("brands").delete().eq("id", brandId)
  if (error) return { error: error.message }

  revalidatePath("/admin/brands")
  return { ok: true }
}
