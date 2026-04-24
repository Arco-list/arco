import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProfessionalSubNav } from "@/components/professional/professional-sub-nav"
import { ProfessionalHeader } from "@/components/professional/professional-header"
import { ProfessionalSpecs } from "@/components/professional/professional-specs"
import { ProfessionalProjects } from "@/components/professional/professional-projects"
import { ProfessionalContact } from "@/components/professional/professional-contact"
import { fetchProfessionalDetail, fetchProfessionalMetadata } from "@/lib/professionals/queries"
import { TrackProfessionalView } from "@/components/track-view"
import { CompanyStructuredData } from "@/components/company-structured-data"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"
import { getSiteUrl } from "@/lib/utils"
import { locales } from "@/i18n/config"

type PageParams = {
  locale: string
  slug: string
}

export const revalidate = 300

export async function generateMetadata({ params }: { params: Promise<PageParams> }): Promise<Metadata> {
  const { slug } = await params
  const t = await getTranslations("professional_detail")
  const professional = await fetchProfessionalMetadata(slug)

  if (!professional) {
    return {
      title: t("professional_not_found"),
    }
  }

  const description =
    professional.description ??
    (professional.location
      ? t("discover_in_location", { name: professional.name, location: professional.location })
      : t("discover_name", { name: professional.name }))

  const baseUrl = getSiteUrl()
  const canonical = `${baseUrl}/professionals/${slug}`
  const languages = Object.fromEntries(
    locales.map((l) => [l, `${baseUrl}/${l}/professionals/${slug}`])
  )

  return {
    title: professional.name,
    description,
    alternates: {
      canonical,
      languages: { ...languages, "x-default": canonical },
    },
    openGraph: {
      title: `${professional.name} | Arco`,
      description,
      url: canonical,
      // og:image is provided by opengraph-image.tsx co-located with this
      // route — omit `images` here so Next.js doesn't emit two <meta
      // property="og:image"> tags.
    },
  }
}

export default async function ProfessionalDetailPage({ params }: { params: Promise<PageParams> }) {
  const { slug, locale } = await params
  const t = await getTranslations("professional_detail")

  // First try normal fetch (listed companies)
  let professional = await fetchProfessionalDetail(slug, { locale })

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
        professional = await fetchProfessionalDetail(slug, { allowUnlisted: true, locale })
      }

      // Check if user owns or is a member of this company
      if (!professional) {
        const { createServiceRoleSupabaseClient } = await import("@/lib/supabase/server")
        const serviceClient = createServiceRoleSupabaseClient()
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)
        const companyQuery = isUuid
          ? serviceClient.from("companies").select("id, owner_id").eq("id", slug).maybeSingle()
          : serviceClient.from("companies").select("id, owner_id").eq("slug", slug).maybeSingle()
        const { data: company } = await companyQuery

        if (company) {
          const isOwner = company.owner_id === user.id
          let isMember = false
          if (!isOwner) {
            const [memberResult, professionalResult] = await Promise.all([
              serviceClient.from("company_members").select("id").eq("company_id", company.id).eq("user_id", user.id).maybeSingle(),
              serviceClient.from("professionals").select("id").eq("company_id", company.id).eq("user_id", user.id).maybeSingle(),
            ])
            isMember = !!memberResult.data || !!professionalResult.data
          }

          if (isOwner || isMember) {
            professional = await fetchProfessionalDetail(slug, { allowUnlisted: true, locale })
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
    : t("professional_services_fallback")

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
      <CompanyStructuredData professional={professional} />
      <TrackProfessionalView companyId={professional.company.id} slug={slug} />
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
          allServices={professional.services}
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
        companyId={professional.company.id}
        companyName={professional.name}
        companyLogoUrl={companyIcon}
        companyInitials={companyInitials}
        serviceLabel={servicesBadge}
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
