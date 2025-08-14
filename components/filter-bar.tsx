"use client"
import { useState } from "react"
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
  PocketIcon as Pool,
  ChefHat,
  Building2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { FiltersModal } from "./filters-modal"

const categories = [
  { icon: Home, label: "Townhouse" },
  { icon: Bath, label: "Bathroom" },
  { icon: Building, label: "Villa" },
  { icon: Waves, label: "Sauna" },
  { icon: TreePine, label: "Garden house" },
  { icon: Barn, label: "Farm" },
  { icon: House, label: "Bungalow" },
  { icon: Plus, label: "Extension" },
  { icon: Mountain, label: "Chalet" },
  { icon: Flower, label: "Garden" },
  { icon: Pool, label: "Outdoor pool" },
  { icon: ChefHat, label: "Kitchen" },
  { icon: Building2, label: "Apartment" },
  { icon: Sparkles, label: "Jacuzzi" },
]

export function FilterBar() {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [expandedSections, setExpandedSections] = useState<string[]>([])
  const [selectedStyles, setSelectedStyles] = useState<string[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>("")
  const [locationSearch, setLocationSearch] = useState<string>("")
  const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false)

  const toggleTypeDropdown = () => {
    setActiveDropdown(activeDropdown === "type" ? null : "type")
  }

  const toggleTypeSelection = (type: string) => {
    setSelectedTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]))
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
    setSelectedStyles((prev) => (prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]))
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

  return (
    <div className="w-full border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 md:px-[0]">
        <div className="flex items-center gap-4 py-4">
          {/* Filters Button */}
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2 whitespace-nowrap bg-transparent"
            onClick={() => setIsFiltersModalOpen(true)}
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>

          {/* Type Dropdown */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 whitespace-nowrap bg-transparent"
              onClick={toggleTypeDropdown}
            >
              Type
              <ChevronDown className="h-4 w-4" />
            </Button>

            {/* Type Dropdown Menu */}
            {activeDropdown === "type" && (
              <div className="absolute left-0 top-12 z-50 w-64 rounded-md border border-gray-200 bg-white shadow-lg">
                <div className="p-4">
                  {/* House section with expandable sub-types */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="propertyType"
                          className="h-4 w-4"
                          checked={selectedTypes.includes("House")}
                          onChange={() => toggleTypeSelection("House")}
                        />
                        <span className="text-sm">House</span>
                      </label>
                      <button
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                        onClick={() => toggleSection("House")}
                      >
                        View all
                        {expandedSections.includes("House") ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </button>
                    </div>

                    {/* House sub-types - only shown when expanded */}
                    {expandedSections.includes("House") && (
                      <div className="ml-7 space-y-3">
                        {["Townhouse", "Villa", "Farm", "Bungalow", "Extension", "Chalet", "Apartment"].map((type) => (
                          <label key={type} className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="radio"
                              name="propertyType"
                              className="h-4 w-4"
                              checked={selectedTypes.includes(type)}
                              onChange={() => toggleTypeSelection(type)}
                            />
                            <span className="text-sm text-gray-600">{type}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Expandable sections */}
                  <div className="mt-4 space-y-3">
                    {[
                      { name: "Kitchen & Living", items: ["Modern Kitchen", "Open Living", "Dining Area"] },
                      { name: "Bed & Bath", items: ["Master Bedroom", "Guest Room", "Bathroom"] },
                      { name: "Outdoor", items: ["Garden", "Patio", "Pool Area"] },
                      { name: "Other", items: ["Garage", "Storage", "Basement"] },
                    ].map((section) => (
                      <div key={section.name}>
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="radio"
                              name="propertyType"
                              className="h-4 w-4"
                              checked={selectedTypes.includes(section.name)}
                              onChange={() => toggleTypeSelection(section.name)}
                            />
                            <span className="text-sm">{section.name}</span>
                          </label>
                          <button
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                            onClick={() => toggleSection(section.name)}
                          >
                            View all
                            {expandedSections.includes(section.name) ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </button>
                        </div>

                        {expandedSections.includes(section.name) && (
                          <div className="ml-7 mt-2 space-y-2">
                            {section.items.map((item) => (
                              <label key={item} className="flex items-center gap-3 cursor-pointer">
                                <input
                                  type="radio"
                                  name="propertyType"
                                  className="h-4 w-4"
                                  checked={selectedTypes.includes(item)}
                                  onChange={() => toggleTypeSelection(item)}
                                />
                                <span className="text-sm text-gray-600">{item}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Action buttons */}
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
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 whitespace-nowrap bg-transparent"
              onClick={toggleStyleDropdown}
            >
              Style
              <ChevronDown className="h-4 w-4" />
            </Button>

            {/* Style Dropdown Menu */}
            {activeDropdown === "style" && (
              <div className="absolute left-0 top-12 z-50 w-64 rounded-md border border-gray-200 bg-white shadow-lg">
                <div className="p-4">
                  {/* Style options */}
                  <div className="space-y-3 max-h-80 overflow-y-auto">
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
                      "Transitional",
                      "Urban Modern",
                    ].map((style) => (
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

                  {/* Action buttons */}
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

          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 whitespace-nowrap bg-transparent"
              onClick={toggleLocationDropdown}
            >
              {selectedLocation || "Location"}
              <ChevronDown className="h-4 w-4" />
            </Button>

            {/* Location Dropdown Menu */}
            {activeDropdown === "location" && (
              <div className="absolute left-0 top-12 z-50 w-64 rounded-md border border-gray-200 bg-white shadow-lg">
                <div className="p-4">
                  {/* Search input */}
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

                  {/* Location options */}
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

                  {/* Action buttons */}
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

          {/* Scroll Left Button */}
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Categories - Scrollable */}
          <div className="flex-1 overflow-hidden">
            <div className="flex gap-6 overflow-x-auto scrollbar-hide">
              {categories.map((category, index) => {
                const IconComponent = category.icon
                return (
                  <button
                    key={index}
                    className="flex flex-col items-center gap-2 whitespace-nowrap py-2 text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0"
                  >
                    <IconComponent className="h-5 w-5" />
                    <span className="text-xs font-medium">{category.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Scroll Right Button */}
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <FiltersModal isOpen={isFiltersModalOpen} onClose={() => setIsFiltersModalOpen(false)} />
    </div>
  )
}
