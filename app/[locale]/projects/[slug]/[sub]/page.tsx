import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { setRequestLocale } from "next-intl/server"

import { locales, defaultLocale } from "@/i18n/config"
import { getSiteUrl } from "@/lib/utils"
import { resolveHub, getHubProjects, getHubs, hubCopy } from "@/lib/project-hubs"
import { fetchDiscoverProjects } from "@/lib/projects/queries"
import { HubPage } from "@/components/project/hub-page"

/**
 * Nested hub routes: /projects/{geo}/{type} — type-city
 * (/projects/amsterdam/villa) and type-province
 * (/projects/noord-holland/villa) combos. Geo first, type as leaf,
 * matching the breadcrumb spine. Non-qualifying combinations 404.
 */

interface PageProps {
  params: Promise<{ locale: string; slug: string; sub: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug, sub } = await params
  setRequestLocale(locale)
  const hub = await resolveHub(`${slug}/${sub}`)
  if (!hub) return {}
  const copy = hubCopy(hub, locale)
  const base = getSiteUrl()
  const canonical = `${base}/${locale}/projects/${hub.slug}`
  return {
    title: copy.metaTitle,
    description: copy.description,
    alternates: {
      canonical,
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, `${base}/${l}/projects/${hub.slug}`])),
        "x-default": `${base}/${defaultLocale}/projects/${hub.slug}`,
      },
    },
    openGraph: { title: copy.metaTitle, description: copy.description, url: canonical, type: "website" },
  }
}

export default async function NestedHubRoute({ params }: PageProps) {
  const { locale, slug, sub } = await params
  setRequestLocale(locale)
  const hub = await resolveHub(`${slug}/${sub}`)
  if (!hub) notFound()

  const [hubProjects, allHubsSet] = await Promise.all([
    getHubProjects(hub),
    getHubs(),
  ])
  const allHubs = [...allHubsSet.cities, ...allHubsSet.scopes, ...allHubsSet.types, ...allHubsSet.combos, ...allHubsSet.provinces]
  // Server-side pre-filter: the feed is built FROM the hub's own id set
  // (see the [slug] route for why intersecting with the global feed page
  // broke under the seeded shuffle).
  const initialProjects = await fetchDiscoverProjects(locale, undefined, {
    projectIds: hubProjects.map((p) => p.id).filter((id): id is string => Boolean(id)),
  })
  // Plain async function call — sidesteps a TS2786 false positive on
  // async-component JSX (same pattern as the [slug] route).
  return await HubPage({ hub, allHubs, initialProjects, locale })
}
