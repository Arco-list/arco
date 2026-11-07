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
 * Admin-only. Series (product_families) are added on the brand page.
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
  const { error } = await supabase.from("brands").delete().eq("id", brandId)
  if (error) return { error: error.message }

  revalidatePath("/admin/brands")
  return { ok: true }
}
