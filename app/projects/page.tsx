import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { FilterBar } from "@/components/filter-bar"
import { ProjectsGrid } from "@/components/projects-grid"
import { ProjectsNavigation } from "@/components/projects-navigation"

export default function ProjectsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <ProjectsNavigation activeTab="projects" />
      <FilterBar />

      <main className="flex-1 bg-white">
        <ProjectsGrid />
      </main>

      <Footer />
    </div>
  )
}
