import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import type { EmailVariables } from "@/lib/email-service"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.arcolist.com"

/**
 * The Listed series — enqueued by the DB trigger from migration 237
 * the first time a company reaches status 'listed':
 *
 *   1. company-live          (immediately)  — "you're live", replaces
 *      the transactional project-live for the publish that caused the
 *      listing (that suppression lives in the admin publish action).
 *   2. listed-professionals  (+3 business days) — the network motor:
 *      publishers credit the pros they worked with, contributors ask
 *      their architects to put shared projects on Arco. Always sent —
 *      there can always be more credits.
 *   3. listed-backlink       (NOT enqueued yet) — "Listed on Arco" on
 *      their own site; waits for the badge page to exist.
 *
 * Variants resolve AT SEND TIME (same grammar as visitor-nudge and
 * owned-welcome): a company with its OWN published project gets the
 * publisher framing, one that went live through a credit gets the
 * contributor framing.
 */

type ListedVariables = { variables: EmailVariables; isPublisher: boolean }

async function buildListedBase(companyId: string | null): Promise<ListedVariables> {
  const svc = createServiceRoleSupabaseClient()
  const variables: EmailVariables = { dashboard_link: `${SITE_URL}/dashboard/company` }
  if (!companyId) return { variables, isPublisher: true }

  const { data: company } = await svc
    .from("companies")
    .select("name, slug, logo_url, city, hero_photo_url, primary_service:categories!companies_primary_service_id_fkey(slug, name)")
    .eq("id", companyId)
    .maybeSingle()
  if (company) {
    variables.company_name = company.name ?? undefined
    variables.logo_url = company.logo_url ?? undefined
    const svcRel = company.primary_service as
      | { slug: string | null; name: string | null }
      | { slug: string | null; name: string | null }[]
      | null
    const primary = Array.isArray(svcRel) ? svcRel[0] : svcRel
    variables.service_slug = primary?.slug ?? undefined
    // Card subtitle: "Architect · Amsterdam" — same shape as the
    // invite dispatcher's inviter badge.
    variables.company_subtitle = [primary?.name, company.city].filter(Boolean).join(" · ") || undefined
    if (company.slug) variables.company_page_url = `${SITE_URL}/professionals/${company.slug}`
    // Cover for the full company card: the page hero, else the cover
    // photo, else the first company photo.
    let hero: string | null = (company as { hero_photo_url?: string | null }).hero_photo_url ?? null
    if (!hero) {
      const { data: cover } = await svc
        .from("company_photos")
        .select("url, is_cover")
        .eq("company_id", companyId)
        .order("is_cover", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle()
      hero = cover?.url ?? null
    }
    variables.hero_image_url = hero ?? undefined
  }

  // Publisher = has their own published project; contributor = live
  // through a credit on someone else's work.
  const { data: ownProject } = await svc
    .from("project_professionals")
    .select("id, projects!inner(status)")
    .eq("company_id", companyId)
    .eq("is_project_owner", true)
    .in("projects.status", ["published", "completed"])
    .limit(1)
    .maybeSingle()

  return { variables, isPublisher: Boolean(ownProject) }
}

export async function buildCompanyLive(
  companyId: string | null,
): Promise<{ template: "company-live-publisher" | "company-live-contributor"; variables: EmailVariables }> {
  const { variables, isPublisher } = await buildListedBase(companyId)
  return { template: isPublisher ? "company-live-publisher" : "company-live-contributor", variables }
}

export async function buildListedProfessionals(
  companyId: string | null,
): Promise<{ template: "listed-professionals-publisher" | "listed-professionals-contributor"; variables: EmailVariables }> {
  const { variables, isPublisher } = await buildListedBase(companyId)
  return { template: isPublisher ? "listed-professionals-publisher" : "listed-professionals-contributor", variables }
}

export async function buildListedBacklink(
  companyId: string | null,
): Promise<{ template: "listed-backlink"; variables: EmailVariables }> {
  const { variables } = await buildListedBase(companyId)
  return { template: "listed-backlink", variables }
}
