"use client"

/**
 * What this visit arrived with, held for as long as the visit lasts.
 *
 * Captured once, at module load, which in the App Router is the first
 * page of a visit. Client-side navigation does not reset it and does
 * not change document.referrer, so a signup three pages later still
 * carries the signal the visit came in with. A hard reload does reset
 * it — see below for why that is handled rather than mourned.
 *
 * IN MEMORY, DELIBERATELY. Nothing is written to the device, so there
 * is no cookie and no consent question. The cost is that a visitor who
 * leaves and comes back later starts blank — and measurement says that
 * costs less than it sounds: 20 of 28 client signups happen in the
 * person's first session. The consideration cycle is short; it is the
 * arrival itself that is usually untagged.
 *
 * WHY NOT PostHog's $initial_* PROPS, which this replaces. Those live
 * on a person record, and a person record only exists once somebody is
 * identified. Of ~1200 production visitors in September, 39 had one —
 * and 181 of the profiles that did exist were our own dev servers. The
 * props work; there is just nobody to hang them on.
 */

export type EntrySignal = {
  referringDomain: string | null
  currentUrl: string | null
  utmSource: string | null
}

/** Hosts that mean "already inside", not "arrived from". */
const INTERNAL = /(^|\.)arcolist\.com$|^localhost$|^127\.0\.0\.1$|\.vercel\.app$/i

function capture(): EntrySignal | null {
  if (typeof window === "undefined") return null

  let host = ""
  try {
    host = document.referrer ? new URL(document.referrer).hostname : ""
  } catch {
    host = ""
  }

  // An internal referrer is a reload or a hard in-site navigation, not
  // an arrival. Recording it would stamp the second page somebody
  // happened to load as the thing that brought them here — and that
  // stamp is permanent, because the server only writes a NULL column.
  // Better to capture nothing and leave the field honestly empty.
  if (host && INTERNAL.test(host)) return null

  let utmSource: string | null = null
  try {
    utmSource = new URL(window.location.href).searchParams.get("utm_source")
  } catch {}

  // An empty referrer is not a failure to capture: it is the observed
  // fact that this visit came with nothing, which is what Direct
  // means. Null here and null-because-we-never-looked are different
  // states, and the dashboard shows them as different rows.
  return {
    referringDomain: host || null,
    currentUrl: window.location.href,
    utmSource,
  }
}

const entrySignal: EntrySignal | null = capture()

export function getEntrySignal(): EntrySignal | null {
  return entrySignal
}
