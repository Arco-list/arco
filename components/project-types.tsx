"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRef } from "react"
import Link from "next/link"

const FALLBACK_IMAGE = "/placeholder.svg?height=300&width=400"

export interface ProjectTypeCard {
  id: string
  title: string
  href: string
  imageUrl: string | null
}

interface ProjectTypesProps {
  types: ProjectTypeCard[]
}

export function ProjectTypes({ types }: ProjectTypesProps) {
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

  if (types.length === 0) {
    return null
  }

  return (
    <section className="py-16 px-4 md:px-8">
      <div className="max-w-[1800px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-semibold text-gray-900">Popular project types</h2>
          <div className="hidden md:flex gap-2">
            <Button size="sm" variant="outline" className="w-10 h-10 p-0 bg-transparent rounded-full flex items-center justify-center" onClick={scrollLeft}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" className="w-10 h-10 p-0 bg-transparent rounded-full flex items-center justify-center" onClick={scrollRight}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 md:gap-4 md:overflow-visible"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {types.map((type) => (
            <Link
              key={type.id}
              href={type.href}
              className="group cursor-pointer flex-none w-64 md:w-auto"
              style={{ scrollSnapAlign: "start" }}
            >
              <div className="relative aspect-[3/4] rounded-lg overflow-hidden mb-3">
                <img
                  src={type.imageUrl || FALLBACK_IMAGE}
                  alt={type.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300" />
                <h3 className="absolute bottom-4 left-4 text-white font-semibold text-3xl">{type.title}</h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
