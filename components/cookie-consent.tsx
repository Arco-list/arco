"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

const CONSENT_KEY = "arco_cookie_consent"

type ConsentValue = "accepted" | "rejected"

function getConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(CONSENT_KEY) as ConsentValue | null
}

function setConsent(value: ConsentValue) {
  localStorage.setItem(CONSENT_KEY, value)
}

/** Load PostHog analytics script dynamically */
/**
 * Hosts we do NOT measure.
 *
 * Development was 40% of everything PostHog held — 1,824 of 4,509 events
 * in a week, and 292 "people" who were all one person with the dev
 * server open. The project's test-account filter does list localhost,
 * but a filter only helps where it is applied: the session-replay list
 * ignored it and served recordings of localhost:3000 back. Not sending
 * is the only version that holds everywhere, and it stops paying for
 * the ingestion too.
 */
function isMeasuredHost(): boolean {
  const h = window.location.hostname
  return h !== "localhost" && h !== "127.0.0.1" && !h.endsWith(".local")
}

function loadPostHog() {
  if (typeof window === "undefined") return
  if (!isMeasuredHost()) return
  if ((window as any).__posthog_loaded) return
  ;(window as any).__posthog_loaded = true

  // PostHog snippet routed through the managed reverse proxy at t.arcolist.com.
  // Avoids ~30% adblocker drop-off (uBlock / Ghostery block direct calls to
  // *.posthog.com). ui_host points back to PostHog so the Toolbar + dashboard
  // links resolve. Stub function list is PostHog's current minified bootstrap
  // — keep in sync with their docs when you next change init options.
  const script = document.createElement("script")
  script.innerHTML = `
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog && window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="Ei Ni init zi Gi Nr Ui Xi Vi capture calculateEventProperties tn register register_once register_for_session unregister unregister_for_session an getFeatureFlag getFeatureFlagPayload getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey displaySurvey cancelPendingSurvey canRenderSurvey canRenderSurveyAsync ln identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset setIdentity clearIdentity get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException addExceptionStep captureLog startExceptionAutocapture stopExceptionAutocapture loadToolbar get_property getSessionProperty nn Qi createPersonProfile setInternalOrTestUser sn qi cn opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing get_explicit_consent_status is_capturing clear_opt_in_out_capturing Ji debug Fr rn getPageViewId captureTraceFeedback captureTraceMetric Bi".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    posthog.init('phc_l2sj1VywF62O0tnCg8tAOsOrvsqdlZ1njSr7KlAg3WD', {
      api_host: 'https://t.arcolist.com',
      ui_host: 'https://eu.posthog.com',
      defaults: '2026-01-30',
      person_profiles: 'identified_only',
      autocapture: true,
      rageclick: true,
      capture_dead_clicks: true,
      capture_pageview: true,
      capture_pageleave: true,
      disable_session_recording: false,
      cookieless_mode: 'on_reject'
    });
  `
  document.head.appendChild(script)
}

/**
 * Hand PostHog the consent decision.
 *
 * REQUIRED, not an optimisation. Under cookieless_mode 'on_reject'
 * PostHog captures nothing at all until a decision arrives — accepted or
 * refused, it just needs one. Ship the mode without this and the whole
 * platform goes dark.
 *
 * Refusing does NOT mean going uncounted. In this mode PostHog keeps
 * counting the visit through a hash it computes server-side, so the
 * session holds together across page loads with nothing written to the
 * device. That is what makes a funnel measurable without a cookie —
 * and it was the missing piece: on `persistence: memory`, every page
 * load minted a new person, and 590 of 591 visitors in a week showed
 * exactly one pageview.
 *
 * The queue in PostHog's bootstrap stub swallows these calls safely
 * before the real script has landed.
 */
function applyConsent(accepted: boolean) {
  const ph = typeof window !== "undefined" ? (window as any).posthog : null
  if (!ph) return
  if (accepted) {
    ph.opt_in_capturing()
    ph.set_config({ persistence: "localStorage+cookie" })
  } else {
    ph.opt_out_capturing()
  }
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    loadPostHog()

    const consent = getConsent()
    if (!consent) {
      setVisible(true)
      return
    }
    // A returning visitor never sees the banner, so nothing would ever
    // hand PostHog their decision — and in this mode no decision means
    // no data. Replay the stored one on every load.
    applyConsent(consent === "accepted")
  }, [])

  const handleAccept = () => {
    setConsent("accepted")
    setVisible(false)
    applyConsent(true)
  }

  const handleReject = () => {
    setConsent("rejected")
    setVisible(false)
    // Counted, not stored: PostHog falls back to its server-side hash,
    // so the visit still joins up into one session without a cookie.
    applyConsent(false)
  }

  if (!visible) return null

  return (
    <div style={{
      position: "fixed",
      bottom: 20,
      right: 20,
      zIndex: 9999,
      background: "white",
      border: "1px solid var(--arco-rule)",
      borderRadius: 12,
      padding: "20px 24px",
      boxShadow: "0 4px 24px rgba(0,0,0,0.1)",
      maxWidth: 360,
    }}>
      <p style={{
        fontSize: 13,
        fontWeight: 300,
        fontFamily: "var(--font-sans)",
        color: "var(--arco-black)",
        margin: "0 0 16px",
        lineHeight: 1.5,
      }}>
        We use cookies for analytics to improve our platform.{" "}
        <Link href="/privacy" style={{ color: "var(--arco-black)", textDecoration: "underline" }}>
          Privacy Policy
        </Link>
      </p>
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={handleReject}
          className="btn-secondary"
          style={{ fontSize: 13, padding: "10px 20px" }}
        >
          Reject
        </button>
        <button
          type="button"
          onClick={handleAccept}
          className="btn-primary"
          style={{ fontSize: 13, padding: "10px 20px" }}
        >
          Accept
        </button>
      </div>
    </div>
  )
}
