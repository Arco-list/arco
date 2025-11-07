"use client"
import { useMemo, useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { ProjectCard, type ProjectCardData } from "@/components/project-card"
import { useProjectPreview } from "@/contexts/project-preview-context"
import { useProjectLikes } from "@/contexts/project-likes-context"
import { useSavedProjects } from "@/contexts/saved-projects-context"

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

  const initialProjects = useMemo<ProjectCardData[]>(() => {
    if (!similarProjects || similarProjects.length === 0) {
      return []
    }

    return similarProjects.map((project) => ({
      id: project.id,
      title: project.title,
      slug: project.slug ?? null,
      imageUrl: project.imageUrl ?? "/placeholder.svg?height=300&width=400",
      likes: project.likes ?? 0,
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

  return (
    <div className="space-y-6" data-section="similar-projects">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-black">Similar projects</h2>
        <div className="hidden md:flex gap-2">
          <button
            onClick={scrollLeft}
            className="p-2 rounded-full border border-border hover:bg-surface transition-colors"
            aria-label="Previous projects"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={scrollRight}
            className="p-2 rounded-full border border-border hover:bg-surface transition-colors"
            aria-label="Next projects"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-4"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {initialProjects.map((project) => {
          const isSaved = savedProjectIds.has(project.id)
          const isMutatingSave = savedMutatingProjectIds.has(project.id)
          const isLiked = likedProjectIds.has(project.id)
          const isMutatingLike = likeMutatingProjectIds.has(project.id)
          const likesCount = likeCounts[project.id] ?? project.likes ?? 0

          return (
            <div key={project.id} className="flex-shrink-0 w-80">
              <ProjectCard
                project={project}
                isSaved={isSaved}
                isLiked={isLiked}
                isMutatingSave={isMutatingSave}
                isMutatingLike={isMutatingLike}
                likesCount={likesCount}
                onToggleSave={(proj) => {
                  if (isSaved) {
                    void removeProject(proj.id)
                  } else {
                    void saveProject(proj.id)
                  }
                }}
                onToggleLike={(id, count) => void toggleLike(id, { currentCount: count })}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
