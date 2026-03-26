import Image from "next/image"
import Link from "next/link"

export interface FeaturedCompany {
  id: string
  name: string
  title: string
  location: string
  rating: number
  reviews: number
  image: string
  logoUrl?: string | null
  href: string
}

interface FeaturedCompaniesProps {
  companies: FeaturedCompany[]
}

export function FeaturedCompanies({ companies }: FeaturedCompaniesProps) {
  if (companies.length === 0) {
    return null
  }

  return (
    <section className="py-16 bg-white">
      <div className="wrap">
        <div className="section-header">
          <h2 className="arco-section-title">Featured architects</h2>
          <Link href="/professionals?services=architect" className="view-all-link">
            View all architects →
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
                      <img src={company.image} alt={company.name} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", background: "#f0f0ee" }} />
                    )}
                  </div>
                </div>

                {/* Text — logo + name + subtitle */}
                <div className="pro-card-info">
                  {company.logoUrl ? (
                    <img src={company.logoUrl} alt="" className="pro-card-logo" />
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
