import type { Metadata } from "next"
import { selectAll } from "@/lib/supabase/select-all"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { BrandsClient } from "./brands-client"

export const metadata: Metadata = { title: "Brands" }

export const dynamic = "force-dynamic"
// Add brand runs as three server actions (brand, collection, one per collection
// page); the longest scrapes one page and reads it with Claude.
export const maxDuration = 120

/**
 * Eén rij per merk, in de vorm van de Companies-tabel.
 *
 * De twee tellingen die de rij dragen zijn de merk-equivalenten van wat
 * bij een bedrijf "gepubliceerd werk" is: hoeveel COLLECTION het merk heeft
 * (is er iets te tonen) en in hoeveel PROJECTEN het is toegepast (is er
 * bewijs). Producten tellen niet meer mee; die laag is uit het model.
 */
export type AdminBrandRow = {
  id: string
  slug: string
  name: string
  domain: string | null
  website: string | null
  logo_url: string | null
  city: string | null
  country: string | null
  /** Eerste productcategorie van het merk (brand_categories, positie 0). */
  category: string | null
  /** Alle productcategorieën van het merk, voor de tabel. */
  categories: string[]
  /** Dezelfde, als id's: het filter groepeert ze in de boom. */
  category_ids: string[]
  status: string
  /** Segment: luxury, premium of mid; null = nog niet beoordeeld (migratie 324). */
  market_segment: "luxury" | "premium" | "mid" | null
  is_featured: boolean
  /** In de selectie (ster; migratie 338). */
  is_curated: boolean
  /** Aantal collection (product_collections). */
  collection_count: number
  /** In hoeveel projecten een product van het merk op een foto getagd is (distinct). */
  project_count: number
  /** Naam van de eigenaar als het merk geclaimd is. */
  owner_name: string | null
  /** Laatste taak van de collectiepijplijn (migratie 325), voor de voortgang in de kolom. */
  collection_job: { kind: "inventory" | "enrich"; stage: string; done: number; total: number; error: string | null } | null
  /** Gevonden kandidaat-collecties die nog niet gekozen zijn. */
  candidates_found: number
  created_at: string
  updated_at: string | null
}

export type AdminBrandCategory = { id: string; name: string; parentId: string | null; orderIndex: number }


export default async function AdminBrandsPage() {
  const supabase = createServiceRoleSupabaseClient() as any

  const [{ data: brands }, { data: collections }, { data: links }, { data: detLinks }, { data: brandCats }, { data: productCats }] = await Promise.all([
    // Alle merken: zonder blokken kapt Supabase af op 1000.
    selectAll(() => supabase
      .from("brands")
      .select("id, slug, name, domain, website, logo_url, city, country, status, market_segment, is_featured, is_curated, owner_user_id, created_at, updated_at")
      .order("created_at", { ascending: false })
      .order("id")),
    supabase.from("product_collections").select("brand_id"),
    supabase.from("project_brands").select("brand_id, project_id, photo_id"),
    // Goedgekeurde productherkenning telt mee als project (migratie 343).
    selectAll(() => supabase.from("project_detection_links").select("brand_id, project_id").order("detection_id")),
    selectAll(() => supabase.from("brand_categories").select("brand_id, category_id, position").order("position").order("brand_id").order("category_id")),
    supabase.from("product_categories").select("id, name, parent_id, order_index"),
  ])
  // Collectiepijplijn: de laatste taak per merk en wat er nog te kiezen is.
  const [{ data: jobRows }, { data: candidateRows }, { data: photoTags }] = await Promise.all([
    selectAll(() => supabase.from("brand_collection_jobs").select("brand_id, kind, stage, progress_done, progress_total, error, created_at").order("created_at", { ascending: false }).order("id")),
    selectAll(() => supabase.from("brand_collection_candidates").select("brand_id").eq("status", "found").order("brand_id").order("id")),
    // Merkstippen op projectfoto's, met het project van de foto.
    selectAll(() => supabase.from("project_photo_brand_tags").select("brand_id, photo:project_photos!inner(project_id)").order("id")),
  ])
  const jobByBrand = new Map<string, AdminBrandRow["collection_job"]>()
  for (const j of (jobRows ?? []) as Array<{ brand_id: string; kind: "inventory" | "enrich"; stage: string; progress_done: number; progress_total: number; error: string | null }>) {
    if (!jobByBrand.has(j.brand_id)) jobByBrand.set(j.brand_id, { kind: j.kind, stage: j.stage, done: j.progress_done, total: j.progress_total, error: j.error })
  }
  const foundByBrand = new Map<string, number>()
  for (const c of (candidateRows ?? []) as Array<{ brand_id: string }>) foundByBrand.set(c.brand_id, (foundByBrand.get(c.brand_id) ?? 0) + 1)

  const catName = new Map<string, string>(((productCats ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]))
  const categoriesByBrand = new Map<string, string[]>()
  const categoryIdsByBrand = new Map<string, string[]>()
  for (const l of (brandCats ?? []) as Array<{ brand_id: string; category_id: string }>) {
    const name = catName.get(l.category_id)
    if (name) categoriesByBrand.set(l.brand_id, [...(categoriesByBrand.get(l.brand_id) ?? []), name])
    categoryIdsByBrand.set(l.brand_id, [...(categoryIdsByBrand.get(l.brand_id) ?? []), l.category_id])
  }
  // De boom voor het categoriefilter (groep › subgroep › soort).
  const categoryTree: AdminBrandCategory[] = ((productCats ?? []) as Array<{ id: string; name: string; parent_id: string | null; order_index: number | null }>)
    .map((c) => ({ id: c.id, name: c.name, parentId: c.parent_id ?? null, orderIndex: c.order_index ?? 0 }))

  const collectionByBrand = new Map<string, number>()
  for (const f of (collections ?? []) as Array<{ brand_id: string }>) {
    collectionByBrand.set(f.brand_id, (collectionByBrand.get(f.brand_id) ?? 0) + 1)
  }
  // Projects: in hoeveel projecten een product van het merk op een foto
  // getagd is — een merk op een foto aangewezen (project_brands.photo_id),
  // een merkstip (project_photo_brand_tags) of een goedgekeurde stip van de
  // productherkenning (project_detection_links). Een vermelding van het merk
  // bij het project zonder foto telt niet.
  const projectsByBrand = new Map<string, Set<string>>()
  const addProject = (brandId: string, projectId: string | null | undefined) => {
    if (!projectId) return
    projectsByBrand.set(brandId, (projectsByBrand.get(brandId) ?? new Set<string>()).add(projectId))
  }
  for (const l of (links ?? []) as Array<{ brand_id: string; project_id: string; photo_id: string | null }>) if (l.photo_id) addProject(l.brand_id, l.project_id)
  for (const t of (photoTags ?? []) as Array<{ brand_id: string; photo: { project_id: string } | null }>) addProject(t.brand_id, t.photo?.project_id)
  for (const l of (detLinks ?? []) as Array<{ brand_id: string; project_id: string }>) addProject(l.brand_id, l.project_id)

  // Eigenaarnaam voor geclaimde merken — één vraag voor alle rijen.
  const ownerIds = Array.from(new Set(((brands ?? []) as Array<{ owner_user_id: string | null }>).map((b) => b.owner_user_id).filter((id): id is string => Boolean(id))))
  const ownerName = new Map<string, string>()
  if (ownerIds.length > 0) {
    // profiles kent first_name/last_name — geen full_name, geen email.
    const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name").in("id", ownerIds)
    for (const p of (profiles ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null }>) {
      ownerName.set(p.id, [p.first_name, p.last_name].filter(Boolean).join(" ") || "—")
    }
  }

  const rows: AdminBrandRow[] = ((brands ?? []) as any[]).map((b) => ({
    id: b.id,
    slug: b.slug,
    name: b.name,
    domain: b.domain ?? null,
    website: b.website ?? null,
    logo_url: b.logo_url ?? null,
    city: b.city ?? null,
    country: b.country ?? null,
    category: categoriesByBrand.get(b.id)?.[0] ?? null,
    categories: categoriesByBrand.get(b.id) ?? [],
    category_ids: categoryIdsByBrand.get(b.id) ?? [],
    status: b.status,
    market_segment: b.market_segment ?? null,
    is_featured: Boolean(b.is_featured),
    is_curated: b.is_curated !== false,
    collection_count: collectionByBrand.get(b.id) ?? 0,
    project_count: projectsByBrand.get(b.id)?.size ?? 0,
    owner_name: b.owner_user_id ? (ownerName.get(b.owner_user_id) ?? "—") : null,
    collection_job: jobByBrand.get(b.id) ?? null,
    candidates_found: foundByBrand.get(b.id) ?? 0,
    created_at: b.created_at,
    updated_at: b.updated_at ?? null,
  }))

  return (
    <div className="min-h-screen bg-white">
      <BrandsClient initialBrands={rows} categoryTree={categoryTree} />
    </div>
  )
}
