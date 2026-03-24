"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"
import { logger } from "@/lib/logger"

// Generic UUID schema used for validating all UUID fields (invites, companies, professionals, etc.)
const uuidSchema = z.string().uuid()

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
const companyPlanTierSchema = z.enum(["basic", "plus"])

export async function resendProfessionalInviteAction({ inviteId }: { inviteId: string }) {
  const idResult = uuidSchema.safeParse(inviteId)
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
  const parsedCompanyId = uuidSchema.safeParse(input.companyId)
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

export async function updateCompanyPlanTierAction(input: { companyId: string; planTier: z.infer<typeof companyPlanTierSchema> }) {
  const parsedCompanyId = uuidSchema.safeParse(input.companyId)
  if (!parsedCompanyId.success) {
    return { success: false, error: "Invalid company id" }
  }

  const parsedPlanTier = companyPlanTierSchema.safeParse(input.planTier)
  if (!parsedPlanTier.success) {
    return { success: false, error: "Invalid plan tier" }
  }

  const { supabase, error } = await assertAdmin()
  if (error) {
    return { success: false, error: error.message }
  }

  const { error: updateError } = await supabase
    .from("companies")
    .update({ plan_tier: parsedPlanTier.data })
    .eq("id", parsedCompanyId.data)

  if (updateError) {
    logger.error("admin-professionals", "Failed to update company plan tier", {
      companyId: parsedCompanyId.data,
      error: updateError.message,
    })
    return { success: false, error: updateError.message }
  }

  revalidatePath("/admin/professionals")
  return { success: true }
}

export async function updateCompanyPlanExpirationAction(input: { companyId: string; planExpiresAt: string | null }) {
  const parsedCompanyId = uuidSchema.safeParse(input.companyId)
  if (!parsedCompanyId.success) {
    return { success: false, error: "Invalid company id" }
  }

  const expirationResult = z
    .string()
    .datetime()
    .nullable()
    .safeParse(input.planExpiresAt)

  if (!expirationResult.success) {
    return { success: false, error: "Invalid expiration date" }
  }

  const { supabase, error } = await assertAdmin()
  if (error) {
    return { success: false, error: error.message }
  }

  const { error: updateError } = await supabase
    .from("companies")
    .update({ plan_expires_at: expirationResult.data })
    .eq("id", parsedCompanyId.data)

  if (updateError) {
    logger.error("admin-professionals", "Failed to update company plan expiration", {
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
  const parsedProfessionalId = uuidSchema.safeParse(input.professionalId)
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
  const parsedCompanyId = uuidSchema.safeParse(input.companyId)
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

export async function updateCompanyAutoApproveAction(input: {
  companyId: string
  autoApproveProjects: boolean
}) {
  const parsedCompanyId = uuidSchema.safeParse(input.companyId)
  if (!parsedCompanyId.success) {
    return { success: false, error: "Invalid company id" }
  }

  const autoApproveResult = z.boolean().safeParse(input.autoApproveProjects)
  if (!autoApproveResult.success) {
    return { success: false, error: "Invalid auto-approve value" }
  }

  const { supabase, error } = await assertAdmin()
  if (error) {
    return { success: false, error: error.message }
  }

  const { error: updateError } = await supabase
    .from("companies")
    .update({ auto_approve_projects: autoApproveResult.data } as never)
    .eq("id", parsedCompanyId.data)

  if (updateError) {
    logger.error("admin-professionals", "Failed to update company auto-approve", {
      companyId: parsedCompanyId.data,
      autoApproveProjects: autoApproveResult.data,
      error: updateError.message,
    })
    return { success: false, error: updateError.message }
  }

  logger.info("admin-professionals", "Company auto-approve updated", {
    companyId: parsedCompanyId.data,
    autoApproveProjects: autoApproveResult.data,
  })

  revalidatePath("/admin/professionals")
  return { success: true }
}

export async function updateCompanyDomainVerifiedAction(input: {
  companyId: string
  isVerified: boolean
}) {
  const parsedCompanyId = uuidSchema.safeParse(input.companyId)
  if (!parsedCompanyId.success) return { success: false, error: "Invalid company id" }

  const verifiedResult = z.boolean().safeParse(input.isVerified)
  if (!verifiedResult.success) return { success: false, error: "Invalid value" }

  const { supabase, error } = await assertAdmin()
  if (error) return { success: false, error: error.message }

  const { error: updateError } = await supabase
    .from("companies")
    .update({ is_verified: verifiedResult.data })
    .eq("id", parsedCompanyId.data)

  if (updateError) {
    logger.error("admin-professionals", "Failed to update domain verification", {
      companyId: parsedCompanyId.data,
      isVerified: verifiedResult.data,
      error: updateError.message,
    })
    return { success: false, error: updateError.message }
  }

  revalidatePath("/admin/professionals")
  return { success: true }
}

export async function updateCompanyDetailsAction(input: {
  companyId: string
  name: string
  slug: string | null
  logoUrl: string | null
  website: string | null
  contactEmail: string | null
  services: string[]
  primaryServiceId: string | null
}) {
  const parsedCompanyId = uuidSchema.safeParse(input.companyId)
  if (!parsedCompanyId.success) {
    return { success: false, error: "Invalid company id" }
  }

  const nameResult = z.string().min(2).max(150).safeParse(input.name)
  if (!nameResult.success) {
    return { success: false, error: "Company name must be between 2 and 150 characters" }
  }

  const slugResult = z
    .string()
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
    .min(2)
    .max(100)
    .nullable()
    .transform((value) => (value ? value.trim().toLowerCase() : null))
    .safeParse(input.slug && input.slug.length > 0 ? input.slug : null)

  if (!slugResult.success) {
    return { success: false, error: "Slug must contain only lowercase letters, numbers, and hyphens" }
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

  const primaryServiceResult = uuidSchema.nullable().safeParse(input.primaryServiceId)
  if (!primaryServiceResult.success) {
    return { success: false, error: "Invalid primary service id" }
  }

  const { supabase, error } = await assertAdmin()
  if (error) {
    return { success: false, error: error.message }
  }

  const updatePayload = {
    name: nameResult.data,
    slug: slugResult.data,
    logo_url: logoResult.data,
    website: websiteResult.data,
    email: emailResult.data,
    services_offered: servicesResult.data,
    primary_service_id: primaryServiceResult.data,
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

export async function adminDeleteCompanyAction(input: { companyId: string }): Promise<{ success: true } | { success: false; error: string }> {
  const parsedId = uuidSchema.safeParse(input.companyId)
  if (!parsedId.success) {
    return { success: false, error: "Invalid company ID" }
  }

  const { error } = await assertAdmin()
  if (error) {
    return { success: false, error: error.message }
  }

  const companyId = parsedId.data
  const serviceRole = createServiceRoleSupabaseClient()

  // Delete child rows that may not CASCADE or are RLS-restricted
  const { error: ppErr } = await serviceRole
    .from("project_professionals")
    .delete()
    .eq("company_id", companyId)

  if (ppErr) {
    logger.error("admin-delete-company", "Failed to delete project professional links", { companyId, error: ppErr.message })
    return { success: false, error: "Failed to remove company from projects." }
  }

  const { error: photosErr } = await serviceRole
    .from("company_photos")
    .delete()
    .eq("company_id", companyId)

  if (photosErr) {
    logger.error("admin-delete-company", "Failed to delete company photos", { companyId, error: photosErr.message })
    return { success: false, error: "Failed to delete company photos." }
  }

  const { error: linksErr } = await serviceRole
    .from("company_social_links")
    .delete()
    .eq("company_id", companyId)

  if (linksErr) {
    logger.error("admin-delete-company", "Failed to delete company social links", { companyId, error: linksErr.message })
    return { success: false, error: "Failed to delete company social links." }
  }

  // Get owner_id before deleting
  const { data: company } = await serviceRole
    .from("companies")
    .select("owner_id")
    .eq("id", companyId)
    .maybeSingle()

  // Delete company — CASCADE handles: company_members, company_ratings, reviews, saved_companies
  const { error: deleteErr } = await serviceRole
    .from("companies")
    .delete()
    .eq("id", companyId)

  if (deleteErr) {
    logger.error("admin-delete-company", "Failed to delete company", { companyId, error: deleteErr.message })
    return { success: false, error: "Failed to delete company." }
  }

  // Remove "professional" from owner's user_types
  if (company?.owner_id) {
    const { data: profile } = await serviceRole
      .from("profiles")
      .select("user_types")
      .eq("id", company.owner_id)
      .single()

    if (profile?.user_types) {
      const updatedTypes = (profile.user_types as string[]).filter((t) => t !== "professional")
      await serviceRole
        .from("profiles")
        .update({ user_types: updatedTypes })
        .eq("id", company.owner_id)
    }
  }

  revalidatePath("/admin/professionals")
  return { success: true }
}

export async function generateCompanyLoginLinkAction(input: { companyId: string }): Promise<{ success: boolean; loginUrl?: string; error?: string }> {
  const idResult = uuidSchema.safeParse(input.companyId)
  if (!idResult.success) return { success: false, error: "Invalid company ID." }

  const { error } = await assertAdmin()
  if (error) return { success: false, error: "Not authorized." }

  const serviceClient = createServiceRoleSupabaseClient()

  // Find the company owner
  const { data: companyData } = await serviceClient
    .from("companies")
    .select("owner_id")
    .eq("id", idResult.data)
    .maybeSingle()

  if (!companyData?.owner_id) return { success: false, error: "Company has no owner." }

  // Get owner's email
  const userResponse = await serviceClient.auth.admin.getUserById(companyData.owner_id)
  if (userResponse.error || !userResponse.data?.user?.email) {
    return { success: false, error: "Unable to load user account." }
  }

  // Generate magic link
  const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
    type: "magiclink",
    email: userResponse.data.user.email,
  })

  if (linkError || !linkData?.properties?.action_link) {
    return { success: false, error: "Could not generate login link." }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const actionLink = new URL(linkData.properties.action_link)
  const tokenHash = actionLink.searchParams.get("token") ?? linkData.properties.hashed_token

  if (!tokenHash) return { success: false, error: "Could not extract token." }

  const loginUrl = new URL(`${siteUrl}/auth/callback`)
  loginUrl.searchParams.set("token_hash", tokenHash)
  loginUrl.searchParams.set("type", "magiclink")

  return { success: true, loginUrl: loginUrl.toString() }
}
