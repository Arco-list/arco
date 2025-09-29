"use client"
import { useState, useMemo } from "react"
import { Heart, ChevronDown, ChevronLeft, ChevronRight, X, ThumbsUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useFilters } from "@/contexts/filter-context"

interface Project {
  id: number
  title: string
  location: string
  image: string
  likes: number
  isLiked: boolean
  slug?: string
  type: string
  style: string[]
  features: string[]
}

const mockProjects: Project[] = [
  {
    id: 0,
    title: "Villa upgrade",
    location: "Contemporary Villa in Nijmegen",
    image: "/placeholder.svg?height=300&width=400",
    likes: 12,
    isLiked: false,
    slug: "villa-upgrade",
    type: "Villa",
    style: ["Contemporary", "Modern"],
    features: ["Swimming Pool", "Garden", "Garage"],
  },
  {
    id: 1,
    title: "Modern Garden house in Vinkeveense Plassen",
    location: "Netherlands",
    image: "/placeholder.svg?height=300&width=400",
    likes: 0,
    isLiked: false,
    type: "House",
    style: ["Modern", "Rustic"],
    features: ["Garden", "Terrace"],
  },
  {
    id: 2,
    title: "Contemporary Villa in Nijmegen",
    location: "Netherlands",
    image: "/placeholder.svg?height=300&width=400",
    likes: 1,
    isLiked: false,
    type: "Villa",
    style: ["Contemporary"],
    features: ["Swimming Pool", "Modern Kitchen"],
  },
  {
    id: 3,
    title: "Minimalist Apartment in Amsterdam",
    location: "Netherlands",
    image: "/placeholder.svg?height=300&width=400",
    likes: 5,
    isLiked: true,
    type: "Apartment",
    style: ["Minimalist", "Modern"],
    features: ["Balcony", "City View"],
  },
  {
    id: 4,
    title: "Industrial Loft in Rotterdam",
    location: "Netherlands",
    image: "/placeholder.svg?height=300&width=400",
    likes: 3,
    isLiked: false,
    type: "Loft",
    style: ["Industrial"],
    features: ["High Ceilings", "Exposed Brick"],
  },
  {
    id: 5,
    title: "Coastal House in Zandvoort",
    location: "Netherlands",
    image: "/placeholder.svg?height=300&width=400",
    likes: 8,
    isLiked: false,
    type: "House",
    style: ["Beach", "Coastal"],
    features: ["Ocean View", "Deck"],
  },
  {
    id: 6,
    title: "Traditional Farmhouse in Utrecht",
    location: "Netherlands",
    image: "/placeholder.svg?height=300&width=400",
    likes: 2,
    isLiked: true,
    type: "Farmhouse",
    style: ["Traditional", "Rustic"],
    features: ["Large Garden", "Barn"],
  },
]

export function ProjectsGrid() {
  const { selectedTypes, selectedStyles, selectedLocation, selectedFeatures, removeFilter, hasActiveFilters } =
    useFilters()

  const [projects, setProjects] = useState<Project[]>(mockProjects)
  const [sortBy, setSortBy] = useState("Best match")
  const [currentPage, setCurrentPage] = useState(1)
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)

  const projectsPerPage = 6
  const sortOptions = ["Best match", "Most recent", "Most liked", "Alphabetical"]

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      // Filter by type
      if (
        selectedTypes.length > 0 &&
        !selectedTypes.some((type) => project.type.toLowerCase().includes(type.toLowerCase()))
      ) {
        return false
      }

      // Filter by style
      if (
        selectedStyles.length > 0 &&
        !selectedStyles.some((style) => project.style.some((s) => s.toLowerCase().includes(style.toLowerCase())))
      ) {
        return false
      }

      // Filter by location
      if (selectedLocation && !project.location.toLowerCase().includes(selectedLocation.toLowerCase())) {
        return false
      }

      // Filter by features
      if (
        selectedFeatures.length > 0 &&
        !selectedFeatures.some((feature) =>
          project.features.some((f) => f.toLowerCase().includes(feature.toLowerCase())),
        )
      ) {
        return false
      }

      return true
    })
  }, [projects, selectedTypes, selectedStyles, selectedLocation, selectedFeatures])

  const getPageTitle = () => {
    if (selectedTypes.length > 0) {
      const primaryType = selectedTypes[0]
      const pluralType = primaryType.endsWith("s") ? primaryType : `${primaryType}s`

      // Include style in the title if selected
      if (selectedStyles.length > 0) {
        const primaryStyle = selectedStyles[0]
        return selectedLocation
          ? `${primaryStyle} ${pluralType} in ${selectedLocation}`
          : `${primaryStyle} ${pluralType} in all locations`
      }

      return selectedLocation ? `${pluralType} in ${selectedLocation}` : `${pluralType} in all locations`
    }
    return selectedLocation ? `Projects in ${selectedLocation}` : "Projects in all locations"
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

  const totalPages = Math.ceil(filteredProjects.length / projectsPerPage)

  const toggleLike = (projectId: number) => {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId
          ? {
              ...project,
              isLiked: !project.isLiked,
              likes: project.isLiked ? project.likes - 1 : project.likes + 1,
            }
          : project,
      ),
    )
  }

  const handleSort = (option: string) => {
    setSortBy(option)
    setIsSortDropdownOpen(false)

    const sorted = [...projects].sort((a, b) => {
      switch (option) {
        case "Most recent":
          return b.id - a.id
        case "Most liked":
          return b.likes - a.likes
        case "Alphabetical":
          return a.title.localeCompare(b.title)
        default:
          return 0
      }
    })

    setProjects(sorted)
  }

  const getCurrentPageProjects = () => {
    const startIndex = (currentPage - 1) * projectsPerPage
    const endIndex = startIndex + projectsPerPage
    return filteredProjects.slice(startIndex, endIndex)
  }

  const activeFilterTags = getActiveFilterTags()

  return (
    <div className="w-full bg-white">
      <div className="px-4 md:px-8">
        <div className="max-w-7xl mx-auto py-8">
          {/* Header with dynamic title and sort */}
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

          {/* Projects Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {getCurrentPageProjects().map((project) => (
              <Link
                key={project.id}
                href={project.slug ? `/projects/${project.slug}` : "#"}
                className="group cursor-pointer"
              >
                <div className="relative overflow-hidden rounded-lg bg-gray-100">
                  <img
                    src={project.image || "/placeholder.svg"}
                    alt={project.title}
                    className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      toggleLike(project.id)
                    }}
                    className="absolute top-3 right-3 p-2 rounded-full bg-white/80 hover:bg-white transition-colors"
                  >
                    <Heart
                      className={`h-4 w-4 ${
                        project.isLiked ? "fill-red-500 text-red-500" : "text-gray-600 hover:text-red-500"
                      }`}
                    />
                  </button>
                </div>

                <div className="mt-3">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-medium text-gray-900 line-clamp-2 flex-1">{project.title}</h3>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <ThumbsUp className="h-3 w-3" />
                      <span>{project.likes}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Show message if no projects found */}
          {filteredProjects.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No projects found matching your filters.</p>
            </div>
          )}

          {/* Pagination */}
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
