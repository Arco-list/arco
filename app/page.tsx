import { Header } from "@/components/header"
import { HeroSection } from "@/components/hero-section"
import { ProjectCategories } from "@/components/project-categories"
import { PopularProjects } from "@/components/popular-projects"
import { FeaturesSection } from "@/components/features-section"
import { PopularServices } from "@/components/popular-services"
import { FeaturedProfessionals } from "@/components/featured-professionals"
import { ProfessionalCategories } from "@/components/professional-categories"
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
        <PopularServices />
        <FeaturedProfessionals />
        <ProfessionalCategories />
        <ProjectTypes />
      </main>
      <Footer />
    </div>
  )
}
