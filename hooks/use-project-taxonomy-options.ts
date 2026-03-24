"use client"

import { useCallback, useEffect, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"

import {
  FALLBACK_BUDGET_OPTIONS,
  FALLBACK_BUILDING_TYPE_OPTIONS,
  FALLBACK_CATEGORY_OPTIONS,
  FALLBACK_LOCATION_FEATURES,
  FALLBACK_MATERIAL_FEATURES,
  FALLBACK_PROJECT_STYLE_OPTIONS,
  FALLBACK_PROJECT_TYPES,
  FALLBACK_SIZE_OPTIONS,
  type ProjectDetailsDropdownOption,
  type ProjectDetailsFeatureOption,
  sortByOrderThenLabel,
  sortFeatureOptions,
} from "@/lib/project-details"
import type { Tables } from "@/lib/supabase/types"

type CategoryWithAttributes = Tables<"categories">

type ProjectTaxonomyOption = Tables<"project_taxonomy_options">

export type ProjectTaxonomyState = {
  categoryOptions: ProjectDetailsDropdownOption[]
  projectTypeOptionsByCategory: Record<string, ProjectDetailsDropdownOption[]>
  isLoadingTaxonomy: boolean
  taxonomyError: string | null
  projectTaxonomyError: string | null
  projectStyleOptions: ProjectDetailsDropdownOption[]
  buildingTypeOptions: ProjectDetailsDropdownOption[]
  sizeOptions: ProjectDetailsDropdownOption[]
  budgetOptions: ProjectDetailsDropdownOption[]
  locationFeatureOptions: ProjectDetailsFeatureOption[]
  materialFeatureOptions: ProjectDetailsFeatureOption[]
  reload: () => Promise<void>
}

const DEFAULT_TAXONOMY_STATE: ProjectTaxonomyState = {
  categoryOptions: [],
  projectTypeOptionsByCategory: {},
  isLoadingTaxonomy: true,
  taxonomyError: null,
  projectTaxonomyError: null,
  projectStyleOptions: [...FALLBACK_PROJECT_STYLE_OPTIONS],
  buildingTypeOptions: [...FALLBACK_BUILDING_TYPE_OPTIONS],
  sizeOptions: [...FALLBACK_SIZE_OPTIONS],
  budgetOptions: [...FALLBACK_BUDGET_OPTIONS],
  locationFeatureOptions: [...FALLBACK_LOCATION_FEATURES],
  materialFeatureOptions: [...FALLBACK_MATERIAL_FEATURES],
  reload: async () => {},
}

export const useProjectTaxonomyOptions = (supabase: SupabaseClient) => {
  const [taxonomyState, setTaxonomyState] = useState<ProjectTaxonomyState>(DEFAULT_TAXONOMY_STATE)

  const applyFallbackTaxonomy = useCallback(() => {
    const sortedCategories = [...FALLBACK_CATEGORY_OPTIONS].sort(sortByOrderThenLabel)
    const fallbackTypes: Record<string, ProjectDetailsDropdownOption[]> = {}

    Object.entries(FALLBACK_PROJECT_TYPES).forEach(([key, options]) => {
      fallbackTypes[key] = [...options].sort(sortByOrderThenLabel)
    })

    setTaxonomyState((prev) => ({
      ...prev,
      categoryOptions: sortedCategories,
      projectTypeOptionsByCategory: fallbackTypes,
    }))
  }, [])

  const applyFallbackProjectTaxonomy = useCallback(() => {
    setTaxonomyState((prev) => ({
      ...prev,
      projectStyleOptions: [...FALLBACK_PROJECT_STYLE_OPTIONS].sort(sortByOrderThenLabel),
      buildingTypeOptions: [...FALLBACK_BUILDING_TYPE_OPTIONS].sort(sortByOrderThenLabel),
      sizeOptions: [...FALLBACK_SIZE_OPTIONS].sort(sortByOrderThenLabel),
      budgetOptions: [...FALLBACK_BUDGET_OPTIONS].sort(sortByOrderThenLabel),
      locationFeatureOptions: sortFeatureOptions([...FALLBACK_LOCATION_FEATURES]),
      materialFeatureOptions: sortFeatureOptions([...FALLBACK_MATERIAL_FEATURES]),
    }))
  }, [])

  const loadTaxonomy = useCallback(
    async (isMounted: () => boolean) => {
      setTaxonomyState((prev) => ({
        ...prev,
        isLoadingTaxonomy: true,
        taxonomyError: null,
      }))

      const { data, error } = await supabase
        .from("categories")
        .select("id,name,slug,sort_order,parent_id,is_listing_type")
        .eq("is_active", true)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true })

      if (!isMounted()) {
        return
      }

      if (error) {
        applyFallbackTaxonomy()
        setTaxonomyState((prev) => ({
          ...prev,
          isLoadingTaxonomy: false,
          taxonomyError: error.message,
        }))
        return
      }

      const records = (data ?? []) as CategoryWithAttributes[]
      if (records.length === 0) {
        applyFallbackTaxonomy()
        setTaxonomyState((prev) => ({
          ...prev,
          isLoadingTaxonomy: false,
        }))
        return
      }

      // Build project type list from active categories.
      // Parent categories that have children are service categories (Design & Planning, Construction, etc.)
      // Parent categories without children are project types (Villa, Apartment, Penthouse, etc.)
      const allParents = records.filter((r) => !r.parent_id)
      const allChildren = records.filter((r) => r.parent_id)

      // Identify which parents have children (service categories)
      const parentsWithChildren = new Set(allChildren.map((c) => c.parent_id!))

      // Project types = parent categories without children
      const projectTypeParents = allParents.filter((r) => !parentsWithChildren.has(r.id))

      const listingTypes: ProjectDetailsDropdownOption[] = []
      const groupedProjectTypes: Record<string, ProjectDetailsDropdownOption[]> = {}

      for (const parent of projectTypeParents) {
        listingTypes.push({
          value: parent.id,
          label: parent.name,
          sortOrder: parent.sort_order ?? 0,
        })
      }

      if (listingTypes.length === 0) {
        applyFallbackTaxonomy()
        setTaxonomyState((prev) => ({
          ...prev,
          isLoadingTaxonomy: false,
        }))
        return
      }

      listingTypes.sort(sortByOrderThenLabel)

      setTaxonomyState((prev) => ({
        ...prev,
        categoryOptions: listingTypes,
        projectTypeOptionsByCategory: groupedProjectTypes,
        isLoadingTaxonomy: false,
      }))
    },
    [applyFallbackTaxonomy, supabase],
  )

  const loadProjectTaxonomy = useCallback(
    async (isMounted: () => boolean) => {
      const { data, error } = await supabase
        .from("project_taxonomy_options")
        .select("id, taxonomy_type, name, slug, sort_order, icon, budget_level")
        .in("taxonomy_type", [
          "project_style",
          "building_type",
          "size_range",
          "budget_tier",
          "location_feature",
          "material_feature",
        ])
        .eq("is_active", true)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true })

      if (!isMounted()) {
        return
      }

      if (error || !data) {
        applyFallbackProjectTaxonomy()
        setTaxonomyState((prev) => ({
          ...prev,
          projectTaxonomyError: error?.message ?? prev.projectTaxonomyError,
        }))
        return
      }

      const grouped = data.reduce<Record<ProjectTaxonomyOption["taxonomy_type"], ProjectTaxonomyOption[]>>(
        (acc, option) => {
          if (!acc[option.taxonomy_type]) {
            acc[option.taxonomy_type] = []
          }
          acc[option.taxonomy_type].push(option)
          return acc
        },
        {
          project_style: [],
          building_type: [],
          size_range: [],
          budget_tier: [],
          location_feature: [],
          material_feature: [],
        },
      )

      const groupSortedFeatureOptions = (options: ProjectTaxonomyOption[]) => {
        return sortFeatureOptions(
          options.map<ProjectDetailsFeatureOption>((option) => ({
            value: option.id,
            label: option.name,
            iconKey: option.icon,
            sortOrder: option.sort_order,
          })),
        )
      }

      const styles = grouped.project_style
        .map<ProjectDetailsDropdownOption>((option) => ({
          value: option.id,
          label: option.name,
          sortOrder: option.sort_order,
        }))
        .sort(sortByOrderThenLabel)

      const buildingTypes = grouped.building_type
        .map<ProjectDetailsDropdownOption>((option) => ({
          value: option.id,
          label: option.name,
          sortOrder: option.sort_order,
        }))
        .sort(sortByOrderThenLabel)

      const sizes = grouped.size_range
        .map<ProjectDetailsDropdownOption>((option) => ({
          value: option.id,
          label: option.name,
          sortOrder: option.sort_order,
        }))
        .sort(sortByOrderThenLabel)

      const budgets = grouped.budget_tier
        .reduce<ProjectDetailsDropdownOption[]>((acc, option) => {
          const value = option.budget_level ?? option.slug ?? option.id
          if (!value) {
            return acc
          }

          if (acc.some((existing) => existing.value === value)) {
            return acc
          }

          acc.push({
            value,
            label: option.name,
            sortOrder: option.sort_order,
          })
          return acc
        }, [])
        .sort(sortByOrderThenLabel)

      const mappedLocationFeatures = groupSortedFeatureOptions(grouped.location_feature)
      const mappedMaterialFeatures = groupSortedFeatureOptions(grouped.material_feature)

      setTaxonomyState((prev) => ({
        ...prev,
        projectStyleOptions: styles.length ? styles : [...FALLBACK_PROJECT_STYLE_OPTIONS].sort(sortByOrderThenLabel),
        buildingTypeOptions: buildingTypes.length
          ? buildingTypes
          : [...FALLBACK_BUILDING_TYPE_OPTIONS].sort(sortByOrderThenLabel),
        sizeOptions: sizes.length ? sizes : [...FALLBACK_SIZE_OPTIONS].sort(sortByOrderThenLabel),
        budgetOptions: budgets.length ? budgets : [...FALLBACK_BUDGET_OPTIONS].sort(sortByOrderThenLabel),
        locationFeatureOptions: mappedLocationFeatures.length
          ? mappedLocationFeatures
          : sortFeatureOptions([...FALLBACK_LOCATION_FEATURES]),
        materialFeatureOptions: mappedMaterialFeatures.length
          ? mappedMaterialFeatures
          : sortFeatureOptions([...FALLBACK_MATERIAL_FEATURES]),
        projectTaxonomyError: null,
      }))
    },
    [applyFallbackProjectTaxonomy, supabase],
  )

  const loadAll = useCallback(async () => {
    let mounted = true
    const isMounted = () => mounted

    await Promise.all([loadTaxonomy(isMounted), loadProjectTaxonomy(isMounted)])

    return () => {
      mounted = false
    }
  }, [loadProjectTaxonomy, loadTaxonomy])

  useEffect(() => {
    let mounted = true
    const isMounted = () => mounted

    void loadTaxonomy(isMounted)
    void loadProjectTaxonomy(isMounted)

    return () => {
      mounted = false
    }
  }, [loadProjectTaxonomy, loadTaxonomy])

  const reload = useCallback(async () => {
    const cleanup = await loadAll()
    cleanup()
  }, [loadAll])

  return {
    ...taxonomyState,
    reload,
  }
}
