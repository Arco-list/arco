"use client"
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  Suspense,
  useMemo,
  useReducer,
  useCallback,
  type ReactNode,
} from "react"
import { debounce } from "lodash-es"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { useProjectTaxonomy } from "@/hooks/use-project-taxonomy"

const DEFAULT_RANGE: [number | null, number | null] = [null, null]

const normalizeToken = (value: string) => value.trim().toLowerCase()

interface TokenMaps {
  tokenToId: Map<string, string>
  idToToken: Map<string, string>
  idToLabel: Map<string, string>
}

interface TokenMapConfig<T> {
  getId: (item: T) => string | null | undefined
  getLabel: (item: T) => string
  getPreferredToken?: (item: T) => string | null | undefined
  getExtraTokens?: (item: T) => Array<string | null | undefined>
}

const createTokenMaps = <T,>(items: T[] | undefined, config: TokenMapConfig<T>): TokenMaps => {
  const tokenToId = new Map<string, string>()
  const idToToken = new Map<string, string>()
  const idToLabel = new Map<string, string>()

  if (!items) return { tokenToId, idToToken, idToLabel }

  const registerToken = (token: string | null | undefined, id: string) => {
    if (!token) return
    tokenToId.set(token, id)
    tokenToId.set(normalizeToken(token), id)
  }

  items.forEach((item) => {
    const id = config.getId(item)
    if (!id) return

    const label = config.getLabel(item)
    idToLabel.set(id, label)

    registerToken(id, id)
    registerToken(label, id)

    const preferredToken = config.getPreferredToken?.(item)
    if (preferredToken && preferredToken !== id) {
      registerToken(preferredToken, id)
    }

    const extraTokens = config.getExtraTokens?.(item) ?? []
    extraTokens.forEach((extra) => {
      if (extra && extra !== id && extra !== preferredToken) {
        registerToken(extra, id)
      }
    })

    if (!idToToken.has(id)) {
      if (preferredToken) {
        idToToken.set(id, preferredToken)
      } else {
        idToToken.set(id, label)
      }
    }
  })

  return { tokenToId, idToToken, idToLabel }
}

const needsResolution = (values: string[], maps?: TokenMaps) => {
  if (!maps) return false
  return values.some((value) => {
    if (maps.idToToken.has(value)) return false
    if (maps.tokenToId.has(value)) return true
    const normalized = normalizeToken(value)
    return maps.tokenToId.has(normalized)
  })
}

const parseCommaSeparatedParam = (value: string | null) =>
  value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : []

const parseNumericParam = (value: string | null): number | null => {
  if (value === null) return null
  const trimmed = value.trim()
  if (trimmed === "") return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

const areStringArraysEqual = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

const areRangesEqual = (a: [number | null, number | null], b: [number | null, number | null]) =>
  a[0] === b[0] && a[1] === b[1]

interface FilterState {
  selectedTypes: string[]
  selectedStyles: string[]
  selectedLocation: string
  selectedFeatures: string[]
  selectedBuildingTypes: string[]
  selectedLocationFeatures: string[]
  selectedBuildingFeatures: string[]
  selectedMaterialFeatures: string[]
  selectedSizes: string[]
  selectedBudgets: string[]
  projectYearRange: [number | null, number | null]
  buildingYearRange: [number | null, number | null]
}

const INITIAL_FILTER_STATE: FilterState = {
  selectedTypes: [],
  selectedStyles: [],
  selectedLocation: "",
  selectedFeatures: [],
  selectedBuildingTypes: [],
  selectedLocationFeatures: [],
  selectedBuildingFeatures: [],
  selectedMaterialFeatures: [],
  selectedSizes: [],
  selectedBudgets: [],
  projectYearRange: [null, null],
  buildingYearRange: [null, null],
}

type FilterAction =
  | { type: "SET_TYPES"; payload: string[] }
  | { type: "SET_STYLES"; payload: string[] }
  | { type: "SET_LOCATION"; payload: string }
  | { type: "SET_FEATURES"; payload: string[] }
  | { type: "SET_BUILDING_TYPES"; payload: string[] }
  | { type: "SET_LOCATION_FEATURES"; payload: string[] }
  | { type: "SET_BUILDING_FEATURES"; payload: string[] }
  | { type: "SET_MATERIAL_FEATURES"; payload: string[] }
  | { type: "SET_SIZES"; payload: string[] }
  | { type: "SET_BUDGETS"; payload: string[] }
  | { type: "SET_PROJECT_YEAR_RANGE"; payload: [number | null, number | null] }
  | { type: "SET_BUILDING_YEAR_RANGE"; payload: [number | null, number | null] }
  | { type: "RESET" }

const filterReducer = (state: FilterState, action: FilterAction): FilterState => {
  switch (action.type) {
    case "SET_TYPES":
      return { ...state, selectedTypes: action.payload }
    case "SET_STYLES":
      return { ...state, selectedStyles: action.payload }
    case "SET_LOCATION":
      return { ...state, selectedLocation: action.payload }
    case "SET_FEATURES":
      return { ...state, selectedFeatures: action.payload }
    case "SET_BUILDING_TYPES":
      return { ...state, selectedBuildingTypes: action.payload }
    case "SET_LOCATION_FEATURES":
      return { ...state, selectedLocationFeatures: action.payload }
    case "SET_BUILDING_FEATURES":
      return { ...state, selectedBuildingFeatures: action.payload }
    case "SET_MATERIAL_FEATURES":
      return { ...state, selectedMaterialFeatures: action.payload }
    case "SET_SIZES":
      return { ...state, selectedSizes: action.payload }
    case "SET_BUDGETS":
      return { ...state, selectedBudgets: action.payload }
    case "SET_PROJECT_YEAR_RANGE":
      return { ...state, projectYearRange: action.payload }
    case "SET_BUILDING_YEAR_RANGE":
      return { ...state, buildingYearRange: action.payload }
    case "RESET":
      return INITIAL_FILTER_STATE
    default:
      return state
  }
}

interface FilterContextType {
  selectedTypes: string[]
  selectedStyles: string[]
  selectedLocation: string
  selectedFeatures: string[]
  selectedBuildingTypes: string[]
  selectedLocationFeatures: string[]
  selectedBuildingFeatures: string[]
  selectedMaterialFeatures: string[]
  selectedSizes: string[]
  selectedBudgets: string[]
  projectYearRange: [number | null, number | null]
  buildingYearRange: [number | null, number | null]
  setSelectedTypes: (types: string[]) => void
  setSelectedStyles: (styles: string[]) => void
  setSelectedLocation: (location: string) => void
  setSelectedFeatures: (features: string[]) => void
  setSelectedBuildingTypes: (types: string[]) => void
  setSelectedLocationFeatures: (features: string[]) => void
  setSelectedBuildingFeatures: (features: string[]) => void
  setSelectedMaterialFeatures: (features: string[]) => void
  setSelectedSizes: (sizes: string[]) => void
  setSelectedBudgets: (budgets: string[]) => void
  setProjectYearRange: (range: [number | null, number | null]) => void
  setBuildingYearRange: (range: [number | null, number | null]) => void
  clearAllFilters: () => void
  removeFilter: (type: string, value: string) => void
  hasActiveFilters: () => boolean
  taxonomy: {
    categories: ReturnType<typeof useProjectTaxonomy>["categories"]
    taxonomyOptions: ReturnType<typeof useProjectTaxonomy>["taxonomyOptions"]
    isLoading: boolean
    error: string | null
    refresh: () => Promise<void>
  }
  taxonomyLabelMap: Map<string, string>
}

const FilterContext = createContext<FilterContextType | undefined>(undefined)

function FilterProviderInner({ children }: { children: ReactNode }) {
  const { categories, taxonomyOptions, isLoading: taxonomyLoading, error: taxonomyError, refresh } = useProjectTaxonomy()
  const [state, dispatch] = useReducer(filterReducer, INITIAL_FILTER_STATE)
  const {
    selectedTypes,
    selectedStyles,
    selectedLocation,
    selectedFeatures,
    selectedBuildingTypes,
    selectedLocationFeatures,
    selectedBuildingFeatures,
    selectedMaterialFeatures,
    selectedSizes,
    selectedBudgets,
    projectYearRange,
    buildingYearRange,
  } = state

  const setSelectedTypes = useCallback((types: string[]) => {
    if (!Array.isArray(types)) {
      dispatch({ type: "SET_TYPES", payload: [] })
      return
    }

    const sanitized = types
      .filter((type): type is string => Boolean(type))
      .filter((value, index, array) => array.indexOf(value) === index)

    // Keep only the most recent type to enforce single-selection behaviour
    const nextSelection = sanitized.length > 1 ? [sanitized[sanitized.length - 1]] : sanitized

    dispatch({ type: "SET_TYPES", payload: nextSelection })
  }, [])
  const setSelectedStyles = useCallback(
    (styles: string[]) =>
      dispatch({ type: "SET_STYLES", payload: Array.isArray(styles) ? [...styles] : [] }),
    [],
  )
  const setSelectedLocation = useCallback(
    (location: string) => dispatch({ type: "SET_LOCATION", payload: location }),
    [],
  )
  const setSelectedFeatures = useCallback(
    (features: string[]) =>
      dispatch({ type: "SET_FEATURES", payload: Array.isArray(features) ? [...features] : [] }),
    [],
  )
  const setSelectedBuildingTypes = useCallback(
    (items: string[]) =>
      dispatch({ type: "SET_BUILDING_TYPES", payload: Array.isArray(items) ? [...items] : [] }),
    [],
  )
  const setSelectedLocationFeatures = useCallback(
    (items: string[]) =>
      dispatch({ type: "SET_LOCATION_FEATURES", payload: Array.isArray(items) ? [...items] : [] }),
    [],
  )
  const setSelectedBuildingFeatures = useCallback(
    (items: string[]) =>
      dispatch({ type: "SET_BUILDING_FEATURES", payload: Array.isArray(items) ? [...items] : [] }),
    [],
  )
  const setSelectedMaterialFeatures = useCallback(
    (items: string[]) =>
      dispatch({ type: "SET_MATERIAL_FEATURES", payload: Array.isArray(items) ? [...items] : [] }),
    [],
  )
  const setSelectedSizes = useCallback(
    (items: string[]) => dispatch({ type: "SET_SIZES", payload: Array.isArray(items) ? [...items] : [] }),
    [],
  )
  const setSelectedBudgets = useCallback(
    (items: string[]) => dispatch({ type: "SET_BUDGETS", payload: Array.isArray(items) ? [...items] : [] }),
    [],
  )
  const setProjectYearRange = useCallback(
    (range: [number | null, number | null]) => dispatch({ type: "SET_PROJECT_YEAR_RANGE", payload: range }),
    [],
  )
  const setBuildingYearRange = useCallback(
    (range: [number | null, number | null]) => dispatch({ type: "SET_BUILDING_YEAR_RANGE", payload: range }),
    [],
  )

  const taxonomyLabelMap = useMemo(() => {
    const map = new Map<string, string>()
    categories.forEach((category) => {
      if (category.slug) map.set(category.slug, category.name)
      map.set(category.name, category.name)
      if (category.id) map.set(category.id, category.name)
    })
    Object.values(taxonomyOptions).forEach((group) => {
      group?.forEach((option) => {
        if (option.slug) map.set(option.slug, option.name)
        if (option.id) map.set(option.id, option.name)
        if (option.budget_level) map.set(option.budget_level, option.name)
        map.set(option.name, option.name)
      })
    })
    return map
  }, [categories, taxonomyOptions])
  const [isUrlHydrated, setIsUrlHydrated] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const initializedRef = useRef(false)
  const lastParsedQueryRef = useRef<string>(searchParams.toString())
  const lastSyncedQueryRef = useRef<string>(searchParams.toString())
  const debouncedReplaceRef = useRef<(nextQuery: string) => void>()

  useEffect(() => {
    const handler = debounce((nextQuery: string) => {
      lastSyncedQueryRef.current = nextQuery

      if (nextQuery.length === 0) {
        router.replace(pathname, { scroll: false })
      } else {
        router.replace(`${pathname}?${nextQuery}`, { scroll: false })
      }
    }, 300)

    debouncedReplaceRef.current = handler

    return () => {
      handler.cancel()
      debouncedReplaceRef.current = undefined
    }
  }, [pathname, router])

  const categoryTokenMaps = useMemo(
    () =>
      createTokenMaps(categories, {
        getId: (category) => category.id,
        getLabel: (category) => category.name,
        getPreferredToken: (category) => category.slug ?? category.name,
      }),
    [categories],
  )

  const taxonomyTokenMaps = useMemo(() => {
    const entries = Object.entries(taxonomyOptions)
    const result: Record<string, TokenMaps> = {}
    entries.forEach(([type, options]) => {
      result[type] = createTokenMaps(options, {
        getId: (option) => option.id,
        getLabel: (option) => option.name,
        getPreferredToken: (option) => option.slug ?? option.name,
        getExtraTokens: (option) => [option.budget_level, option.id, option.slug, option.name],
      })
    })
    return result
  }, [taxonomyOptions])

  const resolveTokensToIds = (values: string[], maps?: TokenMaps) => {
    if (!maps) return values
    const resolved = values.map((value) => {
      if (maps.tokenToId.has(value)) return maps.tokenToId.get(value) as string
      const normalized = normalizeToken(value)
      return maps.tokenToId.get(normalized) ?? value
    })
    const unique: string[] = []
    resolved.forEach((value) => {
      if (!unique.includes(value)) {
        unique.push(value)
      }
    })
    return unique
  }

  const mapIdsToTokens = (values: string[], maps?: TokenMaps) => {
    if (!maps) return values
    const mapped = values.map((value) => maps.idToToken.get(value) ?? value)
    const unique: string[] = []
    mapped.forEach((value) => {
      if (!unique.includes(value)) {
        unique.push(value)
      }
    })
    return unique
  }

  useEffect(() => {
    const queryString = searchParams.toString()

    if (lastParsedQueryRef.current === queryString && initializedRef.current) {
      const needsHydration =
        needsResolution(selectedTypes, categoryTokenMaps) ||
        needsResolution(selectedStyles, taxonomyTokenMaps.project_style) ||
        needsResolution(selectedBuildingTypes, taxonomyTokenMaps.building_type) ||
        needsResolution(selectedLocationFeatures, taxonomyTokenMaps.location_feature) ||
        needsResolution(selectedBuildingFeatures, categoryTokenMaps) ||
        needsResolution(selectedMaterialFeatures, taxonomyTokenMaps.material_feature) ||
        needsResolution(selectedSizes, taxonomyTokenMaps.size_range) ||
        needsResolution(selectedBudgets, taxonomyTokenMaps.budget_tier)

      if (!needsHydration) {
        return
      }
    }

    lastParsedQueryRef.current = queryString

    const pendingResolution =
      needsResolution(selectedTypes, categoryTokenMaps) ||
      needsResolution(selectedStyles, taxonomyTokenMaps.project_style) ||
      needsResolution(selectedBuildingTypes, taxonomyTokenMaps.building_type) ||
      needsResolution(selectedLocationFeatures, taxonomyTokenMaps.location_feature) ||
      needsResolution(selectedBuildingFeatures, categoryTokenMaps) ||
      needsResolution(selectedMaterialFeatures, taxonomyTokenMaps.material_feature) ||
      needsResolution(selectedSizes, taxonomyTokenMaps.size_range) ||
      needsResolution(selectedBudgets, taxonomyTokenMaps.budget_tier)

    if (initializedRef.current && lastSyncedQueryRef.current === queryString && !pendingResolution) {
      return
    }

    const typeValues = parseCommaSeparatedParam(searchParams.get("type"))
    const resolvedTypes = resolveTokensToIds(typeValues, categoryTokenMaps)
    if (!areStringArraysEqual(selectedTypes, resolvedTypes)) {
      setSelectedTypes(resolvedTypes)
    }

    const styleValues = parseCommaSeparatedParam(searchParams.get("style"))
    const resolvedStyles = resolveTokensToIds(styleValues, taxonomyTokenMaps.project_style)
    if (!areStringArraysEqual(selectedStyles, resolvedStyles)) {
      setSelectedStyles(resolvedStyles)
    }

    const locationValue = searchParams.get("location") ?? ""
    if (selectedLocation !== locationValue) {
      setSelectedLocation(locationValue)
    }

    const buildingTypeValues = parseCommaSeparatedParam(searchParams.get("buildingType"))
    const resolvedBuildingTypes = resolveTokensToIds(buildingTypeValues, taxonomyTokenMaps.building_type)
    if (!areStringArraysEqual(selectedBuildingTypes, resolvedBuildingTypes)) {
      setSelectedBuildingTypes(resolvedBuildingTypes)
    }

    const locationFeatureValues = parseCommaSeparatedParam(searchParams.get("locationFeatures"))
    const resolvedLocationFeatures = resolveTokensToIds(locationFeatureValues, taxonomyTokenMaps.location_feature)
    if (!areStringArraysEqual(selectedLocationFeatures, resolvedLocationFeatures)) {
      setSelectedLocationFeatures(resolvedLocationFeatures)
    }

    const buildingFeatureValues = parseCommaSeparatedParam(searchParams.get("buildingFeatures"))
    const resolvedBuildingFeatures = resolveTokensToIds(buildingFeatureValues, categoryTokenMaps)
    if (!areStringArraysEqual(selectedBuildingFeatures, resolvedBuildingFeatures)) {
      setSelectedBuildingFeatures(resolvedBuildingFeatures)
    }

    const materialFeatureValues = parseCommaSeparatedParam(searchParams.get("materialFeatures"))
    const resolvedMaterialFeatures = resolveTokensToIds(materialFeatureValues, taxonomyTokenMaps.material_feature)
    if (!areStringArraysEqual(selectedMaterialFeatures, resolvedMaterialFeatures)) {
      setSelectedMaterialFeatures(resolvedMaterialFeatures)
    }

    const legacyFeatureValues = parseCommaSeparatedParam(searchParams.get("features"))
    if (
      legacyFeatureValues.length > 0 &&
      locationFeatureValues.length === 0 &&
      buildingFeatureValues.length === 0 &&
      materialFeatureValues.length === 0
    ) {
      const resolvedLegacy = resolveTokensToIds(legacyFeatureValues, categoryTokenMaps)
      if (!areStringArraysEqual(selectedBuildingFeatures, resolvedLegacy)) {
        setSelectedBuildingFeatures(resolvedLegacy)
      }
    }

    const sizeValues = parseCommaSeparatedParam(searchParams.get("size"))
    const resolvedSizes = resolveTokensToIds(sizeValues, taxonomyTokenMaps.size_range)
    if (!areStringArraysEqual(selectedSizes, resolvedSizes)) {
      setSelectedSizes(resolvedSizes)
    }

    const budgetValues = parseCommaSeparatedParam(searchParams.get("budget"))
    const resolvedBudgets = resolveTokensToIds(budgetValues, taxonomyTokenMaps.budget_tier)
    if (!areStringArraysEqual(selectedBudgets, resolvedBudgets)) {
      setSelectedBudgets(resolvedBudgets)
    }

    const projectYearMax = parseNumericParam(searchParams.get("projectYearMax"))
    const nextProjectYearRange: [number | null, number | null] =
      projectYearMax === null ? DEFAULT_RANGE : [null, projectYearMax]
    if (!areRangesEqual(projectYearRange, nextProjectYearRange)) {
      setProjectYearRange(nextProjectYearRange)
    }

    const buildingYearMax = parseNumericParam(searchParams.get("buildingYearMax"))
    const nextBuildingYearRange: [number | null, number | null] =
      buildingYearMax === null ? DEFAULT_RANGE : [null, buildingYearMax]
    if (!areRangesEqual(buildingYearRange, nextBuildingYearRange)) {
      setBuildingYearRange(nextBuildingYearRange)
    }

    initializedRef.current = true
    lastSyncedQueryRef.current = searchParams.toString()
    if (!isUrlHydrated) {
      setIsUrlHydrated(true)
    }
  }, [
    searchParams,
    selectedTypes,
    selectedStyles,
    selectedLocation,
    selectedBuildingTypes,
    selectedLocationFeatures,
    selectedBuildingFeatures,
    selectedMaterialFeatures,
    selectedSizes,
    selectedBudgets,
    projectYearRange,
    buildingYearRange,
    isUrlHydrated,
    categoryTokenMaps,
    taxonomyTokenMaps,
  ])

  useEffect(() => {
    const combined = Array.from(
      new Set([
        ...selectedLocationFeatures,
        ...selectedBuildingFeatures,
        ...selectedMaterialFeatures,
      ]),
    )

    if (!areStringArraysEqual(selectedFeatures, combined)) {
      setSelectedFeatures(combined)
    }
  }, [
    selectedBuildingFeatures,
    selectedFeatures,
    selectedLocationFeatures,
    selectedMaterialFeatures,
    setSelectedFeatures,
  ])

  useEffect(() => {
    if (!isUrlHydrated) return

    const params = new URLSearchParams()

    const setArrayParam = (key: string, values: string[]) => {
      if (values.length > 0) {
        params.set(key, values.join(","))
      }
    }

    setArrayParam("type", mapIdsToTokens(selectedTypes, categoryTokenMaps))
    setArrayParam("style", mapIdsToTokens(selectedStyles, taxonomyTokenMaps.project_style))

    if (selectedLocation) {
      params.set("location", selectedLocation)
    }

    setArrayParam("buildingType", mapIdsToTokens(selectedBuildingTypes, taxonomyTokenMaps.building_type))
    setArrayParam("locationFeatures", mapIdsToTokens(selectedLocationFeatures, taxonomyTokenMaps.location_feature))
    setArrayParam("buildingFeatures", mapIdsToTokens(selectedBuildingFeatures, categoryTokenMaps))
    setArrayParam("materialFeatures", mapIdsToTokens(selectedMaterialFeatures, taxonomyTokenMaps.material_feature))
    setArrayParam("size", mapIdsToTokens(selectedSizes, taxonomyTokenMaps.size_range))
    setArrayParam("budget", mapIdsToTokens(selectedBudgets, taxonomyTokenMaps.budget_tier))

    if (projectYearRange[1] !== null) {
      params.set("projectYearMax", String(projectYearRange[1]))
    }

    if (buildingYearRange[1] !== null) {
      params.set("buildingYearMax", String(buildingYearRange[1]))
    }

    const nextQuery = params.toString()
    const currentQuery = searchParams.toString()

    if (nextQuery === currentQuery) {
      lastSyncedQueryRef.current = nextQuery
      return
    }

    if (nextQuery === lastSyncedQueryRef.current) {
      return
    }

    if (!debouncedReplaceRef.current) {
      lastSyncedQueryRef.current = nextQuery
      if (nextQuery.length === 0) {
        router.replace(pathname, { scroll: false })
      } else {
        router.replace(`${pathname}?${nextQuery}`, { scroll: false })
      }
      return
    }

    debouncedReplaceRef.current(nextQuery)
  }, [
    isUrlHydrated,
    selectedTypes,
    selectedStyles,
    selectedLocation,
    selectedBuildingTypes,
    selectedLocationFeatures,
    selectedBuildingFeatures,
    selectedMaterialFeatures,
    selectedSizes,
    selectedBudgets,
    projectYearRange,
    buildingYearRange,
    router,
    pathname,
    searchParams,
    categoryTokenMaps,
    taxonomyTokenMaps,
  ])

  const clearAllFilters = useCallback(() => {
    dispatch({ type: "RESET" })
  }, [])

  const removeFilter = (type: string, value: string) => {
    switch (type) {
      case "type":
        setSelectedTypes(selectedTypes.filter((t) => t !== value))
        break
      case "style":
        setSelectedStyles(selectedStyles.filter((s) => s !== value))
        break
      case "location":
        setSelectedLocation("")
        break
      case "feature":
        setSelectedFeatures(selectedFeatures.filter((f) => f !== value))
        setSelectedLocationFeatures(selectedLocationFeatures.filter((item) => item !== value))
        setSelectedBuildingFeatures(selectedBuildingFeatures.filter((item) => item !== value))
        setSelectedMaterialFeatures(selectedMaterialFeatures.filter((item) => item !== value))
        break
      case "buildingType":
        setSelectedBuildingTypes(selectedBuildingTypes.filter((item) => item !== value))
        break
      case "locationFeature":
        setSelectedLocationFeatures(selectedLocationFeatures.filter((item) => item !== value))
        break
      case "buildingFeature":
        setSelectedBuildingFeatures(selectedBuildingFeatures.filter((item) => item !== value))
        break
      case "materialFeature":
        setSelectedMaterialFeatures(selectedMaterialFeatures.filter((item) => item !== value))
        break
      case "size":
        setSelectedSizes(selectedSizes.filter((item) => item !== value))
        break
      case "budget":
        setSelectedBudgets(selectedBudgets.filter((item) => item !== value))
        break
      case "projectYear":
        setProjectYearRange([null, null])
        break
      case "buildingYear":
        setBuildingYearRange([null, null])
        break
    }
  }

  const hasActiveFilters = () => {
    return (
      selectedTypes.length > 0 ||
      selectedStyles.length > 0 ||
      selectedLocation !== "" ||
      selectedFeatures.length > 0 ||
      selectedBuildingTypes.length > 0 ||
      selectedLocationFeatures.length > 0 ||
      selectedBuildingFeatures.length > 0 ||
      selectedMaterialFeatures.length > 0 ||
      selectedSizes.length > 0 ||
      selectedBudgets.length > 0 ||
      projectYearRange.some((value) => value !== null) ||
      buildingYearRange.some((value) => value !== null)
    )
  }

  return (
    <FilterContext.Provider
      value={{
        selectedTypes,
        selectedStyles,
        selectedLocation,
        selectedFeatures,
        selectedBuildingTypes,
        selectedLocationFeatures,
        selectedBuildingFeatures,
        selectedMaterialFeatures,
        selectedSizes,
        selectedBudgets,
        projectYearRange,
        buildingYearRange,
        setSelectedTypes,
        setSelectedStyles,
        setSelectedLocation,
        setSelectedFeatures,
        setSelectedBuildingTypes,
        setSelectedLocationFeatures,
        setSelectedBuildingFeatures,
        setSelectedMaterialFeatures,
        setSelectedSizes,
        setSelectedBudgets,
        setProjectYearRange,
        setBuildingYearRange,
        clearAllFilters,
        removeFilter,
        hasActiveFilters,
        taxonomy: {
          categories,
          taxonomyOptions,
          isLoading: taxonomyLoading,
          error: taxonomyError,
          refresh,
        },
        taxonomyLabelMap,
      }}
    >
      {children}
    </FilterContext.Provider>
  )
}

export function FilterProvider({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div>Loading filters...</div>}>
      <FilterProviderInner>{children}</FilterProviderInner>
    </Suspense>
  )
}

export function useFilters() {
  const context = useContext(FilterContext)
  if (context === undefined) {
    throw new Error("useFilters must be used within a FilterProvider")
  }
  return context
}
