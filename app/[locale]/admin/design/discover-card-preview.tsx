"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

// Three solid colors used as photo placeholders so the scroll UX (prev /
// next + dots) is demonstrable without real images.
const PHOTOS_PER_CARD = ["#a1a1a0", "#7a7a78", "#c4c4c2"]

const CARDS = [
  { title: "Contemporary Villa", subtitle: "Villa · Amsterdam" },
  { title: "Modern Townhouse", subtitle: "Townhouse · Utrecht" },
  { title: "Coastal Retreat", subtitle: "House · Zandvoort" },
]

export function DiscoverCardPreview() {
  const [photoIdx, setPhotoIdx] = useState<Record<number, number>>({})
  const [saved, setSaved] = useState<Record<number, boolean>>({})

  return (
    <div className="discover-grid">
      {CARDS.map((card, i) => {
        const idx = photoIdx[i] ?? 0
        const isSaved = saved[i] ?? false
        return (
          <div key={i} className="discover-card" style={{ cursor: "default" }}>
            <div className="discover-card-image-wrap">
              <div
                className="discover-card-image-layer"
                style={{
                  background: PHOTOS_PER_CARD[idx],
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(255,255,255,0.55)",
                  fontFamily: "monospace",
                  fontSize: 11,
                }}
              >
                Photo {idx + 1} / {PHOTOS_PER_CARD.length}
              </div>

              <div className="discover-card-nav-arrows">
                <button
                  className="discover-card-nav-arrow"
                  onClick={(e) => {
                    e.preventDefault()
                    setPhotoIdx((prev) => {
                      const cur = prev[i] ?? 0
                      const next = (cur - 1 + PHOTOS_PER_CARD.length) % PHOTOS_PER_CARD.length
                      return { ...prev, [i]: next }
                    })
                  }}
                  aria-label="Previous photo"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  className="discover-card-nav-arrow"
                  onClick={(e) => {
                    e.preventDefault()
                    setPhotoIdx((prev) => {
                      const cur = prev[i] ?? 0
                      const next = (cur + 1) % PHOTOS_PER_CARD.length
                      return { ...prev, [i]: next }
                    })
                  }}
                  aria-label="Next photo"
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              <div className="discover-card-dots">
                {PHOTOS_PER_CARD.map((_, dotIdx) => (
                  <span
                    key={dotIdx}
                    className={`discover-card-dot${dotIdx === idx ? " active" : ""}`}
                  />
                ))}
              </div>

              <div className="discover-card-actions" data-saved={isSaved}>
                <button
                  className="discover-card-action-btn"
                  data-saved={isSaved}
                  onClick={(e) => {
                    e.preventDefault()
                    setSaved((prev) => ({ ...prev, [i]: !prev[i] }))
                  }}
                  aria-pressed={isSaved}
                  aria-label={isSaved ? "Unsave project" : "Save project"}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                  </svg>
                </button>
                <button
                  className="discover-card-action-btn"
                  onClick={(e) => e.preventDefault()}
                  aria-label="Share project"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                </button>
              </div>
            </div>

            <h3 className="discover-card-title">{card.title}</h3>
            <p className="discover-card-sub">{card.subtitle}</p>
          </div>
        )
      })}
    </div>
  )
}
