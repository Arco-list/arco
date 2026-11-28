"use server"

import { loadCategoryLevels, syncCollectionSubgroups } from "@/lib/products/collection-subgroups"
import { revalidatePath } from "next/cache"
import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"
import { freeSlug, slugify, storeRemoteImage, syncCollectionCover } from "@/lib/collections/shared"
import { regroupCandidates, type FamilyProduct } from "@/lib/collections/families"
import { syncBrandCategoriesFromCollections } from "@/lib/products/brand-categories"

/**
 * De admin-kant van de collectiepijplijn (lib/collections/pipeline):
 * inventarisatie starten, de gevonden kandidaten tonen, en de keuze
 * omzetten in collecties plus een ophaaltaak. Het eigenlijke werk doet
 * de cron op de achtergrond.
 */

async function requireAdmin(): Promise<{ ok: true } | { error: string }> {
  const supabase = await createServerActionSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "You must be signed in." }
  const { data: profile } = await supabase.from("profiles").select("user_types, admin_role").eq("id", user.id).maybeSingle()
  if (!isAdminUser(profile?.user_types, profile?.admin_role)) return { error: "Admin access required." }
  return { ok: true }
}

/** Inventarisatie starten voor een of meer merken. Een merk met een lopende taak slaat over. */
export async function startCollectionInventory(brandIds: string[], pageUrl?: string | null): Promise<{ started: number; skipped: number } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard
  let page: string | null = null
  if (pageUrl?.trim()) {
    try { page = new URL(pageUrl.trim()).toString() } catch { return { error: "Please enter a valid URL (including https://)." } }
  }
  const sb = createServiceRoleSupabaseClient() as any
  const { data: active } = await sb.from("brand_collection_jobs").select("brand_id").in("brand_id", brandIds).not("stage", "in", "(done,error)")
  const busy = new Set(((active ?? []) as Array<{ brand_id: string }>).map((j) => j.brand_id))
  const rows = brandIds.filter((id) => !busy.has(id)).map((brand_id) => ({
    brand_id, kind: "inventory", stage: "queued", state: page && brandIds.length === 1 ? { pageUrl: page } : {},
  }))
  if (rows.length > 0) {
    const { error } = await sb.from("brand_collection_jobs").insert(rows)
    if (error) return { error: error.message }
  }
  revalidatePath("/admin/brands")
  return { started: rows.length, skipped: brandIds.length - rows.length }
}

export type CollectionCandidate = {
  id: string
  name: string
  url: string | null
  imageUrl: string | null
  category: string | null
  description: string | null
  status: "found" | "chosen"
  /** Varianten die bij deze familie horen (migratie 339); worden de producten. */
  productCount: number
}

export async function listCollectionCandidates(brandId: string): Promise<{ candidates: CollectionCandidate[] } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard
  const sb = createServiceRoleSupabaseClient() as any
  const [{ data: rows }, { data: cats }] = await Promise.all([
    sb.from("brand_collection_candidates").select("id, name, url, image_url, source_image_url, category_id, description, status, products, collection_id").eq("brand_id", brandId).order("name"),
    sb.from("product_categories").select("id, name"),
  ])
  const catName = new Map(((cats ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]))
  // Toegevoegde collecties: het aantal producten dat ze nu hebben.
  const colIds = ((rows ?? []) as any[]).map((r) => r.collection_id).filter(Boolean)
  const productsPerCollection = new Map<string, number>()
  if (colIds.length) {
    const { data: prods } = await sb.from("products").select("collection_id").in("collection_id", colIds)
    for (const p of (prods ?? []) as Array<{ collection_id: string }>) productsPerCollection.set(p.collection_id, (productsPerCollection.get(p.collection_id) ?? 0) + 1)
  }
  return {
    candidates: ((rows ?? []) as any[]).map((r) => ({
      id: r.id, name: r.name, url: r.url ?? null,
      imageUrl: r.image_url ?? r.source_image_url ?? null,
      category: r.category_id ? catName.get(r.category_id) ?? null : null,
      description: r.description ?? null,
      status: r.status,
      productCount: r.collection_id ? productsPerCollection.get(r.collection_id) ?? 0 : Array.isArray(r.products) ? r.products.length : 0,
    })),
  }
}

/**
 * De gekozen kandidaten worden collecties — met het overzichtsbeeld als
 * omslag en de categorie, zodat ze meteen op /products staan — en een
 * ophaaltaak haalt omschrijving, ontwerper, jaar, soorten, producten en
 * sfeerbeelden.
 */
export async function chooseCollectionCandidates(brandId: string, candidateIds: string[]): Promise<{ added: number } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard
  if (candidateIds.length === 0) return { added: 0 }
  const sb = createServiceRoleSupabaseClient() as any

  const [{ data: cands }, { data: cols }] = await Promise.all([
    sb.from("brand_collection_candidates").select("*").eq("brand_id", brandId).in("id", candidateIds).eq("status", "found"),
    sb.from("product_collections").select("slug").eq("brand_id", brandId),
  ])
  const taken = new Set(((cols ?? []) as Array<{ slug: string }>).map((c) => c.slug))
  // Migratie 351: de collectie hangt aan de subgroep, haar producten aan de
  // eindcategorie (alleen als de kandidaat die al noemt).
  const levels = await loadCategoryLevels(sb)
  const created: string[] = []
  const toFetch: string[] = []

  for (const c of (cands ?? []) as any[]) {
    const slug = freeSlug(c.slug, taken)
    const { data: col, error } = await sb.from("product_collections")
      .insert({ brand_id: brandId, slug, name: c.name, url: c.url, description: c.description, category_id: levels.subgroupOf(c.category_id) })
      .select("id").single()
    if (error || !col) continue
    taken.add(slug)
    created.push(col.id)
    if (c.url) toFetch.push(col.id)
    // Het overzichtsbeeld als eerste foto en omslag.
    const img = c.image_url ?? c.source_image_url
    if (img) {
      await sb.from("product_collection_photos").insert({ collection_id: col.id, url: img, source_url: c.source_image_url ?? img, is_primary: true, order_index: 0 })
      // Zonder focuspunt: het ophalen hieronder kiest de sfeerbeelden en
      // zoekt dan het punt voor de echte hero. Anders wacht de knop op
      // een Claude-blik per collectie.
      await syncCollectionCover(sb, col.id, { focus: false })
    }
    // Een familie van losse producten (migratie 339): de varianten worden
    // de producten van de collectie. Het ophalen vult daarna aan.
    const variants = (Array.isArray(c.products) ? c.products : []) as FamilyProduct[]
    if (variants.length > 0) {
      const seen = new Set<string>()
      const rows = await Promise.all(variants.slice(0, 40).map(async (p, position) => {
        const pslug = slugify(p.name)
        if (!pslug || seen.has(pslug)) return null
        seen.add(pslug)
        const src = p.source_image_url ?? p.image_url
        const stored = p.image_url ?? (src ? await storeRemoteImage(sb, src, `product-families/${col.id}/products`, pslug) : null)
        return { brand_id: brandId, collection_id: col.id, slug: pslug, name: p.name, url: p.url, image_url: stored ?? src, source_image_url: src, position, // Met een eigen pagina leest het ophalen hieronder de soort per
        // product (uit de categorieën van nu); de kandidaat kan van vóór een
        // nieuwe soort zijn (Saunakachels). Zonder pagina: die van de kandidaat.
        category_id: !c.url && levels.isLeaf(c.category_id) ? c.category_id : null }
      }))
      const products = rows.filter(Boolean)
      if (products.length) {
        const { error: perr } = await sb.from("products").insert(products)
        if (perr) console.error("Family products insert failed", perr.message)
      }
    }
    await syncCollectionSubgroups(sb, col.id, levels)
    await sb.from("brand_collection_candidates").update({ status: "chosen", collection_id: col.id }).eq("id", c.id)
  }

  if (created.length > 0) await syncBrandCategoriesFromCollections(sb, brandId)
  if (toFetch.length > 0) {
    await sb.from("brand_collection_jobs").insert({
      brand_id: brandId, kind: "enrich", stage: "queued",
      progress_total: toFetch.length,
      state: { items: Object.fromEntries(toFetch.map((id) => [id, { step: "fetch" }])) },
    })
  }
  revalidatePath("/admin/brands")
  revalidatePath(`/admin/brands/${brandId}`)
  revalidatePath("/products")
  return { added: created.length }
}

/** Gevonden kandidaten opnieuw groeperen tot productfamilies, zonder de site opnieuw te lezen. */
export async function regroupCollectionCandidates(brandId: string): Promise<{ families: number; merged: number; addedToCollections: number } | { error: string }> {
  const guard = await requireAdmin()
  if ("error" in guard) return guard
  const sb = createServiceRoleSupabaseClient() as any
  const { data: brand } = await sb.from("brands").select("name").eq("id", brandId).maybeSingle()
  if (!brand) return { error: "Brand not found." }
  const res = await regroupCandidates(sb, brandId, brand.name)
  revalidatePath("/admin/brands")
  return res
}
