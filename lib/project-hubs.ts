import { createServerSupabaseClient } from "@/lib/supabase/server"
import { canonicalizeScope, type ProjectScope } from "@/lib/project-translations"
import { PROVINCES, cityLabel } from "@/lib/provinces"
import { typeLabel, scopeLabel } from "@/lib/type-labels"

export { typeLabel }

export { PROVINCES }

/**
 * Programmatic SEO hub pages under /projects/{slug} — city hubs
 * ("Architectuur in Amsterdam") and scope hubs ("Renovatieprojecten in
 * Nederland"). Hubs only exist when they clear MIN_PROJECTS, so we never
 * mint thin pages; the set grows automatically with inventory.
 *
 * Hub slugs share the URL level with project detail slugs — the detail
 * route tries the project first and falls back to hub resolution, so a
 * project slug always wins a collision.
 *
 * SEO copy is inline (not messages/*.json) — same convention as the
 * discover page: the most search-sensitive strings live in one
 * reviewable place.
 */

export const MIN_HUB_PROJECTS = 3

export type HubKind = "city" | "scope" | "type" | "type-city" | "type-province" | "scope-city" | "scope-province" | "province"

export type Hub = {
  kind: HubKind
  slug: string
  /** Display name: city name as stored ("Amsterdam") or scope/type key. */
  name: string
  count: number
  /** For city / type-city hubs: the exact address_city spellings covered. */
  cityNames?: string[]
  scope?: ProjectScope
  /** For type / type-city hubs: the project-type category slug, which
   *  doubles as the filter URL token ("villa", "apartment"). */
  typeValue?: string
  /** For type / type-city hubs: the category id behind typeValue. */
  categoryId?: string
  /** For city / type-province hubs: the province (address_region EN
   *  value) it belongs to. */
  region?: string
}


export type HubProjectCard = {
  id: string
  slug: string | null
  title: string
  location: string | null
  projectType: string | null
  imageUrl: string | null
  translations: Record<string, unknown> | null
}

/** Localized "{Scope}projecten" nouns for combo H1s. */
const SCOPE_NOUNS: Record<string, { nl: string; en: string }> = {
  renovation: { nl: "Renovatieprojecten", en: "Renovation projects" },
  new_build: { nl: "Nieuwbouwprojecten", en: "New-build projects" },
  interior_design: { nl: "Interieurprojecten", en: "Interior design projects" },
}

const SCOPE_HUB_DEFS: Array<{ slug: string; scope: ProjectScope }> = [
  { slug: "renovatie", scope: "renovation" },
  { slug: "nieuwbouw", scope: "new_build" },
  { slug: "interieur", scope: "interior_design" },
]

export const HUB_COPY: Record<string, Record<"nl" | "en", { title: string; description: string; intro: string }>> = {
  renovatie: {
    nl: {
      title: "Renovatieprojecten in Nederland",
      description: "Bekijk gerealiseerde renovatieprojecten van Nederlandse architecten en interieurontwerpers — met de studio's die ze maakten.",
      intro: "Gerealiseerde renovaties van Nederlandse studio's — van monumentale villa's tot complete transformaties.",
    },
    en: {
      title: "Renovation projects in the Netherlands",
      description: "Browse completed renovation projects by Dutch architects and interior designers — with the studios that made them.",
      intro: "Completed renovations by Dutch studios — from listed villas to full transformations.",
    },
  },
  nieuwbouw: {
    nl: {
      title: "Nieuwbouwprojecten in Nederland",
      description: "Bekijk gerealiseerde nieuwbouwprojecten van Nederlandse architecten — met de studio's die ze ontwierpen.",
      intro: "Nieuwbouw van Nederlandse architecten — villa's, woningen en bijzondere opdrachten.",
    },
    en: {
      title: "New-build projects in the Netherlands",
      description: "Browse completed new-build projects by Dutch architects — with the studios that designed them.",
      intro: "New builds by Dutch architects — villas, homes and one-off commissions.",
    },
  },
  interieur: {
    nl: {
      title: "Interieurprojecten in Nederland",
      description: "Bekijk gerealiseerde interieurprojecten van Nederlandse ontwerpers — met de studio's die ze maakten.",
      intro: "Interieurontwerp van Nederlandse studio's — woningen, werkplekken en alles daartussen.",
    },
    en: {
      title: "Interior design projects in the Netherlands",
      description: "Browse completed interior design projects by Dutch designers — with the studios that made them.",
      intro: "Interior design by Dutch studios — homes, workplaces and everything in between.",
    },
  },
}

/** Display labels for building_type values. Fallback: capitalized value. */

export type HubCopy = {
  /** Visible page title — clean UX label ("Projecten in Amsterdam"). */
  h1: string
  /** <title> — search-phrase oriented, may differ from the H1. */
  metaTitle: string
  description: string
  intro: string
  /** Leaf label for the breadcrumb. */
  crumb: string
}

/** Unified copy for any hub kind. */
export function hubCopy(hub: Hub, locale: string): HubCopy {
  const nl = locale === "nl"
  if (hub.kind === "city") {
    const name = cityLabel(hub.name, locale)
    return {
      h1: nl ? `Projecten in ${name}` : `Projects in ${name}`,
      metaTitle: nl
        ? `Architectuur- en interieurprojecten in ${name}`
        : `Architecture & interior projects in ${name}`,
      description: nl
        ? `Bekijk gerealiseerde architectuur- en interieurprojecten in ${name} — met de studio's die ze maakten.`
        : `Browse completed architecture and interior projects in ${name} — with the studios that made them.`,
      intro: nl
        ? `Gerealiseerde projecten in ${name}, van de architecten en ontwerpers die ze maakten.`
        : `Completed projects in ${name}, by the architects and designers who made them.`,
      crumb: name,
    }
  }
  if (hub.kind === "scope") {
    const c = HUB_COPY[hub.slug]?.[nl ? "nl" : "en"] ?? HUB_COPY[hub.slug]?.nl
    const shortCrumb = hub.scope ? scopeLabel(hub.scope, locale) : c.title
    return { h1: c.title, metaTitle: c.title, description: c.description, intro: c.intro, crumb: shortCrumb }
  }
  if (hub.kind === "province") {
    const prov = PROVINCES[hub.name]
    const label = prov ? (nl ? prov.nl : prov.en) : hub.name
    return {
      h1: nl ? `Projecten in ${label}` : `Projects in ${label}`,
      metaTitle: nl
        ? `Architectuur- en interieurprojecten in ${label}`
        : `Architecture & interior projects in ${label}`,
      description: nl
        ? `Bekijk gerealiseerde architectuur- en interieurprojecten in ${label} — met de studio's die ze maakten.`
        : `Browse completed architecture and interior projects in ${label} — with the studios that made them.`,
      intro: nl
        ? `Gerealiseerde projecten in ${label}, van de architecten en ontwerpers die ze maakten.`
        : `Completed projects in ${label}, by the architects and designers who made them.`,
      crumb: label,
    }
  }
  if (hub.kind === "scope-city" || hub.kind === "scope-province") {
    const noun = SCOPE_NOUNS[hub.scope ?? ""]?.[nl ? "nl" : "en"] ?? (nl ? "Projecten" : "Projects")
    const where = hub.kind === "scope-city"
      ? cityLabel(hub.name, locale)
      : (PROVINCES[hub.name] ? (nl ? PROVINCES[hub.name].nl : PROVINCES[hub.name].en) : hub.name)
    const title = `${noun} in ${where}`
    return {
      h1: title,
      metaTitle: title,
      description: nl
        ? `Bekijk gerealiseerde ${noun.toLowerCase()} in ${where} — met de studio's die ze maakten.`
        : `Browse completed ${noun.toLowerCase()} in ${where} — with the studios that made them.`,
      intro: nl
        ? `${noun} in ${where}, van de studio's die ze maakten.`
        : `${noun} in ${where}, by the studios that made them.`,
      crumb: hub.scope ? scopeLabel(hub.scope, locale) : title,
    }
  }
  const label = typeLabel(hub.typeValue ?? hub.slug, locale)
  const where =
    hub.kind === "type-city"
      ? cityLabel(hub.name, locale)
      : hub.kind === "type-province"
        ? (PROVINCES[hub.name] ? (nl ? PROVINCES[hub.name].nl : PROVINCES[hub.name].en) : hub.name)
        : (nl ? "Nederland" : "the Netherlands")
  return {
    h1: `${label} in ${where}`,
    metaTitle: nl
      ? `${label} in ${where} – architectuurprojecten`
      : `${label} in ${where} – architecture projects`,
    description: nl
      ? `Bekijk gerealiseerde ${label.toLowerCase()} in ${where} — met de architecten en studio's die ze maakten.`
      : `Browse completed ${label.toLowerCase()} in ${where} — with the architects and studios that made them.`,
    intro: nl
      ? `${label} in ${where}, van de architecten en ontwerpers die ze maakten.`
      : `${label} in ${where}, by the architects and designers who made them.`,
    crumb: label,
  }
}

export function cityHubCopy(city: string, locale: string): { title: string; description: string; intro: string } {
  if (locale === "nl") {
    return {
      title: `Architectuur in ${city}`,
      description: `Bekijk gerealiseerde architectuur- en interieurprojecten in ${city} — met de studio's die ze maakten.`,
      intro: `Gerealiseerde projecten in ${city}, van de architecten en ontwerpers die ze maakten.`,
    }
  }
  return {
    title: `Architecture in ${city}`,
    description: `Browse completed architecture and interior projects in ${city} — with the studios that made them.`,
    intro: `Completed projects in ${city}, by the architects and designers who made them.`,
  }
}

export function citySlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** address_city values that aren't cities — junk data that would mint
 *  nonsense hubs ("Architectuur in Netherlands"). */
const CITY_DENYLIST = new Set([
  "netherlands", "nederland", "the-netherlands", "holland",
  // Province names filled into address_city by imports — they'd show as
  // bogus city chips and collide with province hub slugs.
  "noord-holland", "north-holland", "zuid-holland", "south-holland",
  "noord-brabant", "north-brabant", "gelderland-provincie",
])

type ProjectRowLite = { address_city: string | null; address_region: string | null; project_type: string | null; project_type_category_id: string | null }

/** All qualifying hubs, computed from published projects. */
export async function getHubs(): Promise<{ cities: Hub[]; scopes: Hub[]; types: Hub[]; combos: Hub[]; provinces: Hub[] }> {
  const supabase = await createServerSupabaseClient()
  const [{ data }, { data: cats }] = await Promise.all([
    supabase
      .from("projects")
      .select("address_city, address_region, project_type, project_type_category_id")
      .eq("status", "published")
      .not("slug", "is", null),
    supabase
      .from("categories")
      .select("id, slug")
      .eq("category_type", "Project")
      .is("parent_id", null),
  ])
  const rows = (data ?? []) as ProjectRowLite[]
  // Type axis = the project-type CATEGORY taxonomy (what the Type filter
  // uses), keyed by category slug so hub slugs match filter URL tokens.
  const catSlugById = new Map<string, string>()
  const catIdBySlug = new Map<string, string>()
  for (const c of cats ?? []) {
    if (c.id && c.slug) { catSlugById.set(c.id, c.slug); catIdBySlug.set(c.slug, c.id) }
  }

  const cityAgg = new Map<string, { name: string; count: number; names: Set<string>; regions: Map<string, number> }>()
  const provinceAgg = new Map<string, { count: number; names: Set<string> }>()
  const scopeCounts = new Map<ProjectScope, number>()
  const typeCounts = new Map<string, number>()
  const comboAgg = new Map<string, { typeValue: string; city: string; count: number; names: Set<string> }>()
  const provinceComboAgg = new Map<string, { typeValue: string; region: string; count: number; names: Set<string> }>()
  const scopeCityAgg = new Map<string, { scope: ProjectScope; city: string; count: number; names: Set<string> }>()
  const scopeProvinceAgg = new Map<string, { scope: ProjectScope; region: string; count: number; names: Set<string> }>()
  const scopeSlugOf = new Map(SCOPE_HUB_DEFS.map((d) => [d.scope, d.slug]))
  for (const row of rows) {
    const city = row.address_city?.trim()
    const cSlug = city ? citySlug(city) : ""
    const cityOk = Boolean(cSlug && !CITY_DENYLIST.has(cSlug))
    if (city && cityOk) {
      const entry = cityAgg.get(cSlug) ?? { name: city, count: 0, names: new Set<string>(), regions: new Map<string, number>() }
      entry.count += 1
      entry.names.add(city)
      if (row.address_region) entry.regions.set(row.address_region, (entry.regions.get(row.address_region) ?? 0) + 1)
      cityAgg.set(cSlug, entry)
    }
    if (row.address_region && PROVINCES[row.address_region] && city && cityOk) {
      const pEntry = provinceAgg.get(row.address_region) ?? { count: 0, names: new Set<string>() }
      pEntry.count += 1
      pEntry.names.add(city)
      provinceAgg.set(row.address_region, pEntry)
    }
    const scope = canonicalizeScope(row.project_type)
    if (scope) {
      scopeCounts.set(scope, (scopeCounts.get(scope) ?? 0) + 1)
      const sSlug = scopeSlugOf.get(scope)
      if (sSlug && city && cityOk) {
        const key = `${cSlug}/${sSlug}`
        const entry = scopeCityAgg.get(key) ?? { scope, city, count: 0, names: new Set<string>() }
        entry.count += 1
        entry.names.add(city)
        scopeCityAgg.set(key, entry)
        if (row.address_region && PROVINCES[row.address_region]) {
          const pKey = `${PROVINCES[row.address_region].slug}/${sSlug}`
          const pEntry = scopeProvinceAgg.get(pKey) ?? { scope, region: row.address_region, count: 0, names: new Set<string>() }
          pEntry.count += 1
          pEntry.names.add(city)
          scopeProvinceAgg.set(pKey, pEntry)
        }
      }
    }
    const typeValue = row.project_type_category_id ? catSlugById.get(row.project_type_category_id) : undefined
    if (typeValue) {
      typeCounts.set(typeValue, (typeCounts.get(typeValue) ?? 0) + 1)
      if (city && cityOk) {
        // Nested combo slug: /projects/{geo}/{type}
        const key = `${cSlug}/${typeValue}`
        const entry = comboAgg.get(key) ?? { typeValue, city, count: 0, names: new Set<string>() }
        entry.count += 1
        entry.names.add(city)
        comboAgg.set(key, entry)
      }
      if (row.address_region && PROVINCES[row.address_region] && city && cityOk) {
        const key = `${PROVINCES[row.address_region].slug}/${typeValue}`
        const entry = provinceComboAgg.get(key) ?? { typeValue, region: row.address_region, count: 0, names: new Set<string>() }
        entry.count += 1
        entry.names.add(city)
        provinceComboAgg.set(key, entry)
      }
    }
  }

  const cities: Hub[] = Array.from(cityAgg.entries())
    .filter(([, v]) => v.count >= MIN_HUB_PROJECTS)
    .map(([slug, v]) => ({
      kind: "city" as const,
      slug,
      name: v.name,
      count: v.count,
      cityNames: Array.from(v.names),
      region: Array.from(v.regions.entries()).sort((a, b) => b[1] - a[1])[0]?.[0],
    }))
    .sort((a, b) => b.count - a.count)

  const provinces: Hub[] = Array.from(provinceAgg.entries())
    .filter(([, v]) => v.count >= MIN_HUB_PROJECTS)
    .map(([regionName, v]) => ({
      kind: "province" as const,
      slug: PROVINCES[regionName].slug,
      name: regionName,
      count: v.count,
      cityNames: Array.from(v.names),
      region: regionName,
    }))
    .sort((a, b) => b.count - a.count)

  const scopes: Hub[] = SCOPE_HUB_DEFS
    .map((def) => ({
      kind: "scope" as const,
      slug: def.slug,
      name: def.slug,
      scope: def.scope,
      count: scopeCounts.get(def.scope) ?? 0,
    }))
    .filter((h) => h.count >= MIN_HUB_PROJECTS)

  const types: Hub[] = Array.from(typeCounts.entries())
    .filter(([, count]) => count >= MIN_HUB_PROJECTS)
    .map(([typeValue, count]) => ({ kind: "type" as const, slug: typeValue, name: typeValue, count, typeValue, categoryId: catIdBySlug.get(typeValue) }))
    .sort((a, b) => b.count - a.count)

  // Nested combo slugs (/projects/amsterdam/villa,
  // /projects/noord-holland/villa) — geo first, type as leaf, matching
  // the breadcrumb spine. Served by the [slug]/[sub] route.
  const combos: Hub[] = [
    ...Array.from(comboAgg.entries())
      .filter(([, v]) => v.count >= MIN_HUB_PROJECTS)
      .map(([slug, v]) => ({
        kind: "type-city" as const,
        slug,
        name: v.city,
        count: v.count,
        cityNames: Array.from(v.names),
        typeValue: v.typeValue,
        categoryId: catIdBySlug.get(v.typeValue),
      })),
    ...Array.from(provinceComboAgg.entries())
      .filter(([, v]) => v.count >= MIN_HUB_PROJECTS)
      .map(([slug, v]) => ({
        kind: "type-province" as const,
        slug,
        name: v.region,
        count: v.count,
        cityNames: Array.from(v.names),
        typeValue: v.typeValue,
        categoryId: catIdBySlug.get(v.typeValue),
        region: v.region,
      })),
    ...Array.from(scopeCityAgg.entries())
      .filter(([, v]) => v.count >= MIN_HUB_PROJECTS)
      .map(([slug, v]) => ({
        kind: "scope-city" as const,
        slug,
        name: v.city,
        count: v.count,
        cityNames: Array.from(v.names),
        scope: v.scope,
      })),
    ...Array.from(scopeProvinceAgg.entries())
      .filter(([, v]) => v.count >= MIN_HUB_PROJECTS)
      .map(([slug, v]) => ({
        kind: "scope-province" as const,
        slug,
        name: v.region,
        count: v.count,
        cityNames: Array.from(v.names),
        scope: v.scope,
        region: v.region,
      })),
  ].sort((a, b) => b.count - a.count)

  return { cities, scopes, types, combos, provinces }
}

export async function resolveHub(slug: string): Promise<Hub | null> {
  const { cities, scopes, types, combos, provinces } = await getHubs()
  return (
    cities.find((h) => h.slug === slug) ??
    scopes.find((h) => h.slug === slug) ??
    types.find((h) => h.slug === slug) ??
    combos.find((h) => h.slug === slug) ??
    provinces.find((h) => h.slug === slug) ??
    null
  )
}

/** Projects for a hub, with primary photos, ready for the card grid. */
export async function getHubProjects(hub: Hub): Promise<HubProjectCard[]> {
  const supabase = await createServerSupabaseClient()
  let q = supabase
    .from("projects")
    .select("id, slug, title, translations, address_city, project_type")
    .eq("status", "published")
    .not("slug", "is", null)
    .order("published_at", { ascending: false, nullsFirst: false })
  if (hub.kind !== "scope" && hub.kind !== "type" && hub.cityNames?.length) {
    q = q.in("address_city", hub.cityNames)
  }
  if ((hub.kind === "type" || hub.kind === "type-city" || hub.kind === "type-province") && hub.categoryId) {
    q = q.eq("project_type_category_id", hub.categoryId)
  }
  const { data } = await q
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows = (data ?? []) as any[]
  if ((hub.kind === "scope" || hub.kind === "scope-city" || hub.kind === "scope-province") && hub.scope) {
    rows = rows.filter((r) => canonicalizeScope(r.project_type) === hub.scope)
  }

  const ids = rows.map((r) => r.id)
  const photoByProject = new Map<string, string>()
  if (ids.length > 0) {
    const { data: photos } = await supabase
      .from("project_photos")
      .select("project_id, url, is_primary, order_index")
      .in("project_id", ids)
      .order("is_primary", { ascending: false })
      .order("order_index", { ascending: true })
    for (const p of photos ?? []) {
      if (p.project_id && p.url && !photoByProject.has(p.project_id)) {
        photoByProject.set(p.project_id, p.url)
      }
    }
  }

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    location: r.address_city ?? null,
    projectType: r.project_type ?? null,
    imageUrl: photoByProject.get(r.id) ?? null,
    translations: r.translations ?? null,
  }))
}
