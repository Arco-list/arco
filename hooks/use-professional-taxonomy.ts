"use client"

import { useCallback, useEffect, useState } from "react"

import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import type { Tables } from "@/lib/supabase/types"
import { PROFESSIONAL_CATEGORY_CONFIG } from "@/lib/professional-filter-map"

const CACHE_TTL_MS = 5 * 60 * 1000

type CategoryRow = Tables<"categories">

type ProfessionalTaxonomyCache = {
  categories: CategoryRow[]
  services: CategoryRow[]
  locationFacets: LocationFacet[]
  fetchedAt: number
}

let taxonomyCache: ProfessionalTaxonomyCache | null = null
let inFlightPromise: Promise<void> | null = null

type LocationFacet = {
  country: string | null
  stateRegion: string | null
  city: string | null
}

type LocationRow = {
  company_country: string | null
  company_state_region: string | null
  company_city: string | null
}

interface ProfessionalTaxonomyState {
  categories: CategoryRow[]
  services: CategoryRow[]
  locationFacets: LocationFacet[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const sanitizeString = (value: string | null | undefined) => {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const allowedCategorySlugs = new Set(PROFESSIONAL_CATEGORY_CONFIG.map((category) => category.slug))
const allowedServiceSlugs = new Set(
  PROFESSIONAL_CATEGORY_CONFIG.flatMap((category) => category.services.map((service) => service.slug)),
)

export function useProfessionalTaxonomy(): ProfessionalTaxonomyState {
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [services, setServices] = useState<CategoryRow[]>([])
  const [locationFacets, setLocationFacets] = useState<LocationFacet[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const applyCache = useCallback((cache: ProfessionalTaxonomyCache | null) => {
    if (!cache) return
    setCategories(cache.categories)
    setServices(cache.services)
    setLocationFacets(cache.locationFacets)
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
            supabase
              .from("mv_professional_summary")
              .select("company_country,company_state_region,company_city")
              .order("company_country", { ascending: true, nullsFirst: false })
              .order("company_state_region", { ascending: true, nullsFirst: false })
              .order("company_city", { ascending: true, nullsFirst: false }),
          ])

          if (categoriesResult.error) {
            throw categoriesResult.error
          }

          if (locationsResult.error) {
            throw locationsResult.error
          }

          const categoryRecords = (categoriesResult.data as CategoryRow[] | null) ?? []

          const allowedCategories = categoryRecords.filter(
            (record) => record.slug && allowedCategorySlugs.has(record.slug),
          )
          const allowedServices = categoryRecords.filter(
            (record) => record.slug && allowedServiceSlugs.has(record.slug),
          )

          const locationRecords = (locationsResult.data as LocationRow[] | null) ?? []

          const uniqueLocations = new Map<string, LocationFacet>()
          locationRecords.forEach((entry) => {
            const country = sanitizeString(entry.company_country)
            const stateRegion = sanitizeString(entry.company_state_region)
            const city = sanitizeString(entry.company_city)
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

          taxonomyCache = {
            categories: allowedCategories,
            services: allowedServices,
            locationFacets: orderedLocations,
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
    isLoading,
    error,
    refresh,
  }
}
