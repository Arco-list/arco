/** Client-safe province registry. address_region values are stored in
 * English; this maps them to Dutch/English display names and URL slugs.
 * Kept free of server imports so filter UI components can use it. */
export const PROVINCES: Record<string, { nl: string; en: string; slug: string }> = {
  "North Holland": { nl: "Noord-Holland", en: "North Holland", slug: "noord-holland" },
  "South Holland": { nl: "Zuid-Holland", en: "South Holland", slug: "zuid-holland" },
  "Utrecht": { nl: "Utrecht (provincie)", en: "Utrecht (province)", slug: "provincie-utrecht" },
  "North Brabant": { nl: "Noord-Brabant", en: "North Brabant", slug: "noord-brabant" },
  "Gelderland": { nl: "Gelderland", en: "Gelderland", slug: "gelderland" },
  "Overijssel": { nl: "Overijssel", en: "Overijssel", slug: "overijssel" },
  "Zeeland": { nl: "Zeeland", en: "Zeeland", slug: "zeeland" },
  "Drenthe": { nl: "Drenthe", en: "Drenthe", slug: "drenthe" },
  "Flevoland": { nl: "Flevoland", en: "Flevoland", slug: "flevoland" },
  "Friesland": { nl: "Friesland", en: "Friesland", slug: "friesland" },
  "Groningen": { nl: "Groningen (provincie)", en: "Groningen (province)", slug: "provincie-groningen" },
  "Limburg": { nl: "Limburg", en: "Limburg", slug: "limburg" },
}

/** Resolve any spelling of a province — EN name (canonical key), Dutch
 * name, or URL slug — to the canonical EN key. Returns null when the
 * value names no known province. */
export function provinceKey(value: string | null | undefined): string | null {
  if (!value) return null
  const v = value.trim()
  if (PROVINCES[v]) return v
  for (const [en, meta] of Object.entries(PROVINCES)) {
    if (meta.nl === v || meta.slug === v || meta.en === v) return en
  }
  // Bare "Utrecht"/"Groningen" (no "(provincie)" suffix) as stored in
  // companies.state_region.
  for (const [en, meta] of Object.entries(PROVINCES)) {
    if (meta.nl.replace(/ \(provincie\)$/, "") === v || meta.en.replace(/ \(province\)$/, "") === v) return en
  }
  return null
}

/** City exonyms. address_city is stored as the Dutch endonym; this maps the
 * few cities whose English name differs. Unknown cities pass through as-is. */
/** Elke schrijfwijze waarmee deze provincie in address_region kán staan.
 *
 *  De kolom hoort de Engelse canonieke naam te dragen, maar er staan
 *  Nederlandse namen tussen: "Noord-Holland" naast "North Holland",
 *  "Noord-Brabant" naast "North Brabant". De hubteller rekent via
 *  provinceKey() álle vormen mee; een query die alleen de sleutel zoekt
 *  vindt er minder, en dan belooft de description meer dan de grid
 *  toont — 66 keukens in de meta, 64 kaarten in beeld.
 *
 *  De "(provincie)"-vormen blijven eruit: dat zijn weergavelabels om
 *  stad en provincie uit elkaar te houden, geen opgeslagen waarden. */
export function regionSpellings(key: string): string[] {
  const meta = PROVINCES[key]
  if (!meta) return [key]
  return Array.from(new Set([key, meta.en, meta.nl].filter((v) => !v.includes("("))))
}

export const CITY_EXONYMS: Record<string, { nl: string; en: string }> = {
  "Den Haag": { nl: "Den Haag", en: "The Hague" },
}

export function cityLabel(name: string, locale: string): string {
  const entry = CITY_EXONYMS[name]
  if (!entry) return name
  return locale === "nl" ? entry.nl : entry.en
}
