import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import type { CatalogBrand, CatalogCategory, CatalogDealer, CatalogProject, CatalogSeries } from "@/lib/products/catalog-types"
import { locationFromRow, type LocationRecord } from "@/lib/locations/types"

export { categoryLabel, categoryTree } from "@/lib/products/catalog-types"
export type { CatalogBrand, CatalogCategory, CatalogDealer, CatalogProject, CatalogSeries } from "@/lib/products/catalog-types"

/**
 * De productlaag voor de publieke pagina's en het headermenu: soorten
 * (product_categories, drie niveaus), series (product_families) met hun
 * merk en in hoeveel projecten ze zijn toegepast, en merken.
 *
 * Service-role: de tabellen zijn admin-only in RLS en de pagina's zitten
 * achter requireProductsAdmin() zolang de laag niet publiek is. Zodra hij
 * dat wordt, krijgen de tabellen een leespolicy en verandert hier niets.
 */

/** Welke merken naar buiten mogen. Null = alle, zolang de laag admin-only
 *  is; bij het openstellen wordt dit ["listed", "prospected"]. */
const PUBLIC_BRAND_STATUSES: string[] | null = null

export async function getCatalogCategories(): Promise<CatalogCategory[]> {
  const supabase = createServiceRoleSupabaseClient() as any
  const { data } = await supabase
    .from("product_categories")
    .select("id, slug, name, name_nl, parent_id, order_index")
    .order("order_index")
  return ((data ?? []) as any[]).map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    nameNl: c.name_nl ?? null,
    parentId: c.parent_id ?? null,
    orderIndex: c.order_index ?? 0,
  }))
}

/** Alle series met merk en projectteller — klein genoeg om in één keer te
 *  halen en in code te filteren, en dat blijft lang zo. */
export async function getCatalogSeries(): Promise<CatalogSeries[]> {
  const supabase = createServiceRoleSupabaseClient() as any
  const [{ data: families }, { data: links }] = await Promise.all([
    supabase
      .from("product_families")
      .select("id, slug, name, description, hero_image_url, designer, launch_year, url, category_id, is_featured, brands(id, slug, name, logo_url, status)")
      .order("name"),
    supabase.from("project_brands").select("family_id, project_id").not("family_id", "is", null),
  ])
  const projectsByFamily = new Map<string, Set<string>>()
  for (const l of (links ?? []) as Array<{ family_id: string; project_id: string }>) {
    const set = projectsByFamily.get(l.family_id) ?? new Set<string>()
    set.add(l.project_id)
    projectsByFamily.set(l.family_id, set)
  }
  return ((families ?? []) as any[])
    .filter((f) => f.brands && (PUBLIC_BRAND_STATUSES === null || PUBLIC_BRAND_STATUSES.includes(f.brands.status)))
    .map((f) => ({
      id: f.id,
      slug: f.slug,
      name: f.name,
      description: f.description ?? null,
      heroImageUrl: f.hero_image_url ?? null,
      designer: f.designer ?? null,
      launchYear: f.launch_year ?? null,
      url: f.url ?? null,
      categoryId: f.category_id ?? null,
      isFeatured: Boolean(f.is_featured),
      brand: { id: f.brands.id, slug: f.brands.slug, name: f.brands.name, logoUrl: f.brands.logo_url ?? null },
      projectCount: projectsByFamily.get(f.id)?.size ?? 0,
    }))
}

export async function getCatalogBrands(): Promise<CatalogBrand[]> {
  const supabase = createServiceRoleSupabaseClient() as any
  const [{ data: brands }, { data: cats }, { data: families }, { data: links }] = await Promise.all([
    supabase
      .from("brands")
      .select("id, slug, name, domain, website, logo_url, description, country, founded_year, status")
      .order("name"),
    supabase.from("brand_categories").select("brand_id, category_id, position").order("position"),
    supabase.from("product_families").select("id, brand_id"),
    supabase.from("project_brands").select("brand_id, project_id"),
  ])
  const catsByBrand = new Map<string, string[]>()
  for (const r of (cats ?? []) as Array<{ brand_id: string; category_id: string }>) {
    const list = catsByBrand.get(r.brand_id) ?? []
    list.push(r.category_id)
    catsByBrand.set(r.brand_id, list)
  }
  const seriesByBrand = new Map<string, number>()
  for (const f of (families ?? []) as Array<{ brand_id: string }>) seriesByBrand.set(f.brand_id, (seriesByBrand.get(f.brand_id) ?? 0) + 1)
  const projectsByBrand = new Map<string, Set<string>>()
  for (const l of (links ?? []) as Array<{ brand_id: string; project_id: string }>) {
    const set = projectsByBrand.get(l.brand_id) ?? new Set<string>()
    set.add(l.project_id)
    projectsByBrand.set(l.brand_id, set)
  }
  return ((brands ?? []) as any[])
    .filter((b) => PUBLIC_BRAND_STATUSES === null || PUBLIC_BRAND_STATUSES.includes(b.status))
    .map((b) => ({
      id: b.id,
      slug: b.slug,
      name: b.name,
      domain: b.domain ?? null,
      website: b.website ?? null,
      logoUrl: b.logo_url ?? null,
      description: b.description ?? null,
      country: b.country ?? null,
      foundedYear: b.founded_year ?? null,
      status: b.status,
      categoryIds: catsByBrand.get(b.id) ?? [],
      seriesCount: seriesByBrand.get(b.id) ?? 0,
      projectCount: projectsByBrand.get(b.id)?.size ?? 0,
    }))
}

export async function getSeriesPhotos(familyId: string): Promise<Array<{ id: string; url: string; alt: string | null; isPrimary: boolean }>> {
  const supabase = createServiceRoleSupabaseClient() as any
  const { data } = await supabase
    .from("product_family_photos")
    .select("id, url, alt_text, is_primary, order_index")
    .eq("family_id", familyId)
    .order("order_index")
  return ((data ?? []) as any[]).map((p) => ({ id: p.id, url: p.url, alt: p.alt_text ?? null, isPrimary: Boolean(p.is_primary) }))
}

/** Gepubliceerde projecten waarin een serie of een merk is toegepast,
 *  als kaart — uit de materialized view die de discover-grid ook leest. */
async function projectsFor(column: "family_id" | "brand_id", id: string): Promise<CatalogProject[]> {
  const supabase = createServiceRoleSupabaseClient() as any
  const { data: links } = await supabase.from("project_brands").select("project_id").eq(column, id)
  const ids = Array.from(new Set(((links ?? []) as Array<{ project_id: string }>).map((l) => l.project_id)))
  if (ids.length === 0) return []
  const { data } = await supabase
    .from("mv_project_summary")
    .select("id, slug, title, primary_photo_url, location, primary_category")
    .in("id", ids)
    .eq("status", "published")
    .not("slug", "is", null)
  return ((data ?? []) as any[]).map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    imageUrl: p.primary_photo_url ?? null,
    location: p.location ?? null,
    type: p.primary_category ?? null,
  }))
}
export const getSeriesProjects = (familyId: string) => projectsFor("family_id", familyId)
export const getBrandProjects = (brandId: string) => projectsFor("brand_id", brandId)

/** Verkooppunten van een merk: bedrijven met het merk in company_brands,
 *  voor zover ze zelf zichtbaar zijn (listed, prospected). Officiële
 *  dealers eerst. */
export async function getBrandDealers(brandId: string, locale = "nl"): Promise<CatalogDealer[]> {
  const supabase = createServiceRoleSupabaseClient() as any
  const { data } = await supabase
    .from("company_brands")
    .select("is_official_dealer, created_at, companies(id, slug, name, logo_url, city, status, primary_service:categories!companies_primary_service_id_fkey(name, name_nl))")
    .eq("brand_id", brandId)
  return ((data ?? []) as any[])
    .filter((r) => r.companies && ["listed", "prospected"].includes(r.companies.status))
    .map((r) => ({
      companyId: r.companies.id as string,
      slug: r.companies.slug as string,
      name: r.companies.name as string,
      logoUrl: (r.companies.logo_url as string | null) ?? null,
      city: (r.companies.city as string | null) ?? null,
      service: (locale === "nl" ? r.companies.primary_service?.name_nl : null) ?? r.companies.primary_service?.name ?? null,
      isOfficialDealer: r.is_official_dealer === true,
    }))
    .sort((a, b) => Number(b.isOfficialDealer) - Number(a.isOfficialDealer) || a.name.localeCompare(b.name))
}

/** De eigen vestigingen van een merk (flagship stores, showrooms). */
export async function getBrandLocations(brandId: string): Promise<LocationRecord[]> {
  const supabase = createServiceRoleSupabaseClient() as any
  const { data } = await supabase.from("locations").select("*").eq("brand_id", brandId).order("position").order("created_at")
  return ((data ?? []) as Record<string, unknown>[]).map(locationFromRow)
}
