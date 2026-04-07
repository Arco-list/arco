"use client"

import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  type KeyboardEvent,
} from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { useTranslations } from "next-intl"

import { useFilters } from "@/contexts/filter-context"
import type { ProjectSpaceKey } from "@/types/project-filters"

// ─── Space options ─────────────────────────────────────────────────────────────

interface SpaceOption {
  key: ProjectSpaceKey
  labelKey: string
  icon: React.ReactNode
}

const SPACE_OPTIONS: SpaceOption[] = [
  {
    key: "exterior",
    labelKey: "exterior",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M2 8l6-5 6 5" />
        <rect x="3" y="8" width="10" height="6" />
        <rect x="6" y="10" width="4" height="4" />
      </svg>
    ),
  },
  {
    key: "living",
    labelKey: "living",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M2 11V8a2 2 0 012-2h8a2 2 0 012 2v3" />
        <rect x="1" y="11" width="14" height="2" rx="1" />
        <line x1="4" y1="13" x2="4" y2="15" />
        <line x1="12" y1="13" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    key: "kitchen",
    labelKey: "kitchen",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
        <rect x="2" y="6" width="12" height="7" rx="1" />
        <path d="M5 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
        <line x1="8" y1="9" x2="8" y2="11" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "bedroom",
    labelKey: "bedroom",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
        <rect x="1" y="9" width="14" height="4" rx="1" />
        <path d="M2 9V7a1 1 0 011-1h3a1 1 0 011 1v2" />
        <path d="M9 9V7a1 1 0 011-1h3a1 1 0 011 1v2" />
        <line x1="3" y1="13" x2="3" y2="15" />
        <line x1="13" y1="13" x2="13" y2="15" />
      </svg>
    ),
  },
  {
    key: "bathroom",
    labelKey: "bathroom",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
        <rect x="1" y="8" width="14" height="5" rx="1" />
        <path d="M4 8V5a2 2 0 114 0" />
        <line x1="3" y1="13" x2="3" y2="15" />
        <line x1="13" y1="13" x2="13" y2="15" />
      </svg>
    ),
  },
  {
    key: "home-office",
    labelKey: "home-office",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
        <rect x="2" y="3" width="12" height="8" rx="1" />
        <line x1="5" y1="14" x2="11" y2="14" />
        <line x1="8" y1="11" x2="8" y2="14" />
      </svg>
    ),
  },
  {
    key: "hallway",
    labelKey: "hallway",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
        <rect x="3" y="2" width="10" height="12" rx="1" />
        <path d="M6 14V10a2 2 0 014 0v4" />
        <line x1="8" y1="6" x2="8" y2="7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "garden",
    labelKey: "garden",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M8 14V8" />
        <path d="M8 8C8 5 5 3 2 4c1 3 3 4 6 4z" />
        <path d="M8 8c0-3 3-5 6-4-1 3-3 4-6 4z" />
      </svg>
    ),
  },
  {
    key: "pool",
    labelKey: "pool",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M1 10c1.5-1.8 3-1.8 4.5 0s3 1.8 4.5 0 3-1.8 4.5 0" />
        <path d="M1 7c1.5-1.8 3-1.8 4.5 0s3 1.8 4.5 0 3-1.8 4.5 0" opacity=".35" />
      </svg>
    ),
  },
  {
    key: "terrace",
    labelKey: "terrace",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M1 10h14" />
        <line x1="3" y1="10" x2="3" y2="14" />
        <line x1="8" y1="10" x2="8" y2="14" />
        <line x1="13" y1="10" x2="13" y2="14" />
        <path d="M8 2L2 10h12z" opacity=".35" />
      </svg>
    ),
  },
]

export const SORT_OPTIONS = ["Most recent", "Most liked", "Alphabetical"] as const
export type SortOption = (typeof SORT_OPTIONS)[number]

// ─── Icons ─────────────────────────────────────────────────────────────────────

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

// ─── Mobile-aware dropdown wrapper ────────────────────────────────────────────
// On mobile (≤768px), portals the dropdown to document.body to escape the
// scrollable filter bar's clipping context (iOS Safari position:fixed bugs).
// On desktop, renders inline as a child of the relative-positioned button.

function FilterDropdown({ open, children, minWidth, align }: { open: boolean; children: React.ReactNode; minWidth?: number; align?: "right" }) {
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
      data-align={align}
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

// ─── DropdownOption ────────────────────────────────────────────────────────────

interface DropdownOptionProps {
  label: string
  checked: boolean
  icon?: React.ReactNode
  onToggle: () => void
}

function DropdownOption({ label, checked, icon, onToggle }: DropdownOptionProps) {
  return (
    <div
      role="option"
      aria-selected={checked}
      tabIndex={0}
      className="filter-dropdown-option"
      data-checked={checked}
      onClick={onToggle}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); onToggle() }
      }}
    >
      <div className="filter-dropdown-option-left">
        <div className="filter-checkbox">{checked && <CheckIcon />}</div>
        {icon && <span className="filter-dropdown-icon">{icon}</span>}
        <span className="filter-dropdown-label">{label}</span>
      </div>
    </div>
  )
}

// ─── DrawerSection ─────────────────────────────────────────────────────────────

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

// ─── DrawerOptionListWithMore ──────────────────────────────────────────────────

const DRAWER_SHOW_MORE_LIMIT = 6

interface DrawerOptionListWithMoreProps<T> {
  items: T[]
  selectedValues: string[]
  getItemValue: (item: T) => string
  getItemLabel: (item: T) => string
  onToggle: (value: string, isCurrentlyChecked: boolean) => void
  showLessLabel: string
  showAllLabel: (count: number) => string
}

function DrawerOptionListWithMore<T>({
  items,
  selectedValues,
  getItemValue,
  getItemLabel,
  onToggle,
  showLessLabel,
  showAllLabel,
}: DrawerOptionListWithMoreProps<T>) {
  const [showAll, setShowAll] = useState(false)
  const needsShowMore = items.length > DRAWER_SHOW_MORE_LIMIT
  const visibleItems = needsShowMore && !showAll ? items.slice(0, DRAWER_SHOW_MORE_LIMIT) : items

  return (
    <>
      <div className="drawer-option-list">
        {visibleItems.map((item) => {
          const value = getItemValue(item)
          const isChecked = selectedValues.includes(value)
          return (
            <div
              key={value}
              role="option"
              aria-selected={isChecked}
              tabIndex={0}
              className="drawer-option"
              data-checked={isChecked}
              onClick={() => onToggle(value, isChecked)}
              onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault()
                  onToggle(value, isChecked)
                }
              }}
            >
              <div className="drawer-option-left">
                <div className="drawer-option-checkbox">
                  {isChecked && <CheckIcon />}
                </div>
                <span className="drawer-option-label">{getItemLabel(item)}</span>
              </div>
            </div>
          )
        })}
      </div>
      {needsShowMore && (
        <button
          className="drawer-show-more"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? showLessLabel : showAllLabel(items.length)}
        </button>
      )}
    </>
  )
}

// ─── DualRangeSlider ──────────────────────────────────────────────────────────

interface DualRangeSliderProps {
  min: number
  max: number
  valueLow: number
  valueHigh: number
  onChange: (low: number, high: number) => void
}

function DualRangeSlider({ min, max, valueLow, valueHigh, onChange }: DualRangeSliderProps) {
  const range = max - min
  const lowPct = ((valueLow - min) / range) * 100
  const highPct = ((valueHigh - min) / range) * 100

  return (
    <div style={{ padding: "4px 8px" }}>
      <div style={{ position: "relative", height: 20 }}>
        {/* Track background */}
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 0,
            right: 0,
            height: 4,
            borderRadius: 2,
            backgroundColor: "var(--surface, #f5f5f4)",
          }}
        />
        {/* Active track */}
        <div
          style={{
            position: "absolute",
            top: 8,
            left: `${lowPct}%`,
            width: `${highPct - lowPct}%`,
            height: 4,
            borderRadius: 2,
            backgroundColor: "var(--primary)",
          }}
        />
        {/* Min slider */}
        <input
          type="range"
          min={min}
          max={max}
          value={valueLow}
          onChange={(e) => {
            const v = Number.parseInt(e.target.value, 10)
            onChange(Math.min(v, valueHigh - 1), valueHigh)
          }}
          className="dual-range-thumb"
          style={{ position: "absolute", top: 0, left: 0, width: "100%", zIndex: valueLow > max - 10 ? 3 : 2 }}
        />
        {/* Max slider */}
        <input
          type="range"
          min={min}
          max={max}
          value={valueHigh}
          onChange={(e) => {
            const v = Number.parseInt(e.target.value, 10)
            onChange(valueLow, Math.max(v, valueLow + 1))
          }}
          className="dual-range-thumb"
          style={{ position: "absolute", top: 0, left: 0, width: "100%", zIndex: 2 }}
        />
      </div>
      <div className="flex justify-between mt-2" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        <span>{valueLow}</span>
        <span>{valueHigh}</span>
      </div>
    </div>
  )
}

// ─── FilterBar ─────────────────────────────────────────────────────────────────

interface FilterBarProps {
  sortBy: SortOption
  onSortChange: (sort: SortOption) => void
}

export function FilterBar({ sortBy, onSortChange }: FilterBarProps) {
  const t = useTranslations("projects.filters")
  const tSpaces = useTranslations("spaces")

  const {
    selectedTypes,
    selectedStyles,
    selectedLocations,
    selectedSpace,
    selectedBuildingTypes,
    projectYearRange,
    setSelectedTypes,
    setSelectedStyles,
    setSelectedLocations,
    setSelectedSpace,
    setSelectedBuildingTypes,
    setProjectYearRange,
    clearAllFilters,
    removeFilter,
    taxonomy,
  } = useFilters()

  const { categories, taxonomyOptions, cities = [], isLoading: taxonomyLoading } = taxonomy

  const styleOptions = taxonomyOptions.project_style ?? []
  const buildingTypeOptions = taxonomyOptions.building_type ?? []

  const YEAR_MIN = 1800
  const YEAR_MAX = new Date().getFullYear()

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [locationSearch, setLocationSearch] = useState("")
  const barRef = useRef<HTMLDivElement>(null)

  // Sort option label mapping
  const sortLabelMap: Record<SortOption, string> = {
    "Most recent": t("sort_most_recent"),
    "Most liked": t("sort_most_liked"),
    "Alphabetical": t("sort_alphabetical"),
  }

  // Close on outside click. Portaled dropdowns live outside barRef, so we
  // also treat clicks inside any .filter-dropdown as "inside".
  useEffect(() => {
    const handler = (e: Event) => {
      const target = e.target as Element | null
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

  // ── Taxonomy: top-level project type categories ──────────────────────────────
  // Use parent categories (parent_id = null) that are marked listable via attributes
  const topLevelCategories = useMemo(
    () => categories.filter((c) => c.parent_id === null && c.is_active !== false && c.category_type === "Project"),
    [categories],
  )

  // ── Filtered cities ──────────────────────────────────────────────────────────
  const filteredCities = useMemo(
    () =>
      cities.filter((c) =>
        c.toLowerCase().includes(locationSearch.toLowerCase()),
      ),
    [cities, locationSearch],
  )

  // ── Active chips ─────────────────────────────────────────────────────────────

  interface Chip { type: string; value: string; label: string }

  const chips = useMemo<Chip[]>(() => {
    const tags: Chip[] = []
    if (selectedSpace) {
      tags.push({ type: "space", value: selectedSpace, label: tSpaces(selectedSpace as any) })
    }
    selectedTypes.forEach((id) => {
      const cat = topLevelCategories.find((c) => c.id === id)
      tags.push({ type: "type", value: id, label: cat?.name ?? id })
    })
    selectedLocations.forEach((loc) => {
      tags.push({ type: "location", value: loc, label: loc })
    })
    selectedStyles.forEach((id) => {
      const opt = styleOptions.find((s) => (s.id ?? s.slug ?? s.name) === id)
      tags.push({ type: "style", value: id, label: opt?.name ?? id })
    })
    selectedBuildingTypes.forEach((id) => {
      const opt = buildingTypeOptions.find((s) => (s.id ?? s.slug ?? s.name) === id)
      tags.push({ type: "buildingType", value: id, label: opt?.name ?? id })
    })
    if (projectYearRange[0] !== null || projectYearRange[1] !== null) {
      const min = projectYearRange[0] ?? YEAR_MIN
      const max = projectYearRange[1] ?? YEAR_MAX
      tags.push({ type: "projectYear", value: `${min}-${max}`, label: `${min} – ${max}` })
    }
    return tags
  }, [selectedSpace, selectedTypes, selectedLocations, selectedStyles, selectedBuildingTypes, projectYearRange, topLevelCategories, styleOptions, buildingTypeOptions, YEAR_MIN, YEAR_MAX, tSpaces])

  const totalCount = chips.length

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const toggleDropdown = (name: string) =>
    setActiveDropdown((prev) => (prev === name ? null : name))

  const toggleType = useCallback(
    (id: string) =>
      setSelectedTypes(
        selectedTypes.includes(id)
          ? selectedTypes.filter((t) => t !== id)
          : [...selectedTypes, id]
      ),
    [selectedTypes, setSelectedTypes],
  )

  const toggleSpace = useCallback(
    (key: ProjectSpaceKey) =>
      setSelectedSpace(selectedSpace === key ? "" : key),
    [selectedSpace, setSelectedSpace],
  )

  const spaceOption = SPACE_OPTIONS.find((o) => o.key === selectedSpace)
  const spaceLabel = spaceOption ? tSpaces(spaceOption.labelKey as any) : t("space")

  const defaultSpaceIcon = (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"
      style={{ flexShrink: 0, opacity: 0.65 }}>
      <path d="M1 11c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0" />
      <path d="M1 7.5c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0" opacity=".35" />
    </svg>
  )

  // ── Render ────────────────────────────────────────────────────────────────────

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

            {/* Space */}
            <div style={{ position: "relative" }}>
              <button
                className="filter-pill"
                data-active={!!selectedSpace}
                data-open={activeDropdown === "space"}
                onClick={() => toggleDropdown("space")}
                aria-expanded={activeDropdown === "space"}
              >
                {spaceOption?.icon ?? defaultSpaceIcon}
                {spaceLabel}
                <ChevronDownIcon className="filter-pill-chevron" />
              </button>
              <FilterDropdown open={activeDropdown === "space"}>
                {SPACE_OPTIONS.map((opt) => (
                  <DropdownOption
                    key={opt.key}
                    label={tSpaces(opt.labelKey as any)}
                    checked={selectedSpace === opt.key}
                    icon={opt.icon}
                    onToggle={() => { toggleSpace(opt.key); setActiveDropdown(null) }}
                  />
                ))}
              </FilterDropdown>
            </div>

            {/* Type */}
            <div className="filter-pill-group" style={{ position: "relative" }}>
              <button
                className="filter-pill"
                data-active={selectedTypes.length > 0}
                data-open={activeDropdown === "type"}
                onClick={() => toggleDropdown("type")}
                disabled={taxonomyLoading && topLevelCategories.length === 0}
                aria-expanded={activeDropdown === "type"}
              >
                {t("type")}
                {selectedTypes.length > 0 && (
                  <span className="filter-pill-badge">{selectedTypes.length}</span>
                )}
                <ChevronDownIcon className="filter-pill-chevron" />
              </button>
              <FilterDropdown open={activeDropdown === "type"}>
                {taxonomyLoading && topLevelCategories.length === 0 ? (
                  <div style={{ padding: "16px", fontSize: 13, color: "var(--text-secondary)" }}>
                    {t("loading")}
                  </div>
                ) : (
                  topLevelCategories.map((cat) => (
                    <DropdownOption
                      key={cat.id}
                      label={cat.name}
                      checked={selectedTypes.includes(cat.id)}
                      onToggle={() => toggleType(cat.id)}
                    />
                  ))
                )}
              </FilterDropdown>
            </div>

            {/* Location */}
            <div className="filter-pill-group" style={{ position: "relative" }}>
              <button
                className="filter-pill"
                data-active={selectedLocations.length > 0}
                data-open={activeDropdown === "location"}
                onClick={() => toggleDropdown("location")}
                aria-expanded={activeDropdown === "location"}
              >
                {t("location")}
                {selectedLocations.length > 0 && (
                  <span className="filter-pill-badge">{selectedLocations.length}</span>
                )}
                <ChevronDownIcon className="filter-pill-chevron" />
              </button>
              <FilterDropdown open={activeDropdown === "location"}>
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
                    filteredCities.map((city) => (
                      <DropdownOption
                        key={city}
                        label={city}
                        checked={selectedLocations.includes(city)}
                        onToggle={() => {
                          setSelectedLocations(
                            selectedLocations.includes(city)
                              ? selectedLocations.filter((c) => c !== city)
                              : [...selectedLocations, city]
                          )
                          setLocationSearch("")
                        }}
                      />
                    ))
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
      {chips.length > 0 && (
        <div className="discover-chip-strip">
          <div className="wrap">
            <div className="discover-chip-strip-inner">
              {chips.map((chip) => (
                <button
                  key={`${chip.type}-${chip.value}`}
                  className="filter-chip"
                  onClick={() => removeFilter(chip.type, chip.value)}
                  aria-label={`Remove ${chip.label}`}
                >
                  {chip.label}
                  <span className="filter-chip-close" aria-hidden="true">✕</span>
                </button>
              ))}
              <button className="filter-chip-clear-all" onClick={clearAllFilters}>
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

      {/* Filter drawer */}
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

          {/* Space */}
          <DrawerSection title={t("space")} activeCount={selectedSpace ? 1 : 0} selectedLabel={t("selected", { count: 1 })}>
            <div className="drawer-option-list">
              {SPACE_OPTIONS.map((opt) => (
                <div
                  key={opt.key}
                  role="option"
                  aria-selected={selectedSpace === opt.key}
                  tabIndex={0}
                  className="drawer-option"
                  data-checked={selectedSpace === opt.key}
                  onClick={() => toggleSpace(opt.key)}
                  onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                    if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleSpace(opt.key) }
                  }}
                >
                  <div className="drawer-option-left">
                    <div className="drawer-option-checkbox">
                      {selectedSpace === opt.key && <CheckIcon />}
                    </div>
                    <span className="drawer-option-icon">{opt.icon}</span>
                    <span className="drawer-option-label">{tSpaces(opt.labelKey as any)}</span>
                  </div>
                </div>
              ))}
            </div>
          </DrawerSection>

          {/* Type */}
          <DrawerSection title={t("type")} activeCount={selectedTypes.length} selectedLabel={t("selected", { count: selectedTypes.length })}>
            <DrawerOptionListWithMore
              items={topLevelCategories}
              selectedValues={selectedTypes}
              getItemValue={(cat) => cat.id}
              getItemLabel={(cat) => cat.name}
              onToggle={(value, isChecked) =>
                setSelectedTypes(
                  isChecked
                    ? selectedTypes.filter((t) => t !== value)
                    : [...selectedTypes, value]
                )
              }
              showLessLabel={t("show_less")}
              showAllLabel={(count) => t("show_all", { count })}
            />
          </DrawerSection>

          {/* Location */}
          <DrawerSection title={t("location")} activeCount={selectedLocations.length} selectedLabel={t("selected", { count: selectedLocations.length })}>
            <input
              className="drawer-search"
              type="text"
              placeholder={t("city_or_region")}
              value={locationSearch}
              onChange={(e) => setLocationSearch(e.target.value)}
            />
            <div className="drawer-option-list" style={{ maxHeight: 240, overflowY: "auto" }}>
              {filteredCities.map((city) => {
                const isChecked = selectedLocations.includes(city)
                return (
                  <div
                    key={city}
                    role="option"
                    aria-selected={isChecked}
                    tabIndex={0}
                    className="drawer-option"
                    data-checked={isChecked}
                    onClick={() => {
                      setSelectedLocations(
                        isChecked
                          ? selectedLocations.filter((c) => c !== city)
                          : [...selectedLocations, city]
                      )
                      setLocationSearch("")
                    }}
                    onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault()
                        setSelectedLocations(
                          isChecked
                            ? selectedLocations.filter((c) => c !== city)
                            : [...selectedLocations, city]
                        )
                        setLocationSearch("")
                      }
                    }}
                  >
                    <div className="drawer-option-left">
                      <div className="drawer-option-checkbox">
                        {isChecked && <CheckIcon />}
                      </div>
                      <span className="drawer-option-label">{city}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </DrawerSection>

          {/* Scope (Building Type) */}
          <DrawerSection title={t("scope")} activeCount={selectedBuildingTypes.length} selectedLabel={t("selected", { count: selectedBuildingTypes.length })}>
            <div className="drawer-option-list">
              {buildingTypeOptions.map((bt) => {
                const value = bt.id ?? bt.slug ?? bt.name
                const isChecked = selectedBuildingTypes.includes(value)
                return (
                  <div
                    key={value}
                    role="option"
                    aria-selected={isChecked}
                    tabIndex={0}
                    className="drawer-option"
                    data-checked={isChecked}
                    onClick={() =>
                      setSelectedBuildingTypes(
                        isChecked
                          ? selectedBuildingTypes.filter((s) => s !== value)
                          : [...selectedBuildingTypes, value]
                      )
                    }
                    onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault()
                        setSelectedBuildingTypes(
                          isChecked
                            ? selectedBuildingTypes.filter((s) => s !== value)
                            : [...selectedBuildingTypes, value]
                        )
                      }
                    }}
                  >
                    <div className="drawer-option-left">
                      <div className="drawer-option-checkbox">
                        {isChecked && <CheckIcon />}
                      </div>
                      <span className="drawer-option-label">{bt.name}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </DrawerSection>

          {/* Style */}
          <DrawerSection title={t("style")} activeCount={selectedStyles.length} selectedLabel={t("selected", { count: selectedStyles.length })}>
            <DrawerOptionListWithMore
              items={styleOptions}
              selectedValues={selectedStyles}
              getItemValue={(s) => s.id ?? s.slug ?? s.name}
              getItemLabel={(s) => s.name}
              onToggle={(value, isChecked) =>
                setSelectedStyles(
                  isChecked
                    ? selectedStyles.filter((s) => s !== value)
                    : [...selectedStyles, value]
                )
              }
              showLessLabel={t("show_less")}
              showAllLabel={(count) => t("show_all", { count })}
            />
          </DrawerSection>

          {/* Year */}
          <DrawerSection title={t("year")} activeCount={(projectYearRange[0] !== null || projectYearRange[1] !== null) ? 1 : 0} selectedLabel={t("selected", { count: 1 })}>
            <DualRangeSlider
              min={YEAR_MIN}
              max={YEAR_MAX}
              valueLow={projectYearRange[0] ?? YEAR_MIN}
              valueHigh={projectYearRange[1] ?? YEAR_MAX}
              onChange={(low, high) =>
                setProjectYearRange([
                  low === YEAR_MIN ? null : low,
                  high === YEAR_MAX ? null : high,
                ])
              }
            />
          </DrawerSection>

        </div>

        <div className="discover-drawer-footer">
          <button
            className="discover-drawer-clear"
            onClick={() => { clearAllFilters(); setDrawerOpen(false) }}
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
