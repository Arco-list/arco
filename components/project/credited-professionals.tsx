"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useTranslations } from "next-intl"

interface Professional {
  id: string
  companyId: string | null
  companyName: string
  companySlug: string | null
  serviceCategory: string
  serviceCategories?: string[]
  logo: string | null
  projectsCount: number
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
            const href = professional.companySlug
              ? `/professionals/${professional.companySlug}`
              : '#'

            return (
              <Link
                key={professional.id}
                href={href}
                className="credit-card"
              >
                <ServiceLabel services={professional.serviceCategories} fallback={professional.serviceCategory} />

                <div className="credit-icon">
                  {professional.logo ? (
                    <Image
                      src={professional.logo}
                      alt={professional.companyName}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <span className="credit-icon-initials">{initials}</span>
                  )}
                </div>

                <h3 className="arco-h4">{professional.companyName}</h3>
                <p className="arco-card-subtitle">
                  {t("projects_count", { count: professional.projectsCount })}
                </p>
                <span className="text-link-plain">{t("view_portfolio")} →</span>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
