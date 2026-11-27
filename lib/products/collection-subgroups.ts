/**
 * Productindeling v2 (migratie 351): wat op welk niveau hangt.
 *
 *   collectie  één hoofdsubgroep (product_collections.category_id) plus één of
 *              meer subgroepen in product_collection_kinds — altijd niveau 2
 *   product    het diepste niveau: een soort, of een subgroep zonder soorten
 *
 * De subgroepen van een collectie volgen uit haar producten. Wat een admin
 * met de hand kiest (is_manual) blijft staan en gaat voor.
 */

export type CategoryRow = { id: string; slug: string; parent_id: string | null; is_active: boolean; order_index: number }

export type CategoryLevels = {
  /** Actief en alles erboven ook. */
  isLive: (id: string | null | undefined) => boolean
  /** De subgroep (niveau 2) van een actieve categorie; null voor een hoofdgroep of geparkeerd. */
  subgroupOf: (id: string | null | undefined) => string | null
  isSubgroup: (id: string | null | undefined) => boolean
  /** Actief zonder actieve kinderen: waar een product of stip aan hangt. */
  isLeaf: (id: string | null | undefined) => boolean
  order: (id: string) => number
  idBySlug: Map<string, string>
}

export function categoryLevels(rows: CategoryRow[]): CategoryLevels {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const liveCache = new Map<string, boolean>()
  const isLive = (id: string | null | undefined): boolean => {
    if (!id) return false
    if (liveCache.has(id)) return liveCache.get(id)!
    const r = byId.get(id)
    const ok = Boolean(r && r.is_active && (!r.parent_id || isLive(r.parent_id)))
    liveCache.set(id, ok)
    return ok
  }
  const hasLiveChildren = new Set(rows.filter((r) => isLive(r.id) && r.parent_id).map((r) => r.parent_id as string))
  const subgroupOf = (id: string | null | undefined): string | null => {
    if (!id || !isLive(id)) return null
    const r = byId.get(id)!
    if (!r.parent_id) return null
    const parent = byId.get(r.parent_id)
    return parent && !parent.parent_id ? r.id : r.parent_id
  }
  return {
    isLive,
    subgroupOf,
    isSubgroup: (id) => Boolean(id) && subgroupOf(id) === id,
    isLeaf: (id) => Boolean(id) && isLive(id) && !hasLiveChildren.has(id!),
    order: (id) => byId.get(id)?.order_index ?? 0,
    idBySlug: new Map(rows.filter((r) => isLive(r.id)).map((r) => [r.slug, r.id])),
  }
}

export async function loadCategoryLevels(sb: any): Promise<CategoryLevels> {
  const { data } = await sb.from("product_categories").select("id, slug, parent_id, is_active, order_index")
  return categoryLevels((data ?? []) as CategoryRow[])
}

/**
 * De subgroepen van een collectie opnieuw zetten:
 * - met de hand gekozen (is_manual): die en alleen die, in hun volgorde —
 *   de eerste is de hoofdsubgroep;
 * - anders de subgroepen van haar producten, meeste producten eerst;
 * - zonder producten blijven de bestaande (bv. door Claude gekozen) staan.
 */
export async function syncCollectionSubgroups(sb: any, collectionId: string, levels?: CategoryLevels): Promise<void> {
  const lv = levels ?? await loadCategoryLevels(sb)
  const [{ data: col }, { data: rows }, { data: products }] = await Promise.all([
    sb.from("product_collections").select("category_id").eq("id", collectionId).maybeSingle(),
    sb.from("product_collection_kinds").select("category_id, position, is_manual").eq("collection_id", collectionId).order("position"),
    sb.from("products").select("category_id").eq("collection_id", collectionId),
  ])
  const current = (rows ?? []) as Array<{ category_id: string; position: number; is_manual: boolean | null }>
  const manual = current.filter((r) => r.is_manual && lv.isSubgroup(r.category_id)).map((r) => r.category_id)

  const counts = new Map<string, number>()
  for (const p of (products ?? []) as Array<{ category_id: string | null }>) {
    const g = lv.subgroupOf(p.category_id)
    if (g) counts.set(g, (counts.get(g) ?? 0) + 1)
  }
  const fromProducts = Array.from(counts.keys()).sort((a, b) => (counts.get(b)! - counts.get(a)!) || lv.order(a) - lv.order(b))
  const kept = manual.length > 0
    ? []
    : fromProducts.length > 0
      ? fromProducts
      : current.map((r) => lv.subgroupOf(r.category_id)).filter((x): x is string => Boolean(x))

  const currentPrimary = lv.subgroupOf(col?.category_id ?? null)
  const primary = manual[0] ?? fromProducts[0] ?? currentPrimary ?? kept[0] ?? null
  const wanted = Array.from(new Set([...(primary ? [primary] : []), ...manual, ...kept]))
  const manualSet = new Set(manual)

  const same = wanted.length === current.length
    && wanted.every((id, i) => current[i]?.category_id === id && Boolean(current[i]?.is_manual) === manualSet.has(id))
  if (!same) {
    await sb.from("product_collection_kinds").delete().eq("collection_id", collectionId)
    if (wanted.length > 0) {
      await sb.from("product_collection_kinds").insert(wanted.map((category_id, position) => ({
        collection_id: collectionId, category_id, position, is_manual: manualSet.has(category_id),
      })))
    }
  }
  if (primary && col && col.category_id !== primary) {
    await sb.from("product_collections").update({ category_id: primary }).eq("id", collectionId)
  }
}
