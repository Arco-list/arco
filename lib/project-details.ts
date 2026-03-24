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

export type ProjectDetailsDropdownOption = {
  value: string
  label: string
  sortOrder?: number | null
}

export type ProjectDetailsFeatureOption = {
  value: string
  label: string
  iconKey?: string | null
  sortOrder?: number | null
}

export type ProjectDetailsFormState = {
  category: string
  projectType: string
  buildingType: string
  projectStyle: string
  locationFeatures: string[]
  materialFeatures: string[]
  size: string
  budget: string
  yearBuilt: string
  buildingYear: string
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
  "category" | "projectType" | "buildingType" | "projectStyle" | "size" | "budget"
>

export type ProjectDetailsTextField = keyof Pick<
  ProjectDetailsFormState,
  "yearBuilt" | "buildingYear" | "projectTitle" | "projectDescription" | "address"
>

export type ProjectDetailsDescriptionCommand =
  | "bold"
  | "italic"
  | "underline"
  | "bulletList"
  | "orderedList"

export const YEAR_LOWER_BOUND = 1800
export const CURRENT_YEAR = new Date().getFullYear()
export const MAX_TITLE_LENGTH = 120
export const MIN_DESCRIPTION_LENGTH = 50

export const FALLBACK_CATEGORY_OPTIONS: ProjectDetailsDropdownOption[] = [
  { value: "house", label: "House", sortOrder: 1 },
  { value: "kitchen-living", label: "Kitchen & Living", sortOrder: 2 },
  { value: "bed-bath", label: "Bed & Bath", sortOrder: 3 },
  { value: "outdoor", label: "Outdoor", sortOrder: 4 },
  { value: "other", label: "Other", sortOrder: 5 },
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
  "kitchen-living": [
    { value: "kitchen", label: "Kitchen", sortOrder: 1 },
    { value: "living", label: "Living", sortOrder: 2 },
    { value: "sunroom", label: "Sunroom", sortOrder: 4 },
  ],
  "bed-bath": [
    { value: "bathroom", label: "Bathroom", sortOrder: 1 },
    { value: "bedroom", label: "Bedroom", sortOrder: 2 },
    { value: "indoor-pool", label: "Indoor pool", sortOrder: 3 },
    { value: "jacuzzi", label: "Jacuzzi", sortOrder: 4 },
    { value: "sauna", label: "Sauna", sortOrder: 5 },
    { value: "steam-room", label: "Steam room", sortOrder: 6 },
  ],
  outdoor: [
    { value: "garden", label: "Garden", sortOrder: 1 },
    { value: "outdoor-pool", label: "Outdoor pool", sortOrder: 2 },
    { value: "garden-house", label: "Garden house", sortOrder: 3 },
    { value: "outdoor-kitchen", label: "Outdoor kitchen", sortOrder: 4 },
    { value: "garage", label: "Garage", sortOrder: 5 },
    { value: "porch", label: "Porch", sortOrder: 6 },
  ],
  other: [
    { value: "hall", label: "Hall", sortOrder: 1 },
    { value: "home-office", label: "Home office", sortOrder: 2 },
    { value: "bar", label: "Bar", sortOrder: 3 },
    { value: "cinema", label: "Cinema", sortOrder: 4 },
    { value: "gym", label: "Gym", sortOrder: 5 },
    { value: "game-room", label: "Game room", sortOrder: 6 },
    { value: "kids-room", label: "Kids room", sortOrder: 7 },
    { value: "wine-cellar", label: "Wine cellar", sortOrder: 8 },
  ],
}

export const FALLBACK_BUILDING_TYPE_OPTIONS: ProjectDetailsDropdownOption[] = [
  { value: "new_build", label: "New build", sortOrder: 1 },
  { value: "renovated", label: "Renovated", sortOrder: 2 },
  { value: "interior_designed", label: "Interior designed", sortOrder: 3 },
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

export const FALLBACK_LOCATION_FEATURES: ProjectDetailsFeatureOption[] = [
  { value: "urban-center", label: "Urban center", iconKey: "building", sortOrder: 1 },
  { value: "suburban", label: "Suburban", iconKey: "home", sortOrder: 2 },
  { value: "countryside", label: "Countryside", iconKey: "trees", sortOrder: 3 },
  { value: "coastal", label: "Coastal", iconKey: "waves", sortOrder: 4 },
  { value: "beach", label: "Beach", iconKey: "sun", sortOrder: 5 },
  { value: "waterfront", label: "Waterfront", iconKey: "anchor", sortOrder: 6 },
  { value: "lakefront", label: "Lakefront", iconKey: "waves", sortOrder: 7 },
  { value: "mountain", label: "Mountain", iconKey: "mountain", sortOrder: 8 },
  { value: "amazing-views", label: "Amazing views", iconKey: "eye", sortOrder: 9 },
  { value: "city-view", label: "City view", iconKey: "building-2", sortOrder: 10 },
  { value: "golfing", label: "Golfing", iconKey: "golf", sortOrder: 11 },
  { value: "ski-resort", label: "Ski resort", iconKey: "snowflake", sortOrder: 12 },
  { value: "forest", label: "Forest", iconKey: "tree-pine", sortOrder: 13 },
  { value: "historic-district", label: "Historic district", iconKey: "landmark", sortOrder: 14 },
  { value: "business-district", label: "Business district", iconKey: "building", sortOrder: 15 },
]

export const FALLBACK_MATERIAL_FEATURES: ProjectDetailsFeatureOption[] = [
  { value: "metal-constructions", label: "Metal constructions", iconKey: "zap", sortOrder: 1 },
  { value: "stucco-walls", label: "Stucco walls", iconKey: "brick", sortOrder: 2 },
  { value: "glass-facades", label: "Glass facades", iconKey: "square", sortOrder: 3 },
  { value: "slate-roof", label: "Slate roof", iconKey: "cloud-rain", sortOrder: 4 },
  { value: "bamboo", label: "Bamboo", iconKey: "leaf", sortOrder: 5 },
  { value: "natural-stone", label: "Natural Stone", iconKey: "rocking-chair", sortOrder: 6 },
  { value: "exposed-brick", label: "Exposed brick", iconKey: "brick", sortOrder: 7 },
  { value: "reclaimed-wood", label: "Reclaimed wood", iconKey: "layers", sortOrder: 8 },
  { value: "thatched-roof", label: "Thatched roof", iconKey: "home", sortOrder: 9 },
  { value: "exposed-concrete", label: "Exposed concrete", iconKey: "square", sortOrder: 10 },
  { value: "solar-panels", label: "Solar panels", iconKey: "sun", sortOrder: 11 },
  { value: "green-roof", label: "Green roof", iconKey: "sprout", sortOrder: 12 },
  { value: "smart-home-technology", label: "Smart home technology", iconKey: "cpu", sortOrder: 13 },
  { value: "underfloor-heating", label: "Underfloor heating", iconKey: "waves", sortOrder: 14 },
  { value: "heat-pump", label: "Heat pump", iconKey: "thermometer", sortOrder: 15 },
  { value: "insulation", label: "Insulation", iconKey: "layers", sortOrder: 16 },
  { value: "double-glazing", label: "Double glazing", iconKey: "panel-top", sortOrder: 17 },
  { value: "ventilation-system", label: "Ventilation system", iconKey: "wind", sortOrder: 18 },
]

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

export const DEFAULT_LOCATION_ICONS: LucideIcon[] = [
  Waves,
  Eye,
  Building,
  Trees,
  Golf,
  Snowflake,
  Anchor,
  TreePine,
  Mountain,
  Landmark,
  Sun,
  Wind,
]

export const DEFAULT_MATERIAL_ICONS: LucideIcon[] = [
  Zap,
  Square,
  CloudRainIcon,
  Leaf,
  RockingChair,
  Brick,
  Layers,
  Home,
  Sun,
  Sprout,
  Cpu,
  Thermometer,
  Wind,
]

export const resolveProjectDetailsIcon = (iconKey?: string | null): LucideIcon | undefined => {
  if (!iconKey) {
    return undefined
  }

  return iconComponentMap[iconKey]
}

export const sortByOrderThenLabel = <T extends { sortOrder?: number | null; label: string }>(a: T, b: T) => {
  const orderA = typeof a.sortOrder === "number" ? a.sortOrder : Number.MAX_SAFE_INTEGER
  const orderB = typeof b.sortOrder === "number" ? b.sortOrder : Number.MAX_SAFE_INTEGER

  if (orderA !== orderB) {
    return orderA - orderB
  }

  return a.label.localeCompare(b.label)
}

export const sortFeatureOptions = (options: ProjectDetailsFeatureOption[]) => {
  return [...options].sort((a, b) => {
    const orderA = typeof a.sortOrder === "number" ? a.sortOrder : Number.MAX_SAFE_INTEGER
    const orderB = typeof b.sortOrder === "number" ? b.sortOrder : Number.MAX_SAFE_INTEGER

    if (orderA !== orderB) {
      return orderA - orderB
    }

    return a.label.localeCompare(b.label)
  })
}

export const parseYearValue = (value: string) => {
  if (!/^[0-9]{4}$/.test(value)) {
    return null
  }

  const numeric = Number.parseInt(value, 10)
  return Number.isNaN(numeric) ? null : numeric
}

export const generateYearErrorMessages = (
  state: ProjectDetailsFormState,
  { treatEmptyAsError = false }: { treatEmptyAsError?: boolean } = {},
) => {
  const errors: Record<string, string> = {}

  const yearBuiltRaw = state.yearBuilt.trim()
  const buildingYearRaw = state.buildingYear.trim()

  const parsedYearBuilt = parseYearValue(yearBuiltRaw)
  const parsedBuildingYear = parseYearValue(buildingYearRaw)

  if (!yearBuiltRaw) {
    if (treatEmptyAsError) {
      errors.yearBuilt = "Enter the year the project was completed."
    }
  } else if (parsedYearBuilt === null) {
    errors.yearBuilt = "Use a 4-digit year like 2023."
  } else if (parsedYearBuilt < YEAR_LOWER_BOUND || parsedYearBuilt > CURRENT_YEAR) {
    errors.yearBuilt = `Use a completion year between ${YEAR_LOWER_BOUND} and ${CURRENT_YEAR}.`
  }

  if (!buildingYearRaw) {
    if (treatEmptyAsError) {
      errors.buildingYear = "Enter the original construction year."
    }
  } else if (parsedBuildingYear === null) {
    errors.buildingYear = "Use a 4-digit year like 2010."
  } else if (parsedBuildingYear < YEAR_LOWER_BOUND || parsedBuildingYear > CURRENT_YEAR) {
    errors.buildingYear = `Use a construction year between ${YEAR_LOWER_BOUND} and ${CURRENT_YEAR}.`
  }

  if (
    !errors.buildingYear &&
    parsedYearBuilt !== null &&
    parsedBuildingYear !== null &&
    parsedBuildingYear > parsedYearBuilt
  ) {
    errors.buildingYear = "Original construction year can't be after the completion year."
  }

  return { errors, parsedYearBuilt, parsedBuildingYear }
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

export const mapFeatureOptionsToIconItems = (
  options: ProjectDetailsFeatureOption[],
  defaults: LucideIcon[],
) => {
  return options.map((option, index) => {
    const icon = resolveProjectDetailsIcon(option.iconKey) ?? defaults[index % defaults.length]
    return {
      value: option.value,
      label: option.label,
      icon,
    }
  })
}
