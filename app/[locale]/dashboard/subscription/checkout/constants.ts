/**
 * Shared between the server shell and the client drawing, and
 * deliberately in a module of its own: a plain value exported from a
 * "use client" file arrives in a server component as a client
 * reference, not as the number it looks like. Adding it to a date then
 * yields NaN, and the page says "Invalid Date" without erroring.
 */

/** How long the founding give-away runs. The date on the page, the
 *  months quoted and the value waived all derive from this. */
export const FREE_MONTHS = 6

/** The day the free period runs to, in words. */
export function freeUntilLabel(from: Date = new Date()): string {
  const end = new Date(from)
  end.setMonth(end.getMonth() + FREE_MONTHS)
  return end.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })
}

/**
 * The iDEAL issuers, with the codes Stripe accepts.
 *
 * Taken from the API's own validation error rather than transcribed
 * from a screen. Stripe also accepts adyen, buut, finom, handelsbanken,
 * mollie and moneyou, which its own bank list leaves out — those are
 * payment providers rather than the bank a person has an account with,
 * and offering more than Stripe's own UI does would only add ways to
 * pick wrong.
 *
 * Alphabetical, as every bank list is. Putting the big three on top
 * would help most people by one line of scanning and make the list look
 * broken to everyone who knows their alphabet.
 */
export const IDEAL_BANKS: { value: string; label: string }[] = [
  { value: "abn_amro", label: "ABN AMRO" },
  { value: "asn_bank", label: "ASN Bank" },
  { value: "bunq", label: "bunq" },
  { value: "ing", label: "ING" },
  { value: "knab", label: "Knab" },
  { value: "n26", label: "N26" },
  { value: "nn", label: "Nationale-Nederlanden" },
  { value: "rabobank", label: "Rabobank" },
  { value: "regiobank", label: "RegioBank" },
  { value: "revolut", label: "Revolut" },
  { value: "sns_bank", label: "SNS Bank" },
  { value: "triodos_bank", label: "Triodos Bank" },
  { value: "van_lanschot", label: "Van Lanschot Kempen" },
  { value: "yoursafe", label: "Yoursafe" },
]
