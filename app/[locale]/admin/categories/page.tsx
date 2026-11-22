import { AdminCategoriesDataTable, type AdminCategoryRow, type AdminSpaceRow } from "@/components/admin-categories-data-table"
import { selectAll } from "@/lib/supabase/select-all"
import { canonicalizeScope } from "@/lib/project-translations"
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
    cutoutUrl: row.cutout_url ?? null,
    inHomeCarrousel: row.in_home_carrousel ?? false,
  }))

  // Fetch product categories (separate table)
  const [{ data: productCategoriesData }, { data: brandCategoryRows }, { data: collectionRows }, { data: collectionKindRows }, { data: productShotRows }] = await Promise.all([
    (serviceSupabase as any).from("product_categories").select("id, slug, name, name_nl, parent_id, order_index, is_active, image_url").order("order_index"),
    selectAll(() => (serviceSupabase as any).from("brand_categories").select("brand_id, category_id").order("brand_id").order("category_id")),
    (serviceSupabase as any).from("product_collections").select("id, category_id"),
    (serviceSupabase as any).from("product_collection_kinds").select("collection_id, category_id"),
    (serviceSupabase as any).from("product_collection_photos").select("collection_id, url, order_index").eq("kind", "product").order("order_index"),
  ])
  // Voorbeeld van de automatische schijf op /products: een productfoto uit
  // een collectie in de groep (de publieke pagina kiest de meest toegepaste).
  const productShot = new Map<string, string>()
  for (const r of (productShotRows ?? []) as Array<{ collection_id: string; url: string }>) if (!productShot.has(r.collection_id)) productShot.set(r.collection_id, r.url)

  const productCategoryNameMap = new Map<string, string>()
  for (const row of productCategoriesData ?? []) {
    productCategoryNameMap.set(row.id, row.name)
  }

  // Merken en collecties per categorie, inclusief alles eronder: een
  // collectie met de soort Banken telt mee bij Banken & fauteuils en Meubels.
  // Een collectie telt via zijn groep (category_id) en via elke soort.
  const productParent = new Map<string, string | null>(((productCategoriesData ?? []) as any[]).map((r) => [r.id, r.parent_id ?? null]))
  const upTree = (id: string | null): string[] => { const out: string[] = []; for (let cur = id; cur; cur = productParent.get(cur) ?? null) out.push(cur); return out }
  const brandsPer = new Map<string, Set<string>>()
  for (const r of (brandCategoryRows ?? []) as Array<{ brand_id: string; category_id: string }>) {
    for (const id of upTree(r.category_id)) { if (!brandsPer.has(id)) brandsPer.set(id, new Set()); brandsPer.get(id)!.add(r.brand_id) }
  }
  const collectionsPer = new Map<string, Set<string>>()
  const addCollection = (catId: string | null, collectionId: string) => {
    for (const id of upTree(catId)) { if (!collectionsPer.has(id)) collectionsPer.set(id, new Set()); collectionsPer.get(id)!.add(collectionId) }
  }
  for (const r of (collectionRows ?? []) as Array<{ id: string; category_id: string | null }>) addCollection(r.category_id, r.id)
  for (const r of (collectionKindRows ?? []) as Array<{ collection_id: string; category_id: string }>) addCollection(r.category_id, r.collection_id)

  const productCategories = ((productCategoriesData ?? []) as any[]).map((row: any) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    nameNl: row.name_nl ?? null,
    parentId: row.parent_id ?? null,
    parentName: row.parent_id ? productCategoryNameMap.get(row.parent_id) ?? null : null,
    orderIndex: row.order_index ?? 0,
    isActive: row.is_active ?? true,
    imageUrl: row.image_url ?? null,
    autoImageUrl: Array.from(collectionsPer.get(row.id) ?? []).map((id) => productShot.get(id)).find(Boolean) ?? null,
    brandCount: brandsPer.get(row.id)?.size ?? 0,
    collectionCount: collectionsPer.get(row.id)?.size ?? 0,
  }))

  // Fetch counts for categories and spaces, plus the connections
  // (service ↔ space, product group ↔ space; migration 297)
  const [projectCategoriesResult, professionalServicesResult, spacePhotosResult, serviceSpacesResult, partialFeaturesResult] = await Promise.all([
    // Count projects per type category
    serviceSupabase.from("project_categories").select("category_id"),
    // Count professionals per service
    serviceSupabase.from("professionals").select("services_offered"),
    // Count photos per space (via project_features)
    serviceSupabase.from("project_features").select("space_id"),
    serviceSupabase.from("service_spaces").select("service_id, space_id"),
    // Soort, scope en primaire ruimte per project: tellingen per scope
    // (projecten) en per primaire ruimte (ruimteprojecten).
    serviceSupabase.from("projects").select("kind, project_type, primary_space_id"),
  ])
  const serviceSpaces = (serviceSpacesResult.data ?? []).map((r) => ({ serviceId: r.service_id, spaceId: r.space_id }))
  // Een ruimteproject telt bij de ruimte die het IS (primary_space_id),
  // niet bij elke ruimte waar het een foto in heeft.
  const partialCountBySpace: Record<string, number> = {}
  const scopeCounts: Record<string, number> = {}
  for (const row of (partialFeaturesResult.data ?? []) as Array<{ kind: string | null; project_type: string | null; primary_space_id: string | null }>) {
    if (row.kind === "partial") {
      if (row.primary_space_id) partialCountBySpace[row.primary_space_id] = (partialCountBySpace[row.primary_space_id] ?? 0) + 1
      continue
    }
    const scope = canonicalizeScope(row.project_type)
    if (scope) scopeCounts[scope] = (scopeCounts[scope] ?? 0) + 1
  }

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

  // Bedrijven in Sales per dienst: bedrijven met minstens één prospect die
  // niet uit de funnel is gehaald, geteld op hun hoofddienst. Pagineren,
  // want PostgREST kapt af op 1000 rijen.
  async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
    const rows: T[] = []
    for (let from = 0; ; from += 1000) {
      const { data } = await build(from, from + 999)
      rows.push(...(data ?? []))
      if ((data ?? []).length < 1000) break
    }
    return rows
  }
  const [salesProspects, salesCompanies] = await Promise.all([
    fetchAll<{ company_id: string | null }>((from, to) =>
      (serviceSupabase as any).from("prospects").select("company_id").neq("status", "removed").not("company_id", "is", null).order("id").range(from, to)),
    fetchAll<{ id: string; primary_service_id: string | null }>((from, to) =>
      (serviceSupabase as any).from("companies").select("id, primary_service_id").not("primary_service_id", "is", null).order("id").range(from, to)),
  ])
  const inSalesCompanyIds = new Set(salesProspects.map((r) => r.company_id).filter(Boolean) as string[])
  const inSalesByService = new Map<string, number>()
  for (const company of salesCompanies) {
    if (!company.primary_service_id || !inSalesCompanyIds.has(company.id)) continue
    inSalesByService.set(company.primary_service_id, (inSalesByService.get(company.primary_service_id) ?? 0) + 1)
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
    proNamePlural: row.pro_name_plural ?? null,
    proNamePluralNl: row.pro_name_plural_nl ?? null,
    tamNl: row.tam_nl ?? null,
    samNl: row.sam_nl ?? null,
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
    projectScopes: Array.isArray(row.project_scopes) ? row.project_scopes : [],
    inSales: inSalesByService.get(row.id) ?? 0,
    count: projectCountByCategory.get(row.id) ?? professionalCountByService.get(row.id) ?? 0,
  }))

  return (
    <div className="min-h-screen bg-white">
      {/* The table renders the sticky full-bleed workbench bar and
          wraps its own content. */}
      <AdminCategoriesDataTable categories={categories} spaces={spaces} productCategories={productCategories} serviceSpaces={serviceSpaces} partialCountBySpace={partialCountBySpace} scopeCounts={scopeCounts} />
    </div>
  )
}
