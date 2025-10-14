"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import type { ProfessionalCard } from "@/lib/professionals/types"
import { useProfessionalFilters } from "@/contexts/professional-filter-context"

const PLACEHOLDER_IMAGE = "/placeholder.svg?height=300&width=300"

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
  company_logo: string | null
  company_domain: string | null
  company_city: string | null
  company_state_region: string | null
  company_country: string | null
  primary_specialty: string | null
  services_offered: string[] | null
  display_rating: number | null
  total_reviews: number | null
  hourly_rate_display: string | null
  is_verified: boolean | null
}

interface UseProfessionalsQueryResult {
  professionals: ProfessionalCard[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const mapRowToCard = (row: SearchProfessionalsRow): ProfessionalCard | null => {
  if (!row.id || !row.company_id) {
    return null
  }

  const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ").trim()
  const name = row.company_name || fullName || "Professional"

  const profession = row.title || row.primary_specialty || "Professional"

  const locationParts = [row.company_city, row.company_country].filter((value): value is string => Boolean(value))
  const location = locationParts.length > 0 ? locationParts.join(", ") : row.user_location || "Location unavailable"

  const specialties = Array.isArray(row.services_offered)
    ? row.services_offered.filter((value): value is string => Boolean(value))
    : []

  const rating = typeof row.display_rating === "number" && !Number.isNaN(row.display_rating) ? Number(row.display_rating) : 0
  const reviewCount = typeof row.total_reviews === "number" && !Number.isNaN(row.total_reviews) ? row.total_reviews : 0

  return {
    id: row.id,
    slug: row.id,
    companyId: row.company_id,
    name,
    profession,
    location,
    rating,
    reviewCount,
    image: row.company_logo || PLACEHOLDER_IMAGE,
    specialties,
    isVerified: Boolean(row.is_verified),
    domain: row.company_domain ?? null,
  }
}

export function useProfessionalsQuery(initialProfessionals: ProfessionalCard[] = []): UseProfessionalsQueryResult {
  const {
    selectedCategories,
    selectedServices,
    selectedCountry,
    selectedState,
    selectedCity,
    keyword,
  } = useProfessionalFilters()

  const [professionals, setProfessionals] = useState<ProfessionalCard[]>(initialProfessionals)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtersKey = useMemo(
    () =>
      JSON.stringify({
        selectedCategories: [...selectedCategories].sort(),
        selectedServices: [...selectedServices].sort(),
        selectedCountry,
        selectedState,
        selectedCity,
        keyword: keyword.trim(),
      }),
    [keyword, selectedCategories, selectedCity, selectedCountry, selectedServices, selectedState],
  )

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const supabase = getBrowserSupabaseClient()

      const { data, error: rpcError } = await supabase.rpc("search_professionals", {
        search_query: keyword.trim().length > 0 ? keyword.trim() : null,
        country_filter: selectedCountry ?? null,
        state_filter: selectedState ?? null,
        city_filter: selectedCity ?? null,
        category_filters: selectedCategories.length > 0 ? selectedCategories : null,
        service_filters: selectedServices.length > 0 ? selectedServices : null,
        limit_count: 100,
        offset_count: 0,
      })

      if (rpcError) {
        throw rpcError
      }

      const rows = Array.isArray(data) ? (data as SearchProfessionalsRow[]) : []

      const mapped = rows
        .map((row) => mapRowToCard(row))
        .filter((card): card is ProfessionalCard => card !== null)

      setProfessionals(mapped)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load professionals"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [keyword, selectedCategories, selectedCity, selectedCountry, selectedServices, selectedState])

  const skipInitialFetchRef = useRef(initialProfessionals.length > 0)

  useEffect(() => {
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false
      return
    }
    void fetchData()
  }, [fetchData, filtersKey])

  return {
    professionals,
    isLoading,
    error,
    refetch: fetchData,
  }
}
