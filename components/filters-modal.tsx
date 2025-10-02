"use client"
import { useMemo, useState } from "react"
import { X, ChevronDown, ChevronUp } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useFilters } from "@/contexts/filter-context"

interface FiltersModalProps {
  isOpen: boolean
  onClose: () => void
}

const DEFAULT_YEAR_MIN = 1800
const DEFAULT_YEAR_MAX = new Date().getFullYear()

export function FiltersModal({ isOpen, onClose }: FiltersModalProps) {
  const {
    selectedTypes,
    selectedStyles,
    selectedLocationFeatures,
    selectedBuildingFeatures,
    selectedMaterialFeatures,
    selectedBuildingTypes,
    selectedSizes,
    selectedBudgets,
    projectYearRange,
    buildingYearRange,
    setSelectedTypes,
    setSelectedStyles,
    setSelectedLocationFeatures,
    setSelectedBuildingFeatures,
    setSelectedMaterialFeatures,
    setSelectedBuildingTypes,
    setSelectedSizes,
    setSelectedBudgets,
    setProjectYearRange,
    setBuildingYearRange,
    clearAllFilters: clearContextFilters,
    taxonomy,
  } = useFilters()

  const {
    categories,
    taxonomyOptions,
    isLoading: taxonomyLoading,
    error: taxonomyError,
  } = taxonomy

  const [expandedProjectTypes, setExpandedProjectTypes] = useState<string[]>([])
  const [showAllStyles, setShowAllStyles] = useState(false)
  const [showAllLocationFeatures, setShowAllLocationFeatures] = useState(false)
  const [showAllBuildingFeatures, setShowAllBuildingFeatures] = useState(false)
  const [showAllMaterialFeatures, setShowAllMaterialFeatures] = useState(false)

  const toggleSelection = (item: string, selectedItems: string[], setSelectedItems: (items: string[]) => void) => {
    setSelectedItems(selectedItems.includes(item) ? selectedItems.filter((value) => value !== item) : [...selectedItems, item])
  }

  const topLevelCategories = useMemo(
    () => categories.filter((category) => category.parent_id === null),
    [categories],
  )

  const childCategoriesByParent = useMemo(() => {
    const map = new Map<string, typeof categories>()
    categories.forEach((category) => {
      if (!category.parent_id) return
      const siblings = map.get(category.parent_id) ?? []
      siblings.push(category)
      map.set(category.parent_id, siblings)
    })
    return map
  }, [categories])

  const buildingFeatureCategories = useMemo(
    () => categories.filter((category) => category.project_category_attributes?.is_building_feature),
    [categories],
  )

  const typeSections = useMemo(() => {
    return topLevelCategories
      .map((category) => {
        const children = childCategoriesByParent.get(category.id) ?? []

        const listableChildren = children
          .filter((item) => item.project_category_attributes?.is_listable)
          .sort((a, b) => {
            const orderA = a.sort_order ?? Number.MAX_SAFE_INTEGER
            const orderB = b.sort_order ?? Number.MAX_SAFE_INTEGER
            if (orderA !== orderB) return orderA - orderB
            return a.name.localeCompare(b.name)
          })

        const itemsSource = [
          ...(category.project_category_attributes?.is_listable ? [category] : []),
          ...listableChildren,
        ]

        if (itemsSource.length === 0) {
          return null
        }

        return {
          id: category.id ?? category.slug ?? category.name,
          name: category.name,
          items: itemsSource.map((item, index) => ({
            id: item.id ?? item.slug ?? `${item.name}-${index}`,
            name: item.name,
          })),
        }
      })
      .filter((section): section is { id: string; name: string; items: { id: string; name: string }[] } => section !== null)
  }, [childCategoriesByParent, topLevelCategories])

  const styleOptions = taxonomyOptions.project_style ?? []
  const locationFeatureOptions = taxonomyOptions.location_feature ?? []
  const materialFeatureOptions = taxonomyOptions.material_feature ?? []
  const buildingTypeOptions = taxonomyOptions.building_type ?? []
  const sizeOptions = taxonomyOptions.size_range ?? []
  const budgetOptions = taxonomyOptions.budget_tier ?? []

  const toggleCategorySelection = (sectionId: string) => {
    const section = typeSections.find((item) => item.id === sectionId)
    if (!section) return
    const candidateIds = section.items.map((item) => item.id)
    const allSelected = candidateIds.every((id) => selectedTypes.includes(id))

    if (allSelected) {
      setSelectedTypes(selectedTypes.filter((type) => !candidateIds.includes(type)))
    } else {
      const nextTypes = new Set(selectedTypes)
      candidateIds.forEach((id) => nextTypes.add(id))
      setSelectedTypes(Array.from(nextTypes))
    }
  }

  const isCategorySelected = (sectionId: string) => {
    const section = typeSections.find((item) => item.id === sectionId)
    if (!section || section.items.length === 0) return false
    return section.items.every((item) => selectedTypes.includes(item.id))
  }

  const isCategoryPartiallySelected = (sectionId: string) => {
    const section = typeSections.find((item) => item.id === sectionId)
    if (!section) return false
    return section.items.some((item) => selectedTypes.includes(item.id)) && !isCategorySelected(sectionId)
  }

  const toggleProjectTypeExpansion = (id: string) => {
    setExpandedProjectTypes((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]))
  }

  const clearAllFilters = () => {
    clearContextFilters()
  }

  const applyFilters = () => {
    onClose()
  }

  const isTaxonomyLoading =
    taxonomyLoading &&
    topLevelCategories.length === 0 &&
    styleOptions.length === 0 &&
    locationFeatureOptions.length === 0

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
      <div className="relative h-[90vh] w-full max-w-md bg-white rounded-lg shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Filters</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {isTaxonomyLoading ? (
            <div className="text-sm text-gray-500">Loading filter options…</div>
          ) : taxonomyError && typeSections.length === 0 ? (
            <div className="text-sm text-red-600">We couldn’t load filter options. Please try again later.</div>
          ) : (
            <>
              <div>
                <h3 className="text-base font-medium mb-3">Building Types</h3>
                <div className="space-y-4">
                  {typeSections.map((section) => (
                    <div key={section.id}>
                      <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded"
                            checked={isCategorySelected(section.id)}
                            ref={(el) => {
                              if (el) el.indeterminate = isCategoryPartiallySelected(section.id)
                            }}
                            onChange={() => toggleCategorySelection(section.id)}
                          />
                          <h4 className="text-sm font-medium text-gray-700">{section.name}</h4>
                        </label>
                        <button
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                          onClick={() => toggleProjectTypeExpansion(section.id)}
                        >
                          {expandedProjectTypes.includes(section.id) ? "Show less" : "View all"}
                          {expandedProjectTypes.includes(section.id) ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                      <div className="space-y-2 ml-6">
                        {section.items
                          .slice(0, expandedProjectTypes.includes(section.id) ? undefined : 3)
                          .map((item) => (
                            <label key={item.id} className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded"
                                checked={selectedTypes.includes(item.id)}
                                onChange={() => toggleSelection(item.id, selectedTypes, setSelectedTypes)}
                              />
                              <span className="text-sm">{item.name}</span>
                            </label>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-medium">Style</h3>
                  <button
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                    onClick={() => setShowAllStyles(!showAllStyles)}
                  >
                    {showAllStyles ? "Show less" : "View all"}
                    {showAllStyles ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                </div>
                <div className="space-y-3">
                  {styleOptions.slice(0, showAllStyles ? undefined : 6).map((style, index) => {
                    const value = style.id ?? style.slug ?? `${style.name}-${index}`
                    return (
                      <label key={value} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded"
                          checked={selectedStyles.includes(value)}
                          onChange={() => toggleSelection(value, selectedStyles, setSelectedStyles)}
                        />
                        <span className="text-sm">{style.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-base font-medium mb-3">Location feature</h3>
                <div className="grid grid-cols-2 gap-3">
                  {locationFeatureOptions.slice(0, showAllLocationFeatures ? undefined : 6).map((feature, index) => {
                    const value = feature.id ?? feature.slug ?? feature.name
                    return (
                      <label key={`location-${index}`} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded"
                          checked={selectedLocationFeatures.includes(value)}
                          onChange={() => toggleSelection(value, selectedLocationFeatures, setSelectedLocationFeatures)}
                        />
                        <span className="text-sm">{feature.name}</span>
                      </label>
                    )
                  })}
                </div>
                <button
                  className="text-sm text-gray-600 hover:text-gray-800 mt-2 underline"
                  onClick={() => setShowAllLocationFeatures(!showAllLocationFeatures)}
                >
                  {showAllLocationFeatures ? "Show less" : "Show all"}
                </button>
              </div>

              <div>
                <h3 className="text-base font-medium mb-3">Building feature</h3>
                <div className="grid grid-cols-2 gap-3">
                  {buildingFeatureCategories.slice(0, showAllBuildingFeatures ? undefined : 6).map((feature, index) => {
                    const value = feature.id ?? feature.slug ?? feature.name
                    return (
                      <label key={`building-${index}`} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded"
                          checked={selectedBuildingFeatures.includes(value)}
                          onChange={() => toggleSelection(value, selectedBuildingFeatures, setSelectedBuildingFeatures)}
                        />
                        <span className="text-sm">{feature.name}</span>
                      </label>
                    )
                  })}
                </div>
                <button
                  className="text-sm text-gray-600 hover:text-gray-800 mt-2 underline"
                  onClick={() => setShowAllBuildingFeatures(!showAllBuildingFeatures)}
                >
                  {showAllBuildingFeatures ? "Show less" : "Show all"}
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-medium">Material feature</h3>
                  <button
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                    onClick={() => setShowAllMaterialFeatures(!showAllMaterialFeatures)}
                  >
                    {showAllMaterialFeatures ? "Show less" : "View all"}
                    {showAllMaterialFeatures ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                </div>
                <div className="space-y-3">
                  {materialFeatureOptions.slice(0, showAllMaterialFeatures ? undefined : 6).map((material, index) => {
                    const value = material.id ?? material.slug ?? material.name
                    return (
                      <label key={`material-${index}`} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded"
                          checked={selectedMaterialFeatures.includes(value)}
                          onChange={() => toggleSelection(value, selectedMaterialFeatures, setSelectedMaterialFeatures)}
                        />
                        <span className="text-sm">{material.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-base font-medium mb-3">Building type</h3>
                <div className="grid grid-cols-2 gap-3">
                  {buildingTypeOptions.map((option, index) => {
                    const value = option.id ?? option.slug ?? option.name
                    return (
                      <label key={`building-type-${index}`} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded"
                          checked={selectedBuildingTypes.includes(value)}
                          onChange={() => toggleSelection(value, selectedBuildingTypes, setSelectedBuildingTypes)}
                        />
                        <span className="text-sm">{option.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-base font-medium mb-3">Size</h3>
                <div className="grid grid-cols-2 gap-3">
                  {sizeOptions.map((size, index) => {
                    const value = size.id ?? size.slug ?? size.name
                    return (
                      <label key={`size-${index}`} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded"
                          checked={selectedSizes.includes(value)}
                          onChange={() => toggleSelection(value, selectedSizes, setSelectedSizes)}
                        />
                        <span className="text-sm">{size.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-base font-medium mb-3">Budget</h3>
                <div className="grid grid-cols-2 gap-3">
                  {budgetOptions.map((budget, index) => {
                    const value = budget.budget_level ?? budget.id ?? budget.slug ?? budget.name
                    return (
                      <label key={`budget-${index}`} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded"
                          checked={selectedBudgets.includes(value as string)}
                          onChange={() => toggleSelection(value as string, selectedBudgets, setSelectedBudgets)}
                        />
                        <span className="text-sm">{budget.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-base font-medium mb-3">Project year</h3>
                <div className="px-2">
                  <input
                    type="range"
                    min={DEFAULT_YEAR_MIN}
                    max={DEFAULT_YEAR_MAX}
                    value={projectYearRange[1] ?? DEFAULT_YEAR_MAX}
                    onChange={(e) => setProjectYearRange([projectYearRange[0], Number.parseInt(e.target.value, 10)])}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-sm text-gray-600 mt-1">
                    <span>{DEFAULT_YEAR_MIN}</span>
                    <span>{projectYearRange[1] ?? DEFAULT_YEAR_MAX}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-base font-medium mb-3">Building year</h3>
                <div className="px-2">
                  <input
                    type="range"
                    min={DEFAULT_YEAR_MIN}
                    max={DEFAULT_YEAR_MAX}
                    value={buildingYearRange[1] ?? DEFAULT_YEAR_MAX}
                    onChange={(e) => setBuildingYearRange([buildingYearRange[0], Number.parseInt(e.target.value, 10)])}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-sm text-gray-600 mt-1">
                    <span>{DEFAULT_YEAR_MIN}</span>
                    <span>{buildingYearRange[1] ?? DEFAULT_YEAR_MAX}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="border-t border-gray-200 p-4 flex gap-3">
          <Button variant="outline" onClick={clearAllFilters} className="flex-1 bg-transparent">
            Clear filters
          </Button>
          <Button onClick={applyFilters} className="flex-1 bg-black text-white hover:bg-gray-800">
            Show projects
          </Button>
        </div>
      </div>
    </div>
  )
}
