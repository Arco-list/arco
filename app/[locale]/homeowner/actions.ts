"use server"

import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

export type DeletionCheckResult = {
  canDelete: boolean
  ownsCompany: boolean
  companyId?: string
  companyName?: string
  warnings: string[]
  blockers: string[]
}

export async function checkSelfDeletionAction(): Promise<ActionResult<DeletionCheckResult>> {
  const supabase = await createServerActionSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: "Not authenticated" }
  }

  const serviceClient = createServiceRoleSupabaseClient()
  const userId = user.id

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, user_types")
    .eq("id", userId)
    .maybeSingle()

  if (!profile) {
    return { success: false, error: "Profile not found" }
  }

  const isProfessional = profile.user_types?.includes("professional") ?? false
  const warnings: string[] = []
  const blockers: string[] = []
  let ownsCompany = false
  let companyId: string | undefined
  let companyName: string | undefined

  // Check projects
  const { count: projectCount } = await serviceClient
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("client_id", userId)

  if ((projectCount ?? 0) > 0) {
    warnings.push(`${projectCount} project${projectCount === 1 ? "" : "s"} will be deleted`)
  }

  // Check company ownership
  if (isProfessional) {
    const { data: ownedCompany } = await serviceClient
      .from("companies")
      .select("id, name")
      .eq("owner_id", userId)
      .maybeSingle()

    if (ownedCompany) {
      ownsCompany = true
      companyId = ownedCompany.id
      companyName = ownedCompany.name

      const { count: otherMembers } = await serviceClient
        .from("professionals")
        .select("id", { count: "exact", head: true })
        .eq("company_id", ownedCompany.id)
        .neq("user_id", userId)

      if ((otherMembers ?? 0) > 0) {
        blockers.push(`You own "${companyName}" with ${otherMembers} other team member(s). Transfer ownership first.`)
      } else {
        warnings.push(`Company "${companyName}" will be deleted`)
      }
    }
  }

  return {
    success: true,
    data: { canDelete: blockers.length === 0, ownsCompany, companyId, companyName, warnings, blockers },
  }
}

export async function deleteSelfAccountAction(input: {
  password?: string
  confirmText: string
}): Promise<ActionResult> {
  if (input.confirmText !== "DELETE") {
    return { success: false, error: "You must type DELETE to confirm" }
  }

  const supabase = await createServerActionSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: "Not authenticated" }
  }

  // Verify password for email-auth users
  const provider = user.app_metadata?.provider
  const isEmailUser = provider === "email"

  if (isEmailUser) {
    if (!input.password) {
      return { success: false, error: "Password is required for email accounts" }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) {
      return { success: false, error: "Server configuration error" }
    }

    const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ email: user.email, password: input.password }),
    })

    if (!verifyResponse.ok) {
      return { success: false, error: "Incorrect password" }
    }
  }

  // Run deletion check
  const checkResult = await checkSelfDeletionAction()
  if (!checkResult.success || !checkResult.data?.canDelete) {
    const errorMsg = !checkResult.success
      ? ("error" in checkResult ? checkResult.error : "Deletion check failed")
      : `Cannot delete account: ${checkResult.data?.blockers.join(" ")}`
    return { success: false, error: errorMsg }
  }

  const serviceClient = createServiceRoleSupabaseClient()
  const userId = user.id

  // Delete owned company if applicable (same cascade as admin deleteUserAction)
  if (checkResult.data.ownsCompany && checkResult.data.companyId) {
    await serviceClient
      .from("company_photos")
      .delete()
      .eq("company_id", checkResult.data.companyId)

    await serviceClient
      .from("company_social_links")
      .delete()
      .eq("company_id", checkResult.data.companyId)

    const { error: companyError } = await serviceClient
      .from("companies")
      .delete()
      .eq("id", checkResult.data.companyId)

    if (companyError) {
      logger.db("delete", "companies", "Self-service company deletion failed", { userId, companyId: checkResult.data.companyId }, companyError)
      return { success: false, error: "Failed to delete associated company." }
    }
  }

  // Delete profile
  const { error: profileDeleteError } = await serviceClient
    .from("profiles")
    .delete()
    .eq("id", userId)

  if (profileDeleteError) {
    logger.db("delete", "profiles", "Self-service profile deletion failed", { userId }, profileDeleteError)
    return { success: false, error: "Failed to delete profile." }
  }

  // Delete auth user
  const { error: authDeleteError } = await serviceClient.auth.admin.deleteUser(userId)
  if (authDeleteError) {
    logger.db("delete", "auth.users", "Self-service auth user deletion failed", { userId }, authDeleteError)
    return { success: false, error: "Failed to delete account." }
  }

  // Sign out
  await supabase.auth.signOut()

  return { success: true }
}
