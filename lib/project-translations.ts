/**
 * Get a locale-aware project field (title or description) from translations JSONB.
 * Falls back to the main column value if no translation exists.
 */
export function getProjectTranslation(
  project: { title?: string | null; description?: string | null; translations?: Record<string, any> | null },
  field: "title" | "description",
  locale: string = "en"
): string {
  const translations = project.translations
  const localeValue = translations?.[locale]?.[field]
  if (localeValue && typeof localeValue === "string" && localeValue.trim()) {
    return localeValue
  }
  // Fallback to main column
  return (project[field] ?? "") as string
}

// ─── Scope vocabulary ──────────────────────────────────────────────────────
// Project scope is stored on projects.project_type as a plain display string
// ("New Build" / "Renovation" / "Interior Design"). This module canonicalises
// those to stable slugs so translation is deterministic, and ships a
// translation map for the two supported locales (nl, en).
//
// The canonical slugs are NOT written back to the DB by this PR — existing
// rows keep their display-string values. canonicalizeScope() accepts either
// form so reads work without a data migration. New writes from the edit
// dropdown continue to store the display string to stay compatible with
// code paths (import flow, edit-page equality checks) that haven't been
// migrated yet.

export const PROJECT_SCOPES = ["new_build", "renovation", "interior_design"] as const
export type ProjectScope = typeof PROJECT_SCOPES[number]

type ScopeLocale = "nl" | "en"

const SCOPE_LABELS: Record<ProjectScope, Record<ScopeLocale, string>> = {
  new_build: {
    en: "New Build",
    nl: "Nieuwbouw",
  },
  renovation: {
    en: "Renovation",
    nl: "Gerenoveerd",
  },
  interior_design: {
    en: "Interior Design",
    nl: "Interieur ontworpen",
  },
}

/**
 * Display label for a scope slug in a given locale. Falls back to English
 * if the locale isn't Dutch or English. Returns null when the slug is
 * unknown so callers can decide how to handle stale data.
 */
export function translateScope(
  slug: ProjectScope | null | undefined,
  locale: string,
): string | null {
  if (!slug) return null
  const entry = SCOPE_LABELS[slug]
  if (!entry) return null
  if (locale === "nl") return entry.nl
  return entry.en
}

/**
 * Map any historical input to the canonical scope slug. Accepts:
 *   - the canonical slugs themselves ('new_build', 'renovation', …)
 *   - the English display strings currently stored in the DB
 *     ('New Build', 'Renovation', 'Interior Design')
 *   - the kebab-case variants used by the import flow
 *     ('new-build', 'renovated', 'interior-designed')
 *   - case/whitespace variants of any of the above
 *
 * Returns null when the input isn't a known scope. Callers that read
 * `projects.project_type` should treat null as "this isn't a scope — it
 * might be a UUID or a type category string".
 */
export function canonicalizeScope(input: string | null | undefined): ProjectScope | null {
  if (!input) return null
  const normalised = input.trim().toLowerCase().replace(/[\s-]+/g, "_")
  switch (normalised) {
    case "new_build":
      return "new_build"
    case "renovation":
    case "renovated":
      return "renovation"
    case "interior_design":
    case "interior_designed":
      return "interior_design"
    default:
      return null
  }
}

/**
 * Convenience: translate a raw input (display string or slug) directly,
 * without having to canonicalise first.
 */
export function translateScopeInput(
  input: string | null | undefined,
  locale: string,
): string | null {
  const slug = canonicalizeScope(input)
  return translateScope(slug, locale)
}

// ─── Building type vocabulary ──────────────────────────────────────────────
// Stored on projects.building_type as kebab-case slugs ("villa", "house",
// "garden-house"). Unlike scope, the DB already holds canonical slugs so
// canonicalize() just normalises casing and accepts a few common variants.
//
// PROJECT_BUILDING_TYPES is the source of truth for filter UI (replaces
// the broken DB-backed "building_type" taxonomy that actually held scope
// values). One place to add a value when the enum grows.

export const PROJECT_BUILDING_TYPES = [
  "villa",
  "house",
  "apartment",
  "townhouse",
  "penthouse",
  "bungalow",
  "chalet",
  "farm",
  "garden-house",
  "other",
] as const
export type ProjectBuildingType = typeof PROJECT_BUILDING_TYPES[number]

const BUILDING_TYPE_LABELS: Record<ProjectBuildingType, Record<ScopeLocale, string>> = {
  villa: { en: "Villa", nl: "Villa" },
  house: { en: "House", nl: "Huis" },
  apartment: { en: "Apartment", nl: "Appartement" },
  townhouse: { en: "Townhouse", nl: "Stadswoning" },
  penthouse: { en: "Penthouse", nl: "Penthouse" },
  bungalow: { en: "Bungalow", nl: "Bungalow" },
  chalet: { en: "Chalet", nl: "Chalet" },
  farm: { en: "Farm", nl: "Boerderij" },
  "garden-house": { en: "Garden house", nl: "Tuinhuis" },
  other: { en: "Other", nl: "Anders" },
}

export function translateBuildingType(
  slug: ProjectBuildingType | null | undefined,
  locale: string,
): string | null {
  if (!slug) return null
  const entry = BUILDING_TYPE_LABELS[slug]
  if (!entry) return null
  if (locale === "nl") return entry.nl
  return entry.en
}

/**
 * Map any input to a canonical building-type slug. Accepts:
 *   - the slug itself ("villa", "garden-house")
 *   - underscored variants ("garden_house")
 *   - title-case display strings ("Villa", "Garden House")
 *   - case/whitespace variants
 *
 * Returns null when the input doesn't match a known building type.
 */
export function canonicalizeBuildingType(
  input: string | null | undefined,
): ProjectBuildingType | null {
  if (!input) return null
  const normalised = input.trim().toLowerCase().replace(/[\s_]+/g, "-")
  return (PROJECT_BUILDING_TYPES as readonly string[]).includes(normalised)
    ? (normalised as ProjectBuildingType)
    : null
}

/**
 * Convenience: translate a raw input (slug, display string, or near-miss)
 * directly without canonicalising first.
 */
export function translateBuildingTypeInput(
  input: string | null | undefined,
  locale: string,
): string | null {
  const slug = canonicalizeBuildingType(input)
  return translateBuildingType(slug, locale)
}

// ─── Project type category vocabulary ──────────────────────────────────────
// Rendered on the project detail "TYPE" spec and in related/similar project
// cards. Values come from the `categories` table via
// `projects.project_type_category_id`. The slug column on `categories` is the
// stable identifier — display names are English and not localised in the DB.
//
// Most category slugs used as project types overlap with
// PROJECT_BUILDING_TYPES (villa / house / apartment / …). The only extras
// are project-kind categories like "extension". Keep the map exhaustive for
// the known parent-level categories so we never fall back to English.

const CATEGORY_NAME_LABELS: Record<string, Record<ScopeLocale, string>> = {
  villa: { en: "Villa", nl: "Villa" },
  house: { en: "House", nl: "Huis" },
  apartment: { en: "Apartment", nl: "Appartement" },
  townhouse: { en: "Townhouse", nl: "Stadswoning" },
  penthouse: { en: "Penthouse", nl: "Penthouse" },
  bungalow: { en: "Bungalow", nl: "Bungalow" },
  chalet: { en: "Chalet", nl: "Chalet" },
  farm: { en: "Farm", nl: "Boerderij" },
  "garden-house": { en: "Garden house", nl: "Tuinhuis" },
  extension: { en: "Extension", nl: "Uitbouw" },
  other: { en: "Other", nl: "Anders" },
}

/**
 * Translate a category used as a project type. Accepts either the slug
 * ("villa", "garden-house") or the English display name ("Villa",
 * "Garden house") so callers can pass whatever they have in hand without
 * normalising first. Returns null when the input isn't a known category —
 * the caller can then fall back to the raw value.
 */
export function translateCategoryName(
  input: string | null | undefined,
  locale: string,
): string | null {
  if (!input) return null
  const slug = input.trim().toLowerCase().replace(/[\s_]+/g, "-")
  const entry = CATEGORY_NAME_LABELS[slug]
  if (!entry) return null
  if (locale === "nl") return entry.nl
  return entry.en
}

// ─── Project style vocabulary ──────────────────────────────────────────────
// Stored in `project_taxonomy_options` with taxonomy_type = 'project_style'.
// Projects reference style options by UUID via the `style_preferences`
// column (array of ids). Callers resolve the UUID to the option row and
// pass either the slug or the English name here to get a locale label.
//
// The style list is stable enough to maintain by hand — changes require a
// DB migration anyway.

const PROJECT_STYLE_LABELS: Record<string, Record<ScopeLocale, string>> = {
  modern: { en: "Modern", nl: "Modern" },
  contemporary: { en: "Contemporary", nl: "Hedendaags" },
  traditional: { en: "Traditional", nl: "Traditioneel" },
  minimalist: { en: "Minimalist", nl: "Minimalistisch" },
  industrial: { en: "Industrial", nl: "Industrieel" },
  scandinavian: { en: "Scandinavian", nl: "Scandinavisch" },
  mediterranean: { en: "Mediterranean", nl: "Mediterraan" },
  rustic: { en: "Rustic", nl: "Rustiek" },
  "mid-century-modern": { en: "Mid-Century Modern", nl: "Mid-Century Modern" },
  bohemian: { en: "Bohemian", nl: "Bohemian" },
  coastal: { en: "Coastal", nl: "Kust" },
  farmhouse: { en: "Farmhouse", nl: "Landelijk" },
  transitional: { en: "Transitional", nl: "Transitioneel" },
  "urban-modern": { en: "Urban Modern", nl: "Urban Modern" },
  eclectic: { en: "Eclectic", nl: "Eclectisch" },
}

/**
 * Translate a project style. Accepts either the slug ("modern",
 * "mid-century-modern") or the English display name ("Modern",
 * "Mid-Century Modern"). Returns null for unknown inputs so callers can
 * fall back to the raw value.
 */
export function translateProjectStyle(
  input: string | null | undefined,
  locale: string,
): string | null {
  if (!input) return null
  const slug = input.trim().toLowerCase().replace(/[\s_]+/g, "-")
  const entry = PROJECT_STYLE_LABELS[slug]
  if (!entry) return null
  if (locale === "nl") return entry.nl
  return entry.en
}

// ─── Professional service vocabulary ───────────────────────────────────────
// Categories with category_type = 'Professional'. Populated on the
// `categories` table and referenced by companies.primary_service_id +
// company_services.category_id. The DB has a `name_nl` column for these,
// but RPC returns (mv_professional_summary.primary_service_name,
// search_professionals.services_offered) only expose the English `name`,
// so we maintain a parallel map here keyed by slug / English display name.
//
// Covers parent services (Design & Planning, Construction, Finishing,
// Systems, Outdoor & Garden) and all child services (Architect, Builder,
// Interior Designer, …) — the full set from the categories table.

const PROFESSIONAL_SERVICE_LABELS: Record<string, Record<ScopeLocale, string>> = {
  // Parents
  "design-planning": { en: "Design & Planning", nl: "Ontwerp & Planning" },
  construction: { en: "Construction", nl: "Bouw" },
  finishing: { en: "Finishing", nl: "Afwerking" },
  systems: { en: "Systems", nl: "Installaties" },
  "outdoor-garden": { en: "Outdoor & Garden", nl: "Buiten & Tuin" },
  // Design & Planning
  architect: { en: "Architect", nl: "Architect" },
  "interior-designer": { en: "Interior Designer", nl: "Interieurontwerper" },
  "garden-designer": { en: "Garden designer", nl: "Tuinontwerper" },
  "structural-engineer": { en: "Structural engineer", nl: "Constructeur" },
  "lighting-designer": { en: "Lighting Designer", nl: "Lichtontwerper" },
  // Construction
  builder: { en: "Builder", nl: "Aannemer" },
  "tiles-stones": { en: "Tiles & Stones", nl: "Tegels & Natuursteen" },
  roofing: { en: "Roofing", nl: "Dakbedekking" },
  "windows-doors": { en: "Windows & doors", nl: "Ramen & Deuren" },
  kitchens: { en: "Kitchens", nl: "Keukens" },
  bathrooms: { en: "Bathrooms", nl: "Badkamers" },
  "stairs-elevator": { en: "Stairs & Elevators", nl: "Trappen & Liften" },
  "swimming-pools": { en: "Swimming pools", nl: "Zwembaden" },
  "saunas-spas": { en: "Saunas & Spas", nl: "Sauna's & Spa's" },
  // Finishing
  painter: { en: "Painter", nl: "Schilder" },
  flooring: { en: "Flooring", nl: "Vloeren" },
  "cabinet-maker": { en: "Cabinet maker", nl: "Meubelmaker" },
  "interior-stylist": { en: "Interior stylist", nl: "Interieurstylist" },
  fireplace: { en: "Fireplaces", nl: "Open haarden" },
  photgraphy: { en: "Photographer", nl: "Fotograaf" },
  furniture: { en: "Furniture", nl: "Meubels" },
  art: { en: "Art", nl: "Kunst" },
  lighting: { en: "Lighting", nl: "Verlichting" },
  // Systems
  "electrical-systems": { en: "Electrical systems", nl: "Elektra" },
  "heating-ventilation": { en: "Heating & Ventilation", nl: "Verwarming & Ventilatie" },
  "solar-installer": { en: "Solar installer", nl: "Zonnepanelen installateur" },
  "smart-homes": { en: "Smart homes", nl: "Smart home" },
  "security-systems": { en: "Security systems", nl: "Beveiligingssystemen" },
  // Outdoor & Garden
  gardener: { en: "Gardener", nl: "Hovenier" },
  "outdoor-furniture": { en: "Outdoor furniture", nl: "Tuinmeubelen" },
  "shed-builder": { en: "Shed builder", nl: "Schuurenbouwer" },
  "fencing-gates": { en: "Fencing & Gates", nl: "Hekwerk & Poorten" },
  "outdoor-lighting": { en: "Outdoor lighting", nl: "Buitenverlichting" },
}

/**
 * Translate a professional service category. Accepts either the slug
 * ("architect", "interior-designer") or the English display name
 * ("Architect", "Interior Designer"). Returns null for unknown inputs.
 */
export function translateProfessionalService(
  input: string | null | undefined,
  locale: string,
): string | null {
  if (!input) return null
  const slug = input.trim().toLowerCase().replace(/[\s_]+/g, "-").replace(/&/g, "").replace(/\s*-\s*/g, "-")
  const direct = PROFESSIONAL_SERVICE_LABELS[slug]
  if (direct) {
    if (locale === "nl") return direct.nl
    return direct.en
  }
  // Try lookup by exact English display-name match as a fallback (handles
  // values that aren't clean slugs, e.g. "Photgrapher" from the DB).
  const byName = Object.values(PROFESSIONAL_SERVICE_LABELS).find((entry) => entry.en === input)
  if (byName) {
    if (locale === "nl") return byName.nl
    return byName.en
  }
  return null
}
