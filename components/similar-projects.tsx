"use client"
import { useMemo, useRef } from "react"
import { ThumbsUp, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useProjectPreview } from "@/contexts/project-preview-context"
import { useProjectLikes } from "@/contexts/project-likes-context"

interface Project {
  id: string
  title: string
  location: string
  image: string
  likes: number
  isLiked: boolean
  href?: string | null
  isMutating?: boolean
}

export function SimilarProjects() {
  const { similarProjects } = useProjectPreview()
  const scrollRef = useRef<HTMLDivElement>(null)
  const { likedProjectIds, likeCounts, mutatingProjectIds, toggleLike } = useProjectLikes()

  const initialProjects = useMemo<Project[]>(() => {
    if (!similarProjects || similarProjects.length === 0) {
      return []
    }

    return similarProjects.map((project) => ({
      id: project.id,
      title: project.title,
      location: project.location ?? "",
      image: project.imageUrl ?? "/placeholder.svg?height=300&width=400",
      likes: project.likes ?? 0,
      isLiked: project.isLiked ?? false,
      href: project.href ?? null,
    }))
  }, [similarProjects])

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

  if (initialProjects.length === 0) {
    return null
  }

  const projects = initialProjects.map((project) => {
    const likes = likeCounts[project.id] ?? project.likes
    const isLiked = likedProjectIds.has(project.id)
    const isMutating = mutatingProjectIds.has(project.id)
    return { ...project, likes, isLiked, isMutating }
  })

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
            href={project.href ?? "#"}
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
                  void toggleLike(project.id, { currentCount: project.likes })
                }}
                disabled={project.isMutating}
                className="absolute top-3 right-3 p-2 rounded-full bg-white/80 hover:bg-white transition-colors"
              >
                <ThumbsUp
                  className={`h-4 w-4 ${
                    project.isLiked ? "fill-blue-600 text-blue-600" : "text-gray-600 hover:text-blue-600"
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
                <ThumbsUp className="h-3 w-3" />
                <span>{project.likes}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
