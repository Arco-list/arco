import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { setRequestLocale } from "next-intl/server"

import { locales, defaultLocale } from "@/i18n/config"
import { getSiteUrl } from "@/lib/utils"
import { resolveProfessionalHub, getProfessionalHubs, proHubCopy } from "@/lib/professional-hubs"
import { ProfessionalHubPage } from "@/components/professional/professional-hub-page"

/**
 * Nested professional hub routes: /professionals/{city}/{service}
 * (/professionals/amsterdam/architect). Geo first, service as leaf —
 * same grammar as the project combo hubs. Non-qualifying combos 404.
 */

interface PageProps {
  params: Promise<{ locale: string; slug: string; sub: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug, sub } = await params
  setRequestLocale(locale)
  const hub = await resolveProfessionalHub(`${slug}/${sub}`)
  if (!hub) return {}
  const copy = proHubCopy(hub, locale)
  const base = getSiteUrl()
  const canonical = `${base}/${locale}/professionals/${hub.slug}`
  return {
    title: copy.metaTitle,
    description: copy.description,
    alternates: {
      canonical,
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, `${base}/${l}/professionals/${hub.slug}`])),
        "x-default": `${base}/${defaultLocale}/professionals/${hub.slug}`,
      },
    },
    openGraph: { title: copy.metaTitle, description: copy.description, url: canonical, type: "website" },
  }
}

export default async function NestedProfessionalHubRoute({ params }: PageProps) {
  const { locale, slug, sub } = await params
  setRequestLocale(locale)
  const hub = await resolveProfessionalHub(`${slug}/${sub}`)
  if (!hub) notFound()
  const allHubs = await getProfessionalHubs()
  // Plain async function call — sidesteps a TS2786 false positive on
  // async-component JSX (same pattern as the project hub routes).
  return await ProfessionalHubPage({ hub, allHubs, locale })
}
