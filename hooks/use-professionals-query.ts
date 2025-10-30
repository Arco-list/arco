"use client"

import { useCallback, useEffect, useRef, useState } from "react"

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
  company_name: string | null
  company_slug: string | null
  company_logo: string | null
  company_domain: string | null
  company_city: string | null
  company_state_region: string | null
  company_country: string | null
  primary_specialty: string | null
  primary_service_name: string | null
  services_offered: string[] | null
  display_rating: number | string | null
  total_reviews: number | null
  hourly_rate_display: string | null
  is_verified: boolean | null
  cover_photo_url: string | null
}

interface UseProfessionalsQueryResult {
  professionals: ProfessionalCard[]
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => Promise<void>
  refetch: () => Promise<void>
}

const parseRating = (value: number | string | null | undefined) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Number(value.toFixed(2)) : 0
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0
  }

  return 0
}

const mapRowToCard = (row: SearchProfessionalsRow): ProfessionalCard | null => {
  if (!row.id || !row.company_id) {
    return null
  }

  const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ").trim()
  const name = row.company_name || fullName || "Professional"

  // Use primary service from company's primary_service_id (company-level data only)
  const profession = row.primary_service_name || "Professional services"

  // Use company location (city, country)
  const locationParts = [row.company_city, row.company_country].filter((value): value is string => Boolean(value))
  const location = locationParts.length > 0 ? locationParts.join(", ") : "Location unavailable"

  const specialties = Array.isArray(row.services_offered)
    ? row.services_offered.filter((value): value is string => Boolean(value))
    : []

  const rating = parseRating(row.display_rating)
  const reviewCount = typeof row.total_reviews === "number" && Number.isFinite(row.total_reviews) ? row.total_reviews : 0

  return {
    id: row.company_id,
    slug: row.company_slug || row.company_id,
    companyId: row.company_id,
    professionalId: row.id,
    name,
    profession,
    location,
    rating,
    reviewCount,
    image: row.cover_photo_url || row.company_logo || row.avatar_url || PLACEHOLDER_IMAGE,
    specialties,
    isVerified: Boolean(row.is_verified),
    domain: row.company_domain ?? null,
  }
}

export function useProfessionalsQuery(initialProfessionals: ProfessionalCard[] = []): UseProfessionalsQueryResult {
  const {
    selectedCategories,
    selectedServices,
    selectedCity,
    keyword,
  } = useProfessionalFilters()

  const [professionals, setProfessionals] = useState<ProfessionalCard[]>(initialProfessionals)
  const [hasMore, setHasMore] = useState(initialProfessionals.length === PAGE_SIZE)
  const [currentOffset, setCurrentOffset] = useState(initialProfessionals.length)
  const [isLoading, setIsLoading] = useState(initialProfessionals.length === 0)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const skipInitialFetchRef = useRef(initialProfessionals.length > 0)

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

        const { data, error: rpcError } = await supabase.rpc(
          "search_professionals",
          {
            search_query: keyword.trim().length > 0 ? keyword.trim() : null,
            country_filter: null,
            state_filter: null,
            city_filter: selectedCity ?? null,
            category_filters: selectedCategories.length > 0 ? selectedCategories : null,
            service_filters: selectedServices.length > 0 ? selectedServices : null,
            min_rating: null,
            max_hourly_rate: null,
            verified_only: false,
            limit_count: PAGE_SIZE,
            offset_count: offset,
          },
          { signal: controller.signal },
        )

        if (rpcError) {
          throw rpcError
        }

        const rows = Array.isArray(data) ? (data as SearchProfessionalsRow[]) : []
        const mapped = rows
          .map((row) => mapRowToCard(row))
          .filter((card): card is ProfessionalCard => card !== null)

        setProfessionals((prev) => (replace ? mapped : [...prev, ...mapped]))
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
    [keyword, selectedCategories, selectedCity, selectedServices],
  )

  useEffect(() => {
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false
      return
    }

    setProfessionals([])
    setHasMore(true)
    setCurrentOffset(0)
    void fetchPage(0, true)
  }, [fetchPage])

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
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    refetch,
  }
}
