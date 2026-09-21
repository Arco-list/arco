/**
 * Does this look like a VAT number?
 *
 * Format only. Whether the number exists, and whether it belongs to the
 * company typing it, is VIES's answer to give — Stripe asks them once
 * the tax ID is created and reports back asynchronously. A check here
 * that tried to decide the same thing would be slower and wrong.
 *
 * Worth having anyway, because the failure it prevents is silent. A
 * malformed number is refused by Stripe when the tax ID is written, and
 * that write is deliberately best-effort: a rejected VAT number must
 * not cost someone their subscription. So the subscription goes
 * through, the number never reaches the invoice, and the buyer finds
 * out months later when the VAT cannot be reclaimed. One sentence under
 * the field, while they are still looking at it, is the whole fix.
 *
 * Only NL for now, which is also the only country the checkout offers.
 * Reverse charge for other EU countries is not built, so selling into
 * one would mean issuing an invoice with the wrong tax on it.
 */

/** NL: the letters, nine digits, a B, then two more digits. */
const NL_VAT = /^NL\d{9}B\d{2}$/

/** Upper-cased, with spaces and dots dropped — how Stripe wants it. */
export function normaliseVatNumber(input: string): string {
  return input.trim().toUpperCase().replace(/[\s.]/g, "")
}

export function isValidVatNumber(input: string): boolean {
  return NL_VAT.test(normaliseVatNumber(input))
}
