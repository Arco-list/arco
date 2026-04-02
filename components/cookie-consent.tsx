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
function loadPostHog() {
  if (typeof window === "undefined") return
  if ((window as any).__posthog_loaded) return
  ;(window as any).__posthog_loaded = true

  const script = document.createElement("script")
  script.innerHTML = `
    !function(t,e){
      var o,n,p,r;
      e.__SV||(window.posthog&&window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){
        function g(t,e){
          var o=e.split(".");
          2==o.length&&(t=t[o[0]],e=o[1]),
          t[e]=function(){
            t.push([e].concat(Array.prototype.slice.call(arguments,0)))
          }
        }
        (p=t.createElement("script")).type="text/javascript",
        p.crossOrigin="anonymous",
        p.async=!0,
        p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",
        (r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);
        var u=e;
        for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){
          var e="posthog";
          return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e
        },u.people.toString=function(){
          return u.toString(1)+".people (stub)"
        },o="init Rr Mr fi Cr Ar ci Tr Fr capture Mi calculateEventProperties Lr register register_once register_for_session unregister unregister_for_session Hr getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey displaySurvey canRenderSurvey canRenderSurveyAsync identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty Ur jr createPersonProfile zr kr Br opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing get_explicit_consent_status is_capturing clear_opt_in_out_capturing Dr debug M Nr getPageViewId captureTraceFeedback captureTraceMetric $r".split(" "),n=0;n<o.length;n++)
          g(u,o[n]);
        e._i.push([i,s,a])
      },e.__SV=1)
    }(document,window.posthog||[]);
    posthog.init('phc_l2sj1VywF62O0tnCg8tAOsOrvsqdlZ1njSr7KlAg3WD', {
      api_host: 'https://eu.i.posthog.com',
      person_profiles: 'identified_only',
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true
    });
  `
  document.head.appendChild(script)
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = getConsent()
    if (!consent) {
      // No consent yet — show banner
      setVisible(true)
    } else if (consent === "accepted") {
      // Previously accepted — load PostHog
      loadPostHog()
    }
  }, [])

  const handleAccept = () => {
    setConsent("accepted")
    setVisible(false)
    loadPostHog()
  }

  const handleReject = () => {
    setConsent("rejected")
    setVisible(false)
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
