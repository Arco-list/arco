import { fetchGrowthMetrics } from "./actions"
import { getLastSyncedAt } from "../model/actions"
import { GrowthClient } from "./growth-client"

export const dynamic = "force-dynamic"

export default async function GrowthPage() {
  const [metrics, lastSynced] = await Promise.all([fetchGrowthMetrics(), getLastSyncedAt()])

  return (
    <div className="min-h-screen bg-white">
      <div className="discover-page-title">
        <div className="wrap">
          <GrowthClient initialMetrics={metrics} initialLastSynced={lastSynced} />
        </div>
      </div>
    </div>
  )
}
