import type { Metadata } from "next"
import { Header } from "@/components/header"
import { ProfessionalsFilterBar } from "@/components/professionals-filter-bar"
import { ProfessionalsGrid } from "@/components/professionals-grid"
import { ProfessionalFilterProvider } from "@/contexts/professional-filter-context"
import { FilterErrorBoundary } from "@/components/filter-error-boundary"
import { fetchDiscoverProfessionals } from "@/lib/professionals/queries"
import { logger } from "@/lib/logger"
import { TrackPageView } from "@/components/track-view"

export const metadata: Metadata = {
  title: "Browse Professionals",
  description: "Discover verified architecture, interior design, and construction professionals in the Netherlands. Filter by specialty, location, and ratings.",
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
