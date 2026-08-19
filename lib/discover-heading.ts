import { PROVINCES, cityLabel } from "@/lib/provinces"
import { typeLabel } from "@/lib/type-labels"

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
  /** Raw address_city values. */
  locations: string[]
  /** Raw address_region keys (English, as stored). */
  regions: string[]
  locale: string
  /** Fallback type part, e.g. "Projecten". */
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
  const types = [...buildingTypeLabels, ...opts.typeLabels].filter(Boolean)
  const typePart = types.length === 0 || types.length > 2 ? opts.defaultTypeLabel : joinAmp(types)

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
