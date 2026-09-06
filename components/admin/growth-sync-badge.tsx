"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { syncGrowthMetricsAction } from "@/app/admin/model/actions"

/**
 * Growth-metrics sync pill — the compact status-pill design shared with
 * the Inbox sync pill: colored dot + relative time, click = sync now.
 *
 * Staleness: the sync-growth-metrics cron runs daily at 03:00, so a
 * last-sync older than ~26h means the cron missed a beat — the pill
 * flips amber to say so.
 *
 * `onSync` lets a page piggyback its own refresh on the same gesture —
 * the Growth dashboard passes its PostHog cache refresh, so one click
 * syncs both sources and the separate refresh icon could go.
 */
export function GrowthSyncBadge({
  initialLastSynced,
  onSync,
}: {
  initialLastSynced: string | null
  onSync?: () => void | Promise<void>
}) {
  const router = useRouter()
  const [isSyncing, startSync] = useTransition()
  const [lastSynced, setLastSynced] = useState(initialLastSynced)

  const handleSync = () => {
    startSync(async () => {
      const [result] = await Promise.all([
        syncGrowthMetricsAction(),
        Promise.resolve(onSync?.()).catch(() => {}),
      ])
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
      className="status-pill"
      title="Sync now"
      style={{
        background: "none",
        cursor: isSyncing ? "default" : "pointer",
        borderColor: stale ? "#fde68a" : "#bbf7d0",
        color: stale ? "#92400e" : "#166534",
        opacity: isSyncing ? 0.6 : 1,
      }}
    >
      <span className={`status-pill-dot ${stale ? "bg-amber-400" : "bg-emerald-500"}`} />
      {isSyncing ? "syncing…" : lastSynced ? formatRelative(lastSynced) : "never synced"}
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
