import type { Metadata } from "next"
import { projectDiscoverTitle, projectDiscoverDescription } from "@/lib/seo/copy"
import { countPublishedProjects } from "@/lib/seo/facts"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { FilterProvider } from "@/contexts/filter-context"
import { FilterErrorBoundary } from "@/components/filter-error-boundary"
import { DiscoverClient, type SpaceCard } from "@/components/discover-client"
import { fetchDiscoverProjects } from "@/lib/projects/queries"
import { getHubs, SPACE_HUB_DEFS } from "@/lib/project-hubs"
import { spaceNoun } from "@/lib/type-labels"
import { PopularSearches, type PopularHubs } from "@/components/popular-searches"
import { hubToDef } from "@/components/project/hub-page"
import { ProjectsDiscoverOutro } from "@/components/projects-discover-outro"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { TrackPageView } from "@/components/track-view"
import { getSiteUrl } from "@/lib/utils"
import { locales, defaultLocale } from "@/i18n/config"
import { noIndexWhenFiltered } from "@/lib/seo-utils"

// De teksten staan in lib/seo/copy.ts, de codetegenhanger van de
// formuletabel op /admin/brand?tab=seo. Stonden ze hier, dan waren ze
// niet te vergelijken met de zeven andere paginatypen — en dan kruipt de
// titel van het overzicht weer naar die van de hubs eronder, zodat de
// twee om dezelfde zoekvraag concurreren.
//
// "Bijzondere" stond hier als bijvoeglijk naamwoord zonder dekking. Het
// aantal is er wel een: het telt live mee en kan dus niet verouderen.

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
  const { locale } = await params
  const filters = await searchParams
  const projects = await countPublishedProjects()
  const meta = {
    title: projectDiscoverTitle(locale),
    description: projectDiscoverDescription(locale, projects),
  }
  const baseUrl = getSiteUrl()
  const canonical = `${baseUrl}/${locale}/projects`
  const languages = Object.fromEntries(
    locales.map((l) => [l, `${baseUrl}/${l}/projects`])
  )

  return {
    title: meta.title,
    description: meta.description,
    ...noIndexWhenFiltered(filters),
    alternates: {
      canonical,
      languages: { ...languages, "x-default": `${baseUrl}/${defaultLocale}/projects` },
    },
    openGraph: {
      title: `${meta.title} | Arco`,
      description: meta.description,
      url: canonical,
      type: "website",
    },
  }
}

export const revalidate = 300

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  let projects: Awaited<ReturnType<typeof fetchDiscoverProjects>> = []
  // Hub definitions let the FilterProvider swap the URL to a hub path
  // (/projects/amsterdam) when the active filter exactly matches one.
  let hubDefs: ReturnType<typeof hubToDef>[] = []
  let popularHubs: PopularHubs = { cities: [], scopes: [], types: [], combos: [], provinces: [], spaces: [] }
  try {
    const { cities, scopes, types, combos, provinces, spaces } = await getHubs()
    hubDefs = [...cities, ...scopes, ...types, ...combos, ...provinces, ...spaces].map(hubToDef)
    popularHubs = { cities, scopes, types, combos, provinces, spaces }
  } catch { /* provider works fine without hub mapping */ }
  try {
    projects = await fetchDiscoverProjects(locale)
  } catch (error) {
    logger.error(
      "Failed to render projects discover page",
      { component: "ProjectsPage" },
      error as Error,
    )
  }
  // De ruimtes als cirkels op de ingang: de redactionele selectie
  // (SPACE_HUB_DEFS featured) in vaste volgorde. Op de schijf de uitsnede
  // van de ruimte (spaces.cutout_url, een object op witte achtergrond —
  // zoals de categoriecirkels van Archiproducts), anders het pictogram
  // van de ruimte, zoals de diensten op /professionals.
  let spaceCards: SpaceCard[] = []
  try {
    const supabase = await createServerSupabaseClient()
    const { data: spaceRows } = await supabase.from("spaces").select("id, slug, icon_key, cutout_url").eq("is_active", true)
    const bySlug = new Map(((spaceRows ?? []) as Array<{ id: string; slug: string; icon_key: string | null; cutout_url: string | null }>).map((s) => [s.slug, s]))
    const order = new Map(SPACE_HUB_DEFS.map((d, i) => [d.space, i]))
    const hubs = popularHubs.spaces.filter((h) => h.featured).sort((a, b) => (order.get(a.spaceValue ?? "") ?? 99) - (order.get(b.spaceValue ?? "") ?? 99))
    spaceCards = hubs.map((h) => {
      const row = bySlug.get(h.spaceValue ?? "")
      return {
        slug: h.slug,
        label: spaceNoun(h.spaceValue ?? h.slug, locale),
        href: `/projects/${h.slug}`,
        cutoutUrl: row?.cutout_url ?? null,
        iconKey: row?.icon_key ?? h.spaceValue ?? null,
      }
    })
  } catch { /* zonder cirkels is de pagina nog steeds de pagina */ }

  // Live count for the outro platform block.
  let publishedProjectCount = 0
  try {
    const supabase = await createServerSupabaseClient()
    const { count } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
    publishedProjectCount = count ?? 0
  } catch { /* outro copy degrades to a wordy fallback */ }

  return (
    <div className="min-h-screen bg-white">
      <TrackPageView path="/projects" />
      <Header />

      <FilterErrorBoundary>
        <FilterProvider hubs={hubDefs}>
          <DiscoverClient
            initialProjects={projects}
            spaceCards={spaceCards}
            hubFooter={
              <>
                <PopularSearches hubs={popularHubs} locale={locale} />
                <ProjectsDiscoverOutro locale={locale} projectCount={publishedProjectCount} />
              </>
            }
          />
        </FilterProvider>
      </FilterErrorBoundary>

      <Footer />
    </div>
  )
}
