import type { Metadata } from "next"
import { Header } from "@/components/header"
import { ProfessionalsFilterBar } from "@/components/professionals-filter-bar"
import { ProfessionalsGrid } from "@/components/professionals-grid"
import { ProfessionalFilterProvider } from "@/contexts/professional-filter-context"
import { FilterErrorBoundary } from "@/components/filter-error-boundary"
import { fetchDiscoverProfessionals } from "@/lib/professionals/queries"
import { logger } from "@/lib/logger"
import { TrackPageView } from "@/components/track-view"
import { getSiteUrl } from "@/lib/utils"
import { locales, defaultLocale } from "@/i18n/config"
import { getProfessionalHubs } from "@/lib/professional-hubs"
import { proHubToDef } from "@/components/professional/professional-hub-page"
import { ProfessionalsDiscoverOutro } from "@/components/professionals-discover-outro"
import { ProfessionalPopularSearches } from "@/components/professional-popular-searches"
import { DiscoverBottomSwitcher } from "@/components/professional/discover-bottom-switcher"
import { ServiceHubProse } from "@/components/professional/service-hub-prose"
import { SERVICE_HUB_PROSE } from "@/lib/professional-hubs"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// SEO copy is intentionally inline (not via messages/*.json). See the matching
// note in app/[locale]/projects/page.tsx for the rationale.
const PROFESSIONALS_META: Record<string, { title: string; description: string }> = {
  nl: {
    title: "Architecten en interieurontwerpers in Nederland",
    description:
      "Vind erkende architecten, interieurontwerpers, aannemers en bouwbedrijven in Nederland. Bekijk hun gerealiseerde projecten en neem direct contact op.",
  },
  en: {
    title: "Architects & interior designers in the Netherlands",
    description:
      "Find verified architects, interior designers, contractors and construction companies across the Netherlands. Browse their built work and get in touch directly.",
  },
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const meta = PROFESSIONALS_META[locale] ?? PROFESSIONALS_META.en
  const baseUrl = getSiteUrl()
  const canonical = `${baseUrl}/${locale}/professionals`
  const languages = Object.fromEntries(
    locales.map((l) => [l, `${baseUrl}/${l}/professionals`])
  )

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical,
      languages: { ...languages, "x-default": `${baseUrl}/${defaultLocale}/professionals` },
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

export default async function ProfessionalsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  let professionals: Awaited<ReturnType<typeof fetchDiscoverProfessionals>>["professionals"] = []
  let total = 0

  // Hub definitions let the provider swap the URL to a hub path
  // (/professionals/amsterdam) when the filter exactly matches one. The
  // full hub list also feeds the "Populaire zoekopdrachten" directory in
  // the page outro.
  let hubs: Awaited<ReturnType<typeof getProfessionalHubs>> = []
  let hubDefs: ReturnType<typeof proHubToDef>[] = []
  try {
    hubs = await getProfessionalHubs()
    hubDefs = hubs.map(proHubToDef)
  } catch { /* provider works fine without hub mapping */ }
  let publishedProjectCount = 0
  try {
    const supabase = await createServerSupabaseClient()
    const { count } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
    publishedProjectCount = count ?? 0
  } catch { /* outro copy degrades to a wordy fallback */ }
  try {
    const result = await fetchDiscoverProfessionals(locale)
    professionals = result.professionals
    total = result.total
  } catch (error) {
    logger.error("Failed to render professionals discover page", { component: "ProfessionalsPage" }, error as Error)
  }

  return (
    <div className="min-h-screen bg-white">
      <TrackPageView path="/professionals" />
      <Header />
      <FilterErrorBoundary>
        <ProfessionalFilterProvider hubs={hubDefs}>
          <ProfessionalsFilterBar />

          <main>
            <ProfessionalsGrid
              professionals={professionals}
              initialTotal={total}
              preFooter={
                <>
                  <ProfessionalPopularSearches hubs={hubs} locale={locale} />
                  {/* Client switcher keeps the FAQ/prose in step with the
                      live filter state (shallow routing never re-renders
                      this server tree). All variants ride along
                      server-rendered; SSR shows the root outro. */}
                  <DiscoverBottomSwitcher
                    initialMatch="root"
                    rootOutro={
                      <ProfessionalsDiscoverOutro
                        locale={locale}
                        companyCount={total}
                        projectCount={publishedProjectCount}
                      />
                    }
                    proseBySlug={Object.fromEntries(
                      Object.keys(SERVICE_HUB_PROSE).map((slug) => [
                        slug,
                        <ServiceHubProse
                          key={slug}
                          hubSlug={slug}
                          locale={locale}
                          companyCount={hubs.find((h) => h.kind === "service" && h.serviceSlug === slug)?.count ?? 0}
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
