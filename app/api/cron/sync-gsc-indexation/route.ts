import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { syncGscIndexation } from "@/lib/gsc-sync"
import { logger } from "@/lib/logger"

/**
 * GSC indexation + Search Analytics sync cron — pulls per-URL indexation
 * verdict (URL Inspection API) and 28-day impressions/clicks/CTR/position
 * (Search Analytics API) for every published project and listed/prospected
 * company, writes back to seo_* columns.
 *
 * Auth: Vercel Cron passes `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Logging: writes a row to gsc_sync_runs at start, patches it on completion
 * (same pattern as apollo_sync_runs).
 *
 * See lib/gsc-sync.ts for the API client and docs/SETUP_GSC_SYNC.md for the
 * one-time GCP + Search Console setup.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
  }
  const header = request.headers.get("authorization") ?? ""
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : ""
  const queryToken = request.nextUrl.searchParams.get("secret") ?? ""
  if (bearer !== expected && queryToken !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const supabase = createServiceRoleSupabaseClient()

  const { data: runRow } = await supabase
    .from("gsc_sync_runs")
    .insert({
      triggered_by: "cron",
      started_at: new Date().toISOString(),
    } as any)
    .select("id")
    .single()
  const runId = (runRow as any)?.id as string | undefined

  try {
    const result = await syncGscIndexation()

    if (runId) {
      await supabase
        .from("gsc_sync_runs")
        .update({
          finished_at: new Date().toISOString(),
          projects_synced: result.projectsSynced,
          companies_synced: result.companiesSynced,
          total_count: result.total,
          error_count: result.errorCount,
          last_error: result.lastError,
        } as any)
        .eq("id", runId)
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error("sync-gsc-indexation cron failed", { error: err })
    if (runId) {
      await supabase
        .from("gsc_sync_runs")
        .update({
          finished_at: new Date().toISOString(),
          error_count: 1,
          last_error: message,
        } as any)
        .eq("id", runId)
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
