import "server-only"

import { logger } from "@/lib/logger"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { FREE_CONTRIBUTOR_LIMIT } from "@/lib/subscriptions/usage-types"

/**
 * Bring a company's visible credits back inside its allowance.
 *
 * The rule was only ever applied when somebody pressed something. Put a
 * credit on your page while on Free and the action demotes whichever
 * one was there — that worked, and still does. Nothing applied it when
 * the PLAN changed, because nothing was pressed: a company that went
 * Pro, put five projects on its page and then stopped paying kept all
 * five, indefinitely, on a free account.
 *
 * Six places read these statuses and exactly one of them knew about the
 * allowance, which is why the usage bar said "1 project niet zichtbaar"
 * above a page showing two. The cheap fix is to make the status true
 * again rather than teach five more readers to doubt it — everything
 * downstream is already built on the status meaning what it says.
 *
 * Demoted, not deleted. `listed` is a credit the contributor still
 * holds and can put back the moment they have room, which is also what
 * makes the lock and its upgrade prompt appear on their own listings.
 */
export async function enforceCreditAllowance(companyId: string): Promise<string[]> {
  const service = createServiceRoleSupabaseClient()

  // Oldest first, so the ones that have been up longest give way last.
  // Same ordering as the demotion inside setContributorStatusAction:
  // two places deciding who loses their place differently would be a
  // coin toss dressed as a rule.
  const { data: onPage } = await service
    .from("project_professionals")
    .select("id")
    .eq("company_id", companyId)
    .eq("status", "live_on_page")
    .order("updated_at", { ascending: true })

  const rows = (onPage ?? []) as { id: string }[]
  const excess = rows.length - FREE_CONTRIBUTOR_LIMIT
  if (excess <= 0) return []

  const toDemote = rows.slice(0, excess)
  const demoted: string[] = []

  for (const row of toDemote) {
    const { error } = await service
      .from("project_professionals")
      .update({ status: "listed", updated_at: new Date().toISOString() } as never)
      .eq("id", row.id)

    if (error) {
      logger.error("Could not demote a credit past the free allowance", {
        companyId, projectProfessionalId: row.id, error: error.message,
      })
      continue
    }
    demoted.push(row.id)
  }

  if (demoted.length > 0) {
    logger.info("Demoted credits past the free allowance", { companyId, count: demoted.length })
  }
  return demoted
}
