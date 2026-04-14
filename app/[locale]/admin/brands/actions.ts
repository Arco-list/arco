"use server"

import { revalidatePath } from "next/cache"
import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"
import { logger } from "@/lib/logger"
import { Firecrawl } from "@mendable/firecrawl-js"
import Anthropic from "@anthropic-ai/sdk"
import { scrapeProductGeneric } from "@/lib/scraper/product-scraper"

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
  const supabase = createServiceRoleSupabaseClient()

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

  // Fetch all leaf categories for the Claude prompt so it can classify
  const { data: allCategories } = await supabase
    .from("product_categories")
    .select("id, slug, name, parent_id")
    .order("order_index")
  const leafCategories = (allCategories ?? []).filter((c: any) => c.parent_id !== null)
  const categoryList = leafCategories.map((c: any) => `${c.slug}: ${c.name}`).join(", ")

  const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY })
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const productData = await scrapeProductGeneric(url, {
    firecrawl,
    anthropic,
    brandName: brand.name,
    categoryList,
  })

  if ("error" in productData) {
    logger.error("Product scrape failed", { url: url.toString() })
    return productData
  }

  const imageUrls = productData.photos

  if (!productData.name) {
    return { error: "Could not identify a product on this page." }
  }

  // Resolve category slug to ID
  let categoryId: string | null = null
  if (productData.category_slug) {
    const match = leafCategories.find((c: any) => c.slug === productData.category_slug)
    if (match) categoryId = match.id
  }

  // Resolve or create product family
  let familyId: string | null = null
  if (productData.family) {
    const familySlug = slugify(productData.family)
    // Try to find existing family for this brand
    const { data: existingFamily } = await supabase
      .from("product_families")
      .select("id")
      .eq("brand_id", brand.id)
      .eq("slug", familySlug)
      .maybeSingle()

    if (existingFamily) {
      familyId = existingFamily.id
    } else {
      const { data: newFamily } = await supabase
        .from("product_families")
        .insert({
          brand_id: brand.id,
          slug: familySlug,
          name: productData.family,
        })
        .select("id")
        .single()
      if (newFamily) familyId = newFamily.id
    }
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
        family_id: familyId,
        category_id: categoryId,
        name: productData.name,
        description: productData.description,
        specs: productData.specs,
        variants: productData.variants,
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
 * Update a brand's name, description, and/or logo. Admin only.
 */
export async function updateBrand(brandId: string, fields: { name?: string; description?: string; logo_url?: string }): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const supabase = createServiceRoleSupabaseClient()
  const patch: Record<string, any> = {}
  if (fields.name !== undefined) patch.name = fields.name
  if (fields.description !== undefined) patch.description = fields.description
  if (fields.logo_url !== undefined) patch.logo_url = fields.logo_url

  if (Object.keys(patch).length === 0) return { ok: true }

  const { error } = await supabase.from("brands").update(patch).eq("id", brandId)
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

/**
 * Delete a single product and its photos (cascade).
 */
export async function deleteProduct(productId: string): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const supabase = createServiceRoleSupabaseClient()
  const { error } = await supabase.from("products").delete().eq("id", productId)
  if (error) return { error: error.message }

  revalidatePath("/admin/products")
  return { ok: true }
}

/**
 * Delete multiple products and their photos (cascade).
 */
export async function deleteProducts(productIds: string[]): Promise<{ ok: true; deleted: number } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  if (productIds.length === 0) return { ok: true, deleted: 0 }

  const supabase = createServiceRoleSupabaseClient()
  const { error } = await supabase.from("products").delete().in("id", productIds)
  if (error) return { error: error.message }

  revalidatePath("/admin/products")
  return { ok: true, deleted: productIds.length }
}

// ═══════════════════════════════════════════════════════════════════════
// Catalog discovery — scrape a products/collection page and extract
// all product links for selective batch-scraping.
// ═══════════════════════════════════════════════════════════════════════

export type DiscoveredProduct = {
  url: string
  name: string
  imageUrl: string | null
}

export type DiscoverCatalogResult =
  | { products: DiscoveredProduct[] }
  | { error: string }

/**
 * Discover product URLs from a brand's collection/products page.
 *
 * Flow:
 * 1. Try sitemap.xml first (cheapest, most complete)
 * 2. Fall back to scraping the provided collection page
 * 3. Claude filters discovered URLs to actual product pages
 * 4. Returns candidates for the admin to select
 */
export async function discoverCatalog(collectionUrl: string, brandId: string): Promise<DiscoverCatalogResult> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  let url: URL
  try {
    url = new URL(collectionUrl)
  } catch {
    return { error: "Please enter a valid URL." }
  }

  const supabase = createServiceRoleSupabaseClient()

  // Verify brand exists
  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, domain")
    .eq("id", brandId)
    .maybeSingle()

  if (!brand) return { error: "Brand not found." }

  const brandDomain = brand.domain ?? stripWww(url.hostname)

  // Check which products are already scraped for this brand (skip duplicates)
  const { data: existingProducts } = await supabase
    .from("products")
    .select("source_url")
    .eq("brand_id", brandId)

  const existingUrls = new Set(
    (existingProducts ?? [])
      .map((p: any) => p.source_url?.replace(/\/+$/, "").toLowerCase())
      .filter(Boolean)
  )

  // ── Strategy 1: Try sitemap.xml ──────────────────────────────────────
  let candidateUrls: { url: string; name: string }[] = []

  try {
    const sitemapUrls = [
      `https://${brandDomain}/sitemap.xml`,
      `https://www.${brandDomain}/sitemap.xml`,
      `https://${brandDomain}/sitemap_index.xml`,
    ]

    let sitemapXml: string | null = null
    for (const sUrl of sitemapUrls) {
      try {
        const res = await fetch(sUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; ArcoBot/1.0)" },
          signal: AbortSignal.timeout(8000),
        })
        if (res.ok) {
          sitemapXml = await res.text()
          console.log(`[catalog] Found sitemap at ${sUrl}`)
          break
        }
      } catch {}
    }

    if (sitemapXml) {
      // Extract all <loc> URLs from sitemap(s)
      const locRegex = /<loc>([^<]+)<\/loc>/gi
      let match
      const allLocs: string[] = []
      while ((match = locRegex.exec(sitemapXml)) !== null) {
        allLocs.push(match[1].trim())
      }

      // If this is a sitemap index, fetch child sitemaps
      if (sitemapXml.includes("<sitemapindex")) {
        for (const childUrl of allLocs.slice(0, 10)) {
          try {
            const childRes = await fetch(childUrl, {
              headers: { "User-Agent": "Mozilla/5.0 (compatible; ArcoBot/1.0)" },
              signal: AbortSignal.timeout(8000),
            })
            if (childRes.ok) {
              const childXml = await childRes.text()
              let childMatch
              while ((childMatch = locRegex.exec(childXml)) !== null) {
                allLocs.push(childMatch[1].trim())
              }
            }
          } catch {}
        }
      }

      // Filter to URLs that look like product pages
      const productLike = allLocs.filter((u) => {
        const lower = u.toLowerCase()
        // Must be on the brand's domain
        try {
          const parsed = new URL(u)
          if (stripWww(parsed.hostname) !== stripWww(brandDomain)) return false
        } catch { return false }
        // Exclude obvious non-product patterns
        if (/\/(press|news|blog|about|contact|career|legal|privacy|terms|cookie|sitemap|feed|tag|category|author|page\/\d|wp-content|wp-admin)/i.test(lower)) return false
        // Must have some path depth (not just the homepage)
        const path = lower.replace(/^https?:\/\/[^/]+/, "").replace(/\/+$/, "")
        if (path.length < 3) return false
        return true
      })

      console.log(`[catalog] Sitemap: ${allLocs.length} total URLs, ${productLike.length} product-like`)

      if (productLike.length > 0 && productLike.length < 500) {
        candidateUrls = productLike.map((u) => ({
          url: u,
          name: decodeURIComponent(u.split("/").filter(Boolean).pop() ?? "")
            .replace(/[-_]/g, " ")
            .replace(/\.\w+$/, ""),
        }))
      }
    }
  } catch (err) {
    console.log("[catalog] Sitemap discovery failed:", err)
  }

  // ── Strategy 2: Scrape the collection page ───────────────────────────
  if (candidateUrls.length === 0) {
    if (!process.env.FIRECRAWL_API_KEY) {
      return { error: "FIRECRAWL_API_KEY is not configured." }
    }

    try {
      const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY })
      const result = await firecrawl.scrape(url.toString(), {
        formats: ["markdown", "html"],
        timeout: 45000,
        waitFor: 10000,
      }) as any

      if (!result?.markdown && !result?.html) {
        return { error: "Could not fetch the collection page." }
      }

      // Extract all links from the page
      const html = result.html ?? result.rawHtml ?? ""
      const markdown = result.markdown ?? ""

      // Extract from HTML <a href="...">
      const hrefRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)</gi
      let hMatch
      const rawLinks: { url: string; text: string }[] = []
      while ((hMatch = hrefRegex.exec(html)) !== null) {
        try {
          const abs = new URL(hMatch[1], url.toString()).toString()
          if (stripWww(new URL(abs).hostname) === stripWww(brandDomain)) {
            rawLinks.push({ url: abs, text: hMatch[2].trim() })
          }
        } catch {}
      }

      // Extract from markdown [text](url)
      const mdLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/g
      let mMatch
      while ((mMatch = mdLinkRegex.exec(markdown)) !== null) {
        try {
          const abs = new URL(mMatch[2], url.toString()).toString()
          if (stripWww(new URL(abs).hostname) === stripWww(brandDomain)) {
            rawLinks.push({ url: abs, text: mMatch[1].trim() })
          }
        } catch {}
      }

      // Deduplicate
      const seen = new Map<string, string>()
      for (const link of rawLinks) {
        const normalized = link.url.replace(/\/+$/, "").toLowerCase()
        if (!seen.has(normalized) && link.text.length > 0) {
          seen.set(normalized, link.text)
        }
      }

      candidateUrls = Array.from(seen.entries()).map(([u, name]) => ({ url: u, name }))
      console.log(`[catalog] Collection page: extracted ${candidateUrls.length} links`)
    } catch (err) {
      logger.error("Catalog collection scrape failed", { url: url.toString() }, err as Error)
      return { error: "Could not scrape the collection page." }
    }
  }

  if (candidateUrls.length === 0) {
    return { error: "No product links found on this page or in the sitemap." }
  }

  // ── Claude filtering ─────────────────────────────────────────────────
  // Ask Claude to identify which URLs are actual product pages
  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "ANTHROPIC_API_KEY is not configured." }
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    // Truncate to 200 candidates max to fit in context
    const batch = candidateUrls.slice(0, 200)

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: `You are filtering URLs from the brand "${brand.name}" (${brandDomain}) to find actual product pages.

Here are ${batch.length} URLs discovered from the brand's website. For each URL, decide if it's an individual product page (yes) or not (no). Product pages show a single product with images, description, and/or specifications. Collection overview pages, category pages, homepage, about pages, contact pages, press pages, configurators, and blog posts are NOT product pages.

URLs:
${batch.map((c, i) => `${i + 1}. ${c.url} — "${c.name}"`).join("\n")}

Return ONLY a JSON array of objects for the URLs that ARE product pages:
[{"index": 1, "name": "Clean product name"}, ...]

The "name" should be the cleaned product name (remove brand prefix if redundant, capitalize properly, no URL artifacts). If none are product pages, return [].`,
      }],
    })

    const text = message.content[0]?.type === "text" ? message.content[0].text : ""
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.log("[catalog] Claude returned no JSON, returning all candidates")
      // Fall back: return all candidates and let admin filter manually
      const filtered = candidateUrls
        .filter((c) => !existingUrls.has(c.url.replace(/\/+$/, "").toLowerCase()))
        .slice(0, 100)
      return { products: filtered.map((c) => ({ ...c, imageUrl: null })) }
    }

    const selected: { index: number; name: string }[] = JSON.parse(jsonMatch[0])

    const products: DiscoveredProduct[] = selected
      .filter((s) => s.index >= 1 && s.index <= batch.length)
      .map((s) => {
        const candidate = batch[s.index - 1]
        return {
          url: candidate.url,
          name: s.name || candidate.name,
          imageUrl: null,
        }
      })
      .filter((p) => !existingUrls.has(p.url.replace(/\/+$/, "").toLowerCase()))

    console.log(`[catalog] Claude identified ${selected.length} products, ${products.length} after dedup`)
    return { products }
  } catch (err) {
    logger.error("Catalog Claude filtering failed", {}, err as Error)
    // Fall back: return raw candidates
    const filtered = candidateUrls
      .filter((c) => !existingUrls.has(c.url.replace(/\/+$/, "").toLowerCase()))
      .slice(0, 100)
    return { products: filtered.map((c) => ({ ...c, imageUrl: null })) }
  }
}

/**
 * Batch-scrape multiple product URLs for a brand.
 * Processes sequentially to avoid rate-limiting Firecrawl.
 */
export async function batchScrapeProducts(
  urls: string[],
  brandId: string
): Promise<{ results: Array<{ url: string; name: string; productId: string } | { url: string; error: string }> }> {
  const guard = await requireAdmin()
  if ("error" in guard) return { results: urls.map((url) => ({ url, error: guard.error })) }

  const results: Array<{ url: string; name: string; productId: string } | { url: string; error: string }> = []

  for (const url of urls) {
    try {
      const result = await scrapeProduct(url, brandId)
      if ("error" in result) {
        results.push({ url, error: result.error })
      } else {
        results.push({ url, name: result.name, productId: result.productId })
      }
      // Small delay between scrapes to avoid rate limiting
      if (urls.indexOf(url) < urls.length - 1) {
        await new Promise((r) => setTimeout(r, 1500))
      }
    } catch (err) {
      results.push({ url, error: "Unexpected error" })
    }
  }

  revalidatePath(`/admin/brands/${brandId}`)
  revalidatePath("/admin/products")
  return { results }
}
