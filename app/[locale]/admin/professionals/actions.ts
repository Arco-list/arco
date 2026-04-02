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

const companyStatusSchema = z.enum(["unlisted", "listed", "deactivated", "draft", "prospected"])
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

  // Get invite details
  const { data: invite } = await supabase
    .from("project_professionals")
    .select("invited_email, project_id")
    .eq("id", idResult.data)
    .single()

  if (!invite?.invited_email || !invite?.project_id) {
    return { success: false, error: "Invite not found" }
  }

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

  // Send the actual email
  try {
    const { data: project } = await supabase
      .from("projects")
      .select("title, slug, address_city, location, building_type, project_type, client_id, profiles!client_id(first_name, last_name)")
      .eq("id", invite.project_id)
      .single()

    const { data: photo } = await supabase
      .from("project_photos")
      .select("url")
      .eq("project_id", invite.project_id)
      .order("order_index", { ascending: true })
      .limit(1)
      .maybeSingle()

    const ownerName = [project?.profiles?.first_name, project?.profiles?.last_name].filter(Boolean).join(" ") || "An architect"
    const { checkUserAndGenerateInviteUrl } = await import("@/app/new-project/actions")
    const { confirmUrl } = await checkUserAndGenerateInviteUrl(invite.invited_email, invite.project_id)
    const { getSiteUrl } = await import("@/lib/utils")
    const baseUrl = getSiteUrl()

    // Get owner company name
    const { data: ownerPP } = await supabase
      .from("project_professionals")
      .select("company_id")
      .eq("project_id", invite.project_id)
      .eq("is_project_owner", true)
      .maybeSingle()
    const { data: ownerCompany } = ownerPP?.company_id
      ? await supabase.from("companies").select("name").eq("id", ownerPP.company_id).maybeSingle()
      : { data: null }

    const { sendProfessionalInviteEmail } = await import("@/lib/email-service")
    await sendProfessionalInviteEmail(invite.invited_email, {
      project_owner: ownerName,
      company_name: ownerCompany?.name ?? undefined,
      project_name: project?.title || "Project",
      project_title: project?.title || "Project",
      project_image: photo?.url ?? undefined,
      project_type: (project as any)?.building_type ?? (project as any)?.project_type ?? undefined,
      project_location: (project as any)?.address_city ?? (project as any)?.location ?? undefined,
      project_link: `${baseUrl}/projects/${(project as any)?.slug ?? invite.project_id}`,
      confirmUrl,
    })
  } catch (err) {
    logger.error("admin-professionals", "Failed to send invite email", { inviteId: idResult.data }, err as Error)
  }

  revalidatePath("/admin/professionals")

  return { success: true }
}

export async function adminDeleteInviteAction(input: { email: string }): Promise<{ success: true } | { success: false; error: string }> {
  const email = input.email?.trim().toLowerCase()
  if (!email) return { success: false, error: "Email is required" }

  const { error } = await assertAdmin()
  if (error) return { success: false, error: error.message }

  const serviceRole = createServiceRoleSupabaseClient()

  const { error: deleteErr } = await serviceRole
    .from("project_professionals")
    .delete()
    .eq("invited_email", email)
    .is("professional_id", null)

  if (deleteErr) {
    logger.error("admin-delete-invite", "Failed to delete invite rows", { email, error: deleteErr.message })
    return { success: false, error: "Failed to delete invite." }
  }

  revalidatePath("/", "layout")
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

  // Sync company status to Apollo account stage
  try {
    const { syncCompanyToApollo } = await import('@/lib/company-apollo-sync')
    await syncCompanyToApollo(parsedCompanyId.data)
  } catch (err) {
    logger.error("admin-professionals", "Failed to sync company to Apollo", { companyId: parsedCompanyId.data }, err as Error)
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
  await serviceRole.from("professionals").delete().eq("company_id", companyId)

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

  await serviceRole.from("saved_companies").delete().eq("company_id", companyId)
  await serviceRole.from("reviews").delete().eq("company_id", companyId)

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

export async function changeCompanyOwnerAction(input: {
  companyId: string
  newOwnerEmail: string
}): Promise<{ success: boolean; error?: string }> {
  const idResult = uuidSchema.safeParse(input.companyId)
  if (!idResult.success) return { success: false, error: "Invalid company ID." }

  const email = input.newOwnerEmail.trim().toLowerCase()
  if (!email) return { success: false, error: "Email is required." }

  const { error } = await assertAdmin()
  if (error) return { success: false, error: "Not authorized." }

  const serviceClient = createServiceRoleSupabaseClient()

  // Find user by email — search across all pages
  let targetUser: { id: string; email?: string } | null = null
  let page = 1
  const perPage = 100
  while (!targetUser) {
    const { data: { users }, error: listError } = await serviceClient.auth.admin.listUsers({ page, perPage })
    if (listError) return { success: false, error: "Failed to look up users." }
    if (!users || users.length === 0) break
    const found = users.find(u => u.email?.toLowerCase() === email)
    if (found) { targetUser = found; break }
    if (users.length < perPage) break
    page++
  }
  if (!targetUser) return { success: false, error: `No user found with email ${email}.` }

  // Update company owner
  const { error: updateError } = await serviceClient
    .from("companies")
    .update({ owner_id: targetUser.id })
    .eq("id", idResult.data)

  if (updateError) {
    logger.db("update", "companies", "Failed to change owner", { companyId: idResult.data }, updateError)
    return { success: false, error: "Failed to update company owner." }
  }

  // Ensure user has professional role
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("user_types")
    .eq("id", targetUser.id)
    .maybeSingle()

  const currentTypes = Array.isArray(profile?.user_types) ? profile.user_types as string[] : []
  if (!currentTypes.includes("professional")) {
    await serviceClient
      .from("profiles")
      .update({ user_types: [...currentTypes, "professional"] })
      .eq("id", targetUser.id)
  }

  // Ensure professional/team member row exists for this company
  const { data: existingPro } = await serviceClient
    .from("professionals")
    .select("id")
    .eq("user_id", targetUser.id)
    .eq("company_id", idResult.data)
    .maybeSingle()

  if (!existingPro) {
    const { data: company } = await serviceClient
      .from("companies")
      .select("name")
      .eq("id", idResult.data)
      .maybeSingle()

    await serviceClient.from("professionals").insert({
      user_id: targetUser.id,
      company_id: idResult.data,
      title: company?.name ?? "Team member",
    })
  }

  revalidatePath("/", "layout")
  return { success: true }
}

// ─── Prospect outreach ──────────────────────────────────────────────────────

export async function sendProspectEmailAction(input: {
  companyId: string
  emailTo: string
}): Promise<{ success: boolean; error?: string }> {
  const { supabase, user, error } = await assertAdmin()
  if (error) return { success: false, error: error.message }

  const idResult = uuidSchema.safeParse(input.companyId)
  if (!idResult.success) return { success: false, error: "Invalid company ID" }

  const emailResult = z.string().email().safeParse(input.emailTo)
  if (!emailResult.success) return { success: false, error: "Invalid email address" }

  // Fetch company details
  const serviceClient = createServiceRoleSupabaseClient()
  const { data: company } = await serviceClient
    .from("companies")
    .select("id, name, slug, email, hero_photo_url, logo_url, city, country, owner_id, primary_service:categories!companies_primary_service_id_fkey(name)")
    .eq("id", idResult.data)
    .single()

  if (!company) return { success: false, error: "Company not found" }
  if (company.owner_id) return { success: false, error: "Company already has an owner" }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.arcolist.com"
  const companyPageUrl = `${siteUrl}/professionals/${company.slug}`
  const claimUrl = `${siteUrl}/businesses/professionals?inviteEmail=${encodeURIComponent(emailResult.data)}`
  const serviceName = (company.primary_service as any)?.name ?? null
  const locationParts = [serviceName, company.city].filter(Boolean)

  // Send email via Resend
  const { sendTransactionalEmail } = await import("@/lib/email-service")
  const sendResult = await sendTransactionalEmail(emailResult.data, "prospect-intro", {
    company_name: company.name,
    company_page_url: companyPageUrl,
    claim_url: claimUrl,
    hero_image_url: company.hero_photo_url ?? undefined,
    logo_url: company.logo_url ?? undefined,
    company_subtitle: locationParts.join(" · ") || undefined,
  })

  if (!sendResult.success) {
    return { success: false, error: sendResult.message ?? "Failed to send email" }
  }

  // Track in company_outreach
  await serviceClient.from("company_outreach" as any).insert({
    company_id: company.id,
    email_to: emailResult.data,
    template: "prospect_intro",
  })

  // Update company status to prospected (only if no owner)
  await serviceClient
    .from("companies")
    .update({ status: "prospected" } as any)
    .eq("id", company.id)
    .is("owner_id", null)

  logger.info("admin-professionals", "Prospect email sent", {
    companyId: company.id,
    emailTo: emailResult.data,
    adminId: user!.id,
  })

  revalidatePath("/", "layout")
  return { success: true }
}

export async function updateCompanyEmailAction(input: {
  companyId: string
  email: string
}): Promise<{ success: boolean; error?: string }> {
  const { error } = await assertAdmin()
  if (error) return { success: false, error: error.message }

  const idResult = uuidSchema.safeParse(input.companyId)
  if (!idResult.success) return { success: false, error: "Invalid company ID" }

  const emailValidation = z.string().email().safeParse(input.email)
  if (!emailValidation.success) return { success: false, error: "Invalid email address" }

  const serviceClient = createServiceRoleSupabaseClient()
  const { error: updateError } = await serviceClient
    .from("companies")
    .update({ email: emailValidation.data })
    .eq("id", idResult.data)

  if (updateError) return { success: false, error: updateError.message }

  revalidatePath("/", "layout")
  return { success: true }
}
