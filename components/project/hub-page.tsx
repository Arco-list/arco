import { getTranslations } from "next-intl/server"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Link } from "@/i18n/navigation"
import { SimilarProjectCard } from "@/components/project/similar-projects"
import { getProjectTranslation, translateScope, canonicalizeScope } from "@/lib/project-translations"
import { getSiteUrl } from "@/lib/utils"
import { HUB_COPY, cityHubCopy, type Hub, type HubProjectCard } from "@/lib/project-hubs"

/**
 * Programmatic hub page ("Architectuur in Amsterdam", "Renovatieprojecten
 * in Nederland"). Fully server-rendered: breadcrumb trail, H1, templated
 * intro, project grid and sibling-hub strip are all in the HTML for
 * crawlers. Rendered from the project detail route when the slug resolves
 * to a hub instead of a project.
 */
export async function HubPage({ hub, siblings, projects, locale }: {
  hub: Hub
  siblings: Hub[]
  projects: HubProjectCard[]
  locale: string
}) {
  const t = await getTranslations("discover")
  const copy = hub.kind === "city"
    ? cityHubCopy(hub.name, locale)
    : (HUB_COPY[hub.slug]?.[locale === "nl" ? "nl" : "en"] ?? HUB_COPY[hub.slug]?.nl)

  const baseUrl = getSiteUrl()
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t("title"), item: `${baseUrl}/${locale}/projects` },
      { "@type": "ListItem", position: 2, name: t("breadcrumb_netherlands"), item: `${baseUrl}/${locale}/projects` },
      { "@type": "ListItem", position: 3, name: copy.title, item: `${baseUrl}/${locale}/projects/${hub.slug}` },
    ],
  }

  const cards = projects.map((p) => ({
    id: p.id,
    slug: p.slug,
    title:
      getProjectTranslation({ title: p.title, translations: p.translations }, "title", locale) || p.title,
    location: p.location,
    projectType: translateScope(canonicalizeScope(p.projectType), locale) ?? p.projectType,
    imageUrl: p.imageUrl,
  }))

  const siblingLabel = locale === "nl" ? "Ook interessant:" : "Also explore:"
  const allProjectsLabel = locale === "nl" ? "Alle projecten bekijken" : "Browse all projects"
  const countLabel = locale === "nl"
    ? `${projects.length} ${projects.length === 1 ? "project" : "projecten"}`
    : `${projects.length} ${projects.length === 1 ? "project" : "projects"}`

  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <Header />

      <div className="discover-page-title" style={{ marginTop: 80 }}>
        <div className="wrap">
          <nav aria-label="Breadcrumb" className="discover-breadcrumb">
            <Link href="/projects" className="discover-breadcrumb-item">
              {t("title")}
            </Link>
            <span className="discover-breadcrumb-sep" aria-hidden="true">›</span>
            <Link href="/projects" className="discover-breadcrumb-item">
              {t("breadcrumb_netherlands")}
            </Link>
            <span className="discover-breadcrumb-sep" aria-hidden="true">›</span>
            <span className="discover-breadcrumb-item discover-breadcrumb-current">
              {hub.kind === "city" ? hub.name : copy.title}
            </span>
          </nav>

          <h1 className="arco-section-title">{copy.title}</h1>
          <p className="arco-body-text" style={{ color: "#6b6b68", marginTop: 8, maxWidth: 560 }}>
            {copy.intro}
          </p>
        </div>
      </div>

      <div className="wrap" style={{ paddingTop: 24, paddingBottom: 80 }}>
        <p className="text-[13px] text-[#a1a1a0]" style={{ marginBottom: 16 }}>{countLabel}</p>

        <div className="discover-grid">
          {cards.map((card) => (
            <SimilarProjectCard key={card.id} project={card} />
          ))}
        </div>

        {/* Sibling hubs — lateral links between hub pages, server-rendered */}
        {siblings.length > 0 && (
          <p className="text-[13px]" style={{ marginTop: 48, color: "#6b6b68" }}>
            {siblingLabel}{" "}
            {siblings.map((s, i) => {
              const label = s.kind === "city"
                ? (locale === "nl" ? `Architectuur in ${s.name}` : `Architecture in ${s.name}`)
                : (HUB_COPY[s.slug]?.[locale === "nl" ? "nl" : "en"]?.title ?? s.slug)
              return (
                <span key={s.slug}>
                  {i > 0 && <span aria-hidden="true"> · </span>}
                  <Link href={`/projects/${s.slug}`} className="text-[#016D75] hover:text-[#014f55] transition-colors">
                    {label}
                  </Link>
                </span>
              )
            })}
          </p>
        )}

        <p style={{ marginTop: 16 }}>
          <Link href="/projects" className="text-[13px] text-[#016D75] hover:text-[#014f55] transition-colors">
            {allProjectsLabel} →
          </Link>
        </p>
      </div>

      <Footer />
    </div>
  )
}
