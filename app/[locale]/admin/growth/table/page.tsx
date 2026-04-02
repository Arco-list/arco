import { fetchGrowthMetrics } from "../actions"
import { GrowthTableClient } from "./table-client"

export const dynamic = "force-dynamic"

export default async function GrowthTablePage() {
  const metrics = await fetchGrowthMetrics("months")

  return (
    <div className="min-h-screen bg-white">
      <div className="discover-page-title">
        <div className="wrap">
          <GrowthTableClient initialMetrics={metrics} />
        </div>
      </div>
    </div>
  )
}
