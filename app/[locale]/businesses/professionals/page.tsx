import { getLocale } from "next-intl/server"
import { lookupCompanyByEmailDomain } from "@/app/businesses/actions"
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { translateProfessionalService } from "@/lib/project-translations"
import ProfessionalsLandingClient from "./professionals-landing-client"

export interface RecentProfessional {
  id: string
  name: string
  slug: string
  service: string
  city: string | null
  heroPhotoUrl: string | null
  logoUrl: string | null
}

interface PageProps {
  searchParams: Promise<{ inviteEmail?: string; redirectTo?: string }>
}

export default async function ProfessionalsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const inviteEmail = params.inviteEmail ?? null

  let preloadedCompany = null
  if (inviteEmail) {
    try {
      preloadedCompany = await lookupCompanyByEmailDomain(inviteEmail)
    } catch (e) {
      console.error("[ProfessionalsPage] Company lookup failed:", e)
    }

    // Track prospect visit: update status from contacted → visitor
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
    } catch (e) {
      console.error("[ProfessionalsPage] Prospect tracking failed:", e)
    }
  }

  // Fetch recently added professionals
  const supabase = await createServerSupabaseClient()
  const locale = await getLocale()
  const { data: recentCompanies } = await supabase
    .from("mv_professional_summary")
    .select("company_id, company_name, company_slug, company_city, cover_photo_url, company_logo, primary_service_name, primary_service_name_nl, primary_specialty_slug")
    .in("company_status", ["listed", "prospected"])
    .not("cover_photo_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(8)

  const recentProfessionals: RecentProfessional[] = (recentCompanies ?? []).map((c: any) => {
    const rawName = c.primary_service_name ?? ""
    const service =
      (locale === "nl" && c.primary_service_name_nl) ||
      translateProfessionalService(c.primary_specialty_slug ?? rawName, locale) ||
      rawName
    return {
      id: c.company_id,
      name: c.company_name,
      slug: c.company_slug ?? c.company_id,
      service,
      city: c.company_city,
      heroPhotoUrl: c.cover_photo_url,
      logoUrl: c.company_logo,
    }
  })

  return (
    <ProfessionalsLandingClient
      preloadedCompany={preloadedCompany}
      inviteEmail={inviteEmail}
      recentProfessionals={recentProfessionals}
    />
  )
}
