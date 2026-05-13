"use client"

import { useEffect, useRef } from "react"

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
 * Why post from the client: the PostHog `$initial_*` props live on
 * the window-side person record. Server-side renders don't have
 * direct access to them. This hook reads them after PostHog has
 * loaded and forwards to the API.
 */
export function useFirstTouchStamp(opts: { enabled?: boolean } = {}) {
  const enabled = opts.enabled ?? true
  const sent = useRef(false)
  useEffect(() => {
    if (!enabled || sent.current) return
    sent.current = true
    if (typeof window === "undefined") return
    const ph = (window as any).posthog
    if (!ph || typeof ph.get_property !== "function") return

    const referringDomain = ph.get_property("$initial_referring_domain") ?? null
    const currentUrl = ph.get_property("$initial_current_url") ?? null
    const utmSource = ph.get_property("$initial_utm_source") ?? null

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
