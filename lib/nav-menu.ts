import "server-only"

import { unstable_cache } from "next/cache"

import { getHubs, SPACE_HUB_DEFS } from "@/lib/project-hubs"
import { getProfessionalHubs, proNamePluralOf, servicePlural } from "@/lib/professional-hubs"
import { PROVINCES, cityLabel } from "@/lib/provinces"
import { typeLabel, scopeLabel, spaceNoun } from "@/lib/type-labels"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { activeCategories, categoryLabel, categoryTree, getCatalogCategories } from "@/lib/products/catalog"

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
  const [projectHubs, proHubs, categories] = await Promise.all([
    getHubs(supabase),
    getProfessionalHubs(supabase),
    getCatalogCategories(),
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

  // ── Professionals: alle dienstgroepen met al hun diensten ──────────
  // De hele indeling uit de taxonomie, niet alleen de diensten met een
  // eigen hub: wie een dakdekker zoekt, hoort te zien dat Arco die kent.
  // Een dienst met een hub (genoeg bedrijven) linkt naar die pagina; de
  // rest naar /professionals, gefilterd op die dienst (?services=slug,
  // dezelfde token als het filter). Geen afkapping: alle diensten, in de
  // volgorde van het filter, ook in een groep met meer dan acht.
  const hubByService = new Map(proHubs.filter((h) => h.kind === "service").map((h) => [h.serviceSlug ?? h.slug, h]))
  const { data: serviceRows } = await supabase
    .from("categories")
    .select("id, slug, name, name_nl, parent_id, pro_name_plural, pro_name_plural_nl, audience, is_active, sort_order")
    .eq("is_active", true)
  const taxonomy = (serviceRows ?? []) as Array<{ id: string; slug: string; name: string; name_nl: string | null; parent_id: string | null; pro_name_plural: string | null; pro_name_plural_nl: string | null; audience: string | null; sort_order: number | null }>
  // Dezelfde volgorde als het filter op /professionals (professionals-
  // filter-bar): groepen en diensten op sort_order uit de taxonomie, bij
  // gelijke stand op de (Engelse) naam.
  const bySortOrder = (a: { sort_order: number | null; name: string }, b: { sort_order: number | null; name: string }) =>
    (a.sort_order ?? 99) - (b.sort_order ?? 99) || (a.name ?? "").localeCompare(b.name ?? "")
  const groups = taxonomy.filter((c) => !c.parent_id && PRO_GROUP_ORDER.includes(c.slug)).sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99))
  const proColumns: NavMenuColumn[] = groups
    .map((group) => {
      const links = taxonomy
        // Fotografen staan niet in dit menu: zij zijn het andere publiek
        // (audience 'pro', /businesses/photography), niet wie een
        // huiseigenaar hier zoekt.
        .filter((c) => c.parent_id === group.id && c.audience !== "pro")
        .sort(bySortOrder)
        .map((c) => {
          const hub = hubByService.get(c.slug)
          return {
            href: hub ? `/professionals/${hub.slug}` : `/professionals?services=${encodeURIComponent(c.slug)}`,
            // Dezelfde naam als op de kaarten op home en in de hubtitels.
            label: hub ? servicePlural(hub, locale) : proNamePluralOf(c, locale),
          }
        })
      // De groepskop is geen link: de groep is een indeling van het menu,
      // geen pagina die iemand zoekt. De diensten eronder zijn de ingangen.
      const label = (nl ? group.name_nl : null) ?? group.name
      return links.length ? { label, links } : null
    })
    .filter((c): c is NavMenuColumn => Boolean(c))

  // ── Producten: de zeven hoofdgroepen, met al hun subgroepen eronder ──
  // Rijen zijn subgroepen (tweede niveau), geen merken of collecties: een
  // collectienaam zegt niets zonder merk. Alle actieve subgroepen, ook
  // zonder collecties, in de volgorde van de indeling en niet afgekapt: het
  // menu toont de hele indeling (hooguit negen per groep, migratie 351). De
  // groepskop linkt wél — de groepspagina (alle verlichting) is een ingang
  // die mensen zoeken, anders dan een dienstgroep.
  const tree = categoryTree(activeCategories(categories))
  const productColumns: NavMenuColumn[] = tree.roots
    .map((group) => ({
      label: categoryLabel(group, locale),
      href: `/products/${group.slug}`,
      links: tree.children(group.id).map((k) => ({ href: `/products/${k.slug}`, label: categoryLabel(k, locale) })),
    }))

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

// v2: het professionalsmenu toont alle diensten uit de taxonomie (niet
// alleen die met een hub); een nieuwe sleutel zodat de oude vorm niet blijft hangen.
const cachedNavMenus = unstable_cache(buildNavMenus, ["nav-menus-v5"], { revalidate: 300, tags: ["nav-menus"] })

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
