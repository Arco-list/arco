import type { Metadata } from "next"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { FilterBar } from "@/components/filter-bar"
import { ProfessionalsGrid } from "@/components/professionals-grid"
import { ProjectsNavigation } from "@/components/projects-navigation"
import { FilterProvider } from "@/contexts/filter-context"
import { FilterErrorBoundary } from "@/components/filter-error-boundary"

export const metadata: Metadata = {
  title: "Browse Professionals",
  description: "Discover verified architecture, interior design, and construction professionals in the Netherlands. Filter by specialty, location, and ratings.",
}

export default function ProfessionalsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <ProjectsNavigation activeTab="professionals" />
      <FilterErrorBoundary>
        <FilterProvider>
          <FilterBar />
          <main className="flex-1 bg-white">
            <ProfessionalsGrid />
          </main>
        </FilterProvider>
      </FilterErrorBoundary>
      <Footer />
    </div>
  )
}
