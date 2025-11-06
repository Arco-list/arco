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
    const handleClickOutside = (event: Event) => {
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

      const shouldIncludeParent = (allowedSubTypes as readonly string[]).includes(typeName)

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
        if (item.isParent) return // Exclude parent items from carousel
        if (seen.has(item.id)) return
        items.push(item)
        seen.add(item.id)
      })
    })

    return items
  }, [typeOptions])

  // Update scroll state when items change
  useEffect(() => {
    const updateScrollButtons = () => {
      if (carouselRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current
        setCanScrollLeft(scrollLeft > 0)
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
      }
    }
    // Use requestAnimationFrame to ensure DOM has updated
    const rafId = requestAnimationFrame(updateScrollButtons)
    return () => cancelAnimationFrame(rafId)
  }, [quickFilterItems])

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

  const availableCities = taxonomy.cities ?? []

  const filteredLocations = availableCities.filter((location) =>
    location.toLowerCase().includes(locationSearch.toLowerCase()),
  )

  const projectStyles = taxonomyOptions.project_style ?? []

  const getButtonClassName = (hasSelection: boolean) => {
    return hasSelection
      ? "border-[#222222] text-[#222222] bg-transparent"
      : ""
  }

  return (
    <>
      <div className="w-full border-b border-border bg-white/95 backdrop-blur-md sticky top-14 z-40 h-16">
      <div className="mx-auto max-w-[1800px] px-4">
        <div className="flex items-center gap-2 py-3 min-h-[64px]">
          {/* Filters Button */}
          <Button
            variant="quaternary"
            size="quaternary"
            className={getButtonClassName(hasActiveFilters())}
            onClick={() => setIsFiltersModalOpen(true)}
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>

          {/* Type Dropdown - Hidden on mobile */}
          <div className="relative hidden md:block" ref={typeDropdownRef}>
            <Button
              variant="quaternary"
              size="quaternary"
              className={getButtonClassName(selectedTypes.length > 0)}
              onClick={toggleTypeDropdown}
              disabled={taxonomyLoading && topLevelCategories.length === 0}
            >
              Type
              <ChevronDown className="h-4 w-4" />
            </Button>

            {taxonomyLoading && topLevelCategories.length === 0 && activeDropdown === "type" && (
              <div className="absolute left-0 top-12 z-50 w-64 rounded-md border border-border bg-white shadow-lg">
                <div className="p-4 space-y-3">
                  <div className="h-4 w-32 animate-pulse rounded bg-surface" />
                  <div className="h-4 w-40 animate-pulse rounded bg-surface" />
                  <div className="h-4 w-28 animate-pulse rounded bg-surface" />
                </div>
              </div>
            )}

            {!taxonomyLoading && activeDropdown === "type" && (
              <div className="absolute left-0 top-12 z-50 w-64 rounded-md border border-border bg-white shadow-lg">
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
                                  className="h-4 w-4 rounded-full border-border text-black focus:ring-black"
                                  checked={selectedTypes.includes(itemValue)}
                                  onChange={() => toggleTypeSelection(itemValue)}
                                  onClick={(event) => handleTypeRadioClick(event, itemValue)}
                                  aria-checked={selectedTypes.includes(itemValue)}
                                />
                                <span className="text-sm">{item.name}</span>
                              </label>
                            )
                          }

                          const isExpanded = expandedSections.includes(section.id)
                          const showToggle = childItems.length > 0
                          const itemsToRender = isExpanded ? childItems : []

                          return (
                            <>
                              <div className="flex items-center justify-between mb-2">
                                {parentItem ? (
                                  <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="type-filter"
                                      className="h-4 w-4 rounded-full border-border text-black focus:ring-black"
                                      checked={selectedTypes.includes(parentItem.id)}
                                      onChange={() => toggleTypeSelection(parentItem.id)}
                                      onClick={(event) => handleTypeRadioClick(event, parentItem.id)}
                                      aria-checked={selectedTypes.includes(parentItem.id)}
                                    />
                                    <span className="text-sm">{section.name}</span>
                                  </label>
                                ) : (
                                  <span className="text-sm">{section.name}</span>
                                )}
                                {showToggle && (
                                  <button
                                    className="flex items-center gap-1 text-xs text-text-secondary hover:text-foreground"
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
                    <Button variant="quaternary" size="quaternary" onClick={clearFilters} className="flex-1 bg-transparent">
                      Clear filter
                    </Button>
                    <Button
                      size="sm"
                      onClick={toggleTypeDropdown}
                      className="flex-1 bg-black text-white hover:bg-secondary-hover"
                    >
                      Filter
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Style Dropdown - Hidden on mobile */}
          <div className="relative hidden md:block" ref={styleDropdownRef}>
            <Button
              variant="quaternary"
              size="quaternary"
              className={getButtonClassName(selectedStyles.length > 0)}
              onClick={toggleStyleDropdown}
            >
              Style
              <ChevronDown className="h-4 w-4" />
            </Button>

            {activeDropdown === "style" && (
              <div className="absolute left-0 top-12 z-50 w-64 rounded-md border border-border bg-white shadow-lg">
                <div className="p-4">
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {projectStyles.map((style) => {
                      const value = style.id ?? style.slug ?? style.name
                      return (
                        <label key={value} className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-border text-black focus:ring-black"
                            checked={selectedStyles.includes(value)}
                            onChange={() => toggleStyleSelection(value)}
                          />
                          <span className="text-sm">{style.name}</span>
                        </label>
                      )
                    })}
                  </div>

                  <div className="mt-6 flex gap-3">
                    <Button variant="quaternary" size="quaternary" onClick={clearStyleFilters} className="flex-1 bg-transparent">
                      Clear filter
                    </Button>
                    <Button
                      size="sm"
                      onClick={toggleStyleDropdown}
                      className="flex-1 bg-black text-white hover:bg-secondary-hover"
                    >
                      Filter
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Location Dropdown - Hidden on mobile */}
          <div className="relative hidden md:block" ref={locationDropdownRef}>
            <Button
              variant="quaternary"
              size="quaternary"
              className={getButtonClassName(selectedLocation !== "")}
              onClick={toggleLocationDropdown}
            >
              {selectedLocation || "Location"}
              <ChevronDown className="h-4 w-4" />
            </Button>

            {activeDropdown === "location" && (
              <div className="absolute left-0 top-12 z-50 w-64 rounded-md border border-border bg-white shadow-lg">
                <div className="p-4">
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search locations..."
                      className="w-full pl-10 pr-4 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                      value={locationSearch}
                      onChange={(e) => setLocationSearch(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {filteredLocations.length > 0 ? (
                      filteredLocations.map((location) => (
                        <button
                          key={location}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-surface rounded-md transition-colors"
                          onClick={() => selectLocation(location)}
                        >
                          {location}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-text-secondary">No locations found</div>
                    )}
                  </div>

                  <div className="mt-4 flex gap-3">
                    <Button variant="quaternary" size="quaternary" onClick={clearLocationFilter} className="flex-1 bg-transparent">
                      Clear filter
                    </Button>
                    <Button
                      size="sm"
                      onClick={toggleLocationDropdown}
                      className="flex-1 bg-black text-white hover:bg-secondary-hover"
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Divider - Hidden on mobile */}
          <div className="h-6 w-px bg-surface flex-shrink-0 self-center hidden md:block"></div>

          {/* Divider for mobile */}
          <div className="h-6 w-px bg-surface flex-shrink-0 self-center md:hidden"></div>

          {/* Left scroll button - Only visible on desktop */}
          <div className="hidden md:block">
            <Button
              variant="quaternary"
              className={`h-8 w-8 p-0 flex-shrink-0 ${!canScrollLeft ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => scrollCarousel("left")}
              disabled={!canScrollLeft}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-hidden">
            <div
              ref={carouselRef}
              className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {quickFilterItems.map((item) => {
                const iconKey = item.slug ?? item.parentSlug ?? ""
                const IconComponent =
                  SUBTYPE_ICON_MAP[iconKey] ?? CATEGORY_ICON_MAP[item.parentSlug ?? ""] ?? DEFAULT_CATEGORY_ICON
                const isSelected = selectedTypes.includes(item.id)
                return (
                  <Button
                    key={item.id}
                    onClick={() => toggleTypeSelection(item.id)}
                    variant="quaternary"
                    size="quaternary"
                    className={isSelected
                      ? "border-[#222222] text-[#222222] bg-transparent"
                      : ""
                    }
                  >
                    <IconComponent className="h-4 w-4" />
                    <span>{item.name}</span>
                  </Button>
                )
              })}
            </div>
          </div>

          {/* Right scroll button - Only visible on desktop */}
          <div className="hidden md:block">
            <Button
              variant="quaternary"
              className={`h-8 w-8 p-0 flex-shrink-0 ${!canScrollRight ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => scrollCarousel("right")}
              disabled={!canScrollRight}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

        </div>
      </div>
      </div>
      <FiltersModal isOpen={isFiltersModalOpen} onClose={() => setIsFiltersModalOpen(false)} />
    </>
  )
}
