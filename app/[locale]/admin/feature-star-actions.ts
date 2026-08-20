"use server"

// Featured-star toggles for the DISCOVER-CARD overlay (admin-only star on
// project/professional cards). Same writes as the admin-table actions
// (toggleProjectFeaturedAction / updateCompanyFeaturedAction) but WITHOUT
// revalidatePath: any revalidation inside a server action makes the Next
// router refresh the current route, which remounts the discover grid and
// throws away the visitor's "Load more" pagination mid-curation. The card
// star updates optimistically client-side; the new ordering (and the
// revalidate-dependent surfaces like home) pick the change up on their
// next request.

import { z } from "zod"

import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"
import { logger } from "@/lib/logger"

const uuidSchema = z.string().uuid()

async function assertAdmin() {
  const supabase = await createServerActionSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return { supabase, error: authError ?? new Error("Not authenticated") }
  }
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_types")
    .eq("id", user.id)
    .maybeSingle()
  if (profileError || !isAdminUser(profile?.user_types)) {
    logger.security("admin-auth", "Card feature-star authorization failed", {
      userId: user.id,
      error: profileError?.message,
    })
    return { supabase, error: profileError ?? new Error("Unauthorized") }
  }
  return { supabase, error: null }
}

export async function setProjectFeaturedFromCard(input: {
  projectId: string
  isFeatured: boolean
}): Promise<{ success: boolean; error?: string }> {
  const parsedId = uuidSchema.safeParse(input.projectId)
  if (!parsedId.success) return { success: false, error: "Invalid project id" }

  const { supabase, error } = await assertAdmin()
  if (error) return { success: false, error: error.message }

  const { error: updateError } = await supabase
    .from("projects")
    .update({ is_featured: Boolean(input.isFeatured) })
    .eq("id", parsedId.data)
  if (updateError) {
    logger.db("update", "projects", "Card star: failed to toggle featured", { projectId: parsedId.data }, updateError)
    return { success: false, error: updateError.message }
  }

  // Homepage reads featured projects through mv_project_summary.
  try {
    const serviceClient = createServiceRoleSupabaseClient()
    await serviceClient.rpc("refresh_project_summary")
  } catch {}

  return { success: true }
}

export async function setCompanyFeaturedFromCard(input: {
  companyId: string
  isFeatured: boolean
}): Promise<{ success: boolean; error?: string }> {
  const parsedId = uuidSchema.safeParse(input.companyId)
  if (!parsedId.success) return { success: false, error: "Invalid company id" }

  const { supabase, error } = await assertAdmin()
  if (error) return { success: false, error: error.message }

  const { error: updateError } = await supabase
    .from("companies")
    .update({ is_featured: Boolean(input.isFeatured) })
    .eq("id", parsedId.data)
  if (updateError) {
    logger.error("Card star: failed to toggle company featured", {
      companyId: parsedId.data,
      error: updateError.message,
    })
    return { success: false, error: updateError.message }
  }

  return { success: true }
}
