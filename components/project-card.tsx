"use client"

import Link from "next/link"
import Image from "next/image"
import { Heart, ThumbsUp } from "lucide-react"
import { memo } from "react"
import { sanitizeImageUrl, IMAGE_SIZES } from "@/lib/image-security"

const PLACEHOLDER_IMAGE = "/placeholder.svg?height=300&width=300"

export type ProjectCardData = {
  id: string
  title: string
  slug: string | null
  imageUrl: string | null
  imageAlt?: string | null
  location?: string | null
  likes?: number | null
}

export type ProjectCardProps = {
  project: ProjectCardData
  isSaved: boolean
  isLiked: boolean
  isMutatingSave: boolean
  isMutatingLike: boolean
  likesCount: number
  onToggleSave: (project: ProjectCardData) => void
  onToggleLike: (projectId: string, currentCount: number) => void
  className?: string
}

export const ProjectCard = memo(function ProjectCard({
  project,
  isSaved,
  isLiked,
  isMutatingSave,
  isMutatingLike,
  likesCount,
  onToggleSave,
  onToggleLike,
  className = "",
}: ProjectCardProps) {
  const handleSaveToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onToggleSave(project)
  }

  const handleLikeToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onToggleLike(project.id, likesCount)
  }

  const imageSrc = project.imageUrl || PLACEHOLDER_IMAGE
  const imageAlt = project.imageAlt || project.title

  return (
    <Link href={project.slug ? `/projects/${project.slug}` : "#"} className={`group cursor-pointer ${className}`}>
      <div className="relative overflow-hidden rounded-lg bg-surface">
        <Image
          src={sanitizeImageUrl(imageSrc, PLACEHOLDER_IMAGE)}
          alt={imageAlt}
          width={IMAGE_SIZES.card.width}
          height={IMAGE_SIZES.card.width}
          className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <button
          onClick={handleSaveToggle}
          disabled={isMutatingSave}
          aria-pressed={isSaved}
          aria-label={isSaved ? "Remove from saved projects" : "Save project"}
          className="absolute top-3 right-3 p-1.5 text-text-secondary hover:text-red-500 transition-all duration-200 disabled:opacity-60"
        >
          <Heart
            className={`h-6 w-6 ${isSaved ? "text-red-500 fill-red-500" : "text-text-secondary hover:text-red-500"}`}
            fill={isSaved ? "currentColor" : "none"}
          />
        </button>
      </div>
      <div className="mt-3">
        <div className="flex items-start gap-2 mb-1">
          <p className="body-small font-medium leading-[1.2] tracking-[0] text-foreground line-clamp-2 flex-1">
            {project.title}
          </p>
          <button
            type="button"
            onClick={handleLikeToggle}
            disabled={isMutatingLike}
            aria-pressed={isLiked}
            aria-label={isLiked ? "Unlike project" : "Like project"}
            className="flex items-center gap-1 body-small text-text-secondary hover:text-foreground disabled:opacity-70 flex-shrink-0"
          >
            <ThumbsUp
              className={`h-3 w-3 ${isLiked ? "text-red-500 fill-red-500" : ""}`}
              fill={isLiked ? "currentColor" : "none"}
            />
            <span>{likesCount}</span>
          </button>
        </div>
      </div>
    </Link>
  )
})
