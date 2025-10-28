"use client"

import { Heart, ChevronLeft, ChevronRight, ThumbsUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useRef } from "react"
import { useSavedProjects } from "@/contexts/saved-projects-context"
import { useProjectLikes } from "@/contexts/project-likes-context"
import { textButtonStyles } from "@/lib/utils"

const FALLBACK_IMAGE = "/placeholder.svg?height=300&width=300"

export interface PopularProjectCard {
  id: string
  title: string
  href: string
  imageUrl: string | null
  likes?: number | null
}

interface PopularProjectsProps {
  projects: PopularProjectCard[]
}

export function PopularProjects({ projects }: PopularProjectsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const {
    savedProjectIds,
    mutatingProjectIds: savedMutatingProjectIds,
    saveProject,
    removeProject,
  } = useSavedProjects()
  const {
    likedProjectIds,
    mutatingProjectIds: likeMutatingProjectIds,
    likeCounts,
    toggleLike,
  } = useProjectLikes()

  if (projects.length === 0) {
    return null
  }

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -400, behavior: "smooth" })
    }
  }

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 400, behavior: "smooth" })
    }
  }

  return (
    <section className="py-10 px-4 md:px-8">
      <div className="max-w-[1800px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-semibold text-gray-900">Popular projects</h2>
          <div className="hidden md:flex items-center gap-2">
            <Link href="/projects" className={textButtonStyles}>
              View all
            </Link>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="w-10 h-10 p-0 bg-transparent rounded-full flex items-center justify-center" onClick={scrollLeft}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" className="w-10 h-10 p-0 bg-transparent rounded-full flex items-center justify-center" onClick={scrollRight}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 mb-8"
          style={{ scrollSnapType: "x mandatory" }}
        >
        {projects.map((project) => {
          const projectId = project.id ?? ""
          const isSaved = projectId ? savedProjectIds.has(projectId) : false
          const isMutatingSave = projectId ? savedMutatingProjectIds.has(projectId) : false
          const isLiked = projectId ? likedProjectIds.has(projectId) : false
          const isMutatingLike = projectId ? likeMutatingProjectIds.has(projectId) : false
          const likesCount = projectId ? likeCounts[projectId] ?? project.likes ?? 0 : project.likes ?? 0

          return (
            <Link
              key={project.id}
              href={project.href}
              className="group cursor-pointer flex-none w-80 sm:w-72 md:w-60 lg:w-64 xl:w-72"
              style={{ scrollSnapAlign: "start" }}
            >
              <div className="relative aspect-square rounded-lg overflow-hidden mb-3">
                <img
                  src={project.imageUrl || FALLBACK_IMAGE}
                  alt={project.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <button
                  onClick={(event) => {
                    event.preventDefault()
                    if (!projectId) return
                    if (isSaved) {
                      void removeProject(projectId)
                    } else {
                      void saveProject(projectId, { id: projectId, title: project.title, href: project.href, imageUrl: project.imageUrl, likes: project.likes })
                    }
                  }}
                  disabled={!projectId || isMutatingSave}
                  aria-pressed={isSaved}
                  aria-label={isSaved ? "Remove from saved projects" : "Save project"}
                  className="absolute top-3 right-3 p-1.5 text-gray-600 hover:text-red-500 transition-all duration-200"
                >
                  <Heart
                    className={`h-6 w-6 ${isSaved ? "text-red-500 fill-red-500" : "text-gray-600 hover:text-red-500"}`}
                    fill={isSaved ? "currentColor" : "none"}
                  />
                </button>
              </div>
              <div className="mt-3">
                <div className="flex items-start gap-2 mb-1">
                  <h7 className="text-gray-900 line-clamp-2 flex-1">
                    {project.title}
                  </h7>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault()
                      if (!projectId) return
                      void toggleLike(projectId, { currentCount: likesCount })
                    }}
                    disabled={!projectId || isMutatingLike}
                    aria-pressed={isLiked}
                    aria-label={isLiked ? "Unlike project" : "Like project"}
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-70 flex-shrink-0"
                  >
                    <ThumbsUp
                      className={`h-3 w-3 ${isLiked ? "text-blue-600 fill-blue-600" : ""}`}
                      fill={isLiked ? "currentColor" : "none"}
                    />
                    <span>{likesCount}</span>
                  </button>
                </div>
              </div>
            </Link>
          )
        })}
        </div>
      </div>
    </section>
  )
}
