/**
 * Over welke periode de SEO-tabel bucket.
 *
 * Een eigen bestand omdat een "use server"-module alleen async functies
 * mag exporteren: SEO_TIMEFRAMES is een array, en die hoorde dus nooit
 * in actions.ts te staan. Zo kunnen de server-actie en de knoppenrij in
 * de client dezelfde lijst gebruiken zonder dat er een tweede ontstaat.
 */

/** Dezelfde vier als op het groeidashboard. */
export const SEO_TIMEFRAMES = ["days", "weeks", "months", "years"] as const
export type SeoTimeframe = (typeof SEO_TIMEFRAMES)[number]

/**
 * Naar wat date_trunc verstaat. Een whitelist: een onbekende waarde
 * komt op weken uit in plaats van halverwege de pagina te struikelen.
 */
export const BUCKET_UNIT: Record<SeoTimeframe, string> = {
  days: "day",
  weeks: "week",
  months: "month",
  years: "year",
}

export const TIMEFRAME_LABEL: Record<SeoTimeframe, { long: string; short: string }> = {
  days: { long: "Days", short: "D" },
  weeks: { long: "Weeks", short: "W" },
  months: { long: "Months", short: "M" },
  years: { long: "Years", short: "Y" },
}
