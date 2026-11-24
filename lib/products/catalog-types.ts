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
  /** Inactief: niet in menu en filters (migratie 320). */
  isActive: boolean
  /** Eigen beeld voor de schijf op /products (migratie 321); leeg = automatisch. */
  imageUrl: string | null
}

/** Alleen actieve categorieën: een inactieve neemt alles eronder mee. Voor
 *  menu en filters; labels van collecties gebruiken de volledige lijst. */
export function activeCategories(categories: CatalogCategory[]): CatalogCategory[] {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const live = (c: CatalogCategory): boolean => c.isActive && (!c.parentId || (byId.has(c.parentId) && live(byId.get(c.parentId)!)))
  return categories.filter(live)
}

export type CatalogCollection = {
  id: string
  slug: string
  name: string
  description: string | null
  /** De Nederlandse beschrijving (translations.nl, migratie 330), anders null. */
  descriptionNl?: string | null
  heroImageUrl: string | null
  /** Focuspunt van die foto (migratie 326): de kaart snijdt bij zoals de hero. */
  heroFocus?: { x: number; y: number } | null
  /** Maat van die foto: om het focuspunt in het midden van de kaart te zetten. */
  heroSize?: { width: number; height: number } | null
  /** Een productfoto (op wit) van de collectie: voor de schijven op /products. */
  productImageUrl: string | null
  designer: string | null
  launchYear: number | null
  url: string | null
  categoryId: string | null
  /** De soorten die de collectie maakt (stoel, bank, tafel), belangrijkste eerst. */
  kindIds: string[]
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
  /** De Nederlandse beschrijving (translations.nl, migratie 330), anders null. */
  descriptionNl?: string | null
  country: string | null
  foundedYear: number | null
  status: string
  categoryIds: string[]
  collectionCount: number
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

/** Een product van een collectie, zoals de collectiepagina van het merk het toont. */
export type CatalogProduct = {
  id: string
  name: string
  /** De productpagina bij het merk (extern). */
  url: string | null
  imageUrl: string | null
  /** Het beeld bij het merk waar imageUrl een kopie van is. */
  sourceImageUrl?: string | null
  /** De Arco-categorie, het laatste niveau (migratie 327). */
  categoryId: string | null
}

export type CatalogProject = {
  id: string
  slug: string
  title: string
  imageUrl: string | null
  location: string | null
  type: string | null
  /** Ruimteproject (kind = 'partial'): de primaire ruimte. De kaart toont
   *  die ruimte (Tuin, Keuken) waar een project zijn type toont. */
  spaceSlug?: string | null
  /** Status van het project; alleen admins zien andere dan published. */
  status?: string | null
  /** De foto waarop het merk of de collectie met een stip staat
   *  (migratie 317): die vervangt de omslag op de kaart. */
  taggedPhoto?: {
    url: string
    width: number | null
    height: number | null
    tags: import("@/lib/projects/photo-brand-tags").PhotoBrandTag[]
  } | null
}

export function categoryLabel(c: CatalogCategory, locale: string): string {
  return locale === "nl" ? (c.nameNl ?? c.name) : c.name
}

/**
 * De soorten van een collectie voor onder de kaart: "Fauteuils · Banken ·
 * Eettafels", de eerste `max` en dan "+n". Heeft de collectie geen eigen
 * soorten, dan de ene soort of groep waaronder ze hangt.
 */
export function collectionKindsLabel(collection: CatalogCollection, byId: Map<string, CatalogCategory>, locale: string, max = 2, showMore = true): string | null {
  const names = collection.kindIds.map((id) => byId.get(id)).filter((c): c is CatalogCategory => Boolean(c)).map((c) => categoryLabel(c, locale))
  if (names.length === 0) {
    const c = collection.categoryId ? byId.get(collection.categoryId) : undefined
    return c ? categoryLabel(c, locale) : null
  }
  if (names.length <= max) return names.join(" · ")
  const shown = names.slice(0, max).join(" · ")
  return showMore ? `${shown} +${names.length - max}` : shown
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
