"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { ensureAdminUserTypes, isSuperAdminUser } from "@/lib/auth-utils"
import { logger } from "@/lib/logger"
import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"

type ActionResult<T = void> =
  | {
      success: true
      data?: T
    }
  | {
      success: false
      error: string
    }

const inviteAdminSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "super_admin"]),
})

const roleChangeSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "super_admin"]),
})

const statusToggleSchema = z.object({
  userId: z.string().uuid(),
  active: z.boolean(),
})

const resetSchema = z.object({
  userId: z.string().uuid(),
})

const deleteUserSchema = z.object({
  userId: z.string().uuid(),
})

type DeletionCheckResult = {
  canDelete: boolean
  userType: "client" | "professional" | "both"
  ownsCompany: boolean
  companyName?: string
  companyId?: string
  otherProfessionalsInCompany?: number
  projectsLinkedToCompany?: number
  relatedData: {
    projects?: number
    reviews?: number
    messages?: number
    savedItems?: number
  }
  warnings: string[]
  blockers: string[]
}

async function assertSuperAdmin() {
  const supabase = await createServerActionSupabaseClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    logger.security("admin-auth", "Super admin authentication failed", {
      authError: authError?.message,
      hasUser: !!user,
    })
    return { supabase, user: null, profile: null, error: authError ?? new Error("Not authenticated") }
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, admin_role, user_types, is_active")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError || !profile || profile.is_active === false || !isSuperAdminUser(profile.admin_role)) {
    logger.security("admin-auth", "Super admin authorization failed", {
      userId: user.id,
      adminRole: profile?.admin_role,
      isActive: profile?.is_active,
      error: profileError?.message,
    })
    return {
      supabase,
      user,
      profile,
      error: profileError ?? new Error("Unauthorized"),
    }
  }

  return { supabase, user, profile, error: null }
}

export async function inviteAdminUserAction(input: { email: string; role: "admin" | "super_admin" }): Promise<ActionResult> {
  const parsed = inviteAdminSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: "Provide a valid email and role." }
  }

  const { user: currentUser, error } = await assertSuperAdmin()
  if (error || !currentUser) {
    return { success: false, error: "You are not authorized to invite admins." }
  }

  const serviceClient = createServiceRoleSupabaseClient()
  const invitedAt = new Date().toISOString()

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)

  if (!siteUrl) {
    logger.warn("admin-invite", "Missing NEXT_PUBLIC_SITE_URL environment variable for invite redirect")
    return { success: false, error: "Server configuration error. Contact support." }
  }

  const onboardingPath = `/auth/admin-onboarding?redirectTo=/admin/users&email=${encodeURIComponent(parsed.data.email)}`
  const inviteRedirectUrl = new URL("/auth/invite-callback", siteUrl)
  inviteRedirectUrl.searchParams.set("redirectTo", onboardingPath)
  inviteRedirectUrl.searchParams.set("invite", "admin")
  inviteRedirectUrl.searchParams.set("email", parsed.data.email)

  const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: {
      admin_role: parsed.data.role,
      user_types: ["admin"],
      invited_by: currentUser.id,
      invited_at: invitedAt,
      invite_type: "admin",
    },
    redirectTo: inviteRedirectUrl.toString(),
  })

  if (inviteError) {
    logger.auth("admin-invite", "Failed to invite admin user", {
      invitedEmail: parsed.data.email,
      invitedRole: parsed.data.role,
      inviterId: currentUser.id,
    }, inviteError)
    return { success: false, error: inviteError.message }
  }

  const invitedUserId = inviteData?.user?.id ?? null

  if (invitedUserId) {
    const { data: updatedProfile, error: profileUpdateError } = await serviceClient
      .from("profiles")
      .update({
        admin_role: parsed.data.role,
        invited_by: currentUser.id,
        invited_at: invitedAt,
        user_types: ["admin"],
      })
      .eq("id", invitedUserId)
      .select("id")
      .maybeSingle()

    if (profileUpdateError || !updatedProfile) {
      logger.db(
        "update",
        "profiles",
        "Failed to update profile metadata after admin invite",
        { invitedUserId, invitedRole: parsed.data.role },
        profileUpdateError ?? new Error("Profile update returned no rows"),
      )
      return {
        success: false,
        error: "Invite email sent, but we could not finalise the profile. Please resend or contact support.",
      }
    }
  }

  revalidatePath("/admin/users")
  return { success: true }
}

export async function changeAdminRoleAction(input: { userId: string; role: "admin" | "super_admin" }): Promise<ActionResult> {
  const parsed = roleChangeSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: "Invalid admin role change payload." }
  }

  const { user: currentUser, error } = await assertSuperAdmin()
  if (error || !currentUser) {
    return { success: false, error: "You are not authorized to update admin roles." }
  }

  const serviceClient = createServiceRoleSupabaseClient()

  const [{ data: targetProfile, error: profileError }, userResponse, { data: superAdmins, error: countError }] =
    await Promise.all([
      serviceClient
        .from("profiles")
        .select("id, admin_role, user_types, is_active")
        .eq("id", parsed.data.userId)
        .maybeSingle(),
      serviceClient.auth.admin.getUserById(parsed.data.userId),
      serviceClient
        .from("profiles")
        .select("id, is_active")
        .eq("admin_role", "super_admin"),
    ])

  if (profileError || !targetProfile) {
    logger.db("select", "profiles", "Failed to load admin profile for role change", {
      targetAdminId: parsed.data.userId,
    }, profileError ?? new Error("Profile not found"))
    return { success: false, error: "Unable to load admin profile." }
  }

  const targetUser = userResponse.data?.user ?? null
  if (userResponse.error || !targetUser) {
    logger.auth("admin-role-change", "Failed to load auth user for role change", {
      targetAdminId: parsed.data.userId,
    }, userResponse.error ?? new Error("Auth user not found"))
    return { success: false, error: "Unable to load admin account." }
  }

  if (countError) {
    logger.db(
      "select",
      "profiles",
      "Failed to count current super admins during role change",
      { targetAdminId: parsed.data.userId },
      countError,
    )
  }

  const activeSuperAdminsCount = superAdmins?.filter((profile) => profile.is_active !== false).length ?? 0

  const targetIsSuperAdmin = targetProfile.admin_role === "super_admin"
  const demotingSuperAdmin = targetIsSuperAdmin && parsed.data.role !== "super_admin"

  const remainingActiveSuperAdmins =
    demotingSuperAdmin && targetProfile.is_active !== false ? activeSuperAdminsCount - 1 : activeSuperAdminsCount

  if (demotingSuperAdmin && remainingActiveSuperAdmins <= 0) {
    return { success: false, error: "Cannot demote the last active super admin." }
  }

  const nextUserTypes = ensureAdminUserTypes(targetProfile.user_types)

  const { error: profileUpdateError } = await serviceClient
    .from("profiles")
    .update({
      admin_role: parsed.data.role,
      user_types: nextUserTypes,
    })
    .eq("id", parsed.data.userId)

  if (profileUpdateError) {
    logger.db(
      "update",
      "profiles",
      "Failed to update profile during admin role change",
      { targetAdminId: parsed.data.userId, nextRole: parsed.data.role },
      profileUpdateError,
    )
    return { success: false, error: "Failed to update admin role." }
  }

  const metadata = {
    ...(targetUser.user_metadata ?? {}),
    admin_role: parsed.data.role,
    user_types: nextUserTypes,
  }

  const { error: authUpdateError } = await serviceClient.auth.admin.updateUserById(parsed.data.userId, {
    user_metadata: metadata,
  })

  if (authUpdateError) {
    const { error: revertError } = await serviceClient
      .from("profiles")
      .update({
        admin_role: targetProfile.admin_role,
        user_types: targetProfile.user_types,
      })
      .eq("id", parsed.data.userId)

    if (revertError) {
      logger.db(
        "update",
        "profiles",
        "Failed to revert admin role after auth metadata sync error",
        { targetAdminId: parsed.data.userId },
        revertError,
      )
    }

    logger.auth(
      "admin-role-change",
      "Failed to update auth metadata after role change",
      { targetAdminId: parsed.data.userId, nextRole: parsed.data.role },
      authUpdateError,
    )
    return { success: false, error: "Failed to sync authentication metadata. The admin role change was not applied." }
  }

  revalidatePath("/admin/users")
  return { success: true }
}

export async function toggleAdminStatusAction(input: { userId: string; active: boolean }): Promise<ActionResult> {
  const parsed = statusToggleSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: "Invalid status toggle payload." }
  }

  const { user: currentUser, error } = await assertSuperAdmin()
  if (error || !currentUser) {
    return { success: false, error: "You are not authorized to update admin status." }
  }

  if (parsed.data.userId === currentUser.id && !parsed.data.active) {
    return { success: false, error: "You cannot deactivate your own account." }
  }

  const serviceClient = createServiceRoleSupabaseClient()

  const [{ data: targetProfile, error: profileError }, userResponse, { data: superAdmins, error: countError }] =
    await Promise.all([
      serviceClient
        .from("profiles")
        .select("id, admin_role, user_types, is_active")
        .eq("id", parsed.data.userId)
        .maybeSingle(),
      serviceClient.auth.admin.getUserById(parsed.data.userId),
      serviceClient
        .from("profiles")
        .select("id, is_active")
        .eq("admin_role", "super_admin"),
    ])

  if (profileError || !targetProfile) {
    logger.db("select", "profiles", "Failed to load admin profile for status change", {
      targetAdminId: parsed.data.userId,
    }, profileError ?? new Error("Profile not found"))
    return { success: false, error: "Unable to load admin profile." }
  }

  const targetUser = userResponse.data?.user ?? null
  if (userResponse.error || !targetUser) {
    logger.auth("admin-status-change", "Failed to load auth user for status change", {
      targetAdminId: parsed.data.userId,
    }, userResponse.error ?? new Error("Auth user not found"))
    return { success: false, error: "Unable to load admin account." }
  }

  if (countError) {
    logger.db(
      "select",
      "profiles",
      "Failed to count super admins during status toggle",
      { targetAdminId: parsed.data.userId },
      countError,
    )
  }

  const activeSuperAdminsCount =
    superAdmins?.filter((profile) => profile.is_active !== false && profile.id !== parsed.data.userId).length ?? 0

  const targetIsSuperAdmin = targetProfile.admin_role === "super_admin"

  if (!parsed.data.active && targetIsSuperAdmin && activeSuperAdminsCount === 0) {
    return { success: false, error: "Cannot deactivate the last active super admin." }
  }

  const nextUserTypes = ensureAdminUserTypes(targetProfile.user_types)

  const { error: profileUpdateError } = await serviceClient
    .from("profiles")
    .update({
      is_active: parsed.data.active,
      user_types: nextUserTypes,
    })
    .eq("id", parsed.data.userId)

  if (profileUpdateError) {
    logger.db(
      "update",
      "profiles",
      "Failed to update profile during admin status change",
      { targetAdminId: parsed.data.userId, nextActive: parsed.data.active },
      profileUpdateError,
    )
    return { success: false, error: "Failed to update admin status." }
  }

  const banDuration = parsed.data.active ? "none" : "87600h" // Supabase supports Go duration strings; use 10 years as a soft "forever"

  const { error: authUpdateError } = await serviceClient.auth.admin.updateUserById(parsed.data.userId, {
    ban_duration: banDuration,
    user_metadata: {
      ...(targetUser.user_metadata ?? {}),
      admin_role: targetProfile.admin_role ?? "admin",
      user_types: nextUserTypes,
    },
  })

  if (authUpdateError) {
    const { error: revertError } = await serviceClient
      .from("profiles")
      .update({
        is_active: targetProfile.is_active,
      })
      .eq("id", parsed.data.userId)

    if (revertError) {
      logger.db(
        "update",
        "profiles",
        "Failed to revert admin status after auth sync error",
        { targetAdminId: parsed.data.userId },
        revertError,
      )
    }

    logger.auth(
      "admin-status-change",
      "Failed to update authentication status during admin toggle",
      { targetAdminId: parsed.data.userId, nextActive: parsed.data.active },
      authUpdateError,
    )
    return { success: false, error: "Failed to sync authentication metadata. The admin status change was not applied." }
  }

  revalidatePath("/admin/users")
  return { success: true }
}

export async function generateAdminResetPasswordAction(input: { userId: string }): Promise<ActionResult> {
  const parsed = resetSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: "Invalid reset request." }
  }

  const { error } = await assertSuperAdmin()
  if (error) {
    return { success: false, error: "You are not authorized to reset admin passwords." }
  }

  const serviceClient = createServiceRoleSupabaseClient()
  const userResponse = await serviceClient.auth.admin.getUserById(parsed.data.userId)

  if (userResponse.error || !userResponse.data?.user?.email) {
    logger.auth(
      "admin-reset-password",
      "Failed to load auth user for reset password",
      { targetAdminId: parsed.data.userId },
      userResponse.error ?? new Error("Auth user not found"),
    )
    return { success: false, error: "Unable to load admin account." }
  }

  const targetEmail = userResponse.data.user.email

  const { error: linkError } = await serviceClient.auth.admin.generateLink({
    type: "recovery",
    email: targetEmail,
  })

  if (linkError) {
    logger.auth(
      "admin-reset-password",
      "Failed to generate password reset link for admin",
      { targetAdminId: parsed.data.userId },
      linkError ?? new Error("Reset link not generated"),
    )
    return { success: false, error: "Could not generate reset password link." }
  }

  return { success: true }
}

export async function checkUserDeletionAction(input: { userId: string }): Promise<ActionResult<DeletionCheckResult>> {
  const parsed = deleteUserSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: "Invalid user ID." }
  }

  const { error } = await assertSuperAdmin()
  if (error) {
    return { success: false, error: "You are not authorized to delete users." }
  }

  const serviceClient = createServiceRoleSupabaseClient()

  // Get user profile
  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("id, first_name, last_name, user_types")
    .eq("id", parsed.data.userId)
    .maybeSingle()

  if (profileError || !profile) {
    logger.db("select", "profiles", "Failed to load profile for deletion check", {
      userId: parsed.data.userId,
    }, profileError ?? new Error("Profile not found"))
    return { success: false, error: "Unable to load user profile." }
  }

  const isProfessional = profile.user_types.includes("professional")
  const isClient = profile.user_types.includes("client")
  const userType = isProfessional && isClient ? "both" : isProfessional ? "professional" : "client"

  const warnings: string[] = []
  const blockers: string[] = []
  const relatedData: DeletionCheckResult["relatedData"] = {}

  // Check for client-related data
  if (isClient) {
    const [projectsCount, reviewsCount, messagesCount, savedItemsCount] = await Promise.all([
      serviceClient.from("projects").select("id", { count: "exact", head: true }).eq("client_id", parsed.data.userId),
      serviceClient.from("reviews").select("id", { count: "exact", head: true }).eq("reviewer_id", parsed.data.userId),
      serviceClient.from("messages").select("id", { count: "exact", head: true }).or(`sender_id.eq.${parsed.data.userId},recipient_id.eq.${parsed.data.userId}`),
      Promise.all([
        serviceClient.from("saved_projects").select("user_id", { count: "exact", head: true }).eq("user_id", parsed.data.userId),
        serviceClient.from("saved_companies").select("user_id", { count: "exact", head: true }).eq("user_id", parsed.data.userId),
      ]).then(results => {
        const total = (results[0].count ?? 0) + (results[1].count ?? 0)
        return { count: total }
      })
    ])

    relatedData.projects = projectsCount.count ?? 0
    relatedData.reviews = reviewsCount.count ?? 0
    relatedData.messages = messagesCount.count ?? 0
    relatedData.savedItems = savedItemsCount.count ?? 0

    if (relatedData.projects > 0) {
      warnings.push(`${relatedData.projects} project${relatedData.projects === 1 ? "" : "s"} will be deleted`)
    }
    if (relatedData.reviews > 0) {
      warnings.push(`${relatedData.reviews} review${relatedData.reviews === 1 ? "" : "s"} will be deleted`)
    }
    if (relatedData.messages > 0) {
      warnings.push(`${relatedData.messages} message${relatedData.messages === 1 ? "" : "s"} will be deleted`)
    }
  }

  let ownsCompany = false
  let companyName: string | undefined
  let companyId: string | undefined
  let otherProfessionalsInCompany = 0
  let projectsLinkedToCompany = 0

  // Check for professional-related data
  if (isProfessional) {
    // Get professional record
    const { data: professional, error: professionalError } = await serviceClient
      .from("professionals")
      .select("id, company_id")
      .eq("user_id", parsed.data.userId)
      .maybeSingle()

    if (professional?.company_id) {
      // Check if user owns the company
      const { data: company, error: companyError } = await serviceClient
        .from("companies")
        .select("id, name, owner_id")
        .eq("id", professional.company_id)
        .maybeSingle()

      if (company && company.owner_id === parsed.data.userId) {
        ownsCompany = true
        companyName = company.name
        companyId = company.id

        // Count other professionals in the company
        const { count: profCount } = await serviceClient
          .from("professionals")
          .select("id", { count: "exact", head: true })
          .eq("company_id", company.id)
          .neq("user_id", parsed.data.userId)

        otherProfessionalsInCompany = profCount ?? 0

        // Count projects linked to the company
        const { count: projCount } = await serviceClient
          .from("project_professionals")
          .select("id", { count: "exact", head: true })
          .eq("company_id", company.id)

        projectsLinkedToCompany = projCount ?? 0

        // Add blockers if company has dependencies
        if (otherProfessionalsInCompany > 0) {
          blockers.push(
            `User owns company "${companyName}" with ${otherProfessionalsInCompany} other professional${otherProfessionalsInCompany === 1 ? "" : "s"}. Transfer ownership or remove them first.`
          )
        }
        if (projectsLinkedToCompany > 0) {
          blockers.push(
            `Company "${companyName}" is linked to ${projectsLinkedToCompany} project${projectsLinkedToCompany === 1 ? "" : "s"}. Remove these links first.`
          )
        }

        if (otherProfessionalsInCompany === 0 && projectsLinkedToCompany > 0) {
          warnings.push(`Company "${companyName}" will be deleted along with ${projectsLinkedToCompany} project link${projectsLinkedToCompany === 1 ? "" : "s"}`)
        } else if (otherProfessionalsInCompany === 0 && projectsLinkedToCompany === 0) {
          warnings.push(`Company "${companyName}" will be deleted`)
        }
      }
    }
  }

  const canDelete = blockers.length === 0

  return {
    success: true,
    data: {
      canDelete,
      userType,
      ownsCompany,
      companyName,
      companyId,
      otherProfessionalsInCompany,
      projectsLinkedToCompany,
      relatedData,
      warnings,
      blockers,
    },
  }
}

export async function deleteUserAction(input: { userId: string }): Promise<ActionResult> {
  const parsed = deleteUserSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: "Invalid user ID." }
  }

  const { user: currentUser, error } = await assertSuperAdmin()
  if (error || !currentUser) {
    return { success: false, error: "You are not authorized to delete users." }
  }

  // Cannot delete yourself
  if (parsed.data.userId === currentUser.id) {
    return { success: false, error: "You cannot delete your own account." }
  }

  // Run the check first
  const checkResult = await checkUserDeletionAction({ userId: parsed.data.userId })
  if (!checkResult.success || !checkResult.data) {
    return { success: false, error: checkResult.error ?? "Failed to check deletion requirements." }
  }

  if (!checkResult.data.canDelete) {
    return {
      success: false,
      error: `Cannot delete user: ${checkResult.data.blockers.join(" ")}`,
    }
  }

  const serviceClient = createServiceRoleSupabaseClient()

  // If user owns a company with no other professionals and no project links, delete the company
  if (checkResult.data.ownsCompany && checkResult.data.companyId) {
    if (
      checkResult.data.otherProfessionalsInCompany === 0 &&
      checkResult.data.projectsLinkedToCompany === 0
    ) {
      // Delete company photos first
      const { error: companyPhotosError } = await serviceClient
        .from("company_photos")
        .delete()
        .eq("company_id", checkResult.data.companyId)

      if (companyPhotosError) {
        logger.db(
          "delete",
          "company_photos",
          "Failed to delete company photos during user deletion",
          { userId: parsed.data.userId, companyId: checkResult.data.companyId },
          companyPhotosError,
        )
      }

      // Delete company social links
      const { error: companySocialError } = await serviceClient
        .from("company_social_links")
        .delete()
        .eq("company_id", checkResult.data.companyId)

      if (companySocialError) {
        logger.db(
          "delete",
          "company_social_links",
          "Failed to delete company social links during user deletion",
          { userId: parsed.data.userId, companyId: checkResult.data.companyId },
          companySocialError,
        )
      }

      // Delete the company
      const { error: companyError } = await serviceClient
        .from("companies")
        .delete()
        .eq("id", checkResult.data.companyId)

      if (companyError) {
        logger.db(
          "delete",
          "companies",
          "Failed to delete company during user deletion",
          { userId: parsed.data.userId, companyId: checkResult.data.companyId },
          companyError,
        )
        return { success: false, error: "Failed to delete associated company." }
      }
    }
  }

  // Delete profile first (profile has FK to auth.users)
  const { error: profileDeleteError } = await serviceClient
    .from("profiles")
    .delete()
    .eq("id", parsed.data.userId)

  if (profileDeleteError) {
    logger.db(
      "delete",
      "profiles",
      "Failed to delete profile during user deletion",
      { userId: parsed.data.userId },
      profileDeleteError,
    )
    return { success: false, error: "Failed to delete user profile." }
  }

  // Now delete auth user
  const { error: authDeleteError } = await serviceClient.auth.admin.deleteUser(parsed.data.userId)

  if (authDeleteError) {
    logger.auth(
      "admin-delete-user",
      "Failed to delete auth user",
      { userId: parsed.data.userId },
      authDeleteError,
    )
    return { success: false, error: "Failed to delete user account." }
  }

  revalidatePath("/admin/users")
  return { success: true }
}
