import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { ProspectsClient } from "./prospects-client"
import { fetchSalesCompanies, syncPlatformProspects } from "./actions"

export const dynamic = "force-dynamic"

export default async function ProspectsPage() {
  // Sync prospected/invited companies into prospects table
  await syncPlatformProspects()

  const supabase = createServiceRoleSupabaseClient()

  // One-row-per-company aggregation. fetchSalesCompanies bakes the
  // claimed-company metadata (logo, owner, primary service) into each
  // row, so we no longer need a separate companyMap join here.
  const { companies, totalCompanies, funnel } = await fetchSalesCompanies({ limit: 50 })
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
            currentApolloListId={currentApolloListId}
            apolloProspectsCount={apolloProspectsCount ?? 0}
          />
        </div>
      </div>
    </div>
  )
}
