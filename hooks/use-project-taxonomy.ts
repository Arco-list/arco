"use client"
import { useCallback, useEffect, useState } from "react"

import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import type { Tables } from "@/lib/supabase/types"

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

  const loadTaxonomy = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const supabase = getBrowserSupabaseClient()

      const [categoriesResult, taxonomyResult] = await Promise.all([
        supabase
          .from("categories")
          .select("id,name,slug,parent_id,sort_order,project_category_attributes(is_listable,is_building_feature)")
          .eq("is_active", true)
          .order("sort_order", { ascending: true, nullsFirst: false })
          .order("name", { ascending: true }),
        supabase
          .from("project_taxonomy_options")
          .select("id,name,slug,taxonomy_type,sort_order,icon,budget_level,size_min_sqm,size_max_sqm,is_active")
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

      setCategories((categoriesResult.data as CategoryRow[]) ?? [])

      const grouped: TaxonomyMap = {}
      for (const option of (taxonomyResult.data as TaxonomyOptionRow[]) ?? []) {
        if (!grouped[option.taxonomy_type]) {
          grouped[option.taxonomy_type] = []
        }
        grouped[option.taxonomy_type]!.push(option)
      }

      setTaxonomyOptions(grouped)
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
      await loadTaxonomy()
    },
  }
}
