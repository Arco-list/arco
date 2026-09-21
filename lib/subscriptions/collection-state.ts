import type { InvoiceSummary } from "@/lib/subscriptions/billing-details-types"

/**
 * Is money owed, with nothing doing anything about it?
 *
 * Two pages ask this — the subscription screen, to decide whether to
 * warn and offer a way out, and the payment-method page it sends the
 * reader to, which must not then greet them as a routine change. They
 * asked it separately and drifted within a day: the screen learned to
 * count open invoices, the other page went on reading only the
 * subscription's status, so a reader could be told they owed money and
 * then arrive at a form that said nothing was wrong.
 *
 * Deliberately not server-only: one of the callers is a client
 * component, and the rule is a comparison, not a query.
 */

/** An invoice that is owed and that no payment is travelling towards. */
export function hasUnpaidInvoice(invoices: readonly InvoiceSummary[]): boolean {
  // `processing` is money already on its way — a SEPA debit takes days.
  // It needs waiting, not a new mandate, and counting it would invite a
  // second payment on top of the first.
  return invoices.some((inv) => inv.status === "open" && !inv.processing)
}

/**
 * Collection has failed and has not yet been put right.
 *
 * `past_due` while Stripe still retries, `unpaid` once it has stopped —
 * and an open invoice, because the subscription's own status is not the
 * only way this happens. An invoice can sit open while the subscription
 * still reads active: between a finalisation and its payment, or for
 * anything billed outside the subscription.
 */
export function isCollectionFailing(
  status: string | null | undefined,
  invoices: readonly InvoiceSummary[],
): boolean {
  return status === "past_due" || status === "unpaid" || hasUnpaidInvoice(invoices)
}
