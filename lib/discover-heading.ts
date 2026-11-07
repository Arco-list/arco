import { PROVINCES, cityLabel } from "@/lib/provinces"
import { typeLabel, scopeNoun, spaceNoun } from "@/lib/type-labels"

/** "A", "A & B", "A, B & C" — the joining grammar shared by the discover
 * H1 and the results-count line so both always read identically. */
function joinAmp(items: string[]): string {
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} & ${items[1]}`
  return `${items.slice(0, -1).join(", ")} & ${items.at(-1)}`
}

export interface DiscoverHeadingOpts {
  /** Localized, pluralized category labels. */
  typeLabels: string[]
  /** Raw projects.building_type values (villa / apartment / …). */
  buildingTypes: string[]
  /** Canonieke scopes (new_build / renovation / interior_design).
   *
   *  Stond hier niet, en dat kostte elke samengestelde scope-hub zijn
   *  kop: /projects/noord-holland/nieuwbouw voerde "Projecten in
   *  Noord-Holland" terwijl titel, description en breadcrumb alle drie
   *  wél "nieuwbouw" zeiden. De scope zat in de filterstand en in de
   *  kruimelpad-leaf — alleen deze functie vroeg er nooit om. */
  scopes: string[]
  /** Geselecteerde spaces.slug ("kitchen"), nul of één.
   *
   *  Derde as die hier ontbrak, na type en scope. Een ruimtehub
   *  gecombineerd met een provincie kopte daardoor "Projecten in
   *  Noord-Holland" terwijl de pagina Keukens in Noord-Holland heet. */
  spaces: string[]
  /** Raw address_city values. */
  locations: string[]
  /** Raw address_region keys (English, as stored). */
  regions: string[]
  locale: string
  /** Fallback type part, e.g. "Architectuurprojecten". */
  defaultTypeLabel: string
  /** Fallback location part, e.g. "Nederland". */
  defaultLocationLabel: string
}

/** "{Types} in {Locations}" with defaults on both sides — the grammar
 * behind the discover page title. Each side names at most two
 * selections; beyond that it falls back to the generic part ("Projecten",
 * "5 locaties") so the title stays a title. */
export function discoverHeading(opts: DiscoverHeadingOpts): string {
  const { locale } = opts
  const nl = locale === "nl"
  const buildingTypeLabels = opts.buildingTypes.map((v) => typeLabel(v, locale))
  // Scopes achteraan: bij een enkele scope en verder niets levert dat
  // exact de kop die de server voor die hub zou zetten, zodat de titel
  // niet verspringt zodra de client hem overneemt.
  const scopeLabels = opts.scopes.map((v) => scopeNoun(v, locale))
  const spaceLabels = opts.spaces.map((v) => spaceNoun(v, locale))

  // ── Ruimte is het ONDERWERP, de rest is de CONTAINER ──────────────
  //
  // Een ruimte zit altijd ergens in, en dat is een andere relatie dan
  // die tussen een bouwtype en een scope. "Woonkamers & villa's in
  // Nederland" zet de twee naast elkaar alsof je ook losse villa's
  // krijgt; "Woonkamers in villa's in Nederland" zegt wat de pagina
  // toont. Vandaar twee keer "in" en geen ampersand.
  //
  // De container gaat naar kleine letter: hij staat midden in de zin.
  const containers = [...buildingTypeLabels, ...opts.typeLabels, ...scopeLabels].filter(Boolean)
  const typePart = (() => {
    if (spaceLabels.length > 0) {
      const subject = joinAmp(spaceLabels)
      // Drie containers of meer noemen maakt de kop een opsomming; dan
      // blijft de ruimte alleen staan, wat nog altijd waar is.
      if (containers.length === 0 || containers.length > 2) return subject
      return `${subject} in ${joinAmp(containers.map((c) => c.toLocaleLowerCase(locale)))}`
    }
    return containers.length === 0 || containers.length > 2 ? opts.defaultTypeLabel : joinAmp(containers)
  })()

  // Regions render as a single label ("Noord-Holland") ahead of any
  // individually selected cities — never expanded into member cities.
  const regionLabels = opts.regions.map((r) =>
    PROVINCES[r] ? (nl ? PROVINCES[r].nl : PROVINCES[r].en) : r,
  )
  const locations = [...regionLabels, ...opts.locations.map((c) => cityLabel(c, locale))]
  const locationPart =
    locations.length === 0
      ? opts.defaultLocationLabel
      : locations.length > 2
        ? `${locations.length} ${nl ? "locaties" : "locations"}`
        : joinAmp(locations)

  return `${typePart} in ${locationPart}`
}
