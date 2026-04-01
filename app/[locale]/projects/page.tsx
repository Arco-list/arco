import type { Metadata } from "next"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { FilterProvider } from "@/contexts/filter-context"
import { FilterErrorBoundary } from "@/components/filter-error-boundary"
import { DiscoverClient } from "@/components/discover-client"
import { fetchDiscoverProjects } from "@/lib/projects/queries"
import { logger } from "@/lib/logger"
import { TrackPageView } from "@/components/track-view"

export const metadata: Metadata = {
  title: "Browse projects · Arco",
  description:
    "Explore architecture and design projects from across the Netherlands. Find inspiration for your next renovation or building project.",
}

export const revalidate = 300

export default async function ProjectsPage() {
  let projects: Awaited<ReturnType<typeof fetchDiscoverProjects>> = []

  try {
    projects = await fetchDiscoverProjects()
  } catch (error) {
    logger.error(
      "Failed to render projects discover page",
      { component: "ProjectsPage" },
      error as Error,
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <TrackPageView path="/projects" />
      <Header />

      <FilterErrorBoundary>
        <FilterProvider>
          <DiscoverClient initialProjects={projects} />
        </FilterProvider>
      </FilterErrorBoundary>

      <Footer />
    </div>
  )
}
