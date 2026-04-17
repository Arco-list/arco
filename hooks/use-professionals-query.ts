"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useLocale } from "next-intl"

import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import type { ProfessionalCard } from "@/lib/professionals/types"
import { useProfessionalFilters } from "@/contexts/professional-filter-context"
import { translateProfessionalService } from "@/lib/project-translations"

const PLACEHOLDER_IMAGE = "/placeholder.svg?height=300&width=300"
// First page leaves a slot for the inline map card so the grid shows
// exactly 5 full rows on desktop (14 pros + 1 map card = 15 = 5×3).
// Subsequent pages add full rows (multiples of 3) so the alignment is
// preserved as the user loads more.
const FIRST_PAGE_SIZE = 14
const PAGE_SIZE = 15

type SearchProfessionalsRow = {
  id: string
  user_id: string | null
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  user_location: string | null
  title: string | null
  company_id: string | null
  company_name: string | null
  company_slug: string | null
  company_logo: string | null
  company_domain: string | null
  company_city: string | null
  company_state_region: string | null
  company_country: string | null
  company_latitude: number | null
  company_longitude: number | null
  primary_specialty: string | null
  primary_service_name: string | null
  services_offered: string[] | null
  hourly_rate_display: string | null
  is_verified: boolean | null
  cover_photo_url: string | null
  specialty_ids: string[] | null
  specialty_parent_ids: string[] | null
  credited_sum?: number
  views_count?: number
  is_featured?: boolean
}

interface UseProfessionalsQueryResult {
  professionals: ProfessionalCard[]
  /** All professionals ever fetched (unfiltered) — used for instant client-side map filtering */
  allProfessionals: ProfessionalCard[]
  total: number
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => Promise<void>
  refetch: () => Promise<void>
}

const mapRowToCard = (row: SearchProfessionalsRow, locale: string = "en"): ProfessionalCard | null => {
  const companyId = row.company_id
  if (!companyId && !row.company_name) {
    return null
  }

  const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ").trim()
  const name = row.company_name || fullName || "Professional"

  // Primary service comes back from the RPC as the English display name;
  // translate via PROFESSIONAL_SERVICE_LABELS so NL visitors see a Dutch
  // label without a DB round-trip.
  const profession =
    translateProfessionalService(row.primary_service_name, locale)
    ?? row.primary_service_name
    ?? "Professional services"

  // Use company location (city, country)
  const locationParts = [row.company_city, row.company_country].filter((value): value is string => Boolean(value))
  const location = locationParts.length > 0 ? locationParts.join(", ") : "Location unavailable"

  const specialties = Array.isArray(row.services_offered)
    ? row.services_offered
        .filter((value): value is string => Boolean(value))
        .map((value) => translateProfessionalService(value, locale) ?? value)
    : []

  return {
    id: companyId,
    slug: row.company_slug || companyId,
    companyId: companyId,
    professionalId: row.id,
    name,
    profession,
    location,
    image: row.cover_photo_url || row.company_logo || row.avatar_url || PLACEHOLDER_IMAGE,
    logoUrl: row.company_logo ?? null,
    specialties,
    isVerified: Boolean(row.is_verified),
    domain: row.company_domain ?? null,
    latitude: row.company_latitude ?? null,
    longitude: row.company_longitude ?? null,
    specialtyIds: Array.isArray(row.specialty_ids) ? row.specialty_ids : [],
    specialtyParentIds: Array.isArray(row.specialty_parent_ids) ? row.specialty_parent_ids : [],
    city: row.company_city ? row.company_city.toLowerCase().trim() : null,
  }
}

export function useProfessionalsQuery(
  initialProfessionals: ProfessionalCard[] = [],
  initialTotal?: number,
): UseProfessionalsQueryResult {
  const locale = useLocale()
  const {
    selectedCategories,
    selectedServices,
    selectedCities,
    keyword,
    taxonomy,
    sortBy,
  } = useProfessionalFilters()

  const [professionals, setProfessionals] = useState<ProfessionalCard[]>(initialProfessionals)
  const [allProfessionals, setAllProfessionals] = useState<ProfessionalCard[]>(initialProfessionals)
  const [hasMore, setHasMore] = useState(initialProfessionals.length === FIRST_PAGE_SIZE)
  const [currentOffset, setCurrentOffset] = useState(initialProfessionals.length)
  // Seeded from SSR — `fetchDiscoverProfessionals` returns the real total so
  // the result count is correct on first paint. Falls back to the loaded
  // length only if the caller didn't pass a total.
  const [total, setTotal] = useState(initialTotal ?? initialProfessionals.length)
  const [isLoading, setIsLoading] = useState(false) // Start with SSR data
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const hasInitialDataRef = useRef(initialProfessionals.length > 0)
  // Capture the sort the SSR data was fetched with so we know to refetch if
  // the user changes the sort before triggering any other filter.
  const initialSortRef = useRef(sortBy)

  const fetchPage = useCallback(
    async (offset: number, replace: boolean) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      const controller = new AbortController()
      abortControllerRef.current = controller

      if (replace) {
        setIsLoading(true)
      } else {
        setIsLoadingMore(true)
      }
      setError(null)

      try {
        const supabase = getBrowserSupabaseClient()

        // Validate that filters are UUIDs, not slugs
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        const isUuid = (value: string) => UUID_REGEX.test(value)

        const validCategories = selectedCategories.filter(isUuid)
        const validServices = selectedServices.filter(isUuid)

        // Log validation for debugging
        if (selectedCategories.length !== validCategories.length) {
          console.warn('Non-UUID categories filtered out:', selectedCategories.filter(c => !isUuid(c)))
        }
        if (selectedServices.length !== validServices.length) {
          console.warn('Non-UUID services filtered out:', selectedServices.filter(s => !isUuid(s)))
        }

        const filterParams = {
          search_query: keyword.trim().length > 0 ? keyword.trim() : null,
          country_filter: null,
          state_filter: null,
          city_filters: selectedCities.length > 0 ? selectedCities : null,
          category_filters: validCategories.length > 0 ? validCategories : null,
          service_filters: validServices.length > 0 ? validServices : null,
          min_rating: null,
          max_hourly_rate: null,
          verified_only: false,
        }

        const size = offset === 0 ? FIRST_PAGE_SIZE : PAGE_SIZE
        const dataPromise = supabase.rpc(
          "search_professionals",
          { ...filterParams, limit_count: size, offset_count: offset, sort_by: sortBy },
          { signal: controller.signal },
        )

        // Fetch total count in parallel on first page
        const countPromise = replace
          ? supabase.rpc("count_professionals", filterParams, { signal: controller.signal })
          : null

        const [{ data, error: rpcError }, countResult] = await Promise.all([
          dataPromise,
          countPromise ?? Promise.resolve(null),
        ])

        if (rpcError) {
          throw rpcError
        }

        if (replace && countResult && !countResult.error && countResult.data != null) {
          setTotal(Number(countResult.data))
        }

        const rows = Array.isArray(data) ? (data as SearchProfessionalsRow[]) : []
        const mapped = rows
          .map((row) => mapRowToCard(row, locale))
          .filter((card): card is ProfessionalCard => card !== null)

        setProfessionals((prev) => (replace ? mapped : [...prev, ...mapped]))
        // Accumulate all unique professionals for client-side map filtering
        setAllProfessionals((prev) => {
          const existing = new Map(prev.map((p) => [p.companyId, p]))
          mapped.forEach((p) => existing.set(p.companyId, p))
          return Array.from(existing.values())
        })
        setHasMore(mapped.length === size)
        setCurrentOffset(offset + mapped.length)
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return
        }
        const message = err instanceof Error ? err.message : "Unable to load professionals"
        setError(message)
        if (replace) {
          setProfessionals([])
          setHasMore(false)
          setCurrentOffset(0)
        }
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null
        }
        if (replace) {
          setIsLoading(false)
        } else {
          setIsLoadingMore(false)
        }
      }
    },
    [keyword, selectedCategories, selectedCities, selectedServices, sortBy],
  )

  useEffect(() => {
    // Don't fetch until taxonomy is loaded
    if (taxonomy.isLoading) {
      return
    }

    // Check if we have any active filters
    const hasFilters =
      selectedCategories.length > 0 ||
      selectedServices.length > 0 ||
      selectedCities.length > 0 ||
      keyword.trim().length > 0

    // If we have initial SSR data, no filters, and the sort hasn't changed
    // from the one the SSR fetch used, the initial data is still valid.
    if (hasInitialDataRef.current && !hasFilters && sortBy === initialSortRef.current) {
      hasInitialDataRef.current = false
      return
    }

    // Clear the flag for subsequent filter changes
    hasInitialDataRef.current = false

    // Don't clear professionals — keep old data visible until new results arrive
    setHasMore(true)
    setCurrentOffset(0)
    void fetchPage(0, true)
  }, [fetchPage, taxonomy.isLoading, selectedCategories.length, selectedServices.length, selectedCities, keyword, sortBy])

  const loadMore = useCallback(async () => {
    if (isLoading || isLoadingMore || !hasMore) {
      return
    }
    await fetchPage(currentOffset, false)
  }, [fetchPage, currentOffset, hasMore, isLoading, isLoadingMore])

  const refetch = useCallback(async () => {
    setCurrentOffset(0)
    await fetchPage(0, true)
  }, [fetchPage])

  return {
    professionals,
    allProfessionals,
    total,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    refetch,
  }
}
