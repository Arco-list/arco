"use server"

import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { getCompanyBilling } from "@/lib/subscriptions/get-company-subscription"
import { FREE_CONTRIBUTOR_LIMIT } from "@/lib/subscriptions/usage-types"
import { logger } from "@/lib/logger"

/**
 * Set the status of one credit, and keep the free allowance true.
 *
 * On Free a company may show one credit on its page. Nothing enforced
 * that: the dashboard wrote the row straight from the browser, so two
 * projects could sit on a free page at once and the modal's promise —
 * "choosing this project takes that place" — was a promise nothing
 * kept.
 *
 * Both writes happen here so the rule cannot be reached around, and so
 * the demotion and the promotion cannot half-happen.
 */
export async function setContributorStatusAction(
  projectProfessionalId: string,
  status: "live_on_page" | "listed" | "unlisted",
): Promise<{ demoted: string[] } | { error: "not_signed_in" | "not_found" | "not_allowed" | "failed" }> {
  const supabase = await createServerActionSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "not_signed_in" }

  const service = createServiceRoleSupabaseClient()

  const { data: row } = await service
    .from("project_professionals")
    .select("id, company_id")
    .eq("id", projectProfessionalId)
    .maybeSingle()

  const companyId = (row as { company_id?: string | null } | null)?.company_id
  if (!companyId) return { error: "not_found" }

  // The credit belongs to a company; only that company may move it.
  const { data: owned } = await service
    .from("companies").select("id").eq("id", companyId).eq("owner_id", user.id).maybeSingle()

  if (!owned) {
    const { data: member } = await service
      .from("company_contacts")
      .select("company_id, person:persons!inner(auth_user_id)")
      .eq("company_id", companyId)
      .eq("person.auth_user_id", user.id)
      .limit(1)
      .maybeSingle()
    if (!member) return { error: "not_allowed" }
  }

  try {
    const demoted: string[] = []

    if (status === "live_on_page") {
      const billing = await getCompanyBilling(companyId)
      if (billing.plan !== "pro") {
        // Oldest first, so the ones that have been up longest give way
        // last: what gets demoted is whatever fills the allowance, and
        // on Free that allowance is one.
        const { data: onPage } = await service
          .from("project_professionals")
          .select("id")
          .eq("company_id", companyId)
          .eq("status", "live_on_page")
          .neq("id", projectProfessionalId)
          .order("updated_at", { ascending: true })

        const rows = (onPage ?? []) as { id: string }[]
        const keep = Math.max(0, FREE_CONTRIBUTOR_LIMIT - 1)
        const toDemote = rows.slice(0, Math.max(0, rows.length - keep))

        for (const r of toDemote) {
          await service
            .from("project_professionals")
            .update({ status: "listed", updated_at: new Date().toISOString() } as never)
            .eq("id", r.id)
          demoted.push(r.id)
        }
      }
    }

    const { error } = await service
      .from("project_professionals")
      .update({ status, responded_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
      .eq("id", projectProfessionalId)

    if (error) throw new Error(error.message)

    return { demoted }
  } catch (err) {
    logger.error("Could not set a contributor status", { projectProfessionalId, status }, err as Error)
    return { error: "failed" }
  }
}
