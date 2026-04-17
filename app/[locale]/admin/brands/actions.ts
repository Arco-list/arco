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
 * Update fields on a product row. Admin only.
 *
 * `specs` is merged into the existing jsonb column so callers can patch a
 * single key (e.g. designer) without clobbering the rest of the object. To
 * clear a spec key, pass the key with a null value.
 */
export async function updateProduct(
  productId: string,
  fields: {
    name?: string
    description?: string | null
    category_id?: string | null
    family_id?: string | null
    source_url?: string | null
    specs?: Record<string, any>
  },
): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const supabase = createServiceRoleSupabaseClient() as any

  const patch: Record<string, any> = {}
  if (fields.name !== undefined) patch.name = fields.name
  if (fields.description !== undefined) patch.description = fields.description
  if (fields.category_id !== undefined) patch.category_id = fields.category_id
  if (fields.family_id !== undefined) patch.family_id = fields.family_id
  if (fields.source_url !== undefined) patch.source_url = fields.source_url

  if (fields.specs !== undefined) {
    // Merge into existing specs so we don't clobber unrelated keys.
    const { data: current } = await supabase
      .from("products")
      .select("specs")
      .eq("id", productId)
      .maybeSingle()

    const existing = (current?.specs ?? {}) as Record<string, any>
    const merged: Record<string, any> = { ...existing }
    for (const [k, v] of Object.entries(fields.specs)) {
      if (v === null || v === "") delete merged[k]
      else merged[k] = v
    }
    patch.specs = merged
  }

  if (Object.keys(patch).length === 0) return { ok: true }

  const { data: product } = await supabase
    .from("products")
    .select("brand_id")
    .eq("id", productId)
    .maybeSingle()

  const { error } = await supabase.from("products").update(patch).eq("id", productId)
  if (error) return { error: error.message }

  revalidatePath("/admin/products")
  revalidatePath(`/admin/products/${productId}`)
  if (product?.brand_id) revalidatePath(`/admin/brands/${product.brand_id}`)
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
  fields: { name?: string; hero_image_url?: string | null },
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

/**
 * Upload a hero image for a collection. Admin only. Uses service role so
 * it can write under `company-assets` without relying on per-user RLS.
 */
export async function uploadProductFamilyImage(
  familyId: string,
  formData: FormData,
): Promise<{ url: string } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const file = formData.get("file") as File | null
  if (!file) return { error: "No file provided." }
  if (file.size > 8 * 1024 * 1024) return { error: "Image must be under 8MB." }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
  const path = `product-families/${familyId}/cover.${ext}`

  const supabase = createServiceRoleSupabaseClient()
  const { error: uploadError } = await supabase.storage
    .from("company-assets")
    .upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type })

  if (uploadError) return { error: uploadError.message }

  const { data: urlData } = supabase.storage.from("company-assets").getPublicUrl(path)
  if (!urlData?.publicUrl) return { error: "Could not get public URL." }

  const { data: family } = await (supabase as any)
    .from("product_families")
    .select("brand_id")
    .eq("id", familyId)
    .maybeSingle()

  await (supabase as any).from("product_families").update({ hero_image_url: urlData.publicUrl }).eq("id", familyId)

  if (family?.brand_id) revalidatePath(`/admin/brands/${family.brand_id}`)
  return { url: urlData.publicUrl }
}

/**
 * Delete a collection. The matching products keep existing — their
 * `family_id` is set to null so they drop back into the uncollected set.
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

  // Detach products first so the FK doesn't block the delete and so we
  // keep the products around even when the collection is gone.
  const { error: detachError } = await supabase
    .from("products")
    .update({ family_id: null })
    .eq("family_id", familyId)
  if (detachError) return { error: detachError.message }

  const { error } = await supabase.from("product_families").delete().eq("id", familyId)
  if (error) return { error: error.message }

  if (family?.brand_id) revalidatePath(`/admin/brands/${family.brand_id}`)
  return { ok: true }
}

/**
 * Replace the set of products assigned to a collection. Every product in
 * `productIds` gets its `family_id` set to `familyId`; everything else in
 * the same brand keeps its current assignment (we don't touch products
 * assigned to other collections).
 *
 * Products that are no longer in the passed list but were previously in
 * this collection get detached (family_id → null).
 */
export async function setFamilyProducts(
  familyId: string,
  productIds: string[],
): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const supabase = createServiceRoleSupabaseClient() as any

  const { data: family } = await supabase
    .from("product_families")
    .select("brand_id")
    .eq("id", familyId)
    .maybeSingle()
  if (!family) return { error: "Collection not found." }

  // Detach anything currently in the collection but not in the new set.
  if (productIds.length > 0) {
    const { error: detachError } = await supabase
      .from("products")
      .update({ family_id: null })
      .eq("family_id", familyId)
      .not("id", "in", `(${productIds.join(",")})`)
    if (detachError) return { error: detachError.message }
  } else {
    // No products left in the collection.
    const { error: clearError } = await supabase
      .from("products")
      .update({ family_id: null })
      .eq("family_id", familyId)
    if (clearError) return { error: clearError.message }
  }

  // Attach the selected products. `.in("id", [])` is a no-op.
  if (productIds.length > 0) {
    const { error: attachError } = await supabase
      .from("products")
      .update({ family_id: familyId })
      .in("id", productIds)
      .eq("brand_id", family.brand_id)
    if (attachError) return { error: attachError.message }
  }

  revalidatePath(`/admin/brands/${family.brand_id}`)
  return { ok: true }
}

/**
 * Upload one or more photos for a product. Admin only. Stores files in
 * `company-assets/products/[productId]/` and inserts `product_photos` rows
 * pointing at the public URLs. Returns the inserted ids/urls so the client
 * can show them immediately.
 *
 * The first uploaded photo becomes primary when the product has no
 * existing photos; subsequent uploads append to the end.
 */
export async function uploadProductPhotos(
  productId: string,
  formData: FormData,
): Promise<{ photos: { id: string; url: string }[] } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const files = formData.getAll("files") as File[]
  if (files.length === 0) return { error: "No files provided." }

  const supabase = createServiceRoleSupabaseClient() as any

  const { data: product } = await supabase
    .from("products")
    .select("brand_id")
    .eq("id", productId)
    .maybeSingle()
  if (!product) return { error: "Product not found." }

  // Find the current max order_index and whether a primary exists so new
  // uploads slot in at the end without disturbing the existing order.
  const { data: existing } = await supabase
    .from("product_photos")
    .select("id, is_primary, order_index")
    .eq("product_id", productId)
    .order("order_index", { ascending: false })
    .limit(1)

  const hasPrimary = existing && existing.length > 0
  let nextOrder = hasPrimary ? (existing[0].order_index ?? 0) + 1 : 0

  const inserted: { id: string; url: string }[] = []

  for (const file of files) {
    if (!(file instanceof File)) continue
    if (file.size > 10 * 1024 * 1024) {
      return { error: `${file.name} is over 10MB.` }
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
    const rand = Math.random().toString(36).slice(2, 10)
    const path = `products/${productId}/${Date.now()}-${rand}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from("company-assets")
      .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type })
    if (uploadError) return { error: uploadError.message }

    const { data: urlData } = supabase.storage.from("company-assets").getPublicUrl(path)
    if (!urlData?.publicUrl) return { error: "Could not get public URL." }

    const isFirst = !hasPrimary && inserted.length === 0
    const { data: photoRow, error: insertError } = await supabase
      .from("product_photos")
      .insert({
        product_id: productId,
        url: urlData.publicUrl,
        is_primary: isFirst,
        order_index: nextOrder++,
      })
      .select("id, url")
      .single()

    if (insertError || !photoRow) return { error: insertError?.message ?? "Could not save photo." }
    inserted.push({ id: photoRow.id, url: photoRow.url })
  }

  revalidatePath(`/admin/products/${productId}`)
  if (product.brand_id) revalidatePath(`/admin/brands/${product.brand_id}`)
  return { photos: inserted }
}

// ── Granular axis-value editors ────────────────────────────────────────
// These operate across both shapes in a product's `variants` array:
//
//  - Standalone rows: `{color|size: label, hex?, image_url?}` — carry the
//    axis-level hex/image when no combination provides them
//  - Combination rows: `{attributes: {color, model, ...}, image_url?, hex?}`
//
// Each editor updates BOTH shapes so combination-mode products get the
// same axis controls (rename/delete/hex) as independent-mode products,
// and independent-mode products keep working through the same surface.

type AxisKind = "color" | "model"

// The `attributes` map may key a model value as either "model" (Moooi /
// Shopify) or "size" (the legacy scraper). We treat them as synonyms.
const ATTR_KEYS: Record<AxisKind, string[]> = {
  color: ["color"],
  model: ["model", "size"],
}
const FLAT_KEYS: Record<AxisKind, string> = {
  color: "color",
  model: "size",
}

function attrsEq(a: Record<string, any> | null | undefined, b: Record<string, string>) {
  if (!a || typeof a !== "object") return false
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  return bKeys.every((k) => a[k] === b[k])
}

function getAttrValue(row: Record<string, any>, axis: AxisKind): string | null {
  for (const k of ATTR_KEYS[axis]) {
    const v = row.attributes?.[k]
    if (typeof v === "string") return v
  }
  return null
}

function setAttrValue(row: Record<string, any>, axis: AxisKind, value: string): void {
  // Use the same key the row already uses; default to the canonical one.
  for (const k of ATTR_KEYS[axis]) {
    if (row.attributes && k in row.attributes) {
      row.attributes[k] = value
      return
    }
  }
  row.attributes = { ...(row.attributes ?? {}), [ATTR_KEYS[axis][0]]: value }
}

async function loadProductVariants(
  productId: string,
): Promise<{ supabase: any; variants: any[]; brandId: string | null } | { error: string }> {
  const supabase = createServiceRoleSupabaseClient() as any
  const { data: product } = await supabase
    .from("products")
    .select("variants, brand_id")
    .eq("id", productId)
    .maybeSingle()
  if (!product) return { error: "Product not found." }
  return { supabase, variants: (product.variants ?? []) as any[], brandId: product.brand_id ?? null }
}

async function saveProductVariants(
  supabase: any,
  productId: string,
  brandId: string | null,
  nextVariants: any[],
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase.from("products").update({ variants: nextVariants }).eq("id", productId)
  if (error) return { error: error.message }
  revalidatePath(`/admin/products/${productId}`)
  if (brandId) revalidatePath(`/admin/brands/${brandId}`)
  return { ok: true }
}

/**
 * Before dropping variant rows (or clearing their image_url), make sure
 * those images survive in the product's gallery. Inserts each URL as a
 * `product_photos` row unless it's already there. Orphaned images stay
 * visible and available for reassignment.
 */
async function preserveVariantImages(
  supabase: any,
  productId: string,
  urls: Array<string | null | undefined>,
): Promise<void> {
  const normalise = (u: string) => u.toLowerCase().replace(/\/+$/, "")
  const distinct = Array.from(
    new Set(urls.filter((u): u is string => typeof u === "string" && u.length > 0)),
  )
  if (distinct.length === 0) return

  const { data: existing } = await supabase
    .from("product_photos")
    .select("url")
    .eq("product_id", productId)
  const existingNorm = new Set(
    (existing ?? []).map((r: any) => normalise(String(r.url))),
  )

  // Find the highest order_index so inserts slot in at the end.
  const { data: last } = await supabase
    .from("product_photos")
    .select("order_index")
    .eq("product_id", productId)
    .order("order_index", { ascending: false })
    .limit(1)
  let nextOrder = last && last.length > 0 ? (last[0].order_index ?? 0) + 1 : 0

  const rows: Array<Record<string, any>> = []
  for (const url of distinct) {
    if (existingNorm.has(normalise(url))) continue
    rows.push({ product_id: productId, url, is_primary: false, order_index: nextOrder++ })
  }
  if (rows.length > 0) {
    await supabase.from("product_photos").insert(rows)
  }
}

/** Rename an axis value across standalone and combination rows. */
export async function renameProductAxisValue(
  productId: string,
  axis: AxisKind,
  oldLabel: string,
  newLabel: string,
): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard
  const trimmed = newLabel.trim()
  if (!trimmed) return { error: "Name can't be empty." }
  if (trimmed === oldLabel) return { ok: true }

  const loaded = await loadProductVariants(productId)
  if ("error" in loaded) return loaded

  const flatKey = FLAT_KEYS[axis]
  const next = loaded.variants.map((row) => {
    const copy = { ...row }
    // Combination rows
    if (getAttrValue(copy, axis) === oldLabel) {
      copy.attributes = { ...copy.attributes }
      setAttrValue(copy, axis, trimmed)
    }
    // Standalone rows
    if (copy[flatKey] === oldLabel) copy[flatKey] = trimmed
    return copy
  })

  return saveProductVariants(loaded.supabase, productId, loaded.brandId, next)
}

/** Remove an axis value from every standalone and combination row. */
/**
 * Update a single spec value inside the scoped specs object. Scope is
 * either "_shared" (applies to all models) or a model label. Passing
 * `value: null | undefined | ""` removes the key from that scope.
 *
 * Only mutates value + presence — never renames keys. Key taxonomy stays
 * controlled so search filters remain predictable.
 */
export async function updateProductSpec(
  productId: string,
  scope: string,
  key: string,
  value: unknown,
): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const trimmedKey = key.trim()
  if (!trimmedKey) return { error: "Key required." }

  const supabase = createServiceRoleSupabaseClient() as any

  const { data: product } = await supabase
    .from("products")
    .select("specs, brand_id")
    .eq("id", productId)
    .maybeSingle()
  if (!product) return { error: "Product not found." }

  // Normalise to scoped layout. Pre-migration products have a flat
  // specs object — treat them as entirely _shared so writes land in
  // the right bucket without losing existing data.
  let scoped: Record<string, Record<string, any>>
  const raw = product.specs as Record<string, any> | null
  if (!raw) {
    scoped = {}
  } else {
    const firstVal = Object.values(raw)[0]
    const looksScoped =
      Object.values(raw).every((v) => v && typeof v === "object" && !Array.isArray(v))
      && firstVal !== undefined
    scoped = looksScoped
      ? JSON.parse(JSON.stringify(raw))
      : { _shared: JSON.parse(JSON.stringify(raw)) }
  }

  if (!scoped[scope]) scoped[scope] = {}

  if (value === null || value === undefined || value === "") {
    delete scoped[scope][trimmedKey]
    // Tidy: drop empty scopes, but always keep _shared.
    if (scope !== "_shared" && Object.keys(scoped[scope]).length === 0) {
      delete scoped[scope]
    }
  } else {
    scoped[scope][trimmedKey] = value
  }

  const { error } = await supabase
    .from("products")
    .update({ specs: scoped })
    .eq("id", productId)
  if (error) return { error: error.message }

  revalidatePath(`/admin/products/${productId}`)
  if (product.brand_id) revalidatePath(`/admin/brands/${product.brand_id}`)
  return { ok: true }
}

/** Rename a spec key within a scope (preserving the value). */
/** Persist the display order of spec keys + any group overrides.
 *  Called after drag-and-drop reorder or cross-group moves. */
/**
 * Move a spec key from shared → per-model or per-model → shared.
 *
 * "toPerModel": copies the value from _shared to the given model scope,
 * then removes it from _shared. Other models keep whatever they had
 * (or nothing — they'll fall back to their own scope on next edit).
 *
 * "toAllModels": takes the value from the given model scope and writes
 * it to _shared, then removes the key from ALL model scopes so every
 * model resolves to the shared value.
 */
export async function toggleSpecScope(
  productId: string,
  key: string,
  direction: "toPerModel" | "toAllModels",
  activeModel: string,
): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard
  if (!key.trim() || !activeModel.trim()) return { error: "Key and model required." }

  const supabase = createServiceRoleSupabaseClient() as any
  const { data: product } = await supabase
    .from("products")
    .select("specs, brand_id")
    .eq("id", productId)
    .maybeSingle()
  if (!product) return { error: "Product not found." }

  const raw = product.specs as Record<string, any> | null
  let scoped: Record<string, Record<string, any>>
  if (!raw) {
    scoped = {}
  } else {
    const firstVal = Object.values(raw)[0]
    const looksScoped =
      firstVal !== undefined
      && Object.values(raw).every((v) => v && typeof v === "object" && !Array.isArray(v))
    scoped = looksScoped
      ? JSON.parse(JSON.stringify(raw))
      : { _shared: JSON.parse(JSON.stringify(raw)) }
  }

  if (direction === "toPerModel") {
    // Copy value from _shared to the active model, then remove from _shared.
    const value = scoped._shared?.[key]
    if (value === undefined) return { ok: true }
    if (!scoped[activeModel]) scoped[activeModel] = {}
    scoped[activeModel][key] = value
    delete scoped._shared?.[key]
  } else {
    // Take the active model's value and propagate to _shared, then remove
    // the key from every model scope so they all resolve to shared.
    const value = scoped[activeModel]?.[key] ?? scoped._shared?.[key]
    if (value === undefined) return { ok: true }
    if (!scoped._shared) scoped._shared = {}
    scoped._shared[key] = value
    for (const scope of Object.keys(scoped)) {
      if (scope === "_shared") continue
      if (scoped[scope] && key in scoped[scope]) {
        delete scoped[scope][key]
        if (Object.keys(scoped[scope]).length === 0) delete scoped[scope]
      }
    }
  }

  const { error } = await supabase
    .from("products")
    .update({ specs: scoped })
    .eq("id", productId)
  if (error) return { error: error.message }

  revalidatePath(`/admin/products/${productId}`)
  if (product.brand_id) revalidatePath(`/admin/brands/${product.brand_id}`)
  return { ok: true }
}

export async function updateSpecLayout(
  productId: string,
  specOrder: string[],
  specGroups: Record<string, string>,
): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const supabase = createServiceRoleSupabaseClient() as any

  const { data: product } = await supabase
    .from("products")
    .select("brand_id")
    .eq("id", productId)
    .maybeSingle()
  if (!product) return { error: "Product not found." }

  const { error } = await supabase
    .from("products")
    .update({
      spec_order: specOrder.length > 0 ? specOrder : null,
      spec_groups: Object.keys(specGroups).length > 0 ? specGroups : null,
    })
    .eq("id", productId)
  if (error) return { error: error.message }

  revalidatePath(`/admin/products/${productId}`)
  if (product.brand_id) revalidatePath(`/admin/brands/${product.brand_id}`)
  return { ok: true }
}

export async function renameProductSpec(
  productId: string,
  scope: string,
  oldKey: string,
  newKey: string,
): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const trimmedOld = oldKey.trim()
  const trimmedNew = newKey.trim()
  if (!trimmedOld || !trimmedNew) return { error: "Key required." }
  if (trimmedOld === trimmedNew) return { ok: true }

  const supabase = createServiceRoleSupabaseClient() as any

  const { data: product } = await supabase
    .from("products")
    .select("specs, brand_id")
    .eq("id", productId)
    .maybeSingle()
  if (!product) return { error: "Product not found." }

  const raw = product.specs as Record<string, any> | null
  let scoped: Record<string, Record<string, any>>
  if (!raw) {
    scoped = {}
  } else {
    const firstVal = Object.values(raw)[0]
    const looksScoped =
      Object.values(raw).every((v) => v && typeof v === "object" && !Array.isArray(v))
      && firstVal !== undefined
    scoped = looksScoped
      ? JSON.parse(JSON.stringify(raw))
      : { _shared: JSON.parse(JSON.stringify(raw)) }
  }

  if (!scoped[scope] || !(trimmedOld in scoped[scope])) return { ok: true }
  const value = scoped[scope][trimmedOld]
  delete scoped[scope][trimmedOld]
  scoped[scope][trimmedNew] = value

  const { error } = await supabase
    .from("products")
    .update({ specs: scoped })
    .eq("id", productId)
  if (error) return { error: error.message }

  revalidatePath(`/admin/products/${productId}`)
  if (product.brand_id) revalidatePath(`/admin/brands/${product.brand_id}`)
  return { ok: true }
}

export async function removeProductAxisValue(
  productId: string,
  axis: AxisKind,
  label: string,
): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const loaded = await loadProductVariants(productId)
  if ("error" in loaded) return loaded

  const flatKey = FLAT_KEYS[axis]
  // Capture image URLs on rows we're about to drop so they stay visible
  // in the product gallery (just unassigned from any variant).
  const orphaned: Array<string | null | undefined> = []
  const next = loaded.variants.filter((row) => {
    const matchAttr = getAttrValue(row, axis) === label
    const matchFlat = row[flatKey] === label
    if (matchAttr || matchFlat) {
      orphaned.push(row.image_url)
      return false
    }
    return true
  })

  await preserveVariantImages(loaded.supabase, productId, orphaned)
  return saveProductVariants(loaded.supabase, productId, loaded.brandId, next)
}

/** Add a new standalone axis value. Does not fan out combinations —
 *  combination cells can be created on demand by setCombinationImage. */
export async function addProductAxisValue(
  productId: string,
  axis: AxisKind,
  label: string,
  hex: string | null = null,
): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard
  const trimmed = label.trim()
  if (!trimmed) return { error: "Name can't be empty." }

  const loaded = await loadProductVariants(productId)
  if ("error" in loaded) return loaded

  const flatKey = FLAT_KEYS[axis]
  // Deduplicate — already exists as standalone row
  if (loaded.variants.some((r) => r[flatKey] === trimmed)) return { ok: true }

  const newRow: Record<string, any> = { [flatKey]: trimmed }
  if (axis === "color" && hex) newRow.hex = hex

  return saveProductVariants(loaded.supabase, productId, loaded.brandId, [...loaded.variants, newRow])
}

/** Stamp a hex on the standalone color row and every matching combination row. */
export async function setProductAxisValueHex(
  productId: string,
  label: string,
  hex: string | null,
): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const loaded = await loadProductVariants(productId)
  if ("error" in loaded) return loaded

  let hitStandalone = false
  const next = loaded.variants.map((row) => {
    const copy = { ...row }
    if (getAttrValue(copy, "color") === label) copy.hex = hex
    if (copy.color === label) { copy.hex = hex; hitStandalone = true }
    return copy
  })
  // No standalone color row yet — insert one so the hex round-trips.
  if (!hitStandalone) next.push({ color: label, hex })

  return saveProductVariants(loaded.supabase, productId, loaded.brandId, next)
}

/** Assign (or clear) an axis-level image on the standalone row for a
 *  color/model. Distinct from combination images — those belong to a
 *  specific {model, color, ...} cell via setCombinationImage. */
export async function setProductAxisValueImage(
  productId: string,
  axis: AxisKind,
  label: string,
  imageUrl: string | null,
): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const loaded = await loadProductVariants(productId)
  if ("error" in loaded) return loaded

  const flatKey = FLAT_KEYS[axis]
  const orphaned: Array<string | null | undefined> = []
  let hit = false
  const next = loaded.variants.map((row) => {
    if (row[flatKey] !== label) return row
    hit = true
    // Preserve the previous URL when clearing or replacing.
    if (row.image_url && row.image_url !== imageUrl) orphaned.push(row.image_url)
    return { ...row, image_url: imageUrl }
  })
  if (!hit) next.push({ [flatKey]: label, image_url: imageUrl })

  await preserveVariantImages(loaded.supabase, productId, orphaned)
  return saveProductVariants(loaded.supabase, productId, loaded.brandId, next)
}

/**
 * Assign (or clear) an image on a single combination row inside a
 * combination-mode product. Matches by deep attribute equality — if no
 * matching row exists, one is inserted so every (model, color, ...)
 * tuple the UI exposes is round-trippable. Pass `imageUrl: null` to clear.
 */
export async function setCombinationImage(
  productId: string,
  attributes: Record<string, string>,
  imageUrl: string | null,
): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const supabase = createServiceRoleSupabaseClient() as any

  const { data: product } = await supabase
    .from("products")
    .select("variants, brand_id")
    .eq("id", productId)
    .maybeSingle()
  if (!product) return { error: "Product not found." }

  const existing = (product.variants ?? []) as Array<Record<string, any>>

  const attrsEqual = (a: Record<string, any> | null | undefined, b: Record<string, string>) => {
    if (!a || typeof a !== "object") return false
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)
    if (aKeys.length !== bKeys.length) return false
    return bKeys.every((k) => a[k] === b[k])
  }

  const orphaned: Array<string | null | undefined> = []
  let matched = false
  const nextVariants = existing.map((row) => {
    if (!matched && attrsEqual(row.attributes, attributes)) {
      matched = true
      if (row.image_url && row.image_url !== imageUrl) orphaned.push(row.image_url)
      return { ...row, image_url: imageUrl }
    }
    return row
  })

  if (!matched) {
    nextVariants.push({ attributes, image_url: imageUrl })
  }

  await preserveVariantImages(supabase, productId, orphaned)

  const { error } = await supabase
    .from("products")
    .update({ variants: nextVariants })
    .eq("id", productId)

  if (error) return { error: error.message }

  revalidatePath(`/admin/products/${productId}`)
  if (product.brand_id) revalidatePath(`/admin/brands/${product.brand_id}`)
  return { ok: true }
}

/**
 * Set a product photo as the cover (is_primary). Clears the flag on every
 * other photo for the product so only one row carries it.
 */
export async function setProductCover(
  photoId: string,
): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const supabase = createServiceRoleSupabaseClient() as any

  const { data: photo } = await supabase
    .from("product_photos")
    .select("id, product_id")
    .eq("id", photoId)
    .maybeSingle()
  if (!photo) return { error: "Photo not found." }

  const { error: clearError } = await supabase
    .from("product_photos")
    .update({ is_primary: false })
    .eq("product_id", photo.product_id)
  if (clearError) return { error: clearError.message }

  const { error: setError } = await supabase
    .from("product_photos")
    .update({ is_primary: true })
    .eq("id", photoId)
  if (setError) return { error: setError.message }

  const { data: product } = await supabase
    .from("products")
    .select("brand_id")
    .eq("id", photo.product_id)
    .maybeSingle()

  revalidatePath(`/admin/products/${photo.product_id}`)
  if (product?.brand_id) revalidatePath(`/admin/brands/${product.brand_id}`)
  return { ok: true }
}

/**
 * Delete a product photo. If it was the primary, promote the next photo.
 * Storage objects uploaded under `products/[id]/` are also cleaned up;
 * external URLs (from scrapes) are left alone since we don't own them.
 */
export async function deleteProductPhoto(photoId: string): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const supabase = createServiceRoleSupabaseClient() as any

  const { data: photo } = await supabase
    .from("product_photos")
    .select("id, url, is_primary, product_id")
    .eq("id", photoId)
    .maybeSingle()
  if (!photo) return { error: "Photo not found." }

  // Strip the storage object if it lives in our bucket. Public URL shape:
  // .../storage/v1/object/public/company-assets/products/<id>/<file>
  const match = photo.url.match(/\/storage\/v1\/object\/public\/company-assets\/(.+)$/)
  if (match?.[1]) {
    await supabase.storage.from("company-assets").remove([match[1]])
  }

  const { error } = await supabase.from("product_photos").delete().eq("id", photoId)
  if (error) return { error: error.message }

  // Promote the next photo to primary if we just deleted the primary.
  if (photo.is_primary) {
    const { data: next } = await supabase
      .from("product_photos")
      .select("id")
      .eq("product_id", photo.product_id)
      .order("order_index", { ascending: true })
      .limit(1)
      .maybeSingle()
    if (next) {
      await supabase.from("product_photos").update({ is_primary: true }).eq("id", next.id)
    }
  }

  const { data: product } = await supabase
    .from("products")
    .select("brand_id")
    .eq("id", photo.product_id)
    .maybeSingle()

  revalidatePath(`/admin/products/${photo.product_id}`)
  if (product?.brand_id) revalidatePath(`/admin/brands/${product.brand_id}`)
  return { ok: true }
}

/**
 * Replace the set of colors on a product (independent variant mode).
 *
 * This overwrites every color-carrying row in `products.variants` with the
 * passed list, while leaving any non-color independent rows (size, material)
 * in place. Refuses to run when the product is in combination mode — those
 * products manage colors through the combinations grid (phase 3).
 *
 * Callers should pass the full list every time. Row order is preserved.
 */
export async function setProductColors(
  productId: string,
  colors: Array<{ label: string; hex: string | null; image_url: string | null }>,
): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const supabase = createServiceRoleSupabaseClient() as any

  const { data: product } = await supabase
    .from("products")
    .select("variants, brand_id")
    .eq("id", productId)
    .maybeSingle()
  if (!product) return { error: "Product not found." }

  const existing = (product.variants ?? []) as Array<Record<string, any>>
  const hasCombinations = existing.some(
    (v) => v.attributes && typeof v.attributes === "object" && Object.keys(v.attributes).length > 0,
  )
  if (hasCombinations) {
    return { error: "This product uses size × color combinations. Edit colors from the combinations grid." }
  }

  // Preserve rows that aren't carrying a color (e.g. standalone size rows).
  const preserved = existing.filter((v) => !v.color)

  const nextColors = colors
    .map((c) => ({ ...c, label: c.label.trim() }))
    .filter((c) => c.label.length > 0)
    .map((c) => {
      const row: Record<string, any> = { color: c.label }
      if (c.hex) row.hex = c.hex
      if (c.image_url) row.image_url = c.image_url
      return row
    })

  const nextVariants = [...nextColors, ...preserved]

  const { error } = await supabase
    .from("products")
    .update({ variants: nextVariants })
    .eq("id", productId)

  if (error) return { error: error.message }

  revalidatePath(`/admin/products/${productId}`)
  if (product.brand_id) revalidatePath(`/admin/brands/${product.brand_id}`)
  return { ok: true }
}

/**
 * Replace the set of models on a product (independent variant mode).
 *
 * Mirrors setProductColors but for the `size` variant field (surfaced in the
 * admin as "Model"). Preserves any non-size rows (colors, materials). Refuses
 * to run in combination mode — the combinations grid manages sizes there.
 */
export async function setProductModels(
  productId: string,
  models: Array<{ label: string; image_url?: string | null }>,
): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const supabase = createServiceRoleSupabaseClient() as any

  const { data: product } = await supabase
    .from("products")
    .select("variants, brand_id")
    .eq("id", productId)
    .maybeSingle()
  if (!product) return { error: "Product not found." }

  const existing = (product.variants ?? []) as Array<Record<string, any>>
  const hasCombinations = existing.some(
    (v) => v.attributes && typeof v.attributes === "object" && Object.keys(v.attributes).length > 0,
  )
  if (hasCombinations) {
    return { error: "This product uses size × color combinations. Edit models from the combinations grid." }
  }

  // Preserve rows that aren't carrying a size.
  const preserved = existing.filter((v) => !v.size)

  const nextModels = models
    .map((m) => ({ label: m.label.trim(), image_url: m.image_url ?? null }))
    .filter((m) => m.label.length > 0)
    .map((m) => ({ size: m.label, image_url: m.image_url } as Record<string, any>))

  const nextVariants = [...nextModels, ...preserved]

  const { error } = await supabase
    .from("products")
    .update({ variants: nextVariants })
    .eq("id", productId)

  if (error) return { error: error.message }

  revalidatePath(`/admin/products/${productId}`)
  if (product.brand_id) revalidatePath(`/admin/brands/${product.brand_id}`)
  return { ok: true }
}

/**
 * Upload a single variant image (per-color swatch thumbnail or per-cell
 * combination image). Admin only. Returns the public URL — the caller
 * stamps it into the variants JSONB via setProductColors / combination
 * editor actions. Storage path lives under the product so deleting the
 * product cascades the files.
 */
export async function uploadVariantImage(
  productId: string,
  formData: FormData,
): Promise<{ url: string } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const file = formData.get("file") as File | null
  if (!file) return { error: "No file provided." }
  if (file.size > 8 * 1024 * 1024) return { error: "Image must be under 8MB." }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
  const rand = Math.random().toString(36).slice(2, 10)
  const path = `products/${productId}/variants/${Date.now()}-${rand}.${ext}`

  const supabase = createServiceRoleSupabaseClient()
  const { error: uploadError } = await supabase.storage
    .from("company-assets")
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type })

  if (uploadError) return { error: uploadError.message }

  const { data: urlData } = supabase.storage.from("company-assets").getPublicUrl(path)
  if (!urlData?.publicUrl) return { error: "Could not get public URL." }

  return { url: urlData.publicUrl }
}

/**
 * Update a single product's status. Products currently toggle between
 * `listed` and `unlisted` — adding a new value here means extending the
 * product_status enum in the DB too.
 */
export async function updateProductStatus(
  productId: string,
  status: "listed" | "unlisted",
): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard

  const supabase = createServiceRoleSupabaseClient() as any

  const { data: product } = await supabase
    .from("products")
    .select("brand_id")
    .eq("id", productId)
    .maybeSingle()

  const { error } = await supabase
    .from("products")
    .update({ status })
    .eq("id", productId)

  if (error) return { error: error.message }

  revalidatePath("/admin/products")
  revalidatePath(`/admin/products/${productId}`)
  if (product?.brand_id) revalidatePath(`/admin/brands/${product.brand_id}`)
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
