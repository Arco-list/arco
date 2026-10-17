/** Client-safe plural display labels for project-type category slugs —
 * shared by the hub library (server) and the discover heading (client). */
export const TYPE_LABELS: Record<string, { nl: string; en: string }> = {
  villa: { nl: "Villa's", en: "Villas" },
  apartment: { nl: "Appartementen", en: "Apartments" },
  penthouse: { nl: "Penthouses", en: "Penthouses" },
  house: { nl: "Woonhuizen", en: "Houses" },
  bungalow: { nl: "Bungalows", en: "Bungalows" },
  townhouse: { nl: "Stadswoningen", en: "Townhouses" },
  chalet: { nl: "Chalets", en: "Chalets" },
  farm: { nl: "Boerderijen", en: "Farmhouses" },
  extension: { nl: "Uitbouwen", en: "Extensions" },
  "garden-house": { nl: "Tuinhuizen", en: "Garden houses" },
}

export function typeLabel(typeValue: string, locale: string): string {
  const entry = TYPE_LABELS[typeValue]
  if (entry) return locale === "nl" ? entry.nl : entry.en
  return typeValue.charAt(0).toUpperCase() + typeValue.slice(1)
}

/** Enkelvoud, voor midden in een zin. TYPE_LABELS is meervoud omdat het
 *  gemaakt is voor koppen ("Villa's in Amsterdam"); een detailtitel
 *  noemt één gebouw ("Caseta — villa in Grou"). Kleine letter, want hij
 *  staat nooit vooraan. */
export const TYPE_LABELS_SINGULAR: Record<string, { nl: string; en: string }> = {
  villa: { nl: "villa", en: "villa" },
  apartment: { nl: "appartement", en: "apartment" },
  penthouse: { nl: "penthouse", en: "penthouse" },
  house: { nl: "woonhuis", en: "house" },
  bungalow: { nl: "bungalow", en: "bungalow" },
  townhouse: { nl: "stadswoning", en: "townhouse" },
  chalet: { nl: "chalet", en: "chalet" },
  farm: { nl: "boerderij", en: "farmhouse" },
  extension: { nl: "uitbouw", en: "extension" },
  "garden-house": { nl: "tuinhuis", en: "garden house" },
}

/** Null bij een onbekend bouwtype: liever geen bouwtype in de titel dan
 *  een ruwe databasewaarde ("garden-house in Laren"). */
export function typeLabelSingular(typeValue: string | null | undefined, locale: string): string | null {
  if (!typeValue) return null
  const entry = TYPE_LABELS_SINGULAR[typeValue]
  if (!entry) return null
  return locale === "nl" ? entry.nl : entry.en
}

/** Short display labels for canonical project scopes — breadcrumb leaves
 * and other compact contexts. */
export const SCOPE_LABELS: Record<string, { nl: string; en: string }> = {
  renovation: { nl: "Renovatie", en: "Renovation" },
  new_build: { nl: "Nieuwbouw", en: "New build" },
  interior_design: { nl: "Interieur", en: "Interior" },
}

export function scopeLabel(scope: string, locale: string): string {
  const entry = SCOPE_LABELS[scope]
  if (entry) return locale === "nl" ? entry.nl : entry.en
  return scope.charAt(0).toUpperCase() + scope.slice(1)
}
