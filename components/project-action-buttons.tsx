"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Heart, Share, ThumbsUp } from "lucide-react"
import { ShareModal } from "./share-modal"
import { useProjectPreview } from "@/contexts/project-preview-context"
import { useSavedProjects } from "@/contexts/saved-projects-context"
import { useProjectLikes } from "@/contexts/project-likes-context"

interface ProjectActionButtonsProps {
  projectId: string
}

export function ProjectActionButtons({ projectId }: ProjectActionButtonsProps) {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const { info, shareImageUrl, shareUrl, likesCount: initialLikesCount, isLiked: initialLiked } = useProjectPreview()
  const { savedProjectIds, mutatingProjectIds, saveProject, removeProject } = useSavedProjects()
  const { likedProjectIds, likeCounts, mutatingProjectIds: likeMutatingProjectIds, toggleLike } = useProjectLikes()

  const isSaved = projectId ? savedProjectIds.has(projectId) : false
  const isMutatingSave = projectId ? mutatingProjectIds.has(projectId) : false
  const providerLiked = projectId ? likedProjectIds.has(projectId) : undefined
  const isLiked = providerLiked ?? Boolean(initialLiked)
  const isMutatingLike = projectId ? likeMutatingProjectIds.has(projectId) : false
  const likesCount = projectId ? likeCounts[projectId] ?? initialLikesCount ?? 0 : initialLikesCount ?? 0

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="tertiary"
          size="tertiary"
          className={isLiked ? "!bg-primary !text-white hover:!bg-primary-hover" : ""}
          onClick={() => {
            if (!projectId) return
            void toggleLike(projectId, { currentCount: likesCount })
          }}
          disabled={!projectId || isMutatingLike}
          aria-pressed={isLiked}
        >
          <ThumbsUp className="w-4 h-4 md:mr-2" fill={isLiked ? "currentColor" : "none"} />
          <span className="hidden md:inline">{isLiked ? "Liked" : "Like"} • {likesCount}</span>
        </Button>
        <Button variant="tertiary" size="tertiary" onClick={() => setIsShareModalOpen(true)}>
          <Share className="w-4 h-4 md:mr-2" />
          <span className="hidden md:inline">Share</span>
        </Button>
        <Button
          variant="tertiary"
          size="tertiary"
          className={isSaved ? "!bg-primary !text-white hover:!bg-primary-hover" : ""}
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
          <Heart className="w-4 h-4 md:mr-2" fill={isSaved ? "currentColor" : "none"} />
          <span className="hidden md:inline">{isSaved ? "Saved" : "Save"}</span>
        </Button>
      </div>

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title={info.title}
        subtitle={info.subtitle ?? ""}
        imageUrl={shareImageUrl ?? "/placeholder.svg?height=64&width=64"}
        shareUrl={typeof window !== "undefined" ? window.location.href : shareUrl ?? ""}
      />
    </>
  )
}
