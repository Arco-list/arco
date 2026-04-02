import type React from "react"
import Script from "next/script"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { RootProviders } from "@/components/root-providers"
import { CookieConsent } from "@/components/cookie-consent"
import { buildSession } from "@/lib/auth-utils"
import { NextIntlClientProvider } from "next-intl"
import { getMessages, setRequestLocale } from "next-intl/server"
import { routing } from "@/i18n/routing"

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode
  params: Promise<{ locale: string }>
}>) {
  const { locale } = await params
  setRequestLocale(locale)
  const messages = await getMessages({ locale })

  const supabase = await createServerSupabaseClient()
  const [{ data: sessionData }, { data: userData }] = await Promise.all([
    supabase.auth.getSession(),
    supabase.auth.getUser(),
  ])

  const session = buildSession(sessionData.session, userData.user)

  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  return (
    <>
      <NextIntlClientProvider locale={locale} messages={messages}>
        <RootProviders initialSession={session}>
          {children}
          <CookieConsent />
        </RootProviders>
      </NextIntlClientProvider>
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
        {/* PostHog loaded dynamically by CookieConsent component after user accepts */}
    </>
  )
}
