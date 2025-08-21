import { Suspense } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { FilterBar } from "@/components/filter-bar"
import { ProjectsGrid } from "@/components/projects-grid"
import { ProjectsNavigation } from "@/components/projects-navigation"
import { FilterProvider } from "@/contexts/filter-context"

function ProjectsPageContent() {
  return (
    <FilterProvider>
      <div className="min-h-screen flex flex-col">
        <Header />
        <ProjectsNavigation activeTab="projects" />
        <FilterBar />

        <main className="flex-1 bg-white">
          <ProjectsGrid />
        </main>

        <Footer />
      </div>
    </FilterProvider>
  )
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <ProjectsPageContent />
    </Suspense>
  )
}
