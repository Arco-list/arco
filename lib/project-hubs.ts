import { createServerSupabaseClient } from "@/lib/supabase/server"
import { canonicalizeScope, type ProjectScope } from "@/lib/project-translations"

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

export type HubKind = "city" | "scope" | "type" | "type-city"

export type Hub = {
  kind: HubKind
  slug: string
  /** Display name: city name as stored ("Amsterdam") or scope/type key. */
  name: string
  count: number
  /** For city / type-city hubs: the exact address_city spellings covered. */
  cityNames?: string[]
  scope?: ProjectScope
  /** For type / type-city hubs: the projects.building_type value, which
   *  doubles as the filter token ("villa", "apartment"). */
  typeValue?: string
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
const TYPE_LABELS: Record<string, { nl: string; en: string }> = {
  villa: { nl: "Villa's", en: "Villas" },
  apartment: { nl: "Appartementen", en: "Apartments" },
  penthouse: { nl: "Penthouses", en: "Penthouses" },
  house: { nl: "Woonhuizen", en: "Houses" },
}

export function typeLabel(typeValue: string, locale: string): string {
  const entry = TYPE_LABELS[typeValue]
  if (entry) return locale === "nl" ? entry.nl : entry.en
  return typeValue.charAt(0).toUpperCase() + typeValue.slice(1)
}

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
    return {
      h1: nl ? `Projecten in ${hub.name}` : `Projects in ${hub.name}`,
      metaTitle: nl
        ? `Architectuur- en interieurprojecten in ${hub.name}`
        : `Architecture & interior projects in ${hub.name}`,
      description: nl
        ? `Bekijk gerealiseerde architectuur- en interieurprojecten in ${hub.name} — met de studio's die ze maakten.`
        : `Browse completed architecture and interior projects in ${hub.name} — with the studios that made them.`,
      intro: nl
        ? `Gerealiseerde projecten in ${hub.name}, van de architecten en ontwerpers die ze maakten.`
        : `Completed projects in ${hub.name}, by the architects and designers who made them.`,
      crumb: hub.name,
    }
  }
  if (hub.kind === "scope") {
    const c = HUB_COPY[hub.slug]?.[nl ? "nl" : "en"] ?? HUB_COPY[hub.slug]?.nl
    return { h1: c.title, metaTitle: c.title, description: c.description, intro: c.intro, crumb: c.title }
  }
  const label = typeLabel(hub.typeValue ?? hub.slug, locale)
  const where = hub.kind === "type-city" ? hub.name : (nl ? "Nederland" : "the Netherlands")
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
const CITY_DENYLIST = new Set(["netherlands", "nederland", "the-netherlands", "holland"])

type ProjectRowLite = { address_city: string | null; project_type: string | null; building_type: string | null }

/** All qualifying hubs, computed from published projects. */
export async function getHubs(): Promise<{ cities: Hub[]; scopes: Hub[]; types: Hub[]; combos: Hub[] }> {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from("projects")
    .select("address_city, project_type, building_type")
    .eq("status", "published")
    .not("slug", "is", null)
  const rows = (data ?? []) as ProjectRowLite[]

  const cityAgg = new Map<string, { name: string; count: number; names: Set<string> }>()
  const scopeCounts = new Map<ProjectScope, number>()
  const typeCounts = new Map<string, number>()
  const comboAgg = new Map<string, { typeValue: string; city: string; count: number; names: Set<string> }>()
  for (const row of rows) {
    const city = row.address_city?.trim()
    const cSlug = city ? citySlug(city) : ""
    const cityOk = Boolean(cSlug && !CITY_DENYLIST.has(cSlug))
    if (city && cityOk) {
      const entry = cityAgg.get(cSlug) ?? { name: city, count: 0, names: new Set<string>() }
      entry.count += 1
      entry.names.add(city)
      cityAgg.set(cSlug, entry)
    }
    const scope = canonicalizeScope(row.project_type)
    if (scope) scopeCounts.set(scope, (scopeCounts.get(scope) ?? 0) + 1)
    const typeValue = row.building_type?.trim().toLowerCase()
    if (typeValue) {
      typeCounts.set(typeValue, (typeCounts.get(typeValue) ?? 0) + 1)
      if (city && cityOk) {
        const key = `${typeValue}-${cSlug}`
        const entry = comboAgg.get(key) ?? { typeValue, city, count: 0, names: new Set<string>() }
        entry.count += 1
        entry.names.add(city)
        comboAgg.set(key, entry)
      }
    }
  }

  const cities: Hub[] = Array.from(cityAgg.entries())
    .filter(([, v]) => v.count >= MIN_HUB_PROJECTS)
    .map(([slug, v]) => ({ kind: "city" as const, slug, name: v.name, count: v.count, cityNames: Array.from(v.names) }))
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
    .map(([typeValue, count]) => ({ kind: "type" as const, slug: typeValue, name: typeValue, count, typeValue }))
    .sort((a, b) => b.count - a.count)

  // Composite single-segment slugs (apartment-amsterdam) so combos fit
  // the existing /projects/[slug] level.
  const combos: Hub[] = Array.from(comboAgg.entries())
    .filter(([, v]) => v.count >= MIN_HUB_PROJECTS)
    .map(([slug, v]) => ({
      kind: "type-city" as const,
      slug,
      name: v.city,
      count: v.count,
      cityNames: Array.from(v.names),
      typeValue: v.typeValue,
    }))
    .sort((a, b) => b.count - a.count)

  return { cities, scopes, types, combos }
}

export async function resolveHub(slug: string): Promise<Hub | null> {
  const { cities, scopes, types, combos } = await getHubs()
  return (
    cities.find((h) => h.slug === slug) ??
    scopes.find((h) => h.slug === slug) ??
    types.find((h) => h.slug === slug) ??
    combos.find((h) => h.slug === slug) ??
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
  if ((hub.kind === "city" || hub.kind === "type-city") && hub.cityNames?.length) {
    q = q.in("address_city", hub.cityNames)
  }
  if ((hub.kind === "type" || hub.kind === "type-city") && hub.typeValue) {
    q = q.ilike("building_type", hub.typeValue)
  }
  const { data } = await q
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows = (data ?? []) as any[]
  if (hub.kind === "scope" && hub.scope) {
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
