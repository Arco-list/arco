import { fetchMetricTable } from "../dashboard/table/table-actions"
import { getLastSyncedAt } from "./actions"
import { GrowthModelClient } from "./model-client"

export const dynamic = "force-dynamic"

export default async function GrowthModelPage() {
  // Reuse the existing table fetcher — same metric definitions, just
  // rendered as a planning grid instead of a sparkline list. Locked to
  // months for the model view; the timeframe switcher belongs on the
  // Table view, not here.
  const [data, lastSynced] = await Promise.all([
    fetchMetricTable("months"),
    getLastSyncedAt(),
  ])

  return (
    <div className="min-h-screen bg-white">
      <div className="discover-page-title">
        <div className="wrap">
          <GrowthModelClient
            initialRows={data.rows}
            initialLabels={data.labels}
            initialLastSynced={lastSynced}
          />
        </div>
      </div>
    </div>
  )
}
