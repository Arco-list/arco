import { fetchGrowthMetrics } from "./actions"
import { getLastSyncedAt } from "../model/actions"
import { GrowthClient } from "./growth-client"

export const dynamic = "force-dynamic"

export default async function GrowthPage() {
  const [metrics, lastSynced] = await Promise.all([fetchGrowthMetrics(), getLastSyncedAt()])

  return (
    <div className="min-h-screen bg-white">
      {/* The client renders the sticky full-bleed tab bar and wraps its
          own content — company-edit pattern, bar flush under the header. */}
      <GrowthClient initialMetrics={metrics} initialLastSynced={lastSynced} />
    </div>
  )
}
