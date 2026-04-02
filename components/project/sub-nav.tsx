"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useSavedProjects } from "@/contexts/saved-projects-context"
import { ShareModal } from "@/components/share-modal"

type SubNavProps = {
  projectId: string
  title: string
  subtitle?: string
  imageUrl: string | null
  slug: string
}

export function SubNav({ projectId, title, subtitle = "", imageUrl, slug }: SubNavProps) {
  const t = useTranslations("project_detail")
  const { savedProjectIds, saveProject, removeProject, mutatingProjectIds } = useSavedProjects()
  const isSaved = savedProjectIds.has(projectId)
  const isMutating = mutatingProjectIds.has(projectId)
  const [shareOpen, setShareOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [scrollDirection, setScrollDirection] = useState<'down' | 'up'>('down')
  const lastScrollY = useRef(0)

  useEffect(() => {
    const sections = [
      { id: 'details',       element: document.getElementById('details') },
      { id: 'photo-tour',    element: document.getElementById('photo-tour') },
      { id: 'professionals', element: document.getElementById('professionals') },
    ]

    const updateActiveSection = () => {
      const currentScroll = window.scrollY
      const direction = currentScroll > lastScrollY.current ? 'down' : 'up'
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

    window.addEventListener('scroll', handleScroll, { passive: true })
    updateActiveSection()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault()
    const target = document.getElementById(targetId)
    if (target) {
      window.scrollTo({ top: target.offsetTop - 140, behavior: 'smooth' })
    }
  }

  const getLinkClass = (sectionId: string) => {
    const isActive = activeSection === sectionId
    return `sub-nav-link arco-eyebrow${
      isActive
        ? scrollDirection === 'down' ? ' active' : ' active-reverse'
        : ''
    }`
  }

  return (
    <>
      <div className="sub-nav" data-direction={scrollDirection}>
        <div className="wrap">
          <div className="sub-nav-content">

            <div className="sub-nav-left">
              {/* Back button — keeps existing vertical border-right via .sub-nav-back CSS */}
              <Link href="/projects" className="sub-nav-back">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M10 12L6 8L10 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="sub-nav-back-label">{t("back")}</span>
              </Link>

              {/*
                Mobile-only horizontal divider.
                Hidden on desktop via the <style> block above.
                On mobile the .sub-nav-left flex container should be
                flex-direction: column so this renders as a full-width rule.
              */}
              <div className="sub-nav-mobile-divider" aria-hidden="true" />

              {/* Nav links — Details / Photos / Professionals */}
              <div className="sub-nav-links">
                <a
                  href="#details"
                  onClick={(e) => handleClick(e, 'details')}
                  className={getLinkClass('details')}
                >
                  {t("nav_details")}
                </a>
                <a
                  href="#photo-tour"
                  onClick={(e) => handleClick(e, 'photo-tour')}
                  className={getLinkClass('photo-tour')}
                >
                  {t("nav_photos")}
                </a>
                <a
                  href="#professionals"
                  onClick={(e) => handleClick(e, 'professionals')}
                  className={getLinkClass('professionals')}
                >
                  {t("nav_professionals")}
                </a>
              </div>
            </div>

            {/* Actions */}
            <div className="sub-nav-actions">
              <button
                className="filter-pill"
                data-saved={isSaved}
                aria-label={isSaved ? "Unsave project" : "Save project"}
                aria-pressed={isSaved}
                disabled={isMutating}
                onClick={() => {
                  if (isSaved) {
                    removeProject(projectId)
                  } else {
                    saveProject(projectId)
                  }
                }}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 13.7C8 13.7 1.5 9.5 1.5 5.5C1.5 3.5 3.2 2 5.2 2C6.5 2 7.6 2.7 8 3.5C8.4 2.7 9.5 2 10.8 2C12.8 2 14.5 3.5 14.5 5.5C14.5 9.5 8 13.7 8 13.7Z" />
                </svg>
                <span className="sub-nav-pill-label">{isSaved ? t("saved") : t("save")}</span>
              </button>
              <button className="filter-pill" aria-label="Share project" onClick={() => setShareOpen(true)}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 6L11 2L7 2M11 2L5 8M6 3H3C1.89543 3 1 3.89543 1 5V12C1 13.1046 1.89543 14 3 14H10C11.1046 14 12 13.1046 12 12V9" />
                </svg>
                <span className="sub-nav-pill-label">{t("share")}</span>
              </button>
            </div>

          </div>
        </div>
      </div>

      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        title={title}
        subtitle={subtitle}
        imageUrl={imageUrl ?? "/placeholder.svg"}
        shareUrl={`/projects/${slug}`}
      />
    </>
  )
}
