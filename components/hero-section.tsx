"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"

const FALLBACK_IMAGE = "/placeholder.svg?height=1080&width=1920"

export interface HeroProject {
  id: string
  title: string
  href: string
  imageUrl: string | null
  caption?: string | null
}

interface HeroSectionProps {
  projects: HeroProject[]
}

export function HeroSection({ projects }: HeroSectionProps) {
  const [currentProjectIndex, setCurrentProjectIndex] = useState(0)

  const safeProjects = useMemo(() => (projects.length > 0 ? projects : []), [projects])
  const totalProjects = safeProjects.length
  const currentProject = safeProjects[currentProjectIndex]

  useEffect(() => {
    if (totalProjects <= 1) return

    const timer = window.setInterval(() => {
      setCurrentProjectIndex((prev) => (prev + 1) % totalProjects)
    }, 5000)

    return () => window.clearInterval(timer)
  }, [totalProjects])

  useEffect(() => {
    if (currentProjectIndex >= totalProjects && totalProjects > 0) {
      setCurrentProjectIndex(0)
    }
  }, [currentProjectIndex, totalProjects])

  if (!currentProject) {
    return null
  }

  const goToPrevious = () => {
    setCurrentProjectIndex((prev) => (prev - 1 + totalProjects) % totalProjects)
  }

  const goToNext = () => {
    setCurrentProjectIndex((prev) => (prev + 1) % totalProjects)
  }

  return (
    <section className="relative flex h-[50vh] items-end justify-start overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700 ease-in-out"
        style={{
          backgroundImage: `url('${currentProject.imageUrl || FALLBACK_IMAGE}')`,
        }}
      >
        <div className="absolute inset-0 bg-black/35" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-8 text-white md:px-8">
        <div className="max-w-2xl">
          <Link href={currentProject.href} className="inline-block transition-opacity hover:opacity-90">
            <h1 className="text-4xl font-bold leading-tight md:text-6xl lg:text-7xl">
              {currentProject.title}
            </h1>
          </Link>
          {currentProject.caption ? (
            <p className="mt-3 text-sm text-white/80 md:text-base">{currentProject.caption}</p>
          ) : null}
        </div>

        <div className="absolute bottom-8 right-4 hidden items-center gap-2 text-sm text-white/80 md:flex">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 rounded-full bg-white/10 p-0 text-white hover:bg-white/20"
            onClick={goToPrevious}
            aria-label="Previous project"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 rounded-full bg-white/10 p-0 text-white hover:bg-white/20"
            onClick={goToNext}
            aria-label="Next project"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  )
}
