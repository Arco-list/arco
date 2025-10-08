"use client"

import { createContext, useContext } from "react"

export type PreviewPhoto = {
  id: string
  url: string
  alt: string
  isPrimary?: boolean
}

export type PreviewGalleryGroup = {
  id: string
  title: string
  description?: string | null
  photos: PreviewPhoto[]
}

export type PreviewHighlight = {
  id: string
  title: string
  imageUrl: string
  description?: string | null
}

export type PreviewFeatureGroup = {
  id: string
  name: string
  items: Array<{ id: string; label: string }>
}

export type PreviewServiceInvite = {
  id: string
  name?: string | null
  email?: string | null
  status?: string | null
}

export type PreviewService = {
  id: string
  name: string
  invites: PreviewServiceInvite[]
}

export type PreviewProfessionalSummary = {
  id: string
  name: string
  href?: string | null
  badge?: string | null
  imageUrl?: string | null
}

export type PreviewDetail = {
  label: string
  value: string
}

export type PreviewSimilarProject = {
  id: string
  title: string
  location?: string | null
  imageUrl?: string | null
  likes?: number
  isLiked?: boolean
  href?: string | null
}

export type ProjectPreviewData = {
  projectId: string
  slug: string
  likesCount: number
  isLiked: boolean
  hero: {
    coverPhoto?: PreviewPhoto | null
    secondaryPhotos: PreviewPhoto[]
    groups: PreviewGalleryGroup[]
  }
  canViewInviteDetails: boolean
  info: {
    breadcrumbs: string[]
    title: string
    subtitle?: string | null
    sponsoredLabel?: string | null
    descriptionHtml?: string | null
    descriptionPlain?: string | null
  }
  statusBadge?: string | null
  locationLabel?: string | null
  metaDetails: PreviewDetail[]
  highlights: PreviewHighlight[]
  featureGroups: PreviewFeatureGroup[]
  professionalServices: PreviewService[]
  professionalsSummary: PreviewProfessionalSummary[]
  location: {
    city?: string | null
    region?: string | null
    shareExact: boolean
    canViewExact: boolean
    latitude?: number | null
    longitude?: number | null
    addressFormatted?: string | null
    summary?: string | null
  }
  similarProjects?: PreviewSimilarProject[]
  shareImageUrl?: string | null
  shareUrl?: string | null
}

const ProjectPreviewContext = createContext<ProjectPreviewData | null>(null)

export function ProjectPreviewProvider({
  value,
  children,
}: {
  value: ProjectPreviewData
  children: React.ReactNode
}) {
  return <ProjectPreviewContext.Provider value={value}>{children}</ProjectPreviewContext.Provider>
}

export function useProjectPreview() {
  const context = useContext(ProjectPreviewContext)

  if (!context) {
    throw new Error("useProjectPreview must be used within a ProjectPreviewProvider")
  }

  return context
}
