"use client"

import { useMemo, useState } from "react"

import type { ProfessionalProjectSummary } from "@/lib/professionals/types"
import { Button } from "@/components/ui/button"
import { ProjectCard } from "@/components/project-card"
import { useSavedProjects } from "@/contexts/saved-projects-context"
import { useProjectLikes } from "@/contexts/project-likes-context"

type ProfessionalProjectsProps = {
  projects: ProfessionalProjectSummary[]
}

export function ProfessionalProjects({ projects }: ProfessionalProjectsProps) {
  const [visibleCount, setVisibleCount] = useState(6)
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

  const displayedProjects = useMemo(() => projects.slice(0, visibleCount), [projects, visibleCount])
  const hasMore = visibleCount < projects.length

  if (projects.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-text-secondary">
        Projects by this professional will appear here once they go live.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-black">{projects.length} project{projects.length === 1 ? "" : "s"}</h2>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {displayedProjects.map((project) => {
          const projectId = project.id
          const isSaved = savedProjectIds.has(projectId)
          const isMutatingSave = savedMutatingProjectIds.has(projectId)
          const isLiked = likedProjectIds.has(projectId)
          const isMutatingLike = likeMutatingProjectIds.has(projectId)
          const likesCount = likeCounts[projectId] ?? project.likesCount ?? 0

          // Build project title in format: [style] [type] in [location]
          const style = project.stylePreferences?.[0] || ""
          const type = project.projectType || ""
          const location = project.location || "Location unavailable"

          const titleParts = []
          if (style) {
            titleParts.push(style)
          }
          if (type) {
            titleParts.push(type)
          }
          titleParts.push(`in ${location}`)
          const formattedTitle = titleParts.join(" ")

          const projectData = {
            id: projectId,
            title: formattedTitle,
            slug: project.slug,
            imageUrl: project.image,
            imageAlt: formattedTitle,
            location: project.location,
            likes: project.likesCount,
          }

          return (
            <ProjectCard
              key={project.id}
              project={projectData}
              isSaved={isSaved}
              isLiked={isLiked}
              isMutatingSave={isMutatingSave}
              isMutatingLike={isMutatingLike}
              likesCount={likesCount}
              onToggleSave={(proj) => {
                if (isSaved) {
                  void removeProject(projectId)
                } else {
                  void saveProject(projectId)
                }
              }}
              onToggleLike={(id, count) => void toggleLike(id, { currentCount: count })}
            />
          )
        })}
      </div>

      {hasMore ? (
        <div className="flex justify-center pt-4">
          <Button variant="quaternary" size="quaternary" onClick={() => setVisibleCount((previous) => Math.min(previous + 6, projects.length))}>
            Load more projects
          </Button>
        </div>
      ) : null}
    </div>
  )
}
