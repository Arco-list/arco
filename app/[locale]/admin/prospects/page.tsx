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

  return (
    <div className="min-h-screen bg-white">
      <div className="discover-page-title">
        <div className="wrap">
          <ProspectsClient initialProspects={prospects} initialFunnel={funnel} />
        </div>
      </div>
    </div>
  )
}
