import { Suspense } from "react"
import { cookies } from "next/headers"
import { ArchitectsClient } from "./architects-client"
import { fetchDiscoverProjects } from "@/lib/projects/queries"
import { lookupCompanyByEmailDomain } from "@/app/businesses/actions"
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import type { ProjectCard } from "@/components/landing/project-carousel"

interface PageProps {
  searchParams: Promise<{ inviteEmail?: string; companyId?: string; url?: string }>
}

export default async function ArchitectsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const inviteEmail = params.inviteEmail ?? null
  const companyIdParam = params.companyId ?? null

  // Store companyId in cookie so matchProspectOnSignup can link the prospect
  if (companyIdParam) {
    const cookieStore = await cookies()
    cookieStore.set("prospect_claim_company_id", companyIdParam, { maxAge: 60 * 60 * 24, path: "/", httpOnly: true, sameSite: "lax" })
  }

  let preloadedCompany = null
  if (companyIdParam) {
    // Direct company ID from prospect email — look up by ID
    try {
      const supabaseForLookup = await createServerSupabaseClient()
      const { data: company } = await supabaseForLookup
        .from("companies")
        .select("id, name, city, country, address, domain, website, phone, google_place_id, owner_id")
        .eq("id", companyIdParam)
        .maybeSingle()
      if (company) {
        preloadedCompany = {
          name: company.name,
          placeId: company.google_place_id ?? "",
          formattedAddress: company.address ?? null,
          city: company.city ?? null,
          country: company.country ?? null,
          stateRegion: null,
          phone: company.phone ?? null,
          website: company.website ?? null,
          domain: company.domain ?? null,
          editorialSummary: null,
          googleTypes: null,
          arcoCompanyId: company.owner_id ? undefined : company.id,
        }
      }
    } catch {}
  } else if (inviteEmail) {
    try {
      preloadedCompany = await lookupCompanyByEmailDomain(inviteEmail)
    } catch {}

    // Track prospect visit
    try {
      const serviceClient = createServiceRoleSupabaseClient()
      const { data: prospect } = await serviceClient
        .from("prospects")
        .select("id, status")
        .eq("email", inviteEmail)
        .in("status", ["prospect", "contacted"])
        .maybeSingle()
      if (prospect) {
        await serviceClient.from("prospects").update({
          status: "visitor",
          landing_visited_at: new Date().toISOString(),
        }).eq("id", prospect.id)
      }
    } catch {}
  }

  const rawProjects = await fetchDiscoverProjects()

  // Deduplicate by firm (max 1 project per owner), then take 6
  const seen = new Set<string>()
  const carouselProjects: ProjectCard[] = rawProjects
    .map((project) => ({
      id: project.id ?? "",
      title: project.title ?? "",
      firm: project.professional_name ?? "",
      image: project.primary_photo_url ?? project.photos[0]?.url ?? "",
    }))
    .filter((p) => {
      if (!p.image || !p.firm) return false
      if (seen.has(p.firm)) return false
      seen.add(p.firm)
      return true
    })
    .slice(0, 6)

  return (
    <Suspense>
      <ArchitectsClient projects={carouselProjects} preloadedCompany={preloadedCompany} inviteEmail={inviteEmail} />
    </Suspense>
  )
}
