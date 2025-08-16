import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { FilterBar } from "@/components/filter-bar"
import { ProfessionalsGrid } from "@/components/professionals-grid"
import { ProjectsNavigation } from "@/components/projects-navigation"
import { FilterProvider } from "@/contexts/filter-context"

export default function ProfessionalsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <ProjectsNavigation activeTab="professionals" />
      <FilterProvider>
        <FilterBar />
        <main className="flex-1 bg-white">
          <ProfessionalsGrid />
        </main>
      </FilterProvider>
      <Footer />
    </div>
  )
}
