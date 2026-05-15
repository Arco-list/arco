"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useTranslations } from "next-intl"

import { ShareModal } from "@/components/share-modal"
import { useSavedProjects } from "@/contexts/saved-projects-context"

interface Project {
  id: string
  slug: string | null
  title: string
  location: string | null
  projectType: string | null
  image: string | null
}

interface ProfessionalProjectCardProps {
  project: Project
}

export function ProfessionalProjectCard({ project }: ProfessionalProjectCardProps) {
  const t = useTranslations("common")
  const { savedProjectIds, saveProject, removeProject, mutatingProjectIds } = useSavedProjects()
  const [shareOpen, setShareOpen] = useState(false)

  const href = project.slug ? `/projects/${project.slug}` : "#"
  const subtitle = [project.projectType, project.location].filter(Boolean).join(" · ")
  const isSaved = savedProjectIds.has(project.id)
  const isMutating = mutatingProjectIds.has(project.id)
  const imgSrc = project.image ?? "/placeholder.svg"

  return (
    <>
      <Link href={href} className="discover-card">
        <div className="discover-card-image-wrap">
          <div className="discover-card-image-layer">
            <Image
              src={imgSrc}
              alt={project.title}
              width={600}
              height={450}
              loading="lazy"
              decoding="async"
            />
          </div>

          {/* Save + share — same hover-reveal pattern as /projects cards.
              Photo nav arrows / dots intentionally omitted: this card
              shows a single hero image, not a scrollable photo set. */}
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
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
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
        imageUrl={imgSrc}
        shareUrl={project.slug ? `/projects/${project.slug}` : "/"}
      />
    </>
  )
}
