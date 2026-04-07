import Link from "next/link"
import Image from "next/image"
import { getTranslations } from "next-intl/server"

interface SimilarStudio {
  id: string
  slug: string
  name: string
  city: string | null
  country: string | null
  serviceLabel: string | null
  imageUrl: string | null
  logoUrl: string | null
}

interface SimilarStudiosProps {
  studios: SimilarStudio[]
}

/**
 * "Similar studios" rail on company detail pages — peer companies sharing
 * the same primary service category and country, excluding the current
 * company. Sister to ProfessionalProjects (which links *down* into the
 * studio's own work). Together they give every company page outbound
 * links in two directions: down to its own projects, and across to peers.
 *
 * Server component on purpose: pure link metadata, no interactivity.
 */
export async function SimilarStudios({ studios }: SimilarStudiosProps) {
  if (studios.length === 0) return null

  const t = await getTranslations("professional_detail")

  const getInitials = (name: string) => {
    const words = name.split(" ")
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
    return name.substring(0, 2).toUpperCase()
  }

  return (
    <section className="related-projects">
      <div className="wrap">
        <div className="related-header">
          <h2 className="arco-section-title">{t("similar_studios")}</h2>
        </div>

        <div className="discover-grid">
          {studios.map((studio) => {
            const subtitle = [studio.serviceLabel, studio.city || studio.country]
              .filter(Boolean)
              .join(" · ")

            return (
              <Link key={studio.id} href={`/professionals/${studio.slug}`} className="related-card">
                <div className="related-image-container">
                  {studio.imageUrl ? (
                    <Image
                      src={studio.imageUrl}
                      alt={studio.name}
                      width={600}
                      height={450}
                      className="related-image"
                    />
                  ) : studio.logoUrl ? (
                    <Image
                      src={studio.logoUrl}
                      alt={studio.name}
                      width={600}
                      height={450}
                      className="related-image"
                    />
                  ) : (
                    <div className="w-full h-full bg-surface flex items-center justify-center">
                      <span className="arco-h2" style={{ opacity: 0.4 }}>
                        {getInitials(studio.name)}
                      </span>
                    </div>
                  )}
                </div>

                <h3 className="related-title">{studio.name}</h3>
                {subtitle && <p className="related-subtitle">{subtitle}</p>}
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
