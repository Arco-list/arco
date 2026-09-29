"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import Image from "next/image"
import { useTranslations } from "next-intl"

import { onTrackSettled, SLIDE_MS } from "./track-settled"

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
}

const GAP = 20

export function ProjectCarousel({
  projects,
  duration = 5000,
}: ProjectCarouselProps) {
  const count = projects.length

  const [current, setCurrent] = useState(0)
  const [progress, setProgress] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  const trackRef = useRef<HTMLDivElement>(null)
  const startRef = useRef(Date.now())
  const rafRef = useRef<number>()

  // `progress` mirrored into a ref. The slide starters below need the
  // bar's value at the instant of a click, and as useCallbacks they would
  // otherwise read whatever it was when they were last created.
  const progressRef = useRef(0)
  const applyProgress = useCallback((pct: number) => {
    progressRef.current = pct
    setProgress(pct)
  }, [])

  // Where the bar stood when the current slide began, and when that was.
  const slideFromRef = useRef(0)
  const slideStartRef = useRef(0)

  /**
   * The same flag as `isAnimating`, kept where the frame loop can read it
   * without a render in between.
   *
   * The loop below is recreated by an effect, so it sees whatever
   * `isAnimating` was when that effect last ran. React commits the end of
   * a slide — new `current`, bar back to zero — before it re-runs the
   * effect, which leaves a window of one frame where the loop still
   * believes a slide is in progress while the NEW bar is already on
   * screen. It writes 100% to it, and the next bar flashes full before it
   * starts filling. A ref has no such window.
   */
  const animatingRef = useRef(false)

  /**
   * Start a slide, and let the bar finish at the speed the track moves.
   *
   * Pressing an arrow is a request to be done with this slide now, so the
   * bar plays out its remaining travel over the length of the slide
   * itself rather than freezing where it stood. Auto-advance runs through
   * here too and costs nothing: it only ever fires at 100%, so there is
   * no travel left and the bar simply stays full while the track moves.
   */
  const beginSlide = useCallback(() => {
    slideFromRef.current = progressRef.current
    slideStartRef.current = Date.now()
    animatingRef.current = true
    setIsAnimating(true)
  }, [])

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
    trackRef.current.style.transition = `transform ${SLIDE_MS}ms cubic-bezier(0.25,0.1,0.25,1)`
    trackRef.current.style.transform = `translateX(${getTranslateX(index)}px)`
  }, [getTranslateX])

  // Initial position + resize
  useEffect(() => {
    snapTo(current)
    const onResize = () => snapTo(current)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Go next ── */
  const goNext = useCallback(() => {
    if (animatingRef.current) return
    beginSlide()

    const next = current + 1
    animateTo(next)

    onTrackSettled(trackRef.current, () => {
      animatingRef.current = false
      const wrapped = ((next % count) + count) % count
      if (wrapped !== next) {
        // We've gone past the end — snap back to the middle copy
        snapTo(wrapped)
      }
      setCurrent(wrapped)
      applyProgress(0)
      startRef.current = Date.now()
      setIsAnimating(false)
    })
  }, [isAnimating, current, count, animateTo, snapTo, beginSlide, applyProgress])

  /* ── Go prev ── */
  const goPrev = useCallback(() => {
    if (animatingRef.current) return
    beginSlide()

    const prev = current - 1
    animateTo(prev)

    onTrackSettled(trackRef.current, () => {
      animatingRef.current = false
      const wrapped = ((prev % count) + count) % count
      if (wrapped !== prev) {
        snapTo(wrapped)
      }
      setCurrent(wrapped)
      applyProgress(0)
      startRef.current = Date.now()
      setIsAnimating(false)
    })
  }, [isAnimating, current, count, animateTo, snapTo, beginSlide, applyProgress])

  /* ── Jump to bar ── */
  const goTo = useCallback(
    (target: number) => {
      if (animatingRef.current || target === current) return
      beginSlide()

      // Find shortest path through the tripled track
      let delta = target - current
      if (delta > count / 2) delta -= count
      if (delta < -count / 2) delta += count

      animateTo(current + delta)

      onTrackSettled(trackRef.current, () => {
        animatingRef.current = false
        snapTo(target)
        setCurrent(target)
        applyProgress(0)
        startRef.current = Date.now()
        setIsAnimating(false)
      })
    },
    [isAnimating, current, count, animateTo, snapTo, beginSlide, applyProgress]
  )

  /* ── Auto-advance ── */
  useEffect(() => {
    const tick = () => {
      if (animatingRef.current) {
        // Mid-slide: run the bar out to full in step with the track.
        const k = Math.min((Date.now() - slideStartRef.current) / SLIDE_MS, 1)
        const from = slideFromRef.current
        applyProgress(from + (100 - from) * k)
      } else {
        const elapsed = Date.now() - startRef.current
        const pct = Math.min((elapsed / duration) * 100, 100)
        applyProgress(pct)
        if (pct >= 100) goNext()
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isAnimating, duration, goNext, applyProgress])

  /* ── Keyboard ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") { goPrev() }
      if (e.key === "ArrowRight") { goNext() }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [goPrev, goNext])

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
            onClick={() => goPrev()}
            aria-label="Previous project"
          >
            <ChevronLeft size={18} />
          </button>

          {/* Only the current bar fills, and a new lap starts from empty.
              The bars mark where you are in the set, not how much of it
              you have sat through — which also keeps the row honest when
              the arrows carry you backwards. */}
          <div className="endorsement-bars">
            {projects.map((_, i) => (
              <button
                key={i}
                className="endorsement-bar"
                onClick={() => goTo(i)}
                aria-label={`Go to project ${i + 1}`}
              >
                <div
                  className="endorsement-bar-fill"
                  style={{
                    width: i === current ? `${progress}%` : "0%",
                  }}
                />
              </button>
            ))}
          </div>

          <button
            className="endorsement-arrow"
            onClick={() => goNext()}
            aria-label="Next project"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </section>
  )
}
