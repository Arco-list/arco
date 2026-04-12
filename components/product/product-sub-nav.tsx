"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { ShareModal } from "@/components/share-modal"

type ProductSubNavProps = {
  productName: string
  brandName: string
  imageUrl: string | null
  slug: string
  hasGallery: boolean
  hasSpecs: boolean
}

export function ProductSubNav({ productName, brandName, imageUrl, slug, hasGallery, hasSpecs }: ProductSubNavProps) {
  const [shareOpen, setShareOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [scrollDirection, setScrollDirection] = useState<"down" | "up">("down")
  const lastScrollY = useRef(0)

  useEffect(() => {
    const sectionIds = ["details", "gallery", "specs", "related"]

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

  return (
    <>
      <div className="sub-nav" data-direction={scrollDirection}>
        <div className="wrap">
          <div className="sub-nav-content">
            <div className="sub-nav-left">
              <Link href="/products" className="sub-nav-back">
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
                <a href="#related" onClick={(e) => handleClick(e, "related")} className={getLinkClass("related")}>
                  Related
                </a>
              </div>
            </div>

            <div className="sub-nav-actions">
              <button className="filter-pill" aria-label="Share product" onClick={() => setShareOpen(true)}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 6L11 2L7 2M11 2L5 8M6 3H3C1.89543 3 1 3.89543 1 5V12C1 13.1046 1.89543 14 3 14H10C11.1046 14 12 13.1046 12 12V9" />
                </svg>
                <span className="sub-nav-pill-label">Share</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        title={productName}
        subtitle={brandName}
        imageUrl={imageUrl ?? "/placeholder.svg"}
        shareUrl={`/products/${slug}`}
      />
    </>
  )
}
