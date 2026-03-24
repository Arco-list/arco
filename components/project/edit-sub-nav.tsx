"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"

interface EditSubNavProps {
  statusIndicatorClass: string
  currentStatusLabel: string
  editSaveStatus: "idle" | "saving" | "saved"
  detailsSaving: boolean
  locationSaving: boolean
  onStatusClick: () => void
  projectSlug?: string | null
  projectStatus?: string | null
  onSubmitForReview?: () => void
  isSubmitting?: boolean
  isAdminReview?: boolean
  onApprove?: () => void
  onReject?: () => void
  isApproving?: boolean
}

export function EditSubNav({
  statusIndicatorClass,
  currentStatusLabel,
  editSaveStatus,
  detailsSaving,
  locationSaving,
  onStatusClick,
  projectSlug,
  projectStatus,
  onSubmitForReview,
  isSubmitting = false,
  isAdminReview = false,
  onApprove,
  onReject,
  isApproving = false,
}: EditSubNavProps) {
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [scrollDirection, setScrollDirection] = useState<"down" | "up">("down")
  const lastScrollY = useRef(0)

  useEffect(() => {
    const sections = [
      { id: "details",       element: document.getElementById("details") },
      { id: "photos",        element: document.getElementById("photos") },
      { id: "professionals", element: document.getElementById("professionals") },
    ]

    const updateActiveSection = () => {
      const currentScroll = window.scrollY
      const direction = currentScroll > lastScrollY.current ? "down" : "up"
      setScrollDirection(direction)
      lastScrollY.current = currentScroll

      const scrollPosition = window.scrollY + window.innerHeight / 3
      let newActive: string | null = null

      sections.forEach(({ id, element }) => {
        if (element) {
          const sectionTop = element.offsetTop
          const sectionBottom = sectionTop + element.offsetHeight
          if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
            newActive = id
          }
        }
      })

      setActiveSection(newActive)
    }

    let scrollTimeout: number
    const handleScroll = () => {
      if (scrollTimeout) window.cancelAnimationFrame(scrollTimeout)
      scrollTimeout = window.requestAnimationFrame(updateActiveSection)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    updateActiveSection()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault()
    const target = document.getElementById(targetId)
    if (target) {
      window.scrollTo({ top: target.offsetTop - 120, behavior: "smooth" })
    }
  }

  const getLinkClass = (sectionId: string) => {
    const isActive = activeSection === sectionId
    return `sub-nav-link arco-eyebrow${
      isActive
        ? scrollDirection === "down" ? " active" : " active-reverse"
        : ""
    }`
  }

  const isSaving = editSaveStatus === "saving" || detailsSaving || locationSaving
  const showSaveStatus = editSaveStatus !== "idle" || detailsSaving || locationSaving

  return (
    <div className="sub-nav" data-direction={scrollDirection}>
      <div className="wrap">
        <div className="sub-nav-content">

          <div className="sub-nav-left">
            {/* Back link — .sub-nav-back provides the vertical border-right */}
            <Link href={isAdminReview ? "/admin/projects" : "/dashboard/listings"} className="sub-nav-back">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M10 12L6 8L10 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {isAdminReview ? "Projects" : "Listings"}
            </Link>

            {/* Section links */}
            <div className="sub-nav-links" style={{ paddingRight: 0, marginRight: 0 }}>
              <a href="#details" onClick={(e) => handleClick(e, "details")} className={getLinkClass("details")}>
                Details
              </a>
              <a href="#photos" onClick={(e) => handleClick(e, "photos")} className={getLinkClass("photos")}>
                Photos
              </a>
              <a href="#professionals" onClick={(e) => handleClick(e, "professionals")} className={getLinkClass("professionals")}>
                Professionals
              </a>
            </div>
          </div>

          {/* Right: save indicator + status */}
          <div className="sub-nav-actions">
            {!isAdminReview && showSaveStatus && (
              <span style={{ fontSize: 12, color: isSaving ? "#a1a1a0" : "#016D75" }}>
                {isSaving ? "Saving…" : "✓ Saved"}
              </span>
            )}
            {!isAdminReview && (
              <button className="filter-pill" onClick={onStatusClick}>
                <span
                  className={`inline-block rounded-full ${statusIndicatorClass}`}
                  style={{ width: 7, height: 7, flexShrink: 0 }}
                />
                {currentStatusLabel}
              </button>
            )}
            {projectSlug && (
              <a
                href={`/projects/${projectSlug}${projectStatus === "draft" || projectStatus === "in_progress" ? "?preview=1" : ""}`}
                target="_blank"
                rel="noopener noreferrer"
                className="filter-pill"
                style={{ textDecoration: "none" }}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 6L11 2L7 2M11 2L5 8M6 3H3C1.89543 3 1 3.89543 1 5V12C1 13.1046 1.89543 14 3 14H10C11.1046 14 12 13.1046 12 12V9" />
                </svg>
                Preview
              </a>
            )}
            {!isAdminReview && projectStatus === "draft" && onSubmitForReview && (
              <button
                className="btn-primary setup-nav-cta"
                onClick={onSubmitForReview}
                disabled={isSubmitting}
                style={isSubmitting ? { opacity: 0.5 } : undefined}
              >
                {isSubmitting ? "Submitting…" : "Submit for review"}
              </button>
            )}
            {isAdminReview && (
              <>
                <button
                  className="btn-tertiary"
                  onClick={onReject}
                  disabled={isApproving}
                  style={{ fontSize: 13, padding: "6px 16px" }}
                >
                  Reject
                </button>
                <button
                  className="btn-primary"
                  onClick={onApprove}
                  disabled={isApproving}
                  style={{ fontSize: 13, padding: "6px 16px" }}
                >
                  {isApproving ? "Approving…" : "Approve"}
                </button>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
