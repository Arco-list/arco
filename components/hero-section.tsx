"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Info } from "lucide-react"
import { Button } from "@/components/ui/button"

const heroProjects = [
  {
    id: 1,
    title: "World's finest architectural constructions",
    image: "/placeholder.svg?height=1080&width=1920",
    caption: "Villa Ega, Marco van Veldhuizen",
  },
  {
    id: 2,
    title: "Contemporary living spaces",
    image: "/placeholder.svg?height=1080&width=1920",
    caption: "Paradise Villa, Amsterdam",
  },
  {
    id: 3,
    title: "Innovative architectural design",
    image: "/placeholder.svg?height=1080&width=1920",
    caption: "Villa Mel, Rotterdam",
  },
  {
    id: 4,
    title: "Luxury residential projects",
    image: "/placeholder.svg?height=1080&width=1920",
    caption: "Garden House, Utrecht",
  },
]

export function HeroSection() {
  const [currentProjectIndex, setCurrentProjectIndex] = useState(0)
  const currentProject = heroProjects[currentProjectIndex]

  const goToPrevious = () => {
    setCurrentProjectIndex((prev) => (prev - 1 + heroProjects.length) % heroProjects.length)
  }

  const goToNext = () => {
    setCurrentProjectIndex((prev) => (prev + 1) % heroProjects.length)
  }

  return (
    <section className="relative h-[70vh] flex items-center justify-center overflow-hidden">
      {/* Hero Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700 ease-in-out"
        style={{
          backgroundImage: `url('${currentProject.image}')`,
        }}
      >
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-white px-4 md:px-8 max-w-7xl mx-auto w-full">
        <div className="max-w-2xl">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight mb-8 transition-opacity duration-500 min-h-[200px] md:min-h-[300px] lg:min-h-[350px] flex items-center">
            {currentProject.title}
          </h1>
        </div>

        {/* Image Caption */}
        <div className="absolute bottom-8 right-8 hidden md:flex items-center gap-2 text-sm text-white/80">
          <span className="transition-opacity duration-500">{currentProject.caption}</span>
          <Button size="sm" variant="ghost" className="p-1 h-6 w-6 text-white/60 hover:text-white">
            <Info className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="p-1 h-6 w-6 text-white/60 hover:text-white"
            onClick={goToPrevious}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="p-1 h-6 w-6 text-white/60 hover:text-white" onClick={goToNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  )
}
