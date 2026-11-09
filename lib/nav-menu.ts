import "server-only"

import { unstable_cache } from "next/cache"

import { getHubs, SPACE_HUB_DEFS } from "@/lib/project-hubs"
import { getProfessionalHubs, servicePlural } from "@/lib/professional-hubs"
import { PROVINCES, cityLabel } from "@/lib/provinces"
import { typeLabel, scopeLabel, spaceNoun } from "@/lib/type-labels"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { categoryLabel, categoryTree, getCatalogCategories, getCatalogSeries } from "@/lib/products/catalog"

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
 * /professionals, zodat de drie niet uit elkaar kunnen lopen. De cache
 * is de gedeelde datacache van Next (unstable_cache), niet alleen het
 * geheugen van één proces: op Vercel bouwt anders elke nieuwe instantie
 * het menu opnieuw, en dat is precies de hover waarop je wacht.
 */

export type NavMenuLink = { href: string; label: string }
export type NavMenuColumn = { label: string; href?: string; links: NavMenuLink[] }
export type NavMenu = { columns: NavMenuColumn[]; allHref: string; allLabel: string }
export type NavMenus = { projects: NavMenu; professionals: NavMenu; products: NavMenu }

/** Hoeveel links een kolom hoogstens toont: acht rijen onder de titel,
 *  in elke kolom van beide menu's, zodat de panelen even hoog zijn.
 *  Daarboven leest het als een lijst in plaats van als een keuze, en de
 *  volledige lijst staat al in Populaire zoekopdrachten onder aan de
 *  pagina. */
const COLUMN_CAP = 8

/**
 * Een kolom. Past de hele lijst, dan draagt hij zijn gewone naam; is hij
 * afgekapt, dan zegt de titel dat ("Populaire locaties") — de lezer
 * hoort te weten dat er meer is dan hij ziet. Wie afkapt moet dus op
 * populariteit gesorteerd aanleveren.
 */
function column(label: string, popularLabel: string, all: NavMenuLink[], href?: string): NavMenuColumn {
  const truncated = all.length > COLUMN_CAP
  return { label: truncated ? popularLabel : label, href, links: all.slice(0, COLUMN_CAP) }
}

/** Vaste volgorde van de dienstgroepen — redactioneel, niet op aantal.
 *  Ontwerp eerst omdat dat de ingang is; installaties achteraan. */
const PRO_GROUP_ORDER = ["design-planning", "construction", "finishing", "outdoor-garden", "systems"]

async function buildNavMenus(locale: string): Promise<NavMenus> {
  const nl = locale === "nl"
  // Service-role, niet de cookie-client: binnen unstable_cache mag
  // cookies() niet, en de hubs tellen alleen publieke rijen.
  const supabase = createServiceRoleSupabaseClient()
  const [projectHubs, proHubs, categories, catalogSeries] = await Promise.all([
    getHubs(supabase),
    getProfessionalHubs(supabase),
    getCatalogCategories(),
    getCatalogSeries(),
  ])

  // ── Projecten: vier assen ─────────────────────────────────────────
  // Ruimtes: de redactionele selectie in vaste volgorde (SPACE_HUB_DEFS
  // featured) — dezelfde acht als de cirkels op de discover.
  const spaceOrder = new Map(SPACE_HUB_DEFS.map((d, i) => [d.space, i]))
  const spaceLink = (h: { slug: string; spaceValue?: string | null }) => ({ href: `/projects/${h.slug}`, label: spaceNoun(h.spaceValue ?? h.slug, locale) })
  const spaces = projectHubs.spaces
    .filter((h) => h.featured)
    .sort((a, b) => (spaceOrder.get(a.spaceValue ?? "") ?? 99) - (spaceOrder.get(b.spaceValue ?? "") ?? 99))
    .map(spaceLink)

  const types = projectHubs.types
    .slice()
    .sort((a, b) => b.count - a.count)
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
  const places = provinces

  // ── Professionals: de vijf dienstgroepen ──────────────────────────
  // Een groep rendert alleen als er een dienst in zit die zijn eigen hub
  // haalt. Installaties heeft vandaag nul bedrijven en Buiten & Tuin
  // één; een kolom met niets erin is geen navigatie. Ze verschijnen
  // vanzelf zodra er drie bedrijven in een dienst staan.
  const serviceHubs = proHubs.filter((h) => h.kind === "service")
  const byGroup = new Map<string, { label: string; links: Array<NavMenuLink & { count: number }> }>()
  for (const hub of serviceHubs) {
    const groupSlug = hub.categorySlug
    if (!groupSlug) continue
    // Fotografen staan niet in dit menu: zij zijn het andere publiek
    // (audience 'pro', /businesses/photography), niet wie een
    // huiseigenaar hier zoekt.
    if ((hub.serviceSlug ?? hub.slug) === "photographer") continue
    const label = (nl ? hub.categoryNameNl : hub.categoryName) ?? hub.categoryName ?? groupSlug
    const entry = byGroup.get(groupSlug) ?? { label, links: [] }
    entry.links.push({
      href: `/professionals/${hub.slug}`,
      // Dezelfde naam als op de kaarten op home en in de hubtitels.
      label: servicePlural(hub, locale),
      // count blijft buiten het label: een getal in de hoofdnavigatie
      // veroudert zodra de voorraad beweegt en de pagina zegt het zelf.
      // Hij sorteert wel, zodra een groep moet afkappen.
      count: hub.count,
    })
    byGroup.set(groupSlug, entry)
  }
  const proColumns: NavMenuColumn[] = PRO_GROUP_ORDER.filter((slug) => byGroup.has(slug)).map((slug) => {
    const group = byGroup.get(slug)!
    // Compleet: alfabetisch. Afgekapt: de populairste, want dan heet
    // de kolom "Populair in …".
    const ordered = group.links.length > COLUMN_CAP
      ? group.links.slice().sort((a, b) => b.count - a.count)
      : group.links.slice().sort((a, b) => a.label.localeCompare(b.label))
    const links = ordered.map(({ href, label }) => ({ href, label }))
    const popular = nl ? `Populair in ${group.label.toLowerCase()}` : `Popular in ${group.label.toLowerCase()}`
    // De groepskop is geen link: de groep is een indeling van het menu,
    // geen pagina die iemand zoekt. De diensten eronder zijn de ingangen.
    return column(group.label, popular, links)
  })

  // ── Producten: de zes hoofdgroepen, met de soorten eronder ──────────
  // Rijen zijn soorten, geen merken of series: een serienaam zegt niets
  // zonder merk, en één merk zou een kolom vullen. Alleen soorten waar
  // een serie in staat; een lege groep rendert niet. De groepskop linkt
  // wél — de groepspagina (alle verlichting) is een ingang die mensen
  // zoeken, anders dan een dienstgroep.
  const tree = categoryTree(categories)
  const seriesIn = (id: string) => {
    const ids = tree.subtreeIds(id)
    return catalogSeries.filter((s) => s.categoryId && ids.has(s.categoryId)).length
  }
  const productColumns: NavMenuColumn[] = tree.roots
    .map((group) => {
      const kinds = tree.children(group.id).map((k) => ({ k, n: seriesIn(k.id) })).filter((x) => x.n > 0)
      const ordered = kinds.length > COLUMN_CAP ? kinds.slice().sort((a, b) => b.n - a.n) : kinds
      const links = ordered.map(({ k }) => ({ href: `/products/${k.slug}`, label: categoryLabel(k, locale) }))
      const label = categoryLabel(group, locale)
      return column(label, nl ? `Populair in ${label.toLowerCase()}` : `Popular in ${label.toLowerCase()}`, links, `/products/${group.slug}`)
    })
    .filter((c) => c.links.length > 0)

  return {
    projects: {
      columns: [
        column(nl ? "Ruimtes" : "Rooms", nl ? "Populaire ruimtes" : "Popular rooms", spaces),
        column(nl ? "Woningtype" : "Home type", nl ? "Populaire woningtypen" : "Popular home types", types),
        column(nl ? "Projectscope" : "Project scope", nl ? "Populaire projectscopes" : "Popular project scopes", scopes),
        column(nl ? "Locatie" : "Location", nl ? "Populaire locaties" : "Popular locations", places),
      ].filter((c) => c.links.length > 0),
      allHref: "/projects",
      allLabel: nl ? "Alle projecten" : "All projects",
    },
    professionals: {
      columns: proColumns,
      allHref: "/professionals",
      allLabel: nl ? "Alle professionals" : "All professionals",
    },
    products: {
      columns: productColumns,
      allHref: "/products",
      allLabel: nl ? "Alle producten" : "All products",
    },
  }
}

/**
 * Twee lagen. De gedeelde datacache van Next (unstable_cache, vijf
 * minuten, per locale) zodat een verse serverless-instantie het menu
 * kant-en-klaar krijgt in plaats van het zelf op te bouwen; daarvóór
 * een procesgeheugen voor de hete weg binnen één instantie. Daarboven
 * legt de Cache-Control van de route het antwoord nog bij de CDN.
 */
const TTL_MS = 5 * 60 * 1000
const memo = new Map<string, { at: number; value: Promise<NavMenus> }>()

const cachedNavMenus = unstable_cache(buildNavMenus, ["nav-menus"], { revalidate: 300, tags: ["nav-menus"] })

export function getNavMenus(locale: string): Promise<NavMenus> {
  const hit = memo.get(locale)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value
  const value = cachedNavMenus(locale).catch((err) => {
    // Een mislukte vraag mag niet blijven plakken: anders serveert de
    // header vijf minuten lang dezelfde fout.
    memo.delete(locale)
    throw err
  })
  memo.set(locale, { at: Date.now(), value })
  return value
}
