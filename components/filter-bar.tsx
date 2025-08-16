"use client"
import { useState, useRef, useEffect } from "react"
import {
  Filter,
  ChevronDown,
  ChevronUp,
  Search,
  Home,
  Bath,
  Building,
  Waves,
  TreePine,
  BuildingIcon as Barn,
  HomeIcon as House,
  Plus,
  Mountain,
  Flower,
  ChefHat,
  Building2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { FiltersModal } from "./filters-modal"
import { projectStyles, buildingTypesByCategory } from "@/lib/csv-data"
import { useFilters } from "@/contexts/filter-context"

const categories = [
  { icon: Home, label: "House" },
  { icon: Building, label: "Villa" },
  { icon: Building2, label: "Apartment" },
  { icon: Barn, label: "Warehouse" },
  { icon: Building, label: "Office Building" },
  { icon: House, label: "Retail Space" },
  { icon: Plus, label: "Mixed-Use Development" },
  { icon: Mountain, label: "Industrial Facility" },
  { icon: TreePine, label: "Business Park" },
  { icon: Waves, label: "Commercial Plaza" },
  { icon: Bath, label: "Manufacturing Plant" },
  { icon: ChefHat, label: "Distribution Center" },
  { icon: Sparkles, label: "Residential Complex" },
  { icon: Flower, label: "Green Building" },
]

export function FilterBar() {
  const {
    selectedTypes,
    selectedStyles,
    selectedLocation,
    setSelectedTypes,
    setSelectedStyles,
    setSelectedLocation,
    hasActiveFilters,
  } = useFilters()

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<string[]>([])
  const [locationSearch, setLocationSearch] = useState<string>("")
  const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const typeDropdownRef = useRef<HTMLDivElement>(null)
  const styleDropdownRef = useRef<HTMLDivElement>(null)
  const locationDropdownRef = useRef<HTMLDivElement>(null)
  const carouselRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        typeDropdownRef.current &&
        !typeDropdownRef.current.contains(event.target as Node) &&
        styleDropdownRef.current &&
        !styleDropdownRef.current.contains(event.target as Node) &&
        locationDropdownRef.current &&
        !locationDropdownRef.current.contains(event.target as Node)
      ) {
        setActiveDropdown(null)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  useEffect(() => {
    const updateScrollButtons = () => {
      if (carouselRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current
        setCanScrollLeft(scrollLeft > 0)
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
      }
    }

    const carousel = carouselRef.current
    if (carousel) {
      carousel.addEventListener("scroll", updateScrollButtons)
      updateScrollButtons()

      return () => carousel.removeEventListener("scroll", updateScrollButtons)
    }
  }, [])

  const scrollCarousel = (direction: "left" | "right") => {
    if (carouselRef.current) {
      const scrollAmount = 200
      const newScrollLeft =
        direction === "left"
          ? carouselRef.current.scrollLeft - scrollAmount
          : carouselRef.current.scrollLeft + scrollAmount

      carouselRef.current.scrollTo({
        left: newScrollLeft,
        behavior: "smooth",
      })
    }
  }

  const toggleCategoryFilter = (categoryLabel: string) => {
    const isSelected = selectedTypes.includes(categoryLabel)
    if (isSelected) {
      setSelectedTypes(selectedTypes.filter((type) => type !== categoryLabel))
    } else {
      setSelectedTypes([...selectedTypes, categoryLabel])
    }
  }

  const toggleTypeDropdown = () => {
    setActiveDropdown(activeDropdown === "type" ? null : "type")
  }

  const toggleTypeSelection = (type: string) => {
    setSelectedTypes(selectedTypes.includes(type) ? selectedTypes.filter((t) => t !== type) : [...selectedTypes, type])
  }

  const toggleCategorySelection = (category: string) => {
    const categoryTypes = buildingTypesByCategory[category]
    const allSelected = categoryTypes.every((type) => selectedTypes.includes(type))

    if (allSelected) {
      setSelectedTypes(selectedTypes.filter((type) => !categoryTypes.includes(type)))
    } else {
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

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => (prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]))
  }

  const clearFilters = () => {
    setSelectedTypes([])
  }

  const toggleStyleDropdown = () => {
    setActiveDropdown(activeDropdown === "style" ? null : "style")
  }

  const toggleStyleSelection = (style: string) => {
    setSelectedStyles(
      selectedStyles.includes(style) ? selectedStyles.filter((s) => s !== style) : [...selectedStyles, style],
    )
  }

  const clearStyleFilters = () => {
    setSelectedStyles([])
  }

  const toggleLocationDropdown = () => {
    setActiveDropdown(activeDropdown === "location" ? null : "location")
  }

  const selectLocation = (location: string) => {
    setSelectedLocation(location)
    setLocationSearch(location)
    setActiveDropdown(null)
  }

  const clearLocationFilter = () => {
    setSelectedLocation("")
    setLocationSearch("")
  }

  const popularLocations = [
    "Amsterdam",
    "Rotterdam",
    "The Hague",
    "Utrecht",
    "Eindhoven",
    "Tilburg",
    "Groningen",
    "Almere",
    "Breda",
    "Nijmegen",
    "Enschede",
    "Haarlem",
  ]

  const filteredLocations = popularLocations.filter((location) =>
    location.toLowerCase().includes(locationSearch.toLowerCase()),
  )

  const typeOptions = Object.entries(buildingTypesByCategory).map(([category, types]) => ({
    name: category,
    items: types,
  }))

  const getButtonClassName = (hasSelection: boolean) => {
    return `flex items-center gap-2 whitespace-nowrap ${
      hasSelection
        ? "border-red-500 text-red-600 bg-red-50 hover:bg-red-100"
        : "bg-transparent border-gray-300 hover:border-gray-400"
    }`
  }

  return (
    <div className="w-full border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex items-center gap-4 py-4">
          {/* Filters Button */}
          <Button
            variant="outline"
            size="sm"
            className={getButtonClassName(hasActiveFilters())}
            onClick={() => setIsFiltersModalOpen(true)}
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>

          {/* Type Dropdown */}
          <div className="relative" ref={typeDropdownRef}>
            <Button
              variant="outline"
              size="sm"
              className={getButtonClassName(selectedTypes.length > 0)}
              onClick={toggleTypeDropdown}
            >
              Type
              <ChevronDown className="h-4 w-4" />
            </Button>

            {activeDropdown === "type" && (
              <div className="absolute left-0 top-12 z-50 w-64 rounded-md border border-gray-200 bg-white shadow-lg">
                <div className="p-4">
                  <div className="space-y-3">
                    {typeOptions.map((section) => (
                      <div key={section.name}>
                        <div className="flex items-center justify-between mb-2">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded"
                              checked={isCategorySelected(section.name)}
                              ref={(el) => {
                                if (el) el.indeterminate = isCategoryPartiallySelected(section.name)
                              }}
                              onChange={() => toggleCategorySelection(section.name)}
                            />
                            <h4 className="text-sm font-medium text-gray-700">{section.name}</h4>
                          </label>
                          <button
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                            onClick={() => toggleSection(section.name)}
                          >
                            {expandedSections.includes(section.name) ? "Show less" : "View all"}
                            {expandedSections.includes(section.name) ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </button>
                        </div>

                        <div className="ml-6 space-y-2">
                          {section.items
                            .slice(0, expandedSections.includes(section.name) ? undefined : 3)
                            .map((item) => (
                              <label key={item} className="flex items-center gap-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded"
                                  checked={selectedTypes.includes(item)}
                                  onChange={() => toggleTypeSelection(item)}
                                />
                                <span className="text-sm text-gray-600">{item}</span>
                              </label>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex gap-3">
                    <Button variant="outline" size="sm" onClick={clearFilters} className="flex-1 bg-transparent">
                      Clear filter
                    </Button>
                    <Button
                      size="sm"
                      onClick={toggleTypeDropdown}
                      className="flex-1 bg-black text-white hover:bg-gray-800"
                    >
                      Filter
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Style Dropdown */}
          <div className="relative" ref={styleDropdownRef}>
            <Button
              variant="outline"
              size="sm"
              className={getButtonClassName(selectedStyles.length > 0)}
              onClick={toggleStyleDropdown}
            >
              Style
              <ChevronDown className="h-4 w-4" />
            </Button>

            {activeDropdown === "style" && (
              <div className="absolute left-0 top-12 z-50 w-64 rounded-md border border-gray-200 bg-white shadow-lg">
                <div className="p-4">
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {projectStyles.map((style) => (
                      <label key={style} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300"
                          checked={selectedStyles.includes(style)}
                          onChange={() => toggleStyleSelection(style)}
                        />
                        <span className="text-sm">{style}</span>
                      </label>
                    ))}
                  </div>

                  <div className="mt-6 flex gap-3">
                    <Button variant="outline" size="sm" onClick={clearStyleFilters} className="flex-1 bg-transparent">
                      Clear filter
                    </Button>
                    <Button
                      size="sm"
                      onClick={toggleStyleDropdown}
                      className="flex-1 bg-black text-white hover:bg-gray-800"
                    >
                      Filter
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={locationDropdownRef}>
            <Button
              variant="outline"
              size="sm"
              className={getButtonClassName(selectedLocation !== "")}
              onClick={toggleLocationDropdown}
            >
              {selectedLocation || "Location"}
              <ChevronDown className="h-4 w-4" />
            </Button>

            {activeDropdown === "location" && (
              <div className="absolute left-0 top-12 z-50 w-64 rounded-md border border-gray-200 bg-white shadow-lg">
                <div className="p-4">
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search locations..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                      value={locationSearch}
                      onChange={(e) => setLocationSearch(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {filteredLocations.length > 0 ? (
                      filteredLocations.map((location) => (
                        <button
                          key={location}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-md transition-colors"
                          onClick={() => selectLocation(location)}
                        >
                          {location}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-gray-500">No locations found</div>
                    )}
                  </div>

                  <div className="mt-4 flex gap-3">
                    <Button variant="outline" size="sm" onClick={clearLocationFilter} className="flex-1 bg-transparent">
                      Clear filter
                    </Button>
                    <Button
                      size="sm"
                      onClick={toggleLocationDropdown}
                      className="flex-1 bg-black text-white hover:bg-gray-800"
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className={`h-8 w-8 p-0 flex-shrink-0 ${!canScrollLeft ? "opacity-50 cursor-not-allowed" : ""}`}
            onClick={() => scrollCarousel("left")}
            disabled={!canScrollLeft}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex-1 overflow-hidden">
            <div
              ref={carouselRef}
              className="flex gap-6 overflow-x-auto scrollbar-hide scroll-smooth"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {categories.map((category, index) => {
                const IconComponent = category.icon
                const isSelected = selectedTypes.includes(category.label)
                return (
                  <button
                    key={index}
                    onClick={() => toggleCategoryFilter(category.label)}
                    className={`flex flex-col items-center gap-2 whitespace-nowrap py-2 transition-colors flex-shrink-0 ${
                      isSelected ? "text-red-600 border-b-2 border-red-600" : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <IconComponent className="h-5 w-5" />
                    <span className="text-xs font-medium">{category.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className={`h-8 w-8 p-0 flex-shrink-0 ${!canScrollRight ? "opacity-50 cursor-not-allowed" : ""}`}
            onClick={() => scrollCarousel("right")}
            disabled={!canScrollRight}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <FiltersModal isOpen={isFiltersModalOpen} onClose={() => setIsFiltersModalOpen(false)} />
    </div>
  )
}
