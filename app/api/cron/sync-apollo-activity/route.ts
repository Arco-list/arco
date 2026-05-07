import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { syncApolloActivity, syncApolloEmailEvents, recomputeProspectLastEmailSentAt } from "@/lib/apollo-sync"
import { logger } from "@/lib/logger"

/**
 * Apollo activity sync cron — refreshes campaign status for every prospect
 * with an Apollo contact id, on a schedule (Vercel cron).
 *
 * Why a cron and not a manual button:
 *   syncApolloActivity iterates every non-terminal prospect with a 1.3s
 *   sleep between Apollo calls (free-plan rate limit is 50/min). At 100
 *   prospects this takes ~2m 10s, at 200 ~4m 20s — too long for a button
 *   click. The /admin/sales Apollo Sync popup keeps a manual "Refresh now"
 *   for power-user cases, but the routine path is this cron.
 *
 * Auth: Vercel Cron passes `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Logging: writes a row to apollo_sync_runs (kind='activity', triggered_by='cron')
 * so the popup can show last-run + status. Writes the start row before
 * calling sync, then updates the same row when sync completes (or throws).
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(request: NextRequest) {
  // Auth — same pattern as /api/cron/process-drip-queue
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

  // Open a sync_runs row before starting so the popup can show "running"
  // state if the request is slow. The id is patched on completion.
  const { data: runRow } = await supabase
    .from("apollo_sync_runs")
    .insert({
      kind: "activity",
      triggered_by: "cron",
      started_at: new Date().toISOString(),
    } as any)
    .select("id")
    .single()
  const runId = (runRow as any)?.id as string | undefined

  try {
    const result = await syncApolloActivity()

    // After the per-prospect aggregate sync, materialize per-message events
    // into email_events. Best-effort — the activity sync above is the
    // load-bearing piece for the popup + status transitions; email_events
    // is for analytics and shouldn't fail the run if it errors.
    let emailEvents:
      | Awaited<ReturnType<typeof syncApolloEmailEvents>>
      | { error: string }
      | null = null
    try {
      emailEvents = await syncApolloEmailEvents()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error("[sync-apollo-activity] email_events sync failed", { error: message })
      emailEvents = { error: message }
    }

    // After per-message events are synced, refresh prospects.last_email_sent_at
    // from email_events.occurred_at so the table column + popup show the
    // actual last-send time rather than the last cron run.
    let lastSentRecompute:
      | Awaited<ReturnType<typeof recomputeProspectLastEmailSentAt>>
      | { error: string }
      | null = null
    try {
      lastSentRecompute = await recomputeProspectLastEmailSentAt()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error("[sync-apollo-activity] last_email_sent_at recompute failed", { error: message })
      lastSentRecompute = { error: message }
    }

    if (runId) {
      await supabase
        .from("apollo_sync_runs")
        .update({
          finished_at: new Date().toISOString(),
          synced_count: result.updated,
          total_count: result.total,
          error_count: result.errorCount,
          last_error: result.lastError,
        } as any)
        .eq("id", runId)
    }

    return NextResponse.json({ ok: true, ...result, emailEvents, lastSentRecompute })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error("sync-apollo-activity cron failed", { error: err })
    if (runId) {
      await supabase
        .from("apollo_sync_runs")
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
