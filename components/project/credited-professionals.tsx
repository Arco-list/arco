"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "@/i18n/navigation"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { ArrowRight } from "lucide-react"

import { resolveProfessionalServiceIcon } from "@/lib/icons/professional-services"

interface Professional {
  id: string
  companyId: string | null
  companyName: string
  companySlug: string | null
  serviceCategory: string
  serviceCategories?: string[]
  logo: string | null
  projectsCount: number
  /** Claimed and publicly visible — only then is there a page to link to. */
  hasPage?: boolean
  /** Category slug, used to pick a stand-in icon when there is no logo. */
  serviceSlug?: string | null
}

interface CreditedProfessionalsProps {
  professionals: Professional[]
}

function ServiceLabel({ services, fallback }: { services?: string[]; fallback: string }) {
  const [showDropdown, setShowDropdown] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setShowDropdown(prev => !prev)
  }, [])

  useEffect(() => {
    if (!showDropdown) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showDropdown])

  if (!services || services.length === 0) {
    return <span className="arco-eyebrow">{fallback}</span>
  }

  if (services.length === 1) {
    return <span className="arco-eyebrow">{services[0]}</span>
  }

  // Match professional discover card: first service inline, +N for rest
  const primaryService = services[0]
  const extraCount = services.length - 1

  return (
    <span className="arco-eyebrow">
      {primaryService}
      <span className="pro-card-extra" ref={ref}>
        <button type="button" className="pro-card-extra-btn" onClick={handleClick}>
          +{extraCount}
        </button>
        {showDropdown && (
          <span className="pro-card-dropdown">
            {services.map((s, i) => (
              <span key={i} className="pro-card-dropdown-item">{s}</span>
            ))}
          </span>
        )}
      </span>
    </span>
  )
}

export function CreditedProfessionals({ professionals }: CreditedProfessionalsProps) {
  const t = useTranslations("project_detail")
  if (professionals.length === 0) return null

  // Get initials from company name
  const getInitials = (name: string) => {
    const words = name.split(' ')
    if (words.length >= 2) {
      return words[0][0] + words[1][0]
    }
    return words[0].substring(0, 2)
  }

  return (
    <section id="professionals" className="credits-section">
      <div className="wrap">
        <div className="credits-header">
          <h2 className="arco-section-title">{t("credited_professionals")}</h2>
          <p className="arco-body-text" style={{ maxWidth: '800px', margin: '12px 0 0', textAlign: 'left' }}>
            {t("credited_subtitle")}
          </p>
        </div>

        <div className="credits-grid">
          {professionals.map((professional) => {
            const initials = getInitials(professional.companyName)
            // Every credit shows the same way — service, icon, name. Only
            // a claimed company has a page behind it, so only that one is
            // a link; the rest are plain text rather than dead links.
            const href = professional.hasPage && professional.companySlug
              ? `/professionals/${professional.companySlug}`
              : null

            const body = (
              <>
                <ServiceLabel services={professional.serviceCategories} fallback={professional.serviceCategory} />

                <div className="credit-icon">
                  {professional.logo ? (
                    <Image
                      src={professional.logo}
                      alt={professional.companyName}
                      fill
                      className="object-contain"
                    />
                  ) : (
                    // Initials of a company you have never heard of say
                    // nothing. The service icon at least tells you what
                    // this firm did on the project, until they upload a
                    // logo of their own.
                    (() => {
                      const Icon = resolveProfessionalServiceIcon(
                        professional.serviceSlug,
                        professional.serviceCategories?.[0] ?? professional.serviceCategory,
                      )
                      return <Icon className="credit-icon-service" strokeWidth={1} aria-hidden />
                    })()
                  )}
                </div>

                <h3 className="arco-label">{professional.companyName}</h3>
                {/* The project count IS the way through to the portfolio,
                    so it carries the link instead of a separate row. */}
                {href && (
                  <p className="credit-card-projects">
                    {/* The label wears the hover underline on its own, so
                        the rule is not drawn under the arrow too. */}
                    <span className="credit-card-projects-label">
                      {t("projects_count", { count: professional.projectsCount })}
                    </span>
                    {/* The count is the only thing on the card that leads
                        anywhere; the arrow is what says so. */}
                    <ArrowRight className="credit-card-arrow" size={14} strokeWidth={1.5} aria-hidden />
                  </p>
                )}
              </>
            )

            return href ? (
              <Link key={professional.id} href={href} className="credit-card">
                {body}
              </Link>
            ) : (
              <div key={professional.id} className="credit-card credit-card--plain">
                {body}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
