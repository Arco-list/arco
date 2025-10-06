"use client"

import { Heart, ChevronLeft, ChevronRight } from "lucide-react"
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
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-semibold text-gray-900">Popular projects</h2>
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
          className="flex gap-6 overflow-x-auto scrollbar-hide pb-2 mb-8 md:grid md:grid-cols-5 md:gap-6 md:overflow-visible"
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
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute top-3 right-3 p-2 bg-white/90 hover:bg-white text-gray-600 hover:text-red-500"
                  onClick={(e) => e.preventDefault()}
                >
                  <Heart className="h-4 w-4" />
                </Button>
              </div>
              <h3 className="text-lg font-medium text-gray-900 group-hover:text-gray-600 transition-colors">
                {project.title}
              </h3>
              {typeof project.likes === "number" ? (
                <p className="mt-1 text-sm text-gray-500">{project.likes} likes</p>
              ) : null}
            </Link>
          ))}
        </div>

        <div className="text-center">
          <Link href="/projects">
            <Button variant="outline" className="px-8 bg-transparent">
              All projects
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
