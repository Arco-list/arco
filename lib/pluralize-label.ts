/**
 * Pluralize taxonomy/category labels for the discover result headings
 * ("4 Bungalows in the Netherlands" instead of "4 Bungalow in ...").
 *
 * Dutch plurals are irregular (Appartement→Appartementen, Tuinhuis→
 * Tuinhuizen, Villa→Villa's), so a naive +s is wrong more often than
 * right. The label universe is small and admin-controlled, so an
 * explicit dictionary covers it; unknown labels fall back UNCHANGED —
 * safer than guessing, since many category names are mass nouns that
 * must not be pluralized (Bouw, Verlichting, Flooring, Kitchens).
 * When adding a new project type or professional category in the
 * admin, add its plural here.
 */
const PLURALS: Record<string, string> = {
  // ── Project types — EN ──
  Apartment: "Apartments",
  Bungalow: "Bungalows",
  Chalet: "Chalets",
  Extension: "Extensions",
  "Garden house": "Garden houses",
  "Garden design": "Garden designs",
  Townhouse: "Townhouses",
  Villa: "Villas",
  // ── Project types — NL ──
  // Labels spelled identically in both languages but pluralized
  // differently (Villa → Villas/Villa's, Architect → Architects/
  // Architecten) live in LOCALE_PLURALS below instead.
  Appartement: "Appartementen",
  Uitbouw: "Uitbouwen",
  Tuinhuis: "Tuinhuizen",
  Stadswoning: "Stadswoningen",

  // ── Professional categories — EN ──
  Architect: "Architects",
  Builder: "Builders",
  "Cabinet maker": "Cabinet makers",
  "Garden designer": "Garden designers",
  Gardener: "Gardeners",
  "Interior Designer": "Interior Designers",
  "Interior stylist": "Interior stylists",
  "Lighting Designer": "Lighting Designers",
  Painter: "Painters",
  Photographer: "Photographers",
  "Shed builder": "Shed builders",
  "Solar installer": "Solar installers",
  "Structural engineer": "Structural engineers",
  // ── Professional categories — NL ──
  Aannemer: "Aannemers",
  Meubelmaker: "Meubelmakers",
  Tuinontwerper: "Tuinontwerpers",
  Hovenier: "Hoveniers",
  Interieurontwerper: "Interieurontwerpers",
  Interieurstylist: "Interieurstylisten",
  Lichtontwerper: "Lichtontwerpers",
  Schilder: "Schilders",
  Fotograaf: "Fotografen",
  Schuurenbouwer: "Schuurenbouwers",
  "Zonnepanelen installateur": "Zonnepanelen installateurs",
  Constructeur: "Constructeurs",
}

// Labels whose plural differs between the two languages while the
// singular is spelled identically. Keyed by locale.
const LOCALE_PLURALS: Record<string, Record<string, string>> = {
  nl: {
    Villa: "Villa's",
    Bungalow: "Bungalows",
    Chalet: "Chalets",
    Architect: "Architecten",
  },
  en: {},
}

export function pluralizeLabel(label: string, count: number, locale?: string): string {
  if (count <= 1) return label
  const loc = (locale ?? "").toLowerCase().startsWith("nl") ? "nl" : "en"
  return LOCALE_PLURALS[loc]?.[label] ?? PLURALS[label] ?? label
}
