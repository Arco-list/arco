"use client"

import { useEffect } from "react"
import { trackPageView, trackProjectViewed, trackProfessionalViewed } from "@/lib/tracking"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"

export function TrackPageView({ path }: { path: string }) {
  useEffect(() => { trackPageView(path) }, [path])
  return null
}

export function TrackProjectView({ projectId, slug }: { projectId: string; slug: string }) {
  useEffect(() => {
    trackProjectViewed(projectId, slug)
    // Bump the raw Supabase counter that drives the Popular sort on
    // /projects. This is intentionally separate from the PostHog event:
    // PostHog powers time-ranged analytics; the counter is a single
    // denormalized number queried on every discover page load.
    void getBrowserSupabaseClient()
      .rpc("increment_project_views", { p_project_id: projectId })
      .then(({ error }) => {
        if (error) console.warn("[view-count] failed to increment", error.message)
      })
  }, [projectId, slug])
  return null
}

export function TrackProfessionalView({ companyId, slug }: { companyId: string; slug: string }) {
  useEffect(() => {
    trackProfessionalViewed(companyId, slug)
    // Mirror TrackProjectView — drives the Popular sort on /professionals.
    void getBrowserSupabaseClient()
      .rpc("increment_company_views", { p_company_id: companyId })
      .then(({ error }) => {
        if (error) console.warn("[view-count] failed to increment company", error.message)
      })
  }, [companyId, slug])
  return null
}
