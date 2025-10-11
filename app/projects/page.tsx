import { Suspense } from "react"
import type { Metadata } from "next"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { FilterBar } from "@/components/filter-bar"
import { ProjectsGrid } from "@/components/projects-grid"
import { FilterProvider } from "@/contexts/filter-context"
import { FilterErrorBoundary } from "@/components/filter-error-boundary"

export const metadata: Metadata = {
  title: "Browse Projects",
  description: "Explore architecture and design projects from across the Netherlands. Find inspiration for your next renovation or building project.",
}

function ProjectsPageContent() {
  return (
    <FilterErrorBoundary>
      <FilterProvider>
        <div className="min-h-screen flex flex-col">
          <Header />
          <FilterBar />

          <main className="flex-1 bg-white">
            <ProjectsGrid />
          </main>

          <Footer />
        </div>
      </FilterProvider>
    </FilterErrorBoundary>
  )
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <ProjectsPageContent />
    </Suspense>
  )
}
