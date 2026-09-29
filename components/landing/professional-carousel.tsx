"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import Image from "next/image"
import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"

import { onTrackSettled, SLIDE_MS } from "./track-settled"

export interface ProfessionalCarouselCard {
  id: string
  name: string
  slug: string
  service: string
  city: string | null
  heroPhotoUrl: string | null
  logoUrl: string | null
}

interface ProfessionalCarouselProps {
  professionals: ProfessionalCarouselCard[]
  duration?: number
}

const GAP = 20

export function ProfessionalCarousel({
  professionals,
  duration = 5000,
}: ProfessionalCarouselProps) {
  const count = professionals.length
  const t = useTranslations("business")

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

  const tripled = [...professionals, ...professionals, ...professionals]
  const realOffset = count

  const getCardWidth = useCallback(() => {
    if (!trackRef.current?.children[0]) return 280
    return (trackRef.current.children[0] as HTMLElement).offsetWidth
  }, [])

  const getTranslateX = useCallback((index: number) => {
    const cw = getCardWidth()
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200
    const targetPos = realOffset + index
    return (vw - cw) / 2 - targetPos * (cw + GAP)
  }, [getCardWidth, realOffset])

  const snapTo = useCallback((index: number) => {
    if (!trackRef.current) return
    trackRef.current.style.transition = "none"
    trackRef.current.style.transform = `translateX(${getTranslateX(index)}px)`
  }, [getTranslateX])

  const animateTo = useCallback((index: number) => {
    if (!trackRef.current) return
    trackRef.current.style.transition = `transform ${SLIDE_MS}ms cubic-bezier(0.25,0.1,0.25,1)`
    trackRef.current.style.transform = `translateX(${getTranslateX(index)}px)`
  }, [getTranslateX])

  useEffect(() => {
    snapTo(current)
    const onResize = () => snapTo(current)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps


  const goNext = useCallback(() => {
    if (animatingRef.current) return
    beginSlide()
    const next = current + 1
    animateTo(next)
    onTrackSettled(trackRef.current, () => {
      animatingRef.current = false
      const wrapped = ((next % count) + count) % count
      if (wrapped !== next) snapTo(wrapped)
      setCurrent(wrapped)
      applyProgress(0)
      startRef.current = Date.now()
      setIsAnimating(false)
    })
  }, [isAnimating, current, count, animateTo, snapTo, beginSlide, applyProgress])

  const goPrev = useCallback(() => {
    if (animatingRef.current) return
    beginSlide()
    const prev = current - 1
    animateTo(prev)
    onTrackSettled(trackRef.current, () => {
      animatingRef.current = false
      const wrapped = ((prev % count) + count) % count
      if (wrapped !== prev) snapTo(wrapped)
      setCurrent(wrapped)
      applyProgress(0)
      startRef.current = Date.now()
      setIsAnimating(false)
    })
  }, [isAnimating, current, count, animateTo, snapTo, beginSlide, applyProgress])

  const goTo = useCallback(
    (target: number) => {
      if (animatingRef.current || target === current) return
      beginSlide()
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
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [isAnimating, duration, goNext, applyProgress])

  if (count === 0) return null

  return (
    <section className="pb-[100px] bg-white">
      <div className="wrap">
        <div className="text-center mb-7">
          <span className="arco-eyebrow">{t("recently_added_professionals")}</span>
        </div>
      </div>

      <div className="overflow-hidden" style={{ width: "100vw", marginLeft: "calc(-50vw + 50%)" }}>
        <div ref={trackRef} className="flex will-change-transform" style={{ gap: GAP }}>
          {tripled.map((pro, i) => (
            <Link
              key={`${pro.id}-${i}`}
              href={`/professionals/${pro.slug}`}
              className="shrink-0 min-w-0 carousel-project-card no-underline text-inherit"
            >
              <div className="discover-card-image-wrap" style={{ aspectRatio: "3/2" }}>
                <div className="discover-card-image-layer">
                  {pro.heroPhotoUrl && (
                    <Image src={pro.heroPhotoUrl} alt={pro.name} width={960} height={640} />
                  )}
                </div>
              </div>
              <div className="pro-card-info">
                {pro.logoUrl ? (
                  <img
                    src={pro.logoUrl}
                    alt=""
                    className="pro-card-logo"
                    width={40}
                    height={40}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="pro-card-logo pro-card-logo-placeholder">
                    {pro.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="discover-card-title">{pro.name}</h3>
                  <p className="discover-card-sub">
                    {[pro.service, pro.city].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="wrap">
        <div className="endorsement-nav">
          <button className="endorsement-arrow" onClick={() => goPrev()} aria-label="Previous">
            <ChevronLeft size={18} />
          </button>
          {/* Only the current bar fills, and a new lap starts from empty.
              The bars mark where you are in the set, not how much of it
              you have sat through — which also keeps the row honest when
              the arrows carry you backwards. */}
          <div className="endorsement-bars">
            {professionals.map((_, i) => (
              <button
                key={i}
                className="endorsement-bar"
                onClick={() => goTo(i)}
                aria-label={`Go to ${i + 1}`}
              >
                <div
                  className="endorsement-bar-fill"
                  style={{ width: i === current ? `${progress}%` : "0%" }}
                />
              </button>
            ))}
          </div>
          <button className="endorsement-arrow" onClick={() => goNext()} aria-label="Next">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </section>
  )
}
