/**
 * De typen en de boomlogica van de productlaag, zonder server-only: de
 * discover-client draait ze in de browser, catalog.ts op de server.
 */

export type CatalogCategory = {
  id: string
  slug: string
  name: string
  nameNl: string | null
  parentId: string | null
  orderIndex: number
}

export type CatalogSeries = {
  id: string
  slug: string
  name: string
  description: string | null
  heroImageUrl: string | null
  designer: string | null
  launchYear: number | null
  url: string | null
  categoryId: string | null
  isFeatured: boolean
  brand: { id: string; slug: string; name: string; logoUrl: string | null }
  projectCount: number
}

export type CatalogBrand = {
  id: string
  slug: string
  name: string
  domain: string | null
  website: string | null
  logoUrl: string | null
  description: string | null
  country: string | null
  foundedYear: number | null
  status: string
  categoryIds: string[]
  seriesCount: number
  projectCount: number
}

/** Een verkooppunt: een bedrijf dat het merk voert (company_brands). */
export type CatalogDealer = {
  companyId: string
  slug: string
  name: string
  logoUrl: string | null
  city: string | null
  service: string | null
  isOfficialDealer: boolean
}

export type CatalogProject = {
  id: string
  slug: string
  title: string
  imageUrl: string | null
  location: string | null
  type: string | null
}

export function categoryLabel(c: CatalogCategory, locale: string): string {
  return locale === "nl" ? (c.nameNl ?? c.name) : c.name
}

/** Wat je aan een boom wilt vragen: kinderen, pad omhoog, alles eronder. */
export function categoryTree(categories: CatalogCategory[]) {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const bySlug = new Map(categories.map((c) => [c.slug, c]))
  const childrenOf = new Map<string | null, CatalogCategory[]>()
  for (const c of categories) {
    const list = childrenOf.get(c.parentId) ?? []
    list.push(c)
    childrenOf.set(c.parentId, list)
  }
  for (const list of childrenOf.values()) list.sort((a, b) => a.orderIndex - b.orderIndex)

  const children = (id: string | null) => childrenOf.get(id) ?? []
  const roots = children(null)
  const pathOf = (id: string): CatalogCategory[] => {
    const path: CatalogCategory[] = []
    let cur = byId.get(id)
    while (cur) {
      path.unshift(cur)
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
    return path
  }
  const subtreeIds = (id: string): Set<string> => {
    const out = new Set<string>([id])
    const walk = (parent: string) => { for (const c of children(parent)) { out.add(c.id); walk(c.id) } }
    walk(id)
    return out
  }
  const rootOf = (id: string): CatalogCategory | undefined => pathOf(id)[0]
  return { byId, bySlug, children, roots, pathOf, subtreeIds, rootOf }
}
