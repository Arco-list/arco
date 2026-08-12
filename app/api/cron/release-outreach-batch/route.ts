import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"

/**
 * Daily outreach auto-release — pushes prospects from Prospect →
 * Contacted by starting their outreach sequence, without the manual
 * morning ritual on /admin/sales.
 *
 * Pacing model:
 *   - DAILY_CAP intros per day (20), weekdays only (see vercel.json:
 *     schedule `0 7-15 * * 1-5` = hourly 09:00–17:00 Amsterdam in
 *     summer). Nine runs share the budget: each run sends
 *     ceil(remaining / runs-left), so ~2–3 per hour — sends spread
 *     through the business day instead of one 09:00 burst.
 *   - Weekends deliberately excluded: B2B open/reply rates crater and
 *     a Saturday drip reads as automation. The follow-up scheduler
 *     (nextBusinessSlot) already skips weekends for steps 2/3.
 *
 * Reputation guard: if the last 48h show a bounce rate above
 * BOUNCE_GUARD_PCT (with a minimum sample), the release skips
 * entirely — a bad-list day should stop the machine, not scale it.
 * (The Aug 11 incident: a blacklisted shared click-tracking domain
 * pushed bounce to 15%; this guard would have halted intros after
 * the first hour.)
 *
 * Selection: oldest un-started Apollo prospects first (FIFO), skipping
 * bounced / unsubscribed / complained rows. Each successful start is
 * recorded as a prospect_events row (sequence_auto_started) — that
 * event count is also how the run knows how much of today's budget
 * is already spent, so manual re-invocations can't double-send.
 *
 * Auth: Vercel Cron `Authorization: Bearer ${CRON_SECRET}` (or
 * ?secret= for manual runs, same as the other crons).
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

const DAILY_CAP = 20
// Ceiling per invocation, even when invoked manually with a full
// day's budget remaining — protects against a 20-intro burst.
const PER_RUN_CAP = 5
const BOUNCE_GUARD_PCT = 8
const BOUNCE_GUARD_MIN_SENDS = 20
// Cron fires hourly at 7..15 UTC (see vercel.json).
const LAST_RUN_HOUR_UTC = 15

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
  const now = new Date()

  // ── Budget: how much of today's cap is already spent ────────────────
  // Counts ACTUAL outreach-intro sends today (email_events), not just
  // cron-triggered ones — manual releases from /admin/sales spend the
  // same 20/day budget, so a hand-started morning batch can't be
  // doubled by the afternoon cron runs.
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
  const { count: startedToday } = await supabase
    .from("email_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "sent")
    .eq("template", "outreach-intro")
    .gte("occurred_at", dayStart)
  const remaining = DAILY_CAP - (startedToday ?? 0)
  if (remaining <= 0) {
    return NextResponse.json({ ok: true, released: 0, reason: "daily cap reached", startedToday })
  }

  // ── Reputation guard ────────────────────────────────────────────────
  const guardSince = new Date(now.getTime() - 48 * 3600 * 1000).toISOString()
  const [{ count: recentSent }, { count: recentBounced }] = await Promise.all([
    supabase.from("email_events").select("id", { count: "exact", head: true })
      .eq("event_type", "sent").gte("occurred_at", guardSince),
    supabase.from("email_events").select("id", { count: "exact", head: true })
      .eq("event_type", "bounced").gte("occurred_at", guardSince),
  ])
  const sent = recentSent ?? 0
  const bounced = recentBounced ?? 0
  if (sent >= BOUNCE_GUARD_MIN_SENDS && bounced / sent > BOUNCE_GUARD_PCT / 100) {
    logger.warn("[release-outreach-batch] bounce guard tripped — release skipped", { sent, bounced })
    return NextResponse.json({
      ok: true, released: 0,
      reason: `bounce guard: ${bounced}/${sent} bounced in 48h (> ${BOUNCE_GUARD_PCT}%)`,
    })
  }

  // ── Per-run share: spread the remaining budget over remaining runs ──
  const hour = now.getUTCHours()
  const runsLeft = Math.max(1, LAST_RUN_HOUR_UTC - hour + 1)
  const perRun = Math.min(Math.ceil(remaining / runsLeft), PER_RUN_CAP, remaining)

  // ── Candidates: oldest un-started Apollo prospects, clean addresses ─
  const { data: candidates, error: candidateError } = await supabase
    .from("prospects")
    .select("id, email, company_name")
    .eq("source", "apollo")
    .eq("status", "prospect")
    .eq("sequence_status", "not_started")
    .is("bounced_at", null)
    .is("unsubscribed_at", null)
    .is("complained_at", null)
    .like("email", "%@%")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(perRun)
  if (candidateError) {
    return NextResponse.json({ error: candidateError.message }, { status: 500 })
  }
  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ ok: true, released: 0, reason: "no eligible prospects" })
  }

  const { startProspectSequence } = await import("@/app/admin/sales/actions")
  const released: string[] = []
  const failures: Array<{ email: string; error: string }> = []
  for (const p of candidates) {
    try {
      const result = await startProspectSequence(p.id)
      if (result.success) {
        released.push(p.email)
        await supabase.from("prospect_events").insert({
          prospect_id: p.id,
          event_type: "sequence_auto_started",
          event_source: "cron",
          metadata: { email: p.email, company_name: p.company_name },
        })
      } else {
        failures.push({ email: p.email, error: result.error ?? "unknown" })
      }
    } catch (err) {
      failures.push({ email: p.email, error: err instanceof Error ? err.message : String(err) })
    }
    // Gentle pacing between sends within a run.
    await new Promise((r) => setTimeout(r, 1000))
  }

  logger.info("[release-outreach-batch] run complete", {
    released: released.length, failures: failures.length, perRun, remaining, runsLeft,
  })
  return NextResponse.json({ ok: true, released: released.length, emails: released, failures, budget: { dailyCap: DAILY_CAP, startedToday: startedToday ?? 0, perRun } })
}
