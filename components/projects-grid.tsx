"use client"

import { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { ShareModal } from "@/components/share-modal"

import { useFilters } from "@/contexts/filter-context"
import { useSavedProjects } from "@/contexts/saved-projects-context"
import { useProjectsQuery } from "@/hooks/use-projects-query"
import type { DiscoverProject } from "@/lib/projects/queries"
import type { SortOption } from "@/components/filter-bar"

interface ProjectsGridProps {
  initialProjects: DiscoverProject[]
  sortBy: SortOption
}

export function ProjectsGrid({ initialProjects = [], sortBy }: ProjectsGridProps) {
  const { selectedSpace, selectedTypes, selectedLocations, taxonomyLabelMap } = useFilters()
  const { savedProjectIds, saveProject, removeProject, mutatingProjectIds } = useSavedProjects()
  const { projects, total, isLoading, error, hasMore, loadMore, spacePhotoOverrides } = useProjectsQuery({
    pageSize: 12,
    initialProjects,
  })

  const [currentPhotoIndexes, setCurrentPhotoIndexes] = useState<Record<string, number>>({})

  // ── sort ────────────────────────────────────────────────────────────────────

  const sortedProjects = useMemo<DiscoverProject[]>(() => {
    let next = [...projects] as DiscoverProject[]

    // Note: space filtering is handled server-side in useProjectsQuery

    switch (sortBy) {
      case "Most liked":
        return next.sort((a, b) => (b.likes_count ?? 0) - (a.likes_count ?? 0))
      case "Alphabetical":
        return next.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""))
      default:
        return next.sort(
          (a, b) =>
            new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
        )
    }
  }, [projects, sortBy, selectedSpace, spacePhotoOverrides])

  // ── heading ─────────────────────────────────────────────────────────────────

  const headingText = useMemo(() => {
    const typeLabels = selectedTypes
      .map((id) => taxonomyLabelMap.get(id) ?? id)
      .filter(Boolean)

    const typePart =
      typeLabels.length === 0
        ? "Projects"
        : typeLabels.length === 1
          ? typeLabels[0]
          : typeLabels.length === 2
            ? `${typeLabels[0]} & ${typeLabels[1]}`
            : `${typeLabels.slice(0, -1).join(", ")} & ${typeLabels.at(-1)}`

    const locationPart =
      selectedLocations.length === 0
        ? "the Netherlands"
        : selectedLocations.length === 1
          ? selectedLocations[0]
          : selectedLocations.length === 2
            ? `${selectedLocations[0]} & ${selectedLocations[1]}`
            : `${selectedLocations.slice(0, -1).join(", ")} & ${selectedLocations.at(-1)}`
    return `${typePart} in ${locationPart}`
  }, [selectedTypes, selectedLocations, taxonomyLabelMap])

  // ── photo navigation ─────────────────────────────────────────────────────────

  const navigatePhoto = (projectId: string, direction: "prev" | "next", total: number) => {
    setCurrentPhotoIndexes((prev) => {
      const current = prev[projectId] ?? 0
      const next =
        direction === "next"
          ? (current + 1) % total
          : (current - 1 + total) % total
      return { ...prev, [projectId]: next }
    })
  }

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <div className="discover-results">
      <div className="wrap">

        {/* Result meta */}
        <div className="discover-results-meta">
          <p className="discover-results-count">
            <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>
              {(total > sortedProjects.length ? total : sortedProjects.length).toLocaleString()}
            </strong>{" "}
            {headingText}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#dc2626",
              borderRadius: 4,
              padding: "12px 16px",
              marginBottom: 24,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        {/* Grid */}
        <div className="discover-grid">
          {sortedProjects.map((project) => {
            const pid = project.id ?? ""
            return (
              <ProjectCard
                key={pid || Math.random()}
                project={project}
                selectedSpace={selectedSpace}
                currentPhotoIndex={currentPhotoIndexes[pid] ?? 0}
                onNavigate={(dir, total) => navigatePhoto(pid, dir, total)}
                taxonomyLabelMap={taxonomyLabelMap}
                spacePhotoOverride={pid ? spacePhotoOverrides[pid] : undefined}
                isSaved={pid ? savedProjectIds.has(pid) : false}
                isMutating={pid ? mutatingProjectIds.has(pid) : false}
                onToggleSave={() => {
                  if (!pid) return
                  if (savedProjectIds.has(pid)) removeProject(pid)
                  else saveProject(pid)
                }}
              />
            )
          })}

          {isLoading && (
            <div
              style={{
                gridColumn: "1 / -1",
                display: "flex",
                justifyContent: "center",
                padding: "48px 0",
              }}
            >
              <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>Loading projects…</p>
            </div>
          )}
        </div>

        {!isLoading && sortedProjects.length === 0 && !error && (
          <div style={{ textAlign: "center", padding: "64px 0" }}>
            <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>
              No projects found matching your filters.
            </p>
          </div>
        )}

        {/* Load more */}
        {hasMore && (
          <div className="discover-load-more">
            <button
              className="discover-load-more-btn"
              onClick={loadMore}
              disabled={isLoading}
            >
              Load more
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ProjectCard ───────────────────────────────────────────────────────────────

interface ProjectCardProps {
  project: DiscoverProject
  selectedSpace: string
  currentPhotoIndex: number
  onNavigate: (dir: "prev" | "next", total: number) => void
  taxonomyLabelMap: Map<string, string>
  spacePhotoOverride?: { url: string; alt?: string | null }
  isSaved: boolean
  isMutating: boolean
  onToggleSave: () => void
}

function ProjectCard({
  project,
  selectedSpace,
  currentPhotoIndex,
  onNavigate,
  taxonomyLabelMap,
  spacePhotoOverride,
  isSaved,
  isMutating,
  onToggleSave,
}: ProjectCardProps) {
  const photos = project.photos ?? []
  const hasMultiplePhotos = photos.length > 1

  // Resolve which image to show
  const resolveImage = (): { src: string; alt: string } => {
    if (selectedSpace) {
      // Override from server fetch (for client-side loaded projects without photos array)
      if (spacePhotoOverride) {
        return { src: spacePhotoOverride.url, alt: spacePhotoOverride.alt ?? project.title ?? "" }
      }
      // Match from SSR-loaded photos array
      const match = photos.find((p) => p.space === selectedSpace)
      if (match) return { src: match.url, alt: match.alt ?? project.title ?? "" }
    }
    const current = photos[currentPhotoIndex]
    if (current) return { src: current.url, alt: current.alt ?? project.title ?? "" }
    return {
      src: project.primary_photo_url ?? "/placeholder.svg",
      alt: project.title ?? "Project",
    }
  }

  const [shareOpen, setShareOpen] = useState(false)

  const { src, alt } = resolveImage()

  const projectTypeLabel = project.primary_category
    ? (taxonomyLabelMap.get(project.primary_category) ?? project.primary_category)
    : null

  const subtitleParts = [projectTypeLabel, project.location].filter(Boolean)
  const cardSubtitle = subtitleParts.join(" · ")

  return (
    <>
      <Link
        href={`/projects/${project.slug}`}
        className="discover-card"
      >
        {/* Image */}
        <div className="discover-card-image-wrap">
          <div className="discover-card-image-layer">
            <img key={src} src={src} alt={alt} />
          </div>

          {/* Hover nav arrows */}
          {hasMultiplePhotos && (
            <div className="discover-card-nav-arrows">
              <button
                className="discover-card-nav-arrow"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onNavigate("prev", photos.length)
                }}
                aria-label="Previous image"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                className="discover-card-nav-arrow"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onNavigate("next", photos.length)
                }}
                aria-label="Next image"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          {/* Photo dots indicator */}
          {hasMultiplePhotos && !selectedSpace && (
            <div className="discover-card-dots">
              {photos.map((_, i) => (
                <span key={i} className={`discover-card-dot${i === currentPhotoIndex ? " active" : ""}`} />
              ))}
            </div>
          )}

          {/* Save + Share */}
          <div className="discover-card-actions" data-saved={isSaved}>
            <button
              className="discover-card-action-btn"
              data-saved={isSaved}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSave() }}
              aria-pressed={isSaved}
              aria-label={isSaved ? "Unsave project" : "Save project"}
              disabled={isMutating}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
            </button>
            <button
              className="discover-card-action-btn"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setShareOpen(true)
              }}
              aria-label="Share project"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Text */}
        <h3 className="discover-card-title">{project.title}</h3>
        {cardSubtitle && <p className="discover-card-sub">{cardSubtitle}</p>}
        {project.professional_name && (
          <p className="discover-card-professional">{project.professional_name}</p>
        )}
      </Link>

      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        title={project.title ?? "Project"}
        subtitle={cardSubtitle}
        imageUrl={src}
        shareUrl={`/projects/${project.slug}`}
      />
    </>
  )
}
