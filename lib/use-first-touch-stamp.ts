"use client"

import { useEffect, useRef } from "react"

import { getEntrySignal } from "@/lib/entry-signal"

/**
 * Posts the current user's PostHog `$initial_*` props to the
 * server so it can stamp profiles.first_touch_source. Fires once per
 * mount of whichever component invokes it (typically a layout shared
 * by post-signup routes like /dashboard or /create-company).
 *
 * Idempotent end-to-end: the server-side endpoint only writes when
 * the column is still NULL, so subsequent visits won't overwrite a
 * stamped profile. Re-fires on every page load are harmless.
 *
 * Why post from the client: the entry signal is document.referrer and
 * the URL's utm, both of which only exist in the browser, and only on
 * the first page of the visit. The server sees neither by the time
 * somebody signs up — by then the referrer is our own domain.
 *
 * Read from lib/entry-signal rather than PostHog's $initial_* props,
 * which this used to use. Those props are fine; they just live on a
 * person record, and almost nobody has one — 39 of ~1200 production
 * visitors in September, of which most were our own dev servers.
 */
export function useFirstTouchStamp(opts: { enabled?: boolean } = {}) {
  const enabled = opts.enabled ?? true
  const sent = useRef(false)
  useEffect(() => {
    if (!enabled || sent.current) return
    sent.current = true
    if (typeof window === "undefined") return

    // Nothing captured means this visit began on an internal referrer
    // — a reload, or a hard navigation from another Arco page. Posting
    // anyway would stamp a page they were already on as their origin,
    // and the stamp is permanent. Leaving it unsent keeps the column
    // NULL, which the dashboard reads as "we never saw the arrival"
    // rather than as Direct.
    const signal = getEntrySignal()
    if (!signal) return
    const { referringDomain, currentUrl, utmSource } = signal

    // Fire-and-forget. Server returns 204 on success, 401 if not
    // logged in (we don't care — the hook is only meaningful for
    // signed-in users and we can't stamp anonymous ones anyway).
    fetch("/api/profile/first-touch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referringDomain, currentUrl, utmSource }),
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => {
      // Network errors are non-fatal — we can re-stamp on a later
      // visit. No retry / no toast.
    })
  }, [enabled])
}
