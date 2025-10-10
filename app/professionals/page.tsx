import type { Metadata } from "next"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { FilterBar } from "@/components/filter-bar"
import { ProfessionalsGrid } from "@/components/professionals-grid"
import { ProjectsNavigation } from "@/components/projects-navigation"
import { FilterProvider } from "@/contexts/filter-context"
import { FilterErrorBoundary } from "@/components/filter-error-boundary"
import { fetchDiscoverProfessionals } from "@/lib/professionals/queries"
import { logger } from "@/lib/logger"

export const metadata: Metadata = {
  title: "Browse Professionals",
  description: "Discover verified architecture, interior design, and construction professionals in the Netherlands. Filter by specialty, location, and ratings.",
}

export const revalidate = 300

export default async function ProfessionalsPage() {
  let professionals = []

  try {
    professionals = await fetchDiscoverProfessionals()
  } catch (error) {
    logger.error("Failed to render professionals discover page", { component: "ProfessionalsPage" }, error as Error)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <ProjectsNavigation activeTab="professionals" />
      <FilterErrorBoundary>
        <FilterProvider>
          <FilterBar />
          <main className="flex-1 bg-white">
            <ProfessionalsGrid professionals={professionals} />
          </main>
        </FilterProvider>
      </FilterErrorBoundary>
      <Footer />
    </div>
  )
}
