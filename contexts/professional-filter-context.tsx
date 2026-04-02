"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { debounce } from "lodash-es"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { useProfessionalTaxonomy, type LocationOptions } from "@/hooks/use-professional-taxonomy"

export const PROFESSIONAL_SORT_OPTIONS = ["Best match", "Most popular", "Most recent"] as const
export type ProfessionalSortOption = (typeof PROFESSIONAL_SORT_OPTIONS)[number]

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

  if (!items) {
    return { tokenToId, idToToken, idToLabel }
  }

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
    extraTokens.forEach((token) => {
      if (token && token !== id && token !== preferredToken) {
        registerToken(token, id)
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

const parseCommaSeparatedParam = (value: string | null) =>
  value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : []

const areStringArraysEqual = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

const mapIdsToTokens = (ids: string[], maps?: TokenMaps): string[] => {
  if (!maps) return ids
  return ids
    .map((id) => maps.idToToken.get(id) ?? id)
    .filter((token, index, array) => array.indexOf(token) === index)
}

const resolveTokensToIds = (tokens: string[], maps?: TokenMaps): string[] => {
  if (!maps) return tokens
  const resolved: string[] = []
  tokens.forEach((token) => {
    if (!token) return
    if (maps.idToToken.has(token)) {
      resolved.push(token)
      return
    }
    if (maps.tokenToId.has(token)) {
      resolved.push(maps.tokenToId.get(token) as string)
      return
    }
    const normalized = normalizeToken(token)
    if (maps.tokenToId.has(normalized)) {
      resolved.push(maps.tokenToId.get(normalized) as string)
    } else {
      resolved.push(token)
    }
  })
  return resolved.filter((value, index, array) => array.indexOf(value) === index)
}

interface ProfessionalFilterState {
  selectedCategories: string[]
  selectedServices: string[]
  selectedCities: string[]
  keyword: string
  sortBy: ProfessionalSortOption
}

const INITIAL_STATE: ProfessionalFilterState = {
  selectedCategories: [],
  selectedServices: [],
  selectedCities: [],
  keyword: "",
  sortBy: "Best match",
}

type ProfessionalFilterAction =
  | { type: "SET_CATEGORIES"; payload: string[] }
  | { type: "SET_SERVICES"; payload: string[] }
  | { type: "SET_CITIES"; payload: string[] }
  | { type: "SET_KEYWORD"; payload: string }
  | { type: "SET_SORT"; payload: ProfessionalSortOption }
  | { type: "RESET" }

const filterReducer = (state: ProfessionalFilterState, action: ProfessionalFilterAction): ProfessionalFilterState => {
  switch (action.type) {
    case "SET_CATEGORIES":
      return { ...state, selectedCategories: action.payload }
    case "SET_SERVICES":
      return { ...state, selectedServices: action.payload }
    case "SET_CITIES":
      return { ...state, selectedCities: action.payload }
    case "SET_KEYWORD":
      return { ...state, keyword: action.payload }
    case "SET_SORT":
      return { ...state, sortBy: action.payload }
    case "RESET":
      return INITIAL_STATE
    default:
      return state
  }
}

interface ProfessionalFilterContextValue extends ProfessionalFilterState {
  setSelectedCategories: (values: string[]) => void
  setSelectedServices: (values: string[]) => void
  setSelectedCities: (values: string[]) => void
  setKeyword: (value: string) => void
  setSortBy: (value: ProfessionalSortOption) => void
  clearAllFilters: () => void
  removeFilter: (type: string, value: string) => void
  hasActiveFilters: () => boolean
  taxonomy: ReturnType<typeof useProfessionalTaxonomy>
  taxonomyLabelMap: Map<string, string>
  cities: string[]
}

const ProfessionalFilterContext = createContext<ProfessionalFilterContextValue | undefined>(undefined)

function ProfessionalFilterProviderInner({ children }: { children: ReactNode }) {
  const taxonomy = useProfessionalTaxonomy()
  const [state, dispatch] = useReducer(filterReducer, INITIAL_STATE)
  const { selectedCategories, selectedServices, selectedCities, keyword, sortBy } = state

  // Extract unique cities from location facets
  const cities = useMemo(() => {
    const citySet = new Set<string>()
    taxonomy.locationFacets.forEach((facet) => {
      if (facet.city) {
        citySet.add(facet.city)
      }
    })
    return Array.from(citySet).sort((a, b) => a.localeCompare(b))
  }, [taxonomy.locationFacets])

  const taxonomyLabelMap = useMemo(() => {
    const map = new Map<string, string>()
    taxonomy.categories.forEach((category) => {
      if (!category) return
      if (category.id) map.set(category.id, category.name ?? "")
      if (category.slug) map.set(category.slug, category.name ?? "")
      if (category.name) map.set(category.name, category.name)
    })
    taxonomy.services.forEach((service) => {
      if (!service) return
      if (service.id) map.set(service.id, service.name ?? "")
      if (service.slug) map.set(service.slug, service.name ?? "")
      if (service.name) map.set(service.name, service.name)
    })
    return map
  }, [taxonomy.categories, taxonomy.services])

  const categoryTokenMaps = useMemo(
    () =>
      createTokenMaps(taxonomy.categories, {
        getId: (category) => category.id,
        getLabel: (category) => category.name ?? "",
        getPreferredToken: (category) => category.slug ?? category.name ?? undefined,
      }),
    [taxonomy.categories],
  )

  const serviceTokenMaps = useMemo(
    () =>
      createTokenMaps(taxonomy.services, {
        getId: (service) => service.id,
        getLabel: (service) => service.name ?? "",
        getPreferredToken: (service) => service.slug ?? service.name ?? undefined,
      }),
    [taxonomy.services],
  )

  const setSelectedCategories = useCallback(
    (values: string[]) => {
      const sanitized = values
        .filter((value): value is string => Boolean(value))
        .filter((value, index, array) => array.indexOf(value) === index)
      dispatch({ type: "SET_CATEGORIES", payload: sanitized })
    },
    [dispatch],
  )

  const setSelectedServices = useCallback(
    (values: string[]) => {
      const sanitized = values
        .filter((value): value is string => Boolean(value))
        .filter((value, index, array) => array.indexOf(value) === index)
      dispatch({ type: "SET_SERVICES", payload: sanitized })
    },
    [dispatch],
  )

  const setSelectedCities = useCallback(
    (values: string[]) => {
      const sanitized = values
        .filter((value): value is string => Boolean(value))
        .filter((value, index, array) => array.indexOf(value) === index)
      dispatch({ type: "SET_CITIES", payload: sanitized })
    },
    [dispatch],
  )
  const setKeyword = useCallback((value: string) => dispatch({ type: "SET_KEYWORD", payload: value }), [])
  const setSortBy = useCallback((value: ProfessionalSortOption) => dispatch({ type: "SET_SORT", payload: value }), [])
  const clearAllFilters = useCallback(() => dispatch({ type: "RESET" }), [])

  const hasActiveFilters = useCallback(
    () =>
      selectedCategories.length > 0 ||
      selectedServices.length > 0 ||
      selectedCities.length > 0 ||
      keyword.trim().length > 0,
    [keyword, selectedCategories.length, selectedCities.length, selectedServices.length],
  )

  const removeFilter = useCallback(
    (type: string, value: string) => {
      switch (type) {
        case "category":
          setSelectedCategories(selectedCategories.filter((item) => item !== value))
          break
        case "service":
          setSelectedServices(selectedServices.filter((item) => item !== value))
          break
        case "city":
          setSelectedCities(selectedCities.filter((item) => item !== value))
          break
        case "keyword":
          setKeyword("")
          break
        default:
          break
      }
    },
    [selectedCategories, selectedCities, selectedServices, setKeyword, setSelectedCategories, setSelectedCities, setSelectedServices],
  )

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const initializedRef = useRef(false)
  const lastParsedQueryRef = useRef<string>("")
  const lastSyncedQueryRef = useRef<string>("")
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

  useEffect(() => {
    if (!initializedRef.current) return
    const params = new URLSearchParams()

    const categoryTokens = mapIdsToTokens(selectedCategories, categoryTokenMaps)
    if (categoryTokens.length > 0) {
      params.set("categories", categoryTokens.join(","))
    }

    const serviceTokens = mapIdsToTokens(selectedServices, serviceTokenMaps)
    if (serviceTokens.length > 0) {
      params.set("services", serviceTokens.join(","))
    }

    if (selectedCities.length > 0) {
      params.set("city", selectedCities.join(","))
    }

    if (keyword.trim().length > 0) {
      params.set("search", keyword.trim())
    }

    const nextQuery = params.toString()
    if (nextQuery === lastSyncedQueryRef.current) {
      return
    }

    if (debouncedReplaceRef.current) {
      debouncedReplaceRef.current(nextQuery)
    }
  }, [
    categoryTokenMaps,
    keyword,
    selectedCategories,
    selectedCities,
    selectedServices,
    serviceTokenMaps,
  ])

  useEffect(() => {
    const currentQuery = searchParams.toString()
    if (!initializedRef.current || currentQuery !== lastParsedQueryRef.current) {
      const categoriesParam = parseCommaSeparatedParam(searchParams.get("categories"))
      const servicesParam = parseCommaSeparatedParam(searchParams.get("services"))
      const cityParams = parseCommaSeparatedParam(searchParams.get("city"))
      const keywordParam = searchParams.get("search") ?? searchParams.get("keyword") ?? ""

      const resolvedCategories = resolveTokensToIds(categoriesParam, categoryTokenMaps)
      const resolvedServices = resolveTokensToIds(servicesParam, serviceTokenMaps)

      if (!areStringArraysEqual(resolvedCategories, selectedCategories)) {
        dispatch({ type: "SET_CATEGORIES", payload: resolvedCategories })
      }
      if (!areStringArraysEqual(resolvedServices, selectedServices)) {
        dispatch({ type: "SET_SERVICES", payload: resolvedServices })
      }
      if (!areStringArraysEqual(cityParams, selectedCities)) {
        dispatch({ type: "SET_CITIES", payload: cityParams })
      }
      if (keywordParam !== keyword) {
        dispatch({ type: "SET_KEYWORD", payload: keywordParam })
      }

      lastParsedQueryRef.current = currentQuery
    }
    if (!initializedRef.current) {
      initializedRef.current = true
    }
  }, [
    categoryTokenMaps,
    keyword,
    searchParams,
    selectedCategories,
    selectedCities,
    selectedServices,
    serviceTokenMaps,
  ])

  const contextValue = useMemo<ProfessionalFilterContextValue>(
    () => ({
      selectedCategories,
      selectedServices,
      selectedCities,
      keyword,
      sortBy,
      setSelectedCategories,
      setSelectedServices,
      setSelectedCities,
      setKeyword,
      setSortBy,
      clearAllFilters,
      removeFilter,
      hasActiveFilters,
      taxonomy,
      taxonomyLabelMap,
      cities,
    }),
    [
      clearAllFilters,
      hasActiveFilters,
      keyword,
      sortBy,
      cities,
      removeFilter,
      selectedCategories,
      selectedCities,
      selectedServices,
      setKeyword,
      setSortBy,
      setSelectedCategories,
      setSelectedCities,
      setSelectedServices,
      taxonomy,
      taxonomyLabelMap,
    ],
  )

  return <ProfessionalFilterContext.Provider value={contextValue}>{children}</ProfessionalFilterContext.Provider>
}

export function ProfessionalFilterProvider({ children }: { children: ReactNode }) {
  return <ProfessionalFilterProviderInner>{children}</ProfessionalFilterProviderInner>
}

export function useProfessionalFilters() {
  const context = useContext(ProfessionalFilterContext)
  if (!context) {
    throw new Error("useProfessionalFilters must be used within a ProfessionalFilterProvider")
  }
  return context
}
