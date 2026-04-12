import { AdminCategoriesDataTable, type AdminCategoryRow, type AdminSpaceRow } from "@/components/admin-categories-data-table"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"

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

  // Count products per product category
  const { data: productCategoryProducts } = await serviceSupabase
    .from("products")
    .select("category_id")
    .not("category_id", "is", null)

  const productCountByProductCategory = new Map<string, number>()
  for (const row of productCategoryProducts ?? []) {
    const catId = (row as any).category_id as string
    productCountByProductCategory.set(catId, (productCountByProductCategory.get(catId) ?? 0) + 1)
  }

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
    productCount: productCountByProductCategory.get(row.id) ?? 0,
  }))

  // Fetch counts for categories and spaces
  const [projectCategoriesResult, professionalServicesResult, spacePhotosResult] = await Promise.all([
    // Count projects per type category
    serviceSupabase.from("project_categories").select("category_id"),
    // Count professionals per service
    serviceSupabase.from("professionals").select("services_offered"),
    // Count photos per space (via project_features)
    serviceSupabase.from("project_features").select("space_id"),
  ])

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
    canPublishProjects: row.can_publish_projects ?? false,
    count: projectCountByCategory.get(row.id) ?? professionalCountByService.get(row.id) ?? 0,
  }))

  return (
    <div className="min-h-screen bg-white">
      <div className="discover-page-title">
        <div className="wrap">
          <AdminCategoriesDataTable categories={categories} spaces={spaces} productCategories={productCategories} />
        </div>
      </div>
    </div>
  )
}
