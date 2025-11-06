"use client"

import { useState, useEffect } from "react"
import { X, Search } from "lucide-react"
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

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "draft", label: "In progress" },
  { value: "in_progress", label: "In review" },
  { value: "published", label: "Live on page" },
  { value: "completed", label: "Listed" },
  { value: "archived", label: "Unlisted" },
]

const ROLE_OPTIONS: { value: "owner" | "contributor"; label: string }[] = [
  { value: "owner", label: "Project owner" },
  { value: "contributor", label: "Contributor" },
]

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
}: FilterContentProps) {
  const isDesktop = variant === "desktop"
  const sectionSpacing = isDesktop ? "space-y-5" : "space-y-6"
  const headingClass = isDesktop ? "text-sm font-medium mb-2" : "text-base font-medium mb-3"
  const checkboxSpacing = isDesktop ? "space-y-2" : "space-y-3"
  const checkboxGap = isDesktop ? "gap-2.5" : "gap-3"
  const yearLayout = isDesktop ? "grid grid-cols-2 gap-3" : "space-y-4"
  const yearLabelClass = isDesktop ? "text-xs text-text-secondary mb-1 block" : "text-sm text-text-secondary mb-1 block"

  return (
    <div className={sectionSpacing}>
      {/* Keyword Search */}
      <div>
        <h3 className={headingClass}>Search</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by title or type..."
            className="w-full pl-10 pr-4 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
      </div>

      {/* Status Filter */}
      <div>
        <h3 className={headingClass}>Status</h3>
        <div className={checkboxSpacing}>
          {STATUS_OPTIONS.map((option) => (
            <label key={option.value} className={`flex items-center ${checkboxGap} cursor-pointer`}>
              <input
                type="checkbox"
                className="h-4 w-4 rounded"
                checked={selectedStatuses.includes(option.value)}
                onChange={() => toggleStatus(option.value)}
              />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Role Filter */}
      <div>
        <h3 className={headingClass}>Role</h3>
        <div className={checkboxSpacing}>
          {ROLE_OPTIONS.map((option) => (
            <label key={option.value} className={`flex items-center ${checkboxGap} cursor-pointer`}>
              <input
                type="checkbox"
                className="h-4 w-4 rounded"
                checked={selectedRoles.includes(option.value)}
                onChange={() => toggleRole(option.value)}
              />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Year Range Filter */}
      <div>
        <h3 className={headingClass}>Year</h3>
        <div className={yearLayout}>
          <div>
            <label className={yearLabelClass}>From</label>
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
            <label className={yearLabelClass}>To</label>
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
              <h2 id="filter-dialog-title" className="text-lg font-semibold">
                Filters
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
                Clear filters
              </Button>
              <Button onClick={handleApply} className="flex-1 bg-black text-white hover:bg-secondary-hover">
                Apply filters
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
            <h2 id="filter-drawer-title" className="text-lg font-semibold">
              Filters
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
              Clear filters
            </Button>
            <Button onClick={handleApply} className="flex-1 bg-black text-white hover:bg-secondary-hover">
              Apply filters
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
