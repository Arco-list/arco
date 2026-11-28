import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { selectAll } from "@/lib/supabase/select-all"
import type { CatalogCollection } from "@/lib/products/catalog-types"

/**
 * Het beeld op een staande merkkaart (2 : 3): /brands, en de
 * merkcarrousel op /products en de categoriepagina's.
 *
 * 1. Een staande sfeerfoto (hoogte ≥ 1,2 × breedte): eerst uit de meest
 *    toegepaste collectie, dan de volgende; binnen een collectie in de
 *    volgorde van de pipeline (beste eerst).
 * 2. Geen staande foto: de hero van de meest toegepaste collectie,
 *    bijgesneden op zijn focuspunt (DEDON, Occhio: alles liggend).
 *
 * Met `categoryIds` (een categorie en alles eronder) alleen collecties in
 * die categorie: op /products/verlichting de lamp van een merk, niet zijn
 * bank.
 */
export type BrandCardImage = {
  url: string
  focus: { x: number; y: number } | null
  size: { width: number; height: number } | null
}

const PORTRAIT = 1.2

export async function brandCardImages(collections: CatalogCollection[], options?: { categoryIds?: Set<string> }): Promise<Record<string, BrandCardImage>> {
  const ids = options?.categoryIds
  const inCategory = (c: CatalogCollection) => !ids
    || (c.categoryId !== null && ids.has(c.categoryId)) || c.kindIds.some((k) => ids.has(k)) || (c.productCategoryIds ?? []).some((k) => ids.has(k))
  const relevant = collections.filter(inCategory)
    .sort((a, b) => b.projectCount - a.projectCount || a.name.localeCompare(b.name))
  if (relevant.length === 0) return {}

  const sb = createServiceRoleSupabaseClient() as any
  const collectionIds = relevant.map((c) => c.id)
  type Photo = { collection_id: string; url: string; width: number | null; height: number | null; kind: string | null; focus_x: number | null; focus_y: number | null; order_index: number }
  const photos: Photo[] = []
  for (let i = 0; i < collectionIds.length; i += 200) {
    const chunk = collectionIds.slice(i, i + 200)
    const { data } = await selectAll(() => sb.from("product_collection_photos")
      .select("collection_id, url, width, height, kind, focus_x, focus_y, order_index")
      .in("collection_id", chunk).order("collection_id").order("order_index"))
    photos.push(...((data ?? []) as Photo[]))
  }
  const byCollection = new Map<string, Photo[]>()
  for (const p of photos) byCollection.set(p.collection_id, [...(byCollection.get(p.collection_id) ?? []), p])
  const photoByUrl = new Map(photos.map((p) => [p.url, p]))

  const byBrand = new Map<string, CatalogCollection[]>()
  for (const c of relevant) byBrand.set(c.brand.id, [...(byBrand.get(c.brand.id) ?? []), c])

  const out: Record<string, BrandCardImage> = {}
  for (const [brandId, list] of byBrand) {
    let pick: Photo | null = null
    for (const c of list) {
      pick = (byCollection.get(c.id) ?? []).find((p) => p.kind === "ambiance" && p.width && p.height && p.height / p.width >= PORTRAIT) ?? null
      if (pick) break
    }
    if (pick) {
      out[brandId] = { url: pick.url, focus: pick.focus_x != null && pick.focus_y != null ? { x: pick.focus_x, y: pick.focus_y } : null, size: { width: pick.width!, height: pick.height! } }
      continue
    }
    const hero = list.find((c) => c.heroImageUrl)
    if (!hero?.heroImageUrl) continue
    const row = photoByUrl.get(hero.heroImageUrl)
    out[brandId] = {
      url: hero.heroImageUrl,
      focus: hero.heroFocus ?? (row?.focus_x != null && row?.focus_y != null ? { x: row.focus_x, y: row.focus_y } : null),
      size: hero.heroSize ?? (row?.width && row?.height ? { width: row.width, height: row.height } : null),
    }
  }
  return out
}
