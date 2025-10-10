"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createServerActionSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { isAdminUser } from "@/lib/auth-utils"

const reviewIdSchema = z.object({
  reviewId: z.string().uuid("Invalid review id."),
})

const rejectSchema = reviewIdSchema.extend({
  moderationNotes: z
    .string()
    .trim()
    .max(1000, "Moderation notes must be 1000 characters or fewer.")
    .optional(),
})

type ActionResult = {
  success: boolean
  error?: string
}

const ensureAdmin = async () => {
  const supabase = await createServerActionSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    logger.auth("moderate-review", "Unable to verify user session", undefined, authError)
    return { supabase, user: null }
  }

  if (!user) {
    return { supabase, user: null }
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_types")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError) {
    logger.db("select", "profiles", "Failed to load profile while moderating review", { userId: user.id }, profileError)
    return { supabase, user: null }
  }

  if (!isAdminUser(profile?.user_types ?? null)) {
    return { supabase, user: null }
  }

  return { supabase, user }
}

const revalidateReviewPaths = (professionalId?: string | null) => {
  revalidatePath("/admin/reviews")
  if (professionalId) {
    revalidatePath(`/professionals/${professionalId}`)
  }
}

export const approveReviewAction = async (rawInput: z.infer<typeof reviewIdSchema>): Promise<ActionResult> => {
  const parseResult = reviewIdSchema.safeParse(rawInput)

  if (!parseResult.success) {
    return { success: false, error: parseResult.error.issues[0]?.message ?? "Invalid input." }
  }

  const { supabase, user } = await ensureAdmin()

  if (!user) {
    return { success: false, error: "You do not have permission to approve reviews." }
  }

  const { data, error } = await supabase
    .from("reviews")
    .update({
      moderation_status: "approved",
      moderated_at: new Date().toISOString(),
      moderated_by: user.id,
      moderation_notes: null,
      is_published: true,
      is_verified: true,
    })
    .eq("id", parseResult.data.reviewId)
    .select("id, professional_id")
    .maybeSingle()

  if (error) {
    logger.db(
      "update",
      "reviews",
      "Failed to approve review",
      { reviewId: parseResult.data.reviewId, moderatorId: user.id },
      error,
    )
    return { success: false, error: "Unable to approve review. Please try again." }
  }

  revalidateReviewPaths(data?.professional_id)

  return { success: true }
}

export const rejectReviewAction = async (rawInput: z.infer<typeof rejectSchema>): Promise<ActionResult> => {
  const parseResult = rejectSchema.safeParse(rawInput)

  if (!parseResult.success) {
    return { success: false, error: parseResult.error.issues[0]?.message ?? "Invalid input." }
  }

  const { supabase, user } = await ensureAdmin()

  if (!user) {
    return { success: false, error: "You do not have permission to reject reviews." }
  }

  const notes = parseResult.data.moderationNotes?.trim() ?? null

  const { data, error } = await supabase
    .from("reviews")
    .update({
      moderation_status: "rejected",
      moderated_at: new Date().toISOString(),
      moderated_by: user.id,
      moderation_notes: notes,
      is_published: false,
      is_verified: false,
    })
    .eq("id", parseResult.data.reviewId)
    .select("id, professional_id")
    .maybeSingle()

  if (error) {
    logger.db(
      "update",
      "reviews",
      "Failed to reject review",
      { reviewId: parseResult.data.reviewId, moderatorId: user.id },
      error,
    )
    return { success: false, error: "Unable to reject review. Please try again." }
  }

  revalidateReviewPaths(data?.professional_id)

  return { success: true }
}
