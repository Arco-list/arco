"use client"
import { useCallback, useEffect, useState } from "react"

import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import type { Tables } from "@/lib/supabase/types"

const CACHE_TTL_MS = 5 * 60 * 1000

let taxonomyCache: {
  categories: CategoryRow[]
  taxonomyOptions: TaxonomyMap
  fetchedAt: number
} | null = null

let inFlightPromise: Promise<void> | null = null

const TAXONOMY_TYPES: Tables<"project_taxonomy_options">["taxonomy_type"][] = [
  "project_style",
  "building_type",
  "size_range",
  "budget_tier",
  "location_feature",
  "material_feature",
]

type CategoryRow = Tables<"categories"> & {
  project_category_attributes?: Pick<Tables<"project_category_attributes">, "is_listable" | "is_building_feature"> | null
}

type TaxonomyOptionRow = Tables<"project_taxonomy_options">

type TaxonomyMap = Partial<Record<TaxonomyOptionRow["taxonomy_type"], TaxonomyOptionRow[]>>

interface ProjectTaxonomyState {
  categories: CategoryRow[]
  taxonomyOptions: TaxonomyMap
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useProjectTaxonomy(): ProjectTaxonomyState {
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [taxonomyOptions, setTaxonomyOptions] = useState<TaxonomyMap>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const applyCache = (cache: typeof taxonomyCache) => {
    if (!cache) return
    setCategories(cache.categories)
    setTaxonomyOptions(cache.taxonomyOptions)
  }

  const loadTaxonomy = useCallback(async (options: { force?: boolean } = {}) => {
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
        const [categoriesResult, taxonomyResult] = await Promise.all([
          supabase
            .from("categories")
            .select(
              "id,name,slug,parent_id,sort_order,project_category_attributes(is_listable,is_building_feature)",
            )
            .eq("is_active", true)
            .order("sort_order", { ascending: true, nullsFirst: false })
            .order("name", { ascending: true }),
          supabase
            .from("project_taxonomy_options")
            .select(
              "id,name,slug,taxonomy_type,sort_order,icon,budget_level,size_min_sqm,size_max_sqm,is_active",
            )
            .eq("is_active", true)
            .in("taxonomy_type", TAXONOMY_TYPES)
            .order("taxonomy_type", { ascending: true })
            .order("sort_order", { ascending: true, nullsFirst: false })
            .order("name", { ascending: true }),
        ])

        if (categoriesResult.error) {
          throw categoriesResult.error
        }
        if (taxonomyResult.error) {
          throw taxonomyResult.error
        }

        const nextCategories = (categoriesResult.data as CategoryRow[]) ?? []

        const grouped: TaxonomyMap = {}
        for (const option of (taxonomyResult.data as TaxonomyOptionRow[]) ?? []) {
          if (!grouped[option.taxonomy_type]) {
            grouped[option.taxonomy_type] = []
          }
          grouped[option.taxonomy_type]!.push(option)
        }

        taxonomyCache = {
          categories: nextCategories,
          taxonomyOptions: grouped,
          fetchedAt: Date.now(),
        }

        applyCache(taxonomyCache)
      }

      const promise = run()
      inFlightPromise = promise
      await promise
      inFlightPromise = null
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load taxonomy data"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTaxonomy()
  }, [loadTaxonomy])

  return {
    categories,
    taxonomyOptions,
    isLoading,
    error,
    refresh: async () => {
      taxonomyCache = null
      await loadTaxonomy({ force: true })
    },
  }
}
