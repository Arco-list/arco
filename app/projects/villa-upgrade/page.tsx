import { Header } from "@/components/header"
import { ProjectGallery } from "@/components/project-gallery"
import { ProjectInfo } from "@/components/project-info"
import { ProfessionalsSidebar } from "@/components/professionals-sidebar"
import { ProjectHighlights } from "@/components/project-highlights"
import { ProjectFeatures } from "@/components/project-features"
import { ProfessionalsSection } from "@/components/professionals-section"
import { ProjectDetails } from "@/components/project-details"
import { MapSection } from "@/components/map-section"
import { SimilarProjects } from "@/components/similar-projects"
import { Footer } from "@/components/footer"

export default function VillaUpgradePage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 lg:px-0">
        <div className="mb-8">
          <ProjectGallery />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            <ProjectInfo />
            <ProjectHighlights />
            <ProjectFeatures />
            <ProfessionalsSection />
            <ProjectDetails />
            <MapSection />
          </div>

          {/* Sidebar - removed min-h-screen and self-start for proper sticky behavior */}
          <div className="lg:col-span-1">
            <ProfessionalsSidebar />
          </div>
        </div>
      </main>

      <div className="w-full bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-[0]">
          <SimilarProjects />
        </div>
      </div>

      <Footer />
    </div>
  )
}
