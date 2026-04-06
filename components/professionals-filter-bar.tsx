"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { X } from "lucide-react"
import { useTranslations } from "next-intl"

import {
  useProfessionalFilters,
  PROFESSIONAL_SORT_OPTIONS,
} from "@/contexts/professional-filter-context"

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

// ─── DrawerSection ──────────────────────────────────────────────────────────

interface DrawerSectionProps {
  title: string
  activeCount: number
  selectedLabel: string
  children: React.ReactNode
}

function DrawerSection({ title, activeCount, selectedLabel, children }: DrawerSectionProps) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div className="drawer-section" data-collapsed={collapsed}>
      <div
        className="drawer-section-header"
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((c) => !c)}
        onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
          if (e.key === " " || e.key === "Enter") { e.preventDefault(); setCollapsed((c) => !c) }
        }}
      >
        <div className="drawer-section-header-left">
          <span className="drawer-section-title">{title}</span>
          {activeCount > 0 && (
            <span className="drawer-section-badge">{selectedLabel}</span>
          )}
        </div>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"
          className="drawer-section-chevron">
          <path d="M2 4l3 3 3-3" />
        </svg>
      </div>
      {!collapsed && <div className="drawer-section-body">{children}</div>}
    </div>
  )
}

// ─── ProfessionalsFilterBar ─────────────────────────────────────────────────

export function ProfessionalsFilterBar() {
  const t = useTranslations("professionals.filters")

  const {
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
  } = useProfessionalFilters()

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [locationSearch, setLocationSearch] = useState("")
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

  const barRef = useRef<HTMLDivElement>(null)

  // Sort option label mapping
  const sortLabelMap: Record<string, string> = {
    "Best match": t("sort_best_match"),
    "Most popular": t("sort_most_popular"),
    "Most recent": t("sort_most_recent"),
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setActiveDropdown(null)
      }
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

  // ── Filtered cities ──
  const filteredCities = useMemo(() => {
    const term = locationSearch.trim().toLowerCase()
    if (term.length === 0) return cities
    return cities.filter((c) => c.toLowerCase().includes(term))
  }, [cities, locationSearch])

  // ── Active chip tags ──
  const activeFilterTags = useMemo(() => {
    const tags: Array<{ type: string; value: string; label: string }> = []
    selectedCategories.forEach((id) =>
      tags.push({ type: "category", value: id, label: taxonomyLabelMap.get(id) ?? id }),
    )
    selectedServices.forEach((id) =>
      tags.push({ type: "service", value: id, label: taxonomyLabelMap.get(id) ?? id }),
    )
    selectedCities.forEach((city) =>
      tags.push({ type: "city", value: city, label: city }),
    )
    return tags
  }, [selectedCategories, selectedServices, selectedCities, taxonomyLabelMap])

  const totalCount = activeFilterTags.length
  const serviceFilterCount = selectedCategories.length + selectedServices.length

  // ── Handlers ──

  const toggleDropdown = (name: string) => {
    if (typeof window !== "undefined" && window.innerWidth <= 768) {
      setDrawerOpen(true)
      return
    }
    setActiveDropdown((prev) => (prev === name ? null : name))
  }

  const toggleCategorySelection = (categoryId: string) => {
    if (selectedCategories.includes(categoryId)) {
      setSelectedCategories(selectedCategories.filter((v) => v !== categoryId))
    } else {
      setSelectedCategories([...selectedCategories, categoryId])
    }
  }

  const toggleServiceSelection = (serviceId: string) => {
    if (!serviceId) return
    if (selectedServices.includes(serviceId)) {
      setSelectedServices(selectedServices.filter((v) => v !== serviceId))
    } else {
      setSelectedServices([...selectedServices, serviceId])
    }
  }

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

            {/* Service — desktop pill */}
            <div className="filter-pill-group" data-hide-mobile="true" style={{ position: "relative" }}>
              <button
                className="filter-pill"
                data-active={serviceFilterCount > 0}
                data-open={activeDropdown === "service"}
                onClick={() => toggleDropdown("service")}
                aria-expanded={activeDropdown === "service"}
              >
                {t("service")}
                {serviceFilterCount > 0 && (
                  <span className="filter-pill-badge">{serviceFilterCount}</span>
                )}
                <ChevronDownIcon className="filter-pill-chevron" />
              </button>
              <div
                className="filter-dropdown"
                data-open={activeDropdown === "service"}
                style={{ minWidth: 280 }}
              >
                <div style={{ maxHeight: 360, overflowY: "auto" }}>
                  {sections.map((section) => {
                    const catId = section.category.id ?? ""
                    const catChecked = selectedCategories.includes(catId)
                    const isExpanded = Boolean(expandedCategories[catId])
                    return (
                      <div key={catId}>
                        <div
                          className="filter-dropdown-option"
                          data-checked={catChecked}
                          role="option"
                          aria-selected={catChecked}
                          tabIndex={0}
                          onClick={() => toggleCategorySelection(catId)}
                          onKeyDown={(e) => {
                            if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleCategorySelection(catId) }
                          }}
                        >
                          <div className="filter-dropdown-option-left">
                            <div className="filter-checkbox">{catChecked && <CheckIcon />}</div>
                            <span className="filter-dropdown-label" style={{ fontWeight: 500 }}>{section.category.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpandedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }))
                            }}
                            style={{
                              fontSize: 11,
                              color: "var(--text-secondary)",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "0 4px",
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              gap: 3,
                            }}
                          >
                            {isExpanded ? t("hide") : t("show_all")}
                            <svg
                              width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"
                              style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}
                            >
                              <path d="M2 4l3 3 3-3" />
                            </svg>
                          </button>
                        </div>
                        {isExpanded && section.services.map((service) => {
                          const sId = service.id ?? ""
                          const sChecked = selectedServices.includes(sId)
                          return (
                            <div
                              key={sId}
                              className="filter-dropdown-option"
                              data-checked={sChecked}
                              role="option"
                              aria-selected={sChecked}
                              tabIndex={0}
                              onClick={() => toggleServiceSelection(sId)}
                              onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleServiceSelection(sId) }
                              }}
                              style={{ paddingLeft: 36 }}
                            >
                              <div className="filter-dropdown-option-left">
                                <div className="filter-checkbox">{sChecked && <CheckIcon />}</div>
                                <span className="filter-dropdown-label">{service.name}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Location — desktop pill */}
            <div className="filter-pill-group" data-hide-mobile="true" style={{ position: "relative" }}>
              <button
                className="filter-pill"
                data-active={selectedCities.length > 0}
                data-open={activeDropdown === "location"}
                onClick={() => toggleDropdown("location")}
                aria-expanded={activeDropdown === "location"}
              >
                {t("location")}
                {selectedCities.length > 0 && (
                  <span className="filter-pill-badge">{selectedCities.length}</span>
                )}
                <ChevronDownIcon className="filter-pill-chevron" />
              </button>
              <div
                className="filter-dropdown"
                data-open={activeDropdown === "location"}
                style={{ minWidth: 224 }}
              >
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
                            <span className="filter-dropdown-label">{city}</span>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div style={{ padding: "10px 16px", fontSize: 13, color: "var(--text-secondary)" }}>
                      {t("no_locations")}
                    </div>
                  )}
                </div>
              </div>
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
                const isExpanded = Boolean(expandedCategories[catId])

                return (
                  <div key={catId}>
                    {/* Category row: checkbox + label + show all */}
                    <div className="drawer-option" data-checked={catChecked}>
                      <div className="drawer-option-left">
                        <div
                          role="option"
                          aria-selected={catChecked}
                          tabIndex={0}
                          className="drawer-option-checkbox"
                          onClick={() => toggleCategorySelection(catId)}
                          onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                            if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleCategorySelection(catId) }
                          }}
                        >
                          {catChecked && <CheckIcon />}
                        </div>
                        <span
                          className="drawer-option-label"
                          style={{ fontWeight: 500, cursor: "pointer" }}
                          onClick={() => toggleCategorySelection(catId)}
                        >
                          {section.category.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }))}
                        style={{
                          fontSize: 11,
                          color: "var(--text-secondary)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "0 4px",
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        {isExpanded ? t("hide") : t("show_all")}
                        <svg
                          width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"
                          style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}
                        >
                          <path d="M2 4l3 3 3-3" />
                        </svg>
                      </button>
                    </div>

                    {/* Expanded child services */}
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
                          onClick={() => toggleServiceSelection(sId)}
                          onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                            if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleServiceSelection(sId) }
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
          <DrawerSection title={t("location")} activeCount={selectedCities.length} selectedLabel={t("selected", { count: selectedCities.length })}>
            <input
              className="drawer-search"
              type="text"
              placeholder={t("city_or_region")}
              value={locationSearch}
              onChange={(e) => setLocationSearch(e.target.value)}
            />
            <div className="drawer-option-list" style={{ maxHeight: 240, overflowY: "auto" }}>
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
                      <span className="drawer-option-label">{city}</span>
                    </div>
                  </div>
                )
              })}
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
