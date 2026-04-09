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
  /** True when the user owns a company that will be orphaned, so the UI can
   *  show the GDPR notice explaining how to request permanent removal. */
  showGdprNotice: boolean
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

  // Check projects — these are no longer deleted on self-delete. Projects
  // owned by the user's orphaned company are archived (hidden from discover
  // but still intact), and any project with client_id = userId has its
  // client_id nulled out via the FK ON DELETE SET NULL.
  const { count: projectCount } = await serviceClient
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("client_id", userId)

  if ((projectCount ?? 0) > 0) {
    warnings.push(
      `${projectCount} project${projectCount === 1 ? "" : "s"} will be archived (hidden from the site but not deleted)`,
    )
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
        warnings.push(
          `Company "${companyName}" will be marked as Unclaimed so the next verified domain holder can re-claim it`,
        )
      }
    }
  }

  return {
    success: true,
    data: {
      canDelete: blockers.length === 0,
      ownsCompany,
      companyId,
      companyName,
      warnings,
      blockers,
      showGdprNotice: ownsCompany && blockers.length === 0,
    },
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

  // Orphan the owned company instead of deleting it. Companies are the
  // primary marketplace entity on Arco — their photos, description, and
  // credited projects have commercial value that outlives any individual
  // owner. Setting owner_id = null + status = 'unclaimed' hides the page
  // from discover and marks it as claimable by the next verified domain
  // holder. Team members (if any) stay on the company because they live
  // in separate tables keyed on company_id.
  //
  // Projects owned by the orphaned company are archived so they stop
  // appearing in discover while remaining linked to the company via
  // project_professionals. When the company is re-claimed, the new owner
  // sees them in their dashboard and can un-archive.
  if (checkResult.data.ownsCompany && checkResult.data.companyId) {
    const { error: orphanCompanyError } = await serviceClient
      .from("companies")
      .update({
        owner_id: null,
        status: "unclaimed",
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", checkResult.data.companyId)

    if (orphanCompanyError) {
      logger.db(
        "update",
        "companies",
        "Self-service company orphan failed",
        { userId, companyId: checkResult.data.companyId },
        orphanCompanyError,
      )
      return { success: false, error: "Failed to update associated company." }
    }

    // Archive the projects owned by this company (is_project_owner = true).
    // Fetch the project ids first; the update is simpler than a subquery.
    const { data: ownedLinks } = await serviceClient
      .from("project_professionals")
      .select("project_id")
      .eq("company_id", checkResult.data.companyId)
      .eq("is_project_owner", true)

    const ownedProjectIds = (ownedLinks ?? [])
      .map((r) => r.project_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)

    if (ownedProjectIds.length > 0) {
      const { error: archiveError } = await serviceClient
        .from("projects")
        .update({ status: "archived", updated_at: new Date().toISOString() } as any)
        .in("id", ownedProjectIds)

      if (archiveError) {
        logger.db(
          "update",
          "projects",
          "Self-service project archive failed",
          { userId, companyId: checkResult.data.companyId, projectIds: ownedProjectIds },
          archiveError,
        )
        // Non-fatal: the company is already orphaned, projects staying
        // published temporarily is a small cosmetic issue compared to
        // failing the whole deletion.
      }
    }
  }

  // Delete profile. With migration 126 the projects.client_id FK is
  // ON DELETE SET NULL, so any projects the user authored stay intact
  // with their client_id nulled out. Saved projects / companies / etc.
  // still cascade as before.
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
