"use client"
import { useState } from "react"
import { X, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"

interface FiltersModalProps {
  isOpen: boolean
  onClose: () => void
}

export function FiltersModal({ isOpen, onClose }: FiltersModalProps) {
  const [selectedProjectTypes, setSelectedProjectTypes] = useState<string[]>([])
  const [selectedStyles, setSelectedStyles] = useState<string[]>([])
  const [selectedBuildingTypes, setSelectedBuildingTypes] = useState<string[]>([])
  const [selectedLocationFeatures, setSelectedLocationFeatures] = useState<string[]>([])
  const [selectedBuildingFeatures, setSelectedBuildingFeatures] = useState<string[]>([])
  const [selectedMaterialFeatures, setSelectedMaterialFeatures] = useState<string[]>([])
  const [selectedSizes, setSelectedSizes] = useState<string[]>([])
  const [selectedBudgets, setSelectedBudgets] = useState<string[]>([])
  const [projectYear, setProjectYear] = useState([1800, 2025])
  const [buildingYear, setBuildingYear] = useState([1800, 2025])

  const [expandedSections, setExpandedSections] = useState<string[]>([])
  const [showAllStyles, setShowAllStyles] = useState(false)
  const [showAllLocationFeatures, setShowAllLocationFeatures] = useState(false)
  const [showAllBuildingFeatures, setShowAllBuildingFeatures] = useState(false)
  const [showAllMaterialFeatures, setShowAllMaterialFeatures] = useState(false)

  const toggleSelection = (item: string, selectedItems: string[], setSelectedItems: (items: string[]) => void) => {
    setSelectedItems(selectedItems.includes(item) ? selectedItems.filter((i) => i !== item) : [...selectedItems, item])
  }

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => (prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]))
  }

  const clearAllFilters = () => {
    setSelectedProjectTypes([])
    setSelectedStyles([])
    setSelectedBuildingTypes([])
    setSelectedLocationFeatures([])
    setSelectedBuildingFeatures([])
    setSelectedMaterialFeatures([])
    setSelectedSizes([])
    setSelectedBudgets([])
    setProjectYear([1800, 2025])
    setBuildingYear([1800, 2025])
  }

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
          {/* Project Type */}
          <div>
            <h3 className="text-base font-medium mb-3">Project Type</h3>
            <div className="space-y-3">
              {[
                { name: "House", hasViewAll: true },
                { name: "Kitchen & Living", hasViewAll: true },
                { name: "Bed & Bath", hasViewAll: true },
                { name: "Outdoor", hasViewAll: true },
                { name: "Other", hasViewAll: true },
              ].map((type) => (
                <div key={type.name} className="flex items-center justify-between">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="projectType"
                      className="h-4 w-4"
                      checked={selectedProjectTypes.includes(type.name)}
                      onChange={() => toggleSelection(type.name, selectedProjectTypes, setSelectedProjectTypes)}
                    />
                    <span className="text-sm">{type.name}</span>
                  </label>
                  {type.hasViewAll && (
                    <button
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                      onClick={() => toggleSection(type.name)}
                    >
                      View all
                      {expandedSections.includes(type.name) ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Style */}
          <div>
            <h3 className="text-base font-medium mb-3">Style</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                "Bohemian",
                "Coastal",
                "Contemporary",
                "Farmhouse",
                "Industrial",
                "Mediterranean",
                "Mid-Century Modern",
                "Minimalist",
                "Modern",
                "Rustic",
                "Scandinavian",
                "Traditional",
              ]
                .slice(0, showAllStyles ? undefined : 12)
                .map((style) => (
                  <label key={style} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded"
                      checked={selectedStyles.includes(style)}
                      onChange={() => toggleSelection(style, selectedStyles, setSelectedStyles)}
                    />
                    <span className="text-sm">{style}</span>
                  </label>
                ))}
              {!showAllStyles && (
                <>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded"
                      checked={selectedStyles.includes("Transitional")}
                      onChange={() => toggleSelection("Transitional", selectedStyles, setSelectedStyles)}
                    />
                    <span className="text-sm">Transitional</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded"
                      checked={selectedStyles.includes("Urban Modern")}
                      onChange={() => toggleSelection("Urban Modern", selectedStyles, setSelectedStyles)}
                    />
                    <span className="text-sm">Urban Modern</span>
                  </label>
                </>
              )}
            </div>
            <button
              className="text-sm text-gray-600 hover:text-gray-800 mt-2 underline"
              onClick={() => setShowAllStyles(!showAllStyles)}
            >
              Show all
            </button>
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

          {/* Location feature */}
          <div>
            <h3 className="text-base font-medium mb-3">Location feature</h3>
            <div className="grid grid-cols-2 gap-3">
              {["Lakefront", "Waterfront", "Amazing views", "Beach", "City view", "Coastal"].map((feature) => (
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
              Show all
            </button>
          </div>

          {/* Building feature */}
          <div>
            <h3 className="text-base font-medium mb-3">Building feature</h3>
            <div className="grid grid-cols-2 gap-3">
              {["Home office", "Living room", "Porch", "Hall", "Bedroom", "Cinema"].map((feature) => (
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
              Show all
            </button>
          </div>

          {/* Material feature */}
          <div>
            <h3 className="text-base font-medium mb-3">Material feature</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                "Metal constructions",
                "Natural Stone",
                "Stucco walls",
                "Exposed brick",
                "Glass facades",
                "Reclaimed wood",
              ].map((material) => (
                <label key={material} className="flex items-center gap-2 cursor-pointer">
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
            <button
              className="text-sm text-gray-600 hover:text-gray-800 mt-2 underline"
              onClick={() => setShowAllMaterialFeatures(!showAllMaterialFeatures)}
            >
              Show all
            </button>
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
          <Button onClick={onClose} className="flex-1 bg-black text-white hover:bg-gray-800">
            Show projects
          </Button>
        </div>
      </div>
    </div>
  )
}
