import { createServerSupabaseClient } from "@/lib/supabase/server"
import { PROVINCES, cityLabel, provinceKey } from "@/lib/provinces"

/**
 * Programmatic hub pages for the professionals discover —
 * /professionals/{slug} for cities, provinces and services, plus nested
 * /professionals/{city}/{service} combos. Same contract as the project
 * hubs: only minted when the slice clears MIN_PRO_HUB_COMPANIES, company
 * detail slugs always win a collision, and the professional filter
 * provider maps filter state <-> hub paths so hub pages ARE the
 * discover page, pre-filtered.
 */

export const MIN_PRO_HUB_COMPANIES = 3

export type ProHubKind = "city" | "province" | "service" | "service-city" | "service-province" | "category" | "category-city" | "category-province"

export type ProHub = {
  kind: ProHubKind
  slug: string
  /** City name as stored, province EN key, or the service EN name. */
  name: string
  count: number
  /** city / province / service-city: exact company_city spellings covered. */
  cityNames?: string[]
  /** province / service-province hubs: canonical EN region key. */
  region?: string
  /** service / service-city: the specialty slug == filter URL token. */
  serviceSlug?: string
  serviceName?: string
  serviceNameNl?: string
  /** category / category-city / category-province: the parent service
   *  GROUP (e.g. design-planning) == categories filter URL token. */
  categorySlug?: string
  categoryName?: string
  categoryNameNl?: string
}

/** Plural display forms for the service hubs we expect; fallback
 *  appends an "s" to the stored name. */
const SERVICE_PLURALS: Record<string, { nl: string; en: string }> = {
  architect: { nl: "Architecten", en: "Architects" },
  "interior-designer": { nl: "Interieurontwerpers", en: "Interior designers" },
  "garden-designer": { nl: "Tuinontwerpers", en: "Garden designers" },
}

export function servicePlural(hub: ProHub, locale: string): string {
  const known = hub.serviceSlug ? SERVICE_PLURALS[hub.serviceSlug] : undefined
  if (known) return locale === "nl" ? known.nl : known.en
  const base = (locale === "nl" ? hub.serviceNameNl : hub.serviceName) ?? hub.serviceName ?? hub.slug
  return `${base}s`
}

export function proCitySlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

type MvRow = {
  company_city: string | null
  company_state_region: string | null
  primary_specialty_slug: string | null
  primary_service_name: string | null
  primary_service_name_nl: string | null
}

export async function getProfessionalHubs(): Promise<ProHub[]> {
  const supabase = await createServerSupabaseClient()
  const [{ data }, { data: cats }] = await Promise.all([
    supabase
      .from("mv_professional_summary")
      .select("company_city, company_state_region, primary_specialty_slug, primary_service_name, primary_service_name_nl")
      .in("company_status", ["listed", "prospected"]),
    supabase.from("categories").select("id, slug, name, name_nl, parent_id"),
  ])
  const rows = (data ?? []) as MvRow[]
  // service slug -> parent category (service GROUP, e.g. design-planning)
  const catById = new Map((cats ?? []).map((c) => [c.id, c]))
  const parentBySvcSlug = new Map<string, { slug: string; name: string; nameNl: string | null }>()
  for (const c of cats ?? []) {
    if (!c.parent_id || !c.slug) continue
    const parent = catById.get(c.parent_id)
    if (parent?.slug && parent.name) parentBySvcSlug.set(c.slug, { slug: parent.slug, name: parent.name, nameNl: parent.name_nl })
  }

  const cityAgg = new Map<string, { name: string; count: number; names: Set<string> }>()
  const provinceAgg = new Map<string, { count: number; names: Set<string> }>()
  const serviceAgg = new Map<string, { name: string; nameNl: string | null; count: number }>()
  const comboAgg = new Map<string, { city: string; serviceSlug: string; name: string; nameNl: string | null; count: number; names: Set<string> }>()
  const provinceComboAgg = new Map<string, { region: string; serviceSlug: string; name: string; nameNl: string | null; count: number; names: Set<string> }>()
  type CatAgg = { slug: string; name: string; nameNl: string | null; count: number; names: Set<string>; region?: string; city?: string }
  const categoryAgg = new Map<string, CatAgg>()
  const categoryCityAgg = new Map<string, CatAgg>()
  const categoryProvinceAgg = new Map<string, CatAgg>()

  for (const row of rows) {
    const city = row.company_city?.trim()
    const cSlug = city ? proCitySlug(city) : ""
    if (city && cSlug) {
      const entry = cityAgg.get(cSlug) ?? { name: city, count: 0, names: new Set<string>() }
      entry.count += 1
      entry.names.add(city)
      cityAgg.set(cSlug, entry)
    }
    const region = provinceKey(row.company_state_region)
    if (region && city) {
      const entry = provinceAgg.get(region) ?? { count: 0, names: new Set<string>() }
      entry.count += 1
      entry.names.add(city)
      provinceAgg.set(region, entry)
    }
    const svc = row.primary_specialty_slug?.trim()
    if (svc && row.primary_service_name) {
      const entry = serviceAgg.get(svc) ?? { name: row.primary_service_name, nameNl: row.primary_service_name_nl, count: 0 }
      entry.count += 1
      serviceAgg.set(svc, entry)
      if (city && cSlug) {
        const key = `${cSlug}/${svc}`
        const combo = comboAgg.get(key) ?? { city, serviceSlug: svc, name: row.primary_service_name, nameNl: row.primary_service_name_nl, count: 0, names: new Set<string>() }
        combo.count += 1
        combo.names.add(city)
        comboAgg.set(key, combo)
      }
      if (region && city) {
        const key = `${PROVINCES[region].slug}/${svc}`
        const combo = provinceComboAgg.get(key) ?? { region, serviceSlug: svc, name: row.primary_service_name, nameNl: row.primary_service_name_nl, count: 0, names: new Set<string>() }
        combo.count += 1
        combo.names.add(city)
        provinceComboAgg.set(key, combo)
      }
      const parent = parentBySvcSlug.get(svc)
      if (parent) {
        const base = categoryAgg.get(parent.slug) ?? { slug: parent.slug, name: parent.name, nameNl: parent.nameNl, count: 0, names: new Set<string>() }
        base.count += 1
        if (city) base.names.add(city)
        categoryAgg.set(parent.slug, base)
        if (city && cSlug) {
          const key = `${cSlug}/${parent.slug}`
          const cc = categoryCityAgg.get(key) ?? { slug: parent.slug, name: parent.name, nameNl: parent.nameNl, count: 0, names: new Set<string>(), city }
          cc.count += 1
          cc.names.add(city)
          categoryCityAgg.set(key, cc)
        }
        if (region && city) {
          const key = `${PROVINCES[region].slug}/${parent.slug}`
          const cp = categoryProvinceAgg.get(key) ?? { slug: parent.slug, name: parent.name, nameNl: parent.nameNl, count: 0, names: new Set<string>(), region }
          cp.count += 1
          cp.names.add(city)
          categoryProvinceAgg.set(key, cp)
        }
      }
    }
  }

  const hubs: ProHub[] = [
    ...Array.from(cityAgg.entries())
      .filter(([, v]) => v.count >= MIN_PRO_HUB_COMPANIES)
      .map(([slug, v]) => ({ kind: "city" as const, slug, name: v.name, count: v.count, cityNames: Array.from(v.names) })),
    ...Array.from(provinceAgg.entries())
      .filter(([, v]) => v.count >= MIN_PRO_HUB_COMPANIES)
      .map(([region, v]) => ({
        kind: "province" as const,
        slug: PROVINCES[region].slug,
        name: region,
        count: v.count,
        cityNames: Array.from(v.names),
        region,
      })),
    ...Array.from(serviceAgg.entries())
      .filter(([, v]) => v.count >= MIN_PRO_HUB_COMPANIES)
      .map(([slug, v]) => ({
        kind: "service" as const,
        slug,
        name: v.name,
        count: v.count,
        serviceSlug: slug,
        serviceName: v.name,
        serviceNameNl: v.nameNl ?? undefined,
      })),
    ...Array.from(comboAgg.entries())
      .filter(([, v]) => v.count >= MIN_PRO_HUB_COMPANIES)
      .map(([slug, v]) => ({
        kind: "service-city" as const,
        slug,
        name: v.city,
        count: v.count,
        cityNames: Array.from(v.names),
        serviceSlug: v.serviceSlug,
        serviceName: v.name,
        serviceNameNl: v.nameNl ?? undefined,
      })),
    ...Array.from(provinceComboAgg.entries())
      .filter(([, v]) => v.count >= MIN_PRO_HUB_COMPANIES)
      .map(([slug, v]) => ({
        kind: "service-province" as const,
        slug,
        name: v.region,
        count: v.count,
        cityNames: Array.from(v.names),
        region: v.region,
        serviceSlug: v.serviceSlug,
        serviceName: v.name,
        serviceNameNl: v.nameNl ?? undefined,
      })),
    ...Array.from(categoryAgg.values())
      .filter((v) => v.count >= MIN_PRO_HUB_COMPANIES)
      .map((v) => ({
        kind: "category" as const,
        slug: v.slug,
        name: v.name,
        count: v.count,
        categorySlug: v.slug,
        categoryName: v.name,
        categoryNameNl: v.nameNl ?? undefined,
      })),
    ...Array.from(categoryCityAgg.entries())
      .filter(([, v]) => v.count >= MIN_PRO_HUB_COMPANIES)
      .map(([slug, v]) => ({
        kind: "category-city" as const,
        slug,
        name: v.city as string,
        count: v.count,
        cityNames: Array.from(v.names),
        categorySlug: v.slug,
        categoryName: v.name,
        categoryNameNl: v.nameNl ?? undefined,
      })),
    ...Array.from(categoryProvinceAgg.entries())
      .filter(([, v]) => v.count >= MIN_PRO_HUB_COMPANIES)
      .map(([slug, v]) => ({
        kind: "category-province" as const,
        slug,
        name: v.region as string,
        count: v.count,
        cityNames: Array.from(v.names),
        region: v.region,
        categorySlug: v.slug,
        categoryName: v.name,
        categoryNameNl: v.nameNl ?? undefined,
      })),
  ].sort((a, b) => b.count - a.count)

  return hubs
}

export async function resolveProfessionalHub(slug: string): Promise<ProHub | null> {
  const hubs = await getProfessionalHubs()
  return hubs.find((h) => h.slug === slug) ?? null
}

export type ProHubCopy = { h1: string; metaTitle: string; description: string; crumb: string }

export function proHubCopy(hub: ProHub, locale: string): ProHubCopy {
  const nl = locale === "nl"
  if (hub.kind === "city" || hub.kind === "province") {
    const where = hub.kind === "city"
      ? cityLabel(hub.name, locale)
      : (PROVINCES[hub.name] ? (nl ? PROVINCES[hub.name].nl : PROVINCES[hub.name].en) : hub.name)
    return {
      h1: nl ? `Professionals in ${where}` : `Professionals in ${where}`,
      metaTitle: nl
        ? `Architecten en interieurontwerpers in ${where}`
        : `Architects & interior designers in ${where}`,
      description: nl
        ? `Vind architecten en interieurontwerpers in ${where} — bekijk hun gerealiseerde projecten en neem direct contact op.`
        : `Find architects and interior designers in ${where} — browse their completed projects and get in touch directly.`,
      crumb: where,
    }
  }
  if (hub.kind === "category" || hub.kind === "category-city" || hub.kind === "category-province") {
    const label = (nl ? hub.categoryNameNl : hub.categoryName) ?? hub.categoryName ?? hub.slug
    const where = hub.kind === "category-city"
      ? cityLabel(hub.name, locale)
      : hub.kind === "category-province"
        ? (PROVINCES[hub.name] ? (nl ? PROVINCES[hub.name].nl : PROVINCES[hub.name].en) : hub.name)
        : (nl ? "Nederland" : "the Netherlands")
    return {
      h1: `${label} professionals in ${where}`,
      metaTitle: nl
        ? `${label} professionals in ${where} – bekijk hun projecten`
        : `${label} professionals in ${where} – browse their projects`,
      description: nl
        ? `Vind ${label} professionals in ${where} — bekijk gerealiseerde projecten en neem direct contact op.`
        : `Find ${label} professionals in ${where} — browse completed projects and get in touch directly.`,
      crumb: label,
    }
  }
  const plural = servicePlural(hub, locale)
  const where = hub.kind === "service-city"
    ? cityLabel(hub.name, locale)
    : hub.kind === "service-province"
      ? (PROVINCES[hub.name] ? (nl ? PROVINCES[hub.name].nl : PROVINCES[hub.name].en) : hub.name)
      : (nl ? "Nederland" : "the Netherlands")
  return {
    h1: `${plural} in ${where}`,
    metaTitle: nl
      ? `${plural} in ${where} – bekijk hun projecten`
      : `${plural} in ${where} – browse their projects`,
    description: nl
      ? `Vind ${plural.toLowerCase()} in ${where} — bekijk gerealiseerde projecten en neem direct contact op.`
      : `Find ${plural.toLowerCase()} in ${where} — browse completed projects and get in touch directly.`,
    crumb: plural,
  }
}
