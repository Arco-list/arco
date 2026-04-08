"use server"

import { revalidatePath } from "next/cache"
import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { isAdminUser, isSuperAdminUser } from "@/lib/auth-utils"

export type HeroCoverScope = "home" | "about"

export type HeroCover = {
  slot: number
  project_id: string
  photo_url: string
  project_title?: string
  project_slug?: string
}

const SCOPE_REVALIDATE_PATH: Record<HeroCoverScope, string> = {
  home: "/",
  about: "/about",
}

function assertScope(value: unknown): HeroCoverScope {
  return value === "about" ? "about" : "home"
}

export async function getHeroCoversAction(scope: HeroCoverScope = "home"): Promise<{ success: boolean; covers: HeroCover[]; error?: string }> {
  const s = assertScope(scope)
  const supabase = createServiceRoleSupabaseClient()

  const { data, error } = await supabase
    .from("hero_covers")
    .select("slot, project_id, photo_url")
    .eq("scope", s)
    .order("slot", { ascending: true })

  if (error) return { success: false, covers: [], error: error.message }

  // Fetch project titles
  const projectIds = data.map((c: any) => c.project_id).filter(Boolean)
  const projectMap = new Map<string, { title: string; slug: string | null }>()

  if (projectIds.length > 0) {
    const { data: projects } = await supabase
      .from("projects")
      .select("id, title, slug")
      .in("id", projectIds)

    for (const p of projects ?? []) {
      projectMap.set(p.id, { title: p.title, slug: p.slug })
    }
  }

  return {
    success: true,
    covers: (data ?? []).map((c: any) => ({
      ...c,
      project_title: projectMap.get(c.project_id)?.title,
      project_slug: projectMap.get(c.project_id)?.slug,
    })),
  }
}

export async function searchProjectsForHeroAction(query: string): Promise<{
  success: boolean
  projects: { id: string; title: string; slug: string | null; primary_photo_url: string | null }[]
  error?: string
}> {
  const supabase = await createServerActionSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, projects: [], error: "Not authenticated" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_types, admin_role")
    .eq("id", user.id)
    .maybeSingle()

  if (!isAdminUser(profile?.user_types, profile?.admin_role)) {
    return { success: false, projects: [], error: "Unauthorized" }
  }

  const serviceSupabase = createServiceRoleSupabaseClient()

  const { data, error } = await serviceSupabase
    .from("projects")
    .select("id, title, slug, project_photos(url, is_primary)")
    .eq("status", "published")
    .ilike("title", `%${query}%`)
    .limit(10)

  if (error) return { success: false, projects: [], error: error.message }

  return {
    success: true,
    projects: (data ?? []).map((p: any) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      primary_photo_url: p.project_photos?.find((ph: any) => ph.is_primary)?.url ?? p.project_photos?.[0]?.url ?? null,
    })),
  }
}

export async function getProjectPhotosAction(projectId: string): Promise<{
  success: boolean
  photos: { id: string; url: string; is_primary: boolean }[]
  error?: string
}> {
  const supabase = await createServerActionSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, photos: [], error: "Not authenticated" }

  const serviceSupabase = createServiceRoleSupabaseClient()

  const { data, error } = await serviceSupabase
    .from("project_photos")
    .select("id, url, is_primary")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })

  if (error) return { success: false, photos: [], error: error.message }

  return { success: true, photos: data ?? [] }
}

export async function saveHeroCoverAction(input: {
  slot: number
  projectId: string
  photoUrl: string
  scope?: HeroCoverScope
}): Promise<{ success: boolean; error?: string }> {
  const scope = assertScope(input.scope)
  const supabase = await createServerActionSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Not authenticated" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_types, admin_role")
    .eq("id", user.id)
    .maybeSingle()

  if (!isSuperAdminUser(profile?.admin_role)) {
    return { success: false, error: "Only super admins can edit hero covers" }
  }

  const serviceSupabase = createServiceRoleSupabaseClient()

  const { error } = await serviceSupabase
    .from("hero_covers")
    .upsert({
      scope,
      slot: input.slot,
      project_id: input.projectId,
      photo_url: input.photoUrl,
      updated_at: new Date().toISOString(),
    }, { onConflict: "scope,slot" })

  if (error) return { success: false, error: error.message }

  revalidatePath(SCOPE_REVALIDATE_PATH[scope])
  return { success: true }
}

export async function removeHeroCoverAction(slot: number, scope: HeroCoverScope = "home"): Promise<{ success: boolean; error?: string }> {
  const s = assertScope(scope)
  const supabase = await createServerActionSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Not authenticated" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_types, admin_role")
    .eq("id", user.id)
    .maybeSingle()

  if (!isSuperAdminUser(profile?.admin_role)) {
    return { success: false, error: "Only super admins can edit hero covers" }
  }

  const serviceSupabase = createServiceRoleSupabaseClient()

  const { error } = await serviceSupabase
    .from("hero_covers")
    .delete()
    .eq("scope", s)
    .eq("slot", slot)

  if (error) return { success: false, error: error.message }

  revalidatePath(SCOPE_REVALIDATE_PATH[s])
  return { success: true }
}
