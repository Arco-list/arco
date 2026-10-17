import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { TYPE_LABELS } from "@/lib/type-labels"
import { CITY_DENYLIST } from "@/lib/project-hubs"

/**
 * De cijfers die de omschrijvingen in lib/seo/copy.ts noemen.
 *
 * Alle drie falen stil en geven null of een lege lijst terug: copy.ts
 * laat dan het slot weg. Een omschrijving zonder getal is beter dan een
 * pagina zonder omschrijving, en een pagina die 500't omdat een
 * telling faalde is het ergste van de drie.
 *
 * Deze queries draaien in generateMetadata, dus op elke render van de
 * pagina. Dat kan omdat elke route waar ze gebruikt worden
 * `revalidate = 300` heeft: één telling per vijf minuten per pagina. Zet
 * die revalidate ooit uit, dan betaal je ze per bezoeker.
 *
 * SERVICE-ROLE EN NIET DE GEWONE SERVERCLIENT, om twee redenen die
 * dezelfde kant op wijzen. De eerste: deze getallen zijn publiek en
 * mogen niet per bezoeker verschillen — wat in het zoekresultaat staat
 * is wat Google zag, niet wat deze sessie mag zien. De tweede is
 * dwingender: createServerSupabaseClient leest cookies, en tijdens
 * `next build` is er geen cookiestore. Die client gooit dan, de catch
 * hieronder slikt het, en de voorgerenderde pagina gaat zonder getal de
 * deur uit — precies de pagina's waarvoor dit geschreven is. De
 * statusfilters staan er daarom expliciet bij: service-role negeert
 * RLS, dus de publieke verzameling wordt hier met de hand afgebakend.
 */

/** Rijen ophalen zonder rijen op te halen — alleen de count. */
export async function countPublishedProjects(): Promise<number | null> {
  try {
    const supabase = createServiceRoleSupabaseClient()
    const { count } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
    return count ?? null
  } catch {
    return null
  }
}

export type ProDiscoverFacts = {
  companies: number | null
  /** De twee grootste plaatsen, op aantal bedrijven. */
  topCities: string[]
  /** Hoeveel plaatsen er ná die twee nog over zijn. */
  otherCities: number
}

/**
 * Aantal bedrijven en de plaatsen waar ze zitten.
 *
 * Eén query over mv_professional_summary — dezelfde view en dezelfde
 * statusfilter als het overzicht zelf gebruikt, zodat het getal in de
 * omschrijving klopt met wat de bezoeker op de pagina ziet. Bij ~100
 * bedrijven is alle steden ophalen goedkoper dan een group-by via RPC,
 * en het geeft echte telling-per-stad in plaats van een alfabetische
 * greep.
 */
export async function fetchProDiscoverFacts(): Promise<ProDiscoverFacts> {
  const empty: ProDiscoverFacts = { companies: null, topCities: [], otherCities: 0 }
  try {
    const supabase = createServiceRoleSupabaseClient()
    const { data, error } = await supabase
      .from("mv_professional_summary")
      .select("company_city")
      .in("company_status", ["listed", "prospected"])
    if (error || !data) return empty

    const perCity = new Map<string, number>()
    for (const row of data) {
      const city = (row as { company_city: string | null }).company_city?.trim()
      if (!city) continue
      // "Netherlands" en provincienamen staan in address_city/company_city
      // van geïmporteerde rijen. Als plaatsnaam in een zoekresultaat zijn
      // ze onzin, en de hubs filteren ze om dezelfde reden weg.
      if (CITY_DENYLIST.has(city.toLowerCase().replace(/\s+/g, "-"))) continue
      perCity.set(city, (perCity.get(city) ?? 0) + 1)
    }
    const ranked = [...perCity.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    return {
      companies: data.length,
      topCities: ranked.slice(0, 2).map(([city]) => city),
      otherCities: Math.max(0, ranked.length - 2),
    }
  } catch {
    return empty
  }
}

export type ProDetailFacts = { types: string[]; cities: string[] }

/**
 * Wat één bedrijf gebouwd heeft en waar.
 *
 * Via project_professionals, want mv_project_summary draagt geen
 * bedrijf-id. Gepubliceerd werk alleen: een concept in de
 * zoekomschrijving beloven is precies de claim die Arco niet maakt.
 *
 * Maximaal drie typen en twee plaatsen — dat is wat er binnen de ~155
 * tekens past naast de bedrijfsnaam, die er twee keer in staat.
 */
export async function fetchProDetailFacts(companyId: string, locale: string): Promise<ProDetailFacts> {
  const empty: ProDetailFacts = { types: [], cities: [] }
  try {
    const supabase = createServiceRoleSupabaseClient()
    const { data, error } = await supabase
      .from("project_professionals")
      .select("projects!inner(status, building_type, address_city)")
      .eq("company_id", companyId)
      .eq("projects.status", "published")
    if (error || !data) return empty

    const perType = new Map<string, number>()
    const perCity = new Map<string, number>()
    for (const row of data) {
      const p = (row as { projects: { building_type: string | null; address_city: string | null } | null }).projects
      if (!p) continue
      const type = p.building_type?.trim()
      // Meervoud en kleine letter: de labels zijn gemaakt voor een kop
      // ("Villa's"), hier staan ze midden in een zin.
      const label = type ? TYPE_LABELS[type]?.[locale === "nl" ? "nl" : "en"]?.toLowerCase() : undefined
      if (label) perType.set(label, (perType.get(label) ?? 0) + 1)
      const city = p.address_city?.trim()
      if (city && !CITY_DENYLIST.has(city.toLowerCase().replace(/\s+/g, "-"))) {
        perCity.set(city, (perCity.get(city) ?? 0) + 1)
      }
    }
    const rank = (m: Map<string, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k)
    return { types: rank(perType).slice(0, 3), cities: rank(perCity).slice(0, 2) }
  } catch {
    return empty
  }
}
