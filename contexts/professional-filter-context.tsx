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
import { usePathname, useSearchParams } from "next/navigation"

import { PROVINCES, provinceKey } from "@/lib/provinces"

import { useProfessionalTaxonomy, type LocationOptions } from "@/hooks/use-professional-taxonomy"

// Sort keys are defined in lib/professionals/sort.ts and applied
// server-side via the search_professionals RPC (see migration 131).
import {
  PROFESSIONAL_SORT_OPTIONS as SORT_KEYS,
  DEFAULT_PROFESSIONAL_SORT,
  type ProfessionalSort,
} from "@/lib/professionals/sort"

export const PROFESSIONAL_SORT_OPTIONS = SORT_KEYS
export type ProfessionalSortOption = ProfessionalSort
export { DEFAULT_PROFESSIONAL_SORT }

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

const REGION_BY_SLUG = new Map(Object.entries(PROVINCES).map(([en, v]) => [v.slug, en]))
const regionToSlug = (en: string) => PROVINCES[en]?.slug ?? en

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
  /** Province filters — canonical EN keys of PROVINCES. */
  selectedRegions: string[]
  keyword: string
  sortBy: ProfessionalSortOption
}

const INITIAL_STATE: ProfessionalFilterState = {
  selectedCategories: [],
  selectedServices: [],
  selectedCities: [],
  selectedRegions: [],
  keyword: "",
  sortBy: DEFAULT_PROFESSIONAL_SORT,
}

type ProfessionalFilterAction =
  | { type: "SET_CATEGORIES"; payload: string[] }
  | { type: "SET_SERVICES"; payload: string[] }
  | { type: "SET_CITIES"; payload: string[] }
  | { type: "SET_REGIONS"; payload: string[] }
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
    case "SET_REGIONS":
      return { ...state, selectedRegions: action.payload }
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
  setSelectedRegions: (values: string[]) => void
  setKeyword: (value: string) => void
  setSortBy: (value: ProfessionalSortOption) => void
  clearAllFilters: () => void
  removeFilter: (type: string, value: string) => void
  hasActiveFilters: () => boolean
  taxonomy: ReturnType<typeof useProfessionalTaxonomy>
  taxonomyLabelMap: Map<string, string>
  cities: string[]
  /** Canonical EN province key -> member cities (from location facets). */
  regionCityMap: Record<string, string[]>
}

const ProfessionalFilterContext = createContext<ProfessionalFilterContextValue | undefined>(undefined)

/** Minimal, serializable hub definition passed down from the server —
 *  a URL-worthy filter preset (/professionals/amsterdam). Mirrors the
 *  projects HubDef contract. */
export interface ProHubDef {
  slug: string
  kind: "city" | "province" | "service" | "service-city" | "service-province" | "category" | "category-city" | "category-province"
  cityName?: string
  region?: string
  /** specialty slug == service filter URL token. */
  serviceSlug?: string
  /** service GROUP slug == categories filter URL token. */
  categorySlug?: string
}

function ProfessionalFilterProviderInner({ children, hubs = [], hubSlug }: { children: ReactNode; hubs?: ProHubDef[]; hubSlug?: string }) {
  const taxonomy = useProfessionalTaxonomy()
  // The hub preset applies only while the URL is still on the hub's
  // path — URL sync is shallow, so this tree survives leaving it.
  const livePathname = usePathname()
  const activeHub = hubSlug && livePathname.endsWith(`/${hubSlug}`)
    ? hubs.find((h) => h.slug === hubSlug) ?? null
    : null
  const initialSearchParams = useSearchParams()
  // Seed keyword from URL so the first render already has it — otherwise the
  // discover page mounts with empty filters, fetches all results, then
  // re-fetches once the URL-sync effect populates ?search=.
  const [state, dispatch] = useReducer(
    filterReducer,
    INITIAL_STATE,
    (initial) => ({
      ...initial,
      keyword: initialSearchParams.get("search") ?? initialSearchParams.get("keyword") ?? "",
      // Hub pages mount pre-filtered so the first client render matches
      // the server-filtered grid. Service seeding happens at hydration
      // (tokens need the taxonomy's token maps).
      ...((activeHub?.kind === "city" || activeHub?.kind === "service-city" || activeHub?.kind === "category-city") && activeHub.cityName ? { selectedCities: [activeHub.cityName] } : {}),
      ...((activeHub?.kind === "province" || activeHub?.kind === "service-province" || activeHub?.kind === "category-province") && activeHub.region ? { selectedRegions: [activeHub.region] } : {}),
    }),
  )
  const { selectedCategories, selectedServices, selectedCities, selectedRegions, keyword, sortBy } = state

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

  // Province -> member cities, from the same facets that feed the city
  // list. Mirrors the projects regionCityMap contract.
  const regionCityMap = useMemo(() => {
    const map: Record<string, Set<string>> = {}
    taxonomy.locationFacets.forEach((facet) => {
      const key = provinceKey(facet.stateRegion)
      if (!key || !facet.city) return
      ;(map[key] ??= new Set()).add(facet.city)
    })
    return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, Array.from(v).sort((a, b) => a.localeCompare(b))]))
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
  const setSelectedRegions = useCallback(
    (values: string[]) => {
      const sanitized = values
        .filter((value): value is string => Boolean(value))
        .filter((value, index, array) => array.indexOf(value) === index)
      dispatch({ type: "SET_REGIONS", payload: sanitized })
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
      selectedRegions.length > 0 ||
      keyword.trim().length > 0,
    [keyword, selectedCategories.length, selectedCities.length, selectedRegions.length, selectedServices.length],
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
        case "region":
          setSelectedRegions(selectedRegions.filter((item) => item !== value))
          break
        case "keyword":
          setKeyword("")
          break
        default:
          break
      }
    },
    [selectedCategories, selectedCities, selectedRegions, selectedServices, setKeyword, setSelectedCategories, setSelectedCities, setSelectedRegions, setSelectedServices],
  )

  const pathname = livePathname
  const searchParams = initialSearchParams
  const initializedRef = useRef(false)
  const lastParsedQueryRef = useRef<string>("")
  const lastSyncedQueryRef = useRef<string>("")

  // URL sync is SHALLOW (same as the projects filter): the address bar
  // mirrors filter state — including hub paths — without a server
  // navigation, so filtering never reloads the page.

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

    if (selectedRegions.length > 0) {
      params.set("region", selectedRegions.map(regionToSlug).join(","))
    }

    if (keyword.trim().length > 0) {
      params.set("search", keyword.trim())
    }

    // ── Hub URL mapping — exactly one preset -> /professionals/{slug}.
    const pathHub = hubs
      .filter((h) => pathname.endsWith(`/${h.slug}`))
      .sort((a, b) => b.slug.length - a.slug.length)[0]
    const basePath = pathHub
      ? pathname.slice(0, pathname.length - pathHub.slug.length - 1)
      : pathname
    const only = (cities: number, regions: number, services: number, cats = 0) =>
      selectedCities.length === cities &&
      selectedRegions.length === regions &&
      selectedServices.length === services &&
      selectedCategories.length === cats &&
      keyword.trim().length === 0
    const svcTokens = mapIdsToTokens(selectedServices, serviceTokenMaps)
    const catTokens = mapIdsToTokens(selectedCategories, categoryTokenMaps)
    const matchedHub =
      hubs.find((h) =>
        h.kind === "service-city" && h.cityName && h.serviceSlug && only(1, 0, 1) &&
        selectedCities[0]?.toLowerCase() === h.cityName.toLowerCase() &&
        svcTokens[0]?.toLowerCase() === h.serviceSlug.toLowerCase(),
      ) ??
      hubs.find((h) =>
        h.kind === "service-province" && h.region && h.serviceSlug && only(0, 1, 1) &&
        selectedRegions[0] === h.region &&
        svcTokens[0]?.toLowerCase() === h.serviceSlug.toLowerCase(),
      ) ??
      hubs.find((h) =>
        h.kind === "category-city" && h.cityName && h.categorySlug && only(1, 0, 0, 1) &&
        selectedCities[0]?.toLowerCase() === h.cityName.toLowerCase() &&
        catTokens[0]?.toLowerCase() === h.categorySlug.toLowerCase(),
      ) ??
      hubs.find((h) =>
        h.kind === "category-province" && h.region && h.categorySlug && only(0, 1, 0, 1) &&
        selectedRegions[0] === h.region &&
        catTokens[0]?.toLowerCase() === h.categorySlug.toLowerCase(),
      ) ??
      hubs.find((h) =>
        h.kind === "city" && h.cityName && only(1, 0, 0) &&
        selectedCities[0]?.toLowerCase() === h.cityName.toLowerCase(),
      ) ??
      hubs.find((h) =>
        h.kind === "province" && h.region && only(0, 1, 0) &&
        selectedRegions[0] === h.region,
      ) ??
      hubs.find((h) =>
        h.kind === "service" && h.serviceSlug && only(0, 0, 1) &&
        svcTokens[0]?.toLowerCase() === h.serviceSlug.toLowerCase(),
      ) ??
      hubs.find((h) =>
        h.kind === "category" && h.categorySlug && only(0, 0, 0, 1) &&
        catTokens[0]?.toLowerCase() === h.categorySlug.toLowerCase(),
      ) ?? null

    const nextQuery = matchedHub ? "" : params.toString()
    const targetPath = matchedHub ? `${basePath}/${matchedHub.slug}` : basePath
    const currentQuery = searchParams.toString()
    if (nextQuery === lastSyncedQueryRef.current && targetPath === pathname) {
      return
    }
    if (targetPath === pathname && nextQuery === currentQuery) {
      lastSyncedQueryRef.current = nextQuery
      return
    }
    lastSyncedQueryRef.current = nextQuery
    window.history.replaceState(window.history.state, "", nextQuery.length === 0 ? targetPath : `${targetPath}?${nextQuery}`)
  }, [
    categoryTokenMaps,
    keyword,
    selectedCategories,
    selectedCities,
    selectedRegions,
    selectedServices,
    serviceTokenMaps,
    pathname,
    hubs,
    searchParams,
  ])

  useEffect(() => {
    const currentQuery = searchParams.toString()
    // Tokens parsed before the taxonomy loaded sit in state as raw slugs
    // ("design-planning") — the chips render (label map covers slugs) but
    // id-keyed checkboxes don't. Re-resolve once the token maps can.
    const needsResolution = (values: string[], maps: TokenMaps) =>
      values.some((v) => !maps.idToToken.has(v) && maps.tokenToId.has(normalizeToken(v)))
    const pendingResolution =
      needsResolution(selectedCategories, categoryTokenMaps) ||
      needsResolution(selectedServices, serviceTokenMaps)
    if (!initializedRef.current || currentQuery !== lastParsedQueryRef.current || pendingResolution) {
      let categoriesParam = parseCommaSeparatedParam(searchParams.get("categories"))
      if ((activeHub?.kind === "category" || activeHub?.kind === "category-city" || activeHub?.kind === "category-province") && activeHub.categorySlug && !categoriesParam.includes(activeHub.categorySlug)) {
        categoriesParam = [activeHub.categorySlug, ...categoriesParam]
      }
      let servicesParam = parseCommaSeparatedParam(searchParams.get("services"))
      if ((activeHub?.kind === "service" || activeHub?.kind === "service-city" || activeHub?.kind === "service-province") && activeHub.serviceSlug && !servicesParam.includes(activeHub.serviceSlug)) {
        servicesParam = [activeHub.serviceSlug, ...servicesParam]
      }
      let cityParams = parseCommaSeparatedParam(searchParams.get("city"))
      if ((activeHub?.kind === "city" || activeHub?.kind === "service-city" || activeHub?.kind === "category-city") && activeHub.cityName && !cityParams.includes(activeHub.cityName)) {
        cityParams = [activeHub.cityName, ...cityParams]
      }
      let regionParams = parseCommaSeparatedParam(searchParams.get("region"))
        .map((slug) => REGION_BY_SLUG.get(slug) ?? provinceKey(slug) ?? slug)
      if ((activeHub?.kind === "province" || activeHub?.kind === "service-province" || activeHub?.kind === "category-province") && activeHub.region && !regionParams.includes(activeHub.region)) {
        regionParams = [activeHub.region, ...regionParams]
      }
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
      if (!areStringArraysEqual(regionParams, selectedRegions)) {
        dispatch({ type: "SET_REGIONS", payload: regionParams })
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
    selectedRegions,
    selectedServices,
    serviceTokenMaps,
  ])

  const contextValue = useMemo<ProfessionalFilterContextValue>(
    () => ({
      selectedCategories,
      selectedServices,
      selectedCities,
      selectedRegions,
      keyword,
      sortBy,
      setSelectedCategories,
      setSelectedServices,
      setSelectedCities,
      setSelectedRegions,
      setKeyword,
      setSortBy,
      clearAllFilters,
      removeFilter,
      hasActiveFilters,
      taxonomy,
      taxonomyLabelMap,
      cities,
      regionCityMap,
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
      selectedRegions,
      selectedServices,
      setKeyword,
      setSortBy,
      setSelectedCategories,
      setSelectedCities,
      setSelectedRegions,
      setSelectedServices,
      taxonomy,
      taxonomyLabelMap,
      regionCityMap,
    ],
  )

  return <ProfessionalFilterContext.Provider value={contextValue}>{children}</ProfessionalFilterContext.Provider>
}

export function ProfessionalFilterProvider({ children, hubs, hubSlug }: { children: ReactNode; hubs?: ProHubDef[]; hubSlug?: string }) {
  return <ProfessionalFilterProviderInner hubs={hubs} hubSlug={hubSlug}>{children}</ProfessionalFilterProviderInner>
}

export function useProfessionalFilters() {
  const context = useContext(ProfessionalFilterContext)
  if (!context) {
    throw new Error("useProfessionalFilters must be used within a ProfessionalFilterProvider")
  }
  return context
}
