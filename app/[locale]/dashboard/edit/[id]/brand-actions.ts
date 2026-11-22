"use server"

import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { selectAll } from "@/lib/supabase/select-all"
import { isAdminUser } from "@/lib/auth-utils"

/**
 * Merken en collecties op een project — de koppeling uit migraties 288/289.
 *
 * Alleen admins, zolang de merkenlaag in fase 1 zit. De acties zijn zo
 * geschreven dat de eigenaar er later bij kan zonder dat de vorm
 * verandert: de guard wordt dan "admin óf eigenaar van dit project" en
 * de source wordt 'pro_suggest' in plaats van 'admin_manual'.
 */

export type BrandOption = { id: string; name: string; slug: string; logoUrl: string | null; status: string; categoryIds: string[] }
export type BrandCategoryOption = { id: string; slug: string; name: string; nameNl: string | null; parentId: string | null }
export type CollectionOption = { id: string; brandId: string; name: string; slug: string }
export type SpaceOption = { id: string; slug: string }
export type ProjectBrandRow = {
  id: string
  brandId: string
  brandName: string
  brandSlug: string
  collectionId: string | null
  familyName: string | null
  familySlug: string | null
  spaceId: string | null
  spaceSlug: string | null
  note: string | null
  photoId: string | null
  source: string
  status: string
}

const LINK_SELECT =
  "id, brand_id, collection_id, space_id, note, photo_id, source, status, brands(name, slug), product_collections(name, slug), spaces(slug)"

type Guard = { ok: true; userId: string } | { error: string }

async function requireAdmin(): Promise<Guard> {
  const supabase = await createServerActionSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Je moet ingelogd zijn." }
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_types, admin_role")
    .eq("id", user.id)
    .maybeSingle()
  if (!isAdminUser(profile?.user_types, profile?.admin_role)) return { error: "Alleen voor admins." }
  return { ok: true, userId: user.id }
}

// De merkentabellen zijn nog niet overal in de gegenereerde types
// meegenomen; de bestaande admin-acties casten om dezelfde reden.
type AnyClient = any

const mapLink = (r: any): ProjectBrandRow => ({
  id: r.id,
  brandId: r.brand_id,
  brandName: r.brands?.name ?? "",
  brandSlug: r.brands?.slug ?? "",
  collectionId: r.collection_id ?? null,
  familyName: r.product_collections?.name ?? null,
  familySlug: r.product_collections?.slug ?? null,
  spaceId: r.space_id ?? null,
  spaceSlug: r.spaces?.slug ?? null,
  note: r.note ?? null,
  photoId: r.photo_id ?? null,
  source: r.source,
  status: r.status,
})

/** Alles wat de editor nodig heeft in één rondje: merken en hun collecties
 *  om uit te kiezen, ruimtes als hint, en de koppelingen die er al staan. */
export async function loadProjectBrandsEditorAction(
  projectId: string,
): Promise<{ brands: BrandOption[]; categories: BrandCategoryOption[]; collections: CollectionOption[]; spaces: SpaceOption[]; links: ProjectBrandRow[] } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard
  const supabase: AnyClient = createServiceRoleSupabaseClient()
  const [brandsRes, collectionsRes, spacesRes, linksRes, brandCatsRes, catsRes] = await Promise.all([
    selectAll(() => supabase.from("brands").select("id, name, slug, logo_url, status").neq("status", "deactivated").order("name").order("id")),
    supabase.from("product_collections").select("id, brand_id, name, slug").order("name"),
    supabase.from("spaces").select("id, slug").order("name"),
    supabase.from("project_brands").select(LINK_SELECT).eq("project_id", projectId).order("created_at", { ascending: true }),
    selectAll(() => supabase.from("brand_categories").select("brand_id, category_id").order("position").order("brand_id").order("category_id")),
    supabase.from("product_categories").select("id, slug, name, name_nl, parent_id, order_index").order("order_index"),
  ])
  const err = brandsRes.error ?? collectionsRes.error ?? spacesRes.error ?? linksRes.error ?? brandCatsRes.error ?? catsRes.error
  if (err) return { error: err.message }
  const catIdsByBrand = new Map<string, string[]>()
  for (const l of (brandCatsRes.data ?? []) as Array<{ brand_id: string; category_id: string }>) {
    catIdsByBrand.set(l.brand_id, [...(catIdsByBrand.get(l.brand_id) ?? []), l.category_id])
  }
  // Alleen categorieën waar minstens één merk in zit worden pills.
  const usedCats = new Set(Array.from(catIdsByBrand.values()).flat())
  // Alle voorouders van een gebruikte categorie tellen mee (tot drie niveaus),
  // zodat een merk aan "Eettafels" ook onder Tafels en Meubels verschijnt.
  const parentOf = new Map<string, string | null>(((catsRes.data ?? []) as Array<{ id: string; parent_id: string | null }>).map((c) => [c.id, c.parent_id]))
  for (const id of Array.from(usedCats)) {
    let up = parentOf.get(id) ?? null
    while (up && !usedCats.has(up)) { usedCats.add(up); up = parentOf.get(up) ?? null }
  }
  return {
    brands: (brandsRes.data ?? []).map((b: any) => ({ id: b.id, name: b.name, slug: b.slug, logoUrl: b.logo_url ?? null, status: b.status, categoryIds: catIdsByBrand.get(b.id) ?? [] })),
    categories: (catsRes.data ?? []).filter((c: any) => usedCats.has(c.id)).map((c: any) => ({ id: c.id, slug: c.slug, name: c.name, nameNl: c.name_nl ?? null, parentId: c.parent_id ?? null })),
    collections: (collectionsRes.data ?? []).map((f: any) => ({ id: f.id, brandId: f.brand_id, name: f.name, slug: f.slug })),
    spaces: (spacesRes.data ?? []).map((s: any) => ({ id: s.id, slug: s.slug })),
    links: (linksRes.data ?? []).map(mapLink),
  }
}

/**
 * Merk (+ collectie) op een project zetten.
 *
 * Staat het merk er al zónder collectie en komt er nu een collectie bij, dan
 * wordt die rij verfijnd in plaats van dat er een tweede naast komt:
 * "Occhio" wordt "Occhio › Mito". Dat is de gang van zaken die we
 * verwachten — eerst weet je het merk, dan de collectie.
 */
export async function addProjectBrandAction(
  projectId: string,
  brandId: string,
  collectionId: string | null,
  spaceId: string | null,
  note: string | null,
): Promise<{ link: ProjectBrandRow } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard
  const supabase: AnyClient = createServiceRoleSupabaseClient()
  const cleanNote = note?.trim() || null

  if (collectionId) {
    const { data: bare } = await supabase
      .from("project_brands")
      .select("id, space_id, note")
      .eq("project_id", projectId)
      .eq("brand_id", brandId)
      .is("collection_id", null)
      .is("photo_id", null)
      .maybeSingle()
    if (bare) {
      const { data, error } = await supabase
        .from("project_brands")
        .update({
          collection_id: collectionId,
          space_id: spaceId ?? bare.space_id ?? null,
          note: cleanNote ?? bare.note ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bare.id)
        .select(LINK_SELECT)
        .single()
      if (error) return { error: error.message }
      return { link: mapLink(data) }
    }
  }

  const { data, error } = await supabase
    .from("project_brands")
    .insert({
      project_id: projectId,
      brand_id: brandId,
      collection_id: collectionId,
      space_id: spaceId,
      note: cleanNote,
      source: "admin_manual",
      status: "live",
      suggested_by_user_id: guard.userId,
    })
    .select(LINK_SELECT)
    .single()
  if (error) {
    // 23505 = de unique index: dit merk (met deze collectie) staat al op dit project.
    if (error.code === "23505") return { error: "Dit merk staat met deze collectie al op dit project." }
    return { error: error.message }
  }
  return { link: mapLink(data) }
}

export async function updateProjectBrandAction(
  linkId: string,
  fields: { collectionId?: string | null; spaceId?: string | null; note?: string | null },
): Promise<{ link: ProjectBrandRow } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ("collectionId" in fields) patch.collection_id = fields.collectionId
  if ("spaceId" in fields) patch.space_id = fields.spaceId
  if ("note" in fields) patch.note = fields.note?.trim() || null
  const supabase: AnyClient = createServiceRoleSupabaseClient()
  const { data, error } = await supabase
    .from("project_brands")
    .update(patch)
    .eq("id", linkId)
    .select(LINK_SELECT)
    .single()
  if (error) {
    if (error.code === "23505") return { error: "Dit merk staat met deze collectie al op dit project." }
    return { error: error.message }
  }
  return { link: mapLink(data) }
}

export async function removeProjectBrandAction(linkId: string): Promise<{ ok: true } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard
  const supabase: AnyClient = createServiceRoleSupabaseClient()
  const { error } = await supabase.from("project_brands").delete().eq("id", linkId)
  if (error) return { error: error.message }
  return { ok: true }
}
