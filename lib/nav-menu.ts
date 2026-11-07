import "server-only"

import { getHubs, SPACE_HUB_DEFS } from "@/lib/project-hubs"
import { getProfessionalHubs, servicePluralBySlug } from "@/lib/professional-hubs"
import { PROVINCES, cityLabel } from "@/lib/provinces"
import { typeLabel, scopeLabel, spaceNoun } from "@/lib/type-labels"

/**
 * De twee uitklapmenu's in de header, gebouwd uit dezelfde
 * voorraad-gated hubs als de routes en de sitemap.
 *
 * Waarom uit de hubs en niet uit een handgeschreven lijst: een link in
 * de header staat op élke pagina. Een hub die onder zijn drempel zakt
 * verdwijnt uit de routes, en een handgeschreven menu zou hem blijven
 * noemen — een 404 in de hoofdnavigatie van de hele site. Nu groeit en
 * krimpt het menu mee met wat er echt staat.
 *
 * Gecachet, want de header hangt onder 42 verschillende pagina's en
 * geen daarvan hoort hiervoor een databasevraag te betalen. Vijf
 * minuten, dezelfde horizon als de revalidate van /projects en
 * /professionals, zodat de drie niet uit elkaar kunnen lopen.
 */

export type NavMenuLink = { href: string; label: string }
export type NavMenuColumn = { label: string; href?: string; links: NavMenuLink[] }
export type NavMenu = { columns: NavMenuColumn[]; allHref: string; allLabel: string }
export type NavMenus = { projects: NavMenu; professionals: NavMenu }

/** Hoeveel links een kolom hoogstens toont. Daarboven leest het als een
 *  lijst in plaats van als een keuze, en de volledige lijst staat al in
 *  Populaire zoekopdrachten onder aan de pagina. */
const COLUMN_CAP = 10

/** Vaste volgorde van de dienstgroepen — redactioneel, niet op aantal.
 *  Ontwerp eerst omdat dat de ingang is; installaties achteraan. */
const PRO_GROUP_ORDER = ["design-planning", "construction", "finishing", "outdoor-garden", "systems"]

async function buildNavMenus(locale: string): Promise<NavMenus> {
  const nl = locale === "nl"
  const [projectHubs, proHubs] = await Promise.all([getHubs(), getProfessionalHubs()])

  // ── Projecten: vier assen ─────────────────────────────────────────
  const spaceOrder = new Map(SPACE_HUB_DEFS.map((d, i) => [d.space, i]))
  const spaces = projectHubs.spaces
    .slice()
    .sort((a, b) => (spaceOrder.get(a.spaceValue ?? "") ?? 99) - (spaceOrder.get(b.spaceValue ?? "") ?? 99))
    .map((h) => ({ href: `/projects/${h.slug}`, label: spaceNoun(h.spaceValue ?? h.slug, locale) }))

  const types = projectHubs.types
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, COLUMN_CAP)
    .map((h) => ({ href: `/projects/${h.slug}`, label: typeLabel(h.typeValue ?? h.slug, locale) }))

  const scopes = projectHubs.scopes.map((h) => ({
    href: `/projects/${h.slug}`,
    label: h.scope ? scopeLabel(h.scope, locale) : h.slug,
  }))

  // Provincies eerst, dan de grootste steden: de provincie dekt altijd
  // meer dan de stad eronder, dus hij hoort bovenaan ook al telt een
  // losse stad soms hoger.
  const provinces = projectHubs.provinces
    .slice()
    .sort((a, b) => b.count - a.count)
    .map((h) => ({
      href: `/projects/${h.slug}`,
      label: PROVINCES[h.name] ? (nl ? PROVINCES[h.name].nl : PROVINCES[h.name].en) : h.name,
    }))
  const cities = projectHubs.cities
    .slice()
    .sort((a, b) => b.count - a.count)
    .map((h) => ({ href: `/projects/${h.slug}`, label: cityLabel(h.name, locale) }))
  // ALLEEN PROVINCIES, geen steden ertussen.
  //
  // De andere drie kolommen zijn compleet — alle ruimtes, alle
  // woningtypen, alle scopes. Een gemengde locatiekolom was dat niet:
  // tien namen uit vierentwintig, en wie Bloemendaal zocht leerde dat
  // het menu onbetrouwbaar is. Een kolom die voor de meeste bezoekers
  // het verkeerde antwoord geeft is slechter dan geen kolom.
  //
  // Twee problemen verdwijnen er bovendien mee. Provincies en steden
  // stonden door elkaar zonder enig teken dat het twee niveaus zijn.
  // En "Huizen" stond als plaatsnaam één kolom naast Villa's,
  // Appartementen en Stadswoningen — daar leest niemand een dorp.
  //
  // Steden liggen één klik verder, op de provinciepagina, waar het
  // kruimelpad een "Kies plaats" draagt die álle plaatsen kent.
  const places = provinces.slice(0, COLUMN_CAP)

  // ── Professionals: de vijf dienstgroepen ──────────────────────────
  // Een groep rendert alleen als er een dienst in zit die zijn eigen hub
  // haalt. Installaties heeft vandaag nul bedrijven en Buiten & Tuin
  // één; een kolom met niets erin is geen navigatie. Ze verschijnen
  // vanzelf zodra er drie bedrijven in een dienst staan.
  const serviceHubs = proHubs.filter((h) => h.kind === "service")
  const categoryHubs = new Map(proHubs.filter((h) => h.kind === "category").map((h) => [h.categorySlug ?? h.slug, h]))
  const byGroup = new Map<string, { label: string; links: NavMenuLink[] }>()
  for (const hub of serviceHubs) {
    const groupSlug = hub.categorySlug
    if (!groupSlug) continue
    const label = (nl ? hub.categoryNameNl : hub.categoryName) ?? hub.categoryName ?? groupSlug
    const entry = byGroup.get(groupSlug) ?? { label, links: [] }
    entry.links.push({
      href: `/professionals/${hub.slug}`,
      label: servicePluralBySlug(hub.serviceSlug ?? hub.slug, locale, nl ? hub.serviceNameNl : hub.serviceName),
      // count blijft buiten het label: een getal in de hoofdnavigatie
      // veroudert zodra de voorraad beweegt en de pagina zegt het zelf.
    })
    byGroup.set(groupSlug, entry)
  }
  const proColumns: NavMenuColumn[] = PRO_GROUP_ORDER.filter((slug) => byGroup.has(slug)).map((slug) => {
    const group = byGroup.get(slug)!
    const catHub = categoryHubs.get(slug)
    return {
      label: group.label,
      href: catHub ? `/professionals/${catHub.slug}` : undefined,
      links: group.links.sort((a, b) => a.label.localeCompare(b.label)).slice(0, COLUMN_CAP),
    }
  })

  return {
    projects: {
      columns: [
        { label: nl ? "Ruimtes" : "Rooms", links: spaces },
        { label: nl ? "Woningtype" : "Home type", links: types },
        { label: nl ? "Projectscope" : "Project scope", links: scopes },
        { label: nl ? "Locatie" : "Location", links: places },
      ].filter((c) => c.links.length > 0),
      allHref: "/projects",
      allLabel: nl ? "Alle projecten" : "All projects",
    },
    professionals: {
      columns: proColumns,
      allHref: "/professionals",
      allLabel: nl ? "Alle professionals" : "All professionals",
    },
  }
}

/**
 * Procesgeheugen, geen unstable_cache: getHubs() praat via de
 * cookie-gebonden Supabase-client, en een dynamische API als cookies()
 * mag binnen unstable_cache niet. Dit is de cache die wél kan zonder
 * die twee functies te verbouwen — en de echte winst zit toch in de
 * Cache-Control op de route erboven, die het antwoord bij de CDN legt.
 */
const TTL_MS = 5 * 60 * 1000
const memo = new Map<string, { at: number; value: Promise<NavMenus> }>()

export function getNavMenus(locale: string): Promise<NavMenus> {
  const hit = memo.get(locale)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value
  const value = buildNavMenus(locale).catch((err) => {
    // Een mislukte vraag mag niet blijven plakken: anders serveert de
    // header vijf minuten lang dezelfde fout.
    memo.delete(locale)
    throw err
  })
  memo.set(locale, { at: Date.now(), value })
  return value
}
