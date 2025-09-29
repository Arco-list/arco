"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRef } from "react"
import Link from "next/link"

const categories = [
  {
    title: "Architects",
    count: "1,247",
    href: "/professionals?category=Architecture",
    image: "/professional-architect-working-on-blueprints.jpg",
  },
  {
    title: "Interior Designers",
    count: "892",
    href: "/professionals?category=Interior Design",
    image: "/interior-designer-working-on-modern-room-design.jpg",
  },
  {
    title: "Landscape Designers",
    count: "634",
    href: "/professionals?category=Landscape Design",
    image: "/landscape-designer-working-in-beautiful-garden.jpg",
  },
  {
    title: "Construction Managers",
    count: "1,089",
    href: "/professionals?category=Construction",
    image: "/construction-manager-at-building-site.jpg",
  },
  {
    title: "Engineers",
    count: "756",
    href: "/professionals?category=Engineering",
    image: "/structural-engineer-working-on-technical-drawings.jpg",
  },
]

export function ProfessionalCategories() {
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
          <h2 className="text-2xl font-semibold text-gray-900">Featured professional categories</h2>
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
            <Link
              key={index}
              href={category.href}
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
                <div className="absolute bottom-4 left-4 text-white">
                  <h3 className="text-lg font-semibold mb-1">{category.title}</h3>
                  <p className="text-sm text-white/90">{category.count} professionals</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
