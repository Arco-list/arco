"use client"

import { useMemo, useState } from "react"
import { ChevronDown } from "lucide-react"
import { useTranslations } from "next-intl"

import type { ProfessionalProjectSummary } from "@/lib/professionals/types"
import { Button } from "@/components/ui/button"
import { ProjectCard } from "@/components/project-card"
import { useSavedProjects } from "@/contexts/saved-projects-context"
import { useProjectLikes } from "@/contexts/project-likes-context"

type ProfessionalProjectsProps = {
  projects: ProfessionalProjectSummary[]
  id?: string
}

const SORT_KEYS = ["most_recent", "most_liked", "alphabetical"] as const
type SortKey = (typeof SORT_KEYS)[number]

export function ProfessionalProjects({ projects, id }: ProfessionalProjectsProps) {
  const t = useTranslations("professional_detail")
  const [visibleCount, setVisibleCount] = useState(12)
  const [sortBy, setSortBy] = useState<SortKey>("most_recent")
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)
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

  const sortLabelMap: Record<SortKey, string> = {
    most_recent: t("sort_most_recent"),
    most_liked: t("sort_most_liked"),
    alphabetical: t("sort_alphabetical"),
  }

  const sortedProjects = useMemo(() => {
    const sorted = [...projects]
    switch (sortBy) {
      case "most_liked":
        return sorted.sort((a, b) => (b.likesCount ?? 0) - (a.likesCount ?? 0))
      case "alphabetical":
        return sorted.sort((a, b) => {
          const aTitle = [a.stylePreferences?.[0], a.projectType].filter(Boolean).join(" ")
          const bTitle = [b.stylePreferences?.[0], b.projectType].filter(Boolean).join(" ")
          return aTitle.localeCompare(bTitle)
        })
      case "most_recent":
      default:
        return sorted
    }
  }, [projects, sortBy])

  const displayedProjects = useMemo(() => sortedProjects.slice(0, visibleCount), [sortedProjects, visibleCount])
  const hasMore = visibleCount < sortedProjects.length

  if (projects.length === 0) {
    return (
      <div id={id} className="w-full bg-white py-8 px-4 md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-lg border border-dashed border-border p-8 text-center body-small text-text-secondary">
            {t("no_projects_yet")}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div id={id} className="w-full bg-white py-8 px-4 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h2 className="heading-4 font-bold text-black">
            {t("projects_heading", { count: projects.length })}
          </h2>
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 body-small text-text-secondary hover:text-foreground"
              onClick={() => setIsSortDropdownOpen((open) => !open)}
            >
              {t("sort_label", { sort: sortLabelMap[sortBy] })}
              <ChevronDown className="h-4 w-4" />
            </Button>

            {isSortDropdownOpen && (
              <div className="absolute right-0 top-10 z-50 w-48 rounded-md border border-border bg-white shadow-lg">
                <div className="py-1">
                  {SORT_KEYS.map((key) => (
                    <button
                      key={key}
                      className="block w-full px-4 py-2 text-left body-small text-foreground hover:bg-surface"
                      onClick={() => {
                        setSortBy(key)
                        setIsSortDropdownOpen(false)
                      }}
                    >
                      {sortLabelMap[key]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
            const location = project.location || t("location")

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
            <Button
              variant="quaternary"
              size="quaternary"
              onClick={() => setVisibleCount((previous) => Math.min(previous + 12, sortedProjects.length))}
            >
              {t("load_more_projects")}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
