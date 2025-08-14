"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRef } from "react"

const categories = [
  {
    title: "House",
    image: "/placeholder.svg?height=400&width=300",
  },
  {
    title: "Kitchen & Living",
    image: "/placeholder.svg?height=400&width=300",
  },
  {
    title: "Bed & Bath",
    image: "/placeholder.svg?height=400&width=300",
  },
  {
    title: "Outdoor",
    image: "/placeholder.svg?height=400&width=300",
  },
  {
    title: "Other",
    image: "/placeholder.svg?height=400&width=300",
  },
]

export function ProjectCategories() {
  const scrollRef = useRef<HTMLDivElement>(null)

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
    <section className="py-16 px-4 md:px-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-semibold text-gray-900">Project categories</h2>
          <div className="hidden md:flex gap-2">
            <Button size="sm" variant="outline" className="p-2 bg-transparent" onClick={scrollLeft}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" className="p-2 bg-transparent" onClick={scrollRight}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 md:grid md:grid-cols-3 lg:grid-cols-5 md:gap-4 md:overflow-visible"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {categories.map((category, index) => (
            <div
              key={index}
              className="group cursor-pointer flex-none w-64 md:w-auto"
              style={{ scrollSnapAlign: "start" }}
            >
              <div className="relative aspect-[3/4] rounded-lg overflow-hidden mb-3">
                <img
                  src={category.image || "/placeholder.svg"}
                  alt={category.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300" />
                <h3 className="absolute bottom-4 left-4 text-white text-lg font-semibold">{category.title}</h3>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
