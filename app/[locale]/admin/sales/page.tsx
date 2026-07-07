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
          />
        </div>
      </div>
    </div>
  )
}
