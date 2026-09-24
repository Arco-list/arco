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
