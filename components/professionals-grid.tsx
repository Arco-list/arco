"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ProfessionalCard as ProfessionalCardComponent } from "@/components/professional-card"
import { useProfessionalFilters } from "@/contexts/professional-filter-context"
import { useSavedProfessionals } from "@/contexts/saved-professionals-context"
import type { ProfessionalCard } from "@/lib/professionals/types"
import { useProfessionalsQuery } from "@/hooks/use-professionals-query"

type ProfessionalsGridProps = {
  professionals: ProfessionalCard[]
}

const sortOptions = ["Best match", "Most recent", "Highest rated", "Alphabetical"] as const

export function ProfessionalsGrid({ professionals }: ProfessionalsGridProps) {
  const {
    selectedCategories,
    selectedServices,
    selectedCountry,
    selectedState,
    selectedCity,
    keyword,
    removeFilter,
    hasActiveFilters,
    taxonomyLabelMap,
  } = useProfessionalFilters()

  const { savedProfessionalIds, saveProfessional, removeProfessional, mutatingProfessionalIds } =
    useSavedProfessionals()

  const { professionals: queryProfessionals, isLoading, error, refetch } = useProfessionalsQuery(professionals)

  const [sortBy, setSortBy] = useState<(typeof sortOptions)[number]>("Best match")
  const [currentPage, setCurrentPage] = useState(1)
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCategories, selectedServices, selectedCountry, selectedState, selectedCity, keyword])

  const professionalsPerPage = 8

  const filteredProfessionals = useMemo(() => queryProfessionals, [queryProfessionals])

  const sortedProfessionals = useMemo(() => {
    const next = [...filteredProfessionals]
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
  }, [filteredProfessionals, sortBy])

  const totalPages = Math.max(1, Math.ceil(sortedProfessionals.length / professionalsPerPage))

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const currentPageProfessionals = useMemo(() => {
    const startIndex = (currentPage - 1) * professionalsPerPage
    const endIndex = startIndex + professionalsPerPage
    return sortedProfessionals.slice(startIndex, endIndex)
  }, [currentPage, sortedProfessionals])

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

      const locationPart = selectedCountry ?? "all locations"
      return `${categoryPart} in ${locationPart}`
    }

    if (selectedCountry) {
      return `Professionals in ${selectedCountry}`
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

    if (selectedCountry) {
      tags.push({ type: "country", value: selectedCountry, label: selectedCountry })
    }

    if (selectedState) {
      tags.push({ type: "state", value: selectedState, label: selectedState })
    }

    if (selectedCity) {
      tags.push({ type: "city", value: selectedCity, label: selectedCity })
    }

    if (keyword.trim()) {
      tags.push({ type: "keyword", value: keyword.trim(), label: `Keyword: “${keyword.trim()}”` })
    }

    return tags
  }, [keyword, selectedCategories, selectedCity, selectedCountry, selectedServices, selectedState, taxonomyLabelMap])

  const handleSortSelect = (option: (typeof sortOptions)[number]) => {
    setSortBy(option)
    setIsSortDropdownOpen(false)
  }

  return (
    <div className="w-full bg-white">
      <div className="px-4 md:px-8">
        <div className="max-w-[1800px] mx-auto py-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-medium text-gray-900">{getPageTitle()}</h1>

            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                onClick={() => setIsSortDropdownOpen((open) => !open)}
              >
                Sort: {sortBy}
                <ChevronDown className="h-4 w-4" />
              </Button>

              {isSortDropdownOpen && (
                <div className="absolute right-0 top-10 z-50 w-48 rounded-md border border-gray-200 bg-white shadow-lg">
                  <div className="py-1">
                    {sortOptions.map((option) => (
                      <button
                        key={option}
                        className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
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
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Updating results…
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={refetch} className="text-red-700 border-red-200">
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
                  className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full hover:bg-gray-200 transition-colors"
                >
                  {tag.label}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6 mb-8">
            {currentPageProfessionals.map((professional) => {
              const professionalId = professional.id ?? ""
              const isSaved = professionalId ? savedProfessionalIds.has(professionalId) : false
              const isMutating = professionalId ? mutatingProfessionalIds.has(professionalId) : false

              return (
                <ProfessionalCardComponent
                  key={professional.id}
                  professional={professional}
                  isSaved={isSaved}
                  isSaving={isMutating}
                  onSave={() => saveProfessional(professional)}
                  onRemove={() => removeProfessional(professionalId)}
                />
              )
            })}
          </div>

          {!isLoading && sortedProfessionals.length === 0 && (
            <div className="text-center text-gray-500">No professionals match your filters yet. Try adjusting them.</div>
          )}

          {sortedProfessionals.length > professionalsPerPage && (
            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
              <div className="text-sm text-gray-500">
                Page {currentPage} of {totalPages}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
