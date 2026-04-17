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
    .from("companies")
    .select("id, name, slug, city, logo_url, primary_service:categories!companies_primary_service_id_fkey(name, name_nl, slug)")
    .eq("status", "listed")
    .not("logo_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(8)

  const recentProfessionals: RecentProfessional[] = (recentCompanies ?? []).map((c: any) => {
    const svc = c.primary_service
    const rawName = svc?.name ?? ""
    const service =
      (locale === "nl" && svc?.name_nl) ||
      translateProfessionalService(svc?.slug ?? rawName, locale) ||
      rawName
    return {
      id: c.id,
      name: c.name,
      slug: c.slug ?? c.id,
      service,
      city: c.city,
      logoUrl: c.logo_url,
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
