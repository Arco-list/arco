import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { syncAllCachedMetrics } from "@/lib/growth-metric-cache"
import { logger } from "@/lib/logger"

/**
 * Nightly sync of PostHog-sourced growth metrics into the
 * metric_daily_cache Supabase table. Re-fetches a rolling 30-day
 * window each run (or runs a one-shot 12-month backfill the first
 * time the cache is empty).
 *
 * Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`.
 * Same pattern as /api/cron/process-drip-queue. Manual sync from
 * the dashboard goes through a server action, not this endpoint.
 */

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(req: NextRequest) {
  return handle(req)
}
export async function POST(req: NextRequest) {
  return handle(req)
}

async function handle(req: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    logger.error("cron-sync-growth-metrics: CRON_SECRET not set")
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
  }
  const header = req.headers.get("authorization") ?? ""
  const provided = header.startsWith("Bearer ") ? header.slice(7) : ""
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const supabase = createServiceRoleSupabaseClient()
  const startedAt = Date.now()
  const results = await syncAllCachedMetrics(supabase)
  const durationMs = Date.now() - startedAt

  const totalUpserted = results.reduce((sum, r) => sum + r.upserted, 0)
  const errors = results.filter((r) => r.error)
  logger.info("cron-sync-growth-metrics: done", {
    durationMs,
    totalUpserted,
    results: results.map((r) => ({
      metric: r.metric,
      granularity: r.granularity,
      upserted: r.upserted,
      windowPeriods: r.windowPeriods,
      error: r.error,
    })),
  })

  return NextResponse.json({
    ok: errors.length === 0,
    durationMs,
    totalUpserted,
    results,
  })
}
