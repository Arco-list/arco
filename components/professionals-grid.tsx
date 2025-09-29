"use client"

import { useState, useMemo } from "react"
import { Heart, ChevronDown, ChevronLeft, ChevronRight, X, Star, ThumbsUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useFilters } from "@/contexts/filter-context"

interface Professional {
  id: string
  name: string
  profession: string
  location: string
  rating: number
  reviewCount: number
  image: string
  specialties: string[]
  isLiked: boolean
  likes: number
}

const professionals: Professional[] = [
  {
    id: "marco-van-veldhuizen",
    name: "Marco van Veldhuizen",
    profession: "Architect",
    location: "Amsterdam",
    rating: 4.92,
    reviewCount: 24,
    image: "/placeholder.svg?height=300&width=300",
    specialties: ["Modern Architecture", "Sustainable Design"],
    isLiked: false,
    likes: 15,
  },
  {
    id: "fx-domotica",
    name: "FX Domotica",
    profession: "Home Automation Specialist",
    location: "Amsterdam",
    rating: 4.8,
    reviewCount: 18,
    image: "/placeholder.svg?height=300&width=300",
    specialties: ["Smart Home", "Automation Systems"],
    isLiked: true,
    likes: 8,
  },
  {
    id: "sarah-interior",
    name: "Sarah Interior Design",
    profession: "Interior Designer",
    location: "Utrecht",
    rating: 4.95,
    reviewCount: 32,
    image: "/placeholder.svg?height=300&width=300",
    specialties: ["Luxury Interiors", "Color Consulting"],
    isLiked: false,
    likes: 22,
  },
  {
    id: "green-landscapes",
    name: "Green Landscapes",
    profession: "Landscape Architect",
    location: "Rotterdam",
    rating: 4.7,
    reviewCount: 15,
    image: "/placeholder.svg?height=300&width=300",
    specialties: ["Garden Design", "Outdoor Spaces"],
    isLiked: false,
    likes: 5,
  },
  {
    id: "build-masters",
    name: "Build Masters",
    profession: "General Contractor",
    location: "The Hague",
    rating: 4.85,
    reviewCount: 28,
    image: "/placeholder.svg?height=300&width=300",
    specialties: ["Renovations", "New Construction"],
    isLiked: true,
    likes: 12,
  },
  {
    id: "light-solutions",
    name: "Light Solutions",
    profession: "Lighting Designer",
    location: "Eindhoven",
    rating: 4.9,
    reviewCount: 21,
    image: "/placeholder.svg?height=300&width=300",
    specialties: ["Architectural Lighting", "Smart Lighting"],
    isLiked: false,
    likes: 9,
  },
]

export function ProfessionalsGrid() {
  const { selectedTypes, selectedStyles, selectedLocation, selectedFeatures, removeFilter, hasActiveFilters } =
    useFilters()

  const [professionalsState, setProfessionalsState] = useState<Professional[]>(professionals)
  const [sortBy, setSortBy] = useState("Best match")
  const [currentPage, setCurrentPage] = useState(1)
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)

  const professionalsPerPage = 8
  const sortOptions = ["Best match", "Most recent", "Highest rated", "Most liked", "Alphabetical"]

  const filteredProfessionals = useMemo(() => {
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

      return true
    })
  }, [professionalsState, selectedTypes, selectedStyles, selectedLocation, selectedFeatures])

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

    return tags
  }

  const totalPages = Math.ceil(filteredProfessionals.length / professionalsPerPage)

  const toggleLike = (professionalId: string) => {
    setProfessionalsState((prev) =>
      prev.map((professional) =>
        professional.id === professionalId
          ? {
              ...professional,
              isLiked: !professional.isLiked,
              likes: professional.isLiked ? professional.likes - 1 : professional.likes + 1,
            }
          : professional,
      ),
    )
  }

  const handleSort = (option: string) => {
    setSortBy(option)
    setIsSortDropdownOpen(false)

    const sorted = [...professionalsState].sort((a, b) => {
      switch (option) {
        case "Most recent":
          return b.name.localeCompare(a.name) // Placeholder sorting
        case "Highest rated":
          return b.rating - a.rating
        case "Most liked":
          return b.likes - a.likes
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
              <Link key={professional.id} href={`/professionals/${professional.id}`} className="group cursor-pointer">
                <div className="relative overflow-hidden rounded-lg bg-gray-100">
                  <img
                    src={professional.image || "/placeholder.svg"}
                    alt={professional.name}
                    className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      toggleLike(professional.id)
                    }}
                    className="absolute top-3 right-3 p-2 rounded-full bg-white/80 hover:bg-white transition-colors"
                  >
                    <Heart
                      className={`h-4 w-4 ${
                        professional.isLiked ? "fill-red-500 text-red-500" : "text-gray-600 hover:text-red-500"
                      }`}
                    />
                  </button>
                </div>

                <div className="mt-3 flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-900 line-clamp-2">{professional.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">{professional.profession}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs text-gray-600">{professional.rating}</span>
                      <span className="text-xs text-gray-500">({professional.reviewCount})</span>
                    </div>
                  </div>
                  <div className="ml-3 flex items-center gap-1 text-sm text-gray-500">
                    <ThumbsUp className="h-3 w-3" />
                    <span>{professional.likes}</span>
                  </div>
                </div>
              </Link>
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
