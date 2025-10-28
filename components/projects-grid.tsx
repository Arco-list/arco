"use client"
import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ProjectCard } from "@/components/project-card"
import { useFilters } from "@/contexts/filter-context"
import { useProjectsQuery } from "@/hooks/use-projects-query"
import { useSavedProjects } from "@/contexts/saved-projects-context"
import { useProjectLikes } from "@/contexts/project-likes-context"

const sortOptions = ["Most recent", "Most liked", "Alphabetical"] as const

type SortOption = (typeof sortOptions)[number]

export function ProjectsGrid() {
  const filterContext = useFilters()
  const { removeFilter, taxonomy } = filterContext
  const { projects, isLoading, error, hasMore, loadMore, typePhotoOverrides } = useProjectsQuery({ pageSize: 12 })
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

  const [sortBy, setSortBy] = useState<SortOption>("Most recent")
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)

  const sortedProjects = useMemo(() => {
    const next = [...projects]
    switch (sortBy) {
      case "Most liked":
        return next.sort((a, b) => (b.likes_count ?? 0) - (a.likes_count ?? 0))
      case "Alphabetical":
        return next.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""))
      case "Most recent":
      default:
        return next.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
    }
  }, [projects, sortBy])

  const activeFilterTags = useMemo(() => {
    const tags: Array<{ type: string; value: string; label: string }> = []
    filterContext.selectedTypes.forEach((type) =>
      tags.push({ type: "type", value: type, label: `Type: ${filterContext.taxonomyLabelMap.get(type) ?? type}` }),
    )
    filterContext.selectedStyles.forEach((style) =>
      tags.push({ type: "style", value: style, label: filterContext.taxonomyLabelMap.get(style) ?? style }),
    )
    if (filterContext.selectedLocation) {
      tags.push({ type: "location", value: filterContext.selectedLocation, label: filterContext.selectedLocation })
    }
    filterContext.selectedLocationFeatures.forEach((feature) =>
      tags.push({ type: "locationFeature", value: feature, label: filterContext.taxonomyLabelMap.get(feature) ?? feature }),
    )
    filterContext.selectedBuildingFeatures.forEach((feature) =>
      tags.push({ type: "buildingFeature", value: feature, label: filterContext.taxonomyLabelMap.get(feature) ?? feature }),
    )
    filterContext.selectedMaterialFeatures.forEach((feature) =>
      tags.push({ type: "materialFeature", value: feature, label: filterContext.taxonomyLabelMap.get(feature) ?? feature }),
    )
    filterContext.selectedBuildingTypes.forEach((type) =>
      tags.push({ type: "buildingType", value: type, label: `Building: ${filterContext.taxonomyLabelMap.get(type) ?? type}` }),
    )
    filterContext.selectedSizes.forEach((size) =>
      tags.push({ type: "size", value: size, label: `Size: ${filterContext.taxonomyLabelMap.get(size) ?? size}` }),
    )
    filterContext.selectedBudgets.forEach((budget) =>
      tags.push({ type: "budget", value: budget, label: filterContext.taxonomyLabelMap.get(budget) ?? budget }),
    )
    if (filterContext.projectYearRange.some((value) => value !== null)) {
      const [min, max] = filterContext.projectYearRange
      tags.push({ type: "projectYear", value: "projectYear", label: `Project year ≤ ${max ?? "any"}` })
    }
    if (filterContext.buildingYearRange.some((value) => value !== null)) {
      const [min, max] = filterContext.buildingYearRange
      tags.push({ type: "buildingYear", value: "buildingYear", label: `Building year ≤ ${max ?? "any"}` })
    }
    if (filterContext.keyword.trim()) {
      tags.push({ type: "keyword", value: filterContext.keyword.trim(), label: `Keyword: “${filterContext.keyword.trim()}”` })
    }
    return tags
  }, [
    filterContext.buildingYearRange,
    filterContext.projectYearRange,
    filterContext.selectedBuildingFeatures,
    filterContext.selectedBuildingTypes,
    filterContext.selectedBudgets,
    filterContext.selectedLocation,
    filterContext.selectedLocationFeatures,
    filterContext.selectedMaterialFeatures,
    filterContext.selectedSizes,
    filterContext.selectedStyles,
    filterContext.selectedTypes,
    filterContext.taxonomyLabelMap,
    filterContext.keyword,
  ])

  const headingText = useMemo(() => {
    const typeLabels = filterContext.selectedTypes
      .map((type) => filterContext.taxonomyLabelMap.get(type) ?? type)
      .filter(Boolean)

    const typePart = (() => {
      if (typeLabels.length === 0) return "Projects"
      if (typeLabels.length === 1) return typeLabels[0]
      if (typeLabels.length === 2) return `${typeLabels[0]} & ${typeLabels[1]}`
      return `${typeLabels.slice(0, -1).join(", ")} & ${typeLabels[typeLabels.length - 1]}`
    })()

    const locationPart = filterContext.selectedLocation?.trim() || "all locations"

    return `${typePart} in ${locationPart}`
  }, [filterContext.selectedLocation, filterContext.selectedTypes, filterContext.taxonomyLabelMap])

  return (
    <div className="w-full bg-white">
      <div className="px-4 md:px-8">
        <div className="max-w-[1800px] mx-auto py-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-gray-900">
                {headingText}
              </h4>
            </div>

            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                onClick={() => setIsSortDropdownOpen((open) => !open)}
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
                        onClick={() => {
                          setSortBy(option)
                          setIsSortDropdownOpen(false)
                        }}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {activeFilterTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {activeFilterTags.map((tag, index) => (
                <button
                  key={`${tag.type}-${tag.value}-${index}`}
                  onClick={() => removeFilter(tag.type, tag.value)}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full hover:bg-gray-200 transition-colors"
                >
                  {tag.label}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-600 px-4 py-3 mb-6">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
            {sortedProjects.map((project) => {
              const projectId = project.id ?? ""
              const override = projectId ? typePhotoOverrides[projectId] : undefined
              const imageSrc = override?.url ?? project.primary_photo_url ?? "/placeholder.svg"
              const imageAlt =
                override?.alt ??
                project.primary_photo_alt ??
                project.title ??
                filterContext.taxonomyLabelMap.get(project.project_type ?? "") ??
                "Project"
              const isSaved = projectId ? savedProjectIds.has(projectId) : false
              const isMutatingSave = projectId ? savedMutatingProjectIds.has(projectId) : false
              const isLiked = projectId ? likedProjectIds.has(projectId) : false
              const isMutatingLike = projectId ? likeMutatingProjectIds.has(projectId) : false
              const likesCount = projectId ? likeCounts[projectId] ?? project.likes_count ?? 0 : project.likes_count ?? 0

              // Build project title from style, type, and location
              const style = project.style_preferences?.[0] || ""
              const subType = project.project_type || ""
              const location = project.location || "Location unavailable"
              const parts = []
              if (style) {
                const styleLabel = filterContext.taxonomyLabelMap.get(style) || style
                parts.push(styleLabel)
              }
              if (subType) {
                const subTypeLabel = filterContext.taxonomyLabelMap.get(subType) || subType
                parts.push(subTypeLabel)
              }
              parts.push(`in ${location}`)
              const projectTitle = parts.join(" ")

              const projectData = {
                id: projectId,
                title: projectTitle,
                slug: project.slug,
                imageUrl: imageSrc,
                imageAlt,
                location,
                likes: project.likes_count,
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
                      void saveProject(projectId, project)
                    }
                  }}
                  onToggleLike={(id, count) => void toggleLike(id, { currentCount: count })}
                />
              )
            })}

            {isLoading && (
              <div className="col-span-full flex justify-center py-12">
                <p className="text-sm text-gray-500">Loading projects…</p>
              </div>
            )}
          </div>

          {!isLoading && sortedProjects.length === 0 && !error && (
            <div className="text-center py-12">
              <p className="text-gray-500">No projects found matching your filters.</p>
            </div>
          )}

          {hasMore && (
            <div className="flex justify-center">
              <Button onClick={loadMore} disabled={isLoading} variant="ghost" className="flex items-center gap-2">
                Load more
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
