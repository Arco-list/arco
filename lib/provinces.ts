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

/** City exonyms. address_city is stored as the Dutch endonym; this maps the
 * few cities whose English name differs. Unknown cities pass through as-is. */
export const CITY_EXONYMS: Record<string, { nl: string; en: string }> = {
  "Den Haag": { nl: "Den Haag", en: "The Hague" },
}

export function cityLabel(name: string, locale: string): string {
  const entry = CITY_EXONYMS[name]
  if (!entry) return name
  return locale === "nl" ? entry.nl : entry.en
}
