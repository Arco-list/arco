"use client"
import { useCallback, useEffect, useMemo, useState } from "react"

import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import type { Tables } from "@/lib/supabase/types"

import { useFilters } from "@/contexts/filter-context"

const buildTypeTokenSet = (categories: Tables<"categories">[]): Set<string> => {
  const tokens = new Set<string>()

  const register = (value?: string | null) => {
    if (!value) return
    tokens.add(value)
    tokens.add(value.toLowerCase())
  }

  categories.forEach((category) => {
    register(category.id)
    register(category.slug)
    register(category.name)
  })

  return tokens
}

const escapeIlikePattern = (value: string) =>
  value
    .normalize("NFC")
    .replace(/\\/g, "\\\\")
    .replace(/[%_]/g, "\\$&")
    .replace(/'/g, "''")

interface UseProjectsQueryOptions {
  pageSize?: number
}

const DEFAULT_PAGE_SIZE = 12
const MAX_PAGE_SIZE = 100

interface PaginatedProjects {
  data: Tables<"mv_project_summary">[]
  total: number
}

interface UseProjectsQueryResult {
  projects: Tables<"mv_project_summary">[]
  total: number
  isLoading: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => Promise<void>
  refetch: () => Promise<void>
}

export function useProjectsQuery({ pageSize = DEFAULT_PAGE_SIZE }: UseProjectsQueryOptions = {}): UseProjectsQueryResult {
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
    taxonomy,
  } = useFilters()

  const [projects, setProjects] = useState<Tables<"mv_project_summary">[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  const validTypeTokens = useMemo(() => buildTypeTokenSet(taxonomy.categories), [taxonomy.categories])

  const normalizedTypes = useMemo(() => {
    if (taxonomy.categories.length === 0 || validTypeTokens.size === 0) {
      return selectedTypes
    }
    return selectedTypes.filter((type) => {
      if (!type) return false
      return validTypeTokens.has(type) || validTypeTokens.has(type.toLowerCase())
    })
  }, [selectedTypes, taxonomy.categories, validTypeTokens])

  const filters = useMemo(
    () => ({
      types: normalizedTypes,
      styles: selectedStyles,
      location: selectedLocation,
      features: selectedFeatures,
      buildingTypes: selectedBuildingTypes,
      locationFeatures: selectedLocationFeatures,
      buildingFeatures: selectedBuildingFeatures,
      materialFeatures: selectedMaterialFeatures,
      sizes: selectedSizes,
      budgets: selectedBudgets,
      projectYearRange,
      buildingYearRange,
    }),
    [
      normalizedTypes,
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
    ],
  )

  const effectivePageSize = useMemo(() => Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE), [pageSize])

  const fetchProjects = useCallback(
    async (pageIndex: number): Promise<PaginatedProjects> => {
      const supabase = getBrowserSupabaseClient()
      const from = pageIndex * effectivePageSize
      const to = from + effectivePageSize - 1

      let query = supabase
        .from("mv_project_summary")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false, nullsFirst: false })
        .range(from, to)

      if (filters.types.length > 0) {
        query = query.in("project_type", filters.types)
      }

      if (filters.styles.length > 0) {
        query = query.contains("style_preferences", filters.styles)
      }

      if (filters.location) {
        query = query.ilike("location", `%${escapeIlikePattern(filters.location)}%`)
      }

      if (filters.features.length > 0) {
        query = query.contains("features", filters.features)
      }

      if (filters.buildingTypes.length > 0) {
        query = query.in("building_type", filters.buildingTypes)
      }

      if (filters.sizes.length > 0) {
        query = query.in("project_size", filters.sizes)
      }

      if (filters.budgets.length > 0) {
        query = query.in("budget_level", filters.budgets)
      }

      if (filters.projectYearRange[0] !== null) {
        query = query.gte("project_year", filters.projectYearRange[0] as number)
      }
      if (filters.projectYearRange[1] !== null) {
        query = query.lte("project_year", filters.projectYearRange[1] as number)
      }
      if (filters.buildingYearRange[0] !== null) {
        query = query.gte("building_year", filters.buildingYearRange[0] as number)
      }
      if (filters.buildingYearRange[1] !== null) {
        query = query.lte("building_year", filters.buildingYearRange[1] as number)
      }

      const { data, error: supabaseError, count } = await query
      if (supabaseError) {
        throw supabaseError
      }

      return {
        data: data ?? [],
        total: count ?? 0,
      }
    },
    [effectivePageSize, filters],
  )

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      setError(null)
      setProjects([])
      setPage(0)

      try {
        const result = await fetchProjects(0)
        if (cancelled) return

        setProjects(result.data)
        setTotal(result.total)
        setHasMore(result.total > result.data.length)
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : "Failed to load projects"
        setError(message)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [fetchProjects])

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return

    setIsLoading(true)
    setError(null)

    try {
      const nextPage = page + 1
      const result = await fetchProjects(nextPage)
      setProjects((prev) => [...prev, ...result.data])
      setPage(nextPage)
      setTotal(result.total)
      setHasMore((nextPage + 1) * effectivePageSize < result.total)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load more projects"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [effectivePageSize, fetchProjects, hasMore, isLoading, page])

  const refetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await fetchProjects(0)
      setProjects(result.data)
      setTotal(result.total)
      setPage(0)
      setHasMore(result.total > result.data.length)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to refresh projects"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [fetchProjects])

  return {
    projects,
    total,
    isLoading,
    error,
    hasMore,
    loadMore,
    refetch,
  }
}
