// components/featured-companies.tsx
// Featured Studios section - UPDATED to match design system

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
      {/* UPDATED: Use .wrap class */}
      <div className="wrap">
        {/* UPDATED: Use section-header pattern */}
        <div className="section-header">
          <h2 className="arco-section-title">Featured Studios</h2>
          <Link href="/professionals" className="view-all-link">
            View all studios →
          </Link>
        </div>

        {/* Studio grid - 4 columns desktop */}
        <div className="studio-grid">
          {companies.map((company) => (
            <Link
              key={company.id}
              href={company.href}
              className="studio-card"
            >
              {/* Image - 4:3 aspect ratio */}
              <div className="studio-img">
                {company.image ? (
                  <Image
                    src={company.image}
                    alt={company.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200" />
                )}
              </div>

              {/* UPDATED: Use arco-card-title class, removed Latest subtitle */}
              <div className="studio-info">
                <h3 className="arco-card-title" style={{ marginBottom: '2px' }}>{company.name}</h3>
                <p className="arco-card-subtitle">{company.location}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
