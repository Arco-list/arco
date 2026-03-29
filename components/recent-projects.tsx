"use client"

import Image from "next/image"
import Link from "next/link"
import { useTranslations } from "next-intl"

export interface RecentProject {
  id: string
  title: string
  href: string
  imageUrl: string | null
  subtitle?: string
}

interface RecentProjectsProps {
  projects: RecentProject[]
}

export function RecentProjects({ projects }: RecentProjectsProps) {
  const t = useTranslations("home")
  if (projects.length === 0) {
    return null
  }

  // Need at least 6 projects for the layout
  const displayProjects = projects.slice(0, 6)

  return (
    <section className="py-16 bg-white">
      {/* UPDATED: Use .wrap class */}
      <div className="wrap">
        
        {/* Header */}
        <div className="editorial-header">
          <h2 className="editorial-title">{t("recent_projects")}</h2>
          <Link href="/projects" className="view-all-link">
            {t("view_all_projects")}
          </Link>
        </div>

        {/* Row 1: 1 Large (A) + 2 Stacked (B, C) */}
        <div className="editorial-row-1">
          {/* Large Card (A) */}
          {displayProjects[0] && (
            <Link href={displayProjects[0].href} className="ed-card ed-card-large">
              <div className="ed-img">
                {displayProjects[0].imageUrl ? (
                  <Image
                    src={displayProjects[0].imageUrl}
                    alt={displayProjects[0].title}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200" />
                )}
              </div>
              <div className="ed-info">
                <h3 className="ed-name">{displayProjects[0].title}</h3>
                {displayProjects[0].subtitle && (
                  <p className="ed-by">{displayProjects[0].subtitle}</p>
                )}
              </div>
            </Link>
          )}

          {/* Stacked Cards (B, C) */}
          <div className="ed-stack">
            {displayProjects[1] && (
              <Link href={displayProjects[1].href} className="ed-card">
                <div className="ed-img">
                  {displayProjects[1].imageUrl ? (
                    <Image
                      src={displayProjects[1].imageUrl}
                      alt={displayProjects[1].title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200" />
                  )}
                </div>
                <div className="ed-info">
                  <h3 className="ed-name">{displayProjects[1].title}</h3>
                  {displayProjects[1].subtitle && (
                    <p className="ed-by">{displayProjects[1].subtitle}</p>
                  )}
                </div>
              </Link>
            )}

            {displayProjects[2] && (
              <Link href={displayProjects[2].href} className="ed-card">
                <div className="ed-img">
                  {displayProjects[2].imageUrl ? (
                    <Image
                      src={displayProjects[2].imageUrl}
                      alt={displayProjects[2].title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200" />
                  )}
                </div>
                <div className="ed-info">
                  <h3 className="ed-name">{displayProjects[2].title}</h3>
                  {displayProjects[2].subtitle && (
                    <p className="ed-by">{displayProjects[2].subtitle}</p>
                  )}
                </div>
              </Link>
            )}
          </div>
        </div>

        {/* Row 2: 3 Equal Cards (D, E, F) */}
        <div className="editorial-row-2">
          {displayProjects[3] && (
            <Link href={displayProjects[3].href} className="ed-card">
              <div className="ed-img">
                {displayProjects[3].imageUrl ? (
                  <Image
                    src={displayProjects[3].imageUrl}
                    alt={displayProjects[3].title}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200" />
                )}
              </div>
              <div className="ed-info">
                <h3 className="ed-name">{displayProjects[3].title}</h3>
                {displayProjects[3].subtitle && (
                  <p className="ed-by">{displayProjects[3].subtitle}</p>
                )}
              </div>
            </Link>
          )}

          {displayProjects[4] && (
            <Link href={displayProjects[4].href} className="ed-card">
              <div className="ed-img">
                {displayProjects[4].imageUrl ? (
                  <Image
                    src={displayProjects[4].imageUrl}
                    alt={displayProjects[4].title}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200" />
                )}
              </div>
              <div className="ed-info">
                <h3 className="ed-name">{displayProjects[4].title}</h3>
                {displayProjects[4].subtitle && (
                  <p className="ed-by">{displayProjects[4].subtitle}</p>
                )}
              </div>
            </Link>
          )}

          {displayProjects[5] && (
            <Link href={displayProjects[5].href} className="ed-card">
              <div className="ed-img">
                {displayProjects[5].imageUrl ? (
                  <Image
                    src={displayProjects[5].imageUrl}
                    alt={displayProjects[5].title}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200" />
                )}
              </div>
              <div className="ed-info">
                <h3 className="ed-name">{displayProjects[5].title}</h3>
                {displayProjects[5].subtitle && (
                  <p className="ed-by">{displayProjects[5].subtitle}</p>
                )}
              </div>
            </Link>
          )}
        </div>

      </div>
    </section>
  )
}
