import { Header } from "@/components/header"
import { HeroSection } from "@/components/hero-section"
import { ProjectCategories } from "@/components/project-categories"
import { PopularProjects } from "@/components/popular-projects"
import { FeaturesSection } from "@/components/features-section"
import { ProjectTypes } from "@/components/project-types"
import { Footer } from "@/components/footer"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Header transparent />
      <main>
        <HeroSection />
        <ProjectCategories />
        <PopularProjects />
        <FeaturesSection />
        <ProjectTypes />
      </main>
      <Footer />
    </div>
  )
}
