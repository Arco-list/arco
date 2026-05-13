import { fetchGrowthMetrics } from "./actions"
import { GrowthClient } from "./growth-client"

export const dynamic = "force-dynamic"

export default async function GrowthPage() {
  const metrics = await fetchGrowthMetrics()

  return (
    <div className="min-h-screen bg-white">
      <div className="discover-page-title">
        <div className="wrap">
          <GrowthClient initialMetrics={metrics} />
        </div>
      </div>
    </div>
  )
}
