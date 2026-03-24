"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

export interface Endorsement {
  quote: string
  name: string
  role: string
  initials: string
}

interface EndorsementCarouselProps {
  endorsements: Endorsement[]
  subtitle?: string
  duration?: number
}

export function EndorsementCarousel({
  endorsements,
  subtitle,
  duration = 5000,
}: EndorsementCarouselProps) {
  const [index, setIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const startRef = useRef(Date.now())
  const rafRef = useRef<number>()

  const count = endorsements.length

  const goTo = useCallback(
    (i: number) => {
      setIndex(((i % count) + count) % count)
      setProgress(0)
      startRef.current = Date.now()
      setPaused(true)
      setTimeout(() => setPaused(false), 8000)
    },
    [count]
  )

  // Animation loop
  useEffect(() => {
    const tick = () => {
      if (!paused) {
        const elapsed = Date.now() - startRef.current
        const pct = Math.min((elapsed / duration) * 100, 100)
        setProgress(pct)

        if (pct >= 100) {
          setIndex((prev) => (prev + 1) % count)
          setProgress(0)
          startRef.current = Date.now()
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [paused, duration, count])

  // Reset timer when paused state changes back to false
  useEffect(() => {
    if (!paused) {
      startRef.current = Date.now()
    }
  }, [paused])

  if (count === 0) return null

  const current = endorsements[index]

  return (
    <section className="endorsement-section">
      <div className="wrap">
        <div className="endorsement-carousel">
          {/* Slide */}
          <div key={index} className="endorsement-slide active">
            <p className="endorsement-quote">&ldquo;{current.quote}&rdquo;</p>
            <div className="endorsement-author">
              <div className="endorsement-avatar">{current.initials}</div>
              <div className="endorsement-meta">
                <div className="endorsement-name">{current.name}</div>
                <div className="endorsement-role">{current.role}</div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          {count > 1 && (
            <div className="endorsement-nav">
              <button
                className="endorsement-arrow"
                onClick={() => goTo(index - 1)}
                aria-label="Previous quote"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="endorsement-bars">
                {endorsements.map((_, i) => (
                  <button
                    key={i}
                    className={`endorsement-bar${i < index ? " done" : ""}`}
                    onClick={() => goTo(i)}
                    aria-label={`Go to quote ${i + 1}`}
                  >
                    <div
                      className="endorsement-bar-fill"
                      style={{
                        width:
                          i === index
                            ? `${progress}%`
                            : i < index
                              ? "100%"
                              : "0%",
                      }}
                    />
                  </button>
                ))}
              </div>

              <button
                className="endorsement-arrow"
                onClick={() => goTo(index + 1)}
                aria-label="Next quote"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}

          {/* Subtitle */}
          {subtitle && (
            <p className="arco-body-text endorsement-subtitle">{subtitle}</p>
          )}
        </div>
      </div>
    </section>
  )
}
