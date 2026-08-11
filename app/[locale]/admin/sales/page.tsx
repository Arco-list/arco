import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { ProspectsClient } from "./prospects-client"
import { fetchSalesCompanies } from "./actions"

export const dynamic = "force-dynamic"

export default async function ProspectsPage() {
  // syncPlatformProspects() now runs via /api/cron/sync-platform-prospects
  // every 15 min. It used to fire on every render — 4 loops with N+1
  // queries each — which dominated the load time here.

  const supabase = createServiceRoleSupabaseClient()

  // One-row-per-company aggregation. fetchSalesCompanies bakes the
  // claimed-company metadata (logo, owner, primary service) into each
  // row, so we no longer need a separate companyMap join here.
  const { companies, totalCompanies, funnel, outboundDueCount } = await fetchSalesCompanies({ limit: 50 })
  const totalEmailsSent = companies.reduce((sum, c) => sum + c.emailsSent, 0)

  // Most recently used Apollo list ID — pre-fills the Import Contacts
  // popup so the admin can re-import the same list with one click.
  const { data: lastListRow } = await supabase
    .from("prospects")
    .select("apollo_list_id")
    .not("apollo_list_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  const currentApolloListId = (lastListRow as any)?.apollo_list_id ?? null

  const { count: apolloProspectsCount } = await supabase
    .from("prospects")
    .select("id", { count: "exact", head: true })
    .eq("source", "apollo")

  // Apollo connection badge (Inbox pattern): key presence = connected,
  // newest apollo_sync_runs row = last sync time + error state.
  const { data: lastRun } = await supabase
    .from("apollo_sync_runs")
    .select("started_at, error_count, last_error")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  const apolloSyncStatus = {
    connected: Boolean(process.env.APOLLO_API_KEY),
    lastSyncAt: (lastRun as { started_at?: string } | null)?.started_at ?? null,
    hadError: ((lastRun as { error_count?: number } | null)?.error_count ?? 0) > 0,
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="discover-page-title">
        <div className="wrap">
          <ProspectsClient
            initialCompanies={companies}
            initialTotalCompanies={totalCompanies}
            initialFunnel={funnel}
            initialEmailsSent={totalEmailsSent}
            initialOutboundDueCount={outboundDueCount}
            currentApolloListId={currentApolloListId}
            apolloProspectsCount={apolloProspectsCount ?? 0}
            apolloSyncStatus={apolloSyncStatus}
          />
        </div>
      </div>
    </div>
  )
}
