"use client"

import { useCallback, useEffect, useState } from "react"

import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import type { Tables } from "@/lib/supabase/types"

const CACHE_TTL_MS = 5 * 60 * 1000

export type LocationFacet = {
  country: string | null
  stateRegion: string | null
  city: string | null
}

export type LocationOption = LocationFacet & {
  key: string
  label: string
}

export type LocationOptions = {
  countries: string[]
  statesByCountry: Map<string, string[]>
  citiesByCountryState: Map<string, Map<string, string[]>>
  flatOptions: LocationOption[]
}

type CategoryRow = Tables<"categories">

type ProfessionalTaxonomyCache = {
  categories: CategoryRow[]
  services: CategoryRow[]
  locationFacets: LocationFacet[]
  locationOptions: LocationOptions
  fetchedAt: number
}

let taxonomyCache: ProfessionalTaxonomyCache | null = null
let inFlightPromise: Promise<void> | null = null

interface LocationRpcRow {
  country: string | null
  state_region: string | null
  city: string | null
}

interface ProfessionalTaxonomyState {
  categories: CategoryRow[]
  services: CategoryRow[]
  locationFacets: LocationFacet[]
  locationOptions: LocationOptions
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const sanitizeString = (value: string | null | undefined) => {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const EMPTY_LOCATION_OPTIONS: LocationOptions = {
  countries: [],
  statesByCountry: new Map(),
  citiesByCountryState: new Map(),
  flatOptions: [],
}

const formatLocationLabel = (facet: LocationFacet): string => {
  const parts: string[] = []
  if (facet.city) parts.push(facet.city)
  if (facet.stateRegion && facet.stateRegion !== facet.city) parts.push(facet.stateRegion)
  if (facet.country) parts.push(facet.country)
  if (parts.length === 0) {
    return facet.country ?? facet.stateRegion ?? facet.city ?? ""
  }
  return parts.join(", ")
}

const buildLocationOptions = (facets: LocationFacet[]): LocationOptions => {
  const countrySet = new Set<string>()
  const statesByCountry = new Map<string, Set<string>>()
  const citiesByCountryState = new Map<string, Map<string, Set<string>>>()

  facets.forEach((facet) => {
    const { country, stateRegion, city } = facet

    if (country) {
      countrySet.add(country)
      if (stateRegion) {
        const stateSet = statesByCountry.get(country) ?? new Set<string>()
        stateSet.add(stateRegion)
        statesByCountry.set(country, stateSet)
      }

      const stateKey = stateRegion ?? "__none__"
      const stateMap = citiesByCountryState.get(country) ?? new Map<string, Set<string>>()
      const citySet = stateMap.get(stateKey) ?? new Set<string>()
      if (city) {
        citySet.add(city)
      }
      stateMap.set(stateKey, citySet)
      citiesByCountryState.set(country, stateMap)
    }
  })

  const countries = Array.from(countrySet).sort((a, b) => a.localeCompare(b))
  const sortedStatesByCountry = new Map<string, string[]>()
  countries.forEach((country) => {
    const stateSet = statesByCountry.get(country)
    const states = stateSet ? Array.from(stateSet).sort((a, b) => a.localeCompare(b)) : []
    sortedStatesByCountry.set(country, states)
  })

  const sortedCitiesByCountryState = new Map<string, Map<string, string[]>>()
  countries.forEach((country) => {
    const stateMap = citiesByCountryState.get(country)
    if (!stateMap) return
    const sortedStateMap = new Map<string, string[]>()
    stateMap.forEach((citySet, stateKey) => {
      const cities = Array.from(citySet).sort((a, b) => a.localeCompare(b))
      sortedStateMap.set(stateKey, cities)
    })
    sortedCitiesByCountryState.set(country, sortedStateMap)
  })

  // Only include locations that have a city (no country-only or state-only options)
  const flatOptions: LocationOption[] = facets
    .filter((facet) => facet.city !== null)
    .map((facet) => ({
      ...facet,
      key: [facet.country ?? "", facet.stateRegion ?? "", facet.city ?? ""].join("|"),
      label: formatLocationLabel(facet),
    }))

  return {
    countries,
    statesByCountry: sortedStatesByCountry,
    citiesByCountryState: sortedCitiesByCountryState,
    flatOptions,
  }
}

export function useProfessionalTaxonomy(): ProfessionalTaxonomyState {
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [services, setServices] = useState<CategoryRow[]>([])
  const [locationFacets, setLocationFacets] = useState<LocationFacet[]>([])
  const [locationOptions, setLocationOptions] = useState<LocationOptions>(EMPTY_LOCATION_OPTIONS)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const applyCache = useCallback((cache: ProfessionalTaxonomyCache | null) => {
    if (!cache) return
    setCategories(cache.categories)
    setServices(cache.services)
    setLocationFacets(cache.locationFacets)
    setLocationOptions(cache.locationOptions)
  }, [])

  const load = useCallback(
    async (options: { force?: boolean } = {}) => {
      const { force = false } = options
      setIsLoading(true)
      setError(null)

      try {
        const now = Date.now()
        if (!force && taxonomyCache && now - taxonomyCache.fetchedAt < CACHE_TTL_MS) {
          applyCache(taxonomyCache)
          return
        }

        if (!force && inFlightPromise) {
          await inFlightPromise
          applyCache(taxonomyCache)
          return
        }

        const supabase = getBrowserSupabaseClient()

        const run = async () => {
          const [categoriesResult, locationsResult] = await Promise.all([
            supabase
              .from("categories")
              .select("id,name,slug,parent_id,sort_order,is_active")
              .eq("is_active", true)
              .order("sort_order", { ascending: true, nullsFirst: false })
              .order("name", { ascending: true }),
            supabase.rpc("get_professional_location_facets"),
          ])

          if (categoriesResult.error) {
            throw categoriesResult.error
          }

          if (locationsResult.error) {
            throw locationsResult.error
          }

          const categoryRecords = (categoriesResult.data as CategoryRow[] | null) ?? []

          // Parent categories (no parent_id) = top-level filter categories
          const allowedCategories = categoryRecords.filter((r) => !r.parent_id)
          // Child categories (have parent_id) = services within a category
          const allowedServices = categoryRecords.filter((r) => !!r.parent_id)

          const locationRecords = (locationsResult.data as LocationRpcRow[] | null) ?? []

          const uniqueLocations = new Map<string, LocationFacet>()
          locationRecords.forEach((entry) => {
            const country = sanitizeString(entry.country)
            const stateRegion = sanitizeString(entry.state_region)
            const city = sanitizeString(entry.city)
            const key = [country ?? "", stateRegion ?? "", city ?? ""].join("|")
            if (!uniqueLocations.has(key)) {
              uniqueLocations.set(key, { country, stateRegion, city })
            }
          })

          const orderedLocations = Array.from(uniqueLocations.values()).sort((a, b) => {
            const countryCompare = (a.country ?? "").localeCompare(b.country ?? "")
            if (countryCompare !== 0) return countryCompare
            const regionCompare = (a.stateRegion ?? "").localeCompare(b.stateRegion ?? "")
            if (regionCompare !== 0) return regionCompare
            return (a.city ?? "").localeCompare(b.city ?? "")
          })

          const options = buildLocationOptions(orderedLocations)

          taxonomyCache = {
            categories: allowedCategories,
            services: allowedServices,
            locationFacets: orderedLocations,
            locationOptions: options,
            fetchedAt: Date.now(),
          }

          applyCache(taxonomyCache)
        }

        const promise = run()
        inFlightPromise = promise
        await promise
        inFlightPromise = null
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load professional filters"
        setError(message)
      } finally {
        setIsLoading(false)
      }
    },
    [applyCache],
  )

  useEffect(() => {
    void load()
  }, [load])

  const refresh = useCallback(async () => {
    taxonomyCache = null
    await load({ force: true })
  }, [load])

  return {
    categories,
    services,
    locationFacets,
    locationOptions,
    isLoading,
    error,
    refresh,
  }
}
