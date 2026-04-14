"use client"

import { useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { FilterBar, type SortOption, DEFAULT_PROJECT_SORT } from "@/components/filter-bar"
import { ProjectsGrid } from "@/components/projects-grid"
import type { DiscoverProject } from "@/lib/projects/queries"

interface DiscoverClientProps {
  initialProjects: DiscoverProject[]
  initialSort?: SortOption
}

export function DiscoverClient({ initialProjects, initialSort = DEFAULT_PROJECT_SORT }: DiscoverClientProps) {
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
            <span className="discover-breadcrumb-item discover-breadcrumb-current">
              {t("breadcrumb_netherlands")}
            </span>
          </nav>

          {/* Page title */}
          <h2 className="arco-section-title">{t("browse")}</h2>

        </div>
      </div>

      {/* Results */}
      <main>
        <ProjectsGrid initialProjects={initialProjects} sortBy={sortBy} onSortChange={setSortBy} />
      </main>
    </>
  )
}
