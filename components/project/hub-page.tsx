import { getTranslations } from "next-intl/server"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { FilterProvider, type HubDef } from "@/contexts/filter-context"
import { FilterErrorBoundary } from "@/components/filter-error-boundary"
import { DiscoverClient } from "@/components/discover-client"
import type { DiscoverProject } from "@/lib/projects/queries"
import { getSiteUrl } from "@/lib/utils"
import { hubCopy, citySlug, PROVINCES, type Hub } from "@/lib/project-hubs"
import { cityLabel } from "@/lib/provinces"
import { PopularSearches } from "@/components/popular-searches"

export function hubToDef(hub: Hub): HubDef {
  return {
    slug: hub.slug,
    kind: hub.kind,
    cityName: hub.kind === "city" || hub.kind === "type-city" || hub.kind === "scope-city" ? hub.name : undefined,
    scope: hub.scope,
    typeValue: hub.typeValue,
    cityNames: hub.kind === "province" ? hub.cityNames : undefined,
    region: hub.kind === "province" ? hub.name : hub.kind === "type-province" || hub.kind === "scope-province" ? hub.region : undefined,
  }
}

/**
 * Hub page = the discover page, pre-filtered. Renders the full filter
 * experience (FilterProvider seeded with the hub's preset) under the
 * hub's own identity: search-targeted H1, intro, extended breadcrumb +
 * BreadcrumbList JSON-LD. initialProjects arrive pre-filtered from the
 * server so the crawled HTML contains exactly the hub's projects; the
 * FilterProvider maps any filter change to the right URL (another hub
 * path, or /projects?query).
 */
export async function HubPage({ hub, allHubs, initialProjects, locale }: {
  hub: Hub
  allHubs: Hub[]
  initialProjects: DiscoverProject[]
  locale: string
}) {
  const t = await getTranslations("projects")
  const copy = hubCopy(hub, locale)

  // Trail after "Projecten / Nederland": province, then city, then the
  // hub's non-geo axis as leaf — each intermediate level linking to its
  // own hub when one exists. Examples:
  //   province:  Projecten / Nederland / Noord-Holland
  //   city:      Projecten / Nederland / Noord-Holland / Amsterdam
  //   type-city: Projecten / Nederland / Noord-Holland / Amsterdam / Appartementen
  const cityHubForCombo = hub.kind === "type-city" || hub.kind === "scope-city"
    ? allHubs.find((h) => h.kind === "city" && h.slug === citySlug(hub.name))
    : undefined
  const regionName = hub.kind === "province" || hub.kind === "type-province" || hub.kind === "scope-province"
    ? hub.name
    : (hub.region ?? cityHubForCombo?.region)
  const provinceHub = hub.kind !== "province" && regionName
    ? allHubs.find((h) => h.kind === "province" && h.name === regionName)
    : undefined
  const provinceLabel = regionName && PROVINCES[regionName]
    ? (locale === "nl" ? PROVINCES[regionName].nl : PROVINCES[regionName].en)
    : regionName

  // Interactive crumbs: geo levels above the current one link to their
  // hubs; the current level and next-level-down placeholders render as
  // multi-select dropdowns (all provinces / cities, with checkmarks)
  // driven client-side by the filter state — the DiscoverClient fills
  // role-tagged entries in.
  type Crumb = { label: string; href?: string; role?: "provinces" | "cities" }
  const nl = locale === "nl"
  const crumbs: Crumb[] = [
    { label: t("breadcrumb_netherlands"), href: "/projects" },
    // Province level: selectable on a province hub, a plain link up when
    // the hub sits below a known province.
    ...(hub.kind === "province"
      ? [{ label: copy.crumb, role: "provinces" as const }]
      : (hub.kind === "type-province" || hub.kind === "scope-province") && provinceLabel
        ? [{ label: provinceLabel, role: "provinces" as const }]
        : provinceHub && provinceLabel
          ? [{ label: provinceLabel, href: `/projects/${provinceHub.slug}` }]
          : []),
    // City level: current segment on city/type-city hubs, next-level
    // placeholder on a province hub.
    ...(hub.kind === "city"
      ? [{ label: copy.crumb, role: "cities" as const }]
      : hub.kind === "type-city" || hub.kind === "scope-city"
        ? [{ label: cityLabel(hub.name, locale), role: "cities" as const }]
        : hub.kind === "province" || hub.kind === "type-province" || hub.kind === "scope-province"
          ? [{ label: nl ? "Kies plaats" : "Choose city", role: "cities" as const }]
          : []),
    // Type/scope hubs: geo placeholders before the non-geo leaf so the
    // spine matches the base page (Projecten / Nederland / Kies provincie /
    // Kies plaats / Villa's).
    ...(hub.kind === "type" || hub.kind === "scope"
      ? [
          { label: nl ? "Kies provincie" : "Choose province", role: "provinces" as const },
          { label: nl ? "Kies plaats" : "Choose city", role: "cities" as const },
        ]
      : []),
    // Non-geo leaf (scope / type / type-city label).
    ...(hub.kind === "city" || hub.kind === "province" ? [] : [{ label: copy.crumb }]),
  ]

  const baseUrl = getSiteUrl()
  // Structured data describes the plain hierarchy (no interactive
  // placeholder segments like "Kies plaats").
  const ldTrail: Array<{ name: string; item: string }> = [
    { name: t("title"), item: `${baseUrl}/${locale}/projects` },
    { name: t("breadcrumb_netherlands"), item: `${baseUrl}/${locale}/projects` },
    ...(provinceHub && provinceLabel
      ? [{ name: provinceLabel, item: `${baseUrl}/${locale}/projects/${provinceHub.slug}` }]
      : []),
    ...((hub.kind === "type-city" || hub.kind === "scope-city") && cityHubForCombo
      ? [{ name: cityLabel(hub.name, locale), item: `${baseUrl}/${locale}/projects/${cityHubForCombo.slug}` }]
      : []),
    { name: copy.crumb, item: `${baseUrl}/${locale}/projects/${hub.slug}` },
  ]
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: ldTrail.map((entry, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: entry.name,
      item: entry.item,
    })),
  }


  const popularHubs = {
    cities: allHubs.filter((h) => h.kind === "city"),
    scopes: allHubs.filter((h) => h.kind === "scope"),
    types: allHubs.filter((h) => h.kind === "type"),
    combos: allHubs.filter((h) => h.kind === "type-city" || h.kind === "type-province" || h.kind === "scope-city" || h.kind === "scope-province"),
    provinces: allHubs.filter((h) => h.kind === "province"),
  }
  // Full hub directory — same exhaustive crawl surface as the base
  // discover page, so every hub links laterally to every other. The way
  // back up is the breadcrumb root; no separate all-projects link.
  const hubFooter = <PopularSearches hubs={popularHubs} locale={locale} full />

  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <Header />
      <FilterProvider hubs={allHubs.map(hubToDef)} hubSlug={hub.slug}>
        <FilterErrorBoundary>
          <DiscoverClient
            initialProjects={initialProjects}
            hubHeader={{
              title: copy.h1,
              crumbs,
            }}
            hubFooter={hubFooter}
          />
        </FilterErrorBoundary>
      </FilterProvider>
      <Footer />
    </div>
  )
}
