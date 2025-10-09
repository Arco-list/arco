"use client"
import { useMemo, useRef } from "react"
import { Heart, ThumbsUp, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { useProjectPreview } from "@/contexts/project-preview-context"
import { useProjectLikes } from "@/contexts/project-likes-context"
import { useSavedProjects } from "@/contexts/saved-projects-context"

type BaseProject = {
  id: string
  title: string
  location: string
  image: string
  likes: number
  href?: string | null
}

export function SimilarProjects() {
  const { similarProjects } = useProjectPreview()
  const scrollRef = useRef<HTMLDivElement>(null)
  const { likedProjectIds, likeCounts, mutatingProjectIds: likeMutatingProjectIds, toggleLike } = useProjectLikes()
  const {
    savedProjectIds,
    mutatingProjectIds: savedMutatingProjectIds,
    saveProject,
    removeProject,
  } = useSavedProjects()

  const initialProjects = useMemo<BaseProject[]>(() => {
    if (!similarProjects || similarProjects.length === 0) {
      return []
    }

    return similarProjects.map((project) => ({
      id: project.id,
      title: project.title,
      location: project.location ?? "",
      image: project.imageUrl ?? "/placeholder.svg?height=300&width=400",
      likes: project.likes ?? 0,
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
    const isMutatingLike = likeMutatingProjectIds.has(project.id)
    const isSaved = savedProjectIds.has(project.id)
    const isMutatingSave = savedMutatingProjectIds.has(project.id)

    return {
      ...project,
      likes,
      isLiked,
      isMutatingLike,
      isSaved,
      isMutatingSave,
    }
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
        {projects.map((project) => {
          const href = project.href ?? "#"

          return (
            <Link key={project.id} href={href} className="group cursor-pointer flex-shrink-0 w-80">
              <div className="relative overflow-hidden rounded-lg bg-gray-100">
                <img
                  src={project.image || "/placeholder.svg"}
                  alt={project.title}
                  className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <button
                  onClick={(event) => {
                    event.preventDefault()
                    if (project.isSaved) {
                      void removeProject(project.id)
                    } else {
                      void saveProject(project.id)
                    }
                  }}
                  disabled={project.isMutatingSave}
                  aria-pressed={project.isSaved}
                  aria-label={project.isSaved ? "Remove from saved projects" : "Save project"}
                  className="absolute top-3 right-3 p-2 rounded-full bg-white/80 hover:bg-white transition-colors"
                >
                  <Heart
                    className={`h-4 w-4 ${project.isSaved ? "text-red-500" : "text-gray-600"}`}
                    fill={project.isSaved ? "currentColor" : "none"}
                  />
                </button>
              </div>

              <div className="mt-3">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-medium text-gray-900 line-clamp-2 flex-1">{project.title}</h3>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault()
                      void toggleLike(project.id, { currentCount: project.likes })
                    }}
                    disabled={project.isMutatingLike}
                    aria-pressed={project.isLiked}
                    aria-label={project.isLiked ? "Unlike project" : "Like project"}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-70"
                  >
                    <ThumbsUp
                      className={`h-3 w-3 ${project.isLiked ? "text-blue-600 fill-blue-600" : ""}`}
                      fill={project.isLiked ? "currentColor" : "none"}
                    />
                    <span>{project.likes}</span>
                  </button>
                </div>
                <p className="text-xs text-gray-500 line-clamp-1">{project.location || "Location unavailable"}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
