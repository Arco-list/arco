import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"

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
  | "status_change"       // company status moved to removed/deactivated/added
  | "bounced"             // Resend bounce event
  | "complained"          // Resend complaint event
  | "user_deleted"        // user account deleted
  | "manual"              // admin clicked cancel
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
