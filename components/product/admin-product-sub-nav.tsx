"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ExternalLink } from "lucide-react"

type ProductStatus = "listed" | "unlisted" | string

type AdminProductSubNavProps = {
  status: ProductStatus
  onStatusClick: () => void
  previewHref: string
  hasGallery: boolean
  hasSpecs: boolean
}

/**
 * Admin variant of the public ProductSubNav:
 *   - Back link points at /admin/products instead of /products.
 *   - Section links cover Details / Photos / Specs (no Colors — those live
 *     inside Details — and no Related — cut per design review).
 *   - Right-side pills show Status (clickable, opens status modal) and
 *     Preview (opens the public page in a new tab).
 */
export function AdminProductSubNav({
  status,
  onStatusClick,
  previewHref,
  hasGallery,
  hasSpecs,
}: AdminProductSubNavProps) {
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [scrollDirection, setScrollDirection] = useState<"down" | "up">("down")
  const lastScrollY = useRef(0)

  useEffect(() => {
    const sectionIds = ["details", "gallery", "specs"]

    const updateActiveSection = () => {
      const currentScroll = window.scrollY
      setScrollDirection(currentScroll > lastScrollY.current ? "down" : "up")
      lastScrollY.current = currentScroll

      const scrollPosition = window.scrollY + window.innerHeight / 3
      let newActive: string | null = null

      for (const id of sectionIds) {
        const el = document.getElementById(id)
        if (el) {
          const top = el.offsetTop
          const bottom = top + el.offsetHeight
          if (scrollPosition >= top && scrollPosition < bottom) {
            newActive = id
          }
        }
      }

      setActiveSection(newActive)
    }

    let raf: number
    const handleScroll = () => {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(updateActiveSection)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    updateActiveSection()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault()
    const target = document.getElementById(targetId)
    if (target) {
      window.scrollTo({ top: target.offsetTop - 140, behavior: "smooth" })
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

  const dotColor =
    status === "listed" ? "#22c55e"
    : status === "draft" ? "#f59e0b"
    : status === "deactivated" ? "#ef4444"
    : "#c8c8c6"

  return (
    <div className="sub-nav" data-direction={scrollDirection}>
      <div className="wrap">
        <div className="sub-nav-content">
          <div className="sub-nav-left">
            <Link href="/admin/products" className="sub-nav-back">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="sub-nav-back-label">Products</span>
            </Link>

            <div className="sub-nav-mobile-divider" aria-hidden="true" />

            <div className="sub-nav-links">
              <a href="#details" onClick={(e) => handleClick(e, "details")} className={getLinkClass("details")}>
                Details
              </a>
              {hasGallery && (
                <a href="#gallery" onClick={(e) => handleClick(e, "gallery")} className={getLinkClass("gallery")}>
                  Photos
                </a>
              )}
              {hasSpecs && (
                <a href="#specs" onClick={(e) => handleClick(e, "specs")} className={getLinkClass("specs")}>
                  Specs
                </a>
              )}
            </div>
          </div>

          <div className="sub-nav-actions" style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="filter-pill"
              onClick={onStatusClick}
              aria-label="Update product status"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <span
                style={{ width: 7, height: 7, borderRadius: 9999, background: dotColor, flexShrink: 0 }}
              />
              <span className="sub-nav-pill-label" style={{ textTransform: "capitalize" }}>{status}</span>
            </button>

            <a
              href={previewHref}
              target="_blank"
              rel="noopener noreferrer"
              className="filter-pill"
              aria-label="Preview on public site"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <ExternalLink size={13} />
              <span className="sub-nav-pill-label">Preview</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
