"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useTranslations } from "next-intl"

import { ShareModal } from "@/components/share-modal"
import { useSavedProjects } from "@/contexts/saved-projects-context"

interface RelatedProject {
  id: string
  slug: string | null
  title: string
  location: string | null
  projectType: string | null
  imageUrl: string | null
}

interface RelatedProjectsProps {
  projects: RelatedProject[]
  architectName: string
  /** Slug of the owning company — used by the "View all →" link to
   *  deep-link into the company's portfolio. */
  architectSlug?: string | null
  /** Whether the owner has more projects than the ones rendered here.
   *  Controls visibility of the "View all →" link. */
  hasMore?: boolean
}

export function RelatedProjects({ projects, architectName, architectSlug, hasMore }: RelatedProjectsProps) {
  const t = useTranslations("project_detail")
  if (projects.length === 0) return null

  return (
    <section className="related-projects">
      <div className="wrap">
        <div className="related-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 className="arco-section-title">{t("more_from", { name: architectName })}</h2>
          {hasMore && architectSlug && (
            <Link href={`/professionals/${architectSlug}`} className="view-all-link">
              {t("view_all_projects")}
            </Link>
          )}
        </div>

        <div className="discover-grid">
          {projects.map((project) => (
            <RelatedProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </section>
  )
}

function RelatedProjectCard({ project }: { project: RelatedProject }) {
  const t = useTranslations("common")
  const { savedProjectIds, saveProject, removeProject, mutatingProjectIds } = useSavedProjects()
  const [shareOpen, setShareOpen] = useState(false)

  const href = project.slug ? `/projects/${project.slug}` : "#"
  const isSaved = savedProjectIds.has(project.id)
  const isMutating = mutatingProjectIds.has(project.id)
  const subtitle = [project.projectType, project.location].filter(Boolean).join(" · ")

  return (
    <>
      <Link href={href} className="discover-card">
        <div className="discover-card-image-wrap">
          <div className="discover-card-image-layer">
            {project.imageUrl ? (
              <Image
                src={project.imageUrl}
                alt={project.title}
                width={600}
                height={450}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div style={{ width: "100%", height: "100%", background: "var(--arco-surface)" }} />
            )}
          </div>

          <div className="discover-card-actions" data-saved={isSaved}>
            <button
              className="discover-card-action-btn"
              data-saved={isSaved}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (isSaved) removeProject(project.id)
                else saveProject(project.id)
              }}
              aria-pressed={isSaved}
              aria-label={isSaved ? "Unsave project" : "Save project"}
              disabled={isMutating}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
            </button>
            <button
              className="discover-card-action-btn"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setShareOpen(true)
              }}
              aria-label="Share project"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </button>
          </div>
        </div>

        <h3 className="discover-card-title">{project.title}</h3>
        {subtitle && <p className="discover-card-sub">{subtitle}</p>}
      </Link>

      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        title={project.title || t("project")}
        subtitle={subtitle}
        imageUrl={project.imageUrl ?? ""}
        shareUrl={project.slug ? `/projects/${project.slug}` : "/"}
      />
    </>
  )
}
