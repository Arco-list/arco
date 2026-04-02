"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useSavedProfessionals } from "@/contexts/saved-professionals-context"
import { ShareModal } from "@/components/share-modal"
import type { ProfessionalCard } from "@/lib/professionals/types"

type ProfessionalSubNavProps = {
  companyId: string
  name: string
  imageUrl: string | null
  slug: string
  profession?: string
  location?: string
  hasProjects?: boolean
}

export function ProfessionalSubNav({ companyId, name, imageUrl, slug, profession, location, hasProjects = true }: ProfessionalSubNavProps) {
  const t = useTranslations("professional_detail")
  const { savedProfessionalIds, saveProfessional, removeProfessional, mutatingProfessionalIds } = useSavedProfessionals()
  const isSaved = savedProfessionalIds.has(companyId)
  const isMutating = mutatingProfessionalIds.has(companyId)
  const [shareOpen, setShareOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<string>('details')
  const [scrollDirection, setScrollDirection] = useState<'down' | 'up'>('down')

  useEffect(() => {
    let lastScrollY = window.scrollY

    const handleScroll = () => {
      const currentScrollY = window.scrollY

      // Detect scroll direction
      if (currentScrollY > lastScrollY) {
        setScrollDirection('down')
      } else if (currentScrollY < lastScrollY) {
        setScrollDirection('up')
      }
      lastScrollY = currentScrollY

      // Find active section (top third of viewport)
      const sections = hasProjects ? ['details', 'projects', 'contact'] : ['details', 'contact']
      let active = 'details'

      for (const sectionId of sections) {
        const element = document.getElementById(sectionId)
        if (element) {
          const rect = element.getBoundingClientRect()
          if (rect.top <= window.innerHeight / 3 && rect.bottom >= 0) {
            active = sectionId
          }
        }
      }

      setActiveSection(active)
    }

    let timeout: NodeJS.Timeout
    const debouncedScroll = () => {
      clearTimeout(timeout)
      timeout = setTimeout(handleScroll, 10)
    }

    window.addEventListener('scroll', debouncedScroll, { passive: true })
    handleScroll() // Initial check

    return () => {
      window.removeEventListener('scroll', debouncedScroll)
      clearTimeout(timeout)
    }
  }, [])

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault()
    const scrollTarget = sectionId === 'details' ? 'details-anchor' : sectionId
    const element = document.getElementById(scrollTarget)
    if (element) {
      const offsetTop = element.offsetTop - 140 // Margin above section header
      window.scrollTo({
        top: offsetTop,
        behavior: 'smooth',
      })
    }
  }

  return (
    <>
    <div className="sub-nav" data-direction={scrollDirection}>
      <div className="wrap">
        <div className="sub-nav-content">
          <div className="sub-nav-left">
            <Link href="/professionals" className="sub-nav-back">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="sub-nav-back-label">{t("back")}</span>
            </Link>

            <div className="sub-nav-mobile-divider" aria-hidden="true" />

            <div className="sub-nav-links">
              <a
                href="#details"
                onClick={(e) => handleClick(e, 'details')}
                className={`sub-nav-link arco-eyebrow ${
                  activeSection === 'details'
                    ? scrollDirection === 'down' ? 'active' : 'active-reverse'
                    : ''
                }`}
              >
                {t("details")}
              </a>
              {hasProjects && (
                <a
                  href="#projects"
                  onClick={(e) => handleClick(e, 'projects')}
                  className={`sub-nav-link arco-eyebrow ${
                    activeSection === 'projects'
                      ? scrollDirection === 'down' ? 'active' : 'active-reverse'
                      : ''
                  }`}
                >
                  {t("projects")}
                </a>
              )}
              <a
                href="#contact"
                onClick={(e) => handleClick(e, 'contact')}
                className={`sub-nav-link arco-eyebrow ${
                  activeSection === 'contact'
                    ? scrollDirection === 'down' ? 'active' : 'active-reverse'
                    : ''
                }`}
              >
                {t("contact")}
              </a>
            </div>
          </div>

          <div className="sub-nav-actions">
            <button
              className="filter-pill"
              data-saved={isSaved}
              aria-label={isSaved ? "Unsave professional" : "Save professional"}
              aria-pressed={isSaved}
              disabled={isMutating}
              onClick={() => {
                if (isSaved) {
                  removeProfessional(companyId)
                } else {
                  const card: ProfessionalCard = {
                    id: companyId,
                    slug,
                    companyId,
                    professionalId: "",
                    name,
                    profession: profession ?? "Professional",
                    location: location ?? "",
                    rating: 0,
                    reviewCount: 0,
                    image: imageUrl ?? "/placeholder.svg",
                    logoUrl: null,
                    specialties: [],
                    isVerified: false,
                  }
                  saveProfessional(card)
                }
              }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 13.7C8 13.7 1.5 9.5 1.5 5.5C1.5 3.5 3.2 2 5.2 2C6.5 2 7.6 2.7 8 3.5C8.4 2.7 9.5 2 10.8 2C12.8 2 14.5 3.5 14.5 5.5C14.5 9.5 8 13.7 8 13.7Z" />
              </svg>
              <span className="sub-nav-pill-label">{isSaved ? t("saved") : t("save")}</span>
            </button>
            <button className="filter-pill" aria-label="Share professional" onClick={() => setShareOpen(true)}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 6L11 2L7 2M11 2L5 8M6 3H3C1.89543 3 1 3.89543 1 5V12C1 13.1046 1.89543 14 3 14H10C11.1046 14 12 13.1046 12 12V9" />
              </svg>
              <span className="sub-nav-pill-label">{t("share")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <ShareModal shareType="professional"
      isOpen={shareOpen}
      onClose={() => setShareOpen(false)}
      title={name}
      subtitle={profession ?? ""}
      imageUrl={imageUrl ?? "/placeholder.svg"}
      shareUrl={`/professionals/${slug}`}
    />
    </>
  )
}
