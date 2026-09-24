/**
 * Payment method and invoice shapes, shared by the Stripe query and the
 * screen that draws them. Separate from the query module for the same
 * reason as usage-types: that one is "server-only", and importing a
 * type from it drags the Stripe secret key's client into the browser
 * bundle.
 */

export type PaymentMethodSummary = {
  /** 'card' | 'sepa_debit' | anything else Stripe reports. */
  type: string
  /** Card brand, or the bank's country code for SEPA. */
  label: string
  last4: string | null
  /** Cards only. */
  expiry: string | null
}

export type InvoiceSummary = {
  id: string
  number: string | null
  /** ISO date of the invoice. */
  created: string
  /** Formatted in the invoice's own currency, e.g. "€ 566,28". */
  total: string
  /** Stripe's status, verbatim: paid, open, void, uncollectible, draft. */
  status: string
  /** Open, but a payment for it is already in flight — a SEPA debit
   *  takes days, and "openstaand" reads as "nothing is happening". */
  processing: boolean
  /** Hosted invoice page — kept as the fallback when there is no PDF. */
  url: string | null
  /** The PDF itself. Linked directly, so reading your own invoice does
   *  not mean a trip through a payment page to find the download. */
  pdfUrl: string | null
}

/** Who the invoice is made out to — name, address and VAT number. */
export type BillingIdentity = {
  companyName: string | null
  line1: string | null
  postalCode: string | null
  city: string | null
  country: string | null
  vatNumber: string | null
  /**
   * What Stripe made of that VAT number.
   *
   * Stripe checks every EU VAT id against VIES the moment it is
   * attached, at no cost and without being asked, and writes the
   * answer onto the tax id. We were already paying for the check by
   * making the call — we just never opened the envelope.
   *
   * Four answers, and only one of them is a problem the reader can
   * fix: `unverified` means the number does not exist. `pending` and
   * `unavailable` mean VIES is slow or a member state is down, which
   * is nobody's fault and no reason to say anything alarming.
   */
  vatStatus: "verified" | "unverified" | "pending" | "unavailable" | null
  /** The company name VIES has on file for a verified number. Worth
   *  showing when it differs from the name on the invoice: then the
   *  invoice is addressed to a different legal entity than the number
   *  belongs to. */
  vatVerifiedName: string | null
  /** Where invoices are sent. Not the account address: a company can
   *  put its bookkeeper here and keep the rest of its mail elsewhere. */
  email: string | null
}

export type BillingDetails = {
  paymentMethod: PaymentMethodSummary | null
  identity: BillingIdentity | null
  invoices: InvoiceSummary[]
  /** False when the app has no Stripe key, so the UI can say why it is empty. */
  configured: boolean
}

export const EMPTY_BILLING_DETAILS: BillingDetails = {
  paymentMethod: null,
  identity: null,
  invoices: [],
  configured: false,
}
