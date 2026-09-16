import "server-only"

import { logger } from "@/lib/logger"
import { isStripeConfigured, stripeGet } from "@/lib/stripe/rest"
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
    const [methods, invoices] = await Promise.all([
      // The default for invoices is what actually gets charged, but a
      // customer can have exactly one attached and no default set — so
      // list and take the first rather than reading the default alone.
      stripeGet<StripeList<StripePaymentMethod>>("/payment_methods", { customer: customerId, limit: 1 }),
      stripeGet<StripeList<StripeInvoice>>("/invoices", { customer: customerId, limit: 12 }),
    ])

    return {
      configured: true,
      paymentMethod: methods.data[0] ? summarisePaymentMethod(methods.data[0]) : null,
      invoices: invoices.data
        // Drafts are Stripe's scratch space — not something a customer
        // should see in their own history.
        .filter((inv) => inv.status !== "draft")
        .map<InvoiceSummary>((inv) => ({
          id: inv.id,
          number: inv.number,
          created: new Date(inv.created * 1000).toISOString(),
          total: formatAmount(inv.total, inv.currency, locale),
          status: inv.status,
          url: inv.hosted_invoice_url,
        })),
    }
  } catch (err) {
    logger.error("Failed to load billing details from Stripe", { customerId }, err as Error)
    return { ...EMPTY_BILLING_DETAILS, configured: true }
  }
}
