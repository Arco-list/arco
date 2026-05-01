import { AdminProjectsDataTable, type AdminProjectRow } from "@/components/admin-projects-data-table"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import type { Tables } from "@/lib/supabase/types"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

type ProjectStatusValue = "draft" | "in_progress" | "published" | "completed" | "archived" | "rejected"

async function loadAdminProjectsData() {
  const serviceSupabase = createServiceRoleSupabaseClient()

  const slugToLabel = (value: string | null) =>
    (value ?? "")
      .replace(/[-_]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean)
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join(" ")

  const [projectsResult, categoriesResult, taxonomyResult, projectProfessionalsResult] = await Promise.all([
    serviceSupabase
      .from("projects")
      .select(
        "id, title, slug, status, is_featured, rejection_reason, project_type, client_id, project_year, created_at, location, address_city, address_region, seo_indexed, seo_indexation_state, seo_impressions_28d, seo_clicks_28d, seo_ctr_28d, seo_position_28d, project_photos(count), project_categories(category_id, is_primary), client:profiles!projects_client_id_fkey(is_active)"
      )
      .eq("client.is_active", true)
      .order("created_at", { ascending: false, nullsFirst: false }),
    serviceSupabase.from("categories").select("id, name, slug"),
    serviceSupabase.from("project_taxonomy_options").select("id, name, slug"),
    serviceSupabase
      .from("project_professionals")
      .select("project_id, status, is_project_owner, company:companies(id, name, slug, status)")
      .not("company_id", "is", null),
  ])

  if (projectsResult.error) {
    logger.error("Failed to load admin projects", { table: "projects" }, projectsResult.error)
    throw new Error("Failed to load projects data")
  }
  if (categoriesResult.error) {
    logger.error("Failed to load categories", { table: "categories" }, categoriesResult.error)
  }
  if (taxonomyResult.error) {
    logger.error("Failed to load taxonomy options", { table: "project_taxonomy_options" }, taxonomyResult.error)
  }
  if (projectProfessionalsResult.error) {
    logger.error("Failed to load project professionals", { table: "project_professionals" }, projectProfessionalsResult.error)
  }

  // Build category/taxonomy lookup
  const normalizeKey = (value: string | null | undefined) => value?.trim()?.toLowerCase() ?? null

  const categoryIdToName = new Map<string, string>()
  const categorySlugToName = new Map<string, string>()
  for (const { id, name, slug } of categoriesResult.data ?? []) {
    const idKey = normalizeKey(id)
    const slugKey = normalizeKey(slug)
    if (idKey && name) categoryIdToName.set(idKey, name)
    if (slugKey && name) categorySlugToName.set(slugKey, name)
  }

  const taxonomyIdToName = new Map<string, string>()
  const taxonomySlugToName = new Map<string, string>()
  for (const { id, name, slug } of taxonomyResult.data ?? []) {
    const idKey = normalizeKey(id)
    const slugKey = normalizeKey(slug)
    if (idKey && name) taxonomyIdToName.set(idKey, name)
    if (slugKey && name) taxonomySlugToName.set(slugKey, name)
  }

  const resolveLabel = (raw: string | null | undefined) => {
    const normalized = normalizeKey(raw)
    if (!normalized) return null
    return (
      taxonomyIdToName.get(normalized) ??
      taxonomySlugToName.get(normalized) ??
      categoryIdToName.get(normalized) ??
      categorySlugToName.get(normalized) ??
      (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw?.trim() ?? "") ? null : slugToLabel(raw ?? null))
    )
  }

  // Build per-project companies map
  type LinkedCompany = { id: string; name: string; slug: string | null; status: string; isOwner: boolean; companyStatus: string }
  const statusSortOrder: Record<string, number> = {
    listed: 0, live_on_page: 1, invited: 2, unlisted: 3, rejected: 4, removed: 5,
  }
  const projectCompaniesMap = new Map<string, LinkedCompany[]>()
  for (const row of projectProfessionalsResult.data ?? []) {
    if (!row.project_id) continue
    const company = row.company as unknown as { id: string; name: string; slug: string | null; status: string | null } | null
    if (!company?.id || !company?.name) continue
    const existing = projectCompaniesMap.get(row.project_id) ?? []
    if (!existing.some((c) => c.id === company.id)) {
      existing.push({
        id: company.id,
        name: company.name,
        slug: company.slug ?? null,
        status: (row as any).status ?? "invited",
        isOwner: !!(row as any).is_project_owner,
        companyStatus: company.status ?? "unlisted",
      })
      projectCompaniesMap.set(row.project_id, existing)
    }
  }
  // Sort: owner first, then by contributor status priority
  for (const [key, companies] of projectCompaniesMap) {
    companies.sort((a, b) => {
      if (a.isOwner && !b.isOwner) return -1
      if (!a.isOwner && b.isOwner) return 1
      return (statusSortOrder[a.status] ?? 99) - (statusSortOrder[b.status] ?? 99)
    })
  }

  // Fetch owner profiles
  const clientIds = Array.from(
    new Set(
      (projectsResult.data ?? [])
        .map((p: any) => p.client_id)
        .filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
    )
  )

  const ownerProfileMap = new Map<string, { firstName: string | null; lastName: string | null; avatarUrl: string | null }>()
  if (clientIds.length > 0) {
    const { data: profiles, error: profilesError } = await serviceSupabase
      .from("profiles")
      .select("id, first_name, last_name, avatar_url")
      .in("id", clientIds)

    if (profilesError) {
      logger.error("Failed to load owner profiles", { table: "profiles" }, profilesError)
    } else {
      for (const profile of profiles ?? []) {
        ownerProfileMap.set(profile.id, {
          firstName: profile.first_name,
          lastName: profile.last_name,
          avatarUrl: profile.avatar_url,
        })
      }
    }
  }

  // Build project rows
  const projects: AdminProjectRow[] = (projectsResult.data ?? []).map((project: any) => {
    const id = project.id ?? ""
    const location = project.address_city ?? project.location ?? null

    const rawPhotoCount = project.project_photos?.[0]?.count ?? 0
    const imageCount = typeof rawPhotoCount === "number" ? rawPhotoCount : Number(rawPhotoCount ?? 0)

    // Resolve the building type from project_categories (primary = true),
    // NOT from project_type which stores the scope (Renovation, New Build, etc.)
    const primaryCategory = (project.project_categories ?? []).find((pc: any) => pc.is_primary)
    const projectType = primaryCategory?.category_id
      ? categoryIdToName.get(normalizeKey(primaryCategory.category_id) ?? "") ?? null
      : null

    // Owner
    const ownerProfile = project.client_id ? ownerProfileMap.get(project.client_id) : null
    const ownerName = ownerProfile
      ? [ownerProfile.firstName, ownerProfile.lastName].filter(Boolean).join(" ").trim() || null
      : null
    const owner = ownerName ? { name: ownerName, avatarUrl: ownerProfile?.avatarUrl ?? null } : null

    // Companies
    const companies = projectCompaniesMap.get(id) ?? []

    return {
      id,
      title: project.title ?? "Untitled project",
      slug: project.slug ?? null,
      status: (project.status ?? "draft") as ProjectStatusValue,
      projectType,
      imageCount,
      isFeatured: project.is_featured ?? false,
      location,
      createdAt: project.created_at ?? null,
      owner,
      companies,
      rejectionReason: project.rejection_reason ?? null,
      seoIndexed: project.seo_indexed ?? null,
      seoIndexationState: project.seo_indexation_state ?? null,
      seoImpressions28d: project.seo_impressions_28d ?? null,
      seoClicks28d: project.seo_clicks_28d ?? null,
      seoCtr28d: project.seo_ctr_28d != null ? Number(project.seo_ctr_28d) : null,
      seoPosition28d: project.seo_position_28d != null ? Number(project.seo_position_28d) : null,
    }
  })

  return projects
}

export default async function ProjectsPage() {
  const projects = await loadAdminProjectsData()

  const reviewProjects = projects.filter((p) => p.status === "in_progress")
  const firstReviewProjectId = reviewProjects[0]?.id ?? null

  return (
    <div className="min-h-screen bg-white">
      <div className="discover-page-title">
        <div className="wrap">
          <AdminProjectsDataTable
            projects={projects}
            reviewCount={reviewProjects.length}
            firstReviewProjectId={firstReviewProjectId}
          />
        </div>
      </div>
    </div>
  )
}
