import { Header } from "@/components/header"
import { FilterErrorBoundary } from "@/components/filter-error-boundary"
import { ProfessionalFilterProvider, type ProHubDef } from "@/contexts/professional-filter-context"
import { ProfessionalsFilterBar } from "@/components/professionals-filter-bar"
import { ProfessionalsGrid } from "@/components/professionals-grid"
import { ServiceHubProse } from "@/components/professional/service-hub-prose"
import { ProfessionalPopularSearches } from "@/components/professional-popular-searches"
import { DiscoverBottomSwitcher } from "@/components/professional/discover-bottom-switcher"
import { SERVICE_HUB_PROSE } from "@/lib/professional-hubs"
import { TrackPageView } from "@/components/track-view"
import { getSiteUrl } from "@/lib/utils"
import { getTranslations } from "next-intl/server"
import { fetchDiscoverProfessionals } from "@/lib/professionals/queries"
import { proHubCopy, type ProHub } from "@/lib/professional-hubs"

export function proHubToDef(hub: ProHub): ProHubDef {
  return {
    slug: hub.slug,
    kind: hub.kind,
    cityName: hub.kind === "city" || hub.kind === "service-city" || hub.kind === "category-city" ? hub.name : undefined,
    region: hub.kind === "province" || hub.kind === "service-province" || hub.kind === "category-province" ? hub.region : undefined,
    serviceSlug: hub.serviceSlug,
    categorySlug: hub.categorySlug,
  }
}

/**
 * Professional hub page = the professionals discover, pre-filtered.
 * Server-renders the hub's companies (SEO) and seeds the filter
 * provider with the hub preset; every filter change syncs shallowly to
 * the right URL (another hub path, or /professionals?query).
 */
export async function ProfessionalHubPage({ hub, allHubs, locale }: {
  hub: ProHub
  allHubs: ProHub[]
  locale: string
}) {
  const t = await getTranslations("professionals")
  const copy = proHubCopy(hub, locale)

  let professionals: Awaited<ReturnType<typeof fetchDiscoverProfessionals>>["professionals"] = []
  // Category hubs match on the GROUP's child service names.
  //
  // Op KIND gaan, niet op de aanwezigheid van categorySlug. Diensthubs
  // dragen die sinds kort ook (het headermenu zet ze per groep in
  // kolommen), en daardoor liep deze tak ineens mee op een diensthub —
  // waar hij niets te zoeken heeft.
  const isCategoryHub =
    hub.kind === "category" || hub.kind === "category-city" || hub.kind === "category-province"
  let categoryServiceNames: string[] = []
  if (isCategoryHub && hub.categorySlug) {
    try {
      const { createServerSupabaseClient } = await import("@/lib/supabase/server")
      const supabase = await createServerSupabaseClient()
      const { data: parent } = await supabase.from("categories").select("id").eq("slug", hub.categorySlug).maybeSingle()
      if (parent?.id) {
        // Naam ÉN name_nl. De kaarten dragen hun specialismen in de taal
        // van de pagina (zie mapRpcRowToProfessionalCard), dus een lijst
        // met alleen Engelse namen matcht op /nl niets behalve de
        // woorden die toevallig in beide talen gelijk zijn — "Architect".
        const { data: children } = await supabase.from("categories").select("name, name_nl").eq("parent_id", parent.id)
        categoryServiceNames = (children ?? [])
          .flatMap((c) => [c.name, c.name_nl])
          .filter((n): n is string => Boolean(n))
      }
    } catch { /* pre-filter falls back to city-only */ }
  }
  try {
    // Full ordered set — filtering a first-page slice of the seeded
    // shuffle gave hubs a random subset that changed size every reload.
    const result = await fetchDiscoverProfessionals(locale, undefined, { full: true })
    // Server-side pre-filter so the crawled HTML contains exactly the
    // hub's companies. City matching is case-insensitive against the
    // covered spellings; service matching goes via specialty names.
    const cityNamesLower = (hub.cityNames ?? []).map((c) => c.toLowerCase().trim())
    professionals = result.professionals.filter((p) => {
      if (cityNamesLower.length > 0) {
        if (!p.city || !cityNamesLower.includes(p.city)) return false
      }
      const names = (p.specialties ?? []).map((sp: any) => (typeof sp === "string" ? sp : sp?.name ?? "")).filter(Boolean)
      if ((hub.kind === "service" || hub.kind === "service-city" || hub.kind === "service-province") && hub.serviceName) {
        if (!names.includes(hub.serviceName) && !(hub.serviceNameNl && names.includes(hub.serviceNameNl))) return false
      }
      if (isCategoryHub && categoryServiceNames.length > 0) {
        if (!names.some((n: string) => categoryServiceNames.includes(n))) return false
      }
      return true
    })
  } catch { /* grid falls back to client fetch */ }

  const baseUrl = getSiteUrl()
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { name: t("title"), item: `${baseUrl}/${locale}/professionals` },
      { name: copy.crumb, item: `${baseUrl}/${locale}/professionals/${hub.slug}` },
    ].map((entry, i) => ({ "@type": "ListItem", position: i + 1, name: entry.name, item: entry.item })),
  }

  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <TrackPageView path={`/professionals/${hub.slug}`} />
      <Header />
      <FilterErrorBoundary>
        <ProfessionalFilterProvider hubs={allHubs.map(proHubToDef)} hubSlug={hub.slug}>
          <ProfessionalsFilterBar />
          <main>
            {/* Editorial prose + FAQ for the national service hubs rides
                the grid's preFooter slot — the grid owns the Footer, so
                rendering after it would land below the footer. */}
            <ProfessionalsGrid
              professionals={professionals}
              initialTotal={professionals.length}
              hubMode
              preFooter={
                <>
                  <ProfessionalPopularSearches hubs={allHubs} locale={locale} />
                  {/* Same switcher as the root: the prose follows the live
                      filter state instead of freezing on the hub's own. */}
                  <DiscoverBottomSwitcher
                    initialMatch={hub.slug}
                    proseBySlug={Object.fromEntries(
                      Object.keys(SERVICE_HUB_PROSE).map((slug) => [
                        slug,
                        <ServiceHubProse
                          key={slug}
                          hubSlug={slug}
                          locale={locale}
                          companyCount={
                            slug === hub.slug
                              ? professionals.length
                              : allHubs.find((h) => h.kind === "service" && h.serviceSlug === slug)?.count ?? 0
                          }
                        />,
                      ]),
                    )}
                  />
                </>
              }
            />
          </main>
        </ProfessionalFilterProvider>
      </FilterErrorBoundary>
    </div>
  )
}
