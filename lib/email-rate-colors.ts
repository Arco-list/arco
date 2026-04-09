/**
 * Shared coloring rules for the three email-engagement metrics surfaced
 * on /admin/sales and /admin/emails. Centralised so the two tables can't
 * silently drift apart.
 *
 * Thresholds are calibrated for cold-outreach prospect emails (the
 * highest-volume, lowest-baseline use case on the platform). For pure
 * marketing or transactional templates the same buckets still read fine
 * since they only collapse to grey when nothing has happened yet.
 *
 * Returned class is a Tailwind text-color class so it can drop straight
 * into a `<span className=...>`.
 */

const GREEN = "text-emerald-600"
const AMBER = "text-amber-600"
const RED = "text-red-600"
const GREY = "text-[#a1a1a0]"

/** Delivered: 95% is the industry-standard "investigate now" line.
 *  Anything below that is a real deliverability problem (DMARC, sender
 *  reputation, dirty list), not a soft signal. */
export function deliveredRateColor(rate: number, sends: number): string {
  if (sends === 0) return GREY
  if (rate >= 98) return GREEN
  if (rate >= 95) return AMBER
  return RED
}

/** Opened: cold B2B baseline is ~30%. Below 20% means subject lines or
 *  list quality need work; above 40% is genuinely strong. Stays grey
 *  rather than red at 0% — "no opens yet" is not a failure. */
export function openedRateColor(rate: number, sends: number): string {
  if (sends === 0) return GREY
  if (rate >= 40) return GREEN
  if (rate >= 20) return AMBER
  return GREY
}

/** Clicked: cold B2B baseline is 1–5%. Double-digits is a hot signal.
 *  Below 3% is underperforming or noise. */
export function clickedRateColor(rate: number, sends: number): string {
  if (sends === 0) return GREY
  if (rate >= 10) return GREEN
  if (rate >= 3) return AMBER
  return GREY
}
