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

    // ── Daily SEO snapshot ─────────────────────────────────────────
    // The per-row seo_*_28d columns are rolling windows overwritten by
    // every sync; append today's aggregate totals to
    // seo_metric_snapshots so the growth dashboards can reconstruct
    // history (one row per day per scope, idempotent on re-runs).
    // Aggregation mirrors the dashboard's "ranked" definitions:
    // projects = published + indexed; companies = listed + claimed +
    // indexed.
    try {
      const today = new Date().toISOString().slice(0, 10)
      const [{ data: projRows }, { data: compRows }] = await Promise.all([
        supabase
          .from("projects")
          .select("seo_indexed, seo_impressions_28d, seo_clicks_28d")
          .eq("status", "published"),
        supabase
          .from("companies")
          .select("seo_indexed, seo_impressions_28d, seo_clicks_28d, owner_id")
          .eq("status", "listed"),
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const aggregate = (rows: any[], eligible: (r: any) => boolean) => {
        const all = rows ?? []
        const indexed = all.filter((r) => eligible(r) && r.seo_indexed === true)
        return {
          impressions_28d: indexed.reduce((s, r) => s + (Number(r.seo_impressions_28d) || 0), 0),
          clicks_28d: indexed.reduce((s, r) => s + (Number(r.seo_clicks_28d) || 0), 0),
          indexed_count: indexed.length,
          total_count: all.filter(eligible).length,
        }
      }
      const projectAgg = aggregate(projRows ?? [], () => true)
      const companyAgg = aggregate(compRows ?? [], (r) => r.owner_id != null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("seo_metric_snapshots").upsert(
        [
          { snapshot_date: today, scope: "projects", ...projectAgg },
          { snapshot_date: today, scope: "companies", ...companyAgg },
        ],
        { onConflict: "snapshot_date,scope" },
      )
    } catch (snapErr) {
      // Snapshot failure must not fail the sync run itself.
      logger.warn("seo_metric_snapshots write failed", { error: snapErr })
    }

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
