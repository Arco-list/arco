import type { Metadata } from "next"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { FilterBar } from "@/components/filter-bar"
import { ProjectsGrid } from "@/components/projects-grid"
import { FilterProvider } from "@/contexts/filter-context"
import { FilterErrorBoundary } from "@/components/filter-error-boundary"
import { fetchDiscoverProjects } from "@/lib/projects/queries"
import { logger } from "@/lib/logger"

export const metadata: Metadata = {
  title: "Browse Projects",
  description: "Explore architecture and design projects from across the Netherlands. Find inspiration for your next renovation or building project.",
}

export const revalidate = 300

export default async function ProjectsPage() {
  let projects = []

  try {
    projects = await fetchDiscoverProjects()
  } catch (error) {
    logger.error("Failed to render projects discover page", { component: "ProjectsPage" }, error as Error)
  }

  return (
    <div className="min-h-screen flex flex-col pt-[60px] md:pt-[68px]">
      <Header />
      <FilterErrorBoundary>
        <FilterProvider>
          <FilterBar />
          <main className="flex-1 bg-white">
            <ProjectsGrid initialProjects={projects} />
          </main>
        </FilterProvider>
      </FilterErrorBoundary>
      <Footer />
    </div>
  )
}
