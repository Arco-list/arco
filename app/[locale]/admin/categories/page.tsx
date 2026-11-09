import { AdminCategoriesDataTable, type AdminCategoryRow, type AdminSpaceRow } from "@/components/admin-categories-data-table"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { toPublishScope } from "@/lib/publish-scope"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Categories" }

export const dynamic = "force-dynamic"

export default async function CategoriesPage() {
  const serviceSupabase = createServiceRoleSupabaseClient()

  // Select * to include category_type & category_hierarchy (not in generated types)
  const { data, error } = await serviceSupabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true })

  if (error) {
    logger.error("Failed to load categories", { table: "categories" }, error)
  }

  const { data: spacesData, error: spacesError } = await serviceSupabase
    .from("spaces")
    .select("*")
    .order("sort_order", { ascending: true })

  if (spacesError) {
    logger.error("Failed to load spaces", { table: "spaces" }, spacesError)
  }

  const spaces: AdminSpaceRow[] = (spacesData ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    iconKey: row.icon_key ?? null,
    sortOrder: row.sort_order ?? 0,
    isActive: row.is_active ?? true,
    photoCount: 0, // will be populated after counts are fetched
    imageUrl: row.image_url ?? null,
    inHomeCarrousel: row.in_home_carrousel ?? false,
  }))

  // Fetch product categories (separate table)
  const { data: productCategoriesData } = await serviceSupabase
    .from("product_categories")
    .select("id, slug, name, parent_id, order_index")
    .order("order_index")

  const productCategoryNameMap = new Map<string, string>()
  for (const row of productCategoriesData ?? []) {
    productCategoryNameMap.set(row.id, row.name)
  }

  const productCategories = (productCategoriesData ?? []).map((row: any) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    parentId: row.parent_id ?? null,
    parentName: row.parent_id ? productCategoryNameMap.get(row.parent_id) ?? null : null,
    orderIndex: row.order_index ?? 0,
  }))

  // Fetch counts for categories and spaces, plus the connections
  // (service ↔ space, product group ↔ space; migration 297)
  const [projectCategoriesResult, professionalServicesResult, spacePhotosResult, serviceSpacesResult, productSpacesResult, partialFeaturesResult] = await Promise.all([
    // Count projects per type category
    serviceSupabase.from("project_categories").select("category_id"),
    // Count professionals per service
    serviceSupabase.from("professionals").select("services_offered"),
    // Count photos per space (via project_features)
    serviceSupabase.from("project_features").select("space_id"),
    serviceSupabase.from("service_spaces").select("service_id, space_id"),
    serviceSupabase.from("product_category_spaces").select("product_category_id, space_id"),
    // Deelprojecten per ruimte (projects.kind = 'partial', via hun features)
    serviceSupabase.from("project_features").select("project_id, space_id, projects!inner(kind)").eq("projects.kind", "partial"),
  ])
  const serviceSpaces = (serviceSpacesResult.data ?? []).map((r) => ({ serviceId: r.service_id, spaceId: r.space_id }))
  const productCategorySpaces = (productSpacesResult.data ?? []).map((r) => ({ productCategoryId: r.product_category_id, spaceId: r.space_id }))
  const partialProjectsBySpace = new Map<string, Set<string>>()
  for (const row of (partialFeaturesResult.data ?? []) as Array<{ project_id: string | null; space_id: string | null }>) {
    if (!row.space_id || !row.project_id) continue
    const set = partialProjectsBySpace.get(row.space_id) ?? new Set<string>()
    set.add(row.project_id)
    partialProjectsBySpace.set(row.space_id, set)
  }
  const partialCountBySpace = Object.fromEntries(Array.from(partialProjectsBySpace, ([spaceId, set]) => [spaceId, set.size]))

  // Project count per category
  const projectCountByCategory = new Map<string, number>()
  for (const row of projectCategoriesResult.data ?? []) {
    if (!row.category_id) continue
    projectCountByCategory.set(row.category_id, (projectCountByCategory.get(row.category_id) ?? 0) + 1)
  }

  // Professional count per service
  const professionalCountByService = new Map<string, number>()
  for (const row of professionalServicesResult.data ?? []) {
    const services = (row as any).services_offered as string[] | null
    if (!services) continue
    for (const svcId of services) {
      professionalCountByService.set(svcId, (professionalCountByService.get(svcId) ?? 0) + 1)
    }
  }

  // Photo count per space
  const photoCountBySpace = new Map<string, number>()
  for (const row of spacePhotosResult.data ?? []) {
    if (!(row as any).space_id) continue
    const spaceId = (row as any).space_id as string
    photoCountBySpace.set(spaceId, (photoCountBySpace.get(spaceId) ?? 0) + 1)
  }

  // Populate space photo counts
  for (const space of spaces) {
    space.photoCount = photoCountBySpace.get(space.id) ?? 0
  }

  const rawData = (data ?? []) as any[]

  // Build parent name lookup
  const nameMap = new Map<string, string>()
  for (const row of rawData) {
    nameMap.set(row.id, row.name)
  }

  const categories: AdminCategoryRow[] = rawData.map((row) => ({
    id: row.id,
    name: row.name,
    nameNl: row.name_nl ?? null,
    slug: row.slug,
    description: row.description ?? null,
    parentId: row.parent_id ?? null,
    parentName: row.parent_id ? nameMap.get(row.parent_id) ?? null : null,
    isActive: row.is_active ?? true,
    sortOrder: row.sort_order ?? null,
    updatedAt: row.updated_at ?? null,
    categoryType: row.category_type ?? null,
    categoryHierarchy: row.category_hierarchy ?? null,
    inHomeCarrousel: row.in_home_carrousel ?? false,
    imageUrl: row.image_url ?? null,
    publishScope: toPublishScope(row.publish_scope, row.can_publish_projects),
    count: projectCountByCategory.get(row.id) ?? professionalCountByService.get(row.id) ?? 0,
  }))

  return (
    <div className="min-h-screen bg-white">
      {/* The table renders the sticky full-bleed workbench bar and
          wraps its own content. */}
      <AdminCategoriesDataTable categories={categories} spaces={spaces} productCategories={productCategories} serviceSpaces={serviceSpaces} productCategorySpaces={productCategorySpaces} partialCountBySpace={partialCountBySpace} />
    </div>
  )
}
