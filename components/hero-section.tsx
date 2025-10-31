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
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const safeProjects = useMemo(() => (projects.length > 0 ? projects : []), [projects])
  const totalProjects = safeProjects.length
  const currentImage = safeProjects[currentImageIndex]
  const heroTitle = "World's finest architectural constructions"

  useEffect(() => {
    if (totalProjects <= 1) return

    const timer = window.setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % totalProjects)
    }, 5000)

    return () => window.clearInterval(timer)
  }, [totalProjects])

  useEffect(() => {
    if (currentImageIndex >= totalProjects && totalProjects > 0) {
      setCurrentImageIndex(0)
    }
  }, [currentImageIndex, totalProjects])

  if (!currentImage) {
    return null
  }

  const goToPrevious = () => {
    setCurrentImageIndex((prev) => (prev - 1 + totalProjects) % totalProjects)
  }

  const goToNext = () => {
    setCurrentImageIndex((prev) => (prev + 1) % totalProjects)
  }

  return (
    <section className="relative flex h-[50vh] md:h-[60vh] lg:h-[70vh] items-end justify-start overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700 ease-in-out"
        style={{
          backgroundImage: `url('${currentImage.imageUrl || FALLBACK_IMAGE}')`,
        }}
      >
        <div className="absolute inset-0 bg-black/35" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1800px] px-4 pb-8 text-white md:px-8">
        <div className="max-w-2xl mb-4 md:mb-0">
          <Link href={currentImage.href}>
            <h1 className="hover:opacity-90 transition-opacity cursor-pointer">
              {heroTitle}
            </h1>
          </Link>
        </div>

        <div className="flex items-center justify-between md:absolute md:bottom-8 md:right-8 md:justify-end gap-3 text-sm text-white/80">
          {currentImage.caption ? (
            <Link href={currentImage.href} className="text-sm font-medium text-white/90 hover:opacity-80 transition-opacity">
              {currentImage.caption}
            </Link>
          ) : null}
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 rounded-full bg-white/10 p-0 text-white hover:bg-white/20"
              onClick={goToPrevious}
              aria-label="Previous image"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 rounded-full bg-white/10 p-0 text-white hover:bg-white/20"
              onClick={goToNext}
              aria-label="Next image"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
