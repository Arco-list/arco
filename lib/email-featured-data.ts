import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

/**
 * Shape of a single featured project passed to welcome-homeowner /
 * discover-projects email templates via `vars.projects`.
 */
export type FeaturedProject = {
  title: string
  subtitle?: string
  image: string
  slug: string
  location?: string
}

/**
 * Shape of a single featured professional passed to welcome-homeowner
 * via `vars.professionals`. Matches the fields the /professionals
 * discover card reads from the database:
 *   - image: wide hero photo (4:3)
 *   - logo:  small circular logo overlaid on the info row
 *   - city:  location for the subtitle ("Service · City")
 */
export type FeaturedProfessional = {
  name: string
  service?: string
  city?: string
  image?: string
  logo?: string | null
  slug: string
  projectCount?: number
}

/**
 * Fetch the featured projects that the welcome-homeowner + discover-projects
 * templates render. Shared between the cron (real sends) and the admin test
 * send (preview) so the two surfaces always show the same projects.
 *
 * Returns most-recently-created published + featured projects, with their
 * first photo, subtitle (type · city), and slug. Projects without a photo
 * are skipped — the card layout depends on the image.
 */
export async function fetchFeaturedProjectsForEmail(limit: number): Promise<FeaturedProject[]> {
  const supabase = createServiceRoleSupabaseClient()
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, slug, location, address_city, project_type")
    .eq("status", "published")
    .eq("is_featured", true)
    .order("created_at", { ascending: false })
    .limit(limit)

  const collected: FeaturedProject[] = []
  for (const p of (projects ?? []) as Array<{
    id: string
    title: string | null
    slug: string | null
    location: string | null
    address_city: string | null
    project_type: string | null
  }>) {
    const { data: photo } = await supabase
      .from("project_photos")
      .select("url")
      .eq("project_id", p.id)
      .order("order_index", { ascending: true })
      .limit(1)
      .maybeSingle()
    if (!photo?.url) continue

    const city = p.address_city ?? p.location ?? undefined
    const type = p.project_type ?? undefined
    const subtitle = [type, city].filter(Boolean).join(" · ") || undefined

    collected.push({
      title: p.title ?? "Project",
      subtitle,
      image: photo.url,
      slug: p.slug ?? "",
      location: city,
    })
  }

  return collected
}

/**
 * Fetch the 4 featured professionals that welcome-homeowner renders.
 * Shared between cron and admin test send. Includes the project count per
 * company so the "X projects" subtitle on the professional card is live.
 *
 * Featured companies are pulled from the public "professionals visible to
 * homeowners" set, which includes both `listed` and `prospected` statuses.
 * This matches the filter used by the /professionals discover page and by
 * `fetchProfessionalDetail`.
 *
 * The project count is restricted to *published* projects so the card
 * number aligns with what's visible on the company's public profile.
 *
 * Queries the base `companies` table joined to `categories` for the
 * resolved service name. We previously tried `mv_company_listings` (which
 * has a pre-joined `primary_service_name` column), but that materialized
 * view turned out not to include prospected companies, so the helper was
 * returning zero rows and the welcome email was silently falling back to
 * its hardcoded sample data. The join below is slightly slower but
 * guaranteed to reflect the current `companies` table state.
 */
export async function fetchFeaturedProfessionalsForEmail(): Promise<FeaturedProfessional[]> {
  const supabase = createServiceRoleSupabaseClient()
  const { data: companies, error } = await supabase
    .from("companies")
    .select(
      "id, name, slug, logo_url, hero_photo_url, city, primary_service_id, primary_service:categories!companies_primary_service_id_fkey(name)",
    )
    .in("status", ["listed", "prospected"])
    .eq("is_featured", true)
    .order("created_at", { ascending: false })
    .limit(4)

  if (error) {
    console.error("[fetchFeaturedProfessionalsForEmail] query failed:", error)
    return []
  }

  const rawCompanies = ((companies ?? []) as Array<{
    id: string | null
    name: string | null
    slug: string | null
    logo_url: string | null
    hero_photo_url: string | null
    city: string | null
    primary_service: { name: string | null } | { name: string | null }[] | null
  }>).filter((c): c is {
    id: string
    name: string | null
    slug: string | null
    logo_url: string | null
    hero_photo_url: string | null
    city: string | null
    primary_service: { name: string | null } | { name: string | null }[] | null
  } => typeof c.id === "string")

  // Count only published projects per company, via a join to the projects
  // table. The previous implementation counted every project_professionals
  // link regardless of the owning project's status — so drafts, archived,
  // and rejected projects were inflating the "X projects" number visible
  // in the welcome email.
  const companyIds = rawCompanies.map((c) => c.id).filter((id): id is string => typeof id === "string")
  const projectCountByCompany = new Map<string, number>()
  if (companyIds.length > 0) {
    const { data: links } = await supabase
      .from("project_professionals")
      .select("company_id, project:projects!inner(status)")
      .in("company_id", companyIds)
      .eq("project.status", "published")
    for (const row of (links ?? []) as Array<{ company_id: string | null }>) {
      if (!row.company_id) continue
      projectCountByCompany.set(row.company_id, (projectCountByCompany.get(row.company_id) ?? 0) + 1)
    }
  }

  // For any company missing a hero_photo_url, fall back to the first photo
  // of one of their credited/owned projects. The discover card on
  // /professionals does the same via cover_photo_url in mv_company_listings,
  // but since that MV doesn't include prospected companies we fetch it
  // directly here. Done as a single join query to avoid an N+1 loop.
  const missingHeroIds = rawCompanies
    .filter((c) => !(typeof c.hero_photo_url === "string" && c.hero_photo_url.trim().length > 0))
    .map((c) => c.id)
  const fallbackImageByCompany = new Map<string, string>()
  if (missingHeroIds.length > 0) {
    const { data: projectLinks } = await supabase
      .from("project_professionals")
      .select(
        "company_id, project:projects!inner(id, status, project_photos(url, is_primary, order_index))",
      )
      .in("company_id", missingHeroIds)
      .eq("project.status", "published")

    for (const row of (projectLinks ?? []) as Array<{
      company_id: string | null
      project: {
        id: string
        project_photos: Array<{ url: string | null; is_primary: boolean | null; order_index: number | null }>
      } | null
    }>) {
      if (!row.company_id || !row.project) continue
      if (fallbackImageByCompany.has(row.company_id)) continue
      const photos = row.project.project_photos ?? []
      const primary = photos.find((p) => p.is_primary) ?? photos.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))[0]
      if (primary?.url) fallbackImageByCompany.set(row.company_id, primary.url)
    }
  }

  return rawCompanies.map((c) => {
    // Treat empty strings as no-logo so the renderer falls back to initials
    // instead of emitting a broken <img> tag. `logo_url` is typed as
    // nullable text in Supabase but user-generated data can also be "".
    const logo = typeof c.logo_url === "string" && c.logo_url.trim().length > 0 ? c.logo_url : null

    // Hero image preference: explicit hero_photo_url first, then the
    // best-guess cover from a credited published project.
    const explicitHero = typeof c.hero_photo_url === "string" && c.hero_photo_url.trim().length > 0
      ? c.hero_photo_url
      : null
    const image = explicitHero ?? fallbackImageByCompany.get(c.id) ?? undefined

    // The Supabase PostgREST join returns either an object or an array
    // depending on the relationship cardinality typing; normalize both.
    const serviceRow = Array.isArray(c.primary_service) ? c.primary_service[0] : c.primary_service
    const service = serviceRow?.name ?? undefined
    const city = typeof c.city === "string" && c.city.trim().length > 0 ? c.city : undefined

    return {
      name: c.name ?? "Professional",
      service,
      city,
      image,
      logo,
      slug: c.slug ?? "",
      projectCount: projectCountByCompany.get(c.id) ?? 0,
    }
  })
}
