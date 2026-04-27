import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProfessionalSubNav } from "@/components/professional/professional-sub-nav"
import { ProfessionalHeader } from "@/components/professional/professional-header"
import { PhotographerSpecs } from "@/components/professional/photographer-specs"
import { ProfessionalProjects } from "@/components/professional/professional-projects"
import { ProfessionalContact } from "@/components/professional/professional-contact"
import { fetchPhotographerDetail, fetchPhotographerMetadata } from "@/lib/photographers/queries"
import { TrackProfessionalView } from "@/components/track-view"
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
  const photographer = await fetchPhotographerMetadata(slug)

  if (!photographer) {
    return { title: t("photographer_not_found") }
  }

  const description =
    photographer.description ??
    (photographer.city
      ? t("discover_photographer_in_location", { name: photographer.name, location: photographer.city })
      : t("discover_photographer_name", { name: photographer.name }))

  const baseUrl = getSiteUrl()
  const canonical = `${baseUrl}/photographers/${slug}`
  const languages = Object.fromEntries(
    locales.map((l) => [l, `${baseUrl}/${l}/photographers/${slug}`])
  )

  return {
    title: photographer.name,
    description,
    alternates: {
      canonical,
      languages: { ...languages, "x-default": canonical },
    },
    openGraph: {
      title: `${photographer.name} | Arco`,
      description,
      url: canonical,
    },
  }
}

export default async function PhotographerDetailPage({ params }: { params: Promise<PageParams> }) {
  const { slug } = await params
  const t = await getTranslations("professional_detail")

  // Listed photographer first (public path).
  let photographer = await fetchPhotographerDetail(slug)

  // Owner / admin preview for unclaimed or draft photographer companies.
  if (!photographer) {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("admin_role, user_types")
        .eq("id", user.id)
        .maybeSingle()

      if (profile && isAdminUser(profile.user_types, profile.admin_role)) {
        photographer = await fetchPhotographerDetail(slug, { allowUnlisted: true })
      } else {
        // Owner / member preview — same pattern as /professionals/[slug].
        const { createServiceRoleSupabaseClient } = await import("@/lib/supabase/server")
        const serviceClient = createServiceRoleSupabaseClient()
        const isUuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)
        const companyQuery = isUuidLike
          ? serviceClient.from("companies").select("id, owner_id, audience").eq("id", slug).maybeSingle()
          : serviceClient.from("companies").select("id, owner_id, audience").eq("slug", slug).maybeSingle()
        const { data: company } = await companyQuery

        if (company && (company as any).audience === "pro") {
          const isOwner = (company as any).owner_id === user.id
          let isMember = false
          if (!isOwner) {
            const [memberResult, professionalResult] = await Promise.all([
              serviceClient.from("company_members").select("id").eq("company_id", (company as any).id).eq("user_id", user.id).maybeSingle(),
              serviceClient.from("professionals").select("id").eq("company_id", (company as any).id).eq("user_id", user.id).maybeSingle(),
            ])
            isMember = !!memberResult.data || !!professionalResult.data
          }
          if (isOwner || isMember) {
            photographer = await fetchPhotographerDetail(slug, { allowUnlisted: true })
          }
        }
      }
    }
  }

  if (!photographer) notFound()

  const companyIcon = photographer.logoUrl
  const companyInitials = getInitials(photographer.name)

  // Service label — fixed for photographers, since the audience filter
  // guarantees this is a Photographer-category company.
  const servicesBadge = "Photography"

  const locationLabel = photographer.city ? `${photographer.city}, NL` : null

  return (
    <div className="min-h-screen bg-white">
      <TrackProfessionalView companyId={photographer.id} slug={slug} />
      <Header />

      <ProfessionalSubNav
        companyId={photographer.id}
        name={photographer.name}
        imageUrl={photographer.gallery[0]?.url ?? photographer.logoUrl ?? null}
        slug={slug}
        profession={servicesBadge}
        location={locationLabel ?? undefined}
        hasProjects={photographer.projects.length > 0}
      />

      <div id="details" className="wrap" style={{ marginTop: "120px", marginBottom: "60px" }}>
        <ProfessionalHeader
          name={photographer.name}
          services={servicesBadge}
          allServices={[servicesBadge]}
          description={photographer.description}
          companyIcon={companyIcon}
          companyInitials={companyInitials}
        />

        <PhotographerSpecs
          location={locationLabel}
          foundedYear={photographer.foundedYear}
          specialties={photographer.specialties}
          languages={photographer.languages}
          collaborationsCount={photographer.collaborationsCount}
        />
      </div>

      {photographer.projects.length > 0 && (
        <ProfessionalProjects
          projects={photographer.projects}
          heading={t("photographed_projects")}
        />
      )}

      <ProfessionalContact
        companyId={photographer.id}
        companyName={photographer.name}
        companyLogoUrl={companyIcon}
        companyInitials={companyInitials}
        serviceLabel={servicesBadge}
        officeAddress={photographer.address}
        city={photographer.city}
        websiteUrl={photographer.websiteUrl}
      />

      <Footer />
    </div>
  )
}

function getInitials(name: string): string {
  const words = name.split(" ").filter(Boolean)
  if (words.length >= 2) return (words[0][0] ?? "") + (words[1][0] ?? "")
  return (words[0] ?? "").substring(0, 2)
}
