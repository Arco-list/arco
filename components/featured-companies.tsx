"use client"

import Image from "next/image"
import Link from "next/link"
import { useTranslations } from "next-intl"

export interface FeaturedCompany {
  id: string
  name: string
  title: string
  location: string
  image: string
  logoUrl?: string | null
  href: string
}

interface FeaturedCompaniesProps {
  companies: FeaturedCompany[]
}

export function FeaturedCompanies({ companies }: FeaturedCompaniesProps) {
  const t = useTranslations("home")
  if (companies.length === 0) {
    return null
  }

  return (
    <section className="py-16 bg-white">
      <div className="wrap">
        <div className="section-header">
          <h2 className="arco-section-title">{t("featured_architects")}</h2>
          <Link href="/professionals?services=architect" className="view-all-link">
            {t("view_all_architects")}
          </Link>
        </div>

        <div className="discover-grid">
          {companies.map((company) => {
            const city = company.location?.split(",")[0]?.trim() || null
            const subtitle = [company.title, city].filter(Boolean).join(" · ")

            return (
              <Link
                key={company.id}
                href={company.href}
                className="discover-card"
              >
                {/* Image */}
                <div className="discover-card-image-wrap">
                  <div className="discover-card-image-layer">
                    {company.image ? (
                      // CLS fix: explicit dimensions, see projects-grid.tsx note.
                      <img
                        src={company.image}
                        alt={company.name}
                        width={600}
                        height={450}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div style={{ width: "100%", height: "100%", background: "#f0f0ee" }} />
                    )}
                  </div>
                </div>

                {/* Text — logo + name + subtitle */}
                <div className="pro-card-info">
                  {company.logoUrl ? (
                    <img
                      src={company.logoUrl}
                      alt=""
                      className="pro-card-logo"
                      width={34}
                      height={34}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="pro-card-logo pro-card-logo-placeholder">
                      {company.name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div>
                    <h3 className="discover-card-title">{company.name}</h3>
                    {subtitle && <p className="discover-card-sub">{subtitle}</p>}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
