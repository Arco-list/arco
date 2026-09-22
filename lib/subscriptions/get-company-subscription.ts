import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

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
 * Statuses that still carry entitlements.
 *
 * `past_due` is included and `unpaid` is not, and the line between them
 * is Stripe's own: past_due means the retries are still running, and
 * with SEPA a collection takes days — a company that just committed to
 * €468 must not lose its page while the bank moves. `unpaid` means
 * every retry has been spent. That is dunning finishing its work, not
 * a status flag being read too eagerly.
 *
 * An unpaid subscription is not gone, though: Stripe keeps it, and
 * paying the outstanding invoice brings it back to active. So the page
 * still renders it — see `plan` below, which drops to free while the
 * subscription itself stays on screen with its invoice and a way to
 * settle it.
 */
const ENTITLED: ReadonlySet<string> = new Set(["trialing", "active", "past_due"])

/** Statuses where a subscription still exists at Stripe, entitled or not. */
const ALIVE: ReadonlySet<string> = new Set([...ENTITLED, "unpaid"])

export function isEntitled(status: string | null | undefined): boolean {
  return Boolean(status && ENTITLED.has(status))
}

/**
 * Entitled, or paying to become entitled again.
 *
 * `past_due` is already in ENTITLED because Stripe puts a subscription
 * there for the days a SEPA debit spends in transit, and taking the
 * product away for those days would punish people for using the method
 * we steer them towards. The trip back from `unpaid` is the same
 * journey with a different label on it: a working mandate given, a
 * fresh debit travelling, two to five working days of waiting.
 *
 * So what decides is whether money is moving, not the label. The
 * deadline is written when a repair starts collecting and expires by
 * itself, so a debit that quietly fails costs a few days of access
 * rather than granting Pro forever.
 */
export function isEntitledNow(
  status: string | null | undefined,
  collectionPendingUntil: string | null | undefined,
  /** How often Stripe has cancelled a subscription of this company for
   *  non-payment. Zero for almost everyone. */
  nonpaymentCancellations = 0,
  /** When this subscription's money first arrived, if it ever has. */
  firstPaymentAt: string | null | undefined = null,
): boolean {
  if (status === "trialing" || status === "active") return true

  // `past_due` is credit: the product, granted on a mandate, before the
  // money is in. Almost always right — a SEPA debit takes days and an
  // honest buyer should not wait for what they have bought.
  //
  // It is also the whole loophole, for one particular reader: give a
  // mandate on an empty account, take Pro, let the debit fail, keep it
  // through dunning, get cancelled, begin again. So the credit is
  // extended to anyone who has not already done this to us, and to any
  // subscription that has been paid for at least once — a renewal
  // failing after two good years is not the same event as a first
  // debit bouncing, however identical the status looks.
  if (status === "past_due") return nonpaymentCancellations === 0 || Boolean(firstPaymentAt)

  if (status !== "unpaid" || !collectionPendingUntil) return false
  return new Date(collectionPendingUntil).getTime() > Date.now()
}

export async function getCompanyBilling(companyId: string): Promise<CompanyBilling> {
  const supabase = createServiceRoleSupabaseClient()

  const [{ data: sub }, { data: company }] = await Promise.all([
    supabase
      .from("subscriptions" as never)
      .select("status, billing_interval, current_period_end, cancel_at_period_end, trial_end, stripe_customer_id, stripe_subscription_id, collection_pending_until, first_payment_at")
      .eq("company_id", companyId)
      .maybeSingle(),
    supabase
      .from("companies")
      .select("founding_claimed_at, nonpayment_cancellations")
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
    first_payment_at?: string | null
  } | null

  const companyRow = company as {
    founding_claimed_at?: string | null
    nonpayment_cancellations?: number | null
  } | null
  const foundingClaimedAt = companyRow?.founding_claimed_at ?? null
  const nonpaymentCancellations = companyRow?.nonpayment_cancellations ?? 0

  if (row?.status && ALIVE.has(row.status)) {
    return {
      // Access follows entitlement; everything else on this object
      // describes the subscription, which outlives it. An unpaid
      // company reads as free and still sees what it owes.
      plan: isEntitledNow(
        row.status,
        row.collection_pending_until,
        nonpaymentCancellations,
        row.first_payment_at,
      ) ? "pro" : "free",
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
    source: "none",
    status: (row?.status as StripeSubscriptionStatus | undefined) ?? null,
    interval: null,
    currentPeriodEnd: row?.current_period_end ?? null,
    cancelAtPeriodEnd: false,
    trialEnd: null,
    stripeCustomerId: row?.stripe_customer_id ?? null,
    stripeSubscriptionId: row?.stripe_subscription_id ?? null,
    foundingClaimedAt: null,
    collectionPendingUntil: null,
  }
}
