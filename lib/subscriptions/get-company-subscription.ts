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
}

/**
 * Statuses that still carry entitlements. `past_due` and `unpaid` are
 * deliberately included: with SEPA a collection takes days, and a
 * company that just committed to €468 must not lose its page while the
 * bank moves. Losing access is dunning's job (D6), on its own schedule —
 * not a side effect of a status flag.
 */
const ENTITLED: ReadonlySet<string> = new Set(["trialing", "active", "past_due", "unpaid"])

export function isEntitled(status: string | null | undefined): boolean {
  return Boolean(status && ENTITLED.has(status))
}

export async function getCompanyBilling(companyId: string): Promise<CompanyBilling> {
  const supabase = createServiceRoleSupabaseClient()

  const [{ data: sub }, { data: company }] = await Promise.all([
    supabase
      .from("subscriptions" as never)
      .select("status, billing_interval, current_period_end, cancel_at_period_end, trial_end, stripe_customer_id, stripe_subscription_id")
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
  } | null

  const foundingClaimedAt = (company as { founding_claimed_at?: string | null } | null)?.founding_claimed_at ?? null

  if (row?.status && isEntitled(row.status)) {
    return {
      plan: "pro",
      source: "subscription",
      status: row.status as StripeSubscriptionStatus,
      interval: (row.billing_interval as "month" | "year" | null) ?? null,
      currentPeriodEnd: row.current_period_end ?? null,
      cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
      trialEnd: row.trial_end ?? null,
      stripeCustomerId: row.stripe_customer_id ?? null,
      stripeSubscriptionId: row.stripe_subscription_id ?? null,
      foundingClaimedAt,
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
  }
}
