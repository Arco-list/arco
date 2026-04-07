"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useLocale } from "next-intl"

import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import type { ProfessionalCard } from "@/lib/professionals/types"
import { useProfessionalFilters } from "@/contexts/professional-filter-context"

const PLACEHOLDER_IMAGE = "/placeholder.svg?height=300&width=300"
const PAGE_SIZE = 20

type SearchProfessionalsRow = {
  id: string
  user_id: string | null
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  user_location: string | null
  title: string | null
  company_id: string | null
  company_id_full: string | null
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
  primary_service_name_nl: string | null
  services_offered: string[] | null
  hourly_rate_display: string | null
  is_verified: boolean | null
  cover_photo_url: string | null
  specialty_ids: string[] | null
  specialty_parent_ids: string[] | null
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
  const companyId = row.company_id || row.company_id_full
  if (!companyId && !row.company_name) {
    return null
  }

  const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ").trim()
  const name = row.company_name || fullName || "Professional"

  // Use primary service from company's primary_service_id (company-level data only)
  const profession = (locale === "nl" && row.primary_service_name_nl) ? row.primary_service_name_nl : (row.primary_service_name || "Professional services")

  // Use company location (city, country)
  const locationParts = [row.company_city, row.company_country].filter((value): value is string => Boolean(value))
  const location = locationParts.length > 0 ? locationParts.join(", ") : "Location unavailable"

  const specialties = Array.isArray(row.services_offered)
    ? row.services_offered.filter((value): value is string => Boolean(value))
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

export function useProfessionalsQuery(initialProfessionals: ProfessionalCard[] = []): UseProfessionalsQueryResult {
  const locale = useLocale()
  const {
    selectedCategories,
    selectedServices,
    selectedCities,
    keyword,
    taxonomy,
  } = useProfessionalFilters()

  const [professionals, setProfessionals] = useState<ProfessionalCard[]>(initialProfessionals)
  const [allProfessionals, setAllProfessionals] = useState<ProfessionalCard[]>(initialProfessionals)
  const [hasMore, setHasMore] = useState(initialProfessionals.length === PAGE_SIZE)
  const [currentOffset, setCurrentOffset] = useState(initialProfessionals.length)
  const [total, setTotal] = useState(initialProfessionals.length)
  const [isLoading, setIsLoading] = useState(false) // Start with SSR data
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const hasInitialDataRef = useRef(initialProfessionals.length > 0)

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

        const dataPromise = supabase.rpc(
          "search_professionals",
          { ...filterParams, limit_count: PAGE_SIZE, offset_count: offset },
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
        setHasMore(mapped.length === PAGE_SIZE)
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
    [keyword, selectedCategories, selectedCities, selectedServices],
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

    // If we have initial SSR data and no filters, don't fetch
    if (hasInitialDataRef.current && !hasFilters) {
      hasInitialDataRef.current = false
      return
    }

    // Clear the flag for subsequent filter changes
    hasInitialDataRef.current = false

    // Don't clear professionals — keep old data visible until new results arrive
    setHasMore(true)
    setCurrentOffset(0)
    void fetchPage(0, true)
  }, [fetchPage, taxonomy.isLoading, selectedCategories.length, selectedServices.length, selectedCities, keyword])

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
