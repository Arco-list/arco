/**
 * Elke titel en omschrijving die in een zoekresultaat kan belanden, op
 * één plek.
 *
 * Deze bestandsnaam is het codetegenhanger van de formuletabel op
 * /admin/brand?tab=seo. Daar wordt besloten, hier staat het geschreven,
 * en /admin/seo meet wat het doet. Stond het verspreid over acht
 * route-bestanden, dan was dat niet te controleren — en precies zo
 * kwamen er vijf pagina's met LETTERLIJK dezelfde titel als de
 * homepage.
 *
 * Twee budgetten die de hele vorm bepalen:
 *
 * - TITEL ~60 tekens. Google rekent in pixels, niet in tekens, dus 60
 *   is een vuistregel en geen grens. Zoekvraag eerst, claim tweede.
 * - OMSCHRIJVING ~155-160 tekens op desktop. Op mobiel valt de laatste
 *   zin er hoe dan ook af, dus de belangrijkste belofte hoort nooit
 *   achteraan.
 *
 * De drie beloftes staan overal in dezelfde volgorde als de eyebrow op
 * de homepage: het werk is gerealiseerd, het team is vermeld, je kunt
 * ze rechtstreeks benaderen. Wie hier een zin wijzigt, wijzigt hem in
 * het merkdocument mee — anders lopen de twee uit elkaar en is geen van
 * beide meer de bron.
 *
 * De Arco-pagina's staan onderaan. Die hebben geen formule — ze zijn
 * met de hand geschreven volgens {Onderwerp} — {belofte van die
 * pagina} — maar ze horen hier wel, want anders staan ze verspreid
 * over negen route-bestanden en is niet te zien dat vijf ervan
 * dezelfde titel voerden.
 */

const isNl = (locale: string) => locale === "nl"

/** "Amsterdam, Rotterdam en 88 andere plaatsen" — de staart alleen als
 *  er iets te staarten is, en in het enkelvoud als het er één is. */
function placeList(locale: string, top: string[], others: number): string {
  const nl = isNl(locale)
  const head = top.length === 2 ? `${top[0]}, ${top[1]}` : top.join("")
  if (others <= 0) return head
  const tail = nl
    ? others === 1 ? "één andere plaats" : `${others} andere plaatsen`
    : others === 1 ? "one other place" : `${others} other places`
  return `${head} ${nl ? "en" : "and"} ${tail}`
}

/** "villa's, verbouwingen en interieurs" — Oxfordloos, zoals de rest
 *  van de site. */
function andList(locale: string, items: string[]): string {
  const and = isNl(locale) ? "en" : "and"
  if (items.length <= 1) return items[0] ?? ""
  return `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`
}

// ─── Arco home ───────────────────────────────────────────────────────
// De enige pagina waar de claim alleen staat, zonder zoekvraag ervoor:
// dit is merkverkeer, 1,6% van de vertoningen en bijna de helft van alle
// kliks. Het merk mag hier dus wél vooraan — op elke andere pagina
// verspilt het de pixels die de paginanaam nodig heeft.

export function homeTitle(locale: string): string {
  return isNl(locale)
    ? "Arco — het netwerk achter uitzonderlijke architectuur"
    : "Arco — the network behind exceptional architecture"
}

export function homeDescription(locale: string, projects: number | null): string {
  const n = projects?.toLocaleString(isNl(locale) ? "nl-NL" : "en-US")
  if (isNl(locale)) {
    return n
      ? `Ontdek ${n} gerealiseerde projecten, professioneel gefotografeerd. Vind het hele team erachter, van interieurarchitect tot aannemer. Benader ze rechtstreeks.`
      : "Ontdek gerealiseerde architectuurprojecten, professioneel gefotografeerd. Vind het hele team erachter, van interieurarchitect tot aannemer. Benader ze rechtstreeks."
  }
  return n
    ? `Explore ${n} built architecture projects, professionally photographed. Find the whole team behind them, from interior designer to contractor. Connect directly.`
    : "Explore built architecture projects, professionally photographed. Find the whole team behind them, from interior designer to contractor. Connect directly."
}

// ─── Pro discover — /professionals ───────────────────────────────────
// Samen met project discover 18 kliks: meer dan de 62 hubs eronder bij
// elkaar. De oude titel was niet slecht, hij noemde alleen geen enkel
// cijfer van de pagina zelf.

export function proDiscoverTitle(locale: string): string {
  return isNl(locale)
    ? "Architecten en vakmensen in Nederland met opgeleverd werk"
    : "Dutch architects and specialists with delivered work"
}

export function proDiscoverDescription(
  locale: string,
  facts: { companies: number | null; topCities: string[]; otherCities: number },
): string {
  const nl = isNl(locale)
  const n = facts.companies?.toLocaleString(nl ? "nl-NL" : "en-US")
  const where = facts.topCities.length > 0
    ? placeList(locale, facts.topCities, facts.otherCities)
    : null
  if (nl) {
    const first = n ? `Vind ${n} professionals, van interieurarchitect tot aannemer.` : "Vind architecten en vakmensen, van interieurarchitect tot aannemer."
    const second = where ? ` Ontdek hun projecten in ${where}.` : " Ontdek hun gerealiseerde projecten."
    return `${first}${second} Benader ze rechtstreeks.`
  }
  const first = n ? `Find ${n} professionals, from interior designer to contractor.` : "Find architects and specialists, from interior designer to contractor."
  const second = where ? ` Explore their projects in ${where}.` : " Explore their built projects."
  return `${first}${second} Connect with them directly.`
}

// ─── Pro hub — /professionals/{hub} ──────────────────────────────────
// 63% van alle vertoningen, 0,07% CTR. Dit is het dekkingsgevecht dat
// van partijen met twintig keer meer vermeldingen wordt verloren, en de
// strategie is de hubs te laten lopen — niet de overzichten. De titel
// is hier dus geen investering maar hygiëne: hij noemde tot nu toe
// hetzelfde als het overzicht erboven, zodat de twee om dezelfde
// zoekvraag concurreerden.

export function proHubTitle(locale: string, parts: { service: string; place: string }): string {
  const nl = isNl(locale)
  const base = `${parts.service} in ${parts.place}`
  const claim = nl ? " met opgeleverd werk" : " with delivered work"
  // De claim is het eerste dat sneuvelt als de dienstnaam lang is
  // ("Ontwerp en planning professionals in Noord-Holland"). Liever een
  // titel die heel wordt getoond dan een claim die halverwege afbreekt;
  // de omschrijving eronder draagt hem alsnog.
  return (base + claim).length > 60 ? base : base + claim
}

export function proHubDescription(
  locale: string,
  facts: { count: number; service: string; place: string; topCities?: string[]; otherCities?: number },
): string {
  const nl = isNl(locale)
  const service = facts.service.toLowerCase()
  // De stedenlijst uit de formule staat hier als optioneel slot. Een hub
  // die één stad beslaat kan hem niet dragen ("in Amsterdam, Amsterdam
  // en 0 andere plaatsen"), en de hubaggregator levert hem nog niet per
  // hub op aantal. Zonder lijst noemt hij de plaats één keer.
  const top = facts.topCities ?? []
  const others = facts.otherCities ?? 0
  const where = top.length > 0 && others > 0 ? placeList(locale, top, others) : facts.place
  // ~155 tekens. Korter liet Google het aanvullen met geschraapte
  // kruimelpaden en footertekst ("Professionals/Nederland/ Arco Global
  // BV."), en dan staat er niets van dit alles.
  if (nl) {
    return `Vind ${facts.count} ${service} in ${where}. Ontdek hun gerealiseerde projecten, professioneel gefotografeerd, en het team dat eraan werkte. Benader ze rechtstreeks.`
  }
  return `Find ${facts.count} ${service} in ${where}. Explore their built projects, professionally photographed, and the team that worked on them. Connect with them directly.`
}

// ─── Pro detail — /professionals/{bedrijf} ───────────────────────────
// Positie 8,5 met 0,51% CTR waar op die positie 2 à 3% hoort: geen
// rankingprobleem maar een titelprobleem. De kale bedrijfsnaam
// verspilde het slot — een naam die de zoeker net zelf heeft ingetypt
// voegt niets toe, de dienst en de plaats wel. De TITEL staat al in
// app/[locale]/professionals/[slug]/page.tsx; dit is de omschrijving,
// die tot nu toe de zelfgeschreven bedrijfstekst was en dus bij elk
// bedrijf iets anders beloofde.

export function proDetailDescription(
  locale: string,
  facts: { company: string; types: string[]; cities: string[] },
): string {
  const nl = isNl(locale)
  const what = facts.types.length > 0 ? `: ${andList(locale, facts.types)}` : ""
  const where = facts.cities.length > 0 ? ` in ${andList(locale, facts.cities)}` : ""
  if (nl) {
    return `Ontdek het werk van ${facts.company}, professioneel gefotografeerd${what}${where}. Benader ${facts.company} rechtstreeks.`
  }
  return `Explore the work of ${facts.company}, professionally photographed${what}${where}. Connect with ${facts.company} directly.`
}

// ─── Project discover — /projects ────────────────────────────────────
// "Bijzondere" stond hier als bijvoeglijk naamwoord zonder dekking; de
// cijfers zijn wel te controleren. Dit is de ingang die het merkverhaal
// letterlijk beschrijft.

export function projectDiscoverTitle(locale: string): string {
  return isNl(locale)
    ? "Gerealiseerde architectuurprojecten in Nederland"
    : "Built architecture projects in the Netherlands"
}

export function projectDiscoverDescription(locale: string, projects: number | null): string {
  const nl = isNl(locale)
  const n = projects?.toLocaleString(nl ? "nl-NL" : "en-US")
  if (nl) {
    return n
      ? `Ontdek ${n} gerealiseerde projecten, per ruimte gefotografeerd. Vind iedereen die eraan werkte, van interieurarchitect tot aannemer. Benader ze rechtstreeks.`
      : "Ontdek gerealiseerde projecten, per ruimte gefotografeerd. Vind iedereen die eraan werkte, van interieurarchitect tot aannemer. Benader ze rechtstreeks."
  }
  return n
    ? `Explore ${n} built projects, photographed room by room. Find everyone who worked on them, from interior designer to contractor. Connect with them directly.`
    : "Explore built projects, photographed room by room. Find everyone who worked on them, from interior designer to contractor. Connect with them directly."
}

// ─── Project hub — /projects/{hub} ───────────────────────────────────
// 76 pagina's, zes kliks. De titel had bijna dezelfde vorm als het
// overzicht erboven, dus de twee concurreerden om dezelfde zoekvraag.
// "Gerealiseerde" vooraan maakt het verschil zichtbaar en draagt de
// claim meteen.

export function projectHubTitle(locale: string, parts: { what: string; place: string }): string {
  return isNl(locale)
    ? `Gerealiseerde ${parts.what} in ${parts.place}`
    : `Built ${parts.what} in ${parts.place}`
}

export function projectHubDescription(
  locale: string,
  facts: { count: number; what: string; place: string; topTypes?: string[] },
): string {
  const nl = isNl(locale)
  // Optioneel slot, net als de stedenlijst bij de pro hub: de
  // typenlijst uit de formule vraagt een telling per hub die
  // getHubs() nog niet bijhoudt. Zonder lijst draagt de tweede zin de
  // belofte.
  const types = facts.topTypes ?? []
  if (types.length > 0) {
    return nl
      ? `Ontdek ${facts.count} gerealiseerde ${facts.what} in ${facts.place}: ${andList(locale, types)}. Vind iedereen die eraan werkte. Benader ze rechtstreeks.`
      : `Explore ${facts.count} built ${facts.what} in ${facts.place}: ${andList(locale, types)}. Find everyone who worked on them. Connect with them directly.`
  }
  return nl
    ? `Ontdek ${facts.count} gerealiseerde ${facts.what} in ${facts.place}, per ruimte gefotografeerd. Vind iedereen die eraan werkte, van architect tot aannemer. Benader ze rechtstreeks.`
    : `Explore ${facts.count} built ${facts.what} in ${facts.place}, photographed room by room. Find everyone who worked on them, from architect to contractor. Connect with them directly.`
}

// ─── Project detail — /projects/{project} ───────────────────────────
// Converteert op 2,00% met een kale naam, het hoogst van alle
// detailpagina's: het plafond ligt dus hoger dan het eruitziet. De
// vermelding van het bureau verhuist van de titel naar de omschrijving,
// zodat de titel het bouwtype en de plaats kan dragen — de twee dingen
// waarop gezocht wordt.

export function projectDetailTitle(
  locale: string,
  parts: { name: string; type: string | null; place: string | null },
): string {
  // Geen dubbele woorden: "Villa Amsterdam — villa in Amsterdam" is
  // geen titel maar een echo. Wat al in de projectnaam staat, wordt
  // niet nog eens aangeplakt.
  const haystack = parts.name.toLowerCase()
  const type = parts.type && !haystack.includes(parts.type.toLowerCase()) ? parts.type : null
  const place = parts.place && !haystack.includes(parts.place.toLowerCase()) ? parts.place : null
  const suffix = type && place ? `${type} in ${place}` : type ?? (place ? (isNl(locale) ? `in ${place}` : `in ${place}`) : null)
  return suffix ? `${parts.name} — ${suffix}` : parts.name
}

export function projectDetailDescription(locale: string, facts: { firm: string | null }): string {
  const nl = isNl(locale)
  if (nl) {
    const lead = facts.firm ? `Gerealiseerd door ${facts.firm}, professioneel gefotografeerd.` : "Gerealiseerd en professioneel gefotografeerd."
    return `${lead} Vind het hele team erachter, van interieurarchitect tot aannemer. Benader ze rechtstreeks.`
  }
  const lead = facts.firm ? `Built by ${facts.firm}, professionally photographed.` : "Built and professionally photographed."
  return `${lead} Find the whole team behind it, from interior designer to contractor. Connect with them directly.`
}

// ─── Arco-pagina's ───────────────────────────────────────────────────
//
// Negen pagina's zonder formule. Twee ervan horen niet in een
// zoekresultaat thuis en dragen daarom `noindex` in plaats van een
// omschrijving: /businesses/photography geeft buiten admin een 404 tot
// de fotografenlijst vol genoeg is, en /homeowner is het ingelogde
// account. Een omschrijving zou suggereren dat ze te vinden zijn.
//
// Tot vandaag erfden vijf van deze negen de `title.default` uit
// app/layout.tsx — een Engelse regel die geen pagina bewust droeg.
// `pnpm check:titles` bewaakt dat dit niet opnieuw gebeurt.

type ArcoPageCopy = { title: string; description?: string; noindex?: true }

const ARCO_PAGES: Record<string, { nl: ArcoPageCopy; en: ArcoPageCopy }> = {
  "/about": {
    nl: { title: "Over Arco — waarom alleen gerealiseerd werk",
      description: "Arco is waar toonaangevende architecten hun gerealiseerde werk publiceren en de vakmensen vermelden waarmee ze hebben samengewerkt. Geen renders, geen reviews." },
    en: { title: "About Arco — why only built work",
      description: "Arco is where leading architects publish their built work and credit the specialists they worked with. No renders, no reviews." },
  },
  "/businesses/architects": {
    nl: { title: "Voor architecten — publiceer je werk en vermeld je team",
      description: "De neutrale plek voor je gerealiseerde werk: al je projecten op je eigen pagina, met iedereen die eraan meewerkte, door jou vermeld. Gratis, voor altijd." },
    en: { title: "For architects — publish your work, credit your team",
      description: "The neutral place for your built work: every project on your own page, with everyone who contributed, credited by you. Free, forever." },
  },
  "/businesses/professionals": {
    nl: { title: "Voor vakmensen — word herkend door het werk dat je leverde",
      description: "De neutrale plek voor het werk dat je hebt geleverd: al je projecten op je eigen pagina, vermeld door de architect waarmee je samenwerkte. Niet door promotie." },
    en: { title: "For specialists — recognised for the work you delivered",
      description: "The neutral place for the work you delivered: every project on your own page, credited by the architect you worked with. Not through promotion." },
  },
  "/businesses/photography": {
    nl: { title: "Fotografie — Arco", noindex: true },
    en: { title: "Photography — Arco", noindex: true },
  },
  "/homeowner": {
    nl: { title: "Mijn Arco", noindex: true },
    en: { title: "My Arco", noindex: true },
  },
  "/pricing": {
    nl: { title: "Prijzen — wat een plek op Arco kost",
      description: "Projecten publiceren is gratis, voor altijd. Pro geeft je een volledige bedrijfspagina en Arco Approved-verificatie voor \u20ac 39 per maand." },
    en: { title: "Pricing — what a place on Arco costs",
      description: "Publishing projects is free, forever. Pro gives you a full company page and Arco Approved verification for \u20ac39 a month." },
  },
  "/privacy": {
    nl: { title: "Privacyverklaring — welke gegevens Arco bewaart",
      description: "Welke gegevens Arco van je verzamelt, waarvoor ze worden gebruikt, hoe lang ze bewaard blijven en hoe je ze laat verwijderen." },
    en: { title: "Privacy policy — what data Arco keeps",
      description: "Which data Arco collects about you, what it is used for, how long it is kept, and how to have it removed from the platform." },
  },
  "/terms": {
    nl: { title: "Voorwaarden — de regels voor gebruik van Arco",
      description: "De voorwaarden voor het gebruik van Arco: wat je mag publiceren, bij wie het werk en de rechten blijven, en wanneer een pagina offline gaat." },
    en: { title: "Terms — the rules for using Arco",
      description: "The terms for using Arco: what you may publish, who keeps the work and the rights to it, and when a page is taken offline." },
  },
  "/help-center": {
    nl: { title: "Helpcentrum — antwoorden op de meestgestelde vragen",
      description: "Hoe je je bedrijfspagina claimt, een project publiceert, je team vermeldt en contact opneemt met een bureau. De meestgestelde vragen, kort beantwoord." },
    en: { title: "Help centre — answers to the most asked questions",
      description: "How to claim your company page, publish a project, credit your team and contact a firm. The most asked questions, answered briefly." },
  },
}

/**
 * Titel, omschrijving en robots voor een Arco-pagina.
 *
 * Geeft een vorm terug die rechtstreeks in een Metadata-object past, dus
 * inclusief `robots` voor de twee pagina's die niet gevonden horen te
 * worden. Een onbekend pad geeft een leeg object in plaats van te
 * gooien: een pagina zonder titel is een zichtbaar probleem dat
 * check:titles meldt, een pagina die 500't is dat niet.
 */
export function arcoPageMeta(path: string, locale: string) {
  const entry = ARCO_PAGES[path]
  if (!entry) return {}
  const copy = isNl(locale) ? entry.nl : entry.en
  return {
    title: copy.title,
    ...(copy.description ? { description: copy.description } : {}),
    ...(copy.noindex ? { robots: { index: false, follow: true } } : {}),
  }
}
