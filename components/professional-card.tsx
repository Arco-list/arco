"use client"

import Link from "next/link"
import { memo, useCallback, useEffect, useRef, useState } from "react"

import { ShareModal } from "@/components/share-modal"
import type { ProfessionalCard as ProfessionalCardData } from "@/lib/professionals/types"

const PLACEHOLDER_IMAGE = "/placeholder.svg?height=400&width=600"

export type ProfessionalCardProps = {
  professional: ProfessionalCardData
  isSaved: boolean
  isMutating: boolean
  onToggleSave: (professional: ProfessionalCardData) => void
  className?: string
}

export const ProfessionalCard = memo(function ProfessionalCard({
  professional,
  isSaved,
  isMutating,
  onToggleSave,
}: ProfessionalCardProps) {
  const [showServices, setShowServices] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onToggleSave(professional)
  }

  const handleShare = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShareOpen(true)
  }, [])

  const handleServicesClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowServices((prev) => !prev)
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    if (!showServices) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowServices(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showServices])

  const imageSrc = professional.image || PLACEHOLDER_IMAGE
  const logoUrl = professional.logoUrl

  // Services: first one shown inline, rest in dropdown
  const allServices = professional.specialties ?? []
  const primaryService = professional.profession || allServices[0] || "Professional services"
  const extraServices = allServices.length > 1 ? allServices.slice(1) : []

  // City only (not country)
  const city = professional.location?.split(",")[0]?.trim() || null

  // Subtitle: "Service +N · City"
  const servicePart = extraServices.length > 0
    ? `${primaryService}`
    : primaryService
  const subtitleParts = [servicePart, city].filter(Boolean)

  return (
    <>
      <Link href={`/professionals/${professional.slug}`} className="discover-card">
        {/* Image */}
        <div className="discover-card-image-wrap">
          <div className="discover-card-image-layer">
            <img src={imageSrc} alt={professional.name} />
          </div>

          {/* Save + Share */}
          <div className="discover-card-actions" data-saved={isSaved}>
            <button
              className="discover-card-action-btn"
              data-saved={isSaved}
              onClick={handleToggle}
              aria-pressed={isSaved}
              aria-label={isSaved ? "Unsave company" : "Save company"}
              disabled={isMutating}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
            </button>
            <button
              className="discover-card-action-btn"
              onClick={handleShare}
              aria-label="Share"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Text — logo spans title + subtitle */}
        <div className="pro-card-info">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="pro-card-logo" />
          ) : (
            <div className="pro-card-logo pro-card-logo-placeholder">
              {professional.name.charAt(0).toUpperCase()}
            </div>
          )}

          <div>
            <h3 className="discover-card-title">{professional.name}</h3>
            <p className="discover-card-sub">
              {servicePart}
              {extraServices.length > 0 && (
                <span className="pro-card-extra" ref={dropdownRef}>
                  <button
                    type="button"
                    className="pro-card-extra-btn"
                    onClick={handleServicesClick}
                  >
                    +{extraServices.length}
                  </button>
                  {showServices && (
                    <span className="pro-card-dropdown">
                      {allServices.map((s, i) => (
                        <span key={i} className="pro-card-dropdown-item">{s}</span>
                      ))}
                    </span>
                  )}
                </span>
              )}
              {city && <> · {city}</>}
            </p>
          </div>
        </div>
      </Link>

      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        title={professional.name}
        subtitle={[primaryService, city].filter(Boolean).join(" · ")}
        imageUrl={imageSrc}
        shareUrl={`/professionals/${professional.slug}`}
      />
    </>
  )
})
