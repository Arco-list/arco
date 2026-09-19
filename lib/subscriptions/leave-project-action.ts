"use server"

import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"

/**
 * Take your own company off someone else's project.
 *
 * Not a status a credited company sets among the two that arrange its
 * own page — this leaves the project entirely, and only the owner can
 * put you back. It reads as reversible from the system's side and is
 * not from yours, which is why it is confirmed by typing the project's
 * name rather than picked from a list.
 *
 * `removed` rather than `unlisted`: the platform already uses that for
 * a party taken off a project, and keeping "opted out of showing"
 * separate from "gone" means a later reader can still tell which
 * happened.
 */
export async function leaveProjectAction(
  projectProfessionalId: string,
): Promise<{ ok: true } | { error: "not_signed_in" | "not_found" | "not_allowed" | "is_owner" | "failed" }> {
  const supabase = await createServerActionSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "not_signed_in" }

  const service = createServiceRoleSupabaseClient()

  const { data: row } = await service
    .from("project_professionals")
    .select("id, company_id, is_project_owner")
    .eq("id", projectProfessionalId)
    .maybeSingle()

  const credit = row as { company_id?: string | null; is_project_owner?: boolean } | null
  if (!credit?.company_id) return { error: "not_found" }

  // The owner deleting their own project is a different act with a
  // different blast radius; it does not come through here.
  if (credit.is_project_owner) return { error: "is_owner" }

  const { data: owned } = await service
    .from("companies").select("id").eq("id", credit.company_id).eq("owner_id", user.id).maybeSingle()

  if (!owned) {
    const { data: member } = await service
      .from("company_contacts")
      .select("company_id, person:persons!inner(auth_user_id)")
      .eq("company_id", credit.company_id)
      .eq("person.auth_user_id", user.id)
      .limit(1)
      .maybeSingle()
    if (!member) return { error: "not_allowed" }
  }

  try {
    const { error } = await service
      .from("project_professionals")
      .update({ status: "removed", updated_at: new Date().toISOString() } as never)
      .eq("id", projectProfessionalId)

    if (error) throw new Error(error.message)
    return { ok: true }
  } catch (err) {
    logger.error("Could not leave a project", { projectProfessionalId }, err as Error)
    return { error: "failed" }
  }
}
