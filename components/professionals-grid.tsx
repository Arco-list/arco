"use client"

import { useMemo, useState } from "react"
import { ChevronDown, Loader2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ProfessionalCard as ProfessionalCardComponent } from "@/components/professional-card"
import { useProfessionalFilters } from "@/contexts/professional-filter-context"
import { useSavedProfessionals } from "@/contexts/saved-professionals-context"
import type { ProfessionalCard } from "@/lib/professionals/types"
import { useProfessionalsQuery } from "@/hooks/use-professionals-query"

const sortOptions = ["Best match", "Most recent", "Highest rated", "Alphabetical"] as const

export function ProfessionalsGrid({ professionals }: { professionals: ProfessionalCard[] }) {
  const {
    selectedCategories,
    selectedServices,
    selectedCity,
    keyword,
    removeFilter,
    hasActiveFilters,
    taxonomyLabelMap,
  } = useProfessionalFilters()

  const { savedProfessionalIds, saveProfessional, removeProfessional, mutatingProfessionalIds } =
    useSavedProfessionals()

  const {
    professionals: queryProfessionals,
    isLoading,
    isLoadingMore,
    error,
    refetch,
    hasMore,
    loadMore,
  } = useProfessionalsQuery(professionals)

  const [sortBy, setSortBy] = useState<(typeof sortOptions)[number]>("Best match")
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)

  const sortedProfessionals = useMemo(() => {
    const next = [...queryProfessionals]
    switch (sortBy) {
      case "Most recent":
        return next.sort((a, b) => b.name.localeCompare(a.name))
      case "Highest rated":
        return next.sort((a, b) => b.rating - a.rating)
      case "Alphabetical":
        return next.sort((a, b) => a.name.localeCompare(b.name))
      case "Best match":
      default:
        return next
    }
  }, [queryProfessionals, sortBy])

  const getPageTitle = () => {
    if (selectedCategories.length > 0) {
      const labels = selectedCategories
        .map((categoryId) => taxonomyLabelMap.get(categoryId) ?? categoryId)
        .filter(Boolean)

      const categoryPart = (() => {
        if (labels.length === 0) return "Professionals"
        if (labels.length === 1) return labels[0]
        if (labels.length === 2) return `${labels[0]} & ${labels[1]}`
        return `${labels.slice(0, -1).join(", ")} & ${labels[labels.length - 1]}`
      })()

      const locationPart = selectedCity ?? "all locations"
      return `${categoryPart} in ${locationPart}`
    }

    if (selectedCity) {
      return `Professionals in ${selectedCity}`
    }

    return "Professionals in all locations"
  }

  const activeFilterTags = useMemo(() => {
    const tags: Array<{ type: string; value: string; label: string }> = []

    selectedCategories.forEach((categoryId) => {
      tags.push({ type: "category", value: categoryId, label: taxonomyLabelMap.get(categoryId) ?? categoryId })
    })

    selectedServices.forEach((serviceId) => {
      tags.push({ type: "service", value: serviceId, label: taxonomyLabelMap.get(serviceId) ?? serviceId })
    })

    if (selectedCity) {
      tags.push({ type: "city", value: selectedCity, label: selectedCity })
    }

    if (keyword.trim()) {
      tags.push({ type: "keyword", value: keyword.trim(), label: `Keyword: "${keyword.trim()}"` })
    }

    return tags
  }, [keyword, selectedCategories, selectedCity, selectedServices, taxonomyLabelMap])

  const handleSortSelect = (option: (typeof sortOptions)[number]) => {
    setSortBy(option)
    setIsSortDropdownOpen(false)
  }

  return (
    <div className="w-full bg-white">
      <div className="px-4 md:px-8">
        <div className="max-w-[1800px] mx-auto py-8">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-foreground">{getPageTitle()}</h4>

            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-2 text-sm text-text-secondary hover:text-foreground"
                onClick={() => setIsSortDropdownOpen((open) => !open)}
              >
                Sort: {sortBy}
                <ChevronDown className="h-4 w-4" />
              </Button>

              {isSortDropdownOpen && (
                <div className="absolute right-0 top-10 z-50 w-48 rounded-md border border-border bg-white shadow-lg">
                  <div className="py-1">
                    {sortOptions.map((option) => (
                      <button
                        key={option}
                        className="block w-full px-4 py-2 text-left text-sm text-foreground hover:bg-surface"
                        onClick={() => handleSortSelect(option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-text-secondary mb-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Updating results…
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span>{error}</span>
              <Button variant="quaternary" size="quaternary" onClick={refetch} className="text-red-700 border-red-200">
                Retry
              </Button>
            </div>
          )}

          {hasActiveFilters() && activeFilterTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {activeFilterTags.map((tag, index) => (
                <button
                  key={`${tag.type}-${tag.value}-${index}`}
                  onClick={() => removeFilter(tag.type, tag.value)}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-surface text-foreground text-sm rounded-full hover:bg-surface transition-colors"
                >
                  {tag.label}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
            {sortedProfessionals.map((professional) => {
              const professionalId = professional.id ?? ""
              const isSaved = professionalId ? savedProfessionalIds.has(professionalId) : false
              const isMutating = professionalId ? mutatingProfessionalIds.has(professionalId) : false

              return (
                <ProfessionalCardComponent
                  key={`${professional.companyId}-${professional.professionalId}`}
                  professional={professional}
                  isSaved={isSaved}
                  isMutating={isMutating}
                  onToggleSave={(prof) => {
                    if (isSaved) {
                      removeProfessional(professionalId)
                    } else {
                      saveProfessional(prof)
                    }
                  }}
                />
              )
            })}
          </div>

          {!isLoading && sortedProfessionals.length === 0 && (
            <div className="text-center text-text-secondary">No professionals match your filters yet. Try adjusting them.</div>
          )}

          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="quaternary" size="quaternary"
                onClick={loadMore}
                disabled={isLoadingMore}
                className="min-w-[140px]"
              >
                {isLoadingMore ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </span>
                ) : (
                  "Load more"
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
