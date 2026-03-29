"use client"

import { useState, useEffect } from "react"
import { X, Search } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import type { Database } from "@/lib/supabase/types"

type ProjectStatus = Database["public"]["Enums"]["project_status"]

interface DashboardListingsFilterProps {
  isOpen: boolean
  onClose: () => void
  onApply: (filters: FilterState) => void
  currentFilters: FilterState
}

export interface FilterState {
  keyword: string
  statuses: ProjectStatus[]
  roles: ("owner" | "contributor")[]
  yearFrom: number
  yearTo: number
}

// Labels are resolved at render time via translations
const STATUS_OPTION_VALUES: ProjectStatus[] = ["draft", "in_progress", "published", "archived", "rejected"]
const STATUS_LABEL_KEYS: Record<string, string> = {
  draft: "filter_status_in_progress",
  in_progress: "filter_status_in_review",
  published: "filter_status_listed",
  archived: "filter_status_unlisted",
  rejected: "filter_status_rejected",
}

const ROLE_OPTION_VALUES: ("owner" | "contributor")[] = ["owner", "contributor"]
const ROLE_LABEL_KEYS: Record<string, string> = {
  owner: "filter_role_owner",
  contributor: "filter_role_contributor",
}

const CURRENT_YEAR = new Date().getFullYear()
const MIN_YEAR = 2000

interface FilterContentProps {
  variant: "desktop" | "mobile"
  keyword: string
  setKeyword: (value: string) => void
  selectedStatuses: ProjectStatus[]
  toggleStatus: (status: ProjectStatus) => void
  selectedRoles: ("owner" | "contributor")[]
  toggleRole: (role: "owner" | "contributor") => void
  yearFrom: number
  setYearFrom: (value: number) => void
  yearTo: number
  setYearTo: (value: number) => void
  t: ReturnType<typeof useTranslations<"dashboard">>
}

function FilterContent({
  variant,
  keyword,
  setKeyword,
  selectedStatuses,
  toggleStatus,
  selectedRoles,
  toggleRole,
  yearFrom,
  setYearFrom,
  yearTo,
  setYearTo,
  t,
}: FilterContentProps) {
  const isDesktop = variant === "desktop"
  const sectionSpacing = isDesktop ? "space-y-5" : "space-y-6"
  const headingClass = isDesktop ? "heading-7 mb-2" : "heading-6 mb-3"
  const checkboxSpacing = isDesktop ? "space-y-2" : "space-y-3"
  const checkboxGap = isDesktop ? "gap-2.5" : "gap-3"
  const yearLayout = isDesktop ? "grid grid-cols-2 gap-3" : "space-y-4"
  const yearLabelClass = isDesktop ? "text-xs text-text-secondary mb-1 block" : "body-small text-text-secondary mb-1 block"

  return (
    <div className={sectionSpacing}>
      {/* Keyword Search */}
      <div>
        <h3 className={headingClass}>{t("filter_search")}</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={t("filter_search_placeholder")}
            className="w-full pl-10 pr-4 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
      </div>

      {/* Status Filter */}
      <div>
        <h3 className={headingClass}>{t("filter_status")}</h3>
        <div className={checkboxSpacing}>
          {STATUS_OPTION_VALUES.map((value) => (
            <label key={value} className={`flex items-center ${checkboxGap} cursor-pointer`}>
              <input
                type="checkbox"
                className="h-4 w-4 rounded"
                checked={selectedStatuses.includes(value)}
                onChange={() => toggleStatus(value)}
              />
              <span className="body-small">{t(STATUS_LABEL_KEYS[value] as any)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Role Filter */}
      <div>
        <h3 className={headingClass}>{t("filter_role")}</h3>
        <div className={checkboxSpacing}>
          {ROLE_OPTION_VALUES.map((value) => (
            <label key={value} className={`flex items-center ${checkboxGap} cursor-pointer`}>
              <input
                type="checkbox"
                className="h-4 w-4 rounded"
                checked={selectedRoles.includes(value)}
                onChange={() => toggleRole(value)}
              />
              <span className="body-small">{t(ROLE_LABEL_KEYS[value] as any)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Year Range Filter */}
      <div>
        <h3 className={headingClass}>{t("filter_year")}</h3>
        <div className={yearLayout}>
          <div>
            <label className={yearLabelClass}>{t("filter_year_from")}</label>
            <input
              type="number"
              min={MIN_YEAR}
              max={yearTo}
              value={yearFrom}
              onChange={(e) => setYearFrom(Number(e.target.value))}
              className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>
          <div>
            <label className={yearLabelClass}>{t("filter_year_to")}</label>
            <input
              type="number"
              min={yearFrom}
              max={CURRENT_YEAR}
              value={yearTo}
              onChange={(e) => setYearTo(Number(e.target.value))}
              className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export function DashboardListingsFilter({
  isOpen,
  onClose,
  onApply,
  currentFilters,
}: DashboardListingsFilterProps) {
  const t = useTranslations("dashboard")
  const [keyword, setKeyword] = useState(currentFilters.keyword)
  const [selectedStatuses, setSelectedStatuses] = useState<ProjectStatus[]>(currentFilters.statuses)
  const [selectedRoles, setSelectedRoles] = useState<("owner" | "contributor")[]>(currentFilters.roles)
  const [yearFrom, setYearFrom] = useState(currentFilters.yearFrom)
  const [yearTo, setYearTo] = useState(currentFilters.yearTo)

  // Reset local state when modal opens with current filters
  useEffect(() => {
    if (isOpen) {
      setKeyword(currentFilters.keyword)
      setSelectedStatuses(currentFilters.statuses)
      setSelectedRoles(currentFilters.roles)
      setYearFrom(currentFilters.yearFrom)
      setYearTo(currentFilters.yearTo)
    }
  }, [isOpen, currentFilters])

  const toggleStatus = (status: ProjectStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    )
  }

  const toggleRole = (role: "owner" | "contributor") => {
    setSelectedRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]))
  }

  const handleClearAll = () => {
    setKeyword("")
    setSelectedStatuses([])
    setSelectedRoles([])
    setYearFrom(MIN_YEAR)
    setYearTo(CURRENT_YEAR)
  }

  const handleApply = () => {
    onApply({
      keyword,
      statuses: selectedStatuses,
      roles: selectedRoles,
      yearFrom,
      yearTo,
    })
    onClose()
  }

  const hasActiveFilters =
    keyword !== "" ||
    selectedStatuses.length > 0 ||
    selectedRoles.length > 0 ||
    yearFrom !== MIN_YEAR ||
    yearTo !== CURRENT_YEAR

  if (!isOpen) return null

  const filterContentProps = {
    keyword,
    setKeyword,
    selectedStatuses,
    toggleStatus,
    selectedRoles,
    toggleRole,
    yearFrom,
    setYearFrom,
    yearTo,
    setYearTo,
    t,
  }

  return (
    <>
      {/* Desktop Modal */}
      <div className="hidden md:block">
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="filter-dialog-title"
            className="relative w-full max-w-md bg-white rounded-lg shadow-xl flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 id="filter-dialog-title" className="heading-5">
                {t("filters")}
              </h2>
              <button onClick={onClose} aria-label="Close filter dialog" className="p-1 hover:bg-surface rounded">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <FilterContent variant="desktop" {...filterContentProps} />
            </div>

            {/* Footer */}
            <div className="border-t border-border px-6 py-4 flex gap-3">
              <Button
                variant="quaternary" size="quaternary"
                onClick={handleClearAll}
                className="flex-1 bg-transparent"
                disabled={!hasActiveFilters}
              >
                {t("clear_filters")}
              </Button>
              <Button onClick={handleApply} className="flex-1 bg-black text-white hover:bg-secondary-hover">
                {t("apply_filters")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      <div className="md:hidden">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="filter-drawer-title"
          className="fixed inset-0 z-50 bg-white flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 id="filter-drawer-title" className="heading-5">
              {t("filters")}
            </h2>
            <button onClick={onClose} aria-label="Close filter drawer" className="p-1 hover:bg-surface rounded">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <FilterContent variant="mobile" {...filterContentProps} />
          </div>

          {/* Footer */}
          <div className="border-t border-border p-4 flex gap-3">
            <Button
              variant="quaternary" size="quaternary"
              onClick={handleClearAll}
              className="flex-1 bg-transparent"
              disabled={!hasActiveFilters}
            >
              {t("clear_filters")}
            </Button>
            <Button onClick={handleApply} className="flex-1 bg-black text-white hover:bg-secondary-hover">
              {t("apply_filters")}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
