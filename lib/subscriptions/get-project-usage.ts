import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { FREE_CONTRIBUTOR_LIMIT, type ProjectUsage } from "@/lib/subscriptions/usage-types"

export { FREE_CONTRIBUTOR_LIMIT }
export type { ProjectUsage }

/**
 * What a company has on Arco, split along the line the pricing model
 * draws: work it published itself (always free, always unlimited) and
 * work others credited it on (the thing Pro unlocks).
 *
 * The split is not cosmetic. Publishing creates the supply the whole
 * marketplace runs on, so charging for it would throttle the motor;
 * credits are value extracted from someone else's project, and that is
 * what is metered. Keeping the two counted separately here is what
 * stops the limit from ever being applied to the wrong one.
 */

/** Credit states that would appear on the public company page. */
const LIVE_CREDIT = ["listed", "live_on_page"]

export async function getProjectUsage(companyId: string, isPro: boolean): Promise<ProjectUsage> {
  const supabase = createServiceRoleSupabaseClient()

  const { data: company } = await supabase
    .from("companies")
    .select("services_offered, primary_service_id")
    .eq("id", companyId)
    .maybeSingle()

  // Same rule as use-company-entitlements: a company may publish when
  // any of its services is flagged for it. Photographers, for one, are
  // credited rather than publishers.
  const serviceIds = [
    ...((company?.services_offered as string[] | null) ?? []),
    ...(company?.primary_service_id ? [company.primary_service_id] : []),
  ].filter(Boolean) as string[]

  let canPublish = false
  if (serviceIds.length > 0) {
    const { data: eligible } = await supabase
      .from("categories")
      .select("id")
      .in("id", serviceIds)
      .eq("can_publish_projects", true)
      .limit(1)
    canPublish = (eligible?.length ?? 0) > 0
  }

  const { data: rows } = await supabase
    .from("project_professionals")
    .select("is_project_owner, status, projects!inner(status)")
    .eq("company_id", companyId)
    .eq("projects.status", "published")

  const all = (rows ?? []) as unknown as { is_project_owner: boolean | null; status: string | null }[]

  const publishedCount = all.filter((r) => r.is_project_owner).length
  const credits = all.filter((r) => !r.is_project_owner && LIVE_CREDIT.includes(r.status ?? ""))
  const contributorTotal = credits.length
  const contributorVisible = isPro ? contributorTotal : Math.min(contributorTotal, FREE_CONTRIBUTOR_LIMIT)

  return {
    canPublish,
    publishedCount,
    contributorTotal,
    contributorVisible,
    contributorHidden: Math.max(0, contributorTotal - contributorVisible),
  }
}
