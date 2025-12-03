import type React from "react"
import type { Metadata } from "next"
import { Poppins } from "next/font/google"
import Script from "next/script"
import "./globals.css"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { RootProviders } from "@/components/root-providers"
import { buildSession } from "@/lib/auth-utils"

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "Arco - Connect with Architecture & Design Professionals",
    template: "%s | Arco",
  },
  description: "Find and collaborate with top architecture, interior design, and construction professionals in the Netherlands. Post projects, browse portfolios, and bring your vision to life.",
  keywords: [
    "architecture",
    "interior design",
    "construction",
    "professionals",
    "Netherlands",
    "renovation",
    "building projects",
  ],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await createServerSupabaseClient()
  const [{ data: sessionData }, { data: userData }] = await Promise.all([
    supabase.auth.getSession(),
    supabase.auth.getUser(),
  ])

  const session = buildSession(sessionData.session, userData.user)

  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  return (
    <html lang="en" className={poppins.variable}>
      <body className={poppins.className}>
        <RootProviders initialSession={session}>{children}</RootProviders>
        {mapsApiKey && (
          <Script
            src={`https://maps.googleapis.com/maps/api/js?key=${mapsApiKey}&libraries=places,marker&loading=async`}
            strategy="afterInteractive"
          />
        )}
        <Script
          id="marker-io"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.markerConfig = {
                project: '68fbacbc9e451201c9b6cb10',
                source: 'snippet'
              };

              !function(e,r,a){if(!e.__Marker){e.__Marker={};var t=[],n={__cs:t};["show","hide","isVisible","capture","cancelCapture","unload","reload","isExtensionInstalled","setReporter","clearReporter","setCustomData","on","off"].forEach(function(e){n[e]=function(){var r=Array.prototype.slice.call(arguments);r.unshift(e),t.push(r)}}),e.Marker=n;var s=r.createElement("script");s.async=1,s.src="https://edge.marker.io/latest/shim.js";var i=r.getElementsByTagName("script")[0];i.parentNode.insertBefore(s,i)}}(window,document);
            `,
          }}
        />
        <Script
          id="apollo-tracking"
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{
            __html: `
              function initApollo(){
                var n=Math.random().toString(36).substring(7),
                o=document.createElement("script");
                o.src="https://assets.apollo.io/micro/website-tracker/tracker.iife.js?nocache="+n,
                o.async=!0,
                o.defer=!0,
                o.onload=function(){
                  window.trackingFunctions.onLoad({appId:"6901dcfac03d1f001da74d43"})
                },
                document.head.appendChild(o)
              }
              initApollo();
            `,
          }}
        />
        <Script
          id="posthog-analytics"
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{
            __html: `
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
                person_profiles: 'identified_only'
              });
            `,
          }}
        />
      </body>
    </html>
  )
}
