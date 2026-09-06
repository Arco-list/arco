import { fetchGrowthMetrics } from "../actions"
import { getLastSyncedAt } from "../../model/actions"
import { GrowthTableClient } from "./table-client"

export const dynamic = "force-dynamic"

export default async function GrowthTablePage() {
  const [metrics, lastSynced] = await Promise.all([fetchGrowthMetrics("months"), getLastSyncedAt()])

  return (
    <div className="min-h-screen bg-white">
      <GrowthTableClient initialMetrics={metrics} initialLastSynced={lastSynced} />
    </div>
  )
}
