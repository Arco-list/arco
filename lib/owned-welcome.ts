import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import type { EmailVariables } from "@/lib/email-service"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.arcolist.com"

export type OwnedWelcomeTemplate = "owned-publisher" | "owned-contributor" | "owned-invited"

/**
 * Resolve the owned-reminder variant AT SEND TIME (mirror of
 * lib/visitor-nudge.ts). The queue row carries the abstract
 * 'owned-welcome'; it only ever sends when the claim did NOT convert
 * to Listed (the drip cron cancels it otherwise), and the variant is
 * the company's actual route to going live:
 *
 *   - invited:     a credit is waiting on a project — accepting it is
 *                  the one action left ("zet je pagina live").
 *   - publisher:   their category publishes its own projects
 *                  (categories.can_publish_projects) — publish the
 *                  first project.
 *   - contributor: their category doesn't carry own projects — the
 *                  route is getting credited by a pro they work with.
 *
 * No claim token: the recipient owns an account; CTAs are plain
 * product URLs.
 */
export async function buildOwnedWelcome(
  companyId: string | null,
  email: string,
): Promise<{ template: OwnedWelcomeTemplate; variables: EmailVariables }> {
  const svc = createServiceRoleSupabaseClient()
  const base: EmailVariables = {
    dashboard_link: `${SITE_URL}/dashboard/company`,
  }

  if (!companyId) {
    // Shouldn't happen for Owned (claiming creates/links the company),
    // but degrade to the publisher framing rather than failing the send.
    return { template: "owned-publisher", variables: base }
  }

  const { data: company } = await svc
    .from("companies")
    .select("name, slug, logo_url, city, primary_service:categories!companies_primary_service_id_fkey(slug, can_publish_projects)")
    .eq("id", companyId)
    .maybeSingle()
  let canPublish = true
  if (company) {
    base.company_name = company.name ?? undefined
    base.logo_url = company.logo_url ?? undefined
    base.company_subtitle = company.city ?? undefined
    const svcRel = company.primary_service as
      | { slug: string | null; can_publish_projects: boolean | null }
      | { slug: string | null; can_publish_projects: boolean | null }[]
      | null
    const primary = Array.isArray(svcRel) ? svcRel[0] : svcRel
    base.service_slug = primary?.slug ?? undefined
    canPublish = primary?.can_publish_projects ?? true
    if (company.slug) base.company_page_url = `${SITE_URL}/professionals/${company.slug}`
  }

  // A waiting or accepted credit → the invited framing. (An accepted
  // credit on a PUBLISHED project would have auto-listed the company
  // and the cron's listed-gate would have cancelled this mail, so what
  // reaches this branch is actionable: usually an unaccepted invite.)
  const { data: credit } = await svc
    .from("project_professionals")
    .select("project_id, projects!inner(id, title, slug)")
    .eq("company_id", companyId)
    .eq("is_project_owner", false)
    .in("status", ["invited", "listed", "live_on_page"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!credit) {
    return { template: canPublish ? "owned-publisher" : "owned-contributor", variables: base }
  }

  const project = (Array.isArray((credit as any).projects)
    ? (credit as any).projects[0]
    : (credit as any).projects) as { id: string; title: string | null; slug: string | null } | null
  if (project) {
    base.project_title = project.title ?? undefined
    base.project_link = `${SITE_URL}/projects/${project.slug ?? project.id}`
  }

  const [{ data: photo }, { data: ownerPP }] = await Promise.all([
    svc
      .from("project_photos")
      .select("url")
      .eq("project_id", (credit as any).project_id)
      .order("order_index", { ascending: true })
      .limit(1)
      .maybeSingle(),
    svc
      .from("project_professionals")
      .select("company_id")
      .eq("project_id", (credit as any).project_id)
      .eq("is_project_owner", true)
      .maybeSingle(),
  ])
  if (photo?.url) base.project_image = photo.url
  if (ownerPP?.company_id && ownerPP.company_id !== companyId) {
    const { data: ownerCompany } = await svc
      .from("companies")
      .select("name")
      .eq("id", ownerPP.company_id)
      .maybeSingle()
    if (ownerCompany?.name) base.inviter_company_name = ownerCompany.name
  }

  return { template: "owned-invited", variables: base }
}
