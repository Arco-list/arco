"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { randomUUID } from "node:crypto"
import { Buffer } from "node:buffer"
import { JSDOM } from "jsdom"
import DOMPurify from "dompurify"

import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { logger, sanitizeForLogging } from "@/lib/logger"
import type { Database } from "@/lib/supabase/types"
import { checkRateLimit } from "@/lib/rate-limit"

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/svg+xml"]

const nameSchema = z
  .string({ required_error: "Company name is required" })
  .trim()
  .min(2, "Company name must be at least 2 characters")
  .max(120, "Company name cannot exceed 120 characters")

const descriptionSchema = z
  .string()
  .trim()
  .max(2000, "Description cannot exceed 2000 characters")
  .optional()

const contactSchema = z.object({
  domain: z
    .string()
    .trim()
    .min(1, "Domain is required")
    .max(120, "Domain must be shorter than 120 characters")
    .refine((value) => /^[a-z0-9.-]+$/i.test(value.replace(/^https?:\/\//i, "")), {
      message: "Enter a valid domain (example.com)",
    }),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z.string().trim().min(5, "Enter a valid phone number"),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  country: z.string().trim().optional(),
})

const socialSchema = z.object({
  facebook: z.string().trim().url("Enter a valid URL").optional().or(z.literal("")),
  instagram: z.string().trim().url("Enter a valid URL").optional().or(z.literal("")),
  linkedin: z.string().trim().url("Enter a valid URL").optional().or(z.literal("")),
  pinterest: z.string().trim().url("Enter a valid URL").optional().or(z.literal("")),
})

const servicesSchema = z.object({
  primaryServiceId: z.string().uuid("Primary service required").optional().or(z.literal("")),
  servicesOffered: z.array(z.string().trim()).max(12, "Select up to 12 services"),
  languages: z.array(z.string().trim()).max(10, "Select up to 10 languages"),
  certificates: z.array(z.string().trim()).max(10, "Select up to 10 certificates"),
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

async function getCompanyContext() {
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

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, name, logo_url")
    .eq("owner_id", user.id)
    .maybeSingle()

  if (companyError) {
    logger.db("select", "companies", "Failed to load company for owner", { userId: user.id }, companyError)
    return { supabase, user, company: null as const, error: "Unable to load your company." }
  }

  if (!company) {
    return { supabase, user, company: null as const, error: "Create a company first." }
  }

  return { supabase, user, company, error: null as const }
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
      logger.error("svg-sanitization", "Failed to sanitize SVG file", { fileName: file.name }, error as Error)
      return { error: "Invalid SVG file." }
    }
  }

  return { sanitizedFile: file }
}

const uploadToStorage = async (path: string, file: File) => {
  const serviceClient = createServiceRoleSupabaseClient()
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error } = await serviceClient
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

const deleteFromStorage = async (path: string | null | undefined) => {
  if (!path) return

  const serviceClient = createServiceRoleSupabaseClient()
  await serviceClient.storage.from("company-assets").remove([path])
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

  const { error: updateError } = await supabase
    .from("companies")
    .update({
      name: normalizedName,
      description: normalizedDescription ?? null,
    })
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
  const normalizedDomain = payload.domain.replace(/^https?:\/\//i, "").toLowerCase()

  const { error: updateError } = await supabase
    .from("companies")
    .update({
      domain: normalizedDomain,
      website: `https://${normalizedDomain}`,
      email: payload.email,
      phone: payload.phone,
      address: payload.address ?? null,
      city: payload.city ?? null,
      country: payload.country ?? null,
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

  const { primaryServiceId, servicesOffered, languages, certificates } = parsed.data

  const { error: updateError } = await supabase
    .from("companies")
    .update({
      primary_service_id: primaryServiceId || null,
      services_offered: servicesOffered,
      languages,
      certificates,
    })
    .eq("id", company!.id)

  if (updateError) {
    logger.db(
      "update",
      "companies",
      "Failed to update company services",
      { companyId: company!.id },
      updateError
    )
    return { success: false, error: "Could not update services." }
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
  const uploadResult = await uploadToStorage(path, sanitizedFile)

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
    await deleteFromStorage(path)
    return {
      success: false,
      error: updateError.message,
    }
  }

  await deleteFromStorage(extractStoragePathFromUrl(company!.logo_url))

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
  const serviceClient = createServiceRoleSupabaseClient()

  const { data: existingPhotos, error: selectError } = await serviceClient
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

  const orderIndex = existingPhotos?.length ?? 0
  const shouldBeCover = !existingPhotos?.some((photo) => photo.is_cover)

  const filename = sanitizeFilename(sanitizedFile.name)
  const path = `${company!.id}/photos/${randomUUID()}-${filename}`

  const uploadResult = await uploadToStorage(path, sanitizedFile)

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
    await deleteFromStorage(path)
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

  await deleteFromStorage(existingPhoto.storage_path)
  revalidatePath("/dashboard/company")
  return { success: true, nextCoverPhotoId }
}
