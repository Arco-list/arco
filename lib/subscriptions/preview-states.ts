import type { CompanyBilling } from "@/lib/subscriptions/get-company-subscription"

/**
 * Synthetic billing states for the admin preview.
 *
 * The new plan/billing page has to read well in states that are rare,
 * slow to reach, or impossible to produce on demand — a past-due direct
 * debit, a subscription cancelling at period end, a founding company on
 * the day billing starts. Creating real Stripe objects for each one is
 * both slow and, in live mode, irresponsible. These are display-only
 * fixtures: nothing here is ever written, and the page renders them
 * through exactly the same code path as real data.
 */

export const PREVIEW_STATES = [
  "free",
  "founding",
  "trialing",
  "active_year",
  "active_month",
  "past_due",
  "canceling",
  "canceled",
] as const

export type PreviewState = (typeof PREVIEW_STATES)[number]

export const PREVIEW_LABELS: Record<PreviewState, string> = {
  free: "Free — no subscription",
  founding: "Founding access",
  trialing: "Trialing",
  active_year: "Active — billed annually",
  active_month: "Active — billed monthly",
  past_due: "Past due — collection failed",
  canceling: "Cancelling at period end",
  canceled: "Canceled — back on Free",
}

export const PREVIEW_NOTES: Record<PreviewState, string> = {
  free: "The default for every company today. Shows the plans below.",
  founding: "Pro without a Stripe object — the launch-period promise. 2 companies are in this state right now.",
  trialing: "Not reachable in product: D2 decided against trials. Kept so the page never breaks if Stripe reports one.",
  active_year: "The state we steer people to: €468 a year by direct debit.",
  active_month: "€49 a month — the low-friction entry the pricing page already promises.",
  past_due: "A collection that failed. The company keeps access while dunning runs (D6).",
  canceling: "Cancelled but still inside the paid period. Access holds until the end date.",
  canceled: "The period ran out. Pro is gone, the Stripe customer stays for invoice history.",
}

const daysFromNow = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

const base: CompanyBilling = {
  plan: "free",
  source: "none",
  status: null,
  interval: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  trialEnd: null,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  foundingClaimedAt: null,
}

export function previewBilling(state: PreviewState): CompanyBilling {
  switch (state) {
    case "founding":
      return { ...base, plan: "pro", source: "founding", foundingClaimedAt: daysFromNow(-34) }
    case "trialing":
      return {
        ...base, plan: "pro", source: "subscription", status: "trialing",
        interval: "year", trialEnd: daysFromNow(9), currentPeriodEnd: daysFromNow(9),
        stripeCustomerId: "cus_preview", stripeSubscriptionId: "sub_preview",
      }
    case "active_year":
      return {
        ...base, plan: "pro", source: "subscription", status: "active",
        interval: "year", currentPeriodEnd: daysFromNow(287),
        stripeCustomerId: "cus_preview", stripeSubscriptionId: "sub_preview",
      }
    case "active_month":
      return {
        ...base, plan: "pro", source: "subscription", status: "active",
        interval: "month", currentPeriodEnd: daysFromNow(17),
        stripeCustomerId: "cus_preview", stripeSubscriptionId: "sub_preview",
      }
    case "past_due":
      return {
        ...base, plan: "pro", source: "subscription", status: "past_due",
        interval: "year", currentPeriodEnd: daysFromNow(-3),
        stripeCustomerId: "cus_preview", stripeSubscriptionId: "sub_preview",
      }
    case "canceling":
      return {
        ...base, plan: "pro", source: "subscription", status: "active",
        interval: "year", currentPeriodEnd: daysFromNow(62), cancelAtPeriodEnd: true,
        stripeCustomerId: "cus_preview", stripeSubscriptionId: "sub_preview",
      }
    case "canceled":
      return {
        ...base, status: "canceled", currentPeriodEnd: daysFromNow(-11),
        stripeCustomerId: "cus_preview", stripeSubscriptionId: "sub_preview",
      }
    case "free":
    default:
      return base
  }
}

export function isPreviewState(value: string | undefined): value is PreviewState {
  return Boolean(value && (PREVIEW_STATES as readonly string[]).includes(value))
}
