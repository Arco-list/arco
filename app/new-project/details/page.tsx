"use client"

import type { LucideIcon } from "lucide-react"
import {
  Anchor,
  BrickWallIcon as Brick,
  Building,
  Building2,
  ChevronDown,
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
  Ruler,
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
import { useEffect, useMemo, useRef, useState } from "react"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import { useRouter } from "next/navigation"
import Script from "next/script"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import type { Tables } from "@/lib/supabase/types"

type DropdownOption = {
  value: string
  label: string
  sortOrder?: number | null
}

type CategoryWithAttributes = Tables<"categories"> & {
  project_category_attributes: Tables<"project_category_attributes"> | null
}

type ProjectTaxonomyOption = Tables<"project_taxonomy_options">

type FormState = {
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

type SelectField = keyof Pick<
  FormState,
  "category" | "projectType" | "buildingType" | "projectStyle" | "size" | "budget"
>

type TextField = keyof Pick<
  FormState,
  "yearBuilt" | "buildingYear" | "projectTitle" | "projectDescription" | "address"
>

type FeatureOption = {
  value: string
  label: string
  iconKey?: string | null
  sortOrder?: number | null
}

declare global {
  interface Window {
    google: any
  }
}

const DEFAULT_LOCATION = {
  address: "Dam Square, 1012 JS Amsterdam, Netherlands",
  city: "Amsterdam",
  region: "North Holland",
  latitude: 52.3727598,
  longitude: 4.8936041,
}

const DEFAULT_MAP_CENTER = {
  lat: DEFAULT_LOCATION.latitude,
  lng: DEFAULT_LOCATION.longitude,
}
const DEFAULT_MAP_ZOOM = 15

const extractCityAndRegion = (
  components: Array<{ long_name: string; short_name: string; types: string[] }> = [],
) => {
  let city = ""
  let region = ""

  for (const component of components) {
    if (!city && (component.types.includes("locality") || component.types.includes("postal_town"))) {
      city = component.long_name
    }

    if (
      !region &&
      (component.types.includes("administrative_area_level_1") ||
        component.types.includes("administrative_area_level_2"))
    ) {
      region = component.long_name
    }
  }

  return { city, region }
}

const FALLBACK_CATEGORY_OPTIONS: DropdownOption[] = [
  { value: "house", label: "House", sortOrder: 1 },
  { value: "kitchen-living", label: "Kitchen & Living", sortOrder: 2 },
  { value: "bed-bath", label: "Bed & Bath", sortOrder: 3 },
  { value: "outdoor", label: "Outdoor", sortOrder: 4 },
  { value: "other", label: "Other", sortOrder: 5 },
]

const FALLBACK_PROJECT_STYLE_OPTIONS: DropdownOption[] = [
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

const FALLBACK_PROJECT_TYPES: Record<string, DropdownOption[]> = {
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
    { value: "living-room", label: "Living room", sortOrder: 2 },
    { value: "dining-room", label: "Dining room", sortOrder: 3 },
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

const FALLBACK_BUILDING_TYPE_OPTIONS: DropdownOption[] = [
  { value: "new_build", label: "New build", sortOrder: 1 },
  { value: "renovated", label: "Renovated", sortOrder: 2 },
  { value: "interior_designed", label: "Interior designed", sortOrder: 3 },
]

const FALLBACK_SIZE_OPTIONS: DropdownOption[] = [
  { value: "under_100", label: "< 100 m2", sortOrder: 1 },
  { value: "100_200", label: "100-200 m2", sortOrder: 2 },
  { value: "200_500", label: "200-500 m2", sortOrder: 3 },
  { value: "500_plus", label: "> 500 m2", sortOrder: 4 },
]

const FALLBACK_BUDGET_OPTIONS: DropdownOption[] = [
  { value: "budget", label: "Budget", sortOrder: 1 },
  { value: "mid_range", label: "Mid-range", sortOrder: 2 },
  { value: "premium", label: "Premium", sortOrder: 3 },
  { value: "luxury", label: "Luxury", sortOrder: 4 },
]

const FALLBACK_LOCATION_FEATURES: FeatureOption[] = [
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

const FALLBACK_MATERIAL_FEATURES: FeatureOption[] = [
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
  ruler: Ruler,
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

const DEFAULT_LOCATION_ICONS: LucideIcon[] = [
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

const DEFAULT_MATERIAL_ICONS: LucideIcon[] = [
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

const resolveIconComponent = (iconKey?: string | null): LucideIcon | undefined => {
  if (!iconKey) {
    return undefined
  }

  return iconComponentMap[iconKey]
}

const YEAR_LOWER_BOUND = 1800
const CURRENT_YEAR = new Date().getFullYear()
const MAX_TITLE_LENGTH = 120
const MIN_DESCRIPTION_LENGTH = 50

const parseYearValue = (value: string) => {
  if (!/^[0-9]{4}$/.test(value)) {
    return null
  }
  const numeric = Number.parseInt(value, 10)
  return Number.isNaN(numeric) ? null : numeric
}

const generateYearErrorMessages = (
  state: FormState,
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

const getPlainTextFromHtml = (html: string) => {
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

const getWordCountFromHtml = (html: string) => {
  const text = getPlainTextFromHtml(html).trim()
  if (!text) {
    return 0
  }
  return text.split(/\s+/).length
}

const sortByOrderThenLabel = <T extends { sortOrder?: number | null; label: string }>(
  a: T,
  b: T,
) => {
  const orderA = typeof a.sortOrder === "number" ? a.sortOrder : Number.MAX_SAFE_INTEGER
  const orderB = typeof b.sortOrder === "number" ? b.sortOrder : Number.MAX_SAFE_INTEGER

  if (orderA !== orderB) {
    return orderA - orderB
  }

  return a.label.localeCompare(b.label)
}

const sortFeatureOptions = (options: FeatureOption[]) => {
  return [...options].sort((a, b) => {
    const orderA = typeof a.sortOrder === "number" ? a.sortOrder : Number.MAX_SAFE_INTEGER
    const orderB = typeof b.sortOrder === "number" ? b.sortOrder : Number.MAX_SAFE_INTEGER

    if (orderA !== orderB) {
      return orderA - orderB
    }

    return a.label.localeCompare(b.label)
  })
}

export default function NewProjectPage() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), [])
  const [isLoadingTaxonomy, setIsLoadingTaxonomy] = useState(true)
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null)
  const [categoryOptions, setCategoryOptions] = useState<DropdownOption[]>([])
  const [projectTypeOptionsByCategory, setProjectTypeOptionsByCategory] = useState<Record<string, DropdownOption[]>>({})
  const [projectTaxonomyError, setProjectTaxonomyError] = useState<string | null>(null)
  const [styleDropdownOptions, setStyleDropdownOptions] = useState<DropdownOption[]>([
    ...FALLBACK_PROJECT_STYLE_OPTIONS,
  ])
  const [buildingTypeDropdownOptions, setBuildingTypeDropdownOptions] = useState<DropdownOption[]>([
    ...FALLBACK_BUILDING_TYPE_OPTIONS,
  ])
  const [sizeDropdownOptions, setSizeDropdownOptions] = useState<DropdownOption[]>([
    ...FALLBACK_SIZE_OPTIONS,
  ])
  const [budgetDropdownOptions, setBudgetDropdownOptions] = useState<DropdownOption[]>([
    ...FALLBACK_BUDGET_OPTIONS,
  ])
  const [locationFeatureOptions, setLocationFeatureOptions] = useState<FeatureOption[]>([
    ...FALLBACK_LOCATION_FEATURES,
  ])
  const [materialFeatureOptions, setMaterialFeatureOptions] = useState<FeatureOption[]>([
    ...FALLBACK_MATERIAL_FEATURES,
  ])
  const [currentStep, setCurrentStep] = useState(1)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [formData, setFormData] = useState<FormState>({
    category: "",
    projectType: "",
    buildingType: "",
    projectStyle: "",
    locationFeatures: [] as string[],
    materialFeatures: [] as string[],
    size: "",
    budget: "",
    yearBuilt: "",
    buildingYear: "",
    projectTitle: "",
    projectDescription: "",
    address: DEFAULT_LOCATION.address,
    latitude: DEFAULT_LOCATION.latitude,
    longitude: DEFAULT_LOCATION.longitude,
    city: DEFAULT_LOCATION.city,
    region: DEFAULT_LOCATION.region,
    shareExactLocation: false,
  })

  const [addressInputValue, setAddressInputValue] = useState(DEFAULT_LOCATION.address)
  const [isMapsApiLoaded, setIsMapsApiLoaded] = useState(false)
  const [mapsError, setMapsError] = useState<string | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const autocompleteRef = useRef<any>(null)
  const geocoderRef = useRef<any>(null)

  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const router = useRouter()
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  useEffect(() => {
    let isMounted = true

    const applyFallbackTaxonomy = () => {
      const sortedCategories = [...FALLBACK_CATEGORY_OPTIONS].sort(sortByOrderThenLabel)
      const fallbackTypes: Record<string, DropdownOption[]> = {}

      Object.entries(FALLBACK_PROJECT_TYPES).forEach(([key, options]) => {
        fallbackTypes[key] = [...options].sort(sortByOrderThenLabel)
      })

      setCategoryOptions(sortedCategories)
      setProjectTypeOptionsByCategory(fallbackTypes)
    }

    const applyFallbackProjectTaxonomy = () => {
      setStyleDropdownOptions([...FALLBACK_PROJECT_STYLE_OPTIONS].sort(sortByOrderThenLabel))
      setBuildingTypeDropdownOptions([...FALLBACK_BUILDING_TYPE_OPTIONS].sort(sortByOrderThenLabel))
      setSizeDropdownOptions([...FALLBACK_SIZE_OPTIONS].sort(sortByOrderThenLabel))
      setBudgetDropdownOptions([...FALLBACK_BUDGET_OPTIONS].sort(sortByOrderThenLabel))
      setLocationFeatureOptions(sortFeatureOptions([...FALLBACK_LOCATION_FEATURES]))
      setMaterialFeatureOptions(sortFeatureOptions([...FALLBACK_MATERIAL_FEATURES]))
    }

    const loadTaxonomy = async () => {
      setIsLoadingTaxonomy(true)
      setTaxonomyError(null)

      const { data, error } = await supabase
        .from("categories")
        .select("id,name,slug,sort_order,parent_id,project_category_attributes(is_listable,is_building_feature)")
        .eq("is_active", true)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true })

      if (!isMounted) {
        return
      }

      if (error) {
        applyFallbackTaxonomy()
        setTaxonomyError(error.message)
        setIsLoadingTaxonomy(false)
        return
      }

      const records = (data ?? []) as CategoryWithAttributes[]
      if (records.length === 0) {
        applyFallbackTaxonomy()
        setIsLoadingTaxonomy(false)
        return
      }

      const listableChildren = records.filter((record) => record.project_category_attributes?.is_listable)

      if (listableChildren.length === 0) {
        applyFallbackTaxonomy()
        setIsLoadingTaxonomy(false)
        return
      }

      const parentIds = new Set(
        listableChildren
          .map((child) => child.parent_id)
          .filter((id): id is string => Boolean(id)),
      )

      const parentOptions = records
        .filter((record) => parentIds.has(record.id))
        .map<DropdownOption>((record) => ({
          value: record.id,
          label: record.name,
          sortOrder: record.sort_order,
        }))
        .sort(sortByOrderThenLabel)

      const groupedProjectTypes = listableChildren.reduce<Record<string, DropdownOption[]>>((acc, child) => {
        if (!child.parent_id) {
          return acc
        }

        if (!acc[child.parent_id]) {
          acc[child.parent_id] = []
        }

        acc[child.parent_id].push({
          value: child.id,
          label: child.name,
          sortOrder: child.sort_order,
        })

        return acc
      }, {})

      Object.values(groupedProjectTypes).forEach((options) => options.sort(sortByOrderThenLabel))

      setCategoryOptions(parentOptions)
      setProjectTypeOptionsByCategory(groupedProjectTypes)
      setIsLoadingTaxonomy(false)
    }

    const loadProjectTaxonomy = async () => {
      setProjectTaxonomyError(null)

      const { data, error } = await supabase
        .from("project_taxonomy_options")
        .select("id, taxonomy_type, name, slug, sort_order, icon, budget_level")
        .in("taxonomy_type", [
          "project_style",
          "building_type",
          "size_range",
          "budget_tier",
          "location_feature",
          "material_feature",
        ])
        .eq("is_active", true)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true })

      if (!isMounted) {
        return
      }

      if (error || !data) {
        applyFallbackProjectTaxonomy()
        if (error) {
          setProjectTaxonomyError(error.message)
        }
        return
      }

      const grouped = data.reduce<Record<ProjectTaxonomyOption["taxonomy_type"], ProjectTaxonomyOption[]>>(
        (acc, option) => {
          if (!acc[option.taxonomy_type]) {
            acc[option.taxonomy_type] = []
          }
          acc[option.taxonomy_type].push(option)
          return acc
        },
        {
          project_style: [],
          building_type: [],
          size_range: [],
          budget_tier: [],
          location_feature: [],
          material_feature: [],
        },
      )

      const groupSortedFeatureOptions = (options: ProjectTaxonomyOption[]) => {
        return sortFeatureOptions(
          options.map<FeatureOption>((option) => ({
            value: option.id,
            label: option.name,
            iconKey: option.icon,
            sortOrder: option.sort_order,
          })),
        )
      }

      const mapDropdown = (options: ProjectTaxonomyOption[], valueSelector?: (option: ProjectTaxonomyOption) => string) =>
        options
          .map<DropdownOption>((option) => ({
            value: valueSelector ? valueSelector(option) : option.id,
            label: option.name,
            sortOrder: option.sort_order ?? undefined,
          }))
          .sort(sortByOrderThenLabel)

      const mappedLocationFeatures = groupSortedFeatureOptions(grouped.location_feature)
      const mappedMaterialFeatures = groupSortedFeatureOptions(grouped.material_feature)

      const styles = mapDropdown(grouped.project_style)
      const buildingTypes = mapDropdown(grouped.building_type)
      const sizes = mapDropdown(grouped.size_range)
      const budgets = mapDropdown(grouped.budget_tier, (option) => option.budget_level ?? option.id ?? option.slug)

      setStyleDropdownOptions(
        styles.length ? styles : [...FALLBACK_PROJECT_STYLE_OPTIONS].sort(sortByOrderThenLabel),
      )
      setBuildingTypeDropdownOptions(
        buildingTypes.length ? buildingTypes : [...FALLBACK_BUILDING_TYPE_OPTIONS].sort(sortByOrderThenLabel),
      )
      setSizeDropdownOptions(sizes.length ? sizes : [...FALLBACK_SIZE_OPTIONS].sort(sortByOrderThenLabel))
      setBudgetDropdownOptions(
        budgets.length ? budgets : [...FALLBACK_BUDGET_OPTIONS].sort(sortByOrderThenLabel),
      )
      setLocationFeatureOptions(
        mappedLocationFeatures.length ? mappedLocationFeatures : sortFeatureOptions([...FALLBACK_LOCATION_FEATURES]),
      )
      setMaterialFeatureOptions(
        mappedMaterialFeatures.length ? mappedMaterialFeatures : sortFeatureOptions([...FALLBACK_MATERIAL_FEATURES]),
      )
    }

    loadTaxonomy()
    loadProjectTaxonomy()

    return () => {
      isMounted = false
    }
  }, [supabase])

  useEffect(() => {
    setAddressInputValue(formData.address)
  }, [formData.address])

  useEffect(() => {
    if (typeof window !== "undefined" && window.google?.maps) {
      setIsMapsApiLoaded(true)
    }
  }, [])

  const projectTypeOptions =
    formData.category && projectTypeOptionsByCategory[formData.category]
      ? projectTypeOptionsByCategory[formData.category]
      : []
  const projectStyleOptions = useMemo(
    () => [...styleDropdownOptions].sort(sortByOrderThenLabel),
    [styleDropdownOptions],
  )
  const buildingTypeOptions = useMemo(
    () => [...buildingTypeDropdownOptions].sort(sortByOrderThenLabel),
    [buildingTypeDropdownOptions],
  )
  const sizeOptions = useMemo(
    () => [...sizeDropdownOptions].sort(sortByOrderThenLabel),
    [sizeDropdownOptions],
  )
  const budgetOptions = useMemo(
    () => [...budgetDropdownOptions].sort(sortByOrderThenLabel),
    [budgetDropdownOptions],
  )

  const yearFieldValidation = useMemo(
    () => generateYearErrorMessages(formData, { treatEmptyAsError: false }),
    [formData],
  )
  const isYearBuiltComplete = formData.yearBuilt.trim() !== ""
  const isBuildingYearComplete = formData.buildingYear.trim() !== ""
  const isYearBuiltValidForState = isYearBuiltComplete && !yearFieldValidation.errors.yearBuilt
  const isBuildingYearValidForState = isBuildingYearComplete && !yearFieldValidation.errors.buildingYear

  const locationFeaturesData = useMemo(
    () =>
      locationFeatureOptions.map((option, index) => {
        const IconComponent = resolveIconComponent(option.iconKey) ??
          DEFAULT_LOCATION_ICONS[index % DEFAULT_LOCATION_ICONS.length]

        return {
          value: option.value,
          label: option.label,
          icon: IconComponent,
        }
      }),
    [locationFeatureOptions],
  )

  const materialFeaturesData = useMemo(
    () =>
      materialFeatureOptions.map((option, index) => {
        const IconComponent = resolveIconComponent(option.iconKey) ??
          DEFAULT_MATERIAL_ICONS[index % DEFAULT_MATERIAL_ICONS.length]

        return {
          value: option.value,
          label: option.label,
          icon: IconComponent,
        }
      }),
    [materialFeatureOptions],
  )

  const updateYearFieldErrors = (state: FormState, options?: { treatEmptyAsError?: boolean }) => {
    const { errors } = generateYearErrorMessages(state, options)

    setValidationErrors((prev) => {
      const next = { ...prev }
      delete next.yearBuilt
      delete next.buildingYear

      return Object.keys(errors).length > 0 ? { ...next, ...errors } : next
    })
  }

  const setFieldError = (field: string, message: string) => {
    setValidationErrors((prev) => {
      if (prev[field] === message) {
        return prev
      }

      return { ...prev, [field]: message }
    })
  }

  const clearFieldError = (field: string) => {
    setValidationErrors((prev) => {
      if (!prev[field]) {
        return prev
      }

      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const handleDropdownSelect = (field: SelectField, value: string) => {
    setFormData((prev) => {
      if (field === "category") {
        return {
          ...prev,
          category: value,
          projectType: "",
        }
      }

      return {
        ...prev,
        [field]: value,
      } as FormState
    })
    setOpenDropdown(null)
    clearFieldError(field)
  }

  const handleInputChange = (field: TextField, value: string) => {
    if (field === "yearBuilt" || field === "buildingYear") {
      setFormData((prev) => {
        const next = {
          ...prev,
          [field]: value,
        }

        updateYearFieldErrors(next)
        return next
      })
    } else if (field === "address") {
      setAddressInputValue(value)
      setFormData((prev) => ({
        ...prev,
        address: value,
        latitude: null,
        longitude: null,
        city: "",
        region: "",
      }))
      clearFieldError(field)
    } else {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }))
      clearFieldError(field)
    }
  }

  useEffect(() => {
    if (currentStep !== 5 || !isMapsApiLoaded) {
      return
    }

    if (typeof window === "undefined" || !window.google || !mapContainerRef.current) {
      return
    }

    const startPosition =
      formData.latitude !== null && formData.longitude !== null
        ? { lat: formData.latitude, lng: formData.longitude }
        : DEFAULT_MAP_CENTER

    if (!mapInstanceRef.current) {
      const map = new window.google.maps.Map(mapContainerRef.current, {
        center: startPosition,
        zoom: formData.latitude !== null ? 15 : DEFAULT_MAP_ZOOM,
        mapTypeControl: true,
        fullscreenControl: false,
        streetViewControl: false,
        zoomControl: true,
      })

      mapInstanceRef.current = map

      const marker = new window.google.maps.Marker({
        map,
        position: startPosition,
        draggable: true,
      })

      markerRef.current = marker
      geocoderRef.current = new window.google.maps.Geocoder()

      marker.addListener("dragend", () => {
        const position = marker.getPosition()
        if (!position) {
          return
        }

        const lat = position.lat()
        const lng = position.lng()

        setFormData((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
        }))

        const geocoder = geocoderRef.current ?? new window.google.maps.Geocoder()
        geocoderRef.current = geocoder

        geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
          if (status === "OK" && results?.length) {
            const primary = results[0]
            const formattedAddress = primary.formatted_address ?? ""
            const { city, region } = extractCityAndRegion(primary.address_components ?? [])

            setFormData((prev) => ({
              ...prev,
              address: formattedAddress,
              latitude: lat,
              longitude: lng,
              city,
              region,
            }))
            setAddressInputValue(formattedAddress)
            setValidationErrors((prev) => {
              if (!prev.address) {
                return prev
              }

              const nextErrors = { ...prev }
              delete nextErrors.address
              return nextErrors
            })
          }
        })
      })
    }

    if (!autocompleteRef.current && searchInputRef.current) {
      const autocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current, {
        fields: ["formatted_address", "geometry", "address_components"],
        types: ["geocode"],
      })

      autocompleteRef.current = autocomplete

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace()
        if (!place || !place.geometry?.location) {
          return
        }

        const location = place.geometry.location
        const lat = location.lat()
        const lng = location.lng()
        const formattedAddress = place.formatted_address ?? searchInputRef.current?.value ?? ""
        const { city, region } = extractCityAndRegion(place.address_components ?? [])

        setFormData((prev) => ({
          ...prev,
          address: formattedAddress,
          latitude: lat,
          longitude: lng,
          city,
          region,
        }))
        setAddressInputValue(formattedAddress)
        setValidationErrors((prev) => {
          if (!prev.address) {
            return prev
          }

          const nextErrors = { ...prev }
          delete nextErrors.address
          return nextErrors
        })

        if (markerRef.current) {
          markerRef.current.setPosition({ lat, lng })
        }

        if (mapInstanceRef.current) {
          if (place.geometry.viewport) {
            mapInstanceRef.current.fitBounds(place.geometry.viewport)
          } else {
            mapInstanceRef.current.panTo({ lat, lng })
            mapInstanceRef.current.setZoom(15)
          }
        }
      })
    }
  }, [currentStep, formData.latitude, formData.longitude, isMapsApiLoaded])

  useEffect(() => {
    if (currentStep !== 5) {
      if (window?.google?.maps) {
        if (markerRef.current) {
          window.google.maps.event.clearInstanceListeners(markerRef.current)
        }
        if (autocompleteRef.current) {
          window.google.maps.event.clearInstanceListeners(autocompleteRef.current)
        }
        if (mapInstanceRef.current) {
          window.google.maps.event.clearInstanceListeners(mapInstanceRef.current)
        }
      }

      markerRef.current = null
      autocompleteRef.current = null
      mapInstanceRef.current = null
    }
  }, [currentStep])

  useEffect(() => {
    if (
      currentStep !== 5 ||
      formData.latitude === null ||
      formData.longitude === null ||
      !mapInstanceRef.current ||
      !markerRef.current
    ) {
      return
    }

    const position = { lat: formData.latitude, lng: formData.longitude }
    markerRef.current.setPosition(position)
    mapInstanceRef.current.panTo(position)
  }, [currentStep, formData.latitude, formData.longitude])

  type DescriptionFormattingCommand = "bold" | "italic" | "underline" | "bulletList" | "orderedList"

  const descriptionEditor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: {
          keepAttributes: false,
          keepMarks: true,
        },
        orderedList: {
          keepAttributes: false,
          keepMarks: true,
        },
      }),
      Underline,
    ],
    content: formData.projectDescription || "",
    editorProps: {
      attributes: {
        spellCheck: "true",
      },
    },
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      const normalizedHtml = html === "<p></p>" ? "" : html

      setFormData((prev) => {
        if (prev.projectDescription === normalizedHtml) {
          return prev
        }

        return {
          ...prev,
          projectDescription: normalizedHtml,
        }
      })

      const plainTextLength = editor.getText().trim().length

      if (plainTextLength === 0) {
        setFieldError("projectDescription", "Add a project description.")
      } else if (plainTextLength < MIN_DESCRIPTION_LENGTH) {
        setFieldError(
          "projectDescription",
          `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters.`,
        )
      } else {
        clearFieldError("projectDescription")
      }
    },
  })

  useEffect(() => {
    if (!descriptionEditor) {
      return
    }

    const currentHtml = descriptionEditor.getHTML()
    const normalizedCurrent = currentHtml === "<p></p>" ? "" : currentHtml
    const desiredHtml = formData.projectDescription || ""

    if (normalizedCurrent !== desiredHtml) {
      descriptionEditor.commands.setContent(desiredHtml === "" ? "<p></p>" : desiredHtml, false)
    }
  }, [descriptionEditor, formData.projectDescription])

  const applyDescriptionFormatting = (command: DescriptionFormattingCommand) => {
    if (!descriptionEditor) {
      return
    }

    const chain = descriptionEditor.chain().focus()

    switch (command) {
      case "bold":
        chain.toggleBold()
        break
      case "italic":
        chain.toggleItalic()
        break
      case "underline":
        chain.toggleUnderline()
        break
      case "bulletList":
        chain.toggleBulletList()
        break
      case "orderedList":
        chain.toggleOrderedList()
        break
      default:
        break
    }

    chain.run()
  }

  const getFormattingButtonClass = (active: boolean) => {
    return `flex h-8 w-8 items-center justify-center rounded-md text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-gray-900 ${
      active ? "bg-gray-200 text-gray-900" : "text-gray-600 hover:bg-gray-100"
    } disabled:cursor-not-allowed disabled:opacity-40`
  }

  const handleCheckboxChange = (field: "locationFeatures" | "materialFeatures", value: string) => {
    const currentValues = formData[field]
    const newValues = currentValues.includes(value)
      ? currentValues.filter((v) => v !== value)
      : [...currentValues, value]

    setFormData({ ...formData, [field]: newValues })
    if (newValues.length > 0) {
      clearFieldError(field)
    }
  }

  const validateStep = (step: number) => {
    const stepFields: string[] = []
    const newErrors: Record<string, string> = {}

    if (step === 1) {
      stepFields.push("category", "projectType", "buildingType", "projectStyle")

      if (!formData.category) {
        newErrors.category = "Select a project category."
      }
      if (!formData.projectType) {
        newErrors.projectType = "Select a project type."
      }
      if (!formData.buildingType) {
        newErrors.buildingType = "Select a building type."
      }
      if (!formData.projectStyle) {
        newErrors.projectStyle = "Select a project style."
      }
    } else if (step === 2) {
      stepFields.push("locationFeatures", "materialFeatures")

      if (formData.locationFeatures.length === 0) {
        newErrors.locationFeatures = "Select at least one location feature."
      }
      if (formData.materialFeatures.length === 0) {
        newErrors.materialFeatures = "Select at least one material feature."
      }
    } else if (step === 3) {
      stepFields.push("size", "budget", "yearBuilt", "buildingYear")

      if (!formData.size) {
        newErrors.size = "Select a size range."
      }
      if (!formData.budget) {
        newErrors.budget = "Select a budget tier."
      }

      const yearErrors = generateYearErrorMessages(formData, { treatEmptyAsError: true }).errors

      if (yearErrors.yearBuilt) {
        newErrors.yearBuilt = yearErrors.yearBuilt
      }
      if (yearErrors.buildingYear) {
        newErrors.buildingYear = yearErrors.buildingYear
      }
    } else if (step === 4) {
      stepFields.push("projectTitle", "projectDescription")

      const trimmedTitle = formData.projectTitle.trim()
      if (!trimmedTitle) {
        newErrors.projectTitle = "Add a project title."
      } else if (trimmedTitle.length > MAX_TITLE_LENGTH) {
        newErrors.projectTitle = `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`
      }

      const descriptionPlain = getPlainTextFromHtml(formData.projectDescription).trim()
      if (!descriptionPlain) {
        newErrors.projectDescription = "Add a project description."
      } else if (descriptionPlain.length < MIN_DESCRIPTION_LENGTH) {
        newErrors.projectDescription = `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters.`
      }
    } else if (step === 5) {
      stepFields.push("address")
      if (!formData.address.trim()) {
        newErrors.address = "Enter the project address."
      } else if (formData.latitude === null || formData.longitude === null) {
        newErrors.address = "Select a valid address from the suggestions or map."
      }
    }

    setValidationErrors((prev) => {
      const next = { ...prev }
      stepFields.forEach((field) => {
        if (!newErrors[field]) {
          delete next[field]
        }
      })

      return Object.keys(newErrors).length > 0 ? { ...next, ...newErrors } : next
    })

    return Object.keys(newErrors).length === 0
  }

  const trimmedTitle = formData.projectTitle.trim()
  const descriptionPlainText = getPlainTextFromHtml(formData.projectDescription)
  const descriptionPlainTextLength = descriptionPlainText.trim().length
  const descriptionWordCount = getWordCountFromHtml(formData.projectDescription)
  const isDescriptionTooShort = descriptionPlainTextLength < MIN_DESCRIPTION_LENGTH

  const isNextDisabled =
    (currentStep === 1 &&
      (!formData.category || !formData.projectType || !formData.buildingType || !formData.projectStyle)) ||
    (currentStep === 2 &&
      (formData.locationFeatures.length === 0 || formData.materialFeatures.length === 0)) ||
    (currentStep === 3 &&
      (!formData.size ||
        !formData.budget ||
        !isYearBuiltValidForState ||
        !isBuildingYearValidForState)) ||
    (currentStep === 4 &&
      (!trimmedTitle ||
        trimmedTitle.length > MAX_TITLE_LENGTH ||
        descriptionPlainTextLength === 0 ||
        descriptionPlainTextLength < MIN_DESCRIPTION_LENGTH)) ||
    (currentStep === 5 &&
      (!formData.address.trim() || formData.latitude === null || formData.longitude === null))

  const handleNext = () => {
    if (!validateStep(currentStep)) {
      return
    }

    if (currentStep < 5) {
      setCurrentStep(currentStep + 1)
    } else {
      console.log("Form submitted with data:", formData)
      router.push("/new-project/photos")
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const CustomDropdown = ({
    field,
    placeholder,
    value,
    options,
    disabled = false,
    isLoading = false,
  }: {
    field: SelectField
    placeholder: string
    value: string
    options: DropdownOption[]
    disabled?: boolean
    isLoading?: boolean
  }) => {
    const isOpen = openDropdown === field
    const selectedOption = options.find((opt) => opt.value === value)
    const buttonLabel = selectedOption?.label ?? (isLoading ? "Loading options..." : placeholder)
    const isDisabled = disabled || isLoading
    const [searchQuery, setSearchQuery] = useState("")

    useEffect(() => {
      if (!isOpen && searchQuery !== "") {
        setSearchQuery("")
      }
    }, [isOpen, searchQuery])

    const filteredOptions = useMemo(() => {
      const term = searchQuery.trim().toLowerCase()
      if (!term) {
        return options
      }

      return options.filter((option) => option.label.toLowerCase().includes(term))
    }, [options, searchQuery])

    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            if (isDisabled) {
              return
            }
            setOpenDropdown(isOpen ? null : field)
          }}
          disabled={isDisabled}
          className={`w-full px-4 py-3 border border-gray-300 rounded-md bg-white text-left text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors ${
            isDisabled ? "cursor-not-allowed opacity-60" : "hover:border-gray-400"
          }`}
        >
          <span className={selectedOption ? "text-gray-900" : "text-gray-500"}>{buttonLabel}</span>
          <ChevronDown
            className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 transition-transform ${
              isOpen ? "rotate-180" : ""
            } ${isDisabled ? "opacity-40" : ""}`}
          />
        </button>

        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
            <div className="p-2 border-b border-gray-200 bg-gray-50">
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search options"
                autoFocus
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>
            <div className="max-h-60 overflow-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500">
                  {options.length === 0 && !searchQuery
                    ? isLoading
                      ? "Loading options..."
                      : "No options available"
                    : "No matches found"}
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleDropdownSelect(field, option.value)}
                    className="w-full px-4 py-3 text-left text-gray-900 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors"
                  >
                    {option.label}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  const CheckboxGrid = ({
    title,
    items,
    selectedValues,
    onChange,
    error,
  }: {
    title: string
    items: { value: string; label: string; icon: LucideIcon }[]
    selectedValues: string[]
    onChange: (value: string) => void
    error?: string
  }) => (
    <div>
      <label className="block text-base font-medium text-gray-900 mb-4">
        {title} <span className="text-red-500">*</span>
      </label>
      <div className="grid grid-cols-2 gap-4">
        {items.map((item) => {
          const IconComponent = item.icon
          const isSelected = selectedValues.includes(item.value)

          return (
            <label
              key={item.value}
              className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded-md transition-colors"
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onChange(item.value)}
                className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
              />
              <IconComponent className="w-5 h-5 text-gray-600" />
              <span className="text-gray-900">{item.label}</span>
            </label>
          )
        })}
      </div>
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  )

  const handleToggleChange = (value: boolean) => {
    setFormData((prev) => ({
      ...prev,
      shareExactLocation: value,
    }))
  }

  return (
    <div className="min-h-screen bg-white">
      <NewProjectHeader />
      <main className="container mx-auto px-4 py-16 max-w-4xl pb-32">
        <div className="text-left">
          <div className="mb-12">
            <ProgressIndicator currentStep={currentStep} totalSteps={5} />
          </div>

          {currentStep === 1 && (
            <>
              {/* Building icon */}
              <div className="mb-8">
                <Building2 className="w-16 h-16 text-gray-900" strokeWidth={1.5} />
              </div>

              {/* Main heading */}
              <h1 className="text-3xl font-bold text-gray-900 mb-6 leading-tight">What project have you realised?</h1>

              {projectTaxonomyError && (
                <p className="text-sm text-amber-600 mb-6">
                  We could not load the latest taxonomy data, so fallback values are shown for now.
                </p>
              )}

              {/* Form */}
              <div className="space-y-8">
                {/* Category */}
                <div>
                  <label className="block text-base font-medium text-gray-900 mb-3">
                    What is the category of your project? <span className="text-red-500">*</span>
                  </label>
                  <CustomDropdown
                    field="category"
                    placeholder="Select a category"
                    value={formData.category}
                    options={categoryOptions}
                    isLoading={isLoadingTaxonomy}
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    Choose the main category that best describes your project
                  </p>
                  {taxonomyError && (
                    <p className="text-sm text-amber-600 mt-2">
                      We could not reach Supabase; showing fallback taxonomy options for now.
                    </p>
                  )}
                  {validationErrors.category && (
                    <p className="text-sm text-red-600 mt-2">{validationErrors.category}</p>
                  )}
                </div>

                {/* Project Type */}
                <div>
                  <label className="block text-base font-medium text-gray-900 mb-3">
                    Project type <span className="text-red-500">*</span>
                  </label>
                  <CustomDropdown
                    field="projectType"
                    placeholder="Select a project type"
                    value={formData.projectType}
                    options={projectTypeOptions}
                    disabled={!formData.category || isLoadingTaxonomy}
                    isLoading={isLoadingTaxonomy}
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    Select the specific subtype within your chosen category (e.g., Villa, Kitchen)
                  </p>
                  {validationErrors.projectType && (
                    <p className="text-sm text-red-600 mt-2">{validationErrors.projectType}</p>
                  )}
                </div>

                {/* Building Type */}
                <div>
                  <label className="block text-base font-medium text-gray-900 mb-3">
                    Building type <span className="text-red-500">*</span>
                  </label>
                  <CustomDropdown
                    field="buildingType"
                    placeholder="Select a building type"
                    value={formData.buildingType}
                    options={buildingTypeOptions}
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    Indicate whether the project was a new build, renovation, or interior design scope
                  </p>
                  {validationErrors.buildingType && (
                    <p className="text-sm text-red-600 mt-2">{validationErrors.buildingType}</p>
                  )}
                </div>

                {/* Project Style */}
                <div>
                  <label className="block text-base font-medium text-gray-900 mb-3">
                    Project style <span className="text-red-500">*</span>
                  </label>
                  <CustomDropdown
                    field="projectStyle"
                    placeholder="Select a project style"
                    value={formData.projectStyle}
                    options={projectStyleOptions}
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    Choose the architectural or design style that best represents your project
                  </p>
                  {validationErrors.projectStyle && (
                    <p className="text-sm text-red-600 mt-2">{validationErrors.projectStyle}</p>
                  )}
                </div>
              </div>
            </>
          )}

          {currentStep === 2 && (
            <>
              {/* Main heading */}
              <h1 className="text-3xl font-bold text-gray-900 mb-12 leading-tight">
                Describe the location and materials used
              </h1>

              {projectTaxonomyError && (
                <p className="text-sm text-amber-600 mb-8">
                  Feature options are using fallback values because taxonomy data is temporarily unavailable.
                </p>
              )}

              {/* Form */}
              <div className="space-y-12">
                {/* Location Features */}
                <CheckboxGrid
                  title="Location features"
                  items={locationFeaturesData}
                  selectedValues={formData.locationFeatures}
                  onChange={(value) => handleCheckboxChange("locationFeatures", value)}
                  error={validationErrors.locationFeatures}
                />

                {/* Material Features */}
                <CheckboxGrid
                  title="Material features"
                  items={materialFeaturesData}
                  selectedValues={formData.materialFeatures}
                  onChange={(value) => handleCheckboxChange("materialFeatures", value)}
                  error={validationErrors.materialFeatures}
                />
              </div>
            </>
          )}

          {currentStep === 3 && (
            <>
              {/* Main heading */}
              <h1 className="text-3xl font-bold text-gray-900 mb-12 leading-tight">Add some details</h1>

              {/* Form */}
              <div className="space-y-8">
                {/* Size */}
                <div>
                  <label className="block text-base font-medium text-gray-900 mb-3">
                    Size <span className="text-red-500">*</span>
                  </label>
                  <CustomDropdown
                    field="size"
                    placeholder="Select size"
                    value={formData.size}
                    options={sizeOptions}
                  />
                  <p className="text-sm text-gray-500 mt-2">Choose the overall size category of your project</p>
                  {validationErrors.size && (
                    <p className="text-sm text-red-600 mt-2">{validationErrors.size}</p>
                  )}
                </div>

                {/* Budget */}
                <div>
                  <label className="block text-base font-medium text-gray-900 mb-3">
                    Budget <span className="text-red-500">*</span>
                  </label>
                  <CustomDropdown
                    field="budget"
                    placeholder="Select budget range"
                    value={formData.budget}
                    options={budgetOptions}
                  />
                  <p className="text-sm text-gray-500 mt-2">Select the tier that best represents your total investment</p>
                  {validationErrors.budget && (
                    <p className="text-sm text-red-600 mt-2">{validationErrors.budget}</p>
                  )}
                </div>

                {/* Year built */}
                <div>
                  <label className="block text-base font-medium text-gray-900 mb-3">
                    Year built <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.yearBuilt}
                    onChange={(e) => handleInputChange("yearBuilt", e.target.value)}
                    placeholder="2022"
                    min="1800"
                    max={new Date().getFullYear()}
                    className="w-full px-4 py-3 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent hover:border-gray-400 transition-colors"
                  />
                  <p className="text-sm text-gray-500 mt-2">Enter the year when construction was completed</p>
                  {validationErrors.yearBuilt && (
                    <p className="text-sm text-red-600 mt-2">{validationErrors.yearBuilt}</p>
                  )}
                </div>

                {/* Building year */}
                <div>
                  <label className="block text-base font-medium text-gray-900 mb-3">
                    Building year <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.buildingYear}
                    onChange={(e) => handleInputChange("buildingYear", e.target.value)}
                    placeholder="1930"
                    min="1800"
                    max={new Date().getFullYear()}
                    className="w-full px-4 py-3 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent hover:border-gray-400 transition-colors"
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    Enter the original construction year if different from completion
                  </p>
                  {validationErrors.buildingYear && (
                    <p className="text-sm text-red-600 mt-2">{validationErrors.buildingYear}</p>
                  )}
                </div>
              </div>
            </>
          )}

          {currentStep === 4 && (
            <>
              {/* Main heading */}
              <h1 className="text-3xl font-bold text-gray-900 mb-12 leading-tight">
                Give your project a title and description
              </h1>

              {/* Form */}
              <div className="space-y-8">
                {/* Project Title */}
                <div>
                  <label className="block text-base font-medium text-gray-900 mb-3">
                    Project title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.projectTitle}
                    onChange={(e) => handleInputChange("projectTitle", e.target.value)}
                    placeholder="Project title"
                    className="w-full px-4 py-3 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent hover:border-gray-400 transition-colors"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-sm text-gray-500">Give your project a memorable and descriptive title</p>
                    <span className={`text-sm ${
                      formData.projectTitle.length > MAX_TITLE_LENGTH ? "text-red-600" : "text-gray-400"
                    }`}>
                      {formData.projectTitle.length}/{MAX_TITLE_LENGTH}
                    </span>
                  </div>
                  {validationErrors.projectTitle && (
                    <p className="text-sm text-red-600 mt-2">{validationErrors.projectTitle}</p>
                  )}
                </div>

                {/* Project Description */}
                <div>
                  <label className="block text-base font-medium text-gray-900 mb-3">
                    Project description <span className="text-red-500">*</span>
                  </label>
                  <div
                    className={`rounded-md border bg-white transition-colors focus-within:ring-2 ${
                      validationErrors.projectDescription
                        ? "border-red-500 focus-within:border-red-500 focus-within:ring-red-500"
                        : "border-gray-300 focus-within:border-transparent focus-within:ring-gray-900"
                    }`}
                  >
                    {descriptionEditor ? (
                      <>
                        <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 px-3 py-2">
                          <button
                            type="button"
                            className={getFormattingButtonClass(descriptionEditor.isActive("bold"))}
                            aria-label="Bold"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={(event) => {
                              event.preventDefault()
                              applyDescriptionFormatting("bold")
                            }}
                          >
                            B
                          </button>
                          <button
                            type="button"
                            className={getFormattingButtonClass(descriptionEditor.isActive("italic"))}
                            aria-label="Italic"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={(event) => {
                              event.preventDefault()
                              applyDescriptionFormatting("italic")
                            }}
                          >
                            <span className="italic">I</span>
                          </button>
                          <button
                            type="button"
                            className={getFormattingButtonClass(descriptionEditor.isActive("underline"))}
                            aria-label="Underline"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={(event) => {
                              event.preventDefault()
                              applyDescriptionFormatting("underline")
                            }}
                          >
                            <span className="underline">U</span>
                          </button>
                          <span className="mx-1 h-8 w-px bg-gray-200" aria-hidden="true" />
                          <button
                            type="button"
                            className={getFormattingButtonClass(descriptionEditor.isActive("bulletList"))}
                            aria-label="Bulleted list"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={(event) => {
                              event.preventDefault()
                              applyDescriptionFormatting("bulletList")
                            }}
                          >
                            •
                          </button>
                          <button
                            type="button"
                            className={getFormattingButtonClass(descriptionEditor.isActive("orderedList"))}
                            aria-label="Numbered list"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={(event) => {
                              event.preventDefault()
                              applyDescriptionFormatting("orderedList")
                            }}
                          >
                            1.
                          </button>
                        </div>
                        <div className="relative">
                          <EditorContent
                            editor={descriptionEditor}
                            aria-label="Project description editor"
                            className="px-4 py-3 text-gray-900 focus:outline-none [&_.ProseMirror]:min-h-[180px] [&_.ProseMirror]:whitespace-pre-wrap [&_.ProseMirror]:break-words [&_.ProseMirror]:outline-none [&_.ProseMirror]:focus:outline-none [&_.ProseMirror]:text-base [&_.ProseMirror]:leading-relaxed [&_.ProseMirror]:space-y-4 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_li]:pl-1"
                          />
                          {descriptionPlainTextLength === 0 && (
                            <span className="pointer-events-none absolute left-4 top-3 text-sm text-gray-400">
                              Describe the project, its scope, and unique details
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="px-4 py-6 text-sm text-gray-500">Loading editor…</div>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-gray-500">
                      Provide a detailed description of your project, including key features and design elements
                    </p>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>{descriptionWordCount} words</span>
                      <span className={isDescriptionTooShort ? "text-red-600" : "text-gray-400"}>
                        {descriptionPlainTextLength}/{MIN_DESCRIPTION_LENGTH}+ characters
                      </span>
                    </div>
                  </div>
                  {validationErrors.projectDescription && (
                    <p className="text-sm text-red-600 mt-2">{validationErrors.projectDescription}</p>
                  )}
                </div>
              </div>
            </>
          )}

          {currentStep === 5 && (
            <>
              {/* Main heading */}
              <h1 className="text-3xl font-bold text-gray-900 mb-12 leading-tight">Where is the project located?</h1>

              {/* Form */}
              <div className="space-y-8">
                {/* Map Container */}
                <div className="relative">
                  {googleMapsApiKey ? (
                    <>
                      <Script
                        src={`https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places`}
                        strategy="lazyOnload"
                        onLoad={() => {
                          if (window.google?.maps) {
                            setIsMapsApiLoaded(true)
                            setMapsError(null)
                          } else {
                            setMapsError("Google Maps failed to initialize. Refresh the page to try again.")
                          }
                        }}
                        onError={() =>
                          setMapsError("We couldn't load Google Maps. Check your connection and try again.")
                        }
                      />
                      <div className="relative w-full h-96 bg-gray-100 rounded-lg overflow-hidden">
                        <div ref={mapContainerRef} className="h-full w-full" />
                        <div className="pointer-events-none absolute top-4 left-0 right-0 z-10 flex justify-center px-4">
                          <input
                            ref={searchInputRef}
                            type="text"
                            value={addressInputValue}
                            onChange={(event) => handleInputChange("address", event.target.value)}
                            placeholder="Search for your address"
                            className="pointer-events-auto w-full max-w-xl px-4 py-3 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent hover:border-gray-400 transition-colors"
                          />
                        </div>
                        {!isMapsApiLoaded && !mapsError && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white/60 text-gray-700">
                            Loading map...
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                      Add your Google Maps API key to `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to enable address
                      autocomplete and map selection.
                    </div>
                  )}
                  <p className="text-sm text-gray-500 mt-2">
                    Search for your project location or drag the pin on the map to fine-tune it
                  </p>
                  {mapsError && <p className="text-sm text-red-600 mt-2">{mapsError}</p>}
                  {validationErrors.address && (
                    <p className="text-sm text-red-600 mt-2">{validationErrors.address}</p>
                  )}
                  <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm font-medium text-gray-900">Selected address</p>
                    <p className="mt-1 text-sm text-gray-700">
                      {formData.address
                        ? formData.address
                        : "Start typing in the search box or drag the map pin to capture the address."}
                    </p>
                  </div>
                </div>

                {/* Share exact location toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h3 className="text-base font-medium text-gray-900 mb-1">
                      Share the exact location of the project
                    </h3>
                    <p className="text-sm text-gray-500">Allow others to see the precise location of your project</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleChange(!formData.shareExactLocation)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 ${
                      formData.shareExactLocation ? "bg-gray-900" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.shareExactLocation ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
        <div className="container mx-auto max-w-4xl">
          <div className="flex gap-4">
            <button
              onClick={handleBack}
              className="flex-1 bg-white text-gray-900 py-3 px-6 rounded-md font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleNext}
              disabled={isNextDisabled}
              className="flex-1 bg-gray-900 text-white py-3 px-6 rounded-md font-medium hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {currentStep === 5 ? "Complete" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProgressIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="w-full">
      {/* Step counter */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-900">
          Step {currentStep} of {totalSteps}
        </span>
        <span className="text-sm text-gray-500">{Math.round((currentStep / totalSteps) * 100)}% complete</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-gray-900 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        />
      </div>
    </div>
  )
}

function NewProjectHeader() {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo on the left */}
          <div className="flex-shrink-0">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg"
              alt="Arco"
              className="h-6"
            />
          </div>

          {/* Right side navigation */}
          <div className="flex items-center space-x-4">
            {/* Questions link */}
            <a
              href="/help-center"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              Questions?
            </a>

            {/* Save and Exit button */}
            <button className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              Save and Exit
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
