import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { isStripeLiveMode } from "@/lib/stripe/rest"

/**
 * The billing state of one company, as the product sees it.
 *
 * Reads the local mirror (public.subscriptions), never Stripe — rendering
 * a dashboard must not depend on a network call to a payment provider.
 * The webhook keeps the mirror in step; Stripe stays the source of truth.
 */

/** Stripe's own subscription statuses, stored verbatim. */
export type StripeSubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused"

export type CompanyBilling = {
  /** What the company is entitled to right now. */
  plan: "free" | "pro"
  /**
   * Why they hold that plan — the three are shown very differently:
   *   subscription → they pay (or are in Stripe's grace states)
   *   founding     → the launch-period promise, no Stripe object at all
   *   none         → Free, nothing to show but the upgrade path
   */
  source: "subscription" | "founding" | "none"
  status: StripeSubscriptionStatus | null
  interval: "month" | "year" | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  trialEnd: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  /** When the founding claim was stamped, for the founding copy. */
  foundingClaimedAt: string | null
  /**
   * While in the future: a repair payment is in transit, so `unpaid`
   * here means "being paid", not "owed and abandoned". Travels with
   * the billing object because two separate rules need it — what the
   * company may use, and what the banner should say — and deriving it
   * twice is how those two drifted apart before.
   */
  collectionPendingUntil: string | null
}

/**
 * The entitlement rule moved to ./entitlement, which has no imports at
 * all and can therefore be tested. Re-exported here because a dozen
 * callers ask this module for it, and a rename across all of them
 * would be churn for no gain.
 */
export { isEntitled, isEntitledNow, ENTITLED, ALIVE } from "@/lib/subscriptions/entitlement"
import { isEntitledNow, ALIVE } from "@/lib/subscriptions/entitlement"


export async function getCompanyBilling(companyId: string): Promise<CompanyBilling> {
  const supabase = createServiceRoleSupabaseClient()

  const [{ data: sub }, { data: company }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("status, billing_interval, current_period_end, cancel_at_period_end, trial_end, stripe_customer_id, stripe_subscription_id, collection_pending_until, livemode")
      .eq("company_id", companyId)
      .maybeSingle(),
    supabase
      .from("companies")
      .select("founding_claimed_at")
      .eq("id", companyId)
      .maybeSingle(),
  ])

  const row = sub as {
    status?: string
    billing_interval?: string | null
    current_period_end?: string | null
    cancel_at_period_end?: boolean
    trial_end?: string | null
    stripe_customer_id?: string | null
    stripe_subscription_id?: string | null
    collection_pending_until?: string | null
    livemode?: boolean | null
  } | null

  const foundingClaimedAt =
    (company as { founding_claimed_at?: string | null } | null)?.founding_claimed_at ?? null

  // A subscription from the other Stripe is not this app's to honour.
  //
  // One database serves localhost, preview and arcolist.com, and the
  // checkout writes its own mirror row before any webhook — so a test
  // checkout on a dev server put an `active` row in the table the live
  // site reads, and the live site handed out Pro for it.
  //
  // Not "test never counts": on a dev server a test subscription MUST
  // count, or the product cannot be tested. It counts where it belongs.
  // Rows from the other mode are treated as absent rather than as
  // cancelled, so the reader sees the free plan and no stale invoice
  // history from a Stripe this app cannot reach.
  const sameMode = (row?.livemode ?? true) === isStripeLiveMode()

  if (row?.status && ALIVE.has(row.status) && sameMode) {
    return {
      // Access follows entitlement; everything else on this object
      // describes the subscription, which outlives it. An unpaid
      // company reads as free and still sees what it owes.
      plan: isEntitledNow(row.status, row.collection_pending_until) ? "pro" : "free",
      source: "subscription",
      status: row.status as StripeSubscriptionStatus,
      interval: (row.billing_interval as "month" | "year" | null) ?? null,
      currentPeriodEnd: row.current_period_end ?? null,
      cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
      trialEnd: row.trial_end ?? null,
      stripeCustomerId: row.stripe_customer_id ?? null,
      stripeSubscriptionId: row.stripe_subscription_id ?? null,
      foundingClaimedAt,
      collectionPendingUntil: row.collection_pending_until ?? null,
    }
  }

  // Founding access is the launch-period promise: Pro without a Stripe
  // object. It ranks below a real subscription, so a founding company
  // that later subscribes reads as a subscriber.
  if (foundingClaimedAt) {
    return {
      plan: "pro",
      source: "founding",
      status: null,
      interval: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      trialEnd: null,
      stripeCustomerId: row?.stripe_customer_id ?? null,
      stripeSubscriptionId: null,
      foundingClaimedAt,
      collectionPendingUntil: null,
    }
  }

  return {
    plan: "free",
    // A cancelled or expired subscription still leaves a Stripe customer
    // behind — worth keeping so the portal link and invoice history work.
    // Not across modes though: an id from the other Stripe would send
    // the reader's invoice list at an account this app cannot read.
    source: "none",
    status: (row?.status as StripeSubscriptionStatus | undefined) ?? null,
    interval: null,
    currentPeriodEnd: row?.current_period_end ?? null,
    cancelAtPeriodEnd: false,
    trialEnd: null,
    stripeCustomerId: sameMode ? row?.stripe_customer_id ?? null : null,
    stripeSubscriptionId: sameMode ? row?.stripe_subscription_id ?? null : null,
    foundingClaimedAt: null,
    collectionPendingUntil: null,
  }
}
