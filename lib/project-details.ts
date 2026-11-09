import type { LucideIcon } from "lucide-react"
import {
  Anchor,
  BrickWallIcon as Brick,
  Building,
  Building2,
  CloudRainIcon,
  Cpu,
  Eye,
  GuitarIcon as Golf,
  Home,
  Landmark,
  Layers,
  Leaf,
  Mountain,
  PanelsTopLeft,
  RockingChair,
  Snowflake,
  Sprout,
  Square,
  Sun,
  Thermometer,
  TreePine,
  Trees,
  Wallet,
  Waves,
  Wind,
  Zap,
} from "lucide-react"

// Shared icon vocabulary for space/feature rows on the photo tour. The
// DB `project_features.icon` column stores one of the keys below; callers
// resolve it to a Lucide component via resolveProjectDetailsIcon().
const iconComponentMap: Record<string, LucideIcon> = {
  anchor: Anchor,
  brick: Brick,
  "brick-wall": Brick,
  building: Building,
  "building-2": Building2,
  cpu: Cpu,
  "cloud-rain": CloudRainIcon,
  eye: Eye,
  golf: Golf,
  home: Home,
  landmark: Landmark,
  layers: Layers,
  leaf: Leaf,
  mountain: Mountain,
  "panel-top": PanelsTopLeft,
  "rocking-chair": RockingChair,
  snowflake: Snowflake,
  sprout: Sprout,
  square: Square,
  sun: Sun,
  thermometer: Thermometer,
  "tree-pine": TreePine,
  trees: Trees,
  wallet: Wallet,
  waves: Waves,
  wind: Wind,
  zap: Zap,
}

export const resolveProjectDetailsIcon = (iconKey?: string | null): LucideIcon | undefined => {
  if (!iconKey) return undefined
  return iconComponentMap[iconKey]
}

export type ProjectDetailsDropdownOption = {
  value: string
  label: string
  sortOrder?: number | null
}

export type ProjectDetailsFormState = {
  category: string
  projectType: string
  buildingType: string
  projectStyle: string
  yearBuilt: string
  projectTitle: string
  projectDescription: string
  address: string
  latitude: number | null
  longitude: number | null
  city: string
  region: string
  shareExactLocation: boolean
}

export type ProjectDetailsSelectField = keyof Pick<
  ProjectDetailsFormState,
  "category" | "projectType" | "buildingType" | "projectStyle"
>

export type ProjectDetailsTextField = keyof Pick<
  ProjectDetailsFormState,
  "yearBuilt" | "projectTitle" | "projectDescription" | "address"
>

export type ProjectDetailsDescriptionCommand =
  | "bold"
  | "italic"
  | "underline"
  | "bulletList"
  | "orderedList"

export const CURRENT_YEAR = new Date().getFullYear()
export const YEAR_LOWER_BOUND = 1800

export const parseYearValue = (value: string): number | null => {
  if (!/^\d{4}$/.test(value)) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}
export const MAX_TITLE_LENGTH = 120
export const MIN_DESCRIPTION_LENGTH = 50

export const FALLBACK_CATEGORY_OPTIONS: ProjectDetailsDropdownOption[] = [
  // Alleen nog de gebouwgroep. De oude deelproject-groepen (Kitchen &
  // Living, Bed & Bath, Outdoor, Other) dupliceerden de ruimtes en zijn
  // met migratie 297 uit de taxonomie; deelprojecten lopen via ruimtes.
  { value: "house", label: "House", sortOrder: 1 },
]

export const FALLBACK_PROJECT_STYLE_OPTIONS: ProjectDetailsDropdownOption[] = [
  { value: "modern", label: "Modern", sortOrder: 1 },
  { value: "contemporary", label: "Contemporary", sortOrder: 2 },
  { value: "traditional", label: "Traditional", sortOrder: 3 },
  { value: "minimalist", label: "Minimalist", sortOrder: 4 },
  { value: "industrial", label: "Industrial", sortOrder: 5 },
  { value: "scandinavian", label: "Scandinavian", sortOrder: 6 },
  { value: "mediterranean", label: "Mediterranean", sortOrder: 7 },
  { value: "rustic", label: "Rustic", sortOrder: 8 },
  { value: "mid-century-modern", label: "Mid-Century Modern", sortOrder: 9 },
  { value: "bohemian", label: "Bohemian", sortOrder: 10 },
  { value: "coastal", label: "Coastal", sortOrder: 11 },
  { value: "farmhouse", label: "Farmhouse", sortOrder: 12 },
  { value: "transitional", label: "Transitional", sortOrder: 13 },
  { value: "urban-modern", label: "Urban Modern", sortOrder: 14 },
  { value: "eclectic", label: "Eclectic", sortOrder: 15 },
]

export const FALLBACK_PROJECT_TYPES: Record<string, ProjectDetailsDropdownOption[]> = {
  house: [
    { value: "villa", label: "Villa", sortOrder: 1 },
    { value: "house", label: "House", sortOrder: 2 },
    { value: "apartment", label: "Apartment", sortOrder: 3 },
    { value: "chalet", label: "Chalet", sortOrder: 4 },
    { value: "bungalow", label: "Bungalow", sortOrder: 5 },
    { value: "farm", label: "Farm", sortOrder: 6 },
    { value: "extension", label: "Extension", sortOrder: 7 },
  ],
}

// Canonical building-type vocabulary. Matches PROJECT_BUILDING_TYPES in
// lib/project-translations.ts — keep them in sync. Slugs match what the
// projects.building_type column stores ("villa", "chalet", etc.).
//
// Labels here are English fallbacks; render sites should use
// translateBuildingType() / translateBuildingTypeInput() to localise.
export const FALLBACK_BUILDING_TYPE_OPTIONS: ProjectDetailsDropdownOption[] = [
  { value: "villa", label: "Villa", sortOrder: 1 },
  { value: "house", label: "House", sortOrder: 2 },
  { value: "apartment", label: "Apartment", sortOrder: 3 },
  { value: "townhouse", label: "Townhouse", sortOrder: 4 },
  { value: "bungalow", label: "Bungalow", sortOrder: 5 },
  { value: "chalet", label: "Chalet", sortOrder: 6 },
  { value: "farm", label: "Farm", sortOrder: 7 },
  { value: "other", label: "Other", sortOrder: 8 },
]

export const FALLBACK_SIZE_OPTIONS: ProjectDetailsDropdownOption[] = [
  { value: "under_100", label: "< 100 m2", sortOrder: 1 },
  { value: "100_200", label: "100-200 m2", sortOrder: 2 },
  { value: "200_500", label: "200-500 m2", sortOrder: 3 },
  { value: "500_plus", label: "> 500 m2", sortOrder: 4 },
]

export const FALLBACK_BUDGET_OPTIONS: ProjectDetailsDropdownOption[] = [
  { value: "budget", label: "Budget", sortOrder: 1 },
  { value: "mid_range", label: "Mid-range", sortOrder: 2 },
  { value: "premium", label: "Premium", sortOrder: 3 },
  { value: "luxury", label: "Luxury", sortOrder: 4 },
]

export const sortByOrderThenLabel = <T extends { sortOrder?: number | null; label: string }>(a: T, b: T) => {
  const orderA = typeof a.sortOrder === "number" ? a.sortOrder : Number.MAX_SAFE_INTEGER
  const orderB = typeof b.sortOrder === "number" ? b.sortOrder : Number.MAX_SAFE_INTEGER

  if (orderA !== orderB) {
    return orderA - orderB
  }

  return a.label.localeCompare(b.label)
}

export const generateYearErrorMessages = (
  state: ProjectDetailsFormState,
  { treatEmptyAsError = false }: { treatEmptyAsError?: boolean } = {},
) => {
  const errors: Record<string, string> = {}

  const yearBuiltRaw = state.yearBuilt.trim()
  const parsedYearBuilt = parseYearValue(yearBuiltRaw)

  if (!yearBuiltRaw) {
    if (treatEmptyAsError) {
      errors.yearBuilt = "Enter the year the project was completed."
    }
  } else if (parsedYearBuilt === null) {
    errors.yearBuilt = "Use a 4-digit year like 2023."
  } else if (parsedYearBuilt < YEAR_LOWER_BOUND || parsedYearBuilt > CURRENT_YEAR) {
    errors.yearBuilt = `Use a completion year between ${YEAR_LOWER_BOUND} and ${CURRENT_YEAR}.`
  }

  return { errors, parsedYearBuilt }
}

export const getPlainTextFromHtml = (html: string) => {
  if (!html) {
    return ""
  }

  if (typeof window === "undefined") {
    return html
      .replace(/<br\s*\/?>(\n)?/gi, "\n")
      .replace(/<\/(p|div|li)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
  }

  const parser = new window.DOMParser()
  const doc = parser.parseFromString(`<body>${html}</body>`, "text/html")
  return (doc.body.textContent ?? "").replace(/\u00a0/g, " ")
}

export const getWordCountFromHtml = (html: string) => {
  const text = getPlainTextFromHtml(html).trim()
  if (!text) {
    return 0
  }

  return text.split(/\s+/).length
}

