"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { sendTransactionalEmail } from "@/lib/email-service"
import { logger } from "@/lib/logger"
import { getSiteUrl } from "@/lib/utils"

// ---- Schemas ----

const inviteSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  role: z.enum(["admin", "member"]).default("member"),
})

const changeRoleSchema = z.object({
  memberId: z.string().uuid(),
  role: z.enum(["admin", "member"]),
})

const removeMemberSchema = z.object({
  memberId: z.string().uuid(),
})

// ---- Types ----

type ActionResult = { success: boolean; error?: string }

// ---- Helper ----

async function getCompanyForUser(supabase: ReturnType<typeof createServiceRoleSupabaseClient>, userId: string) {
  const { data: ownedCompany } = await supabase
    .from("companies")
    .select("id, name, logo_url")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (ownedCompany) return { companyId: ownedCompany.id, companyName: ownedCompany.name, companyLogoUrl: ownedCompany.logo_url, isOwner: true, role: "admin" as const }

  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id, role, companies(id, name, logo_url)")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle()

  if (membership?.companies) {
    const company = membership.companies as unknown as { id: string; name: string; logo_url: string | null }
    return { companyId: company.id, companyName: company.name, companyLogoUrl: company.logo_url, isOwner: false, role: membership.role as "admin" | "member" }
  }

  return null
}

// ---- Actions ----

export async function inviteTeamMemberAction(input: z.infer<typeof inviteSchema>): Promise<ActionResult> {
  const parseResult = inviteSchema.safeParse(input)
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.errors.map(e => e.message).join(", ") }
  }

  const { email, role } = parseResult.data
  const supabase = await createServerActionSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "You must be signed in." }

  const serviceClient = createServiceRoleSupabaseClient()
  const companyInfo = await getCompanyForUser(serviceClient, user.id)
  if (!companyInfo) return { success: false, error: "You don't have a company." }
  if (!companyInfo.isOwner && companyInfo.role !== "admin") {
    return { success: false, error: "You don't have permission to invite team members." }
  }

  const emailLower = email.toLowerCase()

  // Check if already a member
  const { data: existing } = await serviceClient
    .from("company_members")
    .select("id, status")
    .eq("company_id", companyInfo.companyId)
    .eq("email", emailLower)
    .maybeSingle()

  if (existing) {
    return {
      success: false,
      error: existing.status === "active"
        ? "This person is already a team member."
        : "This person has already been invited.",
    }
  }

  // Check if invited person already has an Arco account
  const { data: { users } } = await serviceClient.auth.admin.listUsers()
  const existingUser = users?.find(u => u.email?.toLowerCase() === emailLower)

  const { error: insertError } = await serviceClient
    .from("company_members")
    .insert({
      company_id: companyInfo.companyId,
      user_id: existingUser?.id ?? null,
      email: emailLower,
      role,
      status: existingUser ? "active" : "invited",
      invited_by: user.id,
      joined_at: existingUser ? new Date().toISOString() : null,
    })

  if (insertError) {
    logger.db("insert", "company_members", "Failed to invite team member", { email: emailLower }, insertError as any)
    return { success: false, error: "Failed to send invitation." }
  }

  // If user already exists, ensure they have 'professional' in user_types
  if (existingUser) {
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("user_types")
      .eq("id", existingUser.id)
      .maybeSingle()

    const currentTypes = Array.isArray(profile?.user_types) ? profile.user_types : []
    if (!currentTypes.includes("professional")) {
      await serviceClient
        .from("profiles")
        .update({ user_types: [...currentTypes, "professional"] })
        .eq("id", existingUser.id)
    }
  }

  // Send invite email
  const baseUrl = getSiteUrl()
  const confirmUrl = existingUser
    ? `${baseUrl}/dashboard/team`
    : `${baseUrl}/signup?redirectTo=${encodeURIComponent("/dashboard/team")}&inviteEmail=${encodeURIComponent(emailLower)}`

  try {
    await sendTransactionalEmail(
      emailLower,
      "team-invite" as any,
      {
        company_name: companyInfo.companyName,
        company_logo_url: companyInfo.companyLogoUrl ?? undefined,
        confirmUrl,
      },
      // When the invitee already has an Arco account the resolver picks
      // up their preferred_language via the email → auth.users lookup.
      // Otherwise it falls through to the inviting company's country.
      { userId: existingUser?.id ?? null, companyId: companyInfo.companyId },
    )
  } catch (e) {
    console.error("Failed to send team invite email:", e)
  }

  revalidatePath("/dashboard/team")
  return { success: true }
}

export async function changeTeamMemberRoleAction(input: z.infer<typeof changeRoleSchema>): Promise<ActionResult> {
  const parseResult = changeRoleSchema.safeParse(input)
  if (!parseResult.success) return { success: false, error: "Invalid input." }

  const { memberId, role } = parseResult.data
  const supabase = await createServerActionSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Not signed in." }

  const serviceClient = createServiceRoleSupabaseClient()
  const companyInfo = await getCompanyForUser(serviceClient, user.id)
  if (!companyInfo?.isOwner) {
    return { success: false, error: "Only the company owner can change roles." }
  }

  // Prevent changing own role
  const { data: member } = await serviceClient
    .from("company_members")
    .select("user_id")
    .eq("id", memberId)
    .eq("company_id", companyInfo.companyId)
    .single()

  if (!member) return { success: false, error: "Member not found." }
  if (member.user_id === user.id) return { success: false, error: "You cannot change your own role." }

  const { error } = await serviceClient
    .from("company_members")
    .update({ role })
    .eq("id", memberId)
    .eq("company_id", companyInfo.companyId)

  if (error) return { success: false, error: "Failed to update role." }

  revalidatePath("/dashboard/team")
  return { success: true }
}

export async function removeTeamMemberAction(input: z.infer<typeof removeMemberSchema>): Promise<ActionResult> {
  const parseResult = removeMemberSchema.safeParse(input)
  if (!parseResult.success) return { success: false, error: "Invalid input." }

  const { memberId } = parseResult.data
  const supabase = await createServerActionSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Not signed in." }

  const serviceClient = createServiceRoleSupabaseClient()
  const companyInfo = await getCompanyForUser(serviceClient, user.id)
  if (!companyInfo) return { success: false, error: "No company found." }
  if (!companyInfo.isOwner && companyInfo.role !== "admin") {
    return { success: false, error: "You don't have permission to remove members." }
  }

  const { data: member } = await serviceClient
    .from("company_members")
    .select("user_id, role")
    .eq("id", memberId)
    .eq("company_id", companyInfo.companyId)
    .single()

  if (!member) return { success: false, error: "Member not found." }
  if (member.user_id === user.id) return { success: false, error: "You cannot remove yourself." }
  if (!companyInfo.isOwner && member.role === "admin") {
    return { success: false, error: "Only the company owner can remove admins." }
  }

  const { error } = await serviceClient
    .from("company_members")
    .delete()
    .eq("id", memberId)
    .eq("company_id", companyInfo.companyId)

  if (error) return { success: false, error: "Failed to remove member." }

  revalidatePath("/dashboard/team")
  return { success: true }
}

export async function resendTeamInviteAction(memberId: string): Promise<ActionResult> {
  const supabase = await createServerActionSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Not signed in." }

  const serviceClient = createServiceRoleSupabaseClient()
  const companyInfo = await getCompanyForUser(serviceClient, user.id)
  if (!companyInfo) return { success: false, error: "No company found." }

  const { data: member } = await serviceClient
    .from("company_members")
    .select("email, status")
    .eq("id", memberId)
    .eq("company_id", companyInfo.companyId)
    .single()

  if (!member || member.status !== "invited") {
    return { success: false, error: "No pending invitation found." }
  }

  const baseUrl = getSiteUrl()
  const confirmUrl = `${baseUrl}/signup?redirectTo=${encodeURIComponent("/dashboard/team")}&inviteEmail=${encodeURIComponent(member.email)}`

  try {
    await sendTransactionalEmail(
      member.email,
      "team-invite" as any,
      {
        company_name: companyInfo.companyName,
        company_logo_url: companyInfo.companyLogoUrl ?? undefined,
        confirmUrl,
      },
      // Resolver will find an Arco account via email if one exists,
      // else fall back to the inviting company's country.
      { companyId: companyInfo.companyId },
    )
  } catch (e) {
    console.error("Failed to resend team invite email:", e)
    return { success: false, error: "Failed to send email." }
  }

  return { success: true }
}

export async function claimPendingTeamInvitesAction(userId: string): Promise<{ claimedCount: number }> {
  const serviceClient = createServiceRoleSupabaseClient()

  const { data: authUser } = await serviceClient.auth.admin.getUserById(userId)
  if (!authUser?.user?.email) return { claimedCount: 0 }

  const userEmail = authUser.user.email.toLowerCase()

  const { data: claimed, error } = await serviceClient
    .from("company_members")
    .update({
      user_id: userId,
      status: "active",
      joined_at: new Date().toISOString(),
    })
    .eq("email", userEmail)
    .eq("status", "invited")
    .is("user_id", null)
    .select("id, company_id")

  if (error) {
    logger.db("update", "company_members", "Failed to claim team invites", { userId }, error as any)
    return { claimedCount: 0 }
  }

  // Ensure user has 'professional' in user_types
  if (claimed && claimed.length > 0) {
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("user_types")
      .eq("id", userId)
      .maybeSingle()

    const currentTypes = Array.isArray(profile?.user_types) ? profile.user_types : []
    if (!currentTypes.includes("professional")) {
      await serviceClient
        .from("profiles")
        .update({ user_types: [...currentTypes, "professional"] })
        .eq("id", userId)
    }
  }

  return { claimedCount: claimed?.length ?? 0 }
}
