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
      <div className="relative overflow-hidden rounded-lg bg-gray-100">
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
          className="absolute top-3 right-3 p-2 rounded-full bg-white/80 hover:bg-white transition-colors disabled:opacity-60"
          aria-pressed={isSaved}
          aria-label={isSaved ? "Unsave professional" : "Save professional"}
          disabled={isMutating}
        >
          <Heart className={`h-4 w-4 ${isSaved ? "fill-red-500 text-red-500" : "text-gray-600 hover:text-red-500"}`} />
        </button>
      </div>

      <div className="mt-3">
        <h3 className="text-sm font-medium text-gray-900 line-clamp-2">{professional.name}</h3>
        <p className="text-xs text-gray-500 mt-1">{professional.profession}</p>
        <p className="text-xs text-gray-500">{professional.location}</p>
        <div className="flex items-center gap-1 mt-1">
          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
          <span className="text-xs text-gray-600">{professional.rating}</span>
          <span className="text-xs text-gray-500">({professional.reviewCount})</span>
        </div>
      </div>
    </Link>
  )
})
