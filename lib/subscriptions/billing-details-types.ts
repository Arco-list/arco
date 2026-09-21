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
  /** Hosted invoice page — the customer's copy, with a PDF link. */
  url: string | null
}

/** Who the invoice is made out to — name, address and VAT number. */
export type BillingIdentity = {
  companyName: string | null
  line1: string | null
  postalCode: string | null
  city: string | null
  country: string | null
  vatNumber: string | null
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
