"use client"
import { useState } from "react"
import { X, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { csvData, projectStyles, locationFeatures, buildingTypesByCategory } from "@/lib/csv-data"
import { useFilters } from "@/contexts/filter-context"

interface FiltersModalProps {
  isOpen: boolean
  onClose: () => void
}

export function FiltersModal({ isOpen, onClose }: FiltersModalProps) {
  const {
    selectedTypes,
    selectedStyles,
    selectedFeatures,
    setSelectedTypes,
    setSelectedStyles,
    setSelectedFeatures,
    clearAllFilters: clearContextFilters,
  } = useFilters()

  const [selectedBuildingTypes, setSelectedBuildingTypes] = useState<string[]>([])
  const [selectedLocationFeatures, setSelectedLocationFeatures] = useState<string[]>([])
  const [selectedBuildingFeatures, setSelectedBuildingFeatures] = useState<string[]>([])
  const [selectedMaterialFeatures, setSelectedMaterialFeatures] = useState<string[]>([])
  const [selectedSizes, setSelectedSizes] = useState<string[]>([])
  const [selectedBudgets, setSelectedBudgets] = useState<string[]>([])
  const [projectYear, setProjectYear] = useState([1800, 2025])
  const [buildingYear, setBuildingYear] = useState([1800, 2025])

  const [expandedProjectTypes, setExpandedProjectTypes] = useState<string[]>([])
  const [showAllStyles, setShowAllStyles] = useState(false)
  const [showAllLocationFeatures, setShowAllLocationFeatures] = useState(false)
  const [showAllBuildingFeatures, setShowAllBuildingFeatures] = useState(false)
  const [showAllMaterialFeatures, setShowAllMaterialFeatures] = useState(false)
  const [showAllBuildingTypes, setShowAllBuildingTypes] = useState(false)

  const toggleSelection = (item: string, selectedItems: string[], setSelectedItems: (items: string[]) => void) => {
    setSelectedItems(selectedItems.includes(item) ? selectedItems.filter((i) => i !== item) : [...selectedItems, item])
  }

  const toggleCategorySelection = (category: string) => {
    const categoryTypes = buildingTypesByCategory[category]
    const allSelected = categoryTypes.every((type) => selectedTypes.includes(type))

    if (allSelected) {
      // Deselect all types in this category
      setSelectedTypes(selectedTypes.filter((type) => !categoryTypes.includes(type)))
    } else {
      // Select all types in this category
      const newTypes = [...selectedTypes]
      categoryTypes.forEach((type) => {
        if (!newTypes.includes(type)) {
          newTypes.push(type)
        }
      })
      setSelectedTypes(newTypes)
    }
  }

  const isCategorySelected = (category: string) => {
    const categoryTypes = buildingTypesByCategory[category]
    return categoryTypes.every((type) => selectedTypes.includes(type))
  }

  const isCategoryPartiallySelected = (category: string) => {
    const categoryTypes = buildingTypesByCategory[category]
    return categoryTypes.some((type) => selectedTypes.includes(type)) && !isCategorySelected(category)
  }

  const toggleProjectTypeExpansion = (type: string) => {
    setExpandedProjectTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]))
  }

  const clearAllFilters = () => {
    clearContextFilters()
    setSelectedBuildingTypes([])
    setSelectedLocationFeatures([])
    setSelectedBuildingFeatures([])
    setSelectedMaterialFeatures([])
    setSelectedSizes([])
    setSelectedBudgets([])
    setProjectYear([1800, 2025])
    setBuildingYear([1800, 2025])
  }

  const applyFilters = () => {
    // Combine all feature selections into the features array
    const allFeatures = [
      ...selectedBuildingTypes,
      ...selectedLocationFeatures,
      ...selectedBuildingFeatures,
      ...selectedMaterialFeatures,
      ...selectedSizes,
      ...selectedBudgets,
    ]
    setSelectedFeatures(allFeatures)
    onClose()
  }

  const materialFeatures = csvData.features.filter(
    (feature) =>
      feature.toLowerCase().includes("metal") ||
      feature.toLowerCase().includes("stone") ||
      feature.toLowerCase().includes("wood") ||
      feature.toLowerCase().includes("glass") ||
      feature.toLowerCase().includes("brick") ||
      feature.toLowerCase().includes("concrete") ||
      feature.toLowerCase().includes("steel") ||
      feature.toLowerCase().includes("bamboo") ||
      feature.toLowerCase().includes("stucco"),
  )

  const buildingFeatures = csvData.features.filter(
    (feature) =>
      feature.toLowerCase().includes("heating") ||
      feature.toLowerCase().includes("solar") ||
      feature.toLowerCase().includes("smart") ||
      feature.toLowerCase().includes("insulation") ||
      feature.toLowerCase().includes("glazing") ||
      feature.toLowerCase().includes("ventilation") ||
      feature.toLowerCase().includes("roof"),
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-opacity-20 bg-[rgba(0,0,0,0.5)]">
      <div className="relative h-[90vh] w-full max-w-md bg-white rounded-lg shadow-xl flex flex-col">
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Filters</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Building Types */}
          <div>
            <h3 className="text-base font-medium mb-3">Building Types</h3>
            <div className="space-y-4">
              {Object.entries(buildingTypesByCategory).map(([category, types]) => (
                <div key={category}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded"
                        checked={isCategorySelected(category)}
                        ref={(el) => {
                          if (el) el.indeterminate = isCategoryPartiallySelected(category)
                        }}
                        onChange={() => toggleCategorySelection(category)}
                      />
                      <h4 className="text-sm font-medium text-gray-700">{category}</h4>
                    </label>
                    <button
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                      onClick={() => toggleProjectTypeExpansion(category)}
                    >
                      {expandedProjectTypes.includes(category) ? "Show less" : "View all"}
                      {expandedProjectTypes.includes(category) ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                  <div className="space-y-2 ml-6">
                    {types.slice(0, expandedProjectTypes.includes(category) ? undefined : 3).map((type) => (
                      <label key={type} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded"
                          checked={selectedTypes.includes(type)}
                          onChange={() => toggleSelection(type, selectedTypes, setSelectedTypes)}
                        />
                        <span className="text-sm">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Style */}
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
              {projectStyles.slice(0, showAllStyles ? undefined : 6).map((style) => (
                <label key={style} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded"
                    checked={selectedStyles.includes(style)}
                    onChange={() => toggleSelection(style, selectedStyles, setSelectedStyles)}
                  />
                  <span className="text-sm">{style}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Location feature */}
          <div>
            <h3 className="text-base font-medium mb-3">Location feature</h3>
            <div className="grid grid-cols-2 gap-3">
              {locationFeatures.slice(0, showAllLocationFeatures ? undefined : 6).map((feature) => (
                <label key={feature} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded"
                    checked={selectedLocationFeatures.includes(feature)}
                    onChange={() => toggleSelection(feature, selectedLocationFeatures, setSelectedLocationFeatures)}
                  />
                  <span className="text-sm">{feature}</span>
                </label>
              ))}
            </div>
            <button
              className="text-sm text-gray-600 hover:text-gray-800 mt-2 underline"
              onClick={() => setShowAllLocationFeatures(!showAllLocationFeatures)}
            >
              {showAllLocationFeatures ? "Show less" : "Show all"}
            </button>
          </div>

          {/* Building feature */}
          <div>
            <h3 className="text-base font-medium mb-3">Building feature</h3>
            <div className="grid grid-cols-2 gap-3">
              {buildingFeatures.slice(0, showAllBuildingFeatures ? undefined : 6).map((feature) => (
                <label key={feature} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded"
                    checked={selectedBuildingFeatures.includes(feature)}
                    onChange={() => toggleSelection(feature, selectedBuildingFeatures, setSelectedBuildingFeatures)}
                  />
                  <span className="text-sm">{feature}</span>
                </label>
              ))}
            </div>
            <button
              className="text-sm text-gray-600 hover:text-gray-800 mt-2 underline"
              onClick={() => setShowAllBuildingFeatures(!showAllBuildingFeatures)}
            >
              {showAllBuildingFeatures ? "Show less" : "Show all"}
            </button>
          </div>

          {/* Material feature */}
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
              {materialFeatures.slice(0, showAllMaterialFeatures ? undefined : 6).map((material) => (
                <label key={material} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded"
                    checked={selectedMaterialFeatures.includes(material)}
                    onChange={() => toggleSelection(material, selectedMaterialFeatures, setSelectedMaterialFeatures)}
                  />
                  <span className="text-sm">{material}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Building type */}
          <div>
            <h3 className="text-base font-medium mb-3">Building type</h3>
            <div className="grid grid-cols-2 gap-3">
              {["Interior Designed", "New Build", "Renovated"].map((type) => (
                <label key={type} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded"
                    checked={selectedBuildingTypes.includes(type)}
                    onChange={() => toggleSelection(type, selectedBuildingTypes, setSelectedBuildingTypes)}
                  />
                  <span className="text-sm">{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Size */}
          <div>
            <h3 className="text-base font-medium mb-3">Size</h3>
            <div className="grid grid-cols-2 gap-3">
              {["Compact", "Medium", "Large"].map((size) => (
                <label key={size} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded"
                    checked={selectedSizes.includes(size)}
                    onChange={() => toggleSelection(size, selectedSizes, setSelectedSizes)}
                  />
                  <span className="text-sm">{size}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Budget */}
          <div>
            <h3 className="text-base font-medium mb-3">Budget</h3>
            <div className="grid grid-cols-2 gap-3">
              {["$", "$$", "$$$", "$$$$"].map((budget) => (
                <label key={budget} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded"
                    checked={selectedBudgets.includes(budget)}
                    onChange={() => toggleSelection(budget, selectedBudgets, setSelectedBudgets)}
                  />
                  <span className="text-sm">{budget}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Project year */}
          <div>
            <h3 className="text-base font-medium mb-3">Project year</h3>
            <div className="px-2">
              <input
                type="range"
                min="1800"
                max="2025"
                value={projectYear[1]}
                onChange={(e) => setProjectYear([projectYear[0], Number.parseInt(e.target.value)])}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-sm text-gray-600 mt-1">
                <span>1800</span>
                <span>2025</span>
              </div>
            </div>
          </div>

          {/* Building year */}
          <div>
            <h3 className="text-base font-medium mb-3">Building year</h3>
            <div className="px-2">
              <input
                type="range"
                min="1800"
                max="2025"
                value={buildingYear[1]}
                onChange={(e) => setBuildingYear([buildingYear[0], Number.parseInt(e.target.value)])}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-sm text-gray-600 mt-1">
                <span>1800</span>
                <span>2025</span>
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Bottom */}
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
