"use client"

import Link from "next/link"
import { Heart, Star } from "lucide-react"
import { memo } from "react"

import type { ProfessionalCard as ProfessionalCardData } from "@/lib/professionals/types"

const PLACEHOLDER_IMAGE = "/placeholder.svg?height=300&width=300"

export type ProfessionalCardProps = {
  professional: ProfessionalCardData
  isSaved: boolean
  isMutating: boolean
  onToggleSave: (professional: ProfessionalCardData) => void
  className?: string
}

export const ProfessionalCard = memo(function ProfessionalCard({
  professional,
  isSaved,
  isMutating,
  onToggleSave,
  className = "",
}: ProfessionalCardProps) {
  const handleToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onToggleSave(professional)
  }

  const imageSrc = professional.image || PLACEHOLDER_IMAGE

  return (
    <Link href={`/professionals/${professional.slug}`} className={`group cursor-pointer ${className}`}>
      <div className="relative overflow-hidden rounded-lg bg-surface">
        <img
          src={imageSrc}
          alt={professional.name}
          className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(event) => {
            event.currentTarget.src = PLACEHOLDER_IMAGE
            event.currentTarget.onerror = null
          }}
        />

        <button
          onClick={handleToggle}
          className="absolute top-3 right-3 p-1 text-text-secondary hover:text-red-500 transition-colors disabled:opacity-60"
          aria-pressed={isSaved}
          aria-label={isSaved ? "Unsave professional" : "Save professional"}
          disabled={isMutating}
        >
          <Heart className={`h-6 w-6 ${isSaved ? "fill-red-500 text-red-500" : ""}`} />
        </button>
      </div>

      <div className="mt-3">
        <p className="body-small font-medium leading-[1.2] tracking-[0] text-foreground line-clamp-2">{professional.name}</p>
        <p className="body-small font-normal text-text-secondary mt-1">
          {professional.profession} in {professional.location}
        </p>
        <div className="flex items-center gap-1 mt-1">
          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
          <span className="body-small font-normal text-text-secondary">{professional.rating}</span>
          <span className="body-small font-normal text-text-secondary">({professional.reviewCount})</span>
        </div>
      </div>
    </Link>
  )
})
