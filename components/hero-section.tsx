"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Settings2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { HeroCoversEditor } from "@/components/hero-covers-editor"

export interface HeroProject {
  id: string
  title: string
  href: string
  imageUrl: string | null
  caption?: string
}

interface HeroSectionProps {
  projects: HeroProject[]
  isSuperAdmin?: boolean
}

export function HeroSection({ projects, isSuperAdmin = false }: HeroSectionProps) {
  const [showEditor, setShowEditor] = useState(false)
  const t = useTranslations("home")
  const [currentIndex, setCurrentIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  const SLIDE_DURATION = 5000 // 5 seconds per slide

  // Auto-advance with progress animation
  useEffect(() => {
    if (isPaused || projects.length <= 1) return

    const startTime = Date.now()
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const newProgress = (elapsed / SLIDE_DURATION) * 100

      if (newProgress >= 100) {
        // Move to next slide and reset progress
        setProgress(0)
        setCurrentIndex((prev) => (prev + 1) % projects.length)
      } else {
        setProgress(newProgress)
      }
    }, 16) // Update ~60fps

    return () => clearInterval(interval)
  }, [currentIndex, isPaused, projects.length, SLIDE_DURATION])

  const goToSlide = (index: number) => {
    setCurrentIndex(index)
    setProgress(0)
    setIsPaused(true)
    // Resume auto-play after 10 seconds of inactivity
    setTimeout(() => setIsPaused(false), 10000)
  }

  const goToPrevious = () => {
    const newIndex = (currentIndex - 1 + projects.length) % projects.length
    goToSlide(newIndex)
  }

  const goToNext = () => {
    const newIndex = (currentIndex + 1) % projects.length
    goToSlide(newIndex)
  }

  if (projects.length === 0) {
    return null
  }

  const safeIndex = currentIndex < projects.length ? currentIndex : 0
  const currentProject = projects[safeIndex]

  return (
    <section className="relative w-full h-[600px] md:h-[700px] lg:h-[82vh] overflow-hidden bg-black" style={{ minHeight: '560px' }}>
      {/* Background Image */}
      {currentProject.imageUrl && (
        <Image
          src={currentProject.imageUrl}
          alt={currentProject.title}
          fill
          className="object-cover"
          priority={currentIndex === 0}
          quality={90}
        />
      )}

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />

      {/* Desktop Content - Bottom Aligned */}
      <div className="hidden md:block absolute bottom-0 left-0 right-0 pb-12" style={{ zIndex: 20 }}>
        <div className="max-w-[1680px] mx-auto px-[80px] max-lg:px-[40px]">

          {/* Large screens: Left (Title) | Right (Navigation) */}
          <div className="lg:flex lg:items-end lg:justify-between lg:gap-8">

            {/* Left Side - Title & Stats */}
            <div className="flex-1">
              <h1 className="arco-hero-title mb-6" style={{ color: 'white' }}>
                {t("hero_line1")}<br />
                {t("hero_line2")}
              </h1>

              <p className="arco-eyebrow" style={{ color: 'white' }}>
                {t("hero_eyebrow")}
              </p>
            </div>

            {/* Navigation - right on desktop, below title on tablet */}
            {projects.length > 1 && (
              <div className="flex flex-col gap-3 mt-6 lg:mt-0">
                {/* Progress Bars & Arrows Row */}
                <div className="flex items-center gap-3">
                  <div className="flex gap-2">
                    {projects.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => goToSlide(index)}
                        className="relative overflow-hidden transition-opacity hover:opacity-80"
                        style={{
                          width: '60px',
                          height: '2px',
                          backgroundColor: 'rgba(255, 255, 255, 0.3)',
                          border: 'none'
                        }}
                        aria-label={`Go to slide ${index + 1}`}
                      >
                        {index === currentIndex && (
                          <div
                            className="absolute top-0 left-0 h-full bg-white transition-all ease-linear"
                            style={{
                              width: `${progress}%`,
                              transitionDuration: '16ms'
                            }}
                          />
                        )}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={goToPrevious}
                    className="w-10 h-10 flex items-center justify-center text-white hover:opacity-70 transition-opacity"
                    aria-label="Previous slide"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>

                  <button
                    onClick={goToNext}
                    className="w-10 h-10 flex items-center justify-center text-white hover:opacity-70 transition-opacity"
                    aria-label="Next slide"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </div>

                <Link href={currentProject.href} className="arco-eyebrow text-left hover:opacity-80 transition-opacity" style={{ color: 'white' }}>
                  {currentProject.title}
                </Link>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Mobile Content - Bottom Aligned, Left Aligned */}
      <div className="block md:hidden absolute bottom-0 left-0 right-0 pb-8" style={{ zIndex: 20 }}>
        <div className="px-4">
          
          {/* Title - UPDATED: Explicitly white */}
          <h1 className="arco-hero-title mb-8 text-left" style={{
            color: 'white',
            fontSize: 'clamp(32px, 8vw, 48px)'
          }}>
            {t("hero_line1")}<br />
            {t("hero_line2")}
          </h1>

          {/* Navigation - Full width bars only */}
          {projects.length > 1 && (
            <div className="flex flex-col gap-3">
              {/* Progress Bars - Full width with margins */}
              <div className="flex gap-2 w-full">
                {projects.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToSlide(index)}
                    className="relative overflow-hidden flex-1"
                    style={{ 
                      height: '2px',
                      backgroundColor: 'rgba(255, 255, 255, 0.3)',
                      border: 'none'
                    }}
                    aria-label={`Go to slide ${index + 1}`}
                  >
                    {/* ONLY current bar fills */}
                    {index === currentIndex && (
                      <div
                        className="absolute top-0 left-0 h-full bg-white"
                        style={{ width: `${progress}%` }}
                      />
                    )}
                  </button>
                ))}
              </div>
              
              {/* Project name linking to project page */}
              <Link href={currentProject.href} className="arco-eyebrow text-left hover:opacity-80 transition-opacity" style={{ color: 'white', fontSize: '10px' }}>
                {currentProject.title}
              </Link>
            </div>
          )}
          
        </div>
      </div>

      {/* Super admin: edit hero covers */}
      {isSuperAdmin && (
        <>
          <button
            type="button"
            onClick={() => setShowEditor(true)}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 50,
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 500,
              color: "white",
              background: "rgba(0,0,0,0.5)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 20,
              cursor: "pointer",
              backdropFilter: "blur(4px)",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.7)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.5)")}
          >
            <Settings2 style={{ width: 14, height: 14 }} />
            Select covers
          </button>
          <HeroCoversEditor isOpen={showEditor} onClose={() => setShowEditor(false)} />
        </>
      )}
    </section>
  )
}
