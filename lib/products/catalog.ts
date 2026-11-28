import "server-only"
import { selectAll } from "@/lib/supabase/select-all"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import type { CatalogBrand, CatalogCategory, CatalogDealer, CatalogProduct, CatalogProject, CatalogCollection } from "@/lib/products/catalog-types"
import { locationFromRow, type LocationRecord } from "@/lib/locations/types"

export { activeCategories, categoryLabel, categoryTree, collectionKindsLabel } from "@/lib/products/catalog-types"
export type { CatalogBrand, CatalogCategory, CatalogDealer, CatalogProduct, CatalogProject, CatalogCollection } from "@/lib/products/catalog-types"

/**
 * De productlaag voor de publieke pagina's en het headermenu: soorten
 * (product_categories, drie niveaus), collecties (product_collections) met hun
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
    .select("id, slug, name, name_nl, parent_id, order_index, is_active, image_url")
    .order("order_index")
  return ((data ?? []) as any[]).map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    nameNl: c.name_nl ?? null,
    parentId: c.parent_id ?? null,
    orderIndex: c.order_index ?? 0,
    isActive: c.is_active ?? true,
    imageUrl: c.image_url ?? null,
  }))
}

/** Alle collecties met merk en projectteller — klein genoeg om in één keer te
 *  halen en in code te filteren, en dat blijft lang zo. */
export async function getCatalogCollections(): Promise<CatalogCollection[]> {
  const supabase = createServiceRoleSupabaseClient() as any
  const [{ data: collections }, { data: links }, { data: kindRows }, { data: productShots }, { data: productRows }, { data: coverRows }, { data: detLinks }, { data: productCats }] = await Promise.all([
    // In blokken: Supabase kapt elke query af op 1000 rijen.
    selectAll(() => supabase
      .from("product_collections")
      .select("id, slug, name, description, translations, hero_image_url, designer, launch_year, url, category_id, is_featured, brands(id, slug, name, logo_url, status)")
      .order("name")
      .order("id")),
    supabase.from("project_brands").select("collection_id, project_id").not("collection_id", "is", null),
    selectAll(() => supabase.from("product_collection_kinds").select("collection_id, category_id, position").order("position").order("collection_id").order("category_id")),
    // Productfoto's op wit (migratie 318), anders het beeld van het eerste product.
    selectAll(() => supabase.from("product_collection_photos").select("collection_id, url, order_index").eq("kind", "product").order("order_index").order("id")),
    selectAll(() => supabase.from("products").select("collection_id, image_url, position").not("image_url", "is", null).order("position").order("id")),
    // Focuspunten van de covers: de kaart snijdt bij zoals de hero.
    selectAll(() => supabase.from("product_collection_photos").select("collection_id, url, focus_x, focus_y, width, height").eq("is_primary", true).not("focus_x", "is", null).order("id")),
    // Goedgekeurde productherkenning telt ook (migratie 343).
    selectAll(() => supabase.from("project_detection_links").select("collection_id, project_id").not("collection_id", "is", null).order("detection_id")),
    // De soort van elk product (migratie 351): daarop filtert een soort zoals
    // Hoekbanken; de collectie zelf hangt alleen aan subgroepen.
    selectAll(() => supabase.from("products").select("id, collection_id, category_id").not("collection_id", "is", null).not("category_id", "is", null).order("id")),
  ])
  const focusByUrl = new Map<string, { x: number; y: number }>()
  // De maat erbij, zodat de kaart het punt kan centreren (focusPositionIn).
  const sizeByUrl = new Map<string, { width: number; height: number }>()
  for (const r of (coverRows ?? []) as Array<{ url: string; focus_x: number; focus_y: number; width: number | null; height: number | null }>) {
    focusByUrl.set(r.url, { x: r.focus_x, y: r.focus_y })
    if (r.width && r.height) sizeByUrl.set(r.url, { width: r.width, height: r.height })
  }
  const productImageByCollection = new Map<string, string>()
  for (const p of (productShots ?? []) as Array<{ collection_id: string; url: string }>) {
    if (!productImageByCollection.has(p.collection_id)) productImageByCollection.set(p.collection_id, p.url)
  }
  for (const p of (productRows ?? []) as Array<{ collection_id: string | null; image_url: string }>) {
    if (p.collection_id && !productImageByCollection.has(p.collection_id)) productImageByCollection.set(p.collection_id, p.image_url)
  }
  const kindsByCollection = new Map<string, string[]>()
  for (const k of (kindRows ?? []) as Array<{ collection_id: string; category_id: string }>) {
    kindsByCollection.set(k.collection_id, [...(kindsByCollection.get(k.collection_id) ?? []), k.category_id])
  }
  const productCatsByCollection = new Map<string, Set<string>>()
  for (const p of (productCats ?? []) as Array<{ collection_id: string; category_id: string }>) {
    const set = productCatsByCollection.get(p.collection_id) ?? new Set<string>()
    set.add(p.category_id)
    productCatsByCollection.set(p.collection_id, set)
  }
  const projectsByCollection = new Map<string, Set<string>>()
  for (const l of [...(links ?? []), ...(detLinks ?? [])] as Array<{ collection_id: string; project_id: string }>) {
    const set = projectsByCollection.get(l.collection_id) ?? new Set<string>()
    set.add(l.project_id)
    projectsByCollection.set(l.collection_id, set)
  }
  return ((collections ?? []) as any[])
    .filter((f) => f.brands && f.brands.status !== "suggested" && f.brands.status !== "passed" && (PUBLIC_BRAND_STATUSES === null || PUBLIC_BRAND_STATUSES.includes(f.brands.status)))
    .map((f) => ({
      id: f.id,
      slug: f.slug,
      name: f.name,
      description: f.description ?? null,
      descriptionNl: f.translations?.nl?.description?.trim() || null,
      heroImageUrl: f.hero_image_url ?? null,
      heroFocus: f.hero_image_url ? focusByUrl.get(f.hero_image_url) ?? null : null,
      heroSize: f.hero_image_url ? sizeByUrl.get(f.hero_image_url) ?? null : null,
      productImageUrl: productImageByCollection.get(f.id) ?? null,
      designer: f.designer ?? null,
      launchYear: f.launch_year ?? null,
      url: f.url ?? null,
      categoryId: f.category_id ?? null,
      kindIds: kindsByCollection.get(f.id) ?? [],
      productCategoryIds: Array.from(productCatsByCollection.get(f.id) ?? []),
      isFeatured: Boolean(f.is_featured),
      brand: { id: f.brands.id, slug: f.brands.slug, name: f.brands.name, logoUrl: f.brands.logo_url ?? null },
      projectCount: projectsByCollection.get(f.id)?.size ?? 0,
    }))
}

export async function getCatalogBrands(): Promise<CatalogBrand[]> {
  const supabase = createServiceRoleSupabaseClient() as any
  const [{ data: brands }, { data: cats }, { data: collections }, { data: links }, { data: detLinks }] = await Promise.all([
    selectAll(() => supabase
      .from("brands")
      .select("id, slug, name, domain, website, logo_url, description, translations, country, founded_year, status, is_featured")
      .order("name")
      .order("id")),
    selectAll(() => supabase.from("brand_categories").select("brand_id, category_id, position").order("position").order("brand_id").order("category_id")),
    supabase.from("product_collections").select("id, brand_id"),
    supabase.from("project_brands").select("brand_id, project_id"),
    // Goedgekeurde productherkenning telt ook (migratie 343).
    selectAll(() => supabase.from("project_detection_links").select("brand_id, project_id").order("detection_id")),
  ])
  const catsByBrand = new Map<string, string[]>()
  for (const r of (cats ?? []) as Array<{ brand_id: string; category_id: string }>) {
    const list = catsByBrand.get(r.brand_id) ?? []
    list.push(r.category_id)
    catsByBrand.set(r.brand_id, list)
  }
  const collectionByBrand = new Map<string, number>()
  for (const f of (collections ?? []) as Array<{ brand_id: string }>) collectionByBrand.set(f.brand_id, (collectionByBrand.get(f.brand_id) ?? 0) + 1)
  const projectsByBrand = new Map<string, Set<string>>()
  for (const l of [...(links ?? []), ...(detLinks ?? [])] as Array<{ brand_id: string; project_id: string }>) {
    const set = projectsByBrand.get(l.brand_id) ?? new Set<string>()
    set.add(l.project_id)
    projectsByBrand.set(l.brand_id, set)
  }
  return ((brands ?? []) as any[])
    // Een voorgesteld merk (migratie 347) is nog geen catalogusmerk; een merk
    // op Passed (niet premium, migratie 354) hoort er niet in.
    .filter((b) => b.status !== "suggested" && b.status !== "passed" && (PUBLIC_BRAND_STATUSES === null || PUBLIC_BRAND_STATUSES.includes(b.status)))
    .map((b) => ({
      id: b.id,
      slug: b.slug,
      name: b.name,
      domain: b.domain ?? null,
      website: b.website ?? null,
      logoUrl: b.logo_url ?? null,
      description: b.description ?? null,
      descriptionNl: b.translations?.nl?.description?.trim() || null,
      country: b.country ?? null,
      foundedYear: b.founded_year ?? null,
      status: b.status,
      isFeatured: Boolean(b.is_featured),
      categoryIds: catsByBrand.get(b.id) ?? [],
      collectionCount: collectionByBrand.get(b.id) ?? 0,
      projectCount: projectsByBrand.get(b.id)?.size ?? 0,
    }))
}

/** De producten van een collectie, in de volgorde van de pagina bij het merk. */
export async function getCollectionProducts(collectionId: string): Promise<CatalogProduct[]> {
  const supabase = createServiceRoleSupabaseClient() as any
  const [{ data }, { data: shot }] = await Promise.all([
    supabase.from("products").select("id, name, url, image_url, source_image_url, category_id").eq("collection_id", collectionId).order("position"),
    // Terugval voor een product zonder eigen beeld: de productfoto van de collectie.
    supabase.from("product_collection_photos").select("url").eq("collection_id", collectionId).eq("kind", "product").order("order_index").limit(1).maybeSingle(),
  ])
  const fallback: string | null = shot?.url ?? null
  return ((data ?? []) as any[]).map((p) => ({ id: p.id, name: p.name, url: p.url ?? null, imageUrl: p.image_url ?? fallback, sourceImageUrl: p.source_image_url ?? null, categoryId: p.category_id ?? null }))
}

export async function getCollectionPhotos(collectionId: string): Promise<Array<{ id: string; url: string; sourceUrl: string | null; alt: string | null; isPrimary: boolean; kind: string | null; width: number | null; height: number | null; focus: { x: number; y: number } | null }>> {
  const supabase = createServiceRoleSupabaseClient() as any
  const { data } = await supabase
    .from("product_collection_photos")
    .select("id, url, source_url, alt_text, is_primary, order_index, kind, width, height, focus_x, focus_y")
    .eq("collection_id", collectionId)
    .order("order_index")
  return ((data ?? []) as any[]).map((p) => ({ id: p.id, url: p.url, sourceUrl: p.source_url ?? null, alt: p.alt_text ?? null, isPrimary: Boolean(p.is_primary), kind: p.kind ?? null, width: p.width ?? null, height: p.height ?? null, focus: p.focus_x != null && p.focus_y != null ? { x: p.focus_x, y: p.focus_y } : null }))
}

/** Projecten waarin een collectie of een merk is toegepast, als kaart —
 *  uit de materialized view die de discover-grid ook leest. Alleen
 *  projecten met een stip voor dit merk of deze collectie op een foto
 *  (handmatig, migratie 317, of herkend en goedgekeurd, 343): de kaart
 *  toont die foto met alleen de eigen stip. Een koppeling zonder foto
 *  (project_brands) telt niet: dan zie je het product niet.
 *
 *  `includeInReview`: ook projecten in review en concepten. Alleen voor
 *  admins, en alleen zolang de merk- en collectiepagina's admin-only zijn
 *  (requireProductsAdmin); zet het uit als de laag publiek gaat. */
async function projectsFor(column: "collection_id" | "brand_id", id: string, options?: { includeInReview?: boolean }): Promise<CatalogProject[]> {
  const supabase = createServiceRoleSupabaseClient() as any
  const [{ data: tagRows }, { data: detRows }] = await Promise.all([
    supabase.from("project_photo_brand_tags").select("photo_id, created_at, photo:project_photos!inner(id, project_id, url, width, height)").eq(column, id).order("created_at"),
    // Goedgekeurde stippen van de productherkenning (migratie 343).
    supabase.from("project_detection_links").select("photo_id, project_id, created_at").eq(column, id).order("created_at"),
  ])
  // Per project de eerste foto met een stip voor dit merk of deze collectie:
  // eerst de handmatige tags, dan de herkende.
  const taggedByProject = new Map<string, { id: string; url: string; width: number | null; height: number | null }>()
  for (const r of (tagRows ?? []) as Array<{ photo: { id: string; project_id: string; url: string; width: number | null; height: number | null } | null }>) {
    if (r.photo && !taggedByProject.has(r.photo.project_id)) taggedByProject.set(r.photo.project_id, r.photo)
  }
  const detPhotoIds = ((detRows ?? []) as Array<{ photo_id: string; project_id: string }>).filter((r) => !taggedByProject.has(r.project_id)).map((r) => r.photo_id)
  if (detPhotoIds.length > 0) {
    const { data: detPhotos } = await supabase.from("project_photos").select("id, project_id, url, width, height").in("id", Array.from(new Set(detPhotoIds)))
    const photoById = new Map(((detPhotos ?? []) as Array<{ id: string; project_id: string; url: string; width: number | null; height: number | null }>).map((p) => [p.id, p]))
    for (const r of (detRows ?? []) as Array<{ photo_id: string; project_id: string }>) {
      const photo = photoById.get(r.photo_id)
      if (photo && !taggedByProject.has(r.project_id)) taggedByProject.set(r.project_id, photo)
    }
  }
  const ids = Array.from(taggedByProject.keys())
  if (ids.length === 0) return []
  const { data } = await supabase
    .from("mv_project_summary")
    .select("id, slug, title, primary_photo_url, location, primary_category, status")
    .in("id", ids)
    .eq("status", "published")
    .not("slug", "is", null)
  const rows = (data ?? []) as any[]
  // De view kent alleen gepubliceerde projecten; voor admins de rest uit
  // de tabel (in review en concept), met hun omslagfoto.
  if (options?.includeInReview) {
    const seen = new Set(rows.map((r) => r.id))
    const rest = ids.filter((pid) => !seen.has(pid))
    if (rest.length > 0) {
      const [{ data: extra }, { data: covers }] = await Promise.all([
        supabase.from("projects").select("id, slug, title, location, status").in("id", rest).in("status", ["in_progress", "draft"]).not("slug", "is", null),
        supabase.from("project_photos").select("project_id, url, is_primary, order_index").in("project_id", rest).order("is_primary", { ascending: false }).order("order_index"),
      ])
      const coverBy = new Map<string, string>()
      for (const c of (covers ?? []) as Array<{ project_id: string; url: string }>) if (!coverBy.has(c.project_id)) coverBy.set(c.project_id, c.url)
      for (const e of (extra ?? []) as any[]) rows.push({ ...e, primary_photo_url: coverBy.get(e.id) ?? null, primary_category: null })
    }
  }

  // Ruimteprojecten tonen hun ruimte in plaats van het type.
  const { data: kinds } = rows.length > 0
    ? await supabase.from("projects").select("id, kind, primary_space:spaces!projects_primary_space_id_fkey(slug)").in("id", rows.map((r) => r.id))
    : { data: [] }
  const spaceById = new Map<string, string>()
  for (const k of (kinds ?? []) as Array<{ id: string; kind: string | null; primary_space: { slug: string | null } | null }>) {
    if (k.kind === "partial" && k.primary_space?.slug) spaceById.set(k.id, k.primary_space.slug)
  }

  const { getPhotoBrandTags } = await import("@/lib/projects/photo-brand-tags")
  const photoIds = rows.map((p) => taggedByProject.get(p.id)?.id).filter((x): x is string => Boolean(x))
  // De pagina's zijn admin-only, dus de stippen linken naar Arco.
  const tagsByPhoto = await getPhotoBrandTags(photoIds, true)
  // Alleen de eigen stippen: op een collectiepagina die collectie, op een
  // merkpagina alles van het merk.
  const own = (t: { brandId?: string; collectionId?: string | null }) => column === "collection_id" ? t.collectionId === id : t.brandId === id

  // De architect of studio (het eigenaarsbedrijf), zoals op /projects:
  // alleen een zichtbaar bedrijf.
  const { data: owners } = rows.length > 0
    ? await supabase.from("project_professionals").select("project_id, company:companies!company_id(name, status)")
        .in("project_id", rows.map((r) => r.id)).eq("is_project_owner", true).in("status", ["live_on_page", "listed"])
    : { data: [] }
  const ownerBy = new Map<string, string>()
  for (const o of (owners ?? []) as Array<{ project_id: string; company: { name: string; status: string | null } | null }>) {
    if (o.company?.name && o.company.status !== "unclaimed" && !ownerBy.has(o.project_id)) ownerBy.set(o.project_id, o.company.name)
  }

  return rows
    .map((p) => {
      const photo = taggedByProject.get(p.id) ?? null
      return {
        id: p.id,
        slug: p.slug,
        title: p.title,
        imageUrl: photo?.url ?? p.primary_photo_url ?? null,
        location: p.location ?? null,
        type: p.primary_category ?? null,
        spaceSlug: spaceById.get(p.id) ?? null,
        status: p.status ?? null,
        professionalName: ownerBy.get(p.id) ?? null,
        taggedPhoto: photo ? { url: photo.url, width: photo.width, height: photo.height, tags: (tagsByPhoto.get(photo.id) ?? []).filter(own) } : null,
      }
    })
    // Projecten met een stip eerst: die laten het product echt zien.
    .sort((a, b) => Number(Boolean(b.taggedPhoto)) - Number(Boolean(a.taggedPhoto)))
}
export const getCollectionProjects = (collectionId: string, options?: { includeInReview?: boolean }) => projectsFor("collection_id", collectionId, options)
export const getBrandProjects = (brandId: string, options?: { includeInReview?: boolean }) => projectsFor("brand_id", brandId, options)

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

/** Alle showrooms over bedrijven en merken heen, voor /showrooms: met de
 *  eigenaar (naam, logo, pagina). Showrooms van bedrijven alleen als het
 *  bedrijf zelf zichtbaar is (listed, prospected). Op plaats, dan naam. */
export async function getAllShowrooms(): Promise<Array<{ location: LocationRecord; owner: { name: string; logoUrl: string | null; href: string } }>> {
  const supabase = createServiceRoleSupabaseClient() as any
  const { data } = await supabase
    .from("locations")
    .select("*, companies(slug, name, logo_url, status), brands(slug, name, logo_url)")
    .eq("kind", "showroom")
  return ((data ?? []) as any[])
    .flatMap((r) => {
      if (r.companies) {
        if (!["listed", "prospected"].includes(r.companies.status)) return []
        return [{ location: locationFromRow(r), owner: { name: r.companies.name as string, logoUrl: (r.companies.logo_url as string | null) ?? null, href: `/professionals/${r.companies.slug}` } }]
      }
      if (r.brands) {
        return [{ location: locationFromRow(r), owner: { name: r.brands.name as string, logoUrl: (r.brands.logo_url as string | null) ?? null, href: `/brands/${r.brands.slug}` } }]
      }
      return []
    })
    .sort((a, b) => (a.location.city ?? "~").localeCompare(b.location.city ?? "~") || a.owner.name.localeCompare(b.owner.name))
}
