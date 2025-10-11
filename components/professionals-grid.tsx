"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFilters } from "@/contexts/filter-context"
import type { ProfessionalCard } from "@/lib/professionals/types"
import { useSavedProfessionals } from "@/contexts/saved-professionals-context"
import { ProfessionalCard as ProfessionalCardComponent } from "@/components/professional-card"

type ProfessionalWithState = ProfessionalCard

type ProfessionalsGridProps = {
  professionals: ProfessionalCard[]
}

export function ProfessionalsGrid({ professionals }: ProfessionalsGridProps) {
  const {
    selectedTypes,
    selectedStyles,
    selectedLocation,
    selectedFeatures,
    keyword,
    removeFilter,
    hasActiveFilters,
  } = useFilters()

  const [professionalsState, setProfessionalsState] = useState<ProfessionalWithState[]>(professionals)
  const [sortBy, setSortBy] = useState("Best match")
  const [currentPage, setCurrentPage] = useState(1)
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)
  const { savedProfessionalIds, saveProfessional, removeProfessional, mutatingProfessionalIds } =
    useSavedProfessionals()

  useEffect(() => {
    setProfessionalsState(professionals)
    setCurrentPage(1)
  }, [professionals])

  const professionalsPerPage = 8
  const sortOptions = ["Best match", "Most recent", "Highest rated", "Alphabetical"]

  const filteredProfessionals = useMemo(() => {
    const trimmedKeyword = keyword.trim().toLowerCase()
    return professionalsState.filter((professional) => {
      // Filter by type (profession)
      if (
        selectedTypes.length > 0 &&
        !selectedTypes.some((type) => professional.profession.toLowerCase().includes(type.toLowerCase()))
      ) {
        return false
      }

      // Filter by style (specialties)
      if (
        selectedStyles.length > 0 &&
        !selectedStyles.some((style) =>
          professional.specialties.some((s) => s.toLowerCase().includes(style.toLowerCase())),
        )
      ) {
        return false
      }

      // Filter by location
      if (selectedLocation && !professional.location.toLowerCase().includes(selectedLocation.toLowerCase())) {
        return false
      }

      // Filter by features (specialties)
      if (
        selectedFeatures.length > 0 &&
        !selectedFeatures.some((feature) =>
          professional.specialties.some((s) => s.toLowerCase().includes(feature.toLowerCase())),
        )
      ) {
        return false
      }

      if (trimmedKeyword.length > 0) {
        const searchable = [
          professional.name,
          professional.profession,
          professional.location,
          ...professional.specialties,
        ]
        const matchesKeyword = searchable.some((value) => value.toLowerCase().includes(trimmedKeyword))
        if (!matchesKeyword) {
          return false
        }
      }

      return true
    })
  }, [keyword, professionalsState, selectedTypes, selectedStyles, selectedLocation, selectedFeatures])

  const getPageTitle = () => {
    if (selectedTypes.length > 0) {
      const primaryType = selectedTypes[0]
      const pluralType = primaryType.endsWith("s") ? primaryType : `${primaryType}s`

      return selectedLocation ? `${pluralType} in ${selectedLocation}` : `${pluralType} in all locations`
    }
    return selectedLocation ? `Professionals in ${selectedLocation}` : "Professionals in all locations"
  }

  const getActiveFilterTags = () => {
    const tags: Array<{ type: string; value: string; label: string }> = []

    selectedTypes.forEach((type) => {
      tags.push({ type: "type", value: type, label: `Type: ${type}` })
    })

    selectedStyles.forEach((style) => {
      tags.push({ type: "style", value: style, label: style })
    })

    if (selectedLocation) {
      tags.push({ type: "location", value: selectedLocation, label: selectedLocation })
    }

    selectedFeatures.forEach((feature) => {
      tags.push({ type: "feature", value: feature, label: feature })
    })

    if (keyword.trim()) {
      tags.push({ type: "keyword", value: keyword.trim(), label: `Keyword: “${keyword.trim()}”` })
    }

    return tags
  }

  const totalPages = Math.max(1, Math.ceil(filteredProfessionals.length / professionalsPerPage))

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const handleSort = (option: string) => {
    setSortBy(option)
    setIsSortDropdownOpen(false)

    const sorted = [...professionalsState].sort((a, b) => {
      switch (option) {
        case "Most recent":
          return b.name.localeCompare(a.name) // Placeholder sorting
        case "Highest rated":
          return b.rating - a.rating
        case "Alphabetical":
          return a.name.localeCompare(b.name)
        default:
          return 0
      }
    })

    setProfessionalsState(sorted)
  }

  const getCurrentPageProfessionals = () => {
    const startIndex = (currentPage - 1) * professionalsPerPage
    const endIndex = startIndex + professionalsPerPage
    return filteredProfessionals.slice(startIndex, endIndex)
  }

  const activeFilterTags = getActiveFilterTags()

  return (
    <div className="w-full bg-white">
      <div className="px-4 md:px-8">
        <div className="max-w-7xl mx-auto py-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-medium text-gray-900">{getPageTitle()}</h1>

            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
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
                        onClick={() => handleSort(option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {activeFilterTags.length > 0 && (
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {getCurrentPageProfessionals().map((professional) => (
              <ProfessionalCardComponent
                key={professional.id}
                professional={professional}
                isSaved={savedProfessionalIds.has(professional.id)}
                isMutating={mutatingProfessionalIds.has(professional.id)}
                onToggleSave={(card) => {
                  const isSaved = savedProfessionalIds.has(card.id)
                  if (isSaved) {
                    void removeProfessional(card.id)
                  } else {
                    void saveProfessional(card)
                  }
                }}
              />
            ))}
          </div>

          {/* Show message if no professionals found */}
          {filteredProfessionals.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No professionals found matching your filters.</p>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Previous
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 p-0 text-sm ${
                      currentPage === page
                        ? "bg-black text-white hover:bg-gray-800"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {page}
                  </Button>
                ))}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Next
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
