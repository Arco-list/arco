"use server"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { syncAllCachedMetrics, lastSyncedAt } from "@/lib/growth-metric-cache"

/**
 * Manual "Sync" button handler on /admin/model. Runs the same
 * sync logic as the nightly cron (rolling re-fetch per granularity, or
 * one-shot 2-year backfill if the cache is empty) and returns a short
 * summary the client can toast.
 *
 * Also invalidates the Dashboard's outer `posthog_cache` rows so the
 * Lifecycle view picks up the fresh metric_cache values on next render
 * — otherwise the wrapper-cache TTL (up to 24h for the years view)
 * would hide the just-synced numbers.
 *
 * Auth note: this is wired up as a React Server Action which inherits
 * the session of the admin user calling it. No separate token check —
 * the page is already behind /admin auth (admin/layout enforces).
 */
export async function syncGrowthMetricsAction(): Promise<{
  success: boolean
  upserted: number
  durationMs: number
  errors: string[]
}> {
  const supabase = createServiceRoleSupabaseClient()
  const startedAt = Date.now()
  const results = await syncAllCachedMetrics(supabase)
  const durationMs = Date.now() - startedAt

  const upserted = results.reduce((sum, r) => sum + r.upserted, 0)
  const errors = results.flatMap((r) => (r.error ? [`${r.metric}: ${r.error}`] : []))

  // Invalidate the Dashboard's outer response cache. Best-effort —
  // failure here just means the Dashboard shows stale numbers until
  // the wrapper-TTL expires, not a sync failure.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("posthog_cache").delete().neq("timeframe", "")
  } catch (err) {
    console.warn("syncGrowthMetricsAction: posthog_cache invalidation failed", err)
  }

  return {
    success: errors.length === 0,
    upserted,
    durationMs,
    errors,
  }
}

/** Read-only: last successful sync timestamp, surfaced in the
 *  Growth Model header so the admin sees cache staleness at a glance. */
export async function getLastSyncedAt(): Promise<string | null> {
  const supabase = createServiceRoleSupabaseClient()
  return lastSyncedAt(supabase)
}
