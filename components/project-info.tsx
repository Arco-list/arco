"use client"

import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Heart, Share, ThumbsUp } from "lucide-react"
import { ShareModal } from "./share-modal"
import { useProjectPreview } from "@/contexts/project-preview-context"
import { useSavedProjects } from "@/contexts/saved-projects-context"
import { useProjectLikes } from "@/contexts/project-likes-context"

export function ProjectInfo() {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const { projectId, info, statusBadge, locationLabel, shareImageUrl, shareUrl, likesCount: initialLikesCount, isLiked: initialLiked } =
    useProjectPreview()
  const { savedProjectIds, mutatingProjectIds, saveProject, removeProject } = useSavedProjects()
  const { likedProjectIds, likeCounts, mutatingProjectIds: likeMutatingProjectIds, toggleLike } = useProjectLikes()

  const isSaved = projectId ? savedProjectIds.has(projectId) : false
  const isMutatingSave = projectId ? mutatingProjectIds.has(projectId) : false
  const providerLiked = projectId ? likedProjectIds.has(projectId) : undefined
  const isLiked = providerLiked ?? Boolean(initialLiked)
  const isMutatingLike = projectId ? likeMutatingProjectIds.has(projectId) : false
  const likesCount = projectId ? likeCounts[projectId] ?? initialLikesCount ?? 0 : initialLikesCount ?? 0
  const breadcrumbs = info.breadcrumbs.length > 0 ? info.breadcrumbs : [{ label: "Projects", href: "/projects" }]
  
  // Description truncation logic
  const MAX_CHARS = 200
  const description = info.descriptionPlain || ""
  const shouldTruncate = description.length > MAX_CHARS
  const displayDescription = shouldTruncate && !isDescriptionExpanded 
    ? description.substring(0, MAX_CHARS) + "..."
    : description

  return (
    <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <nav className="text-sm text-gray-500 flex flex-wrap items-center gap-1" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1
              const content = crumb.href ? (
                <Link href={crumb.href} className="hover:text-gray-700 hover:underline">
                  {crumb.label}
                </Link>
              ) : (
                <span>{crumb.label}</span>
              )

              return (
                <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                  {content}
                  {!isLast && <span className="text-gray-300">/</span>}
                </span>
              )
            })}
          </nav>

          {/* Action buttons - moved to same row as breadcrumbs */}
          <div className="flex gap-2">
            <Button
              variant={isLiked ? "default" : "tertiary"}
              size="sm"
              onClick={() => {
                if (!projectId) return
                void toggleLike(projectId, { currentCount: likesCount })
              }}
              disabled={!projectId || isMutatingLike}
              aria-pressed={isLiked}
            >
              <ThumbsUp className="w-4 h-4 mr-2" fill={isLiked ? "currentColor" : "none"} />
              {isLiked ? "Liked" : "Like"} • {likesCount}
            </Button>
            <Button variant="tertiary" size="sm" onClick={() => setIsShareModalOpen(true)}>
              <Share className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button
              variant={isSaved ? "default" : "tertiary"}
              size="sm"
              onClick={() => {
                if (!projectId) return
                if (isSaved) {
                  void removeProject(projectId)
                } else {
                  void saveProject(projectId, null)
                }
              }}
              disabled={!projectId || isMutatingSave}
              aria-pressed={isSaved}
            >
              <Heart className="w-4 h-4 mr-2" fill={isSaved ? "currentColor" : "none"} />
              {isSaved ? "Saved" : "Save"}
            </Button>
          </div>
        </div>
      </div>

      {/* Project title and description */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-black">{info.title}</h1>
        {info.subtitle && <h2 className="text-xl text-gray-600">{info.subtitle}</h2>}
        {(info.sponsoredLabel || locationLabel) && (
          <p className="text-sm text-gray-500">
            {[info.sponsoredLabel, locationLabel].filter(Boolean).join(" • ")}
          </p>
        )}

        {description && (
          <p className="text-gray-700 leading-relaxed">{displayDescription}</p>
        )}

        {shouldTruncate && (
          <Button 
            variant="link" 
            className="p-0 text-red-600 hover:text-red-700"
            onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
          >
            {isDescriptionExpanded ? "Show less" : "Show more"}
          </Button>
        )}
      </div>

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title={info.title}
        subtitle={info.subtitle ?? ""}
        imageUrl={shareImageUrl ?? "/placeholder.svg?height=64&width=64"}
        shareUrl={typeof window !== "undefined" ? window.location.href : shareUrl ?? ""}
      />
    </div>
  )
}
