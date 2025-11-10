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
import { ProfessionalsFiltersModal } from "@/components/professionals-filters-modal"
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
    selectedCity,
    keyword,
    setSelectedCategories,
    setSelectedServices,
    setSelectedCity,
    clearAllFilters,
    taxonomy,
    cities,
  } = useProfessionalFilters()

  const [activeDropdown, setActiveDropdown] = useState<ActiveDropdown>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [locationSearch, setLocationSearch] = useState("")
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

  const serviceDropdownRef = useRef<HTMLDivElement>(null)
  const locationDropdownRef = useRef<HTMLDivElement>(null)
  const desktopCarouselRef = useRef<HTMLDivElement>(null)

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

  const filteredCities = useMemo(() => {
    const term = locationSearch.trim().toLowerCase()
    if (term.length === 0) return cities
    return cities.filter((city) => city.toLowerCase().includes(term))
  }, [cities, locationSearch])

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
    const carousel = desktopCarouselRef.current
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

    if (desktopContainer) {
      desktopContainer.addEventListener("scroll", updateScrollButtons)
    }

    updateScrollButtons()

    return () => {
      if (desktopContainer) {
        desktopContainer.removeEventListener("scroll", updateScrollButtons)
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
    const carousel = desktopCarouselRef.current
    if (!carousel) return

    const scrollAmount = carousel.clientWidth * 0.8
    const nextLeft = direction === "left" ? carousel.scrollLeft - scrollAmount : carousel.scrollLeft + scrollAmount
    carousel.scrollTo({ left: nextLeft, behavior: "smooth" })

    // Force update scroll state after animation
    setTimeout(() => updateCarouselScrollState(), 400)
  }

  const locationFilterCount = selectedCity ? 1 : 0
  const activeFilterCount =
    selectedCategories.length + selectedServices.length + locationFilterCount + (keyword.trim().length > 0 ? 1 : 0)

  const getButtonClassName = (hasSelection: boolean) =>
    `flex items-center gap-2 whitespace-nowrap rounded-full ${
      hasSelection
        ? "border-[#222222] text-[#222222] bg-transparent"
        : "bg-transparent border-border hover:border-border"
    }`

  const toggleDropdown = (name: ActiveDropdown) => {
    setActiveDropdown((current) => {
      const next = current === name ? null : name
      if (next === "location") {
        setLocationSearch(selectedCity ?? "")
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

  const selectCity = (city: string) => {
    setSelectedCity(city)
    setLocationSearch(city)
    setActiveDropdown(null)
  }

  const clearLocationFilter = () => {
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


  return (
    <>
      <div className="bg-white/95 backdrop-blur-md border-b border-border sticky top-14 z-40 h-16">
        <div className="max-w-[1800px] mx-auto px-4">
          <div className="flex items-center gap-2 py-3 min-h-[64px]">
            <Button
              variant="quaternary"
              size="quaternary"
              className={getButtonClassName(activeFilterCount > 0)}
              onClick={() => setIsModalOpen(true)}
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>

            {/* Service and Location Dropdowns - Hidden on mobile */}
            <div className="hidden md:flex items-center gap-2">
              <div className="relative" ref={serviceDropdownRef}>
                <Button
                  variant="quaternary"
                  size="quaternary"
                  onClick={() => toggleDropdown("service")}
                  className={getButtonClassName(selectedCategories.length + selectedServices.length > 0)}
                >
                  Service
                  <ChevronDown className="h-4 w-4" />
                </Button>

                {activeDropdown === "service" && (
                  <div className="absolute z-50 mt-2 w-80 bg-white border border-border rounded-md shadow-lg">
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

                                <label htmlFor={`category-${categoryKey}`} className="text-sm cursor-pointer">
                                  {section.category.name}
                                </label>
                              </div>

                              {section.services.length > 0 && (
                                <button
                                  type="button"
                                  className="text-xs text-text-secondary hover:text-foreground"
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
                                      <label htmlFor={`service-${serviceKey}`} className="text-sm cursor-pointer">
                                        {service.name}
                                      </label>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    <div className="border-t border-border p-3 flex gap-2">
                      <Button
                        variant="quaternary"
                        onClick={() => {
                          handleClearServiceFilters()
                          setActiveDropdown(null)
                        }}
                        className="flex-1"
                      >
                        Clear filter
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setActiveDropdown(null)}
                        className="flex-1"
                      >
                        Filter
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative" ref={locationDropdownRef}>
                <Button
                  variant="quaternary"
                  size="quaternary"
                  onClick={() => toggleDropdown("location")}
                  className={getButtonClassName(Boolean(selectedCity))}
                >
                  {selectedCity || "City"}
                  <ChevronDown className="h-4 w-4" />
                </Button>

                {activeDropdown === "location" && (
                  <div className="absolute z-50 mt-2 w-72 bg-white border border-border rounded-md shadow-lg">
                    <div className="p-4 space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search cities..."
                          className="w-full pl-10 pr-4 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                          value={locationSearch}
                          onChange={(event) => setLocationSearch(event.target.value)}
                        />
                      </div>

                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {filteredCities.length > 0 ? (
                          filteredCities.map((city) => (
                            <button
                              key={city}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-surface rounded-md transition-colors"
                              onClick={() => selectCity(city)}
                            >
                              {city}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-text-secondary">No cities found</div>
                        )}
                      </div>

                      <div className="mt-4 flex gap-2">
                        <Button variant="quaternary" onClick={clearLocationFilter} className="flex-1">
                          Clear filter
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => setActiveDropdown(null)}
                          className="flex-1"
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
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
                ref={desktopCarouselRef}
                className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {quickServiceItems.map((item) => {
                  const Icon = getServiceIcon(item.slug, item.name)
                  const isSelected = selectedServices.includes(item.id)
                  return (
                    <Button
                      key={item.id}
                      variant="quaternary"
                      size="quaternary"
                      onClick={() => toggleServiceSelection(item.id)}
                      className={`flex items-center gap-2 whitespace-nowrap flex-shrink-0 ${
                        isSelected
                          ? "border-[#222222] text-[#222222] bg-transparent"
                          : ""
                      }`}
                    >
                      <Icon className="h-4 w-4" />
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

            {activeFilterCount > 0 && (
              <Button
                variant="quaternary"
                size="quaternary"
                onClick={handleClearAllFilters}
                className="hidden md:flex text-sm text-text-secondary hover:text-foreground"
              >
                Clear all
              </Button>
            )}
          </div>

        </div>
      </div>

      <ProfessionalsFiltersModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} sections={sections} />
    </>
  )
}
