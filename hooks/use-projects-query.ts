"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useLocale } from "next-intl"
import { getProjectTranslation } from "@/lib/project-translations"

import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import type { Enums, Tables } from "@/lib/supabase/types"
import { PROJECT_TYPE_FILTERS, isAllowedProjectSubType, isAllowedProjectType } from "@/lib/project-type-filter-map"

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

const applyTypeFilters = (query: any, selectedTypes: string[], categoriesById: Map<string, any>) => {
  // Resolve category UUIDs to slugs for matching against primary_category_slug
  const slugs = selectedTypes
    .map((id) => categoriesById.get(id)?.slug)
    .filter(Boolean) as string[]
  if (slugs.length === 0) return query
  return query.in("primary_category_slug", slugs)
}

interface UseProjectsQueryOptions {
  pageSize?: number
  initialProjects?: ProjectSummaryRow[]
}

const DEFAULT_PAGE_SIZE = 12
const MAX_PAGE_SIZE = 100
type ProjectBudgetLevel = Enums<"project_budget_level">
const ALLOWED_BUDGET_LEVELS = new Set<ProjectBudgetLevel>([
  "budget",
  "mid_range",
  "premium",
  "luxury",
])

type CategoryRow = Tables<"categories"> & {
  project_category_attributes?: Pick<Tables<"project_category_attributes">, "is_listable"> | null
}

type ProjectSummaryRow = Tables<"project_search_documents">

interface PaginatedProjects {
  data: ProjectSummaryRow[]
  total: number
}

interface UseProjectsQueryResult {
  projects: ProjectSummaryRow[]
  total: number
  isLoading: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => Promise<void>
  refetch: () => Promise<void>
  typePhotoOverrides: Record<string, { url: string; alt?: string | null }>
  spacePhotoOverrides: Record<string, { url: string; alt?: string | null }>
}

export function useProjectsQuery({
  pageSize = DEFAULT_PAGE_SIZE,
  initialProjects = []
}: UseProjectsQueryOptions = {}): UseProjectsQueryResult {
  const {
    selectedTypes,
    selectedStyles,
    selectedLocations,
    selectedSpace,
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
    keyword,
  } = useFilters()

  const locale = useLocale()

  const [projects, setProjects] = useState<ProjectSummaryRow[]>(initialProjects)
  const [total, setTotal] = useState(initialProjects.length)
  const [page, setPage] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(initialProjects.length === DEFAULT_PAGE_SIZE)
  const [typePhotoOverrides, setTypePhotoOverrides] = useState<Record<string, { url: string; alt?: string | null }>>({})
  const [spacePhotoOverrides, setSpacePhotoOverrides] = useState<Record<string, { url: string; alt?: string | null }>>({})

  const hasInitialDataRef = useRef(initialProjects.length > 0)

  const categories = taxonomy.categories as CategoryRow[]

  const validTypeTokens = useMemo(() => buildTypeTokenSet(categories), [categories])

  const categoriesById = useMemo(() => {
    const map = new Map<string, CategoryRow>()
    categories.forEach((category) => {
      if (category.id) {
        map.set(category.id, category)
      }
    })
    return map
  }, [categories])

  const childCategoriesByParent = useMemo(() => {
    const map = new Map<string, CategoryRow[]>()
    categories.forEach((category) => {
      if (!category.parent_id) return
      const list = map.get(category.parent_id) ?? []
      list.push(category)
      map.set(category.parent_id, list)
    })
    map.forEach((list) => {
      list.sort((a, b) => {
        const orderDiff = (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER)
        if (orderDiff !== 0) return orderDiff
        return (a.name ?? "").localeCompare(b.name ?? "")
      })
    })
    return map
  }, [categories])

  const normalizedTypes = useMemo(() => {
    if (categories.length === 0 || validTypeTokens.size === 0) {
      return selectedTypes
    }
    return selectedTypes.filter((type) => {
      if (!type) return false
      return validTypeTokens.has(type) || validTypeTokens.has(type.toLowerCase())
    })
  }, [selectedTypes, categories, validTypeTokens])

  const typeFilterValues = useMemo(() => {
    if (normalizedTypes.length === 0) return []
    const resolved = new Set<string>()

    normalizedTypes.forEach((typeId) => {
      if (!typeId) return
      const category = categoriesById.get(typeId)
      if (!category) return

      if (category.parent_id) {
        resolved.add(category.id)
        return
      }

      const children = childCategoriesByParent.get(category.id) ?? []
      children
        .filter((child) => child.id)
        .forEach((child) => {
          resolved.add(child.id as string)
        })

      resolved.add(category.id)
    })

    return Array.from(resolved)
  }, [categoriesById, childCategoriesByParent, normalizedTypes])

  const filters = useMemo(
    () => ({
      types: typeFilterValues,
      styles: selectedStyles,
      locations: selectedLocations,
      features: selectedFeatures,
      buildingTypes: selectedBuildingTypes,
      locationFeatures: selectedLocationFeatures,
      buildingFeatures: selectedBuildingFeatures,
      materialFeatures: selectedMaterialFeatures,
      sizes: selectedSizes,
      budgets: selectedBudgets.filter((budget): budget is ProjectBudgetLevel =>
        ALLOWED_BUDGET_LEVELS.has(budget as ProjectBudgetLevel),
      ),
      projectYearRange,
      buildingYearRange,
      keyword: keyword.trim(),
    }),
    [
      typeFilterValues,
      selectedStyles,
      selectedLocations,
      selectedFeatures,
      selectedBuildingTypes,
      selectedLocationFeatures,
      selectedBuildingFeatures,
      selectedMaterialFeatures,
      selectedSizes,
      selectedBudgets,
      projectYearRange,
      buildingYearRange,
      keyword,
    ],
  )

  const imageCategorySearchOrder = useMemo(() => {
    const order: string[] = []
    const seen = new Set<string>()

    normalizedTypes.forEach((typeId) => {
      if (!typeId) return
      const category = categoriesById.get(typeId)
      if (!category) return

      if (category.parent_id) {
        if (!seen.has(category.id)) {
          order.push(category.id)
          seen.add(category.id)
        }
        return
      }

      let preferredChild: CategoryRow | undefined

      if (isAllowedProjectType(category.name ?? "")) {
        const allowedNames = PROJECT_TYPE_FILTERS[category.name as keyof typeof PROJECT_TYPE_FILTERS]
        for (const name of allowedNames) {
          if (name === category.name) continue
          const candidates = childCategoriesByParent.get(category.id) ?? []
          const match = candidates.find((child) => child.name === name)
          if (match) {
            preferredChild = match
            break
          }
        }
      }

      if (!preferredChild) {
        const candidates = (childCategoriesByParent.get(category.id) ?? []).filter(
          (child) => child.project_category_attributes?.is_listable,
        )
        preferredChild = candidates[0]
      }

      if (preferredChild && preferredChild.id && !seen.has(preferredChild.id)) {
        order.push(preferredChild.id)
        seen.add(preferredChild.id)
      }

      if (category.id && !seen.has(category.id)) {
        order.push(category.id)
        seen.add(category.id)
      }
    })

    // Add building features to the search order for cover image override
    selectedBuildingFeatures.forEach((featureId) => {
      if (featureId && !seen.has(featureId)) {
        order.push(featureId)
        seen.add(featureId)
      }
    })

    return order
  }, [categoriesById, childCategoriesByParent, normalizedTypes, selectedBuildingFeatures])

  const effectivePageSize = useMemo(() => Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE), [pageSize])

  const fetchProjects = useCallback(
    async (pageIndex: number): Promise<PaginatedProjects> => {
      const supabase = getBrowserSupabaseClient()
      const from = pageIndex * effectivePageSize
      const to = from + effectivePageSize - 1

      let query = supabase
        .from("project_search_documents")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false, nullsFirst: false })
        .range(from, to)

      // Space filter: find project IDs that have photos tagged with the selected space
      if (selectedSpace) {
        const { data: spaceRows } = await supabase
          .from("spaces")
          .select("id")
          .eq("slug", selectedSpace)
          .limit(1)

        const spaceId = spaceRows?.[0]?.id
        if (spaceId) {
          // Only include projects that have photos assigned to features in this space
          const { data: featureRows } = await supabase
            .from("project_features")
            .select("project_id, project_photos!project_photos_feature_id_fkey(id)")
            .eq("space_id", spaceId)

          const projectIds = [...new Set(
            (featureRows ?? [])
              .filter((f) => f.project_id && Array.isArray(f.project_photos) && f.project_photos.length > 0)
              .map((f) => f.project_id as string)
          )]
          if (projectIds.length > 0) {
            query = query.in("id", projectIds)
          } else {
            // No projects have photos in this space — return empty
            return { data: [], total: 0 }
          }
        }
      }

      if (filters.types.length > 0) {
        query = applyTypeFilters(query, filters.types, categoriesById)
      }

      if (filters.styles.length > 0) {
        query = query.contains("style_preferences", filters.styles)
      }

      if (filters.locations.length > 0) {
        const locationOr = filters.locations
          .map((loc) => `location.ilike.%${escapeIlikePattern(loc)}%`)
          .join(",")
        query = query.or(locationOr)
      }

      if (filters.features.length > 0) {
        query = query.contains("features", filters.features)
      }
      if (filters.keyword) {
        query = query.textSearch("search_vector", filters.keyword, { type: "websearch", config: "simple" })
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

      // Fetch preview photos for card carousel (max 5 per project)
      const projectIds = (data ?? []).map((p) => p.id).filter(Boolean) as string[]
      if (projectIds.length > 0) {
        const { data: photos } = await supabase
          .from("project_photos")
          .select("id, project_id, url, alt_text, order_index, is_primary, feature_id")
          .in("project_id", projectIds)
          .order("is_primary", { ascending: false, nullsFirst: false })
          .order("order_index", { ascending: true, nullsFirst: false })

        if (photos) {
          const photosByProject = new Map<string, typeof photos>()
          for (const photo of photos) {
            if (!photo.project_id) continue
            const existing = photosByProject.get(photo.project_id) ?? []
            if (existing.length < 5) existing.push(photo)
            photosByProject.set(photo.project_id, existing)
          }

          for (const project of (data ?? []) as any[]) {
            const projectPhotos = photosByProject.get(project.id) ?? []
            project.photos = projectPhotos.map((p: any) => ({
              id: p.id,
              url: p.url,
              alt: p.alt_text ?? null,
              space: null,
              order_index: p.order_index ?? 0,
              is_primary: p.is_primary ?? false,
            }))
          }
        }
      }

      // Resolve locale-aware title/description from projects.translations.
      // Falls back to the base column when no translation exists.
      const localized = (data ?? []).map((row) => ({
        ...row,
        title: getProjectTranslation(
          { title: row.title, translations: (row as { translations?: Record<string, any> | null }).translations ?? null },
          "title",
          locale,
        ) || row.title,
        description: getProjectTranslation(
          { description: row.description, translations: (row as { translations?: Record<string, any> | null }).translations ?? null },
          "description",
          locale,
        ) || row.description,
      }))

      return {
        data: localized,
        total: count ?? 0,
      }
    },
    [effectivePageSize, filters, selectedSpace, locale],
  )

  const fetchTypePhotoOverrides = useCallback(
    async (projectRows: ProjectSummaryRow[]) => {
      if (imageCategorySearchOrder.length === 0 || projectRows.length === 0) {
        return {}
      }

      const projectIds = projectRows
        .map((project) => project.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)

      if (projectIds.length === 0) {
        return {}
      }

      const supabase = getBrowserSupabaseClient()

      const { data: featureRows, error: featureError } = await supabase
        .from("project_features")
        .select("project_id, category_id, cover_photo_id")
        .in("project_id", Array.from(new Set(projectIds)))
        .in("category_id", Array.from(new Set(imageCategorySearchOrder)))
        .order("order_index", { ascending: true })

      if (featureError) {
        throw featureError
      }

      const validFeatures =
        featureRows?.filter(
          (feature) =>
            feature.project_id &&
            feature.category_id &&
            feature.cover_photo_id &&
            imageCategorySearchOrder.includes(feature.category_id),
        ) ?? []

      if (validFeatures.length === 0) {
        return {}
      }

      const coverPhotoIds = Array.from(
        new Set(
          validFeatures
            .map((feature) => feature.cover_photo_id)
            .filter((id): id is string => typeof id === "string" && id.length > 0),
        ),
      )

      let photoMap = new Map<string, { url: string; alt?: string | null }>()

      if (coverPhotoIds.length > 0) {
        const { data: photos, error: photoError } = await supabase
          .from("project_photos")
          .select("id, url, alt_text")
          .in("id", coverPhotoIds)

        if (photoError) {
          throw photoError
        }

        photoMap = new Map(
          (photos ?? [])
            .filter((photo) => photo.id && photo.url)
            .map((photo) => [photo.id as string, { url: photo.url!, alt: photo.alt_text ?? null }]),
        )
      }

      const featuresByProject = new Map<string, typeof validFeatures>()
      validFeatures.forEach((feature) => {
        const projectId = feature.project_id as string
        const list = featuresByProject.get(projectId) ?? []
        list.push(feature)
        featuresByProject.set(projectId, list)
      })

      const overrides: Record<string, { url: string; alt?: string | null }> = {}

      featuresByProject.forEach((features, projectId) => {
        for (const categoryId of imageCategorySearchOrder) {
          const match = features.find((feature) => feature.category_id === categoryId)
          if (!match) continue
          const coverId = match.cover_photo_id as string | undefined
          if (!coverId) continue
          const photo = photoMap.get(coverId)
          if (photo && photo.url) {
            overrides[projectId] = photo
            break
          }
        }
      })

      return overrides
    },
    [imageCategorySearchOrder],
  )

  const fetchSpacePhotoOverrides = useCallback(
    async (projectRows: ProjectSummaryRow[], spaceSlug: string): Promise<Record<string, { url: string; alt?: string | null }>> => {
      if (!projectRows.length || !spaceSlug) return {}

      const projectIds = projectRows
        .map((p) => p.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)

      if (!projectIds.length) return {}

      const supabase = getBrowserSupabaseClient()

      // Find the space ID for this space slug
      const { data: spaceRows } = await supabase
        .from("spaces")
        .select("id")
        .eq("slug", spaceSlug)
        .limit(1)

      const spaceId = spaceRows?.[0]?.id
      if (!spaceId) return {}

      // Find project features with this space
      const { data: featureRows } = await supabase
        .from("project_features")
        .select("id, project_id, cover_photo_id")
        .in("project_id", projectIds)
        .eq("space_id", spaceId)

      if (!featureRows?.length) return {}

      // 1. Get cover photos for features that have one
      const coverIds = featureRows
        .map((f) => f.cover_photo_id)
        .filter((id): id is string => typeof id === "string")

      let photoMap = new Map<string, { url: string; alt: string | null }>()

      if (coverIds.length > 0) {
        const { data: coverPhotos } = await supabase
          .from("project_photos")
          .select("id, url, alt_text")
          .in("id", coverIds)

        for (const p of coverPhotos ?? []) {
          if (p.id && p.url) photoMap.set(p.id, { url: p.url, alt: p.alt_text ?? null })
        }
      }

      // 2. For features without a cover photo, find any photo assigned to that feature
      const featureIdsWithoutCover = featureRows
        .filter((f) => !f.cover_photo_id)
        .map((f) => f.id)
        .filter(Boolean) as string[]

      let featurePhotoMap = new Map<string, { url: string; alt: string | null }>()

      if (featureIdsWithoutCover.length > 0) {
        const { data: featurePhotos } = await supabase
          .from("project_photos")
          .select("feature_id, url, alt_text")
          .in("feature_id", featureIdsWithoutCover)
          .order("is_primary", { ascending: false })
          .order("order_index", { ascending: true })

        for (const p of featurePhotos ?? []) {
          if (p.feature_id && p.url && !featurePhotoMap.has(p.feature_id)) {
            featurePhotoMap.set(p.feature_id, { url: p.url, alt: p.alt_text ?? null })
          }
        }
      }

      const overrides: Record<string, { url: string; alt?: string | null }> = {}
      featureRows.forEach((f) => {
        if (!f.project_id || overrides[f.project_id]) return
        // Prefer cover photo, fall back to any photo in the feature
        if (f.cover_photo_id && photoMap.has(f.cover_photo_id)) {
          overrides[f.project_id] = photoMap.get(f.cover_photo_id)!
        } else if (f.id && featurePhotoMap.has(f.id)) {
          overrides[f.project_id] = featurePhotoMap.get(f.id)!
        }
      })

      return overrides
    },
    [],
  )

  // Fetch space-specific cover photos whenever the space filter or project list changes
  useEffect(() => {
    if (!selectedSpace || projects.length === 0) {
      setSpacePhotoOverrides({})
      return
    }

    let cancelled = false

    fetchSpacePhotoOverrides(projects, selectedSpace)
      .then((overrides) => {
        if (!cancelled) setSpacePhotoOverrides(overrides)
      })
      .catch((err) => {
        console.error("Failed to load space photos", err)
      })

    return () => {
      cancelled = true
    }
  }, [selectedSpace, projects, fetchSpacePhotoOverrides])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      // Check if we have any active filters
      const hasFilters =
        typeFilterValues.length > 0 ||
        selectedStyles.length > 0 ||
        selectedLocations.length > 0 ||
        selectedFeatures.length > 0 ||
        selectedBuildingTypes.length > 0 ||
        selectedLocationFeatures.length > 0 ||
        selectedBuildingFeatures.length > 0 ||
        selectedMaterialFeatures.length > 0 ||
        selectedSizes.length > 0 ||
        selectedBudgets.length > 0 ||
        projectYearRange[0] !== null ||
        projectYearRange[1] !== null ||
        buildingYearRange[0] !== null ||
        buildingYearRange[1] !== null ||
        keyword.trim().length > 0 ||
        !!selectedSpace

      // If we have initial SSR data and no filters, don't fetch
      if (hasInitialDataRef.current && !hasFilters) {
        hasInitialDataRef.current = false
        return
      }

      // Clear the flag for subsequent filter changes
      hasInitialDataRef.current = false

      setIsLoading(true)
      setError(null)
      setProjects([])
      setTypePhotoOverrides({})
      setPage(0)

      try {
        const result = await fetchProjects(0)
        if (cancelled) return

        let overrides: Record<string, { url: string; alt?: string | null }> = {}
        if (imageCategorySearchOrder.length > 0) {
          try {
            overrides = await fetchTypePhotoOverrides(result.data)
          } catch (overrideError) {
            console.error("Failed to load type-specific photos", overrideError)
          }
        }

        if (cancelled) return

        setProjects(result.data)
        setTypePhotoOverrides(overrides)
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
  }, [
    fetchProjects,
    fetchTypePhotoOverrides,
    imageCategorySearchOrder,
    typeFilterValues.length,
    selectedStyles.length,
    selectedLocations,
    selectedFeatures.length,
    selectedBuildingTypes.length,
    selectedLocationFeatures.length,
    selectedBuildingFeatures.length,
    selectedMaterialFeatures.length,
    selectedSizes.length,
    selectedBudgets.length,
    projectYearRange,
    buildingYearRange,
    keyword,
    selectedSpace
  ])

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return

    setIsLoading(true)
    setError(null)

    try {
      const nextPage = page + 1
      const result = await fetchProjects(nextPage)

      let overrides: Record<string, { url: string; alt?: string | null }> = {}
      if (imageCategorySearchOrder.length > 0) {
        try {
          overrides = await fetchTypePhotoOverrides(result.data)
        } catch (overrideError) {
          console.error("Failed to load type-specific photos for additional results", overrideError)
        }
      }

      setProjects((prev) => [...prev, ...result.data])
      setTypePhotoOverrides((prev) => ({ ...prev, ...overrides }))
      setPage(nextPage)
      setTotal(result.total)
      setHasMore((nextPage + 1) * effectivePageSize < result.total)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load more projects"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [effectivePageSize, fetchProjects, fetchTypePhotoOverrides, hasMore, imageCategorySearchOrder, isLoading, page])

  const refetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await fetchProjects(0)

      let overrides: Record<string, { url: string; alt?: string | null }> = {}
      if (imageCategorySearchOrder.length > 0) {
        try {
          overrides = await fetchTypePhotoOverrides(result.data)
        } catch (overrideError) {
          console.error("Failed to load type-specific photos during refetch", overrideError)
        }
      }

      setProjects(result.data)
      setTypePhotoOverrides(overrides)
      setTotal(result.total)
      setPage(0)
      setHasMore(result.total > result.data.length)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to refresh projects"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [fetchProjects, fetchTypePhotoOverrides, imageCategorySearchOrder])

  return {
    projects,
    total,
    isLoading,
    error,
    hasMore,
    loadMore,
    refetch,
    typePhotoOverrides,
    spacePhotoOverrides,
  }
}
