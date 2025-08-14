"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { useRef } from "react"

export function ProjectHighlights() {
  const scrollRef = useRef<HTMLDivElement>(null)

  const highlights = [
    {
      title: "Living room",
      image: "/placeholder.svg?height=200&width=300",
    },
    {
      title: "Bedroom",
      image: "/placeholder.svg?height=200&width=300",
    },
    {
      title: "Bathroom",
      image: "/placeholder.svg?height=200&width=300",
    },
  ]

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-black">Highlights</h2>
        <div className="flex gap-2">
          <button
            onClick={scrollLeft}
            className="p-2 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
            aria-label="Previous highlights"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={scrollRight}
            className="p-2 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
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
        {highlights.map((highlight, index) => (
          <div key={index} className="flex-none w-80 space-y-2" style={{ scrollSnapAlign: "start" }}>
            <img
              src={highlight.image || "/placeholder.svg"}
              alt={highlight.title}
              className="w-full h-48 object-cover rounded-lg hover:scale-105 transition-transform duration-300"
            />
            <p className="text-sm font-medium text-gray-900">{highlight.title}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
