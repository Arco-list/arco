import { createServerSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import type { ProfessionalProjectSummary, ProfessionalGalleryImage } from "@/lib/professionals/types"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (value?: string | null): value is string =>
  typeof value === "string" && UUID_REGEX.test(value.trim())

export type PhotographerDetail = {
  id: string
  slug: string
  name: string
  description: string | null
  city: string | null
  country: string | null
  domain: string | null
  websiteUrl: string | null
  logoUrl: string | null
  /** Year the photographer studio was founded — surfaced as "Active since". */
  foundedYear: number | null
  /** Languages from the linked professional record (if claimed). */
  languages: string[]
  /** Free-form specialty tags from companies.specialties (Phase 1 column). */
  specialties: string[]
  /** Distinct architect/owner companies this photographer has been credited beside. */
  collaborationsCount: number
  /** Address line for the contact section. */
  address: string | null
  /** Hero / cover photo URL. */
  coverPhotoUrl: string | null
  gallery: ProfessionalGalleryImage[]
  /** Projects this photographer is credited on — feeds the "Photographed projects" section. */
  projects: ProfessionalProjectSummary[]
  status: string
}

/**
 * Fetch a photographer profile by slug or id.
 *
 * Photographer companies live alongside other companies but are flagged
 * `audience='pro'` (set via the trigger from migration 147 whenever a service
 * with audience='pro' — currently just the Photographer category — is on
 * the company). This function is the photographer-only counterpart to
 * `fetchProfessionalDetail`; it doesn't share the materialized view path
 * (mv_professional_summary excludes pro-audience rows by design).
 *
 * Visibility rules:
 *   • Public viewers see only `status='listed'` photographers.
 *   • `allowUnlisted: true` lets owners/admins preview drafts and unclaimed.
 *
 * Returns null when the slug doesn't exist or the company isn't a
 * photographer (audience !== 'pro').
 */
export async function fetchPhotographerDetail(
  slugOrId: string,
  options?: { allowUnlisted?: boolean },
): Promise<PhotographerDetail | null> {
  const supabase = await createServerSupabaseClient()

  const companyQuery = isUuid(slugOrId)
    ? supabase.from("companies").select("*").eq("id", slugOrId).maybeSingle()
    : supabase.from("companies").select("*").eq("slug", slugOrId).maybeSingle()

  const { data: company, error: companyError } = await companyQuery

  if (companyError) {
    logger.error("Failed to fetch photographer company", { slugOrId, supabaseError: companyError })
    return null
  }
  if (!company) return null

  // Audience gate: this route is photographer-only. Companies in other
  // categories should not resolve here even if someone guesses the URL.
  if (company.audience !== "pro") return null

  const PUBLIC_STATUSES = new Set(["listed", "prospected"])
  if (!PUBLIC_STATUSES.has(company.status as string) && !options?.allowUnlisted) {
    return null
  }

  const companyId = company.id as string

  // Parallel: photos, social, project credits, professional record (for
  // languages, since photographers may also have a professional row).
  const [photosResult, projectLinksResult, professionalResult] = await Promise.all([
    supabase.rpc("get_public_company_photos", { p_company_id: companyId }),
    supabase
      .from("project_professionals")
      .select("project_id, status, cover_photo_id")
      .eq("company_id", companyId)
      .limit(50),
    supabase
      .from("professionals")
      .select("languages_spoken")
      .eq("company_id", companyId)
      .limit(1)
      .maybeSingle(),
  ])

  if (photosResult.error) {
    logger.warn("Failed to load photos for photographer", { companyId, supabaseError: photosResult.error })
  }
  if (projectLinksResult.error) {
    logger.warn("Failed to load project links for photographer", { companyId, supabaseError: projectLinksResult.error })
  }

  const galleryRows: any[] = Array.isArray(photosResult.data) ? (photosResult.data as any[]) : []
  const gallery: ProfessionalGalleryImage[] = galleryRows
    .filter((row) => typeof row?.url === "string" && row.url.length > 0)
    .map((row) => ({
      id: row.id,
      url: row.url,
      altText: row.alt_text ?? null,
      isCover: row.is_cover === true,
    }))

  const coverPhotoUrl =
    (company as any).hero_photo_url ??
    gallery.find((g) => g.isCover)?.url ??
    gallery[0]?.url ??
    null

  // Build the credited-projects list. Mirror fetchProfessionalDetail's logic
  // for cover_photo_id overrides.
  const linkRows = Array.isArray(projectLinksResult.data) ? projectLinksResult.data as any[] : []
  const visibleLinks = linkRows.filter((row) => row?.status === "live_on_page")
  const projectIds = Array.from(new Set(visibleLinks.map((r) => r.project_id))).filter(Boolean) as string[]
  const coverPhotoIdMap = new Map<string, string>()
  for (const row of visibleLinks) {
    if (row.project_id && row.cover_photo_id) coverPhotoIdMap.set(row.project_id, row.cover_photo_id)
  }

  let projects: ProfessionalProjectSummary[] = []
  if (projectIds.length > 0) {
    const [projectsResult, coverPhotosResult] = await Promise.all([
      supabase
        .from("projects")
        .select("id, slug, title, address_city, project_year, project_type, project_type_category_id, style_preferences, likes_count, status")
        .in("id", projectIds)
        .eq("status", "published"),
      coverPhotoIdMap.size > 0
        ? supabase
            .from("project_photos")
            .select("id, url, project_id, is_primary, order_index")
            .in("project_id", projectIds)
        : Promise.resolve({ data: [] as any[] }),
    ])

    const coverUrlByProject = new Map<string, string>()
    const fallbackUrlByProject = new Map<string, string>()
    for (const photo of (coverPhotosResult.data as any[] ?? [])) {
      if (!photo?.url || !photo?.project_id) continue
      // Track is_primary photo as a fallback if no contributor-specific cover
      if (photo.is_primary && !fallbackUrlByProject.has(photo.project_id)) {
        fallbackUrlByProject.set(photo.project_id, photo.url)
      }
      // Match contributor-specific cover photo
      const overrideId = coverPhotoIdMap.get(photo.project_id)
      if (overrideId && photo.id === overrideId) {
        coverUrlByProject.set(photo.project_id, photo.url)
      }
    }

    projects = (projectsResult.data ?? []).map((p: any) => ({
      id: p.id,
      slug: p.slug,
      title: p.title ?? "Untitled",
      location: p.address_city ?? null,
      image: coverUrlByProject.get(p.id) ?? fallbackUrlByProject.get(p.id) ?? null,
      likesCount: p.likes_count ?? null,
      projectYear: p.project_year ?? null,
      stylePreferences: Array.isArray(p.style_preferences) ? (p.style_preferences as string[]) : null,
      projectType: p.project_type ?? null,
    }))
  }

  // Architect collaborations: count distinct project owners' companies that
  // this photographer has been credited beside on a published project.
  // Single round-trip — pull all owner credits for our project ids and
  // dedupe client-side.
  let collaborationsCount = 0
  if (projectIds.length > 0) {
    const { data: ownerRows } = await supabase
      .from("project_professionals")
      .select("company_id, project_id, is_project_owner")
      .in("project_id", projectIds)
      .eq("is_project_owner", true)
    const ownerCompanyIds = new Set(
      (ownerRows ?? [])
        .map((r: any) => r.company_id)
        .filter((id: string | null) => Boolean(id)),
    )
    collaborationsCount = ownerCompanyIds.size
  }

  // Languages: from the professional record (if any). Companies don't carry
  // a languages column — that's a property of the team_members.
  const languages: string[] = Array.isArray((professionalResult.data as any)?.languages_spoken)
    ? ((professionalResult.data as any).languages_spoken as string[])
    : []

  const specialties: string[] = Array.isArray((company as any).specialties)
    ? ((company as any).specialties as string[])
    : []

  const websiteUrl = (company as any).website
    ? ((company as any).website as string)
    : (company as any).domain
      ? `https://${(company as any).domain}`
      : null

  return {
    id: companyId,
    slug: (company as any).slug ?? slugOrId,
    name: (company as any).name ?? "Photographer",
    description: (company as any).description ?? null,
    city: (company as any).city ?? null,
    country: (company as any).country ?? null,
    domain: (company as any).domain ?? null,
    websiteUrl,
    logoUrl: (company as any).logo_url ?? null,
    foundedYear: (company as any).founded_year ?? null,
    languages,
    specialties,
    collaborationsCount,
    address: (company as any).address ?? null,
    coverPhotoUrl,
    gallery,
    projects,
    status: (company as any).status as string,
  }
}

export async function fetchPhotographerMetadata(slugOrId: string): Promise<{
  name: string
  description: string | null
  city: string | null
  coverImageUrl: string | null
} | null> {
  const detail = await fetchPhotographerDetail(slugOrId)
  if (!detail) return null
  return {
    name: detail.name,
    description: detail.description,
    city: detail.city,
    coverImageUrl: detail.coverPhotoUrl,
  }
}
