import type { Metadata } from "next"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { FilterProvider } from "@/contexts/filter-context"
import { FilterErrorBoundary } from "@/components/filter-error-boundary"
import { DiscoverClient } from "@/components/discover-client"
import { fetchDiscoverProjects } from "@/lib/projects/queries"
import { getHubs } from "@/lib/project-hubs"
import { hubToDef } from "@/components/project/hub-page"
import { logger } from "@/lib/logger"
import { TrackPageView } from "@/components/track-view"
import { getSiteUrl } from "@/lib/utils"
import { locales, defaultLocale } from "@/i18n/config"

// SEO copy is intentionally inline (not via messages/*.json) because it's the
// most search-sensitive copy on the site and lives best in one reviewable place.
// Title pattern matches the per-detail-page convention: bare title here, the
// root layout template adds " | Arco" exactly once.
const PROJECTS_META: Record<string, { title: string; description: string }> = {
  nl: {
    title: "Architectuur- en interieurprojecten in Nederland",
    description:
      "Ontdek bijzondere architectuur-, interieur- en renovatieprojecten in Nederland. Filter op locatie, stijl en type, en vind inspiratie voor jouw volgende project.",
  },
  en: {
    title: "Architecture & interior projects in the Netherlands",
    description:
      "Discover curated architecture, interior design and renovation projects from across the Netherlands. Filter by location, style and type, and find inspiration for your next build.",
  },
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const meta = PROJECTS_META[locale] ?? PROJECTS_META.en
  const baseUrl = getSiteUrl()
  const canonical = `${baseUrl}/${locale}/projects`
  const languages = Object.fromEntries(
    locales.map((l) => [l, `${baseUrl}/${l}/projects`])
  )

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical,
      languages: { ...languages, "x-default": `${baseUrl}/${defaultLocale}/projects` },
    },
    openGraph: {
      title: `${meta.title} | Arco`,
      description: meta.description,
      url: canonical,
      type: "website",
    },
  }
}

export const revalidate = 300

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  let projects: Awaited<ReturnType<typeof fetchDiscoverProjects>> = []
  // Hub definitions let the FilterProvider swap the URL to a hub path
  // (/projects/amsterdam) when the active filter exactly matches one.
  let hubDefs: ReturnType<typeof hubToDef>[] = []
  try {
    const { cities, scopes, types, combos } = await getHubs()
    hubDefs = [...cities, ...scopes, ...types, ...combos].map(hubToDef)
  } catch { /* provider works fine without hub mapping */ }

  try {
    projects = await fetchDiscoverProjects(locale)
  } catch (error) {
    logger.error(
      "Failed to render projects discover page",
      { component: "ProjectsPage" },
      error as Error,
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <TrackPageView path="/projects" />
      <Header />

      <FilterErrorBoundary>
        <FilterProvider hubs={hubDefs}>
          <DiscoverClient initialProjects={projects} />
        </FilterProvider>
      </FilterErrorBoundary>

      <Footer />
    </div>
  )
}
