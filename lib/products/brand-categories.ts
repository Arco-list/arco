/**
 * De categorieën van een merk volgen zijn collecties. Elke soort van elke
 * collectie (Loungesets, Ligbedden, Fauteuils) gaat omhoog naar zijn
 * subgroep (Tuinmeubels, Banken & fauteuils); merken hangen nooit aan een
 * soort.
 * Dubbelen worden samengevoegd, een groep die al in een andere zit
 * vervalt, de meest voorkomende staat vooraan, en er blijven er drie.
 * Zo zegt een merk wat zijn assortiment zegt, niet wat een branchecode
 * ooit gokte.
 *
 * Heeft geen enkele collectie een soort of groep, dan raken we de
 * bestaande categorieën (handmatig, of voorgesteld bij de Apollo-import)
 * niet aan: er is niets om ze op te baseren.
 */

export const MAX_BRAND_CATEGORIES = 3

type Row = { id: string; category_id: string | null }

/** De categorie-id's die uit de collecties volgen, meest voorkomende eerst. */
export function deriveBrandCategoryIds(
  collections: Row[],
  kinds: Array<{ collection_id: string; category_id: string }>,
  categories: Array<{ id: string; parent_id: string | null }>,
): string[] {
  const parentOf = new Map(categories.map((c) => [c.id, c.parent_id]))
  const kindsBy = new Map<string, string[]>()
  for (const k of kinds) kindsBy.set(k.collection_id, [...(kindsBy.get(k.collection_id) ?? []), k.category_id])

  // Drie niveaus: groep › subgroep › soort. Een merk hangt hooguit aan een
  // subgroep; alles daaronder stapt omhoog tot dat niveau.
  const depth = (id: string): number => { let d = 1; for (let cur = parentOf.get(id); cur; cur = parentOf.get(cur)) d++; return d }
  const toSubgroup = (id: string): string => {
    let cur = id
    while (depth(cur) > 2) cur = parentOf.get(cur) as string
    return cur
  }

  const counts = new Map<string, number>()
  for (const c of collections) {
    const own = kindsBy.get(c.id) ?? []
    // Soorten worden hun subgroep; een collectie zonder soorten telt mee
    // met zijn eigen categorie, eveneens hooguit op subgroepniveau.
    const groups = own.length > 0
      ? own.map(toSubgroup)
      : c.category_id ? [toSubgroup(c.category_id)] : []
    for (const g of new Set(groups)) counts.set(g, (counts.get(g) ?? 0) + 1)
  }
  if (counts.size === 0) return []

  const ancestors = (id: string): string[] => {
    const out: string[] = []
    for (let cur = parentOf.get(id); cur; cur = parentOf.get(cur)) out.push(cur)
    return out
  }
  const all = Array.from(counts.keys())
  const covered = new Set(all.flatMap(ancestors)) // groepen die al in een andere zitten
  return all
    .filter((g) => !covered.has(g))
    .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
    .slice(0, MAX_BRAND_CATEGORIES)
}

/** Schrijft de afgeleide categorieën naar brand_categories. */
export async function syncBrandCategoriesFromCollections(supabase: any, brandId: string): Promise<string[] | null> {
  const { data: collections } = await supabase.from("product_collections").select("id, category_id").eq("brand_id", brandId)
  const rows = (collections ?? []) as Row[]
  if (rows.length === 0) return null

  const [{ data: kinds }, { data: cats }] = await Promise.all([
    supabase.from("product_collection_kinds").select("collection_id, category_id").in("collection_id", rows.map((r) => r.id)),
    supabase.from("product_categories").select("id, parent_id"),
  ])
  const ids = deriveBrandCategoryIds(rows, (kinds ?? []) as Array<{ collection_id: string; category_id: string }>, (cats ?? []) as Array<{ id: string; parent_id: string | null }>)
  if (ids.length === 0) return null

  const { error: clearError } = await supabase.from("brand_categories").delete().eq("brand_id", brandId)
  if (clearError) return null
  await supabase.from("brand_categories").insert(ids.map((category_id, position) => ({ brand_id: brandId, category_id, position })))
  return ids
}
