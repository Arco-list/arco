import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { FilterBar } from "@/components/filter-bar"
import { ProfessionalsGrid } from "@/components/professionals-grid"
import { ProjectsNavigation } from "@/components/projects-navigation"

export default function ProfessionalsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <ProjectsNavigation activeTab="professionals" />
      <FilterBar />

      <main className="flex-1 bg-white">
        <ProfessionalsGrid />
      </main>

      <Footer />
    </div>
  )
}
