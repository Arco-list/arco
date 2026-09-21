import type { InvoiceSummary } from "@/lib/subscriptions/billing-details-types"

/**
 * Where does this company's money stand?
 *
 * Three pages ask — the subscription screen, to decide whether to warn
 * and offer a way out; the payment-method page it sends the reader to,
 * which must not then greet them as a routine change; and the invoice
 * table, which has always answered it per row.
 *
 * It used to answer with a boolean, and the boolean was the bug. An
 * invoice row read the payment and said "In behandeling"; the banner
 * above it read the subscription and said "Betaling openstaand" — about
 * the same money, on the same screen. A SEPA debit takes days, during
 * which Stripe marks the subscription `past_due` while the payment is
 * travelling perfectly normally.
 *
 * So the answer is the same three states the invoices use, and the
 * banner now says what the row says.
 *
 * Deliberately not server-only: one of the callers is a client
 * component, and the rule is a comparison, not a query.
 */

export type CollectionState =
  /** Nothing owed, or everything already paid. */
  | "settled"
  /** Money is on its way. Needs waiting, not a new mandate. */
  | "processing"
  /** Money is owed and nothing is travelling towards it. */
  | "failing"

/** An invoice that is owed and that no payment is travelling towards. */
export function hasUnpaidInvoice(invoices: readonly InvoiceSummary[]): boolean {
  // `processing` is money already on its way — a SEPA debit takes days.
  // It needs waiting, not a new mandate, and counting it would invite a
  // second payment on top of the first.
  return invoices.some((inv) => inv.status === "open" && !inv.processing)
}

export function collectionState(
  status: string | null | undefined,
  invoices: readonly InvoiceSummary[],
): CollectionState {
  // A stuck invoice outranks everything. Even mid-debit on another one,
  // this is money owed that nothing is being done about.
  if (hasUnpaidInvoice(invoices)) return "failing"

  // Something in flight. This outranks the subscription's own status on
  // purpose: `past_due` during a SEPA debit describes Stripe's
  // bookkeeping, not the reader's situation.
  if (invoices.some((inv) => inv.processing)) return "processing"

  // The status says trouble and no invoice explains it. Rare, and
  // warning is the safe way to be wrong.
  if (status === "past_due" || status === "unpaid") return "failing"

  return "settled"
}

/**
 * Collection has failed and nothing is being done about it.
 *
 * The narrow question the banner and the payment-method page ask before
 * offering to repair something. A payment in flight is not a failure,
 * so it deliberately answers false while one is travelling.
 */
export function isCollectionFailing(
  status: string | null | undefined,
  invoices: readonly InvoiceSummary[],
): boolean {
  return collectionState(status, invoices) === "failing"
}
