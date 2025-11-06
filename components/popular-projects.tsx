"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProjectCard } from "@/components/project-card"
import Link from "next/link"
import { useRef } from "react"
import { useSavedProjects } from "@/contexts/saved-projects-context"
import { useProjectLikes } from "@/contexts/project-likes-context"
import { textButtonStyles } from "@/lib/utils"

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
          <h4>Be inspired by amazing projects</h4>
          <div className="hidden md:flex items-center gap-2">
            <Link href="/projects" className={textButtonStyles}>
              View all
            </Link>
            <div className="flex items-center gap-2">
              <Button variant="quaternary" size="quaternary" className="w-10 h-10 p-0 bg-transparent rounded-full flex items-center justify-center" onClick={scrollLeft}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="quaternary" size="quaternary" className="w-10 h-10 p-0 bg-transparent rounded-full flex items-center justify-center" onClick={scrollRight}>
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

          // Extract slug from href (e.g., "/projects/my-project" -> "my-project")
          const slug = project.href.startsWith("/projects/") ? project.href.replace("/projects/", "") : null

          const projectData = {
            id: projectId,
            title: project.title,
            slug,
            imageUrl: project.imageUrl,
            imageAlt: project.title,
            likes: project.likes,
          }

          return (
            <div
              key={project.id}
              className="flex-none w-80 sm:w-72 md:w-60 lg:w-64 xl:w-72"
              style={{ scrollSnapAlign: "start" }}
            >
              <ProjectCard
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
                    void saveProject(projectId, { id: projectId, title: project.title, href: project.href, imageUrl: project.imageUrl, likes: project.likes })
                  }
                }}
                onToggleLike={(id, count) => void toggleLike(id, { currentCount: count })}
              />
            </div>
          )
        })}
        </div>
      </div>
    </section>
  )
}
