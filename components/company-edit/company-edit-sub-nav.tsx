"use client"

import { useEffect, useState, useRef } from "react"
import { useTranslations } from "next-intl"

interface CompanyEditSubNavProps {
  statusIndicatorClass: string
  currentStatusLabel: string
  editSaveStatus: "idle" | "saving" | "saved"
  companySlug: string | null
  companyId: string
  onStatusClick: () => void
  onSearchPreviewClick: () => void
  isSetupMode?: boolean
  onCompleteSetup?: () => void
}

const SECTION_IDS = ["header", "projects", "contact"] as const

export function CompanyEditSubNav({
  statusIndicatorClass,
  currentStatusLabel,
  editSaveStatus,
  companySlug,
  companyId,
  onStatusClick,
  onSearchPreviewClick,
  isSetupMode,
  onCompleteSetup,
}: CompanyEditSubNavProps) {
  const t = useTranslations("company_edit")
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [scrollDirection, setScrollDirection] = useState<"down" | "up">("down")
  const lastScrollY = useRef(0)

  useEffect(() => {
    const handleScroll = () => {
      const currentScroll = window.scrollY
      setScrollDirection(currentScroll > lastScrollY.current ? "down" : "up")
      lastScrollY.current = currentScroll

      // Find active section (top third of viewport)
      let active: string | null = null
      for (const id of SECTION_IDS) {
        const element = document.getElementById(id)
        if (element) {
          const rect = element.getBoundingClientRect()
          if (rect.top <= window.innerHeight / 3 && rect.bottom >= 0) {
            active = id
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

    window.addEventListener("scroll", debouncedScroll, { passive: true })
    handleScroll()
    return () => {
      window.removeEventListener("scroll", debouncedScroll)
      clearTimeout(timeout)
    }
  }, [])

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault()
    const scrollTarget = targetId === "header" ? "header-anchor" : targetId
    const element = document.getElementById(scrollTarget) ?? document.getElementById(targetId)
    if (element) {
      const offsetTop = element.offsetTop - 140
      window.scrollTo({ top: offsetTop, behavior: "smooth" })
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

  const isSaving = editSaveStatus === "saving"

  return (
    <div className="sub-nav" data-direction={scrollDirection}>
      <div className="wrap">
        <div className="sub-nav-content">
          <div className="sub-nav-left">
            <div className="sub-nav-links" style={{ paddingRight: 0, marginRight: 0 }}>
              {([
                { id: "header", label: t("nav_details") },
                { id: "projects", label: t("nav_projects") },
                { id: "contact", label: t("nav_contact") },
              ]).map(({ id, label }) => (
                <a key={id} href={`#${id}`} onClick={(e) => handleClick(e, id)} className={getLinkClass(id)}>
                  {label}
                </a>
              ))}
            </div>
          </div>

          <div className="sub-nav-actions">
            {editSaveStatus !== "idle" && (
              <span style={{ fontSize: 12, color: isSaving ? "#a1a1a0" : "#016D75" }}>
                {isSaving ? t("saving_status") : t("saved_status")}
              </span>
            )}
            <button className="filter-pill" onClick={onStatusClick}>
              <span
                className={`inline-block rounded-full ${statusIndicatorClass}`}
                style={{ width: 7, height: 7, flexShrink: 0 }}
              />
              {currentStatusLabel}
            </button>
            <button className="filter-pill" onClick={onSearchPreviewClick}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="7" cy="7" r="5" />
                <path d="M14 14L10.5 10.5" />
              </svg>
              {t("search_preview")}
            </button>
            <a
              className="filter-pill"
              href={`/professionals/${companySlug || companyId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none" }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 6L11 2L7 2M11 2L5 8M6 3H3C1.89543 3 1 3.89543 1 5V12C1 13.1046 1.89543 14 3 14H10C11.1046 14 12 13.1046 12 12V9" />
              </svg>
              {t("preview")}
            </a>
            {isSetupMode && onCompleteSetup && (
              <button className="btn-primary setup-nav-cta" onClick={onCompleteSetup}>
                {t("complete_company_btn")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
