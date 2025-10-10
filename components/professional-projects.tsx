"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import type { ProfessionalProjectSummary } from "@/lib/professionals/types"
import { Button } from "@/components/ui/button"

const PLACEHOLDER_IMAGE = "/placeholder.svg?height=300&width=400"

type ProfessionalProjectsProps = {
  projects: ProfessionalProjectSummary[]
}

const formatProjectLocation = (project: ProfessionalProjectSummary) => {
  if (project.location && project.projectYear) {
    return `${project.location} • ${project.projectYear}`
  }

  if (project.location) {
    return project.location
  }

  if (project.projectYear) {
    return `${project.projectYear}`
  }

  return null
}

const resolveProjectHref = (project: ProfessionalProjectSummary) => {
  if (project.slug) {
    return `/projects/${project.slug}`
  }

  return `/projects/${project.id}`
}

export function ProfessionalProjects({ projects }: ProfessionalProjectsProps) {
  const [visibleCount, setVisibleCount] = useState(6)

  const displayedProjects = useMemo(() => projects.slice(0, visibleCount), [projects, visibleCount])
  const hasMore = visibleCount < projects.length

  if (projects.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
        Projects by this professional will appear here once they go live.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-black">{projects.length} project{projects.length === 1 ? "" : "s"}</h2>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {displayedProjects.map((project) => {
          const href = resolveProjectHref(project)
          const locationLabel = formatProjectLocation(project)

          return (
            <Link key={project.id} href={href} className="group block">
              <div className="mb-3 overflow-hidden rounded-lg bg-gray-100">
                <img
                  src={project.image || PLACEHOLDER_IMAGE}
                  alt={project.title}
                  className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(event) => {
                    event.currentTarget.onerror = null
                    event.currentTarget.src = PLACEHOLDER_IMAGE
                  }}
                />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">{project.title}</h3>
              {locationLabel ? <p className="text-xs text-gray-500">{locationLabel}</p> : null}
            </Link>
          )
        })}
      </div>

      {hasMore ? (
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={() => setVisibleCount((previous) => Math.min(previous + 6, projects.length))}>
            Load more projects
          </Button>
        </div>
      ) : null}
    </div>
  )
}
