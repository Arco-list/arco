import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { About3 } from "@/components/about3"

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center">
        <About3
          title="About Arco"
          description="Arco is a passionate team of architects and designers dedicated to creating innovative architectural solutions that transform spaces and inspire communities worldwide."
          mainImage={{
            src: "/placeholder.svg?height=620&width=800",
            alt: "Arco architectural team at work",
          }}
          secondaryImage={{
            src: "/placeholder.svg?height=300&width=400",
            alt: "Architectural design process",
          }}
          breakout={{
            src: "/placeholder.svg?height=48&width=120",
            alt: "Arco logo",
            title: "World-class architectural designs",
            description:
              "Creating exceptional spaces that blend functionality with aesthetic excellence, transforming visions into reality.",
            buttonText: "View our projects",
            buttonUrl: "/projects",
          }}
          companiesTitle="Trusted by leading developers worldwide"
          companies={[
            { src: "/placeholder.svg?height=32&width=120", alt: "BuildCorp" },
            { src: "/placeholder.svg?height=32&width=120", alt: "PropDev" },
            { src: "/placeholder.svg?height=32&width=120", alt: "DesignStudio" },
            { src: "/placeholder.svg?height=32&width=120", alt: "UrbanPlan" },
            { src: "/placeholder.svg?height=32&width=120", alt: "InteriorPro" },
            { src: "/placeholder.svg?height=32&width=120", alt: "EngineerTech" },
          ]}
          achievementsTitle="Our Impact in Numbers"
          achievementsDescription="Delivering exceptional architectural solutions that shape skylines and transform communities across the globe."
          achievements={[
            { label: "Projects Completed", value: "500+" },
            { label: "Cities Worldwide", value: "50+" },
            { label: "Client Satisfaction", value: "98%" },
            { label: "Design Awards", value: "25+" },
          ]}
        />
      </main>
      <Footer />
    </div>
  )
}
