"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Settings2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { HeroCoversEditor } from "@/components/hero-covers-editor"
import { SLIDE_MS } from "@/components/landing/track-settled"

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
  /** The slide fading in over the current one, or null when at rest. */
  const [incomingIndex, setIncomingIndex] = useState<number | null>(null)

  const SLIDE_DURATION = 5000 // 5 seconds per slide

  const startRef = useRef(Date.now())
  const rafRef = useRef<number | undefined>(undefined)
  const settleRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // `progress` mirrored into a ref, and the in-transition flag kept
  // beside it. The frame loop below is rebuilt by an effect, so reading
  // either from state would mean reading whatever it was when that
  // effect last ran — and React commits the end of a slide before it
  // re-runs the effect. That one-frame gap is enough for the loop to
  // write 100% onto the bar of the slide that just began, which shows up
  // as the next bar flashing full before it starts filling.
  const progressRef = useRef(0)
  const animatingRef = useRef(false)
  const slideFromRef = useRef(0)
  const slideStartRef = useRef(0)

  const applyProgress = useCallback((pct: number) => {
    progressRef.current = pct
    setProgress(pct)
  }, [])

  /**
   * Hand over to another slide: the photo crossfades, and the bar plays
   * out whatever travel it had left over exactly that span.
   *
   * No pause afterwards. Stepping through used to stop the auto-advance
   * for ten seconds — twice a slide's own length — leaving the bar empty
   * and still for long enough to read as broken. The new slide starts
   * its normal five seconds the moment the fade lands.
   *
   * Auto-advance comes through here too and costs nothing extra: it only
   * ever fires at 100%, so there is no travel left and the bar simply
   * holds full while the photo changes underneath it.
   */
  const beginTransition = useCallback((index: number) => {
    if (animatingRef.current || index === currentIndex) return
    slideFromRef.current = progressRef.current
    slideStartRef.current = Date.now()
    animatingRef.current = true
    setIncomingIndex(index)

    if (settleRef.current) clearTimeout(settleRef.current)
    settleRef.current = setTimeout(() => {
      animatingRef.current = false
      setCurrentIndex(index)
      setIncomingIndex(null)
      applyProgress(0)
      startRef.current = Date.now()
    }, SLIDE_MS)
  }, [currentIndex, applyProgress])

  useEffect(() => {
    if (projects.length <= 1) return

    const tick = () => {
      if (animatingRef.current) {
        // Mid-handover: run the bar out to full in step with the fade.
        const k = Math.min((Date.now() - slideStartRef.current) / SLIDE_MS, 1)
        const from = slideFromRef.current
        applyProgress(from + (100 - from) * k)
      } else {
        const pct = Math.min(((Date.now() - startRef.current) / SLIDE_DURATION) * 100, 100)
        applyProgress(pct)
        if (pct >= 100) beginTransition((currentIndex + 1) % projects.length)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [currentIndex, projects.length, beginTransition, applyProgress])

  useEffect(() => {
    return () => {
      if (settleRef.current) clearTimeout(settleRef.current)
    }
  }, [])

  const goToSlide = (index: number) => beginTransition(index)

  const goToPrevious = () => {
    beginTransition((currentIndex - 1 + projects.length) % projects.length)
  }

  const goToNext = () => {
    beginTransition((currentIndex + 1) % projects.length)
  }

  if (projects.length === 0) {
    return null
  }

  const safeIndex = currentIndex < projects.length ? currentIndex : 0
  const currentProject = projects[safeIndex]
  const incomingProject = incomingIndex !== null ? projects[incomingIndex] : null

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

      {/* The next photo, fading in over the one above. A CSS animation
          rather than a transition on purpose: a transition needs the
          element to exist at opacity 0 for a frame before the change,
          and a freshly mounted layer has no such frame — it would jump
          in at full opacity. An animation starts from its own keyframe
          on the first paint. */}
      {incomingProject?.imageUrl && (
        <div
          className="absolute inset-0 hero-crossfade"
          style={{ animationDuration: `${SLIDE_MS}ms` }}
          aria-hidden
        >
          <Image
            src={incomingProject.imageUrl}
            alt=""
            fill
            className="object-cover"
            quality={90}
          />
        </div>
      )}

      {/* Gradient Overlay */}
      {/* Text-legibility scrim: shaded only where text actually sits —
          nav at the top, headline at the bottom — with a near-clear
          middle so the photo carries the section. */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/5 to-black/45" />

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
