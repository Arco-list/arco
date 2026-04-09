import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { ProspectsClient } from "./prospects-client"
import { fetchFunnel, syncPlatformProspects, type Prospect } from "./actions"

export const dynamic = "force-dynamic"

export default async function ProspectsPage() {
  // Sync prospected/invited companies into prospects table
  await syncPlatformProspects()

  const supabase = createServiceRoleSupabaseClient()

  const { data, error } = await supabase
    .from("prospects")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    console.error("Failed to load prospects", error)
  }

  const prospects = (data ?? []) as Prospect[]
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
          <ProspectsClient initialProspects={prospects} initialFunnel={funnel} companyMap={companyMap} currentApolloListId={currentApolloListId} />
        </div>
      </div>
    </div>
  )
}
