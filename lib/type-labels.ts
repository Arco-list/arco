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
  extension: { nl: "Uitbouwen", en: "Extensions" },
  "garden-house": { nl: "Tuinhuizen", en: "Garden houses" },
}

export function typeLabel(typeValue: string, locale: string): string {
  const entry = TYPE_LABELS[typeValue]
  if (entry) return locale === "nl" ? entry.nl : entry.en
  return typeValue.charAt(0).toUpperCase() + typeValue.slice(1)
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
