import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { isWithinSendWindow } from "@/lib/date-utils"

/**
 * Daily auto-release — pushes prospects from Prospect → Contacted by
 * starting their sequence, without the manual morning ritual on
 * /admin/sales.
 *
 * BOTH COLD TRACKS, ONE BUDGET. Outreach (apollo) and Showcase (arco)
 * are released together and share one daily cap, because the cap
 * protects one sending domain and that domain does not care which
 * sequence spent it. Two independent caps would have been two ways to
 * send twice as much. Which pitch a contact gets is decided by
 * startProspectSequence, which upgrades an apollo contact at a
 * showcased company to the showcase story.
 *
 * Invites are NOT here — they go out through dispatch-pending-invites
 * hourly, uncapped, because an invite is a reply to something a pro
 * already did on the platform rather than a cold approach.
 *
 * Pacing model:
 *   - Adaptive daily cap (20 -> 60 warm-up ramp), weekdays only (see vercel.json:
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
 * Selection: oldest un-started prospects first (FIFO), skipping
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

// ── Adaptive daily cap (domain warm-up) ─────────────────────────────
// Ramps +25% per week from BASE_DAILY_CAP up to MAX_DAILY_CAP, but only
// while the trailing 7 days look healthy (bounce < RAMP_HOLD_BOUNCE_PCT
// with a minimum sample, fewer than RAMP_HOLD_COMPLAINTS complaints).
// Unhealthy weeks hold at the base cap — the ramp resumes on the
// schedule once metrics are clean again, it never "catches up" with a
// burst. The 48h hard bounce guard below still halts releases outright.
const BASE_DAILY_CAP = 20
// 50, not 60: the ceiling the warm-up climbs to. More per day buys
// nothing at a 0.6% claim rate, and leaves less room under the window
// for the mail that is not outreach.
const MAX_DAILY_CAP = 50
const RAMP_FACTOR = 1.25
// Week 0 = the Monday the current sending domain started. Week 1 → 25,
// then 31, 39, 49, 60.
//
// RESET ON 2 OCTOBER 2026, when sales and invite moved to
// mail.arcolist.com. A warm-up schedule measures the reputation of the
// domain that is actually sending, and that domain was one day old: the
// six weeks of good behaviour behind the old date belonged to
// arcolist.com and did not transfer. Leaving it would have opened a
// fresh subdomain at 60 a day, which is how a new domain gets filtered
// before anyone has read a word of it.
//
// It also relieves the queue. The send window is 09:00–11:00 at
// five-minute slots — 24 a day — while this was releasing up to 60.
// That 2.5x oversubscription is what slid every scheduled mail forward
// until a day-3 follow-up and a day-10 final landed in the same minute.
// At 20 the window stops overflowing and that collapse stops happening.
const RAMP_START_UTC = Date.UTC(2026, 9, 5)
const RAMP_HOLD_BOUNCE_PCT = 3
const RAMP_HOLD_MIN_SENDS = 30
const RAMP_HOLD_COMPLAINTS = 2
// Ceiling per invocation, even when invoked manually with a full
// day's budget remaining — protects against a burst.
const PER_RUN_CAP = 8
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

  // ── Only enrol while the window is open ─────────────────────────────
  // The cron is `0 7-15 * * 1-5` in UTC, which it has to be: Amsterdam
  // is UTC+1 or UTC+2 depending on the season, so a cron narrow enough
  // for summer would miss an hour of winter. It therefore runs to 17:00
  // local in summer — two hours past the window.
  //
  // That mattered little when the intro was sent on the spot (it simply
  // went out late). Now that it is scheduled, a late run would book
  // prospects onto TOMORROW while spending TODAY's cap — and the budget
  // below, which measures today, would not see them and would release
  // another batch tomorrow on top. Capping by day only works if a day's
  // releases land on that day.
  if (!isWithinSendWindow(now)) {
    return NextResponse.json({ ok: true, released: 0, reason: "outside send window" })
  }

  // ── Adaptive cap: warm-up schedule gated on trailing-7d health ──────
  const weeksSinceRampStart = Math.max(0, Math.floor((now.getTime() - RAMP_START_UTC) / (7 * 24 * 3600 * 1000)))
  const scheduledCap = Math.min(MAX_DAILY_CAP, Math.round(BASE_DAILY_CAP * Math.pow(RAMP_FACTOR, weeksSinceRampStart)))
  let dailyCap = scheduledCap
  let rampHeld: string | null = null
  if (scheduledCap > BASE_DAILY_CAP) {
    const healthSince = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString()
    const [{ count: sent7d }, { count: bounced7d }, { count: complained7d }] = await Promise.all([
      supabase.from("email_events").select("id", { count: "exact", head: true })
        .eq("event_type", "sent").gte("occurred_at", healthSince),
      supabase.from("email_events").select("id", { count: "exact", head: true })
        .eq("event_type", "bounced").gte("occurred_at", healthSince),
      supabase.from("email_events").select("id", { count: "exact", head: true })
        .eq("event_type", "complained").gte("occurred_at", healthSince),
    ])
    const s7 = sent7d ?? 0
    const b7 = bounced7d ?? 0
    const c7 = complained7d ?? 0
    if (s7 >= RAMP_HOLD_MIN_SENDS && b7 / s7 > RAMP_HOLD_BOUNCE_PCT / 100) {
      dailyCap = BASE_DAILY_CAP
      rampHeld = `bounce ${b7}/${s7} in 7d > ${RAMP_HOLD_BOUNCE_PCT}%`
    } else if (c7 >= RAMP_HOLD_COMPLAINTS) {
      dailyCap = BASE_DAILY_CAP
      rampHeld = `${c7} complaints in 7d`
    }
    if (rampHeld) {
      logger.warn("[release-outreach-batch] ramp held at base cap", { scheduledCap, rampHeld })
    }
  }

  // ── Budget: how much of today's cap is already spent ────────────────
  // Counts intros BOOKED for today, not merely sent — the two differ
  // now that an intro is a queue row with a send_at a few minutes out.
  // Counting only email_events would miss everything this run and the
  // previous one just scheduled, and release the same budget twice
  // within the hour.
  //
  // Not just cron-triggered ones: manual releases from /admin/sales and
  // the showcase button spend the same budget, so a hand-started
  // morning batch can't be doubled by the afternoon runs.
  //
  // BOTH INTROS COUNT, and so does the invite intro. The cap protects
  // one sending domain, so it is one budget: every cold opener costs
  // the same reputation. Counting only outreach-intro would let the
  // others ride along for free and quietly multiply the day's volume.
  //
  // email_events is still consulted and the LARGER number wins: intros
  // sent before they were queued leave no queue row, so on any day
  // straddling that change the send log is the higher, safer count.
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
  const dayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString()
  const INTRO_TEMPLATES = ["outreach-intro", "prospect-intro", "new-professional-invite"]
  const [{ count: bookedToday }, { count: sentToday }] = await Promise.all([
    supabase
      .from("email_drip_queue")
      .select("id", { count: "exact", head: true })
      .in("template", INTRO_TEMPLATES)
      .is("cancelled_at", null)
      .gte("send_at", dayStart)
      .lt("send_at", dayEnd),
    supabase
      .from("email_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "sent")
      .in("template", INTRO_TEMPLATES)
      .gte("occurred_at", dayStart),
  ])
  const startedToday = Math.max(bookedToday ?? 0, sentToday ?? 0)
  const remaining = dailyCap - startedToday
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

  // ── Candidates: oldest un-started prospects, clean addresses ────────
  // Apollo AND Arco. Which pitch each one gets is not decided here:
  // startProspectSequence reads the company's status and upgrades an
  // apollo contact at a showcased company to the showcase story, so
  // both sources arrive at the right mail through one path.
  const { data: candidates, error: candidateError } = await supabase
    .from("prospects")
    .select("id, email, company_name, company_id, source, companies(status)")
    .in("source", ["apollo", "arco"])
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
  // Verified-and-beyond companies stay excluded: the firm already
  // converted, so a cold pitch to a colleague there (contact stage
  // rightly still 'prospect') would sell a company that is already on
  // Arco.
  //
  // 'prospected' USED TO SIT IN THIS LIST, because the showcase pitch
  // was started by hand. It is released automatically now, under the
  // same cap and the same bounce guard — those protect a sending
  // domain, and the domain does not care which sequence spent it.
  const INELIGIBLE_COMPANY_STATUS = new Set(["verified", "owned", "listed", "unlisted"])
  const eligible = (candidates ?? []).filter((p) => {
    const row = p as { source?: string; company_id?: string | null; companies?: { status?: string | null } | null }
    if (INELIGIBLE_COMPANY_STATUS.has(row.companies?.status ?? "")) return false
    // The showcase pitch points at a company page, so it needs a
    // company. An arco row without one cannot be sent and would only
    // churn through the failure list every run.
    if (row.source === "arco" && !row.company_id) return false
    return true
  })
  if (eligible.length === 0) {
    return NextResponse.json({ ok: true, released: 0, reason: "no eligible prospects" })
  }

  const { startProspectSequence } = await import("@/app/admin/sales/actions")
  const released: string[] = []
  const failures: Array<{ email: string; error: string }> = []
  for (const p of eligible) {
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
    dailyCap, scheduledCap, rampHeld,
  })
  return NextResponse.json({ ok: true, released: released.length, emails: released, failures, budget: { dailyCap, scheduledCap, rampHeld, startedToday, perRun } })
}
