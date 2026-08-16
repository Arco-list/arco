"use client"

import { useState } from "react"
import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { FilterBar, type SortOption, DEFAULT_PROJECT_SORT } from "@/components/filter-bar"
import { ProjectsGrid } from "@/components/projects-grid"
import type { DiscoverProject } from "@/lib/projects/queries"

interface DiscoverClientProps {
  initialProjects: DiscoverProject[]
  initialSort?: SortOption
  /** Hub mode: overrides the page identity (H1, intro, breadcrumb tail)
   *  when the discover page renders as a hub (/projects/amsterdam). */
  hubHeader?: {
    title: string
    intro: string
    crumb: string
  }
  /** Server-rendered extras below the grid on hub pages (sibling-hub
   *  links, all-projects link). */
  hubFooter?: React.ReactNode
}

export function DiscoverClient({ initialProjects, initialSort = DEFAULT_PROJECT_SORT, hubHeader, hubFooter }: DiscoverClientProps) {
  const [sortBy, setSortBy] = useState<SortOption>(initialSort)
  const t = useTranslations("projects")

  return (
    <>
      {/* Filter bar — sticky directly below header */}
      <FilterBar sortBy={sortBy} onSortChange={setSortBy} />

      {/* Page title section — below filter bar */}
      <div className="discover-page-title">
        <div className="wrap">

          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="discover-breadcrumb">
            <Link href="/projects" className="discover-breadcrumb-item">
              {t("title")}
            </Link>
            <span className="discover-breadcrumb-sep" aria-hidden="true">›</span>
            {hubHeader ? (
              <>
                <Link href="/projects" className="discover-breadcrumb-item">
                  {t("breadcrumb_netherlands")}
                </Link>
                <span className="discover-breadcrumb-sep" aria-hidden="true">›</span>
                <span className="discover-breadcrumb-item discover-breadcrumb-current">
                  {hubHeader.crumb}
                </span>
              </>
            ) : (
              <span className="discover-breadcrumb-item discover-breadcrumb-current">
                {t("breadcrumb_netherlands")}
              </span>
            )}
          </nav>

          {/* Page title — hub pages carry their search-targeted H1 */}
          {hubHeader ? (
            <>
              <h1 className="arco-section-title">{hubHeader.title}</h1>
              <p className="arco-body-text" style={{ color: "#6b6b68", marginTop: 8, maxWidth: 560 }}>
                {hubHeader.intro}
              </p>
            </>
          ) : (
            <h2 className="arco-section-title">{t("browse")}</h2>
          )}

        </div>
      </div>

      {/* Results */}
      <main>
        <ProjectsGrid initialProjects={initialProjects} sortBy={sortBy} onSortChange={setSortBy} />
        {hubFooter}
      </main>
    </>
  )
}
