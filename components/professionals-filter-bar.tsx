"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Armchair,
  ArrowUpDown,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cog,
  DoorClosed,
  Droplet,
  Filter,
  Flame,
  Grid,
  Hammer,
  HeartPulse,
  Home,
  Lamp,
  Lightbulb,
  Paintbrush,
  Palette,
  Ruler,
  Scissors,
  Search,
  Shield,
  SlidersHorizontal,
  Sofa,
  Sparkles,
  Sprout,
  Square,
  Trees,
  UtensilsCrossed,
  Waves,
  Zap,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ProfessionalsFiltersModal } from "@/components/professionals-filters-modal"
import type { LocationOption } from "@/hooks/use-professional-taxonomy"
import type { Tables } from "@/lib/supabase/types"
import { PROFESSIONAL_CATEGORY_CONFIG } from "@/lib/professional-filter-map"
import { useProfessionalFilters } from "@/contexts/professional-filter-context"

type CategoryRow = Tables<"categories">

type FilterSection = {
  category: CategoryRow
  services: CategoryRow[]
}

type ActiveDropdown = "service" | "location" | null

const DEFAULT_ICON = Filter

const SERVICE_ICON_REGISTRY: Array<[string[], LucideIcon]> = [
  [["design-planning-architecture", "architecture"], Building2],
  [["design-planning-interior-design", "interior design"], Sofa],
  [["design-planning-garden-design", "garden design"], Trees],
  [["construction-general-contractor", "general contractor"], Hammer],
  [["construction-roof", "roof"], Home],
  [["construction-tiles-and-stone", "tiles and stone"], Square],
  [["construction-kitchen", "kitchen"], UtensilsCrossed],
  [["construction-stairs", "stairs"], ArrowUpDown],
  [["construction-elevator", "elevator"], ArrowUpDown],
  [["construction-windows", "windows"], Square],
  [["construction-bathroom", "bathroom"], Droplet],
  [["construction-swimming-pool", "swimming pool"], Waves],
  [["construction-wellness", "wellness"], HeartPulse],
  [["construction-doors", "doors"], DoorClosed],
  [["systems-lighting", "lighting", "outdoor lighting"], Lightbulb],
  [["systems-electrical-systems", "electrical systems"], Zap],
  [["systems-security-systems", "security systems"], Shield],
  [["systems-domotica", "domotica"], Cog],
  [["finishing-interior-fit-out", "interior fit-out"], Ruler],
  [["finishing-fireplace", "fireplace"], Flame],
  [["finishing-interior-styling", "interior styling"], Sparkles],
  [["finishing-painting", "painting"], Paintbrush],
  [["finishing-decoration-and-carpentry", "decoration and carpentry"], Scissors],
  [["finishing-indoor-plants", "indoor plants"], Sprout],
  [["finishing-floor", "floor"], Grid],
  [["finishing-furniture", "furniture", "outdoor furniture"], Armchair],
  [["finishing-art", "art"], Palette],
  [["outdoor-garden", "garden"], Trees],
  [["outdoor-garden-house", "garden house"], Home],
  [["outdoor-fencing-and-gates", "fencing and gates"], Shield],
]

const CATEGORY_ICON_REGISTRY: Array<[string[], LucideIcon]> = [
  [["design-planning"], Building2],
  [["construction"], Hammer],
  [["systems"], Cog],
  [["finishing"], Sparkles],
  [["outdoor"], Trees],
]

const buildIconMap = (registry: Array<[string[], LucideIcon]>) => {
  const map: Record<string, LucideIcon> = {}
  registry.forEach(([keys, Icon]) => {
    keys.forEach((key) => {
      map[key.toLowerCase()] = Icon
    })
  })
  return map
}

const SERVICE_ICON_MAP = buildIconMap(SERVICE_ICON_REGISTRY)
const CATEGORY_ICON_MAP = buildIconMap(CATEGORY_ICON_REGISTRY)

const getServiceIcon = (slug?: string | null, name?: string | null): LucideIcon => {
  const slugKey = slug?.toLowerCase()
  if (slugKey && SERVICE_ICON_MAP[slugKey]) return SERVICE_ICON_MAP[slugKey]
  const nameKey = name?.toLowerCase()
  if (nameKey && SERVICE_ICON_MAP[nameKey]) return SERVICE_ICON_MAP[nameKey]
  return DEFAULT_ICON
}

const getCategoryIcon = (slug?: string | null, name?: string | null): LucideIcon => {
  const slugKey = slug?.toLowerCase()
  if (slugKey && CATEGORY_ICON_MAP[slugKey]) return CATEGORY_ICON_MAP[slugKey]
  const nameKey = name?.toLowerCase()
  if (nameKey && CATEGORY_ICON_MAP[nameKey]) return CATEGORY_ICON_MAP[nameKey]
  return DEFAULT_ICON
}

const getCategoryKey = (category: CategoryRow) => category.id ?? category.slug ?? category.name ?? ""
const getServiceKey = (service: CategoryRow) => service.id ?? service.slug ?? service.name ?? ""

export function ProfessionalsFilterBar() {
  const {
    selectedCategories,
    selectedServices,
    selectedCountry,
    selectedState,
    selectedCity,
    keyword,
    setSelectedCategories,
    setSelectedServices,
    setSelectedCountry,
    setSelectedState,
    setSelectedCity,
    clearAllFilters,
    taxonomy,
    locationOptions,
  } = useProfessionalFilters()

  const [activeDropdown, setActiveDropdown] = useState<ActiveDropdown>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [locationSearch, setLocationSearch] = useState("")
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

  const serviceDropdownRef = useRef<HTMLDivElement>(null)
  const locationDropdownRef = useRef<HTMLDivElement>(null)
  const desktopCarouselRef = useRef<HTMLDivElement>(null)
  const mobileCarouselRef = useRef<HTMLDivElement>(null)

  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      const clickedInsideService = serviceDropdownRef.current?.contains(target) ?? false
      const clickedInsideLocation = locationDropdownRef.current?.contains(target) ?? false

      if (!clickedInsideService && !clickedInsideLocation) {
        setActiveDropdown(null)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const sections = useMemo<FilterSection[]>(() => {
    const categoryBySlug = new Map(taxonomy.categories.map((category) => [category.slug ?? "", category]))
    const serviceBySlug = new Map(taxonomy.services.map((service) => [service.slug ?? "", service]))

    return PROFESSIONAL_CATEGORY_CONFIG.map((config) => {
      const category = categoryBySlug.get(config.slug)
      if (!category) return null

      const serviceItems = config.services
        .map((serviceConfig) => serviceBySlug.get(serviceConfig.slug ?? ""))
        .filter((service): service is NonNullable<typeof service> => Boolean(service))

      return {
        category,
        services: serviceItems,
      }
    }).filter((section): section is NonNullable<typeof section> => Boolean(section))
  }, [taxonomy.categories, taxonomy.services])

  const locationOptionsList = taxonomy.locationOptions.flatOptions

  const selectedLocationLabel = useMemo(() => {
    if (!selectedCountry && !selectedState && !selectedCity) {
      return ""
    }

    const matchedOption = locationOptionsList.find(
      (option) =>
        option.country === selectedCountry &&
        option.stateRegion === selectedState &&
        option.city === selectedCity,
    )

    if (matchedOption) {
      return matchedOption.label
    }

    const parts = [selectedCity, selectedState, selectedCountry].filter((value): value is string => Boolean(value))
    return parts.join(", ")
  }, [locationOptionsList, selectedCity, selectedCountry, selectedState])

  const filteredLocationItems = useMemo(() => {
    const term = locationSearch.trim().toLowerCase()
    if (term.length === 0) return locationOptionsList
    return locationOptionsList.filter((option) => option.label.toLowerCase().includes(term))
  }, [locationOptionsList, locationSearch])

  const quickServiceItems = useMemo(() => {
    const seen = new Set<string>()
    const items: Array<{ id: string; slug: string; name: string }> = []
    sections.forEach((section) => {
      section.services.forEach((service) => {
        if (!service.id || seen.has(service.id)) return
        seen.add(service.id)
        items.push({ id: service.id, slug: service.slug ?? "", name: service.name ?? "" })
      })
    })
    return items
  }, [sections])

  const updateCarouselScrollState = () => {
    // Check desktop carousel first (visible on md+)
    const carousel = desktopCarouselRef.current || mobileCarouselRef.current
    if (!carousel) return

    const { scrollLeft, scrollWidth, clientWidth } = carousel
    setCanScrollLeft(scrollLeft > 0)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
  }

  useEffect(() => {
    const updateScrollButtons = () => {
      updateCarouselScrollState()
    }

    const desktopContainer = desktopCarouselRef.current
    const mobileContainer = mobileCarouselRef.current

    if (desktopContainer) {
      desktopContainer.addEventListener("scroll", updateScrollButtons)
    }
    if (mobileContainer) {
      mobileContainer.addEventListener("scroll", updateScrollButtons)
    }

    updateScrollButtons()

    return () => {
      if (desktopContainer) {
        desktopContainer.removeEventListener("scroll", updateScrollButtons)
      }
      if (mobileContainer) {
        mobileContainer.removeEventListener("scroll", updateScrollButtons)
      }
    }
  }, [quickServiceItems.length])

  useEffect(() => {
    const handleResize = () => updateCarouselScrollState()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM has finished rendering
    const rafId = requestAnimationFrame(() => {
      updateCarouselScrollState()
    })

    return () => cancelAnimationFrame(rafId)
  }, [quickServiceItems])

  const scrollCarousel = (direction: "left" | "right") => {
    const carousel = desktopCarouselRef.current || mobileCarouselRef.current
    if (!carousel) return

    const scrollAmount = carousel.clientWidth * 0.8
    const nextLeft = direction === "left" ? carousel.scrollLeft - scrollAmount : carousel.scrollLeft + scrollAmount
    carousel.scrollTo({ left: nextLeft, behavior: "smooth" })

    // Force update scroll state after animation
    setTimeout(() => updateCarouselScrollState(), 400)
  }

  const locationFilterCount = selectedCountry || selectedState || selectedCity ? 1 : 0
  const activeFilterCount =
    selectedCategories.length + selectedServices.length + locationFilterCount + (keyword.trim().length > 0 ? 1 : 0)

  const getButtonClassName = (hasSelection: boolean) =>
    `flex items-center gap-2 whitespace-nowrap rounded-full ${
      hasSelection
        ? "border-red-500 text-red-600 bg-red-50 hover:bg-red-100"
        : "bg-transparent border-gray-300 hover:border-gray-400"
    }`

  const toggleDropdown = (name: ActiveDropdown) => {
    setActiveDropdown((current) => {
      const next = current === name ? null : name
      if (next === "location") {
        setLocationSearch(selectedLocationLabel ?? "")
      }
      return next
    })
  }

  const toggleCategorySelection = (categoryId: string) => {
    if (selectedCategories.includes(categoryId)) {
      setSelectedCategories(selectedCategories.filter((value) => value !== categoryId))
    } else {
      setSelectedCategories([...selectedCategories, categoryId])
    }
  }

  const toggleServiceSelection = (serviceId: string) => {
    if (!serviceId) return
    if (selectedServices.includes(serviceId)) {
      setSelectedServices(selectedServices.filter((value) => value !== serviceId))
    } else {
      setSelectedServices([...selectedServices, serviceId])
    }
  }

  const toggleCategoryExpansion = (categoryKey: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryKey]: !prev[categoryKey],
    }))
  }

  const selectLocationOption = (option: LocationOption) => {
    setSelectedCountry(option.country)
    setSelectedState(option.stateRegion)
    setSelectedCity(option.city)
    setLocationSearch(option.label)
    setActiveDropdown(null)
  }

  const clearLocationFilter = () => {
    setSelectedCountry(null)
    setSelectedState(null)
    setSelectedCity(null)
    setLocationSearch("")
  }

  const handleClearServiceFilters = () => {
    setSelectedCategories([])
    setSelectedServices([])
    setExpandedCategories({})
  }

  const handleClearAllFilters = () => {
    clearAllFilters()
    setExpandedCategories({})
    setLocationSearch("")
    setActiveDropdown(null)
  }

  const MobileCarousel = () =>
    quickServiceItems.length > 0 ? (
      <div className="flex md:hidden items-center gap-2">
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
            ref={mobileCarouselRef}
            className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {quickServiceItems.map((item) => {
              const Icon = getServiceIcon(item.slug, item.name)
              const isSelected = selectedServices.includes(item.id)
              return (
                <button
                  key={item.id}
                  onClick={() => toggleServiceSelection(item.id)}
                  className={`flex items-center gap-2 whitespace-nowrap py-2 px-3 rounded-full transition-colors flex-shrink-0 border ${
                    isSelected
                      ? "text-red-600 bg-red-50 border-red-500 hover:bg-red-100"
                      : "bg-transparent border-gray-300 hover:border-gray-400"
                  }`}
                >
                  <Icon className="h-4 w-4" />
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
    ) : null

  return (
    <>
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-[1800px] mx-auto px-4 md:px-8 py-4 space-y-3 md:space-y-0">
          <div className="flex items-center gap-4 flex-wrap md:flex-nowrap">
            <Button
              variant="outline"
              size="sm"
              className={getButtonClassName(activeFilterCount > 0)}
              onClick={() => setIsModalOpen(true)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {activeFilterCount > 0 ? <span className="ml-2 text-xs text-gray-500">{activeFilterCount}</span> : null}
            </Button>

            <div className="hidden md:flex items-center gap-4">
              <div className="relative" ref={serviceDropdownRef}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleDropdown("service")}
                  className={getButtonClassName(selectedCategories.length + selectedServices.length > 0)}
                >
                  Service
                  {(selectedCategories.length || selectedServices.length) > 0 ? (
                    <span className="ml-2 text-xs text-gray-500">
                      {selectedCategories.length + selectedServices.length} selected
                    </span>
                  ) : null}
                </Button>

                {activeDropdown === "service" && (
                  <div className="absolute z-50 mt-2 w-80 bg-white border border-gray-200 rounded-md shadow-lg">
                    <div className="p-4 space-y-4 max-h-[360px] overflow-y-auto">
                      {sections.map((section) => {
                        const categoryKey = getCategoryKey(section.category)
                        const isExpanded = Boolean(expandedCategories[categoryKey])

                        return (
                          <div key={categoryKey} className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`category-${categoryKey}`}
                                  checked={selectedCategories.includes(section.category.id ?? "")}
                                  onCheckedChange={() => toggleCategorySelection(section.category.id ?? "")}
                                />

                                <Label htmlFor={`category-${categoryKey}`} className="text-sm font-medium">
                                  {section.category.name}
                                </Label>
                              </div>

                              {section.services.length > 0 && (
                                <button
                                  type="button"
                                  className="text-xs text-gray-500 hover:text-gray-700"
                                  onClick={() => toggleCategoryExpansion(categoryKey)}
                                >
                                  <span className="flex items-center gap-1">
                                    {isExpanded ? "Hide" : "View all"}
                                    <ChevronDown
                                      className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                    />
                                  </span>
                                </button>
                              )}
                            </div>

                            {isExpanded && section.services.length > 0 && (
                              <div className="mt-2 pl-6 space-y-2">
                                {section.services.map((service) => {
                                  const serviceKey = getServiceKey(service)
                                  return (
                                    <div className="flex items-center gap-2" key={serviceKey}>
                                      <Checkbox
                                        id={`service-${serviceKey}`}
                                        checked={selectedServices.includes(service.id ?? "")}
                                        onCheckedChange={() => toggleServiceSelection(service.id ?? "")}
                                      />
                                      <Label htmlFor={`service-${serviceKey}`} className="text-sm font-medium">
                                        {service.name}
                                      </Label>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    <div className="border-t border-gray-200 p-4 flex gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          handleClearServiceFilters()
                          setActiveDropdown(null)
                        }}
                        className="flex-1 bg-transparent"
                      >
                        Clear filter
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setActiveDropdown(null)}
                        className="flex-1 bg-black text-white hover:bg-gray-800"
                      >
                        Filter
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative" ref={locationDropdownRef}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleDropdown("location")}
                  className={getButtonClassName(Boolean(selectedCountry || selectedState || selectedCity))}
                >
                  {selectedLocationLabel || "Location"}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>

                {activeDropdown === "location" && (
                  <div className="absolute z-50 mt-2 w-72 bg-white border border-gray-200 rounded-md shadow-lg">
                    <div className="p-4 space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search locations..."
                          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                          value={locationSearch}
                          onChange={(event) => setLocationSearch(event.target.value)}
                        />
                      </div>

                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {filteredLocationItems.length > 0 ? (
                          filteredLocationItems.map((option) => (
                            <button
                              key={option.key}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-md transition-colors"
                              onClick={() => selectLocationOption(option)}
                            >
                              {option.label}
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
                          onClick={() => setActiveDropdown(null)}
                          className="flex-1 bg-black text-white hover:bg-gray-800"
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className={`hidden md:flex h-8 w-8 p-0 flex-shrink-0 ${!canScrollLeft ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => scrollCarousel("left")}
              disabled={!canScrollLeft}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="hidden md:block flex-1 overflow-hidden">
              <div
                ref={desktopCarouselRef}
                className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {quickServiceItems.map((item) => {
                  const Icon = getServiceIcon(item.slug, item.name)
                  const isSelected = selectedServices.includes(item.id)
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleServiceSelection(item.id)}
                      className={`flex items-center gap-2 whitespace-nowrap py-2 px-3 rounded-full transition-colors flex-shrink-0 border ${
                        isSelected
                          ? "text-red-600 bg-red-50 border-red-500 hover:bg-red-100"
                          : "bg-transparent border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-xs font-medium">{item.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className={`hidden md:flex h-8 w-8 p-0 flex-shrink-0 ${!canScrollRight ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => scrollCarousel("right")}
              disabled={!canScrollRight}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAllFilters}
                className="hidden md:flex text-sm text-gray-600 hover:text-gray-900"
              >
                Clear all
              </Button>
            )}
          </div>

          <MobileCarousel />
        </div>
      </div>

      <ProfessionalsFiltersModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} sections={sections} />
    </>
  )
}
