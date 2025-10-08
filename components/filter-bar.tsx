"use client"
import { useState, useRef, useEffect, useMemo, type MouseEvent } from "react"
import { Filter, ChevronDown, ChevronUp, Search, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FiltersModal } from "./filters-modal"
import { useFilters } from "@/contexts/filter-context"
import { CATEGORY_ICON_MAP, DEFAULT_CATEGORY_ICON, SUBTYPE_ICON_MAP } from "@/components/filter-icon-map"
import { PROJECT_TYPE_FILTERS, isAllowedProjectSubType, isAllowedProjectType } from "@/lib/project-type-filter-map"

interface TypeOptionItem {
  id: string
  name: string
  slug?: string
  parentId: string | null
  parentSlug?: string
  isParent: boolean
  isListable: boolean
}

interface TypeOptionSection {
  id: string
  name: string
  slug?: string
  items: TypeOptionItem[]
}

export function FilterBar() {
  const {
    selectedTypes,
    selectedStyles,
    selectedLocation,
    setSelectedTypes,
    setSelectedStyles,
    setSelectedLocation,
    hasActiveFilters,
    taxonomy,
  } = useFilters()

  const {
    categories: taxonomyCategories,
    taxonomyOptions,
    isLoading: taxonomyLoading,
  } = taxonomy

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

  const toggleTypeDropdown = () => {
    if (taxonomyLoading && topLevelCategories.length === 0) {
      return
    }
    setActiveDropdown(activeDropdown === "type" ? null : "type")
  }

  const toggleTypeSelection = (typeId: string) => {
    if (selectedTypes.includes(typeId)) {
      setSelectedTypes([])
    } else {
      setSelectedTypes([typeId])
    }
  }

  const handleTypeRadioClick = (event: MouseEvent<HTMLInputElement>, typeId: string) => {
    if (selectedTypes.includes(typeId)) {
      event.preventDefault()
      setSelectedTypes([])
    }
  }

  const topLevelCategories = useMemo(
    () => taxonomyCategories.filter((category) => category.parent_id === null),
    [taxonomyCategories],
  )

  const childCategoriesByParent = useMemo(() => {
    const map = new Map<string, typeof taxonomyCategories>
    taxonomyCategories.forEach((category) => {
      if (!category.parent_id) return
      const siblings = map.get(category.parent_id) ?? []
      siblings.push(category)
      map.set(category.parent_id, siblings)
    })
    return map
  }, [taxonomyCategories])

  const typeOptions = useMemo<TypeOptionSection[]>(() => {
    const sections: TypeOptionSection[] = []
    const topLevelByName = new Map(topLevelCategories.map((category) => [category.name, category]))
    const orderedTypes = Object.keys(PROJECT_TYPE_FILTERS)

    orderedTypes.forEach((typeName) => {
      if (!isAllowedProjectType(typeName)) {
        return
      }

      const category = topLevelByName.get(typeName)
      if (!category) {
        return
      }

      const allowedSubTypes = PROJECT_TYPE_FILTERS[typeName]
      const children = childCategoriesByParent.get(category.id) ?? []

      const sortedChildren = [...children]
        .filter((item) => isAllowedProjectSubType(typeName, item.name))
        .sort((a, b) => {
          const orderA = a.sort_order ?? Number.MAX_SAFE_INTEGER
          const orderB = b.sort_order ?? Number.MAX_SAFE_INTEGER
          if (orderA !== orderB) return orderA - orderB
          return a.name.localeCompare(b.name)
        })

      const shouldIncludeParent = allowedSubTypes.includes(typeName)

      const itemsSource = [
        ...(shouldIncludeParent ? [category] : []),
        ...sortedChildren,
      ]

      if (itemsSource.length === 0) {
        return
      }

      const sectionId = category.id ?? category.slug ?? category.name
      const sectionSlug = category.slug ?? undefined

      sections.push({
        id: sectionId,
        name: category.name,
        slug: sectionSlug,
        items: itemsSource.map((item, index) => {
          const isParentItem = item.id === category.id
          const itemName = item.name
          return {
            id: item.id ?? item.slug ?? `${item.name}-${index}`,
            name: itemName,
            slug: item.slug ?? undefined,
            parentId: isParentItem ? null : item.parent_id ?? category.id ?? null,
            parentSlug: sectionSlug,
            isParent: isParentItem,
            isListable: isAllowedProjectSubType(typeName, itemName) || (isParentItem && shouldIncludeParent),
          }
        }),
      })
    })

    return sections
  }, [childCategoriesByParent, topLevelCategories])

  const quickFilterItems = useMemo(() => {
    const seen = new Set<string>()
    const items: TypeOptionItem[] = []

    typeOptions.forEach((section) => {
      section.items.forEach((item) => {
        if (!item.isListable) return
        if (seen.has(item.id)) return
        items.push(item)
        seen.add(item.id)
      })
    })

    return items
  }, [typeOptions])

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => (prev.includes(section) ? prev.filter((item) => item !== section) : [...prev, section]))
  }

  const clearFilters = () => {
    setSelectedTypes([])
  }

  const toggleStyleDropdown = () => {
    setActiveDropdown(activeDropdown === "style" ? null : "style")
  }

  const toggleStyleSelection = (styleValue: string) => {
    const next = selectedStyles.includes(styleValue)
      ? selectedStyles.filter((s) => s !== styleValue)
      : [...selectedStyles, styleValue]
    setSelectedStyles(next)
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

  const projectStyles = taxonomyOptions.project_style ?? []

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
              disabled={taxonomyLoading && topLevelCategories.length === 0}
            >
              Type
              <ChevronDown className="h-4 w-4" />
            </Button>

            {taxonomyLoading && topLevelCategories.length === 0 && activeDropdown === "type" && (
              <div className="absolute left-0 top-12 z-50 w-64 rounded-md border border-gray-200 bg-white shadow-lg">
                <div className="p-4 space-y-3">
                  <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                  <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
                  <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
                </div>
              </div>
            )}

            {!taxonomyLoading && activeDropdown === "type" && (
              <div className="absolute left-0 top-12 z-50 w-64 rounded-md border border-gray-200 bg-white shadow-lg">
                <div className="p-4">
                  <div className="space-y-3">
                    {typeOptions.map((section) => (
                      <div key={section.id}>
                        {(() => {
                          const parentItem = section.items.find((item) => item.isParent)
                          const childItems = section.items.filter((item) => !item.isParent)

                          const renderOption = (item: TypeOptionItem) => {
                            const itemValue = item.id ?? item.name
                            return (
                              <label key={itemValue} className="flex items-center gap-3 cursor-pointer">
                                <input
                                  type="radio"
                                  name="type-filter"
                                  className="h-4 w-4 rounded-full border-gray-300 text-black focus:ring-black"
                                  checked={selectedTypes.includes(itemValue)}
                                  onChange={() => toggleTypeSelection(itemValue)}
                                  onClick={(event) => handleTypeRadioClick(event, itemValue)}
                                  aria-checked={selectedTypes.includes(itemValue)}
                                />
                                <span className="text-sm text-gray-600">{item.name}</span>
                              </label>
                            )
                          }

                          const isExpanded = expandedSections.includes(section.id)
                          const showToggle = childItems.length > 3
                          const itemsToRender = isExpanded ? childItems : childItems.slice(0, 3)

                          return (
                            <>
                              <div className="flex items-center justify-between mb-2">
                                {parentItem ? (
                                  <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="type-filter"
                                      className="h-4 w-4 rounded-full border-gray-300 text-black focus:ring-black"
                                      checked={selectedTypes.includes(parentItem.id)}
                                      onChange={() => toggleTypeSelection(parentItem.id)}
                                      onClick={(event) => handleTypeRadioClick(event, parentItem.id)}
                                      aria-checked={selectedTypes.includes(parentItem.id)}
                                    />
                                    <h4 className="text-sm font-medium text-gray-700">{section.name}</h4>
                                  </label>
                                ) : (
                                  <h4 className="text-sm font-medium text-gray-700">{section.name}</h4>
                                )}
                                {showToggle && (
                                  <button
                                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                                    onClick={() => toggleSection(section.id)}
                                  >
                                    {isExpanded ? "Show less" : "View all"}
                                    {isExpanded ? (
                                      <ChevronUp className="h-3 w-3" />
                                    ) : (
                                      <ChevronDown className="h-3 w-3" />
                                    )}
                                  </button>
                                )}
                              </div>

                              {childItems.length > 0 && (
                                <div className="ml-6 space-y-2">
                                  {itemsToRender.map((item) => renderOption(item))}
                                </div>
                              )}
                            </>
                          )
                        })()}
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
                    {projectStyles.map((style) => {
                      const value = style.id ?? style.slug ?? style.name
                      return (
                        <label key={value} className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300"
                            checked={selectedStyles.includes(value)}
                            onChange={() => toggleStyleSelection(value)}
                          />
                          <span className="text-sm">{style.name}</span>
                        </label>
                      )
                    })}
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
              {quickFilterItems.map((item) => {
                const iconKey = item.slug ?? item.parentSlug ?? ""
                const IconComponent =
                  SUBTYPE_ICON_MAP[iconKey] ?? CATEGORY_ICON_MAP[item.parentSlug ?? ""] ?? DEFAULT_CATEGORY_ICON
                const isSelected = selectedTypes.includes(item.id)
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleTypeSelection(item.id)}
                    className={`flex flex-col items-center gap-2 whitespace-nowrap py-2 transition-colors flex-shrink-0 ${
                      isSelected ? "text-red-600 border-b-2 border-red-600" : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <IconComponent className="h-5 w-5" />
                    <span className="text-xs font-medium">{item.name}</span>
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
