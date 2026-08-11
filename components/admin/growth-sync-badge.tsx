"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { syncGrowthMetricsAction } from "@/app/admin/model/actions"

/**
 * Growth-metrics sync badge — same visual pattern as the Inbox mailbox
 * badge and the Sales Apollo badge: status-pill + grey detail text.
 * Clicking it runs the sync (replaces the old "Sync" button).
 *
 * Staleness: the sync-growth-metrics cron runs daily at 03:00, so a
 * last-sync older than ~26h means the cron missed a beat — the pill
 * flips amber to say so.
 */
export function GrowthSyncBadge({ initialLastSynced }: { initialLastSynced: string | null }) {
  const router = useRouter()
  const [isSyncing, startSync] = useTransition()
  const [lastSynced, setLastSynced] = useState(initialLastSynced)

  const handleSync = () => {
    startSync(async () => {
      const result = await syncGrowthMetricsAction()
      if (result.success) {
        const seconds = (result.durationMs / 1000).toFixed(1)
        toast.success(`Synced ${result.upserted} daily rows in ${seconds}s`)
        setLastSynced(new Date().toISOString())
        router.refresh()
      } else {
        toast.error(`Sync failed: ${result.errors.join("; ") || "unknown"}`)
      }
    })
  }

  const ageMs = lastSynced ? Date.now() - new Date(lastSynced).getTime() : null
  const stale = ageMs === null || ageMs > 26 * 3_600_000

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={isSyncing}
      className="flex items-center gap-2 cursor-pointer disabled:opacity-60"
      title="Refresh growth metrics now"
    >
      <span
        className="status-pill"
        style={{
          borderColor: stale ? "#fde68a" : "#bbf7d0",
          color: stale ? "#92400e" : "#166534",
        }}
      >
        <span className={`status-pill-dot ${stale ? "bg-amber-400" : "bg-emerald-500"}`} />
        {isSyncing ? "Syncing…" : stale ? "Stale" : "Synced"}
      </span>
      <span className="text-[11px] text-[#a1a1a0]">
        {lastSynced ? `last sync ${formatRelative(lastSynced)}` : "never synced"}
      </span>
    </button>
  )
}

function formatRelative(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime()
    if (ms < 60_000) return "just now"
    const m = Math.floor(ms / 60_000)
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.floor(h / 24)
    return `${d}d ago`
  } catch {
    return iso
  }
}
