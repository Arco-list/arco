"use client"

import { Heart, ChevronLeft, ChevronRight, ThumbsUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useRef } from "react"

const FALLBACK_IMAGE = "/placeholder.svg?height=300&width=300"

export interface PopularProjectCard {
  id: string
  title: string
  href: string
  imageUrl: string | null
  likes?: number | null
}

interface PopularProjectsProps {
  projects: PopularProjectCard[]
}

export function PopularProjects({ projects }: PopularProjectsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  if (projects.length === 0) {
    return null
  }

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -400, behavior: "smooth" })
    }
  }

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 400, behavior: "smooth" })
    }
  }

  return (
    <section className="py-16 px-4 md:px-8">
      <div className="max-w-[1800px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-semibold text-gray-900">Popular projects</h2>
          <div className="flex items-center gap-2">
            <Link href="/projects" className="text-sm text-gray-600 hover:text-gray-900 transition-colors mr-2">
              View all
            </Link>
            <div className="hidden md:flex items-center gap-2">
              <Button size="sm" variant="outline" className="w-10 h-10 p-0 bg-transparent rounded-full flex items-center justify-center" onClick={scrollLeft}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" className="w-10 h-10 p-0 bg-transparent rounded-full flex items-center justify-center" onClick={scrollRight}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 mb-8 md:grid md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 md:gap-4 md:overflow-visible"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {projects.map((project) => (
          <Link
            key={project.id}
            href={project.href}
            className="group cursor-pointer flex-none w-80 md:w-auto"
            style={{ scrollSnapAlign: "start" }}
          >
              <div className="relative aspect-square rounded-lg overflow-hidden mb-3">
                <img
                  src={project.imageUrl || FALLBACK_IMAGE}
                  alt={project.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <button
                  className="absolute top-3 right-3 p-1 text-gray-600 hover:text-red-500 transition-colors"
                  onClick={(e) => e.preventDefault()}
                >
                  <Heart className="h-6 w-6" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 group-hover:text-gray-600 transition-colors">
                  {project.title}
                </h3>
                {typeof project.likes === "number" ? (
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <ThumbsUp className="h-3 w-3" />
                    <span>{project.likes}</span>
                  </div>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
