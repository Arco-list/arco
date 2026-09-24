import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { isStripeLiveMode } from "@/lib/stripe/rest"

/**
 * What "already subscribed" means, in one place.
 *
 * Lifted out of the actions module because a "use server" file turns
 * every export into a callable endpoint, and these are plumbing: a
 * constant and a lookup that takes a company id from its caller. An
 * endpoint that accepts one would let anyone name a company that is
 * not theirs.
 */

export type Failure = {
  error:
    | "not_signed_in" | "no_company" | "not_owner" | "not_configured"
    | "failed" | "not_ready" | "already_subscribed" | "nothing_to_replace" | "no_saved_method"
    | "nothing_to_switch" | "same_interval" | "payment_declined"
  /** Stripe's own sentence, when there was one. Never shown to a
   *  reader — "No such tax rate" is our configuration problem, not
   *  theirs — but carried so the webhook can write it down instead of
   *  leaving us to find it by hand in a dashboard. */
  detail?: string
}

/** Statuses that mean the company is already paying, or owes us. */
export const LIVE_STATUSES = ["active", "trialing", "past_due", "unpaid"]

/**
 * Whether this company already has a subscription worth protecting.
 *
 * Nothing stopped a second one before, so a reader who pressed twice —
 * or came back to a tab — got charged twice. Keyed on the company
 * rather than the Stripe customer, because a customer is created per
 * attempt until the first subscription pins one down.
 */
export async function hasLiveSubscription(companyId: string): Promise<boolean> {
  const { data } = await createServiceRoleSupabaseClient()
    .from("subscriptions")
    .select("status, livemode")
    .eq("company_id", companyId)
    .maybeSingle()

  const row = data as { status?: string; livemode?: boolean | null } | null
  // A row from the other Stripe must not block a real purchase. One
  // database serves every environment, so a test checkout on a dev
  // server leaves a row here that this guard would otherwise read as
  // "already subscribed" — refusing the live customer at the till with
  // nothing on their side to show why.
  if ((row?.livemode ?? true) !== isStripeLiveMode()) return false
  return Boolean(row?.status && LIVE_STATUSES.includes(row.status))
}
