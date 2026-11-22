"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import {
  useProfessionalFilters,
  PROFESSIONAL_SORT_OPTIONS,
} from "@/contexts/professional-filter-context"
import { PROVINCES, cityLabel } from "@/lib/provinces"
import { DrawerSection } from "@/components/filters/drawer-section"
import { LayeredFilterPanel, layeredPath, layeredPillLabel, nextLayeredSelection, type LayeredGroup } from "@/components/filters/layered-filter"

// ─── Icons ──────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
      <path
        d="M1.5 4.5l2 2L7.5 2"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="9"
      height="9"
      viewBox="0 0 9 9"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M2 3.5l2.5 2.5 2.5-2.5" />
    </svg>
  )
}

// ─── FilterDropdown ─────────────────────────────────────────────────────────
// On mobile (≤768px), portals the dropdown to document.body so it escapes the
// scrollable filter bar's clipping context. On desktop, renders inline.

function FilterDropdown({ open, children, minWidth }: { open: boolean; children: React.ReactNode; minWidth?: number }) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const dropdown = (
    <div
      className="filter-dropdown"
      data-open={open}
      style={isMobile ? undefined : { minWidth: minWidth ?? 224 }}
    >
      {children}
    </div>
  )

  if (isMobile && typeof document !== "undefined") {
    return open ? createPortal(dropdown, document.body) : null
  }
  return dropdown
}


// ─── ProfessionalsFilterBar ─────────────────────────────────────────────────

export function ProfessionalsFilterBar() {
  const t = useTranslations("professionals.filters")

  const {
    keyword,
    selectedCategories,
    selectedServices,
    selectedCities,
    sortBy,
    setSelectedCategories,
    setSelectedServices,
    setSelectedCities,
    setSortBy,
    clearAllFilters,
    removeFilter,
    taxonomyLabelMap,
    taxonomy,
    cities,
    selectedRegions,
    setSelectedRegions,
    regionCityMap,
  } = useProfessionalFilters()
  const locale = useLocale()
  const regionLabel = (r: string) => (PROVINCES[r] ? (locale === "nl" ? PROVINCES[r].nl : PROVINCES[r].en) : r)

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [locationSearch, setLocationSearch] = useState("")
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean | undefined>>({})

  const barRef = useRef<HTMLDivElement>(null)

  // Sort option label mapping
  const sortLabelMap: Record<string, string> = {
    "Best match": t("sort_best_match"),
    "Most popular": t("sort_most_popular"),
    "Most recent": t("sort_most_recent"),
  }

  // Close on outside click. Portaled dropdowns live outside barRef, so we
  // also treat clicks inside any .filter-dropdown as "inside".
  useEffect(() => {
    const handler = (e: Event) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (barRef.current?.contains(target)) return
      if (target.closest?.(".filter-dropdown")) return
      setActiveDropdown(null)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Lock scroll when drawer open
  useEffect(() => {
    document.body.classList.toggle("overflow-hidden", drawerOpen)
    return () => document.body.classList.remove("overflow-hidden")
  }, [drawerOpen])

  // ── Build category → services hierarchy from taxonomy ──
  const sections = useMemo(() => {
    const parentCats = [...taxonomy.categories]
      .sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99))

    return parentCats
      .map((parent) => {
        const children = taxonomy.services
          .filter((c) => c.parent_id === parent.id)
          .sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99) || (a.name ?? "").localeCompare(b.name ?? ""))
        return { category: parent, services: children }
      })
      .filter((s) => s.services.length > 0)
  }, [taxonomy.categories, taxonomy.services])

  // Dezelfde indeling voor het gelaagde filter: dienstgroep › dienst.
  const serviceGroups: LayeredGroup[] = useMemo(() => sections.map((s) => ({
    id: s.category.id ?? "",
    label: s.category.name ?? "",
    children: s.services.map((svc) => ({ id: svc.id ?? "", label: svc.name ?? "" })),
  })), [sections])
  const categoryIds = useMemo(() => new Set(serviceGroups.map((g) => g.id)), [serviceGroups])

  // ── Filtered regions (provinces) ──
  const filteredRegions = useMemo(() => {
    const term = locationSearch.trim().toLowerCase()
    const regions = Object.keys(regionCityMap)
    if (term.length === 0) return regions
    return regions.filter((r) => regionLabel(r).toLowerCase().includes(term) || r.toLowerCase().includes(term))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionCityMap, locationSearch, locale])

  // ── Filtered cities ──
  const filteredCities = useMemo(() => {
    const term = locationSearch.trim().toLowerCase()
    if (term.length === 0) return cities
    return cities.filter((c) => c.toLowerCase().includes(term) || cityLabel(c, locale).toLowerCase().includes(term))
  }, [cities, locationSearch, locale])

  // ── Active chip tags ──
  const activeFilterTags = useMemo(() => {
    const tags: Array<{ type: string; value: string; label: string }> = []
    if (keyword.trim()) {
      tags.push({ type: "keyword", value: keyword, label: `"${keyword.trim()}"` })
    }
    selectedCategories.forEach((id) =>
      tags.push({ type: "category", value: id, label: taxonomyLabelMap.get(id) ?? id }),
    )
    // Een losse dienst met zijn groep ervoor: "Bouw › Keukenstudio".
    selectedServices.forEach((id) =>
      tags.push({ type: "service", value: id, label: layeredPath(serviceGroups, id) ?? taxonomyLabelMap.get(id) ?? id }),
    )
    selectedRegions.forEach((region) =>
      tags.push({ type: "region", value: region, label: regionLabel(region) }),
    )
    selectedCities.forEach((city) =>
      tags.push({ type: "city", value: city, label: cityLabel(city, locale) }),
    )
    return tags
  }, [keyword, selectedCategories, selectedServices, selectedCities, selectedRegions, taxonomyLabelMap, serviceGroups, locale])

  const totalCount = activeFilterTags.length
  const serviceFilterCount = selectedCategories.length + selectedServices.length

  // ── Handlers ──

  const toggleDropdown = (name: string) =>
    setActiveDropdown((prev) => (prev === name ? null : name))

  const handleClearAllFilters = () => {
    clearAllFilters()
    setLocationSearch("")
    setActiveDropdown(null)
  }

  // ── Render ──

  return (
    <>
      {/* Filter bar */}
      <div className="discover-filter-bar" ref={barRef}>
        <div className="wrap">
          <div className="discover-filter-inner">

            {/* All filters */}
            <button
              className="filter-pill"
              data-active={totalCount > 0}
              onClick={() => setDrawerOpen(true)}
              aria-label="Open all filters"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="1.5" y1="3.5" x2="11.5" y2="3.5" />
                <line x1="3.5" y1="6.5" x2="9.5" y2="6.5" />
                <line x1="5.5" y1="9.5" x2="7.5" y2="9.5" />
              </svg>
              {t("all_filters")}
              {totalCount > 0 && (
                <span className="filter-pill-badge">{totalCount}</span>
              )}
            </button>

            <div className="filter-pill-divider" />

            {/* Service */}
            <div className="filter-pill-group" style={{ position: "relative" }}>
              <button
                className="filter-pill"
                data-active={serviceFilterCount > 0}
                data-open={activeDropdown === "service"}
                onClick={() => toggleDropdown("service")}
                aria-expanded={activeDropdown === "service"}
              >
                {layeredPillLabel(serviceGroups, [...selectedCategories, ...selectedServices], t("service"), locale)}
                <ChevronDownIcon className="filter-pill-chevron" />
              </button>
              <FilterDropdown open={activeDropdown === "service"}>
                {activeDropdown === "service" && (
                  <LayeredFilterPanel
                    groups={serviceGroups}
                    selected={[...selectedCategories, ...selectedServices]}
                    onChange={(next) => {
                      setSelectedCategories(next.filter((id) => categoryIds.has(id)))
                      setSelectedServices(next.filter((id) => !categoryIds.has(id)))
                    }}
                    locale={locale}
                  />
                )}
              </FilterDropdown>
            </div>

            {/* Location */}
            <div className="filter-pill-group" style={{ position: "relative" }}>
              <button
                className="filter-pill"
                data-active={selectedCities.length + selectedRegions.length > 0}
                data-open={activeDropdown === "location"}
                onClick={() => toggleDropdown("location")}
                aria-expanded={activeDropdown === "location"}
              >
                {t("location")}
                {selectedCities.length + selectedRegions.length > 0 && (
                  <span className="filter-pill-badge">{selectedCities.length + selectedRegions.length}</span>
                )}
                <ChevronDownIcon className="filter-pill-chevron" />
              </button>
              <FilterDropdown open={activeDropdown === "location"} minWidth={224}>
                <div className="filter-dropdown-search">
                  <input
                    type="text"
                    placeholder={t("city_or_region")}
                    value={locationSearch}
                    onChange={(e) => setLocationSearch(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div style={{ maxHeight: 240, overflowY: "auto" }}>
                  {filteredRegions.map((region) => {
                    const regionChecked = selectedRegions.includes(region)
                    const toggleRegion = () =>
                      setSelectedRegions(
                        regionChecked ? selectedRegions.filter((r) => r !== region) : [...selectedRegions, region],
                      )
                    return (
                      <div
                        key={region}
                        className="filter-dropdown-option"
                        data-checked={regionChecked}
                        role="option"
                        aria-selected={regionChecked}
                        tabIndex={0}
                        onClick={toggleRegion}
                        onKeyDown={(e) => {
                          if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleRegion() }
                        }}
                      >
                        <div className="filter-dropdown-option-left">
                          <div className="filter-checkbox">{regionChecked && <CheckIcon />}</div>
                          <span className="filter-dropdown-label">{regionLabel(region)}</span>
                        </div>
                        <span style={{ marginLeft: "auto", paddingLeft: 12, fontSize: 11, color: "#a1a1a0", flexShrink: 0 }}>
                          {locale === "nl" ? "Provincie" : "Province"}
                        </span>
                      </div>
                    )
                  })}
                  {filteredCities.length > 0 ? (
                    filteredCities.map((city) => {
                      const cityChecked = selectedCities.includes(city)
                      return (
                        <div
                          key={city}
                          className="filter-dropdown-option"
                          data-checked={cityChecked}
                          role="option"
                          aria-selected={cityChecked}
                          tabIndex={0}
                          onClick={() => {
                            if (cityChecked) {
                              setSelectedCities(selectedCities.filter((c) => c !== city))
                            } else {
                              setSelectedCities([...selectedCities, city])
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === " " || e.key === "Enter") {
                              e.preventDefault()
                              if (cityChecked) {
                                setSelectedCities(selectedCities.filter((c) => c !== city))
                              } else {
                                setSelectedCities([...selectedCities, city])
                              }
                            }
                          }}
                        >
                          <div className="filter-dropdown-option-left">
                            <div className="filter-checkbox">{cityChecked && <CheckIcon />}</div>
                            <span className="filter-dropdown-label">{cityLabel(city, locale)}</span>
                          </div>
                          <span style={{ marginLeft: "auto", paddingLeft: 12, fontSize: 11, color: "#a1a1a0", flexShrink: 0 }}>
                            {locale === "nl" ? "Stad" : "City"}
                          </span>
                        </div>
                      )
                    })
                  ) : (
                    <div style={{ padding: "10px 16px", fontSize: 13, color: "var(--text-secondary)" }}>
                      {t("no_locations")}
                    </div>
                  )}
                </div>
              </FilterDropdown>
            </div>

            {/* Sort moved to results meta row */}

          </div>
        </div>
      </div>

      {/* Active chip strip */}
      {activeFilterTags.length > 0 && (
        <div className="discover-chip-strip">
          <div className="wrap">
            <div className="discover-chip-strip-inner">
              {activeFilterTags.map((tag) => (
                <button
                  key={`${tag.type}-${tag.value}`}
                  className="filter-chip"
                  onClick={() => removeFilter(tag.type, tag.value)}
                  aria-label={`Remove ${tag.label}`}
                >
                  {tag.label}
                  <span className="filter-chip-close" aria-hidden="true">✕</span>
                </button>
              ))}
              <button className="filter-chip-clear-all" onClick={handleClearAllFilters}>
                {t("clear_all")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer backdrop */}
      <div
        className="discover-drawer-backdrop"
        data-open={drawerOpen}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      {/* Filter drawer (slides from left) */}
      <aside
        className="discover-drawer"
        data-open={drawerOpen}
        role="dialog"
        aria-modal="true"
        aria-label="All filters"
      >
        <div className="discover-drawer-header">
          <span className="discover-drawer-title">{t("all_filters")}</span>
          <button
            className="discover-drawer-close"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="discover-drawer-body">

          {/* Services — single section, categories with expandable sub-services */}
          <DrawerSection title={t("services")} activeCount={serviceFilterCount} selectedLabel={t("selected", { count: serviceFilterCount })}>
            <div className="drawer-option-list">
              {sections.map((section) => {
                const catId = section.category.id ?? ""
                const catChecked = selectedCategories.includes(catId)
                const childCount = section.services.filter((svc) => selectedServices.includes(svc.id ?? "")).length
                // Open als je hem opende, of als er al een dienst in gekozen is.
                const isExpanded = expandedCategories[catId] ?? childCount > 0
                const selectedAll = [...selectedCategories, ...selectedServices]
                // Zelfde keuzeregels als de dropdown (layered-filter): een groep
                // kiezen haalt zijn losse diensten weg, een dienst de groep.
                const apply = (next: string[]) => {
                  setSelectedCategories(next.filter((id) => categoryIds.has(id)))
                  setSelectedServices(next.filter((id) => !categoryIds.has(id)))
                }
                const pickGroup = () => apply(nextLayeredSelection(serviceGroups, selectedAll, catId, null))
                const pickService = (sId: string) => apply(nextLayeredSelection(serviceGroups, selectedAll, catId, sId))

                return (
                  <div key={catId}>
                    {/* Groep: vinkje + naam kiest de groep, badge telt de
                        gekozen diensten, het pijltje klapt de diensten uit. */}
                    <div className="drawer-option" data-checked={catChecked}>
                      <div
                        className="drawer-option-left"
                        role="option"
                        aria-selected={catChecked}
                        tabIndex={0}
                        style={{ cursor: "pointer", flex: 1 }}
                        onClick={pickGroup}
                        onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                          if (e.key === " " || e.key === "Enter") { e.preventDefault(); pickGroup() }
                        }}
                      >
                        <div className="drawer-option-checkbox">{catChecked && <CheckIcon />}</div>
                        <span className="drawer-option-label" style={{ fontWeight: 500 }}>{section.category.name}</span>
                        {childCount > 0 && <span className="filter-pill-badge">{childCount}</span>}
                      </div>
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-label={section.category.name ?? ""}
                        onClick={() => setExpandedCategories((prev) => ({ ...prev, [catId]: !isExpanded }))}
                        className="drawer-option-expand"
                      >
                        <svg
                          width="7" height="11" viewBox="0 0 7 11" fill="none" aria-hidden
                          style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.2s" }}
                        >
                          <path d="M1.5 1.5l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>

                    {/* Uitgeklapte diensten */}
                    {isExpanded && section.services.map((service) => {
                      const sId = service.id ?? ""
                      const sChecked = selectedServices.includes(sId)
                      return (
                        <div
                          key={sId}
                          role="option"
                          aria-selected={sChecked}
                          tabIndex={0}
                          className="drawer-option"
                          data-checked={sChecked}
                          onClick={() => pickService(sId)}
                          onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                            if (e.key === " " || e.key === "Enter") { e.preventDefault(); pickService(sId) }
                          }}
                          style={{ paddingLeft: 26 }}
                        >
                          <div className="drawer-option-left">
                            <div className="drawer-option-checkbox">
                              {sChecked && <CheckIcon />}
                            </div>
                            <span className="drawer-option-label">{service.name}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </DrawerSection>

          {/* Location */}
          <DrawerSection title={t("location")} activeCount={selectedCities.length + selectedRegions.length} selectedLabel={t("selected", { count: selectedCities.length + selectedRegions.length })}>
            <input
              className="drawer-search"
              type="text"
              placeholder={t("city_or_region")}
              value={locationSearch}
              onChange={(e) => setLocationSearch(e.target.value)}
            />
            <div className="drawer-option-list" style={{ maxHeight: 240, overflowY: "auto" }}>
              {/* Eerst provincies, dan steden: dezelfde lijst als de dropdown. */}
              {filteredRegions.map((region) => {
                const regionChecked = selectedRegions.includes(region)
                const toggleRegion = () =>
                  setSelectedRegions(regionChecked ? selectedRegions.filter((r) => r !== region) : [...selectedRegions, region])
                return (
                  <div
                    key={`region-${region}`}
                    role="option"
                    aria-selected={regionChecked}
                    tabIndex={0}
                    className="drawer-option"
                    data-checked={regionChecked}
                    onClick={toggleRegion}
                    onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                      if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleRegion() }
                    }}
                  >
                    <div className="drawer-option-left">
                      <div className="drawer-option-checkbox">{regionChecked && <CheckIcon />}</div>
                      <span className="drawer-option-label">{regionLabel(region)}</span>
                    </div>
                    <span style={{ fontSize: 11, color: "#a1a1a0", flexShrink: 0 }}>{locale === "nl" ? "Provincie" : "Province"}</span>
                  </div>
                )
              })}
              {filteredCities.map((city) => {
                const cityChecked = selectedCities.includes(city)
                return (
                  <div
                    key={city}
                    role="option"
                    aria-selected={cityChecked}
                    tabIndex={0}
                    className="drawer-option"
                    data-checked={cityChecked}
                    onClick={() => {
                      if (cityChecked) {
                        setSelectedCities(selectedCities.filter((c) => c !== city))
                      } else {
                        setSelectedCities([...selectedCities, city])
                      }
                    }}
                    onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault()
                        if (cityChecked) {
                          setSelectedCities(selectedCities.filter((c) => c !== city))
                        } else {
                          setSelectedCities([...selectedCities, city])
                        }
                      }
                    }}
                  >
                    <div className="drawer-option-left">
                      <div className="drawer-option-checkbox">
                        {cityChecked && <CheckIcon />}
                      </div>
                      <span className="drawer-option-label">{cityLabel(city, locale)}</span>
                    </div>
                    <span style={{ fontSize: 11, color: "#a1a1a0", flexShrink: 0 }}>{locale === "nl" ? "Stad" : "City"}</span>
                  </div>
                )
              })}
              {filteredRegions.length === 0 && filteredCities.length === 0 && (
                <div style={{ padding: "10px 0", fontSize: 13, color: "var(--text-secondary)" }}>{t("no_locations")}</div>
              )}
            </div>
          </DrawerSection>

        </div>

        <div className="discover-drawer-footer">
          <button
            className="discover-drawer-clear"
            onClick={() => { handleClearAllFilters(); setDrawerOpen(false) }}
          >
            {t("clear_all")}
          </button>
          <button
            className="discover-drawer-apply"
            onClick={() => setDrawerOpen(false)}
          >
            {t("show_results")}
          </button>
        </div>
      </aside>
    </>
  )
}
