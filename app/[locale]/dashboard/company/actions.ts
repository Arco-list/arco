"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { z } from "zod"

const LOCALE_NAMES: Record<string, string> = { nl: "Dutch", en: "English", de: "German", fr: "French" }
async function getDescriptionLocale(): Promise<string> {
  const cookieStore = await cookies()
  const locale = cookieStore.get("NEXT_LOCALE")?.value ?? "en"
  return LOCALE_NAMES[locale] ?? "English"
}

import { randomUUID } from "node:crypto"
import { Buffer } from "node:buffer"
import { JSDOM } from "jsdom"
import DOMPurify from "dompurify"

import type { SupabaseClient } from "@supabase/supabase-js"

import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { logger, sanitizeForLogging } from "@/lib/logger"
import type { Database } from "@/lib/supabase/types"
import { checkRateLimit } from "@/lib/rate-limit"
import { slugifyCompanyName, ensureUniqueCompanySlug } from "@/lib/company-slug"

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/svg+xml"]

// Type guard for Error objects
function isError(error: unknown): error is Error {
  return error instanceof Error
}

const nameSchema = z
  .string({ required_error: "Company name is required" })
  .trim()
  .min(2, "Company name must be at least 2 characters")
  .max(120, "Company name cannot exceed 120 characters")

const descriptionSchema = z
  .string()
  .trim()
  .max(750, "Description cannot exceed 750 characters")
  .optional()

const contactSchema = z.object({
  domain: z
    .string()
    .trim()
    .max(120, "Domain must be shorter than 120 characters")
    .refine((value) => !value || /^[a-z0-9.-]+$/i.test(value.replace(/^https?:\/\//i, "")), {
      message: "Enter a valid domain (example.com)",
    }),
  email: z.string().trim().email("Enter a valid email address").or(z.literal("")),
  phone: z.string().trim().min(5, "Enter a valid phone number").or(z.literal("")),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  country: z.string().trim().optional(),
})

const socialSchema = z.object({
  facebook: z
    .string()
    .trim()
    .url("Enter a valid URL")
    .refine((url) => url === "" || url.startsWith("http://") || url.startsWith("https://"), {
      message: "URL must start with http:// or https://",
    })
    .optional()
    .or(z.literal("")),
  instagram: z
    .string()
    .trim()
    .url("Enter a valid URL")
    .refine((url) => url === "" || url.startsWith("http://") || url.startsWith("https://"), {
      message: "URL must start with http:// or https://",
    })
    .optional()
    .or(z.literal("")),
  linkedin: z
    .string()
    .trim()
    .url("Enter a valid URL")
    .refine((url) => url === "" || url.startsWith("http://") || url.startsWith("https://"), {
      message: "URL must start with http:// or https://",
    })
    .optional()
    .or(z.literal("")),
  pinterest: z
    .string()
    .trim()
    .url("Enter a valid URL")
    .refine((url) => url === "" || url.startsWith("http://") || url.startsWith("https://"), {
      message: "URL must start with http:// or https://",
    })
    .optional()
    .or(z.literal("")),
})

const servicesSchema = z.object({
  primaryServiceId: z.string().uuid("Primary service required").optional().or(z.literal("")),
  servicesOffered: z.array(z.string().trim()).max(12, "Select up to 12 services"),
  languages: z.array(z.string().trim()).max(10, "Select up to 10 languages"),
  certificates: z.array(z.string().trim()).max(10, "Select up to 10 certificates"),
  // Free-form tags surfaced on photographer profiles (Residential / Interior /
  // etc.). Allowed values enforced client-side via PHOTOGRAPHER_SPECIALTIES.
  specialties: z.array(z.string().trim()).max(10, "Select up to 10 specialties").optional(),
})

const statusSchema = z.object({
  status: z.enum(["listed", "unlisted", "deactivated"]),
})

const photoOrderSchema = z.object({
  photoIds: z.array(z.string().uuid("Invalid photo id")).min(1, "Provide at least one photo"),
})

const photoIdSchema = z.object({
  photoId: z.string().uuid("Invalid photo id"),
})

export type ActionResult = {
  success: boolean
  error?: string
}

type SocialPlatform = Database["public"]["Enums"]["company_social_platform"]

type UploadActionResult = ActionResult & { url?: string; photo?: Database["public"]["Tables"]["company_photos"]["Row"]; nextCoverPhotoId?: string | null }

async function getCompanyContext(overrideCompanyId?: string) {
  const supabase = await createServerActionSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    logger.auth("company-settings", "Failed to load authenticated user", undefined, authError)
    return { supabase, user: null as const, error: "Unable to verify your session." }
  }

  if (!user) {
    return { supabase, user: null as const, error: "You need to be signed in." }
  }

  // 0. Admin with active company cookie pointing to a different company
  const { getActiveCompanyId, setActiveCompanyId } = await import("@/lib/active-company")
  const activeCompanyId = overrideCompanyId ?? await getActiveCompanyId()

  if (activeCompanyId) {
    const { data: adminProfile } = await supabase.from("profiles").select("user_types, admin_role").eq("id", user.id).maybeSingle()
    const isAdmin = adminProfile?.user_types?.includes("admin") || adminProfile?.admin_role === "admin" || adminProfile?.admin_role === "super_admin"
    if (isAdmin) {
      // Check if the active company is NOT owned by this user (admin override)
      const { data: isOwned } = await supabase.from("companies").select("id").eq("id", activeCompanyId).eq("owner_id", user.id).maybeSingle()
      if (!isOwned) {
        const { createServiceRoleSupabaseClient: createSR } = await import("@/lib/supabase/server")
        const sr = createSR()
        const { data: adminCompany } = await sr.from("companies").select("id, name, logo_url").eq("id", activeCompanyId).maybeSingle()
        if (adminCompany) {
          return { supabase: sr, user, company: adminCompany, error: null as const }
        }
      }
    }
  }

  // 1. Always prefer owned company (oldest first)
  const { data: ownedCompany, error: companyError } = await supabase
    .from("companies")
    .select("id, name, logo_url")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (companyError) {
    logger.db("select", "companies", "Failed to load company for owner", { userId: user.id }, companyError)
    return { supabase, user, company: null as const, error: "Unable to load your company." }
  }

  if (ownedCompany) {
    // Always use owned company — update cookie if needed
    const activeId = await getActiveCompanyId()
    if (activeId !== ownedCompany.id) {
      await setActiveCompanyId(ownedCompany.id)
    }
    return { supabase, user, company: ownedCompany, error: null as const }
  }

  // 2. No owned company — check cookie for active company (membership)
  const activeId = await getActiveCompanyId()
  if (activeId) {
    const { data: activeCompany } = await supabase
      .from("companies")
      .select("id, name, logo_url")
      .eq("id", activeId)
      .maybeSingle()

    if (activeCompany) {
      const isMember = await supabase
        .from("company_members")
        .select("id")
        .eq("company_id", activeId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle()
        .then((r) => !!r.data)

      if (isMember) {
        return { supabase, user, company: activeCompany, error: null as const }
      }
    }
  }

  // 3. Fallback: find first company via team membership
  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (membership) {
    const { data: memberCompany } = await supabase
      .from("companies")
      .select("id, name, logo_url")
      .eq("id", membership.company_id)
      .single()

    if (memberCompany) {
      await setActiveCompanyId(memberCompany.id)
      return { supabase, user, company: memberCompany, error: null as const }
    }
  }

  return { supabase, user, company: null as const, error: "Create a company first." }
}

const buildPublicUrl = (path: string) => {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!baseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable.")
  }

  return `${baseUrl}/storage/v1/object/public/company-assets/${path}`
}

const sanitizeFilename = (filename: string) => {
  const [name, ...rest] = filename.split(".")
  const extension = rest.pop()?.toLowerCase() ?? ""
  const base = name.replace(/[^a-zA-Z0-9_-]/g, "_") || "file"
  return extension ? `${base}.${extension}` : base
}

const extractStoragePathFromUrl = (url: string | null | undefined) => {
  if (!url) return null
  try {
    const parsed = new URL(url)
    const marker = "/storage/v1/object/public/company-assets/"
    const idx = parsed.pathname.indexOf(marker)
    if (idx === -1) return null
    return decodeURIComponent(parsed.pathname.slice(idx + marker.length))
  } catch (error) {
    return null
  }
}

const validateImageFile = async (file: File): Promise<{ error?: string; sanitizedFile?: File }> => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { error: "Only JPG, PNG, or SVG files are allowed." }
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "Files must be 5MB or smaller." }
  }

  // Sanitize SVG files to prevent XSS attacks
  if (file.type === "image/svg+xml") {
    try {
      const svgContent = await file.text()

      // Create a DOM window for DOMPurify in Node.js environment
      const window = new JSDOM("").window
      const purify = DOMPurify(window as unknown as Window)

      const sanitizedSvg = purify.sanitize(svgContent, {
        USE_PROFILES: { svg: true, svgFilters: true },
        ADD_TAGS: ["use"],
        ADD_ATTR: ["target"],
      })

      // Create new sanitized file
      const sanitizedFile = new File([sanitizedSvg], file.name, {
        type: file.type,
        lastModified: file.lastModified,
      })

      return { sanitizedFile }
    } catch (error) {
      logger.error("svg-sanitization", "Failed to sanitize SVG file", { fileName: file.name }, isError(error) ? error : new Error(String(error)))
      return { error: "Invalid SVG file." }
    }
  }

  return { sanitizedFile: file }
}

// Upload using the authenticated server-action client so bucket policies enforce ownership.
const uploadToStorage = async (supabase: SupabaseClient<Database>, path: string, file: File) => {
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error } = await supabase
    .storage
    .from("company-assets")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (error) {
    return { success: false as const, error }
  }

  return { success: true as const }
}

// Guarded delete helper prevents removing objects outside of the caller's company scope.
const deleteFromStorage = async (
  supabase: SupabaseClient<Database>,
  companyId: string,
  path: string | null | undefined
) => {
  if (!path) return
  if (!path.startsWith(`${companyId}/`)) {
    logger.warn(
      "Blocked attempt to delete storage path outside company scope",
      {
        companyId,
        path,
      }
    )
    return
  }

  const { error } = await supabase.storage.from("company-assets").remove([path])

  if (error) {
    logger.warn(
      "Failed to delete storage object",
      { companyId, path, bucket: "company-assets" },
      error
    )
  }
}

export async function updateCompanyProfileAction(input: { name: string; description?: string | null }): Promise<ActionResult> {
  const { supabase, company, error } = await getCompanyContext()

  if (error) {
    return { success: false, error }
  }

  const parsedName = nameSchema.safeParse(input.name)
  if (!parsedName.success) {
    return { success: false, error: parsedName.error.issues[0]?.message ?? "Invalid name" }
  }

  const parsedDescription = descriptionSchema.safeParse(input.description?.trim())
  if (!parsedDescription.success) {
    return { success: false, error: parsedDescription.error.issues[0]?.message ?? "Invalid description" }
  }

  const normalizedName = parsedName.data
  const normalizedDescription = parsedDescription.data

  // Check duplicate names
  const { data: conflicts, error: conflictError } = await supabase
    .from("companies")
    .select("id")
    .neq("id", company!.id)
    .ilike("name", normalizedName)
    .limit(1)

  if (conflictError) {
    logger.db("select", "companies", "Failed to check duplicate company names", { companyId: company!.id }, conflictError)
    return { success: false, error: "Unable to validate company name." }
  }

  if (conflicts && conflicts.length > 0) {
    return { success: false, error: "A company with this name already exists." }
  }

  const updates: Record<string, unknown> = {
    name: normalizedName,
    description: normalizedDescription ?? null,
  }

  // Slug-rename machinery. For non-draft companies (listed / prospected /
  // unlisted) the old slug may already be in Google's index, so we preserve
  // it via a `company_redirects` row before updating to the new slug. Draft
  // companies have a transient slug — it'll be rebuilt cleanly at the
  // draft → listed transition (see completeCompanySetupAction), so we don't
  // touch it here to avoid noise.
  if (normalizedName !== company!.name) {
    const { data: row } = await supabase
      .from("companies")
      .select("status, slug")
      .eq("id", company!.id)
      .maybeSingle()

    const currentSlug = (row as { slug?: string | null } | null)?.slug ?? null
    const status = (row as { status?: string } | null)?.status ?? null
    const desiredBase = slugifyCompanyName(normalizedName)

    if (currentSlug && desiredBase && desiredBase !== currentSlug && status !== "draft") {
      try {
        const newSlug = await ensureUniqueCompanySlug(desiredBase, supabase, company!.id)
        const { error: redirectErr } = await supabase
          .from("company_redirects")
          .insert({ old_slug: currentSlug, new_slug: newSlug, company_id: company!.id } as any)
        if (redirectErr) {
          // Don't block the name change on a redirect-write failure (e.g. an
          // existing redirect row from a prior rename). Keep the old slug;
          // operator can fix manually.
          logger.warn("Failed to write company_redirects row; keeping old slug", { companyId: company!.id, oldSlug: currentSlug, newSlug }, redirectErr as unknown as Error)
        } else {
          updates.slug = newSlug
        }
      } catch (err) {
        logger.warn("Slug regeneration failed during rename; keeping existing slug", { companyId: company!.id }, err as Error)
      }
    }
  }

  const { error: updateError } = await supabase
    .from("companies")
    .update(updates)
    .eq("id", company!.id)

  if (updateError) {
    logger.db(
      "update",
      "companies",
      "Failed to update company profile",
      { companyId: company!.id, payload: sanitizeForLogging({ name: normalizedName }) },
      updateError
    )
    return { success: false, error: "Could not update your company profile." }
  }

  revalidatePath("/dashboard/company")
  return { success: true }
}

export async function updateCompanyContactAction(
  input: z.infer<typeof contactSchema> & z.infer<typeof socialSchema>
): Promise<ActionResult> {
  const { supabase, company, error } = await getCompanyContext()

  if (error) {
    return { success: false, error }
  }

  const parsedContact = contactSchema.safeParse(input)
  if (!parsedContact.success) {
    return { success: false, error: parsedContact.error.issues[0]?.message ?? "Invalid contact details" }
  }

  const parsedSocial = socialSchema.safeParse(input)
  if (!parsedSocial.success) {
    return { success: false, error: parsedSocial.error.issues[0]?.message ?? "Invalid social link" }
  }

  const payload = parsedContact.data
  const normalizedDomain = payload.domain ? payload.domain.replace(/^https?:\/\//i, "").toLowerCase() : ""

  // Geocode address for map coordinates
  let latitude: number | null = null
  let longitude: number | null = null
  const addressForGeocode = payload.address || payload.city
  if (addressForGeocode) {
    try {
      const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      if (mapsKey) {
        const geoRes = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressForGeocode)}&key=${mapsKey}`
        )
        const geoData = await geoRes.json()
        if (geoData?.results?.[0]?.geometry?.location) {
          latitude = geoData.results[0].geometry.location.lat
          longitude = geoData.results[0].geometry.location.lng
        }
      }
    } catch {}
  }

  const { error: updateError } = await supabase
    .from("companies")
    .update({
      domain: normalizedDomain || null,
      website: normalizedDomain ? `https://${normalizedDomain}` : null,
      email: payload.email || null,
      phone: payload.phone || null,
      address: payload.address ?? null,
      city: payload.city ?? null,
      country: payload.country ?? null,
      ...(latitude != null && longitude != null ? { latitude, longitude } : {}),
    })
    .eq("id", company!.id)

  if (updateError) {
    logger.db(
      "update",
      "companies",
      "Failed to update contact details",
      { companyId: company!.id, payload: sanitizeForLogging(payload) },
      updateError
    )
    return { success: false, error: "Could not update contact details." }
  }

  // Persist socials
  const socialEntries = Object.entries(parsedSocial.data).map(([platform, url]) => ({
    platform: platform as SocialPlatform,
    url: url?.trim() ?? "",
  }))

  for (const { platform, url } of socialEntries) {
    if (!url) {
      const { error: deleteError } = await supabase
        .from("company_social_links")
        .delete()
        .eq("company_id", company!.id)
        .eq("platform", platform)

      if (deleteError) {
        logger.db(
          "delete",
          "company_social_links",
          "Failed to delete social link",
          { companyId: company!.id, platform },
          deleteError
        )
      }
      continue
    }

    const { error: upsertError } = await supabase.from("company_social_links").upsert(
      {
        company_id: company!.id,
        platform,
        url,
      },
      { onConflict: "company_id,platform" }
    )

    if (upsertError) {
      logger.db(
        "upsert",
        "company_social_links",
        "Failed to upsert social link",
        { companyId: company!.id, platform, url: sanitizeForLogging(url) },
        upsertError
      )
      return { success: false, error: "Could not update social links." }
    }
  }

  // Refresh materialized views if coordinates were updated (for map)
  if (latitude != null && longitude != null) {
    try {
      const serviceRole = createServiceRoleSupabaseClient()
      await serviceRole.rpc("refresh_all_materialized_views")
    } catch {}
  }

  revalidatePath("/dashboard/company")
  return { success: true }
}

export async function updateCompanyServicesAction(input: z.infer<typeof servicesSchema>): Promise<ActionResult> {
  const { supabase, company, error } = await getCompanyContext()

  if (error) {
    return { success: false, error }
  }

  const parsed = servicesSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid services" }
  }

  const { primaryServiceId, servicesOffered, languages, certificates, specialties } = parsed.data

  console.log("[updateCompanyServices]", {
    companyId: company!.id,
    primaryServiceId: primaryServiceId || null,
    servicesOffered,
    languages,
    certificates,
    specialties,
  })

  // Update services — use direct update to avoid RPC auth check (needed for admin override)
  const updatePayload: Record<string, unknown> = {
    primary_service_id: primaryServiceId || null,
    services_offered: servicesOffered,
    languages,
    certificates,
  }
  // Only touch specialties when the caller passed an explicit array — leaves
  // the column alone for non-photographer callers that don't surface it.
  if (specialties !== undefined) {
    updatePayload.specialties = specialties
  }

  const { error: updateError } = await supabase
    .from("companies")
    .update(updatePayload)
    .eq("id", company!.id)

  // Refresh materialized views
  if (!updateError) {
    try { await supabase.rpc("refresh_all_materialized_views") } catch {}
  }

  if (updateError) {
    console.error("[updateCompanyServices] RPC error:", updateError)
    logger.db(
      "rpc",
      "update_company_services",
      "Failed to update company services",
      { companyId: company!.id },
      updateError
    )
    return { success: false, error: `Could not update services: ${updateError.message}` }
  }

  console.log("[updateCompanyServices] Success")

  revalidatePath("/dashboard/company")
  revalidatePath("/professionals", "layout")
  return { success: true }
}

const specsSchema = z.object({
  foundedYear: z.number().int().min(1800).max(new Date().getFullYear()).nullable().optional(),
  teamSizeMin: z.number().int().min(1).max(10000).nullable().optional(),
  teamSizeMax: z.number().int().min(1).max(10000).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  country: z.string().trim().max(120).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
})

export async function updateCompanySpecsAction(input: z.infer<typeof specsSchema>): Promise<ActionResult> {
  const { supabase, company, error } = await getCompanyContext()

  if (error) {
    return { success: false, error }
  }

  const parsed = specsSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid specs" }
  }

  const updateData: Record<string, unknown> = {}
  if (parsed.data.foundedYear !== undefined) updateData.founded_year = parsed.data.foundedYear
  if (parsed.data.teamSizeMin !== undefined) updateData.team_size_min = parsed.data.teamSizeMin
  if (parsed.data.teamSizeMax !== undefined) updateData.team_size_max = parsed.data.teamSizeMax
  if (parsed.data.city !== undefined) updateData.city = parsed.data.city
  if (parsed.data.country !== undefined) updateData.country = parsed.data.country
  if (parsed.data.address !== undefined) updateData.address = parsed.data.address

  if (Object.keys(updateData).length === 0) {
    return { success: true }
  }

  const { error: updateError } = await supabase
    .from("companies")
    .update(updateData)
    .eq("id", company!.id)

  if (updateError) {
    logger.db("update", "companies", "Failed to update company specs", { companyId: company!.id }, updateError)
    return { success: false, error: "Could not update company specs." }
  }

  revalidatePath("/dashboard/company")
  return { success: true }
}

export async function changeCompanyStatusAction(input: z.infer<typeof statusSchema>): Promise<ActionResult> {
  const { supabase, company, error } = await getCompanyContext()

  if (error) {
    return { success: false, error }
  }

  const parsed = statusSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid status" }
  }

  const nextStatus = parsed.data.status

  const { error: updateError } = await supabase
    .from("companies")
    .update({ status: nextStatus })
    .eq("id", company!.id)

  if (updateError) {
    logger.db(
      "update",
      "companies",
      "Failed to change company status",
      { companyId: company!.id, status: nextStatus },
      updateError
    )
    return { success: false, error: "Could not update company status." }
  }

  // Sync company status to Apollo account stage
  try {
    const { syncCompanyToApollo } = await import('@/lib/company-apollo-sync')
    await syncCompanyToApollo(company!.id)
  } catch (err) {
    logger.error("Failed to sync company to Apollo after status change", { companyId: company!.id }, err as Error)
  }

  revalidatePath("/dashboard/company")
  revalidatePath("/professionals")
  return { success: true }
}

export async function uploadCompanyLogoAction(formData: FormData): Promise<UploadActionResult> {
  const { supabase, company, user, error } = await getCompanyContext()

  if (error) {
    return { success: false, error }
  }

  // Rate limiting: 10 uploads per minute per user
  const rateLimit = await checkRateLimit(`upload:logo:${user!.id}`)
  if (!rateLimit.success) {
    return { success: false, error: "Too many upload attempts. Please try again later." }
  }

  const file = formData.get("file")

  if (!(file instanceof File)) {
    return { success: false, error: "Logo file is required." }
  }

  const validation = await validateImageFile(file)
  if (validation.error) {
    return { success: false, error: validation.error }
  }

  const sanitizedFile = validation.sanitizedFile!
  const filename = sanitizeFilename(sanitizedFile.name)
  const path = `${company!.id}/logo/${Date.now()}-${filename}`

  // Store old logo path before uploading new one
  const oldLogoPath = company!.logo_url ? extractStoragePathFromUrl(company!.logo_url) : null

  const uploadResult = await uploadToStorage(supabase, path, sanitizedFile)

  if (!uploadResult.success) {
    return {
      success: false,
      error: uploadResult.error?.message ?? "Could not upload logo.",
    }
  }

  const publicUrl = buildPublicUrl(path)

  const { error: updateError } = await supabase
    .from("companies")
    .update({ logo_url: publicUrl })
    .eq("id", company!.id)

  if (updateError) {
    // Cleanup newly uploaded file if database update fails
    await deleteFromStorage(supabase, company!.id, path)
    return {
      success: false,
      error: updateError.message,
    }
  }

  // Cleanup old logo after successful update (best effort, don't fail if cleanup fails)
  if (oldLogoPath) {
    try {
      await deleteFromStorage(supabase, company!.id, oldLogoPath)
    } catch (error) {
      // Log but don't fail the operation if cleanup fails
      logger.error(
        "storage-cleanup",
        "Failed to delete old logo after successful update",
        { companyId: company!.id, oldPath: oldLogoPath },
        isError(error) ? error : new Error(String(error))
      )
    }
  }

  revalidatePath("/dashboard/company")

  return { success: true, url: publicUrl }
}

export async function uploadCompanyPhotoAction(formData: FormData): Promise<UploadActionResult> {
  const { supabase, company, user, error } = await getCompanyContext()

  if (error) {
    return { success: false, error }
  }

  // Rate limiting: 10 uploads per minute per user
  const rateLimit = await checkRateLimit(`upload:photo:${user!.id}`)
  if (!rateLimit.success) {
    return { success: false, error: "Too many upload attempts. Please try again later." }
  }

  const file = formData.get("file")

  if (!(file instanceof File)) {
    return { success: false, error: "Photo file is required." }
  }

  const validation = await validateImageFile(file)
  if (validation.error) {
    return { success: false, error: validation.error }
  }

  const sanitizedFile = validation.sanitizedFile!
  const { data: existingPhotos, error: selectError } = await supabase
    .from("company_photos")
    .select("id, order_index, is_cover")
    .eq("company_id", company!.id)
    .order("order_index", { ascending: true })

  if (selectError) {
    return { success: false, error: selectError.message }
  }

  if ((existingPhotos?.length ?? 0) >= 5) {
    return { success: false, error: "You can upload up to 5 photos." }
  }

  // Use max order_index + 1 to avoid gaps when photos are deleted
  const maxOrderIndex = existingPhotos?.reduce((max, photo) => Math.max(max, photo.order_index), -1) ?? -1
  const orderIndex = maxOrderIndex + 1
  const shouldBeCover = !existingPhotos?.some((photo) => photo.is_cover)

  const filename = sanitizeFilename(sanitizedFile.name)
  const path = `${company!.id}/photos/${randomUUID()}-${filename}`

  const uploadResult = await uploadToStorage(supabase, path, sanitizedFile)

  if (!uploadResult.success) {
    return {
      success: false,
      error: uploadResult.error?.message ?? "Could not upload photo.",
    }
  }

  const publicUrl = buildPublicUrl(path)

  const fileSize = Math.max(sanitizedFile.size, 1)

  const { data: insertedPhoto, error: insertError } = await supabase
    .from("company_photos")
    .insert({
      company_id: company!.id,
      url: publicUrl,
      storage_path: path,
      order_index: orderIndex,
      is_cover: shouldBeCover,
      file_size: fileSize,
    })
    .select("*")
    .single()

  if (insertError || !insertedPhoto) {
    await deleteFromStorage(supabase, company!.id, path)
    return {
      success: false,
      error: insertError?.message ?? "Could not save photo metadata.",
    }
  }

  revalidatePath("/dashboard/company")

  return { success: true, photo: insertedPhoto }
}

export async function reorderCompanyPhotosAction(input: z.infer<typeof photoOrderSchema>): Promise<ActionResult> {
  const { supabase, company, error } = await getCompanyContext()

  if (error) {
    return { success: false, error }
  }

  const parsed = photoOrderSchema.safeParse(input)

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid ordering" }
  }

  // Use atomic function for reordering to prevent race conditions
  const { error: reorderError } = await supabase.rpc("reorder_company_photos", {
    photo_ids: parsed.data.photoIds,
    company_id_param: company!.id,
  })

  if (reorderError) {
    logger.db("rpc", "reorder_company_photos", "Failed to reorder photos", { companyId: company!.id }, reorderError)
    return { success: false, error: reorderError.message }
  }

  revalidatePath("/dashboard/company")
  return { success: true }
}

export async function setCompanyCoverPhotoAction(input: z.infer<typeof photoIdSchema>): Promise<ActionResult> {
  const { supabase, company, error } = await getCompanyContext()

  if (error) {
    return { success: false, error }
  }

  const parsed = photoIdSchema.safeParse(input)

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid photo" }
  }

  const { error: clearError } = await supabase
    .from("company_photos")
    .update({ is_cover: false })
    .eq("company_id", company!.id)

  if (clearError) {
    logger.db(
      "update",
      "company_photos",
      "Failed to clear existing cover photo",
      { companyId: company!.id },
      clearError
    )
    return { success: false, error: "Could not update cover photo." }
  }

  const { error: updateError } = await supabase
    .from("company_photos")
    .update({ is_cover: true })
    .eq("id", parsed.data.photoId)
    .eq("company_id", company!.id)

  if (updateError) {
    logger.db(
      "update",
      "company_photos",
      "Failed to set cover photo",
      { companyId: company!.id, photoId: parsed.data.photoId },
      updateError
    )
    return { success: false, error: "Could not update cover photo." }
  }

  revalidatePath("/dashboard/company")
  return { success: true }
}

export async function setCompanyHeroPhotoAction(input: { projectId: string; photoUrl: string }): Promise<ActionResult> {
  const { supabase, company, error } = await getCompanyContext()
  if (error) return { success: false, error }

  const { error: rpcError } = await supabase.rpc("set_company_hero_photo", {
    p_company_id: company!.id,
    p_project_id: input.projectId,
    p_photo_url: input.photoUrl,
  })

  if (rpcError) {
    logger.db("rpc", "set_company_hero_photo", "Failed to set hero photo", { companyId: company!.id }, rpcError)
    return { success: false, error: "Could not set hero photo." }
  }

  revalidatePath("/dashboard/company")
  revalidatePath("/professionals")
  return { success: true }
}

export async function clearCompanyHeroPhotoAction(): Promise<ActionResult> {
  const { supabase, company, error } = await getCompanyContext()
  if (error) return { success: false, error }

  const { error: rpcError } = await supabase.rpc("clear_company_hero_photo", {
    p_company_id: company!.id,
  })

  if (rpcError) {
    logger.db("rpc", "clear_company_hero_photo", "Failed to clear hero photo", { companyId: company!.id }, rpcError)
    return { success: false, error: "Could not clear hero photo." }
  }

  revalidatePath("/dashboard/company")
  revalidatePath("/professionals")
  return { success: true }
}

export async function deleteCompanyPhotoAction(input: z.infer<typeof photoIdSchema>): Promise<UploadActionResult> {
  const { supabase, company, error } = await getCompanyContext()

  if (error) {
    return { success: false, error }
  }

  const parsed = photoIdSchema.safeParse(input)

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid photo" }
  }

  const { data: existingPhoto, error: selectError } = await supabase
    .from("company_photos")
    .select("id, storage_path, is_cover")
    .eq("id", parsed.data.photoId)
    .eq("company_id", company!.id)
    .maybeSingle()

  if (selectError) {
    return { success: false, error: selectError.message }
  }

  if (!existingPhoto) {
    return { success: false, error: "Photo not found." }
  }

  const { error: deleteError } = await supabase
    .from("company_photos")
    .delete()
    .eq("id", parsed.data.photoId)
    .eq("company_id", company!.id)

  if (deleteError) {
    logger.db(
      "delete",
      "company_photos",
      "Failed to delete company photo",
      { companyId: company!.id, photoId: parsed.data.photoId },
      deleteError
    )
    return { success: false, error: "Could not delete photo." }
  }

  let nextCoverPhotoId: string | null = null

  if (existingPhoto.is_cover) {
    const { data: nextPhoto, error: nextError } = await supabase
      .from("company_photos")
      .select("id")
      .eq("company_id", company!.id)
      .order("order_index", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!nextError && nextPhoto) {
      nextCoverPhotoId = nextPhoto.id
      await supabase
        .from("company_photos")
        .update({ is_cover: true })
        .eq("id", nextPhoto.id)
        .eq("company_id", company!.id)
    }
  }

  await deleteFromStorage(supabase, company!.id, existingPhoto.storage_path)
  revalidatePath("/dashboard/company")
  return { success: true, nextCoverPhotoId }
}

// ── AI Description Generation ──

export async function generateCompanyDescriptionAction(
  companyId: string
): Promise<ActionResult & { description?: string }> {
  const { supabase, error } = await getCompanyContext()
  if (error) return { success: false, error }

  // Fetch company data for context
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, description, city, country, founded_year, languages, certificates, services_offered, domain, primary_service_id")
    .eq("id", companyId)
    .single()

  if (!company) return { success: false, error: "Company not found." }

  // Resolve service names from IDs
  let serviceNames: string[] = []
  if (company.services_offered?.length) {
    const { data: cats } = await supabase
      .from("categories")
      .select("id, name")
      .in("id", company.services_offered)
    serviceNames = (cats ?? []).map(c => c.name).filter(Boolean) as string[]
  }

  // Fetch website content if domain is set
  let websiteContent = ""
  if (company.domain) {
    try {
      const url = company.domain.startsWith("http") ? company.domain : `https://${company.domain}`
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "ArcoBot/1.0" },
      })
      clearTimeout(timeout)
      if (res.ok) {
        const html = await res.text()
        // Strip HTML tags, scripts, styles — extract text only
        const text = html
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<nav[\s\S]*?<\/nav>/gi, "")
          .replace(/<footer[\s\S]*?<\/footer>/gi, "")
          .replace(/<header[\s\S]*?<\/header>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&[a-z]+;/gi, " ")
          .replace(/\s+/g, " ")
          .trim()
        // Take first ~2000 chars to keep context manageable
        websiteContent = text.slice(0, 2000)
      }
    } catch {
      // Website fetch failed — non-fatal, continue without it
    }
  }

  const context = [
    `Company name: ${company.name}`,
    company.city ? `Location: ${company.city}${company.country ? `, ${company.country}` : ""}` : null,
    company.founded_year ? `Founded: ${company.founded_year}` : null,
    serviceNames.length > 0 ? `Services: ${serviceNames.join(", ")}` : null,
    company.languages?.length ? `Languages: ${(company.languages as string[]).join(", ")}` : null,
    company.certificates?.length ? `Certificates: ${(company.certificates as string[]).join(", ")}` : null,
    company.domain ? `Website: ${company.domain}` : null,
    websiteContent ? `Website content:\n${websiteContent}` : null,
    company.description ? `Current description: ${company.description}` : null,
  ].filter(Boolean).join("\n")

  if (!process.env.ANTHROPIC_API_KEY) {
    return { success: false, error: "AI generation is not configured." }
  }

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default
    const client = new Anthropic()

    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `You write company descriptions for Arco, a curated marketplace for architecture, interior design and construction professionals in the Netherlands.

Tone: professional, warm, confident. Third-person. Active voice. No superlatives or clichés. Focus on what the company does, their expertise, and what makes them distinctive. 3-4 sentences, 60-80 words. Write in ${await getDescriptionLocale()}. Return only the description text — no quotes, labels, or preamble.

${context}`,
      }],
    })

    const text = message.content.find((b) => b.type === "text")?.text?.trim()
    if (!text) return { success: false, error: "AI returned empty response." }

    const description = text.slice(0, 750)

    // Determine which locale was generated and translate to the other
    const cookieStore = await cookies()
    const currentLocale = cookieStore.get("NEXT_LOCALE")?.value ?? "en"
    const otherLocale = currentLocale === "nl" ? "en" : "nl"
    const otherLang = currentLocale === "nl" ? "English" : "Dutch"

    // Fetch existing translations
    const { data: existing } = await supabase
      .from("companies")
      .select("translations")
      .eq("id", companyId)
      .single()

    const translations = ((existing?.translations as Record<string, any>) ?? {})
    if (!translations[currentLocale]) translations[currentLocale] = {}
    translations[currentLocale].description = description

    // Auto-translate to the other language
    try {
      const translateMsg = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 400,
        messages: [{
          role: "user",
          content: `Translate the following company description to ${otherLang}. Keep the same tone and style. Return only the translated text, no quotes or labels.\n\n${description}`,
        }],
      })
      const translated = translateMsg.content.find((b) => b.type === "text")?.text?.trim()
      if (translated) {
        if (!translations[otherLocale]) translations[otherLocale] = {}
        translations[otherLocale].description = translated.slice(0, 750)
      }
    } catch {
      // Translation failed — non-fatal
    }

    // Save description + translations
    await supabase.from("companies").update({ description, translations }).eq("id", companyId)

    return { success: true, description }
  } catch (e) {
    const errMsg = isError(e) ? e.message : String(e)
    console.error("[ai-description] Failed:", errMsg, e)
    logger.error("Failed to generate description", { companyId, errMsg }, isError(e) ? e : undefined)
    return { success: false, error: `Failed to generate description: ${errMsg}` }
  }
}

/**
 * Save a company description for a specific locale,
 * update the translations JSONB, and auto-translate the other language.
 */
export async function saveCompanyTranslatedField(
  companyId: string,
  field: "description",
  value: string,
  locale: string
): Promise<ActionResult> {
  const { supabase, error } = await getCompanyContext()
  if (error) return { success: false, error }

  const { data: company } = await supabase
    .from("companies")
    .select("translations")
    .eq("id", companyId)
    .single()

  if (!company) return { success: false, error: "Company not found." }

  const translations = ((company.translations as Record<string, any>) ?? {})
  if (!translations[locale]) translations[locale] = {}
  translations[locale][field] = value

  // Update main column + translations
  await supabase.from("companies").update({ [field]: value, translations }).eq("id", companyId)

  // Auto-translate to the other language
  const otherLocale = locale === "nl" ? "en" : "nl"
  const otherLang = locale === "nl" ? "English" : "Dutch"

  if (value && process.env.ANTHROPIC_API_KEY) {
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default
      const client = new Anthropic()
      const msg = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 400,
        messages: [{
          role: "user",
          content: `Translate the following company description to ${otherLang}. Keep the same tone and style. Return only the translated text, no quotes or labels.\n\n${value}`,
        }],
      })
      const translated = msg.content.find((b) => b.type === "text")?.text?.trim()
      if (translated) {
        if (!translations[otherLocale]) translations[otherLocale] = {}
        translations[otherLocale][field] = translated.slice(0, 750)
        await supabase.from("companies").update({ translations }).eq("id", companyId)
      }
    } catch {
      // Translation failed — non-fatal
    }
  }

  return { success: true }
}

// ── Company Switcher ──

export async function getUserCompaniesAction(): Promise<{
  companies: Array<{ id: string; name: string; logo_url: string | null; role: "owner" | "member" }>
  activeId: string | null
}> {
  const authClient = await createServerActionSupabaseClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { companies: [], activeId: null }

  // Use service role to bypass RLS for company lookups
  const supabase = createServiceRoleSupabaseClient()

  const { getActiveCompanyId, setActiveCompanyId } = await import("@/lib/active-company")

  const companies: Array<{ id: string; name: string; logo_url: string | null; role: "owner" | "member" }> = []
  const seen = new Set<string>()

  // Owned companies first
  const { data: owned } = await supabase
    .from("companies")
    .select("id, name, logo_url")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })

  for (const c of owned ?? []) {
    if (!seen.has(c.id)) {
      seen.add(c.id)
      companies.push({ id: c.id, name: c.name ?? "Unnamed", logo_url: c.logo_url, role: "owner" })
    }
  }

  // Member companies (via company_members table)
  const { data: memberships } = await supabase
    .from("company_members")
    .select("company_id, companies(id, name, logo_url)")
    .eq("user_id", user.id)
    .eq("status", "active")

  for (const m of memberships ?? []) {
    const c = m.companies as unknown as { id: string; name: string; logo_url: string | null } | null
    if (c && !seen.has(c.id)) {
      seen.add(c.id)
      companies.push({ id: c.id, name: c.name ?? "Unnamed", logo_url: c.logo_url, role: "member" })
    }
  }

  // Professional companies (via professionals table)
  const { data: proLinks } = await supabase
    .from("professionals")
    .select("company_id, companies!professionals_company_id_fkey(id, name, logo_url)")
    .eq("user_id", user.id)
    .not("company_id", "is", null)

  for (const p of proLinks ?? []) {
    const c = p.companies as unknown as { id: string; name: string; logo_url: string | null } | null
    if (c && !seen.has(c.id)) {
      seen.add(c.id)
      companies.push({ id: c.id, name: c.name ?? "Unnamed", logo_url: c.logo_url, role: "member" })
    }
  }

  // Active ID: use cookie if set and valid, otherwise default to first company
  let activeId = await getActiveCompanyId()
  const isActiveValid = activeId && companies.some(c => c.id === activeId)
  if (!isActiveValid) {
    const defaultCompany = companies[0] // owned companies are first in the list
    if (defaultCompany) {
      await setActiveCompanyId(defaultCompany.id)
      activeId = defaultCompany.id
    }
  }

  return { companies, activeId }
}

export async function switchCompanyAction(companyId: string): Promise<ActionResult> {
  const authClient = await createServerActionSupabaseClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { success: false, error: "Not signed in." }

  // Use service role to bypass RLS for access verification
  const supabase = createServiceRoleSupabaseClient()

  // Verify access via any path
  const [{ data: isOwner }, { data: isMember }, { data: isProfessional }] = await Promise.all([
    supabase.from("companies").select("id").eq("id", companyId).eq("owner_id", user.id).maybeSingle(),
    supabase.from("company_members").select("id").eq("company_id", companyId).eq("user_id", user.id).eq("status", "active").maybeSingle(),
    supabase.from("professionals").select("id").eq("company_id", companyId).eq("user_id", user.id).maybeSingle(),
  ])

  if (!isOwner && !isMember && !isProfessional) {
    // Allow admins to switch to any company
    const { data: profile } = await supabase.from("profiles").select("user_types, admin_role").eq("id", user.id).maybeSingle()
    const isAdmin = profile?.user_types?.includes("admin") || profile?.admin_role === "admin" || profile?.admin_role === "super_admin"
    if (!isAdmin) {
      return { success: false, error: "No access to this company." }
    }
  }

  const { setActiveCompanyId } = await import("@/lib/active-company")
  await setActiveCompanyId(companyId)

  revalidatePath("/dashboard", "layout")
  return { success: true }
}

// ─── Company Deletion ─────────────────────────────────────────────────────────

export type CompanyDeletionCheck = {
  canDelete: boolean
  companyName: string
  warnings: string[]
  blockers: string[]
}

export async function checkCompanyDeletionAction(): Promise<{ success: true; data: CompanyDeletionCheck } | { success: false; error: string }> {
  const { supabase, user, company, error } = await getCompanyContext()
  if (error) return { success: false, error }

  const companyId = company!.id

  // Verify ownership
  const { data: owned } = await supabase
    .from("companies")
    .select("id, name, owner_id")
    .eq("id", companyId)
    .eq("owner_id", user!.id)
    .maybeSingle()

  if (!owned) {
    return { success: false, error: "Only the company owner can delete the company." }
  }

  const warnings: string[] = []
  const blockers: string[] = []

  // Count team members (excluding owner)
  const { count: memberCount } = await supabase
    .from("company_members")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .neq("user_id", user!.id)

  if ((memberCount ?? 0) > 0) {
    warnings.push(`${memberCount} team member${memberCount === 1 ? "" : "s"} will be removed`)
  }

  // Count project associations
  const { count: projectCount } = await supabase
    .from("project_professionals")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)

  if ((projectCount ?? 0) > 0) {
    warnings.push(`Company will be removed from ${projectCount} project${projectCount === 1 ? "" : "s"}`)
  }

  return {
    success: true,
    data: {
      canDelete: blockers.length === 0,
      companyName: owned.name,
      warnings,
      blockers,
    },
  }
}

export async function deleteCompanyAction(input: { confirmText: string }): Promise<ActionResult> {
  if (input.confirmText !== "DELETE") {
    return { success: false, error: "You must type DELETE to confirm." }
  }

  const { supabase, user, company, error } = await getCompanyContext()
  if (error) return { success: false, error }

  const companyId = company!.id

  // Verify ownership
  const { data: owned } = await supabase
    .from("companies")
    .select("id, owner_id")
    .eq("id", companyId)
    .eq("owner_id", user!.id)
    .maybeSingle()

  if (!owned) {
    return { success: false, error: "Only the company owner can delete the company." }
  }

  // Use service role to delete child rows that RLS would block
  // (project_professionals DELETE policy requires project owner, not company owner)
  const serviceRole = createServiceRoleSupabaseClient()

  const { error: ppErr } = await serviceRole
    .from("project_professionals")
    .delete()
    .eq("company_id", companyId)

  if (ppErr) {
    logger.db("delete", "project_professionals", "Failed to delete project professional links", { companyId }, ppErr)
    return { success: false, error: "Failed to remove company from projects." }
  }

  // Explicitly delete child rows (safety, even though CASCADE would handle most)
  const { error: photosErr } = await supabase
    .from("company_photos")
    .delete()
    .eq("company_id", companyId)

  if (photosErr) {
    logger.db("delete", "company_photos", "Failed to delete company photos", { companyId }, photosErr)
    return { success: false, error: "Failed to delete company photos." }
  }

  const { error: linksErr } = await supabase
    .from("company_social_links")
    .delete()
    .eq("company_id", companyId)

  if (linksErr) {
    logger.db("delete", "company_social_links", "Failed to delete company social links", { companyId }, linksErr)
    return { success: false, error: "Failed to delete company social links." }
  }

  // Delete company — CASCADE handles: company_members, saved_companies.
  // professionals.company_id is SET NULL.
  const { error: deleteErr } = await supabase
    .from("companies")
    .delete()
    .eq("id", companyId)

  if (deleteErr) {
    logger.db("delete", "companies", "Failed to delete company", { companyId }, deleteErr)
    return { success: false, error: "Failed to delete company." }
  }

  // Remove "professional" from owner's user_types
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_types")
    .eq("id", user!.id)
    .single()

  if (profile?.user_types) {
    const updatedTypes = (profile.user_types as string[]).filter((t) => t !== "professional")
    await supabase
      .from("profiles")
      .update({ user_types: updatedTypes })
      .eq("id", user!.id)
  }

  // Clear active company cookie
  const { cookies } = await import("next/headers")
  const cookieStore = await cookies()
  cookieStore.delete("active_company_id")

  revalidatePath("/dashboard", "layout")
  return { success: true }
}

// ══════════════════════════════════════════════════════════
// Complete Company Setup (go-live on onboarding)
// ══════════════════════════════════════════════════════════

export async function completeCompanySetupAction(input: {
  listCompany: boolean
  listProjectIds: string[]
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerActionSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Not authenticated" }

  // Find company owned by this user
  const { data: ownedCompany } = await supabase
    .from("companies")
    .select("id, name, slug, status")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  const companyId = ownedCompany?.id
  if (!companyId) return { success: false, error: "No company found" }

  // List the company and mark setup as completed
  if (input.listCompany) {
    // Lock-in moment: regenerate the slug from the current name. While the
    // company was draft the slug was transient (set at insert from whatever
    // the name was *then*), and Google never indexed it. Once status flips
    // to listed the URL becomes the public, indexable contract — so we want
    // it to match the *current* name. Any future rename of a listed company
    // goes through updateCompanyProfileAction's redirect path instead.
    const desiredBase = ownedCompany?.name ? slugifyCompanyName(ownedCompany.name) : null
    const updates: Record<string, unknown> = { status: "listed", setup_completed: true }
    if (desiredBase && desiredBase !== ownedCompany?.slug) {
      try {
        updates.slug = await ensureUniqueCompanySlug(desiredBase, supabase, companyId)
      } catch (err) {
        // Don't block the listing on slug-uniqueness exhaustion — keep the
        // existing slug and surface a warning. Operator can rename later.
        logger.warn("Slug regeneration failed at listing time; keeping existing slug", { companyId }, err as Error)
      }
    }

    const { error: statusErr } = await supabase
      .from("companies")
      .update(updates)
      .eq("id", companyId)

    if (statusErr) {
      logger.db("update", "companies", "Failed to list company", { companyId }, statusErr)
      return { success: false, error: "Failed to list company" }
    }
  } else {
    // Even if not listing, mark setup as completed and move from draft to unlisted
    await supabase
      .from("companies")
      .update({ setup_completed: true, status: "unlisted" })
      .eq("id", companyId)
      .in("status", ["draft", "unlisted"])
  }

  // Sync company status to Apollo account stage
  try {
    const { syncCompanyToApollo } = await import('@/lib/company-apollo-sync')
    await syncCompanyToApollo(companyId)
  } catch (err) {
    logger.error("Failed to sync company to Apollo after setup", { companyId }, err as Error)
  }

  // Feature selected projects (live_on_page = listed on project page + shown in portfolio)
  if (input.listProjectIds.length > 0) {
    const { error: ppErr } = await supabase
      .from("project_professionals")
      .update({ status: "live_on_page" })
      .eq("company_id", companyId)
      .in("project_id", input.listProjectIds)

    if (ppErr) {
      logger.db("update", "project_professionals", "Failed to feature projects", { companyId, projectIds: input.listProjectIds }, ppErr)
      return { success: false, error: "Failed to feature projects" }
    }
  }

  // Update prospect status to "active" (Listed) if company was listed
  try {
    const serviceRole2 = createServiceRoleSupabaseClient()
    const { data: prospect } = await serviceRole2
      .from("prospects")
      .select("id, status, apollo_contact_id")
      .or(`company_id.eq.${companyId},user_id.eq.${user.id}`)
      .maybeSingle()

    if (prospect && prospect.status !== "active") {
      const newStatus = input.listCompany ? "active" : "company"
      await serviceRole2.from("prospects").update({
        status: newStatus,
        ...(input.listCompany ? { converted_at: new Date().toISOString() } : { company_created_at: new Date().toISOString() }),
      }).eq("id", prospect.id)

      await serviceRole2.from("prospect_events").insert({
        prospect_id: prospect.id,
        event_type: "status_changed",
        metadata: { new_status: newStatus, old_status: prospect.status, trigger: "complete_company_setup" },
      } as any)
    }
  } catch (err) {
    logger.error("Failed to update prospect status on company setup", { companyId }, err as Error)
  }

  // Refresh materialized views
  const serviceRole = createServiceRoleSupabaseClient()
  await serviceRole.rpc("refresh_all_materialized_views")

  revalidatePath("/dashboard", "layout")
  revalidatePath("/professionals", "layout")
  revalidatePath("/projects", "layout")
  return { success: true }
}

// ── Update Cover Photo ──

export async function updateCoverPhotoAction(input: {
  projectId: string
  photoId: string
  role: "owner" | "contributor"
  projectProfessionalId?: string
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerActionSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Not authenticated" }

  if (input.role === "contributor" && input.projectProfessionalId) {
    const { error } = await supabase
      .from("project_professionals")
      .update({ cover_photo_id: input.photoId })
      .eq("id", input.projectProfessionalId)
    if (error) {
      logger.db("update", "project_professionals", "Failed to update cover photo", { projectProfessionalId: input.projectProfessionalId }, error)
      return { success: false, error: "Failed to update cover photo" }
    }
  } else {
    const { error } = await supabase
      .from("project_photos")
      .update({ is_primary: true })
      .eq("id", input.photoId)
      .eq("project_id", input.projectId)
    if (error) {
      logger.db("update", "project_photos", "Failed to update cover photo", { projectId: input.projectId, photoId: input.photoId }, error)
      return { success: false, error: "Failed to update cover photo" }
    }
  }

  const serviceRole = createServiceRoleSupabaseClient()
  await serviceRole.rpc("refresh_all_materialized_views")

  revalidatePath("/dashboard", "layout")
  revalidatePath("/professionals", "layout")
  revalidatePath("/projects", "layout")
  return { success: true }
}
