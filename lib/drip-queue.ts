import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"
import {
  BUSINESS_END_HOUR,
  BUSINESS_START_HOUR,
  SLOT_INTERVAL_MIN,
  nextBusinessSlot,
} from "@/lib/date-utils"

/**
 * Drip-queue cancellation helper.
 *
 * Single source of truth for "stop sending pending drip rows for this
 * company / email / user". Used by every cancellation trigger:
 *
 *   - claimCompanyAction (a company being claimed cancels its sequence)
 *   - updateCompanyStatusAction (status -> removed/deactivated/added)
 *   - the Resend webhook (bounce / complaint on a prospect template)
 *   - deleteUserAction (user deletion cancels their pending rows)
 *   - cancelProspectSequenceAction (admin manual cancel button — PR 5)
 *
 * The cancellation rule is consistent everywhere:
 *
 *   UPDATE email_drip_queue
 *      SET cancelled_at = now(),
 *          cancelled_reason = $reason
 *    WHERE <selector>
 *      AND sent_at IS NULL
 *      AND cancelled_at IS NULL
 *
 * Already-sent or already-cancelled rows are never modified — cancellation
 * only stops *future* sends. The function is idempotent: calling it twice
 * with the same arguments is a no-op the second time.
 *
 * Selector is one of:
 *   - { companyId } — cancels all pending rows for that company
 *   - { email }     — cancels all pending rows to that recipient
 *   - { userId }    — cancels all pending rows linked to that user (and
 *                     ALSO cancels by the user's profile email if known
 *                     via a separate JOIN, since prospect rows don't
 *                     populate user_id but are matched by email)
 *
 * If multiple selectors are passed they are OR'd: cancel rows matching
 * ANY of the criteria. This matches the deleteUserAction case where we
 * want to cancel both user_id-linked rows (welcome series) AND email-
 * linked rows (prospect series targeting the same address).
 *
 * Returns the number of rows actually cancelled (0 if nothing matched
 * or everything was already cancelled). Never throws — Supabase errors
 * are logged at error level and the function returns 0.
 */

export type CancellationReason =
  | "claimed"             // company claimed by a user
  | "status_change"       // funnel advanced to signup/draft/listed — the
                          //  outreach series no longer applies
  | "bounced"             // Resend bounce event
  | "complained"          // Resend complaint event
  | "unsubscribed"        // recipient clicked the List-Unsubscribe link
  | "replied"             // recipient replied to a marketing send (Gmail
                          //  sync detected the reply)
  | "user_deleted"        // user account deleted
  | "paused"              // admin clicked Pause — resume will re-enqueue
  | "manual"              // admin clicked Finish sequence (hard stop)
  | "max_attempts"        // cron gave up after MAX_ATTEMPTS retries
  | "unknown_template"    // template not found in email-service.ts

export interface CancelDripRowsArgs {
  companyId?: string | null
  email?: string | null
  userId?: string | null
  reason: CancellationReason
}

export async function cancelPendingDripRows(
  // Accept any Supabase client — service-role for server-side admin actions,
  // or the action client when the caller is already authenticated.
  // deno-lint-ignore no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  args: CancelDripRowsArgs,
): Promise<number> {
  const { companyId, email, userId, reason } = args

  if (!companyId && !email && !userId) {
    logger.warn("cancelPendingDripRows called with no selectors", { reason })
    return 0
  }

  // Build a list of OR conditions for the .or() filter. The Supabase JS
  // client uses postgrest's `or=(a.eq.X,b.eq.Y)` syntax for top-level OR,
  // and we have to escape commas inside string values (none in our case
  // since these are uuids and emails). For maintainability we run separate
  // UPDATEs per selector and sum the row counts — clearer than building a
  // hand-rolled OR filter and faster to debug if a future selector is added.
  let totalCancelled = 0

  const cancelBy = async (
    column: "company_id" | "email" | "user_id",
    value: string,
  ) => {
    const { data, error } = await supabase
      .from("email_drip_queue")
      .update({
        cancelled_at: new Date().toISOString(),
        cancelled_reason: reason,
      })
      .eq(column, value)
      .is("sent_at", null)
      .is("cancelled_at", null)
      .select("id")

    if (error) {
      logger.error(`drip-queue: cancellation failed (${column})`, {
        column,
        value,
        reason,
        supabaseError: error,
      })
      return 0
    }
    return data?.length ?? 0
  }

  if (companyId) totalCancelled += await cancelBy("company_id", companyId)
  if (email) totalCancelled += await cancelBy("email", email)
  if (userId) totalCancelled += await cancelBy("user_id", userId)

  if (totalCancelled > 0) {
    logger.info("drip-queue: cancelled pending rows", {
      reason,
      cancelled: totalCancelled,
      companyId: companyId ?? null,
      email: email ?? null,
      userId: userId ?? null,
    })
  }

  return totalCancelled
}

/**
 * Returns true when the company should be excluded from any prospect-style
 * email sequence (intro / followup / final) — i.e. when its `audience` is
 * `'pro'`. Photographer companies live behind audience='pro' and are
 * surfaced via the project spec-bar credit, not via outbound prospect
 * sequences. Reusing the same `email_drip_queue` table for them would
 * spam unrelated email addresses (the company's `info@` derived from
 * Google Places) with templates aimed at architects.
 *
 * Call this guard before any `.from("email_drip_queue").insert(...)` that
 * targets a `company_id`. Returns false (do enqueue) when the company is
 * homeowner-facing or when the lookup fails — fail-open by design so a
 * transient DB error doesn't silently disable the whole prospect funnel.
 */
export async function isProAudienceCompany(
  supabase: SupabaseClient,
  companyId: string | null | undefined,
): Promise<boolean> {
  if (!companyId) return false
  const { data, error } = await supabase
    .from("companies")
    .select("audience")
    .eq("id", companyId)
    .maybeSingle()
  if (error) {
    logger.warn("drip-queue: audience lookup failed; defaulting to enqueue", { companyId, error: error.message })
    return false
  }
  return (data as any)?.audience === "pro"
}

/**
 * Allocate the next available send slot in the day's BUSINESS_START_HOUR–
 * BUSINESS_END_HOUR Europe/Amsterdam window, rolling forward to the next
 * business day if the day's slots are full.
 *
 * Why slot-allocation instead of a fixed time: a single-tick burst of N
 * sends from a low-volume domain is the worst signal we can give to spam
 * filters. Spreading consecutive sends 5 minutes apart caps the burst rate
 * at ~1/min and makes the daily volume cap ((END-START)*60/INTERVAL = 24)
 * implicit — no counter table needed.
 *
 * Algorithm:
 *   1. Snap baseDate forward to the next valid business slot (skip
 *      weekends + clamp to BUSINESS_START_HOUR if before the window).
 *      Defensive — most callers pass nextBusinessSlot() output already.
 *   2. Query the queue for the latest non-final send_at on baseDate's
 *      Amsterdam day within the window.
 *   3. Next slot = max(baseDate, lastUsed + SLOT_INTERVAL_MIN).
 *   4. If that slot is past BUSINESS_END_HOUR, roll to next business day
 *      and recurse. Capped at 30 days lookahead so we never loop forever.
 *
 * Concurrency note: two enqueues racing can both claim the same slot.
 * Acceptable in single-admin scope — collisions surface as "two sends in
 * one cron tick" which is bounded by the tick interval anyway. If we
 * grow to multi-admin enqueueing, add SELECT FOR UPDATE here.
 */
export async function claimNextSendSlot(
  supabase: SupabaseClient,
  baseDate: Date,
  lookaheadDays: number = 0,
): Promise<Date> {
  if (lookaheadDays > 30) {
    // Defensive ceiling — should be unreachable. Fall back to the bare
    // baseDate so the caller doesn't crash.
    logger.warn("claimNextSendSlot: 30-day lookahead exhausted; falling back", {
      baseDate: baseDate.toISOString(),
    })
    return baseDate
  }

  // Snap baseDate to the next valid window start. nextBusinessSlot(0)
  // handles weekend + before-9 cases. Note: we pass `baseDate` as the
  // "now" reference so the snap is relative to the requested day.
  const snapped = nextBusinessSlot(0, baseDate)

  // Compute the day's window bounds in UTC. snapped is already at
  // BUSINESS_START_HOUR Amsterdam — the window length in real time is
  // (END_HOUR - START_HOUR) hours.
  const windowStart = snapped
  const windowEnd = new Date(
    windowStart.getTime() + (BUSINESS_END_HOUR - BUSINESS_START_HOUR) * 60 * 60 * 1000,
  )

  // Latest existing send_at in this day's window for any pending row
  // (across templates / sequences — slot allocation is global, not
  // per-template, since the burst rate is what receiving servers see).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("email_drip_queue")
    .select("send_at")
    .gte("send_at", windowStart.toISOString())
    .lt("send_at", windowEnd.toISOString())
    .is("sent_at", null)
    .is("cancelled_at", null)
    .order("send_at", { ascending: false })
    .limit(1)

  const lastUsedIso = (existing as Array<{ send_at: string }> | null)?.[0]?.send_at ?? null
  const lastUsed = lastUsedIso ? new Date(lastUsedIso) : null
  const candidate = lastUsed
    ? new Date(Math.max(windowStart.getTime(), lastUsed.getTime() + SLOT_INTERVAL_MIN * 60 * 1000))
    : windowStart

  // If the candidate slot is past the window's end, roll to next
  // business day. Recursion bottom-outs once we find a day with room.
  if (candidate.getTime() >= windowEnd.getTime()) {
    const nextDay = nextBusinessSlot(1, snapped)
    return claimNextSendSlot(supabase, nextDay, lookaheadDays + 1)
  }

  return candidate
}
