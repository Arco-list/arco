"use client"
import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight, ChevronLeft, X } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { ProjectCard } from "@/components/project-card"
import { useFilters } from "@/contexts/filter-context"
import { useProjectsQuery } from "@/hooks/use-projects-query"

const sortOptions = ["Most recent", "Most liked", "Alphabetical"] as const

type SortOption = (typeof sortOptions)[number]

type ProjectSummaryRow = {
  id: string
  slug: string | null
  title: string
  location: string | null
  likes_count: number | null
  primary_photo_url: string | null
  created_at: string | null
  professional_name?: string | null
  professional_slug?: string | null
  photos?: Array<{ url: string; alt?: string | null }>
  [key: string]: unknown
}

export function ProjectsGrid({ initialProjects = [] }: { initialProjects?: ProjectSummaryRow[] }) {
  const filterContext = useFilters()
  const { removeFilter } = filterContext
  const { projects, isLoading, error, hasMore, loadMore, typePhotoOverrides } = useProjectsQuery({
    pageSize: 12,
    initialProjects
  })

  const [sortBy, setSortBy] = useState<SortOption>("Most recent")
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)
  const [currentPhotoIndexes, setCurrentPhotoIndexes] = useState<Record<string, number>>({})

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
      tags.push({ type: "keyword", value: filterContext.keyword.trim(), label: `Keyword: "${filterContext.keyword.trim()}"` })
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

  const navigatePhoto = (projectId: string, direction: 'prev' | 'next', totalPhotos: number) => {
    setCurrentPhotoIndexes(prev => {
      const currentIndex = prev[projectId] ?? 0
      const newIndex = direction === 'next' 
        ? (currentIndex + 1) % totalPhotos
        : (currentIndex - 1 + totalPhotos) % totalPhotos
      return { ...prev, [projectId]: newIndex }
    })
  }

  return (
    <div className="projects-container">
      <div className="projects-header">
        <h3 className="arco-h3">{headingText}</h3>

        <div className="relative">
          <button
            className="view-all-link"
            onClick={() => setIsSortDropdownOpen((open) => !open)}
          >
            Sort: {sortBy}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>

          {isSortDropdownOpen && (
            <div className="absolute right-0 top-8 z-50 w-48 rounded-md border border-border bg-white shadow-lg">
              <div className="py-1">
                {sortOptions.map((option) => (
                  <button
                    key={option}
                    className="block w-full px-4 py-2 text-left text-sm text-foreground hover:bg-surface"
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
        <div className="filter-tags">
          {activeFilterTags.map((tag, index) => (
            <button
              key={`${tag.type}-${tag.value}-${index}`}
              onClick={() => removeFilter(tag.type, tag.value)}
              className="filter-tag"
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

      <div className="projects-grid">
        {sortedProjects.map((project) => {
          const projectId = project.id ?? ""
          const currentPhotoIndex = currentPhotoIndexes[projectId] ?? 0
          const projectPhotos = project.photos ?? []
          const hasMultiplePhotos = projectPhotos.length > 1
          
          // Get current photo or fallback to primary
          const currentPhoto = projectPhotos[currentPhotoIndex]
          const imageSrc = currentPhoto?.url ?? project.primary_photo_url ?? "/placeholder.svg"
          const imageAlt = currentPhoto?.alt ?? project.title ?? "Project"

          // Build project title
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

          const professionalName = project.professional_name || "Unknown Architect"
          const professionalSlug = project.professional_slug

          return (
            <Link
              key={project.id}
              href={`/projects/${project.slug}`}
              className="project-card-link"
            >
              <div className="project-image-wrapper">
                <img
                  src={imageSrc}
                  alt={imageAlt}
                  className="project-image"
                />

                {/* Navigation Arrows - Show on hover if multiple photos */}
                {hasMultiplePhotos && (
                  <div className="image-nav-arrows">
                    <button
                      className="nav-arrow"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        navigatePhoto(projectId, 'prev', projectPhotos.length)
                      }}
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      className="nav-arrow"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        navigatePhoto(projectId, 'next', projectPhotos.length)
                      }}
                      aria-label="Next image"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <h3 className="project-title">{projectTitle}</h3>
              <p className="project-subtitle">
                by{" "}
                {professionalSlug ? (
                  <Link
                    href={`/professionals/${professionalSlug}`}
                    className="project-architect"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {professionalName}
                  </Link>
                ) : (
                  <span className="project-architect">{professionalName}</span>
                )}
              </p>
            </Link>
          )
        })}

        {isLoading && (
          <div className="col-span-full flex justify-center py-12">
            <p className="text-sm text-text-secondary">Loading projects…</p>
          </div>
        )}
      </div>

      {!isLoading && sortedProjects.length === 0 && !error && (
        <div className="text-center py-12">
          <p className="text-sm text-text-secondary">No projects found matching your filters.</p>
        </div>
      )}

      {hasMore && (
        <div className="load-more-container">
          <button 
            onClick={loadMore} 
            disabled={isLoading} 
            className="btn-load-more"
          >
            Load more
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
