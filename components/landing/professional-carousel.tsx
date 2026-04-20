"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useTranslations } from "next-intl"

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
  pauseDuration?: number
}

const GAP = 20

export function ProfessionalCarousel({
  professionals,
  duration = 5000,
  pauseDuration = 8000,
}: ProfessionalCarouselProps) {
  const count = professionals.length
  const t = useTranslations("business")

  const [current, setCurrent] = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  const trackRef = useRef<HTMLDivElement>(null)
  const startRef = useRef(Date.now())
  const rafRef = useRef<number>()
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout>>()

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
    trackRef.current.style.transition = "transform 0.55s cubic-bezier(0.25,0.1,0.25,1)"
    trackRef.current.style.transform = `translateX(${getTranslateX(index)}px)`
  }, [getTranslateX])

  useEffect(() => {
    snapTo(current)
    const onResize = () => snapTo(current)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pauseAuto = useCallback(() => {
    setPaused(true)
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current)
    pauseTimerRef.current = setTimeout(() => {
      setPaused(false)
      startRef.current = Date.now()
    }, pauseDuration)
  }, [pauseDuration])

  const goNext = useCallback(() => {
    if (isAnimating) return
    setIsAnimating(true)
    const next = current + 1
    animateTo(next)
    const onEnd = () => {
      trackRef.current?.removeEventListener("transitionend", onEnd)
      const wrapped = ((next % count) + count) % count
      if (wrapped !== next) snapTo(wrapped)
      setCurrent(wrapped)
      setProgress(0)
      startRef.current = Date.now()
      setIsAnimating(false)
    }
    trackRef.current?.addEventListener("transitionend", onEnd)
  }, [isAnimating, current, count, animateTo, snapTo])

  const goPrev = useCallback(() => {
    if (isAnimating) return
    setIsAnimating(true)
    const prev = current - 1
    animateTo(prev)
    const onEnd = () => {
      trackRef.current?.removeEventListener("transitionend", onEnd)
      const wrapped = ((prev % count) + count) % count
      if (wrapped !== prev) snapTo(wrapped)
      setCurrent(wrapped)
      setProgress(0)
      startRef.current = Date.now()
      setIsAnimating(false)
    }
    trackRef.current?.addEventListener("transitionend", onEnd)
  }, [isAnimating, current, count, animateTo, snapTo])

  const goTo = useCallback(
    (target: number) => {
      if (isAnimating || target === current) return
      setIsAnimating(true)
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
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [paused, isAnimating, duration, goNext])

  useEffect(() => {
    return () => { if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current) }
  }, [])

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
                    width={34}
                    height={34}
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
          <button className="endorsement-arrow" onClick={() => { goPrev(); pauseAuto() }} aria-label="Previous">
            <ChevronLeft size={18} />
          </button>
          <div className="endorsement-bars">
            {professionals.map((_, i) => (
              <button
                key={i}
                className={`endorsement-bar${i < current ? " done" : ""}`}
                onClick={() => goTo(i)}
                aria-label={`Go to ${i + 1}`}
              >
                <div
                  className="endorsement-bar-fill"
                  style={{ width: i === current ? `${progress}%` : i < current ? "100%" : "0%" }}
                />
              </button>
            ))}
          </div>
          <button className="endorsement-arrow" onClick={() => { goNext(); pauseAuto() }} aria-label="Next">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </section>
  )
}
