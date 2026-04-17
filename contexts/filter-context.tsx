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

// ─── State ────────────────────────────────────────────────────────────────────

interface FilterState {
  selectedTypes: string[]
  selectedStyles: string[]
  selectedLocations: string[]
  selectedSpace: string
  selectedFeatures: string[]
  selectedBuildingTypes: string[]
  /** Project scope filter (lib/project-translations.ts canonical slugs:
   *  new_build, renovation, interior_design). Distinct from
   *  selectedBuildingTypes which holds villa / house / apartment /… */
  selectedScopes: string[]
  selectedBuildingFeatures: string[]
  selectedSizes: string[]
  selectedBudgets: string[]
  projectYearRange: [number | null, number | null]
  buildingYearRange: [number | null, number | null]
  keyword: string
}

const INITIAL_FILTER_STATE: FilterState = {
  selectedTypes: [],
  selectedStyles: [],
  selectedLocations: [],
  selectedSpace: "",
  selectedFeatures: [],
  selectedBuildingTypes: [],
  selectedScopes: [],
  selectedBuildingFeatures: [],
  selectedSizes: [],
  selectedBudgets: [],
  projectYearRange: [null, null],
  buildingYearRange: [null, null],
  keyword: "",
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

type FilterAction =
  | { type: "SET_TYPES"; payload: string[] }
  | { type: "SET_STYLES"; payload: string[] }
  | { type: "SET_LOCATIONS"; payload: string[] }
  | { type: "SET_SPACE"; payload: string }
  | { type: "SET_FEATURES"; payload: string[] }
  | { type: "SET_BUILDING_TYPES"; payload: string[] }
  | { type: "SET_SCOPES"; payload: string[] }
  | { type: "SET_BUILDING_FEATURES"; payload: string[] }
  | { type: "SET_SIZES"; payload: string[] }
  | { type: "SET_BUDGETS"; payload: string[] }
  | { type: "SET_PROJECT_YEAR_RANGE"; payload: [number | null, number | null] }
  | { type: "SET_BUILDING_YEAR_RANGE"; payload: [number | null, number | null] }
  | { type: "SET_KEYWORD"; payload: string }
  | { type: "RESET" }

const filterReducer = (state: FilterState, action: FilterAction): FilterState => {
  switch (action.type) {
    case "SET_TYPES":
      return { ...state, selectedTypes: action.payload }
    case "SET_STYLES":
      return { ...state, selectedStyles: action.payload }
    case "SET_LOCATIONS":
      return { ...state, selectedLocations: action.payload }
    case "SET_SPACE":
      return { ...state, selectedSpace: action.payload }
    case "SET_FEATURES":
      return { ...state, selectedFeatures: action.payload }
    case "SET_BUILDING_TYPES":
      return { ...state, selectedBuildingTypes: action.payload }
    case "SET_SCOPES":
      return { ...state, selectedScopes: action.payload }
    case "SET_BUILDING_FEATURES":
      return { ...state, selectedBuildingFeatures: action.payload }
    case "SET_SIZES":
      return { ...state, selectedSizes: action.payload }
    case "SET_BUDGETS":
      return { ...state, selectedBudgets: action.payload }
    case "SET_PROJECT_YEAR_RANGE":
      return { ...state, projectYearRange: action.payload }
    case "SET_BUILDING_YEAR_RANGE":
      return { ...state, buildingYearRange: action.payload }
    case "SET_KEYWORD":
      return { ...state, keyword: action.payload }
    case "RESET":
      return INITIAL_FILTER_STATE
    default:
      return state
  }
}

// ─── Context type ─────────────────────────────────────────────────────────────

interface FilterContextType {
  selectedTypes: string[]
  selectedStyles: string[]
  selectedLocations: string[]
  selectedSpace: string
  selectedFeatures: string[]
  selectedBuildingTypes: string[]
  selectedScopes: string[]
  selectedBuildingFeatures: string[]
  selectedSizes: string[]
  selectedBudgets: string[]
  projectYearRange: [number | null, number | null]
  buildingYearRange: [number | null, number | null]
  keyword: string
  setSelectedTypes: (types: string[]) => void
  setSelectedStyles: (styles: string[]) => void
  setSelectedLocations: (locations: string[]) => void
  setSelectedSpace: (space: string) => void
  setSelectedFeatures: (features: string[]) => void
  setSelectedBuildingTypes: (types: string[]) => void
  setSelectedScopes: (scopes: string[]) => void
  setSelectedBuildingFeatures: (features: string[]) => void
  setSelectedSizes: (sizes: string[]) => void
  setSelectedBudgets: (budgets: string[]) => void
  setProjectYearRange: (range: [number | null, number | null]) => void
  setBuildingYearRange: (range: [number | null, number | null]) => void
  setKeyword: (value: string) => void
  clearAllFilters: () => void
  removeFilter: (type: string, value: string) => void
  hasActiveFilters: () => boolean
  taxonomy: {
    categories: ReturnType<typeof useProjectTaxonomy>["categories"]
    taxonomyOptions: ReturnType<typeof useProjectTaxonomy>["taxonomyOptions"]
    cities: ReturnType<typeof useProjectTaxonomy>["cities"]
    isLoading: boolean
    error: string | null
    refresh: () => Promise<void>
  }
  taxonomyLabelMap: Map<string, string>
}

const FilterContext = createContext<FilterContextType | undefined>(undefined)

// ─── Provider ─────────────────────────────────────────────────────────────────

function FilterProviderInner({ children }: { children: ReactNode }) {
  const { categories, taxonomyOptions, cities, isLoading: taxonomyLoading, error: taxonomyError, refresh } = useProjectTaxonomy()
  const [state, dispatch] = useReducer(filterReducer, INITIAL_FILTER_STATE)
  const {
    selectedTypes,
    selectedStyles,
    selectedLocations,
    selectedSpace,
    selectedFeatures,
    selectedBuildingTypes,
    selectedScopes,
    selectedBuildingFeatures,
    selectedSizes,
    selectedBudgets,
    projectYearRange,
    buildingYearRange,
    keyword,
  } = state

  // ── Setters ─────────────────────────────────────────────────────────────────

  const setSelectedTypes = useCallback((types: string[]) => {
    if (!Array.isArray(types)) {
      dispatch({ type: "SET_TYPES", payload: [] })
      return
    }
    const sanitized = types
      .filter((type): type is string => Boolean(type))
      .filter((value, index, array) => array.indexOf(value) === index)
    dispatch({ type: "SET_TYPES", payload: sanitized })
  }, [])

  const setSelectedStyles = useCallback(
    (styles: string[]) =>
      dispatch({ type: "SET_STYLES", payload: Array.isArray(styles) ? [...styles] : [] }),
    [],
  )
  const setSelectedLocations = useCallback((locations: string[]) => {
    if (!Array.isArray(locations)) {
      dispatch({ type: "SET_LOCATIONS", payload: [] })
      return
    }
    const sanitized = locations
      .filter((loc): loc is string => Boolean(loc))
      .filter((value, index, array) => array.indexOf(value) === index)
    dispatch({ type: "SET_LOCATIONS", payload: sanitized })
  }, [])
  const setSelectedSpace = useCallback(
    (space: string) => dispatch({ type: "SET_SPACE", payload: space }),
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
  const setSelectedScopes = useCallback(
    (items: string[]) =>
      dispatch({ type: "SET_SCOPES", payload: Array.isArray(items) ? [...items] : [] }),
    [],
  )
  const setSelectedBuildingFeatures = useCallback(
    (items: string[]) =>
      dispatch({ type: "SET_BUILDING_FEATURES", payload: Array.isArray(items) ? [...items] : [] }),
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
  const setKeyword = useCallback((value: string) => dispatch({ type: "SET_KEYWORD", payload: value }), [])

  // ── Taxonomy label map ───────────────────────────────────────────────────────

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

  // ── URL sync ─────────────────────────────────────────────────────────────────

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
    resolved.forEach((value) => { if (!unique.includes(value)) unique.push(value) })
    return unique
  }

  const mapIdsToTokens = (values: string[], maps?: TokenMaps) => {
    if (!maps) return values
    const mapped = values.map((value) => maps.idToToken.get(value) ?? value)
    const unique: string[] = []
    mapped.forEach((value) => { if (!unique.includes(value)) unique.push(value) })
    return unique
  }

  // Read from URL
  useEffect(() => {
    const queryString = searchParams.toString()

    if (lastParsedQueryRef.current === queryString && initializedRef.current) {
      const needsHydration =
        needsResolution(selectedTypes, categoryTokenMaps) ||
        needsResolution(selectedStyles, taxonomyTokenMaps.project_style) ||
        needsResolution(selectedBuildingTypes, taxonomyTokenMaps.building_type) ||
        needsResolution(selectedBuildingFeatures, categoryTokenMaps) ||
        needsResolution(selectedSizes, taxonomyTokenMaps.size_range) ||
        needsResolution(selectedBudgets, taxonomyTokenMaps.budget_tier)
      if (!needsHydration) return
    }

    lastParsedQueryRef.current = queryString

    const pendingResolution =
      needsResolution(selectedTypes, categoryTokenMaps) ||
      needsResolution(selectedStyles, taxonomyTokenMaps.project_style) ||
      needsResolution(selectedBuildingTypes, taxonomyTokenMaps.building_type) ||
      needsResolution(selectedBuildingFeatures, categoryTokenMaps) ||
      needsResolution(selectedSizes, taxonomyTokenMaps.size_range) ||
      needsResolution(selectedBudgets, taxonomyTokenMaps.budget_tier)

    if (initializedRef.current && lastSyncedQueryRef.current === queryString && !pendingResolution) return

    const typeValues = parseCommaSeparatedParam(searchParams.get("type"))
    const resolvedTypes = resolveTokensToIds(typeValues, categoryTokenMaps)
    if (!areStringArraysEqual(selectedTypes, resolvedTypes)) setSelectedTypes(resolvedTypes)

    const styleValues = parseCommaSeparatedParam(searchParams.get("style"))
    const resolvedStyles = resolveTokensToIds(styleValues, taxonomyTokenMaps.project_style)
    if (!areStringArraysEqual(selectedStyles, resolvedStyles)) setSelectedStyles(resolvedStyles)

    const locationValues = parseCommaSeparatedParam(searchParams.get("location"))
    if (!areStringArraysEqual(selectedLocations, locationValues)) setSelectedLocations(locationValues)

    const spaceValue = searchParams.get("space") ?? ""
    if (selectedSpace !== spaceValue) setSelectedSpace(spaceValue)

    const buildingTypeValues = parseCommaSeparatedParam(searchParams.get("buildingType"))
    const resolvedBuildingTypes = resolveTokensToIds(buildingTypeValues, taxonomyTokenMaps.building_type)
    if (!areStringArraysEqual(selectedBuildingTypes, resolvedBuildingTypes)) setSelectedBuildingTypes(resolvedBuildingTypes)

    // Scope filter — slugs round-trip through the URL as-is (no token map).
    const scopeValues = parseCommaSeparatedParam(searchParams.get("scope"))
    if (!areStringArraysEqual(selectedScopes, scopeValues)) setSelectedScopes(scopeValues)

    const buildingFeatureValues = parseCommaSeparatedParam(searchParams.get("buildingFeatures"))
    const resolvedBuildingFeatures = resolveTokensToIds(buildingFeatureValues, categoryTokenMaps)
    if (!areStringArraysEqual(selectedBuildingFeatures, resolvedBuildingFeatures)) setSelectedBuildingFeatures(resolvedBuildingFeatures)

    const legacyFeatureValues = parseCommaSeparatedParam(searchParams.get("features"))
    if (legacyFeatureValues.length > 0 && buildingFeatureValues.length === 0) {
      const resolvedLegacy = resolveTokensToIds(legacyFeatureValues, categoryTokenMaps)
      if (!areStringArraysEqual(selectedBuildingFeatures, resolvedLegacy)) setSelectedBuildingFeatures(resolvedLegacy)
    }

    const sizeValues = parseCommaSeparatedParam(searchParams.get("size"))
    const resolvedSizes = resolveTokensToIds(sizeValues, taxonomyTokenMaps.size_range)
    if (!areStringArraysEqual(selectedSizes, resolvedSizes)) setSelectedSizes(resolvedSizes)

    const budgetValues = parseCommaSeparatedParam(searchParams.get("budget"))
    const resolvedBudgets = resolveTokensToIds(budgetValues, taxonomyTokenMaps.budget_tier)
    if (!areStringArraysEqual(selectedBudgets, resolvedBudgets)) setSelectedBudgets(resolvedBudgets)

    const projectYearMax = parseNumericParam(searchParams.get("projectYearMax"))
    const nextProjectYearRange: [number | null, number | null] = projectYearMax === null ? DEFAULT_RANGE : [null, projectYearMax]
    if (!areRangesEqual(projectYearRange, nextProjectYearRange)) setProjectYearRange(nextProjectYearRange)

    const buildingYearMax = parseNumericParam(searchParams.get("buildingYearMax"))
    const nextBuildingYearRange: [number | null, number | null] = buildingYearMax === null ? DEFAULT_RANGE : [null, buildingYearMax]
    if (!areRangesEqual(buildingYearRange, nextBuildingYearRange)) setBuildingYearRange(nextBuildingYearRange)

    const keywordValue = searchParams.get("search") ?? ""
    if (keyword !== keywordValue) setKeyword(keywordValue)

    initializedRef.current = true
    lastSyncedQueryRef.current = searchParams.toString()
    if (!isUrlHydrated) setIsUrlHydrated(true)
  }, [
    searchParams, selectedTypes, selectedStyles, selectedLocations, selectedSpace,
    selectedBuildingTypes, selectedBuildingFeatures,
    selectedSizes, selectedBudgets, projectYearRange,
    buildingYearRange, keyword, isUrlHydrated, categoryTokenMaps, taxonomyTokenMaps,
  ])

  // Sync combined features
  useEffect(() => {
    const combined = Array.from(new Set(selectedBuildingFeatures))
    if (!areStringArraysEqual(selectedFeatures, combined)) setSelectedFeatures(combined)
  }, [selectedBuildingFeatures, selectedFeatures, setSelectedFeatures])

  // Write to URL
  useEffect(() => {
    if (!isUrlHydrated) return

    const params = new URLSearchParams()
    const setArrayParam = (key: string, values: string[]) => {
      if (values.length > 0) params.set(key, values.join(","))
    }

    setArrayParam("type", mapIdsToTokens(selectedTypes, categoryTokenMaps))
    setArrayParam("style", mapIdsToTokens(selectedStyles, taxonomyTokenMaps.project_style))
    setArrayParam("location", selectedLocations)
    if (selectedSpace) params.set("space", selectedSpace)
    setArrayParam("buildingType", mapIdsToTokens(selectedBuildingTypes, taxonomyTokenMaps.building_type))
    // Scope filter — uses canonical slugs from lib/project-translations.ts
    setArrayParam("scope", selectedScopes)
    setArrayParam("buildingFeatures", mapIdsToTokens(selectedBuildingFeatures, categoryTokenMaps))
    setArrayParam("size", mapIdsToTokens(selectedSizes, taxonomyTokenMaps.size_range))
    setArrayParam("budget", mapIdsToTokens(selectedBudgets, taxonomyTokenMaps.budget_tier))
    const trimmedKeyword = keyword.trim()
    if (trimmedKeyword.length > 0) params.set("search", trimmedKeyword)
    if (projectYearRange[1] !== null) params.set("projectYearMax", String(projectYearRange[1]))
    if (buildingYearRange[1] !== null) params.set("buildingYearMax", String(buildingYearRange[1]))

    const nextQuery = params.toString()
    const currentQuery = searchParams.toString()
    if (nextQuery === currentQuery) { lastSyncedQueryRef.current = nextQuery; return }
    if (nextQuery === lastSyncedQueryRef.current) return

    if (!debouncedReplaceRef.current) {
      lastSyncedQueryRef.current = nextQuery
      if (nextQuery.length === 0) router.replace(pathname, { scroll: false })
      else router.replace(`${pathname}?${nextQuery}`, { scroll: false })
      return
    }
    debouncedReplaceRef.current(nextQuery)
  }, [
    isUrlHydrated, selectedTypes, selectedStyles, selectedLocations, selectedSpace,
    selectedBuildingTypes, selectedScopes, selectedBuildingFeatures,
    selectedSizes, selectedBudgets, projectYearRange,
    buildingYearRange, router, pathname, searchParams, categoryTokenMaps, taxonomyTokenMaps, keyword,
  ])

  // ── Actions ──────────────────────────────────────────────────────────────────

  const clearAllFilters = useCallback(() => dispatch({ type: "RESET" }), [])

  const removeFilter = (type: string, value: string) => {
    switch (type) {
      case "type": setSelectedTypes(selectedTypes.filter((t) => t !== value)); break
      case "style": setSelectedStyles(selectedStyles.filter((s) => s !== value)); break
      case "location": setSelectedLocations(selectedLocations.filter((l) => l !== value)); break
      case "space": setSelectedSpace(""); break
      case "feature":
        setSelectedFeatures(selectedFeatures.filter((f) => f !== value))
        setSelectedBuildingFeatures(selectedBuildingFeatures.filter((item) => item !== value))
        break
      case "buildingType": setSelectedBuildingTypes(selectedBuildingTypes.filter((item) => item !== value)); break
      case "scope": setSelectedScopes(selectedScopes.filter((item) => item !== value)); break
      case "buildingFeature": setSelectedBuildingFeatures(selectedBuildingFeatures.filter((item) => item !== value)); break
      case "size": setSelectedSizes(selectedSizes.filter((item) => item !== value)); break
      case "budget": setSelectedBudgets(selectedBudgets.filter((item) => item !== value)); break
      case "projectYear": setProjectYearRange([null, null]); break
      case "buildingYear": setBuildingYearRange([null, null]); break
      case "keyword": setKeyword(""); break
    }
  }

  const hasActiveFilters = () =>
    selectedTypes.length > 0 ||
    selectedStyles.length > 0 ||
    selectedLocations.length > 0 ||
    selectedSpace !== "" ||
    selectedFeatures.length > 0 ||
    selectedBuildingTypes.length > 0 ||
    selectedScopes.length > 0 ||
    selectedBuildingFeatures.length > 0 ||
    selectedSizes.length > 0 ||
    selectedBudgets.length > 0 ||
    projectYearRange.some((value) => value !== null) ||
    buildingYearRange.some((value) => value !== null) ||
    keyword.trim().length > 0

  return (
    <FilterContext.Provider
      value={{
        selectedTypes, selectedStyles, selectedLocations, selectedSpace,
        selectedFeatures, selectedBuildingTypes, selectedScopes,
        selectedBuildingFeatures, selectedSizes,
        selectedBudgets, projectYearRange, buildingYearRange, keyword,
        setSelectedTypes, setSelectedStyles, setSelectedLocations, setSelectedSpace,
        setSelectedFeatures, setSelectedBuildingTypes, setSelectedScopes,
        setSelectedBuildingFeatures, setSelectedSizes,
        setSelectedBudgets, setProjectYearRange, setBuildingYearRange, setKeyword,
        clearAllFilters, removeFilter, hasActiveFilters,
        taxonomy: {
          categories, taxonomyOptions, cities,
          isLoading: taxonomyLoading, error: taxonomyError, refresh,
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
