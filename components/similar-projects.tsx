"use client"
import { useState, useRef } from "react"
import { Heart, ChevronLeft, ChevronRight } from "lucide-react"
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

export function SimilarProjects() {
  const scrollRef = useRef<HTMLDivElement>(null)

  const [projects, setProjects] = useState<Project[]>([
    {
      id: 1,
      title: "Paradise by the pool",
      location: "Modern Villa in Amsterdam",
      image: "/placeholder.svg?height=300&width=400",
      likes: 24,
      isLiked: false,
    },
    {
      id: 2,
      title: "Villa upgrade",
      location: "Contemporary Villa in Nijmegen",
      image: "/placeholder.svg?height=300&width=400",
      likes: 18,
      isLiked: true,
      slug: "villa-upgrade",
    },
    {
      id: 3,
      title: "Farm transformation",
      location: "Renovated Farmhouse in Utrecht",
      image: "/placeholder.svg?height=300&width=400",
      likes: 31,
      isLiked: false,
    },
    {
      id: 4,
      title: "Villa Mel",
      location: "Luxury Villa in Rotterdam",
      image: "/placeholder.svg?height=300&width=400",
      likes: 42,
      isLiked: false,
    },
    {
      id: 5,
      title: "Wellness retreat",
      location: "Spa House in Zandvoort",
      image: "/placeholder.svg?height=300&width=400",
      likes: 15,
      isLiked: true,
    },
    {
      id: 6,
      title: "Garden house",
      location: "Modern Garden House in Haarlem",
      image: "/placeholder.svg?height=300&width=400",
      likes: 28,
      isLiked: false,
    },
  ])

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

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -320, behavior: "smooth" })
    }
  }

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 320, behavior: "smooth" })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-black">Similar projects</h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={scrollLeft} className="p-2 hover:bg-gray-100 rounded-full">
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </Button>
          <Button variant="ghost" size="sm" onClick={scrollRight} className="p-2 hover:bg-gray-100 rounded-full">
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-6 overflow-x-auto scrollbar-hide pb-4"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {projects.map((project) => (
          <Link
            key={project.id}
            href={project.slug ? `/projects/${project.slug}` : "#"}
            className="group cursor-pointer flex-shrink-0 w-80"
          >
            <div className="relative overflow-hidden rounded-lg bg-gray-100">
              <img
                src={project.image || "/placeholder.svg"}
                alt={project.title}
                className="h-48 w-full object-cover transition-transform duration-300 group-hover:scale-105"
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
    </div>
  )
}
