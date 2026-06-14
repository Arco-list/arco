"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { sendTransactionalEmail } from "@/lib/email-service"
import { logger } from "@/lib/logger"
import { getSiteUrl } from "@/lib/utils"

// Team-page actions operate on `company_contacts` + `persons`. The dual-
// write to legacy `company_members` was removed once that table was
// retired (see migration 178).

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

type CompanyInfo = {
  companyId: string
  companyName: string
  companyLogoUrl: string | null
  isOwner: boolean
  role: "admin" | "member"
}

async function getCompanyForUser(
  supabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  userId: string,
): Promise<CompanyInfo | null> {
  const { data: ownedCompany } = await supabase
    .from("companies")
    .select("id, name, logo_url")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (ownedCompany) {
    return {
      companyId: ownedCompany.id,
      companyName: ownedCompany.name,
      companyLogoUrl: ownedCompany.logo_url,
      isOwner: true,
      role: "admin",
    }
  }

  // Team membership lookup goes through company_contacts now.
  const { data: contact } = await supabase
    .from("company_contacts")
    .select("role, company:companies(id, name, logo_url), person:persons!inner(auth_user_id)")
    .eq("person.auth_user_id", userId)
    .in("role", ["admin", "member"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  const co = contact?.company as unknown as { id: string; name: string; logo_url: string | null } | null
  if (co) {
    return {
      companyId: co.id,
      companyName: co.name,
      companyLogoUrl: co.logo_url,
      isOwner: false,
      role: (contact?.role === "admin" ? "admin" : "member"),
    }
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

  // Resolve / create the person record for this email. Source='invited'
  // captures how the person entered the system. If the email already
  // matches a person we reuse it (no second person, no duplicate identity).
  const { data: existingPerson } = await serviceClient
    .from("persons")
    .select("id, auth_user_id")
    .eq("email", emailLower)
    .maybeSingle()

  let personId: string
  let personAuthUserId: string | null = null
  if (existingPerson) {
    personId = existingPerson.id
    personAuthUserId = existingPerson.auth_user_id
  } else {
    const { data: created, error: personError } = await serviceClient
      .from("persons")
      .insert({ email: emailLower, source: "invited" })
      .select("id, auth_user_id")
      .single()
    if (personError || !created) {
      logger.db("insert", "persons", "Failed to create invited person", { email: emailLower }, personError as any)
      return { success: false, error: "Failed to send invitation." }
    }
    personId = created.id
    personAuthUserId = created.auth_user_id
  }

  // Reject duplicate team-role link at this company.
  const { data: existingContact } = await serviceClient
    .from("company_contacts")
    .select("id, role, status")
    .eq("company_id", companyInfo.companyId)
    .eq("person_id", personId)
    .maybeSingle()

  if (existingContact && ["owner", "admin", "member"].includes(existingContact.role)) {
    return {
      success: false,
      error: existingContact.status === "active"
        ? "This person is already a team member."
        : "This person has already been invited.",
    }
  }

  // If a non-team contact (lead) already exists, promote it. Otherwise insert.
  const status = personAuthUserId ? "active" : "invited"
  if (existingContact) {
    const { error: upgradeError } = await serviceClient
      .from("company_contacts")
      .update({ role, status, invited_at: new Date().toISOString(), invited_by: user.id })
      .eq("id", existingContact.id)
    if (upgradeError) {
      logger.db("update", "company_contacts", "Failed to promote contact to team", { contactId: existingContact.id }, upgradeError as any)
      return { success: false, error: "Failed to send invitation." }
    }
  } else {
    const { error: insertError } = await serviceClient
      .from("company_contacts")
      .insert({
        company_id: companyInfo.companyId,
        person_id: personId,
        role,
        status,
        invited_at: new Date().toISOString(),
        invited_by: user.id,
        joined_at: personAuthUserId ? new Date().toISOString() : null,
      })
    if (insertError) {
      logger.db("insert", "company_contacts", "Failed to invite team member", { email: emailLower }, insertError as any)
      return { success: false, error: "Failed to send invitation." }
    }
  }

  // Ensure existing user has 'professional' in user_types
  if (personAuthUserId) {
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("user_types")
      .eq("id", personAuthUserId)
      .maybeSingle()

    const currentTypes = Array.isArray(profile?.user_types) ? profile.user_types : []
    if (!currentTypes.includes("professional")) {
      await serviceClient
        .from("profiles")
        .update({ user_types: [...currentTypes, "professional"] })
        .eq("id", personAuthUserId)
    }
  }

  // Send invite email
  const baseUrl = getSiteUrl()
  const confirmUrl = personAuthUserId
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
      { userId: personAuthUserId ?? null, companyId: companyInfo.companyId },
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

  // memberId is a company_contacts.id.
  const { data: contact } = await serviceClient
    .from("company_contacts")
    .select("id, company_id, role, person:persons(id, email, auth_user_id)")
    .eq("id", memberId)
    .eq("company_id", companyInfo.companyId)
    .single()

  if (!contact) return { success: false, error: "Member not found." }
  if ((contact.person as any)?.auth_user_id === user.id) {
    return { success: false, error: "You cannot change your own role." }
  }
  if (contact.role === "owner") {
    return { success: false, error: "Cannot change owner role here — transfer ownership instead." }
  }

  const { error } = await serviceClient
    .from("company_contacts")
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

  const { data: contact } = await serviceClient
    .from("company_contacts")
    .select("id, role, person:persons(id, email, auth_user_id)")
    .eq("id", memberId)
    .eq("company_id", companyInfo.companyId)
    .single()

  if (!contact) return { success: false, error: "Member not found." }
  if ((contact.person as any)?.auth_user_id === user.id) {
    return { success: false, error: "You cannot remove yourself." }
  }
  if (contact.role === "owner") {
    return { success: false, error: "Cannot remove the company owner." }
  }
  if (!companyInfo.isOwner && contact.role === "admin") {
    return { success: false, error: "Only the company owner can remove admins." }
  }

  const { error } = await serviceClient
    .from("company_contacts")
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

  const { data: contact } = await serviceClient
    .from("company_contacts")
    .select("status, person:persons(email)")
    .eq("id", memberId)
    .eq("company_id", companyInfo.companyId)
    .single()

  if (!contact || contact.status !== "invited") {
    return { success: false, error: "No pending invitation found." }
  }

  const personEmail = (contact.person as any)?.email as string | undefined
  if (!personEmail) return { success: false, error: "Contact has no email." }

  const baseUrl = getSiteUrl()
  const confirmUrl = `${baseUrl}/signup?redirectTo=${encodeURIComponent("/dashboard/team")}&inviteEmail=${encodeURIComponent(personEmail)}`

  try {
    await sendTransactionalEmail(
      personEmail,
      "team-invite" as any,
      {
        company_name: companyInfo.companyName,
        company_logo_url: companyInfo.companyLogoUrl ?? undefined,
        confirmUrl,
      },
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

  // Link the person row to the auth.users id (if not already linked).
  const { data: person } = await serviceClient
    .from("persons")
    .select("id, auth_user_id")
    .eq("email", userEmail)
    .maybeSingle()

  if (!person) return { claimedCount: 0 }

  if (!person.auth_user_id) {
    await serviceClient
      .from("persons")
      .update({ auth_user_id: userId })
      .eq("id", person.id)
  }

  // Flip pending team invites to active.
  const { data: claimed, error } = await serviceClient
    .from("company_contacts")
    .update({ status: "active", joined_at: new Date().toISOString() })
    .eq("person_id", person.id)
    .in("role", ["admin", "member"])
    .eq("status", "invited")
    .select("id, company_id")

  if (error) {
    logger.db("update", "company_contacts", "Failed to claim team invites", { userId }, error as any)
    return { claimedCount: 0 }
  }

  // Ensure 'professional' user_type for the now-active team member.
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
