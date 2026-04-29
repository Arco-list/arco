import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { ProspectsClient } from "./prospects-client"
import { fetchFunnel, fetchLatestApolloSyncRuns, fetchProspects, syncPlatformProspects } from "./actions"

export const dynamic = "force-dynamic"

export default async function ProspectsPage() {
  // Sync prospected/invited companies into prospects table
  await syncPlatformProspects()

  const supabase = createServiceRoleSupabaseClient()

  // fetchProspects handles the resolvedContact join (profiles + auth email
  // + company owner) so the Contact cell matches the admin/companies Owner
  // cell once a prospect advances to Signup / Draft / Listed.
  const { prospects } = await fetchProspects({ limit: 50 })
  const { funnel } = await fetchFunnel()

  // Most recently used Apollo list ID — surfaced in the Status Guide
  // popup so the admin can see at a glance which list feeds sales.
  const { data: lastListRow } = await supabase
    .from("prospects")
    .select("apollo_list_id")
    .not("apollo_list_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  const currentApolloListId = (lastListRow as any)?.apollo_list_id ?? null

  // Latest sync runs (list import + activity refresh) for the Apollo Sync popup
  const apolloSyncRuns = await fetchLatestApolloSyncRuns()

  // Total Apollo prospects — surfaced as "X contacts synced" in the popup
  const { count: apolloProspectsCount } = await supabase
    .from("prospects")
    .select("id", { count: "exact", head: true })
    .eq("source", "apollo")

  // Fetch company metadata (logo, services, city) for linked prospects
  const companyIds = [...new Set(prospects.map((p) => p.company_id).filter((id): id is string => Boolean(id)))]
  let companyMap: Record<string, { logoUrl: string | null; services: string[]; city: string | null }> = {}
  if (companyIds.length > 0) {
    const { data: companies } = await supabase
      .from("companies")
      .select("id, logo_url, city, primary_service:categories!companies_primary_service_id_fkey(name)")
      .in("id", companyIds)
    for (const c of companies ?? []) {
      companyMap[c.id] = {
        logoUrl: c.logo_url ?? null,
        services: [(c.primary_service as any)?.name].filter(Boolean),
        city: c.city ?? null,
      }
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="discover-page-title">
        <div className="wrap">
          <ProspectsClient
            initialProspects={prospects}
            initialFunnel={funnel}
            companyMap={companyMap}
            currentApolloListId={currentApolloListId}
            apolloSyncRuns={apolloSyncRuns}
            apolloProspectsCount={apolloProspectsCount ?? 0}
          />
        </div>
      </div>
    </div>
  )
}
