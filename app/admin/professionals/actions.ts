"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createServerActionSupabaseClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"
import { logger } from "@/lib/logger"

const inviteIdSchema = z.string().uuid()

async function assertAdmin() {
  const supabase = await createServerActionSupabaseClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    logger.security("admin-auth", "Admin authentication failed", {
      error: authError?.message,
      hasUser: Boolean(user),
    })
    return { supabase, user: null, error: authError ?? new Error("Not authenticated") }
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_types")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError || !isAdminUser(profile?.user_types)) {
    logger.security("admin-auth", "Admin authorization failed", {
      userId: user.id,
      userTypes: profile?.user_types,
      error: profileError?.message,
    })
    return {
      supabase,
      user,
      error: profileError ?? new Error("Unauthorized"),
    }
  }

  return { supabase, user, error: null }
}

const companyStatusSchema = z.enum(["unlisted", "listed", "deactivated"])

export async function resendProfessionalInviteAction({ inviteId }: { inviteId: string }) {
  const idResult = inviteIdSchema.safeParse(inviteId)
  if (!idResult.success) {
    return { success: false, error: "Invalid invite id" }
  }

  const { supabase, error } = await assertAdmin()
  if (error) {
    return { success: false, error: error.message }
  }

  const now = new Date().toISOString()

  const { error: updateError } = await supabase
    .from("project_professionals")
    .update({ invited_at: now, responded_at: null, status: "invited" })
    .eq("id", idResult.data)

  if (updateError) {
    logger.error("admin-professionals", "Failed to resend professional invite", {
      inviteId: idResult.data,
      error: updateError.message,
    })
    return { success: false, error: updateError.message }
  }

  revalidatePath("/admin/professionals")

  return { success: true }
}

export async function updateCompanyStatusAction(input: { companyId: string; status: z.infer<typeof companyStatusSchema> }) {
  const parsedCompanyId = inviteIdSchema.safeParse(input.companyId)
  if (!parsedCompanyId.success) {
    return { success: false, error: "Invalid company id" }
  }

  const parsedStatus = companyStatusSchema.safeParse(input.status)
  if (!parsedStatus.success) {
    return { success: false, error: "Invalid company status" }
  }

  const { supabase, error } = await assertAdmin()
  if (error) {
    return { success: false, error: error.message }
  }

  const { error: updateError } = await supabase
    .from("companies")
    .update({ status: parsedStatus.data })
    .eq("id", parsedCompanyId.data)

  if (updateError) {
    logger.error("admin-professionals", "Failed to update company status", {
      companyId: parsedCompanyId.data,
      error: updateError.message,
    })
    return { success: false, error: updateError.message }
  }

  revalidatePath("/admin/professionals")
  return { success: true }
}

export async function updateProfessionalFeaturedAction(input: {
  professionalId: string
  isFeatured: boolean
}) {
  const parsedProfessionalId = inviteIdSchema.safeParse(input.professionalId)
  if (!parsedProfessionalId.success) {
    return { success: false, error: "Invalid professional id" }
  }

  const featuredResult = z.boolean().safeParse(input.isFeatured)
  if (!featuredResult.success) {
    return { success: false, error: "Invalid featured status" }
  }

  const { supabase, error } = await assertAdmin()
  if (error) {
    return { success: false, error: error.message }
  }

  const { error: updateError } = await supabase
    .from("professionals")
    .update({ is_featured: featuredResult.data })
    .eq("id", parsedProfessionalId.data)

  if (updateError) {
    logger.error("admin-professionals", "Failed to update professional featured status", {
      professionalId: parsedProfessionalId.data,
      isFeatured: featuredResult.data,
      error: updateError.message,
    })
    return { success: false, error: updateError.message }
  }

  logger.info("admin-professionals", "Professional featured status updated", {
    professionalId: parsedProfessionalId.data,
    isFeatured: featuredResult.data,
  })

  revalidatePath("/admin/professionals")
  return { success: true }
}

export async function updateCompanyFeaturedAction(input: {
  companyId: string
  isFeatured: boolean
}) {
  const parsedCompanyId = inviteIdSchema.safeParse(input.companyId)
  if (!parsedCompanyId.success) {
    return { success: false, error: "Invalid company id" }
  }

  const featuredResult = z.boolean().safeParse(input.isFeatured)
  if (!featuredResult.success) {
    return { success: false, error: "Invalid featured status" }
  }

  const { supabase, error } = await assertAdmin()
  if (error) {
    return { success: false, error: error.message }
  }

  const { error: updateError } = await supabase
    .from("companies")
    .update({ is_featured: featuredResult.data })
    .eq("id", parsedCompanyId.data)

  if (updateError) {
    logger.error("admin-professionals", "Failed to update company featured status", {
      companyId: parsedCompanyId.data,
      isFeatured: featuredResult.data,
      error: updateError.message,
    })
    return { success: false, error: updateError.message }
  }

  logger.info("admin-professionals", "Company featured status updated", {
    companyId: parsedCompanyId.data,
    isFeatured: featuredResult.data,
  })

  revalidatePath("/admin/professionals")
  revalidatePath("/")
  return { success: true }
}

export async function updateCompanyDetailsAction(input: {
  companyId: string
  name: string
  logoUrl: string | null
  website: string | null
  contactEmail: string | null
  services: string[]
}) {
  const parsedCompanyId = inviteIdSchema.safeParse(input.companyId)
  if (!parsedCompanyId.success) {
    return { success: false, error: "Invalid company id" }
  }

  const nameResult = z.string().min(2).max(150).safeParse(input.name)
  if (!nameResult.success) {
    return { success: false, error: "Company name must be between 2 and 150 characters" }
  }

  const logoResult = z
    .string()
    .url()
    .max(1024)
    .nullable()
    .transform((value) => (value ? value.trim() : null))
    .safeParse(input.logoUrl && input.logoUrl.length > 0 ? input.logoUrl : null)

  if (!logoResult.success) {
    return { success: false, error: "Logo must be a valid URL" }
  }

  const websiteResult = z
    .string()
    .url()
    .max(1024)
    .nullable()
    .transform((value) => (value ? value.trim() : null))
    .safeParse(input.website && input.website.length > 0 ? input.website : null)

  if (!websiteResult.success) {
    return { success: false, error: "Website must be a valid URL" }
  }

  const emailResult = z
    .string()
    .email()
    .max(320)
    .nullable()
    .transform((value) => (value ? value.trim() : null))
    .safeParse(input.contactEmail && input.contactEmail.length > 0 ? input.contactEmail : null)

  if (!emailResult.success) {
    return { success: false, error: "Provide a valid contact email" }
  }

  const servicesResult = z
    .array(z.string().min(1).max(255))
    .max(24)
    .transform((list) => Array.from(new Set(list.map((value) => value.trim()).filter(Boolean))))
    .safeParse(input.services ?? [])

  if (!servicesResult.success) {
    return { success: false, error: "Services selection is invalid" }
  }

  const { supabase, error } = await assertAdmin()
  if (error) {
    return { success: false, error: error.message }
  }

  const updatePayload = {
    name: nameResult.data,
    logo_url: logoResult.data,
    website: websiteResult.data,
    email: emailResult.data,
    services_offered: servicesResult.data,
  }

  const { error: updateError } = await supabase
    .from("companies")
    .update(updatePayload)
    .eq("id", parsedCompanyId.data)

  if (updateError) {
    logger.error("admin-professionals", "Failed to update company details", {
      companyId: parsedCompanyId.data,
      error: updateError.message,
    })
    return { success: false, error: updateError.message }
  }

  revalidatePath("/admin/professionals")
  return { success: true }
}
