import "server-only"

import { logger } from "@/lib/logger"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

/**
 * Keep companies.status in step with whether the company has a live
 * credit on a published project.
 *
 * Lives in lib/ rather than in a "use server" actions file because
 * non-action server code needs it too (invite acceptance, for one).
 * Importing a server-action module from a library type-checks — the
 * tsconfig maps @/app/* to app/[locale]/* — but fails at runtime, and
 * a swallowed catch hid exactly that once already.
 */
export async function syncCompanyListedStatus(companyId: string) {
  const supabase = createServiceRoleSupabaseClient()

  // Check if company has any active (listed/featured) project links on published projects
  const { data: activePPs } = await supabase
    .from("project_professionals")
    .select("id, projects!inner(status)")
    .eq("company_id", companyId)
    .in("status", ["listed", "live_on_page"])
    .eq("projects.status", "published")
    .limit(1)

  const hasActiveProjects = (activePPs?.length ?? 0) > 0

  const { data: company } = await supabase
    .from("companies")
    .select("status, manually_unlisted, owner_id")
    .eq("id", companyId)
    .maybeSingle()

  if (!company) return

  let statusChanged = false
  // Auto-list from both `unlisted` (previously listed, then hidden) and
  // `draft` (Created — company claimed but never listed) — UNLESS the
  // owner explicitly toggled Unlisted from the visibility popup (in
  // which case manually_unlisted = true and we respect their choice).
  // See migration 185 for the mirroring DB-side trigger that keeps this
  // consistent across every project-add code path, not just callers of
  // this JS helper.
  // Auto-list from any pre-live state — draft, unlisted, prospected,
  // invited, unclaimed, added. Excluded: listed (already there),
  // deactivated (admin intent, do not override).
  //
  // "Listed" means CLAIMED: a company without owner_id can only ever
  // reach "prospected" (Showcase) here — admin-added catalogue companies
  // whose projects go live are showcases, not listed members. The DB
  // mirror (sync_company_listed_status, migration 208 revision) bails on
  // ownerless companies entirely; this helper promotes them to showcase.
  const hasOwner = Boolean((company as { owner_id?: string | null }).owner_id)
  const targetStatus = hasOwner ? "listed" : "prospected"
  const AUTO_LIST_ELIGIBLE = new Set(["created", "unlisted", "prospected", "invited", "unclaimed", "added"])
  if (
    hasActiveProjects
    && AUTO_LIST_ELIGIBLE.has(company.status as string)
    && company.status !== targetStatus
    && !company.manually_unlisted
  ) {
    // Flip setup_completed when auto-listing from draft — this is the
    // moment the pro effectively "completed" onboarding without going
    // through the manual chain, and leaving it false keeps the popup
    // + tour firing on subsequent loads.
    const update: Record<string, unknown> = { status: targetStatus }
    if (company.status === "created" && hasOwner) update.setup_completed = true
    const { error: updateError } = await supabase.from("companies").update(update).eq("id", companyId)
    if (updateError) {
      // Was unchecked, so a refused update still logged as a success —
      // e.g. companies_apollo_not_showcased forbids source='apollo'
      // reaching 'prospected'. Report it instead of claiming a sync.
      logger.warn("Company status sync refused", { scope: "company-status", companyId, from: company.status, to: targetStatus, error: updateError.message })
    } else {
      logger.info("company-status", "Company status synced (has active projects)", { companyId, from: company.status, to: targetStatus })
      statusChanged = true
    }
  } else if (!hasActiveProjects && company.status === "listed" && hasOwner) {
    // Auto-unlist: leave manually_unlisted alone. It's still false
    // (the previous listed was auto or explicitly user-chosen), so a
    // future active credit will auto-relist.
    const { error: unlistError } = await supabase.from("companies").update({ status: "unlisted" }).eq("id", companyId)
    if (unlistError) {
      logger.warn("Company auto-unlist refused", { scope: "company-status", companyId, error: unlistError.message })
    } else {
      logger.info("company-status", "Company auto-unlisted (no active projects)", { companyId })
      statusChanged = true
    }
  }

  if (statusChanged) {
    try {
      const { syncCompanyToApollo } = await import('@/lib/company-apollo-sync')
      await syncCompanyToApollo(companyId)
    } catch (err) {
      logger.error("company-status", "Failed to sync company to Apollo after status sync", { companyId }, err as Error)
    }
  }
}
