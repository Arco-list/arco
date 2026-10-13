/**
 * Welk soort pagina is dit, en bij welke groep hoort dat.
 *
 * Geen server-only: de adminpagina heeft dezelfde labels en dezelfde
 * groepering nodig als de sync die de rijen wegschrijft. Eén vocabulaire
 * voor beide kanten.
 *
 * NIET OP URL-PATROON TE DOEN. Een hubpagina en een bedrijfsprofiel
 * hebben dezelfde vorm — /nl/professionals/amsterdam naast
 * /nl/professionals/wolterinck-com — dus alleen een vergelijking met
 * onze eigen sluglijsten scheidt ze. Dat is geen detail: in de week van
 * 24 augustus stonden er 8.234 vertoningen op de hubs (gemiddeld
 * positie 67) tegen 270 op de profielen (positie 8,3), en elk
 * gemiddelde over "/professionals/" smolt die twee samen tot een getal
 * dat geen van beide beschreef.
 */

/** De negen typen die worden opgeslagen. */
export const PAGE_TYPES = [
  "proHub",
  "ovBedrijven",
  "bedrijfsprofiel",
  "projectpagina",
  "projectHub",
  "ovProjecten",
  "home",
  "arcoOverig",
  "overig",
] as const

export type PageType = (typeof PAGE_TYPES)[number]

/**
 * De regels van de tabel, in leesvolgorde.
 *
 * Dit WAS een laag van vijf groepen boven de negen typen, waarbij het
 * overzicht en de hubs samen één regel vormden. Dat verborg het enige
 * bruikbare signaal in de tabel: /professionals levert met twee pagina's
 * 18 kliks, de 62 hubs eronder leveren er 7. Eén regel voor allebei komt
 * uit op 0,19% en beschrijft alleen de hubs, want die brengen 78% van de
 * vertoningen mee. Hetzelfde argument als bovenaan dit bestand, één
 * niveau hoger.
 *
 * Dus: één regel per type. De groepslaag blijft als naam bestaan omdat
 * de tabel ermee rendert, maar hij is nu één-op-één.
 */
export const PAGE_GROUPS = [
  "home",
  "arcoOverig",
  "ovBedrijven",
  "proHub",
  "bedrijfsprofiel",
  "ovProjecten",
  "projectHub",
  "projectpagina",
  "overig",
] as const satisfies readonly PageType[]

export type PageGroup = PageType

export const GROUP_OF: Record<PageType, PageGroup> = {
  home: "home",
  arcoOverig: "arcoOverig",
  ovBedrijven: "ovBedrijven",
  proHub: "proHub",
  bedrijfsprofiel: "bedrijfsprofiel",
  ovProjecten: "ovProjecten",
  projectHub: "projectHub",
  projectpagina: "projectpagina",
  overig: "overig",
}

export const GROUP_LABEL: Record<PageGroup, string> = {
  home: "Arco home",
  arcoOverig: "Arco pages",
  ovBedrijven: "Pro discover",
  proHub: "Pro hub",
  bedrijfsprofiel: "Pro detail",
  ovProjecten: "Project discover",
  projectHub: "Project hub",
  projectpagina: "Project detail",
  overig: "Restbak",
}

/** Wat er precies onder valt — de tekst achter het i'tje in de tabel. */
export const GROUP_DEF: Record<PageGroup, string> = {
  home: "De homepagina, één per taal.",
  arcoOverig: "Vaste pagina's die we met de hand schrijven: over ons, prijzen, voorwaarden, hulp. Niet uit data gegenereerd.",
  ovBedrijven: "/professionals zonder filter — het kale overzicht, één pagina per taal.",
  proHub: "/professionals/{slug} waar de slug géén bedrijf is: een plaats, provincie, dienst of categorie. Programmatisch gegenereerd.",
  bedrijfsprofiel: "/professionals/{slug} waar de slug wél een bedrijf is. Eén pagina per bureau.",
  ovProjecten: "/projects zonder filter — het kale overzicht.",
  projectHub: "/projects/{slug} waar de slug géén project is: een plaats, type of ruimte. Programmatisch gegenereerd.",
  projectpagina: "/projects/{slug} waar de slug wél een project is. Eén pagina per project.",
  overig: "Alles wat nergens onder valt, plus elke URL met een querystring. Hoort leeg te zijn: wat hier staat is niet geclassificeerd, of het hoort niet geïndexeerd te worden.",
}

/** De brede indeling waarop de tabellen filteren. */
export const MARKET_SIDE: Record<PageGroup, "pro" | "project" | "arco" | "restbak"> = {
  home: "arco",
  arcoOverig: "arco",
  ovBedrijven: "pro",
  proHub: "pro",
  bedrijfsprofiel: "pro",
  ovProjecten: "project",
  projectHub: "project",
  projectpagina: "project",
  overig: "restbak",
}

/**
 * Vaste, niet-dynamische Arco-pagina's. Alles wat hier niet in staat en
 * geen bedrijf of project is, valt in 'overig' — dat is de bedoeling.
 */
const ARCO_PATHS = new Set([
  "about", "pricing", "businesses", "list-with-us", "help-center",
  "privacy", "terms", "homeowner", "photographers", "products", "brands",
  "styles", "components", "brands",
])

const LOCALES = new Set(["nl", "en"])

export type SlugSets = { companies: Set<string>; projects: Set<string> }

/**
 * Deelt één Search Console-URL in.
 *
 * EEN URL MET EEN QUERYSTRING KRIJGT BEWUST 'overig'. /projects?
 * location=Amsterdam is niet dezelfde pagina als /projects — hij toont
 * andere projecten — en hij is ook geen pagina die wij aanbieden: hij
 * is een dubbeling van de hub /projects/amsterdam, die wel bestaat. Hem
 * bij het overzicht optellen zou die dubbeling precies onzichtbaar
 * maken. Tot de canonical naar de juiste hub wijst hoort hij in het
 * alarm, niet in een nette rij.
 */
export function classifyPageType(url: string, slugs: SlugSets): PageType {
  const path = url.replace(/^https?:\/\/[^/]+/, "")
  if (path.includes("?") || path.includes("#")) return "overig"

  const seg = path.replace(/\/+$/, "").split("/").filter(Boolean)
  const i = LOCALES.has(seg[0]) ? 1 : 0
  const head = seg[i]
  const second = seg[i + 1]
  const depth = seg.length - i

  if (!head) return "home"

  if (head === "professionals") {
    if (depth === 1) return "ovBedrijven"
    return second && slugs.companies.has(second) ? "bedrijfsprofiel" : "proHub"
  }
  if (head === "projects") {
    if (depth === 1) return "ovProjecten"
    return second && slugs.projects.has(second) ? "projectpagina" : "projectHub"
  }
  if (ARCO_PATHS.has(head)) return "arcoOverig"
  return "overig"
}
