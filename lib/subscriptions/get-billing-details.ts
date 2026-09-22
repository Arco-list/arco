import "server-only"

import { logger } from "@/lib/logger"
import { isStripeConfigured, stripeGet } from "@/lib/stripe/rest"
import { HIDDEN_METADATA_KEY } from "@/lib/subscriptions/nonpayment"
import {
  EMPTY_BILLING_DETAILS,
  type BillingDetails,
  type InvoiceSummary,
  type PaymentMethodSummary,
} from "@/lib/subscriptions/billing-details-types"

export type { BillingDetails } from "@/lib/subscriptions/billing-details-types"

/**
 * Payment method and invoice history, read live from Stripe.
 *
 * Deliberately NOT mirrored into our own tables the way subscriptions
 * are. A subscription drives entitlements, so the product must be able
 * to answer "may this company do X" without a network call. An invoice
 * list is something a person looks at now and then — copying it here
 * would buy nothing and give us a second version of the truth to keep
 * in step.
 *
 * Failure is never fatal: the page renders without these sections
 * rather than 500-ing because Stripe had a bad minute.
 */

type StripeList<T> = { data: T[] }

type StripePaymentMethod = {
  type: string
  card?: { brand?: string; last4?: string; exp_month?: number; exp_year?: number }
  sepa_debit?: { last4?: string; country?: string }
}

type StripeInvoice = {
  id: string
  number: string | null
  created: number
  total: number
  currency: string
  status: string
  hosted_invoice_url: string | null
  invoice_pdf: string | null
  // Expanded below. Newer API versions moved the intent off the invoice
  // and onto `payments`, so both shapes are read — an unrecognised one
  // simply means "not processing", which is the safe answer.
  payment_intent?: { status?: string } | string | null
  payments?: { data?: { payment?: { payment_intent?: { status?: string } | string | null } }[] }
  metadata?: Record<string, string> | null
}

/** Is money for this invoice already on its way? */
function isProcessing(inv: StripeInvoice): boolean {
  const direct = typeof inv.payment_intent === "object" ? inv.payment_intent?.status : undefined
  const viaPayments = (() => {
    const pi = inv.payments?.data?.[0]?.payment?.payment_intent
    return typeof pi === "object" ? pi?.status : undefined
  })()
  return (direct ?? viaPayments) === "processing"
}

function summarisePaymentMethod(pm: StripePaymentMethod): PaymentMethodSummary {
  if (pm.type === "card" && pm.card) {
    const month = pm.card.exp_month ? String(pm.card.exp_month).padStart(2, "0") : null
    return {
      type: "card",
      label: pm.card.brand ? pm.card.brand.charAt(0).toUpperCase() + pm.card.brand.slice(1) : "Card",
      last4: pm.card.last4 ?? null,
      expiry: month && pm.card.exp_year ? `${month}/${String(pm.card.exp_year).slice(-2)}` : null,
    }
  }
  if (pm.type === "sepa_debit" && pm.sepa_debit) {
    return {
      type: "sepa_debit",
      label: "SEPA-incasso",
      last4: pm.sepa_debit.last4 ?? null,
      expiry: null,
    }
  }
  return { type: pm.type, label: pm.type, last4: null, expiry: null }
}

function formatAmount(amountInCents: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale === "nl" ? "nl-NL" : "en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountInCents / 100)
}

export async function getBillingDetails(
  customerId: string | null,
  locale: string,
): Promise<BillingDetails> {
  if (!customerId || !isStripeConfigured()) return EMPTY_BILLING_DETAILS

  try {
    const [methods, invoices, customer, taxIds] = await Promise.all([
      // The default for invoices is what actually gets charged, but a
      // customer can have exactly one attached and no default set — so
      // list and take the first rather than reading the default alone.
      stripeGet<StripeList<StripePaymentMethod>>("/payment_methods", { customer: customerId, limit: 1 }),
      stripeGet<StripeList<StripeInvoice>>("/invoices", {
        customer: customerId,
        limit: 12,
        // A SEPA debit leaves the invoice open for days while it
        // travels. Without this the page cannot tell "nobody is paying
        // this" from "it is already underway", and shows the same
        // "pay now" to both.
        "expand[]": "data.payment_intent",
      }),
      // Who the invoice names, so the page can show it and offer to
      // correct it. Read from Stripe rather than mirrored: this is the
      // record the document is built from, and a copy could disagree.
      stripeGet<{
        name?: string | null
        address?: { line1?: string | null; postal_code?: string | null; city?: string | null; country?: string | null } | null
      }>(`/customers/${customerId}`),
      stripeGet<StripeList<{ value: string }>>(`/customers/${customerId}/tax_ids`),
    ])

    return {
      configured: true,
      paymentMethod: methods.data[0] ? summarisePaymentMethod(methods.data[0]) : null,
      identity: {
        companyName: customer.name ?? null,
        line1: customer.address?.line1 ?? null,
        postalCode: customer.address?.postal_code || null,
        city: customer.address?.city ?? null,
        country: customer.address?.country ?? null,
        vatNumber: taxIds.data[0]?.value ?? null,
      },
      invoices: invoices.data
        // Drafts are Stripe's scratch space — not something a customer
        // should see in their own history.
        .filter((inv) => inv.status !== "draft")
        // A card refused in the checkout leaves a withdrawn invoice for
        // a purchase that never happened. Three attempts would leave
        // three, which is a record of somebody's typing rather than of
        // their money. Marked at the moment of the refusal, because by
        // now the invoice is indistinguishable from a failed debit —
        // and a failed debit does belong here, since that one had money
        // in transit for days.
        // Presence, not a particular value. The value says WHY, for
        // anyone reading the invoice in Stripe later; making the filter
        // depend on it means a second reason spelled differently
        // silently stops hiding anything.
        .filter((inv) => !inv.metadata?.[HIDDEN_METADATA_KEY])
        .map<InvoiceSummary>((inv) => ({
          id: inv.id,
          number: inv.number,
          created: new Date(inv.created * 1000).toISOString(),
          total: formatAmount(inv.total, inv.currency, locale),
          processing: inv.status === "open" && isProcessing(inv),
          pdfUrl: inv.invoice_pdf,
          status: inv.status,
          url: inv.hosted_invoice_url,
        })),
    }
  } catch (err) {
    logger.error("Failed to load billing details from Stripe", { customerId }, err as Error)
    return { ...EMPTY_BILLING_DETAILS, configured: true }
  }
}

/**
 * A billing cycle change that is waiting for the paid period to end.
 *
 * Downgrading uses a subscription schedule, so the subscription itself
 * is deliberately unchanged until the day it changes — that is the
 * whole point. The page therefore cannot learn about it from the
 * subscription, or from our mirror of it, and read only those it went
 * on calling the plan yearly and offering the switch a second time.
 *
 * Read live from Stripe, like invoices and the payment method: nothing
 * in the product depends on it, and a stale answer here would be worse
 * than no answer.
 */
export async function getScheduledSwitch(
  subscriptionId: string,
): Promise<{ interval: "month" | "year"; startsAt: number } | null> {
  if (!isStripeConfigured()) return null

  try {
    const subscription = await stripeGet<{ schedule?: string | null }>(
      `/subscriptions/${subscriptionId}`,
    )
    if (!subscription.schedule) return null

    const schedule = await stripeGet<{
      status: string
      phases: { start_date: number; items: { price: { recurring?: { interval?: string } } | string }[] }[]
    }>(`/subscription_schedules/${subscription.schedule}`, { "expand[]": "phases.items.price" })

    if (schedule.status !== "active" && schedule.status !== "not_started") return null

    // The first phase that has not begun yet. A released or completed
    // schedule has none, and neither has one whose only phase is the
    // period being lived through.
    const now = Math.floor(Date.now() / 1000)
    const upcoming = schedule.phases.find((p) => p.start_date > now)
    if (!upcoming) return null

    const price = upcoming.items[0]?.price
    const interval = typeof price === "string" ? null : price?.recurring?.interval
    if (interval !== "month" && interval !== "year") return null

    return { interval, startsAt: upcoming.start_date }
  } catch {
    // A page that cannot reach Stripe should still render the plan it
    // knows about, minus this one line.
    return null
  }
}
