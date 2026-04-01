"use client"

import { useEffect } from "react"
import { trackPageView, trackProjectViewed, trackProfessionalViewed } from "@/lib/tracking"

export function TrackPageView({ path }: { path: string }) {
  useEffect(() => { trackPageView(path) }, [path])
  return null
}

export function TrackProjectView({ projectId, slug }: { projectId: string; slug: string }) {
  useEffect(() => { trackProjectViewed(projectId, slug) }, [projectId, slug])
  return null
}

export function TrackProfessionalView({ companyId, slug }: { companyId: string; slug: string }) {
  useEffect(() => { trackProfessionalViewed(companyId, slug) }, [companyId, slug])
  return null
}
