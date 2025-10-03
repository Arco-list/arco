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
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export default async function ProjectsPage() {
  const supabase = await createServerSupabaseClient()

  const slugToLabel = (value: string | null) =>
    (value ?? "")
      .replace(/[-_]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean)
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join(" ")

  const { data, error } = await supabase
    .from("mv_project_summary")
    .select(
      "id, title, slug, status, project_type, primary_category, style_preferences, features, project_year, created_at, is_featured, likes_count, location, photo_count"
    )
    .order("created_at", { ascending: false, nullsFirst: false })

  if (error) {
    console.error("Failed to load admin projects", error)
  }

  const serviceSupabase = createServiceRoleSupabaseClient()
  const [metaResult, categoriesResult, taxonomyResult] = await Promise.all([
    serviceSupabase.from("projects").select("id, seo_title, seo_description"),
    serviceSupabase.from("categories").select("id, name, slug"),
    serviceSupabase.from("project_taxonomy_options").select("id, name, slug"),
  ])

  const { data: metaData, error: metaError } = metaResult
  if (metaError) {
    console.error("Failed to load project meta", metaError)
  }

  const { data: categoriesData, error: categoriesError } = categoriesResult
  if (categoriesError) {
    console.error("Failed to load project categories", categoriesError)
  }

  const { data: taxonomyOptionsData, error: taxonomyError } = taxonomyResult
  if (taxonomyError) {
    console.error("Failed to load project taxonomy options", taxonomyError)
  }

  const metaMap = new Map(
    (metaData ?? []).map((meta) => [meta.id, { seo_title: meta.seo_title, seo_description: meta.seo_description }])
  )

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

  const projects: AdminProjectRow[] = (data ?? []).map((project) => {
    const id = project.id ?? ""
    const meta = metaMap.get(id)

    const seoTitle = meta?.seo_title ?? null
    const seoDescription = meta?.seo_description ?? null

    let seoStatus: string | null = null
    if (seoTitle && seoDescription) {
      seoStatus = "Ready"
    } else if (seoTitle || seoDescription) {
      seoStatus = "Partial"
    } else {
      seoStatus = "Missing"
    }

    const featureLabels = (project.features ?? [])
      .map((value) => resolveLabel(value))
      .filter((label): label is string => Boolean(label))

    const styleLabels = (project.style_preferences ?? [])
      .map((value) => resolveLabel(value))
      .filter((label): label is string => Boolean(label))

    const primaryCategoryName = resolveLabel(project.primary_category) ?? slugToLabel(project.primary_category)

    const projectTypeName = resolveLabel(project.project_type) ?? slugToLabel(project.project_type)

    return {
      id,
      title: project.title ?? "Untitled project",
      slug: project.slug,
      status: project.status ?? "draft",
      projectType: projectTypeName,
      primaryCategory: primaryCategoryName,
      styles: styleLabels,
      features: featureLabels,
      projectYear: project.project_year,
      createdAt: project.created_at,
      isFeatured: project.is_featured,
      likesCount: project.likes_count,
      location: project.location,
      imageCount: project.photo_count,
      seoTitle,
      seoDescription,
      seoStatus,
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
