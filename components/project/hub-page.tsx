import { getTranslations } from "next-intl/server"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Link } from "@/i18n/navigation"
import { FilterProvider, type HubDef } from "@/contexts/filter-context"
import { FilterErrorBoundary } from "@/components/filter-error-boundary"
import { DiscoverClient } from "@/components/discover-client"
import type { DiscoverProject } from "@/lib/projects/queries"
import { getSiteUrl } from "@/lib/utils"
import { hubCopy, citySlug, type Hub } from "@/lib/project-hubs"

export function hubToDef(hub: Hub): HubDef {
  return {
    slug: hub.slug,
    kind: hub.kind,
    cityName: hub.kind === "city" || hub.kind === "type-city" ? hub.name : undefined,
    scope: hub.scope,
    typeValue: hub.typeValue,
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
export async function HubPage({ hub, allHubs, siblings, initialProjects, locale }: {
  hub: Hub
  allHubs: Hub[]
  siblings: Hub[]
  initialProjects: DiscoverProject[]
  locale: string
}) {
  const t = await getTranslations("projects")
  const copy = hubCopy(hub, locale)

  // Trail after "Projecten › Nederland": the geo level, then the hub's
  // non-geo axis as leaf. On combos ("Appartementen in Amsterdam") the
  // city crumb links to its own hub page when one exists.
  const cityHubForCombo = hub.kind === "type-city"
    ? allHubs.find((h) => h.kind === "city" && h.slug === citySlug(hub.name))
    : undefined
  const crumbs: Array<{ label: string; href?: string }> = [
    { label: t("breadcrumb_netherlands"), href: "/projects" },
    ...(hub.kind === "type-city"
      ? [{ label: hub.name, href: cityHubForCombo ? `/projects/${cityHubForCombo.slug}` : undefined }]
      : []),
    { label: copy.crumb },
  ]

  const baseUrl = getSiteUrl()
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t("title"), item: `${baseUrl}/${locale}/projects` },
      ...crumbs.map((crumb, i) => ({
        "@type": "ListItem",
        position: i + 2,
        name: crumb.label,
        item: crumb.href ? `${baseUrl}/${locale}${crumb.href}` : `${baseUrl}/${locale}/projects/${hub.slug}`,
      })),
    ],
  }

  const siblingLabel = locale === "nl" ? "Ook interessant:" : "Also explore:"
  const allProjectsLabel = locale === "nl" ? "Alle projecten bekijken" : "Browse all projects"

  const hubFooter = (
    <div className="wrap" style={{ paddingBottom: 48 }}>
      {siblings.length > 0 && (
        <p className="text-[13px]" style={{ marginTop: 32, color: "#6b6b68" }}>
          {siblingLabel}{" "}
          {siblings.map((s, i) => {
            const label = hubCopy(s, locale).h1
            return (
              <span key={s.slug}>
                {i > 0 && <span aria-hidden="true"> · </span>}
                <Link href={`/projects/${s.slug}`} className="text-[#016D75] hover:text-[#014f55] transition-colors">
                  {label}
                </Link>
              </span>
            )
          })}
        </p>
      )}
      <p style={{ marginTop: 12 }}>
        <Link href="/projects" className="text-[13px] text-[#016D75] hover:text-[#014f55] transition-colors">
          {allProjectsLabel} →
        </Link>
      </p>
    </div>
  )

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
              intro: copy.intro,
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
