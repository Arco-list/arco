"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { useCallback, useRef } from "react"
import { useProjectPreview } from "@/contexts/project-preview-context"
import { useProjectGalleryModal } from "@/contexts/project-gallery-modal-context"

export function ProjectHighlights() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { highlights, hero } = useProjectPreview()
  const { openModal } = useProjectGalleryModal()

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -320, behavior: "smooth" })
    }
  }

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 320, behavior: "smooth" })
    }
  }

  const handleHighlightClick = useCallback(
    (highlightId: string) => {
      const hasMatchingGroup = hero.groups.some((group) => group.id === highlightId)
      if (hasMatchingGroup) {
        openModal({ groupId: highlightId })
        return
      }
      openModal()
    },
    [hero.groups, openModal],
  )

  if (highlights.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-black">Highlights</h2>
        <div className="hidden md:flex gap-2">
          <button
            onClick={scrollLeft}
            className="p-2 rounded-full border border-border hover:bg-surface transition-colors"
            aria-label="Previous highlights"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={scrollRight}
            className="p-2 rounded-full border border-border hover:bg-surface transition-colors"
            aria-label="Next highlights"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {highlights.map((highlight) => (
          <button
            key={highlight.id}
            type="button"
            onClick={() => handleHighlightClick(highlight.id)}
            className="group flex-none w-80 space-y-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 rounded-lg"
            style={{ scrollSnapAlign: "start" }}
          >
            <div className="relative overflow-hidden rounded-lg">
              <img
                src={highlight.imageUrl || "/placeholder.svg"}
                alt={highlight.title}
                className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            <p className="text-sm font-medium text-foreground">{highlight.title}</p>
            {highlight.description && <p className="text-xs text-text-secondary">{highlight.description}</p>}
          </button>
        ))}
      </div>
    </div>
  )
}
