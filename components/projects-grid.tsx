"use client"
import { useState } from "react"
import { Heart, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface Project {
  id: number
  title: string
  location: string
  image: string
  likes: number
  isLiked: boolean
  slug?: string
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
  },
  {
    id: 1,
    title: "Modern Garden house in Vinkeveense Plassen",
    location: "Netherlands",
    image: "/placeholder.svg?height=300&width=400",
    likes: 0,
    isLiked: false,
  },
  {
    id: 2,
    title: "Contemporary Villa in Nijmegen",
    location: "Netherlands",
    image: "/placeholder.svg?height=300&width=400",
    likes: 1,
    isLiked: false,
  },
  {
    id: 3,
    title: "Minimalist Apartment in Amsterdam",
    location: "Netherlands",
    image: "/placeholder.svg?height=300&width=400",
    likes: 5,
    isLiked: true,
  },
  {
    id: 4,
    title: "Industrial Loft in Rotterdam",
    location: "Netherlands",
    image: "/placeholder.svg?height=300&width=400",
    likes: 3,
    isLiked: false,
  },
  {
    id: 5,
    title: "Coastal House in Zandvoort",
    location: "Netherlands",
    image: "/placeholder.svg?height=300&width=400",
    likes: 8,
    isLiked: false,
  },
  {
    id: 6,
    title: "Traditional Farmhouse in Utrecht",
    location: "Netherlands",
    image: "/placeholder.svg?height=300&width=400",
    likes: 2,
    isLiked: true,
  },
]

export function ProjectsGrid() {
  const [projects, setProjects] = useState<Project[]>(mockProjects)
  const [sortBy, setSortBy] = useState("Best match")
  const [currentPage, setCurrentPage] = useState(1)
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)

  const projectsPerPage = 6
  const totalPages = Math.ceil(projects.length / projectsPerPage)

  const sortOptions = ["Best match", "Most recent", "Most liked", "Alphabetical"]

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
    return projects.slice(startIndex, endIndex)
  }

  return (
    <div className="w-full bg-white">
      <div className="px-4 md:px-8">
        <div className="max-w-7xl mx-auto py-8">
          {/* Header with title and sort */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-xl font-medium text-gray-900">Projects in all locations</h1>

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

          {/* Projects Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
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
                    className="h-64 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />

                  {/* Heart/Like button */}
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

                {/* Project info */}
                <div className="mt-3 flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-900 line-clamp-2">{project.title}</h3>
                    <p className="text-xs text-gray-500 mt-1">{project.location}</p>
                  </div>
                  <div className="ml-3 flex items-center gap-1 text-sm text-gray-500">
                    <Heart className="h-3 w-3" />
                    <span>{project.likes}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
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
                    currentPage === page ? "bg-black text-white hover:bg-gray-800" : "text-gray-600 hover:text-gray-900"
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
        </div>
      </div>
    </div>
  )
}
