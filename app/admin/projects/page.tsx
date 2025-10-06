import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"

import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminProjectsTable, type AdminProjectRow } from "@/components/admin-projects-table"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import type { Tables } from "@/lib/supabase/types"

export const dynamic = "force-dynamic"

type ProjectQueryRow = Tables<"projects"> & {
  project_photos: Array<{ count: number | null }> | null
  project_categories: Array<{ category_id: string | null; is_primary: boolean | null }> | null
  client?: {
    is_active: boolean | null
  } | null
}

export default async function ProjectsPage() {

  const slugToLabel = (value: string | null) =>
    (value ?? "")
      .replace(/[-_]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean)
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join(" ")

  const serviceSupabase = createServiceRoleSupabaseClient()

  const [projectsResult, categoriesResult, taxonomyResult] = await Promise.all([
    serviceSupabase
      .from("projects")
      .select(
        `id, title, slug, status, project_type, project_type_category_id, style_preferences, features, project_year, created_at, is_featured, likes_count, location, project_size, building_type, seo_title, seo_description, status_updated_at, status_updated_by, rejection_reason, project_photos(count), project_categories(category_id,is_primary), client:profiles!projects_client_id_fkey(is_active)`
      )
      .order("created_at", { ascending: false, nullsFirst: false }),
    serviceSupabase.from("categories").select("id, name, slug"),
    serviceSupabase.from("project_taxonomy_options").select("id, name, slug"),
  ])

  const { data: projectsDataRaw, error: projectsError } = projectsResult
  if (projectsError) {
    console.error("Failed to load admin projects", projectsError)
  }

  const projectsData = (projectsDataRaw as ProjectQueryRow[] | null)?.filter((project) => project.client?.is_active ?? false) ?? []

  const { data: categoriesData, error: categoriesError } = categoriesResult
  if (categoriesError) {
    console.error("Failed to load project categories", categoriesError)
  }

  const { data: taxonomyOptionsData, error: taxonomyError } = taxonomyResult
  if (taxonomyError) {
    console.error("Failed to load project taxonomy options", taxonomyError)
  }

  const normalizeKey = (value: string | null | undefined) => {
    const trimmed = value?.trim()
    if (!trimmed) return null
    return trimmed.toLowerCase()
  }

  const categoryIdToName = new Map<string, string>()
  const categorySlugToName = new Map<string, string>()
  ;(categoriesData ?? []).forEach(({ id, name, slug }) => {
    const idKey = normalizeKey(id)
    const slugKey = normalizeKey(slug)
    if (idKey && name) categoryIdToName.set(idKey, name)
    if (slugKey && name) categorySlugToName.set(slugKey, name)
  })

  const taxonomyIdToName = new Map<string, string>()
  const taxonomySlugToName = new Map<string, string>()
  ;(taxonomyOptionsData ?? []).forEach(({ id, name, slug }) => {
    const idKey = normalizeKey(id)
    const slugKey = normalizeKey(slug)
    if (idKey && name) taxonomyIdToName.set(idKey, name)
    if (slugKey && name) taxonomySlugToName.set(slugKey, name)
  })

  const resolveLabel = (raw: string | null | undefined) => {
    const normalized = normalizeKey(raw)
    if (!normalized) return null

    const directLabel =
      taxonomyIdToName.get(normalized) ??
      taxonomySlugToName.get(normalized) ??
      categoryIdToName.get(normalized) ??
      categorySlugToName.get(normalized)

    if (directLabel) {
      return directLabel
    }

    const original = raw?.trim()
    if (!original) return null

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidPattern.test(original)) {
      return original
    }

    return slugToLabel(original)
  }

  const projects: AdminProjectRow[] = projectsData.map((project) => {
    const id = project.id ?? ""

    const seoTitle = project.seo_title ?? null
    const seoDescription = project.seo_description ?? null
    const statusUpdatedAt = project.status_updated_at ?? null
    const statusUpdatedBy = project.status_updated_by ?? null
    const rejectionReason = project.rejection_reason ?? null

    let seoStatus: string | null = null
    if (seoTitle && seoDescription) {
      seoStatus = "Ready"
    } else if (seoTitle || seoDescription) {
      seoStatus = "Partial"
    } else {
      seoStatus = "Missing"
    }

    const featureLabels = ((project.features as string[] | null) ?? [])
      .map((value) => resolveLabel(value))
      .filter((label): label is string => Boolean(label))

    const styleLabels = ((project.style_preferences as string[] | null) ?? [])
      .map((value) => resolveLabel(value))
      .filter((label): label is string => Boolean(label))

    const primaryCategoryId = project.project_categories?.find((category) => category.is_primary)?.category_id ?? null
    const primaryCategoryName = resolveLabel(primaryCategoryId) ?? slugToLabel(primaryCategoryId)

    const projectTypeName = resolveLabel(project.project_type) ?? slugToLabel(project.project_type)

    const rawPhotoCount = project.project_photos?.[0]?.count ?? 0
    const photoCount = typeof rawPhotoCount === "number" ? rawPhotoCount : Number(rawPhotoCount ?? 0)

    return {
      id,
      title: project.title ?? "Untitled project",
      slug: project.slug,
      status: (project.status ?? "draft") as AdminProjectRow["status"],
      projectType: projectTypeName,
      primaryCategory: primaryCategoryName,
      styles: styleLabels,
      features: featureLabels,
      projectYear: project.project_year,
      createdAt: project.created_at,
      isFeatured: project.is_featured,
      likesCount: project.likes_count,
      location: project.location,
      imageCount: photoCount,
      seoTitle,
      seoDescription,
      seoStatus,
      statusUpdatedAt,
      statusUpdatedBy,
      rejectionReason,
    }
  })

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/admin">Admin Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Projects</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto px-4">
            <Button asChild size="sm" variant="outline">
              <a href="/admin/projects">Refresh</a>
            </Button>
          </div>
        </header>
        <Separator className="w-full" />
        <div className="flex flex-1 flex-col gap-6 p-6">
          <AdminProjectsTable projects={projects} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
