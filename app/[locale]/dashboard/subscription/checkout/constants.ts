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

/**
 * What Pro costs, before tax, in cents.
 *
 * Lifted out of the checkout because it stopped being the only place
 * that quotes a price: the mail warning a founding period is about to
 * end has to name the same number, and a mail that undercuts the
 * checkout by a euro is a mail that gets replied to.
 */
export const NET_CENTS = { month: 4900, year: 46800 } as const

/** Dutch VAT. The same 21% the Stripe tax rate applies, restated here
 *  because the drawing has to add up before Stripe ever sees it. */
export const VAT_RATE = 0.21

/** What actually leaves the bank account. */
export function grossCents(net: number): number {
  return net + Math.round(net * VAT_RATE)
}

/** The day the free period runs to, in words. */
export function freeUntilLabel(from: Date = new Date()): string {
  const end = new Date(from)
  end.setMonth(end.getMonth() + FREE_MONTHS)
  return end.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })
}

/**
 * The moment founding access actually runs out, as a date.
 *
 * The banner worked this out inline, and so did the mail that warns the
 * period is ending — two calculations of one promise, where the mail
 * exists precisely to name the date the banner shows. Anything that
 * quotes that day derives it from here.
 *
 * Returns the raw Date, deliberately unformatted: the reader's language
 * is only known further down, and a helper that hands back words
 * decides it too early.
 */
export function foundingEndsAt(claimedAt: string | null | undefined): Date | null {
  if (!claimedAt) return null
  const end = new Date(claimedAt)
  if (Number.isNaN(end.getTime())) return null
  end.setMonth(end.getMonth() + FREE_MONTHS)
  return end
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
