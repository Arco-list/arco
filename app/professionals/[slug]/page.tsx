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
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"
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

  // First try normal fetch (listed companies)
  let professional = await fetchProfessionalDetail(slug)

  // If not found, check if current user is an owner/member and allow preview
  if (!professional) {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      // Check if user is an admin
      const { data: profile } = await supabase
        .from("profiles")
        .select("admin_role, user_types")
        .eq("id", user.id)
        .maybeSingle()

      if (profile && isAdminUser(profile.user_types, profile.admin_role)) {
        professional = await fetchProfessionalDetail(slug, { allowUnlisted: true })
      }

      // Check if user owns or is a member of this company
      if (!professional) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)
        const companyQuery = isUuid
          ? supabase.from("companies").select("id, owner_id").eq("id", slug).maybeSingle()
          : supabase.from("companies").select("id, owner_id").eq("slug", slug).maybeSingle()
        const { data: company } = await companyQuery

        if (company) {
          const isOwner = company.owner_id === user.id
          let isMember = false
          if (!isOwner) {
            const [memberResult, professionalResult] = await Promise.all([
              supabase.from("company_members").select("id").eq("company_id", company.id).eq("user_id", user.id).maybeSingle(),
              supabase.from("professionals").select("id").eq("company_id", company.id).eq("user_id", user.id).maybeSingle(),
            ])
            isMember = !!memberResult.data || !!professionalResult.data
          }

          if (isOwner || isMember) {
            professional = await fetchProfessionalDetail(slug, { allowUnlisted: true })
          }
        }
      }
    }
  }

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
    location: professional.company.city ? `${professional.company.city}, NL` : professional.location,
    established: professional.company.foundedYear ?? null,
    teamSize: professional.company.teamSizeMin ?? null,
    languages: professional.company.languages ?? [],
    certificates: professional.company.certificates ?? [],
  }

  // Contact info
  const contact = {
    officeAddress: professional.company.address,
    websiteUrl: professional.company.domain ? `https://${professional.company.domain}` : null,
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <ProfessionalSubNav
        companyId={professional.company.id}
        name={professional.name}
        imageUrl={professional.gallery[0]?.url ?? professional.company.logoUrl ?? null}
        slug={slug}
        profession={servicesBadge}
        location={specs.location ?? undefined}
        hasProjects={professional.projects.length > 0}
      />

      <div id="details" className="wrap" style={{ marginTop: '120px', marginBottom: '60px' }}>
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
          languages={specs.languages}
          certificates={specs.certificates}
        />
      </div>

      {/* Only show projects section if there are projects */}
      {professional.projects.length > 0 && (
        <ProfessionalProjects projects={professional.projects} />
      )}

      <ProfessionalContact
        companyName={professional.name}
        officeAddress={contact.officeAddress}
        city={professional.company.city ?? null}
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
