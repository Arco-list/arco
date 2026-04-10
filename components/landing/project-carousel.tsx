"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import Image from "next/image"
import { useTranslations } from "next-intl"

export interface ProjectCard {
  id: string
  title: string
  firm: string
  image: string
}

interface ProjectCarouselProps {
  projects: ProjectCard[]
  /** Auto-advance interval in ms (default 5000) */
  duration?: number
  /** Pause duration after manual interaction in ms (default 8000) */
  pauseDuration?: number
}

const GAP = 20

export function ProjectCarousel({
  projects,
  duration = 5000,
  pauseDuration = 8000,
}: ProjectCarouselProps) {
  const count = projects.length

  const [current, setCurrent] = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  const trackRef = useRef<HTMLDivElement>(null)
  const startRef = useRef(Date.now())
  const rafRef = useRef<number>()
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout>>()

  // Triple the items for seamless looping: [...projects, ...projects, ...projects]
  // The "real" set is the middle copy (indices count..2*count-1)
  const tripled = [...projects, ...projects, ...projects]
  const realOffset = count // offset to the middle copy

  const getCardWidth = useCallback(() => {
    if (!trackRef.current?.children[0]) return 400
    return (trackRef.current.children[0] as HTMLElement).offsetWidth
  }, [])

  const getTranslateX = useCallback((index: number) => {
    const cw = getCardWidth()
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200
    // Center the card at `realOffset + index`
    const targetPos = realOffset + index
    return (vw - cw) / 2 - targetPos * (cw + GAP)
  }, [getCardWidth, realOffset])

  // Set position without animation
  const snapTo = useCallback((index: number) => {
    if (!trackRef.current) return
    trackRef.current.style.transition = "none"
    trackRef.current.style.transform = `translateX(${getTranslateX(index)}px)`
  }, [getTranslateX])

  // Animate to position
  const animateTo = useCallback((index: number) => {
    if (!trackRef.current) return
    trackRef.current.style.transition = "transform 0.55s cubic-bezier(0.25,0.1,0.25,1)"
    trackRef.current.style.transform = `translateX(${getTranslateX(index)}px)`
  }, [getTranslateX])

  // Initial position + resize
  useEffect(() => {
    snapTo(current)
    const onResize = () => snapTo(current)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Pause helper ── */
  const pauseAuto = useCallback(() => {
    setPaused(true)
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current)
    pauseTimerRef.current = setTimeout(() => {
      setPaused(false)
      startRef.current = Date.now()
    }, pauseDuration)
  }, [pauseDuration])

  /* ── Go next ── */
  const goNext = useCallback(() => {
    if (isAnimating) return
    setIsAnimating(true)

    const next = current + 1
    animateTo(next)

    const onEnd = () => {
      trackRef.current?.removeEventListener("transitionend", onEnd)
      const wrapped = ((next % count) + count) % count
      if (wrapped !== next) {
        // We've gone past the end — snap back to the middle copy
        snapTo(wrapped)
      }
      setCurrent(wrapped)
      setProgress(0)
      startRef.current = Date.now()
      setIsAnimating(false)
    }
    trackRef.current?.addEventListener("transitionend", onEnd)
  }, [isAnimating, current, count, animateTo, snapTo])

  /* ── Go prev ── */
  const goPrev = useCallback(() => {
    if (isAnimating) return
    setIsAnimating(true)

    const prev = current - 1
    animateTo(prev)

    const onEnd = () => {
      trackRef.current?.removeEventListener("transitionend", onEnd)
      const wrapped = ((prev % count) + count) % count
      if (wrapped !== prev) {
        snapTo(wrapped)
      }
      setCurrent(wrapped)
      setProgress(0)
      startRef.current = Date.now()
      setIsAnimating(false)
    }
    trackRef.current?.addEventListener("transitionend", onEnd)
  }, [isAnimating, current, count, animateTo, snapTo])

  /* ── Jump to bar ── */
  const goTo = useCallback(
    (target: number) => {
      if (isAnimating || target === current) return
      setIsAnimating(true)

      // Find shortest path through the tripled track
      let delta = target - current
      if (delta > count / 2) delta -= count
      if (delta < -count / 2) delta += count

      animateTo(current + delta)

      const onEnd = () => {
        trackRef.current?.removeEventListener("transitionend", onEnd)
        snapTo(target)
        setCurrent(target)
        setProgress(0)
        startRef.current = Date.now()
        setIsAnimating(false)
      }
      trackRef.current?.addEventListener("transitionend", onEnd)
      pauseAuto()
    },
    [isAnimating, current, count, animateTo, snapTo, pauseAuto]
  )

  /* ── Auto-advance ── */
  useEffect(() => {
    const tick = () => {
      if (!paused && !isAnimating) {
        const elapsed = Date.now() - startRef.current
        const pct = Math.min((elapsed / duration) * 100, 100)
        setProgress(pct)
        if (pct >= 100) goNext()
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [paused, isAnimating, duration, goNext])

  /* ── Keyboard ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") { goPrev(); pauseAuto() }
      if (e.key === "ArrowRight") { goNext(); pauseAuto() }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [goPrev, goNext, pauseAuto])

  /* ── Cleanup ── */
  useEffect(() => {
    return () => {
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current)
    }
  }, [])

  const t = useTranslations("business")

  if (count === 0) return null

  return (
    <section className="pb-[100px] bg-white">
      {/* Eyebrow — inside wrap */}
      <div className="wrap">
        <div className="text-center mb-7">
          <span className="arco-eyebrow">{t("recently_added_projects")}</span>
        </div>
      </div>

      {/* Full-bleed viewport */}
      <div
        className="overflow-hidden"
        style={{ width: "100vw", marginLeft: "calc(-50vw + 50%)" }}
      >
        <div
          ref={trackRef}
          className="flex will-change-transform"
          style={{ gap: GAP }}
        >
          {tripled.map((project, i) => (
            <div
              key={`${project.id}-${i}`}
              className="shrink-0 min-w-0 carousel-project-card"
            >
              <div className="discover-card-image-wrap" style={{ aspectRatio: "3/2" }}>
                <div className="discover-card-image-layer">
                  <Image
                    src={project.image}
                    alt={project.title}
                    width={960}
                    height={640}
                  />
                </div>
              </div>
              <div className="discover-card-title">{project.title}</div>
              <div className="discover-card-sub">{t("by_firm", { firm: project.firm })}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation — reuses endorsement-nav pattern */}
      <div className="wrap">
        <div className="endorsement-nav">
          <button
            className="endorsement-arrow"
            onClick={() => { goPrev(); pauseAuto() }}
            aria-label="Previous project"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="endorsement-bars">
            {projects.map((_, i) => (
              <button
                key={i}
                className={`endorsement-bar${i < current ? " done" : ""}`}
                onClick={() => goTo(i)}
                aria-label={`Go to project ${i + 1}`}
              >
                <div
                  className="endorsement-bar-fill"
                  style={{
                    width:
                      i === current
                        ? `${progress}%`
                        : i < current
                          ? "100%"
                          : "0%",
                  }}
                />
              </button>
            ))}
          </div>

          <button
            className="endorsement-arrow"
            onClick={() => { goNext(); pauseAuto() }}
            aria-label="Next project"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </section>
  )
}
