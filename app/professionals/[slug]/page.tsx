import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProfessionalSubNav } from "@/components/professional/professional-sub-nav"
import { ProfessionalHeader } from "@/components/professional/professional-header"
import { ProfessionalSpecs } from "@/components/professional/professional-specs"
import { ProfessionalProjects } from "@/components/professional/professional-projects"
import { ProfessionalContact } from "@/components/professional/professional-contact"
import { fetchProfessionalDetail, fetchProfessionalMetadata } from "@/lib/professionals/queries"
import { getSiteUrl } from "@/lib/utils"

type PageParams = {
  slug: string
}

export const revalidate = 300

export async function generateMetadata({ params }: { params: Promise<PageParams> }): Promise<Metadata> {
  const { slug } = await params
  const professional = await fetchProfessionalMetadata(slug)

  if (!professional) {
    return {
      title: "Professional not found · Arco",
    }
  }

  const description =
    professional.description ??
    (professional.location ? `Discover ${professional.name} in ${professional.location}.` : `Discover ${professional.name}.`)

  const image = professional.coverImageUrl ?? "/placeholder.svg"

  const baseUrl = getSiteUrl()
  const canonical = `${baseUrl}/professionals/${slug}`

  return {
    title: `${professional.name} · Arco`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${professional.name} · Arco`,
      description,
      url: canonical,
      images: image ? [{ url: image, alt: professional.name }] : undefined,
    },
  }
}

export default async function ProfessionalDetailPage({ params }: { params: Promise<PageParams> }) {
  const { slug } = await params
  const professional = await fetchProfessionalDetail(slug)

  if (!professional) {
    notFound()
  }

  // Company icon (logo or initials)
  const companyIcon = professional.company.logoUrl ?? null
  const companyInitials = getInitials(professional.name)

  // Services for badge
  const servicesBadge = professional.services.length > 0 
    ? professional.services.slice(0, 2).join(' · ')
    : 'Professional Services'

  // Specs
  const specs = {
    location: professional.location,
    established: professional.company.foundedYear ?? null,
    teamSize: null, // employeeCount doesn't exist in the type
    projectsCount: professional.projects.length,
    specialties: professional.specialties.length > 0 ? professional.specialties[0] : null,
  }

  // Contact info
  const contact = {
    officeAddress: professional.company.address,
    websiteUrl: professional.company.domain ? `https://${professional.company.domain}` : null,
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <ProfessionalSubNav />

      <div className="wrap" style={{ marginTop: '120px', marginBottom: '60px' }}>
        <ProfessionalHeader
          name={professional.name}
          services={servicesBadge}
          description={professional.description}
          companyIcon={companyIcon}
          companyInitials={companyInitials}
        />

        <ProfessionalSpecs
          location={specs.location}
          established={specs.established}
          teamSize={specs.teamSize}
          projectsCount={specs.projectsCount}
          specialties={specs.specialties}
        />
      </div>

      {/* Only show projects section if there are projects */}
      {professional.projects.length > 0 && (
        <ProfessionalProjects projects={professional.projects} />
      )}

      <ProfessionalContact
        companyName={professional.name}
        officeAddress={contact.officeAddress}
        websiteUrl={contact.websiteUrl}
      />

      <Footer />
    </div>
  )
}

// Helper function to get initials
function getInitials(name: string): string {
  const words = name.split(' ')
  if (words.length >= 2) {
    return words[0][0] + words[1][0]
  }
  return words[0].substring(0, 2)
}
