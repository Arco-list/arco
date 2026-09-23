import type { CompanyBilling } from "@/lib/subscriptions/get-company-subscription"
import type { BillingDetails } from "@/lib/subscriptions/billing-details-types"
import { FREE_CONTRIBUTOR_LIMIT, type ProjectUsage } from "@/lib/subscriptions/usage-types"

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
  "free_publisher",
  "free_both",
  "free_contributor",
  "pro_month",
  "pro_year",
  "processing",
  "past_due",
  "unpaid",
  "canceling",
  "returning",
] as const

export type PreviewState = (typeof PREVIEW_STATES)[number]

export const PREVIEW_LABELS: Record<PreviewState, string> = {
  free_publisher: "Free · publisher",
  free_both: "Free · both",
  free_contributor: "Free · contributor",
  pro_month: "Pro · monthly",
  pro_year: "Pro · yearly",
  processing: "Payment in progress",
  past_due: "Past due",
  unpaid: "Unpaid",
  canceling: "Cancelling",
  returning: "Returning",
}

export const PREVIEW_NOTES: Record<PreviewState, string> = {
  free_publisher: "An architect on Free: publishes, is credited by nobody yet. One bar.",
  free_both: "Both kinds of work, and the credit limit biting: 6 published, 2 credits, 1 of them held back.",
  free_contributor: "A photographer or kitchen builder: cannot publish, lives entirely off credits. One bar, 5 of 6 locked.",
  pro_month: "€49 a month. On Pro the split stops meaning anything, so the two bars become one.",
  pro_year: "The state we steer people to: €468 a year by direct debit.",
  processing: "A SEPA debit on its way — days in transit and nothing wrong. The state the banner used to call \"openstaand\" because Stripe marks the subscription past_due while it travels.",
  past_due: "A collection that failed. The company keeps access while dunning runs (D6).",
  unpaid: "Dunning has run out. Access is back to Free, the subscription is still there, and the open invoice is the way back.",
  canceling: "Cancelled but still inside the paid period. Access holds until the end date.",
  returning: "Paid once, on Free again, thinking about coming back. We still hold their mandate, so an upgrade should not ask for it twice.",
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
  collectionPendingUntil: null,
}

export function previewBilling(state: PreviewState): CompanyBilling {
  switch (state) {
    case "pro_year":
      return {
        ...base, plan: "pro", source: "subscription", status: "active",
        interval: "year", currentPeriodEnd: daysFromNow(287),
        stripeCustomerId: "cus_preview", stripeSubscriptionId: "sub_preview",
      }
    case "pro_month":
      return {
        ...base, plan: "pro", source: "subscription", status: "active",
        interval: "month", currentPeriodEnd: daysFromNow(17),
        stripeCustomerId: "cus_preview", stripeSubscriptionId: "sub_preview",
      }
    case "processing":
      return {
        ...base, plan: "pro", source: "subscription", status: "unpaid",
        interval: "year", currentPeriodEnd: daysFromNow(300),
        // The grant that makes this state coherent: Stripe still reads
        // unpaid, the money is on its way, and access holds until it
        // lands or the deadline runs out.
        collectionPendingUntil: daysFromNow(9),
      }

    case "past_due":
      return {
        ...base, plan: "pro", source: "subscription", status: "past_due",
        interval: "year", currentPeriodEnd: daysFromNow(-3),
        stripeCustomerId: "cus_preview", stripeSubscriptionId: "sub_preview",
      }
    // Every retry spent. The subscription survives — paying the open
    // invoice revives it — but it no longer carries entitlements, so
    // the plan reads free while the page still shows what is owed.
    case "unpaid":
      return {
        ...base, plan: "free", source: "subscription", status: "unpaid",
        interval: "year", currentPeriodEnd: daysFromNow(-34),
        stripeCustomerId: "cus_preview", stripeSubscriptionId: "sub_preview",
      }
    case "canceling":
      return {
        ...base, plan: "pro", source: "subscription", status: "active",
        interval: "year", currentPeriodEnd: daysFromNow(62), cancelAtPeriodEnd: true,
        stripeCustomerId: "cus_preview", stripeSubscriptionId: "sub_preview",
      }
    // Free again, but we have met before: no subscription, and a Stripe
    // customer that still carries the mandate from last time.
    case "returning":
      return { ...base, stripeCustomerId: "cus_preview" }
    default:
      return base
  }
}

export function isPreviewState(value: string | undefined): value is PreviewState {
  return Boolean(value && (PREVIEW_STATES as readonly string[]).includes(value))
}

/**
 * Payment method and invoices for the preview. A year of history is
 * exactly what the invoice table needs to be judged on — spacing,
 * alignment, how a long list sits under the bars — and it is the one
 * thing a fresh sandbox can never show.
 */
export function previewBillingDetails(state: PreviewState): BillingDetails {
  if (state.startsWith("free")) {
    return { configured: true, paymentMethod: null, identity: null, invoices: [] }
  }

  // A year of Pro that ended eight months ago, and the mandate still on
  // file. Cancelling a subscription does not revoke a payment method,
  // which is exactly why coming back should be one click.
  if (state === "returning") {
    return {
      configured: true,
    identity: {
      companyName: "Voorbeeld Architecten",
      line1: "Keizersgracht 123",
      postalCode: "1015 CJ",
      city: "Amsterdam",
      country: "NL",
      vatNumber: "NL001234567B01",
      email: "boekhouding@voorbeeld-architecten.nl",
    },
      paymentMethod: { type: "sepa_debit", label: "SEPA-incasso", last4: "5264", expiry: null },
      invoices: [
        {
          id: "in_preview_old",
          number: "A919F631-0004",
          created: new Date(Date.now() - 243 * 24 * 60 * 60 * 1000).toISOString(),
          total: "€ 566,28",
          status: "paid",
          processing: false,
          url: null,
          pdfUrl: null,
        },
      ],
    }
  }

  const monthly = state === "pro_month"
  const amount = monthly ? "€ 59,29" : "€ 566,28"
  const count = monthly ? 6 : 2

  const invoices = Array.from({ length: count }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (monthly ? i : i * 12))
    return {
      id: `in_preview_${i}`,
      number: `A919F631-${String(1000 + i).slice(1)}`,
      created: d.toISOString(),
      total: amount,
      // The most recent one carries the state being previewed; the rest
      // are settled history.
      status: i === 0 && (state === "past_due" || state === "unpaid" || state === "processing")
        ? "open"
        : "paid",
      // Only the state that is actually about a payment in transit.
      // past_due means the last attempt FAILED and the next is days
      // away; unpaid means they have run out. Marking past_due as
      // processing made that preview render "Betaling in behandeling"
      // — the opposite of the failed collection it exists to show.
      processing: i === 0 && state === "processing",
      // A fixture has no hosted invoice, so the link goes nowhere on
      // purpose. It is still rendered for an open one: the action is
      // part of what these two states are being previewed for, and a
      // row reading "—" hides the thing under review.
      url: i === 0 && (state === "past_due" || state === "unpaid") ? "#" : null,
      // A fixture has no document; the row shows what it can.
      pdfUrl: null,
    }
  })

  return {
    configured: true,
    identity: {
      companyName: "Voorbeeld Architecten",
      line1: "Keizersgracht 123",
      postalCode: "1015 CJ",
      city: "Amsterdam",
      country: "NL",
      vatNumber: "NL001234567B01",
      email: "boekhouding@voorbeeld-architecten.nl",
    },
    paymentMethod: { type: "sepa_debit", label: "SEPA-incasso", last4: "5264", expiry: null },
    invoices,
  }
}

/**
 * A company with work on Arco, for the usage bars.
 *
 * The admin's own company is usually empty, which hides the only thing
 * the bars exist to show: a plan holding projects back. Three shapes of
 * company are worth reviewing, because the page renders a different
 * number of meters for each — an architect who only publishes, a
 * photographer who can only be credited, and one doing both.
 */
export function previewUsage(state: PreviewState): ProjectUsage {
  // One company told three ways. The published count stays at 6 across
  // every state that can publish, so clicking along the row shows the
  // plan changing rather than the company changing.
  const free = (usage: Omit<ProjectUsage, "contributorVisible" | "contributorHidden">): ProjectUsage => {
    const visible = Math.min(FREE_CONTRIBUTOR_LIMIT, usage.contributorTotal)
    return { ...usage, contributorVisible: visible, contributorHidden: usage.contributorTotal - visible }
  }

  switch (state) {
    // An architect: publishes their own work, credited by nobody yet.
    case "free_publisher":
      return free({ canPublish: true, publishedCount: 6, contributorTotal: 0 })
    // A photographer or kitchen builder: no publishing rights at all, so
    // credits are the entire relationship with Arco.
    case "free_contributor":
      return free({ canPublish: false, publishedCount: 0, contributorTotal: 6 })
    case "free_both":
      return free({ canPublish: true, publishedCount: 6, contributorTotal: 2 })
    // Back on Free after a paid year, so the credits they gained while
    // paying are the ones now held back — the reason to return.
    case "returning":
      return free({ canPublish: true, publishedCount: 6, contributorTotal: 4 })
    // Unpaid falls back to Free, so the bars have to show the limit
    // biting again — that loss is the whole argument for settling the
    // invoice, and a preview that kept everything visible would hide it.
    case "unpaid":
      return free({ canPublish: true, publishedCount: 6, contributorTotal: 4 })
    // Pro: the same company as free_both, with nothing held back. The
    // page merges the two bars there — see SubscriptionScreen.
    default:
      return {
        canPublish: true, publishedCount: 6,
        contributorTotal: 2, contributorVisible: 2, contributorHidden: 0,
      }
  }
}
