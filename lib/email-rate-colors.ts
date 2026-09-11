/**
 * Shared coloring rules for the email-engagement metrics surfaced on
 * /admin/sales and /admin/emails. Centralised so the tables can't
 * silently drift apart.
 *
 * Thresholds are calibrated for cold-outreach prospect emails (the
 * highest-volume, lowest-baseline use case on the platform).
 *
 * Small samples color too: with a handful of company-level sends the
 * absolute numbers are all we have, and an admin reads the color as a
 * quick verdict on THIS mail, not as statistics. (An earlier version
 * greyed everything under 10 sends; that hid the verdict exactly where
 * the new lifecycle mails live.)
 *
 * Returned class is a Tailwind text-color class so it can drop straight
 * into a `<span className=...>`.
 */

const GREEN = "text-emerald-600"
const AMBER = "text-amber-600"
const RED = "text-red-600"

/** Delivered: 95% is the industry-standard "investigate now" line.
 *  Anything below that is a real deliverability problem (DMARC, sender
 *  reputation, dirty list), not a soft signal. */
export function deliveredRateColor(rate: number, sends: number): string {
  if (rate >= 98) return GREEN
  if (rate >= 95) return AMBER
  return RED
}

/** Opened: cold B2B baseline is ~30%. Below 20% means subject lines or
 *  list quality need work; above 40% is genuinely strong. */
export function openedRateColor(rate: number, sends: number): string {
  if (rate >= 40) return GREEN
  if (rate >= 20) return AMBER
  return RED
}

/** Clicked: cold B2B baseline is 1–5%. Double-digits is a hot signal;
 *  below 3% the CTA or the promise isn't landing. */
export function clickedRateColor(rate: number, sends: number): string {
  if (rate >= 10) return GREEN
  if (rate >= 3) return AMBER
  return RED
}

/** Unsubscribed: for cold mail with a visible unsubscribe link, ≤1% is
 *  healthy and 1–5% the normal cost of cold outreach — the unsubscribe
 *  is the recipient's POLITE no (the alternative is a spam complaint,
 *  which is the metric that actually damages the domain). Above 5% the
 *  targeting or the promise is off. */
export function unsubscribedRateColor(rate: number, sends: number): string {
  if (rate <= 1) return GREEN
  if (rate <= 5) return AMBER
  return RED
}

/** Benchmark explainers for the ⓘ hover on metric column headers. */
export const RATE_BENCHMARKS = {
  delivered: "Benchmark: ≥98% groen · 95–98% oranje · <95% rood. Onder 95% is een echt deliverability-probleem (bounces, reputatie, vuile lijst). Bij weinig sends: lees de kleur als indicatie, niet als statistiek.",
  opened: "Benchmark koude B2B-mail: ≥40% groen · 20–40% oranje · <20% rood (onderwerpregel of lijstkwaliteit). Bij weinig sends: lees de kleur als indicatie, niet als statistiek.",
  clicked: "Benchmark koude B2B-mail: ≥10% groen · 3–10% oranje · <3% rood (CTA of belofte landt niet). Klikken op de afmeldlink tellen niet mee. Bij weinig sends: lees de kleur als indicatie, niet als statistiek.",
  unsubscribed: "Benchmark koud: ≤1% groen · 1–5% oranje (normale prijs van koud mailen) · >5% rood (targeting of belofte klopt niet). De unsubscribe is de nette nee — complaints zijn het echte domeinrisico. Bij weinig sends: lees de kleur als indicatie, niet als statistiek.",
} as const
