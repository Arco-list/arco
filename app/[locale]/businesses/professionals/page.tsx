import { getLocale } from "next-intl/server"
import { headers } from "next/headers"
import { lookupCompanyByEmailDomain } from "@/app/businesses/actions"
import { trackInviteLandingVisit } from "@/lib/invites/track-invite-landing"
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
        // Log a prospect_events row so the /admin/sales popup
        // timeline surfaces the visit alongside email sends + status
        // changes. Best-effort; tracking shouldn't block page render.
        await serviceClient.from("prospect_events").insert({
          prospect_id: prospect.id,
          event_type: "prospect.landing_visited",
          metadata: {
            landed_via: "businesses/professionals",
            previous_status: prospect.status,
          },
        })
      }
    } catch (e) {
      console.error("[ProfessionalsPage] Prospect tracking failed:", e)
    }

    // Track invite-side landing visit. Shared with /claim, which is
    // where these links now point — the stamp used to live inline here
    // and nowhere else, so it stopped firing when the claim funnel took
    // the traffic. Moving it into one function also gave this entrance
    // the mail-scanner gate it never had.
    const h = await headers()
    await trackInviteLandingVisit(inviteEmail, {
      country: h.get("x-vercel-ip-country"),
      userAgent: h.get("user-agent"),
    })
  }

  // Fetch recently added professionals — STARRED ones only: this page is
  // the sales pitch, so the strip shows the featured tier. is_featured
  // lives on companies (not the MV), so resolve the starred ids first.
  const supabase = await createServerSupabaseClient()
  const locale = await getLocale()
  const { data: featuredCompanyRows } = await supabase
    .from("companies")
    .select("id")
    .eq("is_featured", true)
    .in("status", ["listed", "prospected"])
  const featuredIds = (featuredCompanyRows ?? []).map((r) => r.id)
  const { data: recentCompanies } = featuredIds.length > 0
    ? await supabase
        .from("mv_professional_summary")
        .select("company_id, company_name, company_slug, company_city, cover_photo_url, company_logo, primary_service_name, primary_service_name_nl, primary_specialty_slug")
        .in("company_status", ["listed", "prospected"])
        .in("company_id", featuredIds)
        .not("cover_photo_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(6)
    : { data: [] as any[] }

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
