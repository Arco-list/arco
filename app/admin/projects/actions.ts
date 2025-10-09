"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"
import { logger } from "@/lib/logger"

const projectIdSchema = z.string().uuid()

async function assertAdmin() {
  const supabase = await createServerActionSupabaseClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    logger.security("admin-auth", "Admin authentication failed", {
      error: authError?.message,
      hasUser: !!user,
    })
    return { supabase, user: null, error: authError ?? new Error("Not authenticated") }
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_types")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError || !isAdminUser(profile?.user_types)) {
    logger.security("admin-auth", "Admin authorization failed", {
      userId: user.id,
      userTypes: profile?.user_types,
      error: profileError?.message,
    })
    return {
      supabase,
      user,
      error: profileError ?? new Error("Unauthorized"),
    }
  }

  return { supabase, user, error: null }
}

export async function setProjectFeaturedAction(input: { projectId: string; featured: boolean }) {
  const parseResult = projectIdSchema.safeParse(input.projectId)
  if (!parseResult.success) {
    return { success: false, error: "Invalid project id" }
  }

  const { supabase, error } = await assertAdmin()
  if (error) {
    return { success: false, error: error.message }
  }

  const { error: updateError } = await supabase
    .from("projects")
    .update({ is_featured: input.featured })
    .eq("id", parseResult.data)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  revalidatePath("/admin/projects")
  return { success: true }
}

const statusSchema = z.enum(["draft", "in_progress", "published", "completed", "archived", "rejected"])

export async function setProjectStatusAction(input: {
  projectId: string
  status: z.infer<typeof statusSchema>
  rejectionReason?: string | null
}) {
  const idResult = projectIdSchema.safeParse(input.projectId)
  if (!idResult.success) {
    return { success: false, error: "Invalid project id" }
  }

  const statusResult = statusSchema.safeParse(input.status)
  if (!statusResult.success) {
    return { success: false, error: "Invalid status" }
  }

  const trimmedReason = input.rejectionReason?.trim()
  if (statusResult.data === "rejected" && (!trimmedReason || trimmedReason.length === 0)) {
    return { success: false, error: "Rejection reason is required" }
  }

  const { supabase, user, error } = await assertAdmin()
  if (error) {
    return { success: false, error: error.message }
  }

  const updatePayload: Record<string, unknown> = {
    status: statusResult.data,
    status_updated_at: new Date().toISOString(),
    status_updated_by: user?.id ?? null,
    rejection_reason: statusResult.data === "rejected" ? trimmedReason : null,
  }

  const { error: updateError } = await supabase
    .from("projects")
    .update(updatePayload)
    .eq("id", idResult.data)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  const serviceClient = createServiceRoleSupabaseClient()
  const { error: refreshError } = await serviceClient.rpc("refresh_project_summary")

  if (refreshError) {
    logger.error(
      "Failed to refresh project summary after status update",
      { scope: "admin-projects", projectId: idResult.data, nextStatus: statusResult.data },
      refreshError,
    )
    return { success: false, error: "Status updated, but failed to refresh project summaries. Try again." }
  }

  revalidatePath("/admin/projects")
  return { success: true }
}

const ownerInputSchema = z.object({
  projectId: projectIdSchema,
  ownerEmail: z.string().email(),
})

export async function changeProjectOwnerAction(input: { projectId: string; ownerEmail: string }) {
  const parsed = ownerInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: "Provide a valid email and project." }
  }

  const { error } = await assertAdmin()
  if (error) {
    return { success: false, error: error.message }
  }

  const serviceClient = createServiceRoleSupabaseClient()

  const { data: ownerUser, error: ownerError } = await serviceClient.auth.admin.getUserByEmail(parsed.data.ownerEmail)
  if (ownerError || !ownerUser) {
    return { success: false, error: ownerError?.message ?? "User not found." }
  }

  const { data: ownerProfile, error: profileError } = await serviceClient
    .from("profiles")
    .select("user_types")
    .eq("id", ownerUser.user.id)
    .maybeSingle()

  if (profileError) {
    return { success: false, error: profileError.message }
  }

  const ownerTypes = ownerProfile?.user_types ?? []
  if (!ownerTypes.includes("professional")) {
    return { success: false, error: "Selected user is not a professional account." }
  }

  const { error: updateError } = await serviceClient
    .from("projects")
    .update({ client_id: ownerUser.user.id })
    .eq("id", parsed.data.projectId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  revalidatePath("/admin/projects")
  return { success: true }
}

export async function deleteProjectAction(input: { projectId: string }) {
  const parsed = projectIdSchema.safeParse(input.projectId)
  if (!parsed.success) {
    return { success: false, error: "Invalid project id" }
  }

  const { error } = await assertAdmin()
  if (error) {
    return { success: false, error: error.message }
  }

  const serviceClient = createServiceRoleSupabaseClient()
  const { error: deleteError } = await serviceClient.from("projects").delete().eq("id", parsed.data)

  if (deleteError) {
    return { success: false, error: deleteError.message }
  }

  revalidatePath("/admin/projects")
  return { success: true }
}
