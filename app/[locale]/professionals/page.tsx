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
import { locales } from "@/i18n/config"

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
      languages: { ...languages, "x-default": `${baseUrl}/professionals` },
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
  let professionals = []

  try {
    professionals = await fetchDiscoverProfessionals(locale)
  } catch (error) {
    logger.error("Failed to render professionals discover page", { component: "ProfessionalsPage" }, error as Error)
  }

  return (
    <div className="min-h-screen bg-white">
      <TrackPageView path="/professionals" />
      <Header />
      <FilterErrorBoundary>
        <ProfessionalFilterProvider>
          <ProfessionalsFilterBar />

          <main>
            <ProfessionalsGrid professionals={professionals} />
          </main>
        </ProfessionalFilterProvider>
      </FilterErrorBoundary>
    </div>
  )
}
