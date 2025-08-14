import { Header } from "@/components/header"
import { ProfessionalGallery } from "@/components/professional-gallery"
import { ProfessionalInfo } from "@/components/professional-info"
import { ProfessionalContactSidebar } from "@/components/professional-contact-sidebar"
import { ProfessionalDetails } from "@/components/professional-details"
import { Footer } from "@/components/footer"
import { ProfessionalReviews } from "@/components/professional-reviews"
import { ProfessionalProjects } from "@/components/professional-projects" // Import ProfessionalProjects

const getProfessionalData = (slug: string) => {
  const professionals = {
    "fx-domotica": {
      name: "FX Domotica",
      title: "Home Automation Specialist in Amsterdam",
      rating: 4.8,
      reviewCount: 16,
      description:
        "FX Domotica specializes in smart home automation systems, bringing cutting-edge technology to modern living spaces. With expertise in integrated lighting, climate control, security systems, and entertainment solutions, we transform houses into intelligent homes.",
      location: "Amsterdam",
      category: "Home Automation",
      type: "Technology Specialist",
    },
    "teus-van-den-berg-aannemers-timmerwerken": {
      name: "Teus van den Berg Aannemers & Timmerwerken B.V.",
      title: "General Contractor in Amsterdam",
      rating: 4.9,
      reviewCount: 32,
      description:
        "Teus van den Berg Aannemers & Timmerwerken B.V. is a leading construction and carpentry company with over 20 years of experience in residential and commercial projects throughout Amsterdam.",
      location: "Amsterdam",
      category: "Construction",
      type: "General Contractor",
    },
    "visser-in-en-exterieur": {
      name: "Visser In- en Exterieur",
      title: "Interior & Exterior Designer in Amsterdam",
      rating: 4.7,
      reviewCount: 28,
      description:
        "Visser In- en Exterieur creates stunning interior and exterior designs that blend functionality with aesthetic appeal. Our team specializes in complete home transformations and landscape design.",
      location: "Amsterdam",
      category: "Design",
      type: "Interior & Exterior Designer",
    },
  }

  return professionals[slug as keyof typeof professionals] || professionals["fx-domotica"]
}

export default function ProfessionalDetailPage({ params }: { params: { slug: string } }) {
  const professionalData = getProfessionalData(params.slug)

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-[0] py-8">
        <div className="mb-8">
          <ProfessionalGallery />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            <ProfessionalInfo professionalData={professionalData} />
            <ProfessionalDetails professionalData={professionalData} />
          </div>

          {/* Sidebar - removed min-h-screen and self-start for proper sticky behavior */}
          <div className="lg:col-span-1">
            <ProfessionalContactSidebar professionalData={professionalData} />
          </div>
        </div>
      </main>

      <div className="w-full bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-[0]">
          <ProfessionalProjects />
        </div>
      </div>

      <ProfessionalReviews />

      <Footer />
    </div>
  )
}
