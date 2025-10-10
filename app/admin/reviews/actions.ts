"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createServerActionSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { isAdminUser } from "@/lib/auth-utils"
import { checkRateLimit } from "@/lib/rate-limit"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

type SupabaseServerClient = Awaited<ReturnType<typeof createServerActionSupabaseClient>>
type SupabaseUser = Awaited<ReturnType<SupabaseServerClient["auth"]["getUser"]>>["data"]["user"]

const ensureAdmin = async (): Promise<{ supabase: SupabaseServerClient; user: SupabaseUser | null; isAdmin: boolean }> => {
  const supabase = await createServerActionSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    logger.auth("moderate-review", "Unable to verify user session", undefined, authError)
    return { supabase, user: null, isAdmin: false }
  }

  if (!user) {
    return { supabase, user: null, isAdmin: false }
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_types")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError) {
    logger.db("select", "profiles", "Failed to load profile while moderating review", { userId: user.id }, profileError)
    return { supabase, user, isAdmin: false }
  }

  const isAdmin = isAdminUser(profile?.user_types ?? null)

  return { supabase, user, isAdmin }
}

const revalidateReviewPaths = (professionalId?: string | null) => {
  revalidatePath("/admin/reviews")
  if (professionalId && UUID_REGEX.test(professionalId)) {
    revalidatePath(`/professionals/${professionalId}`)
  }
}

export const approveReviewAction = async (rawInput: z.infer<typeof reviewIdSchema>): Promise<ActionResult> => {
  const parseResult = reviewIdSchema.safeParse(rawInput)

  if (!parseResult.success) {
    return { success: false, error: parseResult.error.issues[0]?.message ?? "Invalid input." }
  }

  const { supabase, user, isAdmin } = await ensureAdmin()

  if (!user) {
    return { success: false, error: "You must be signed in to moderate reviews." }
  }

  if (!isAdmin) {
    return { success: false, error: "You do not have permission to approve reviews." }
  }

  const rateLimit = await checkRateLimit(`review:moderate:${user.id}`, {
    limit: 5,
    window: 60,
    prefix: "@arco/reviews/moderation",
  })

  if (!rateLimit.success) {
    logger.warn("Rate limit triggered while approving review", {
      moderatorId: user.id,
      reviewId: parseResult.data.reviewId,
      remaining: rateLimit.remaining,
      reset: rateLimit.reset,
    })
    return { success: false, error: "You are moderating reviews too quickly. Please wait and try again." }
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

  const { supabase, user, isAdmin } = await ensureAdmin()

  if (!user) {
    return { success: false, error: "You must be signed in to moderate reviews." }
  }

  if (!isAdmin) {
    return { success: false, error: "You do not have permission to reject reviews." }
  }

  const rateLimit = await checkRateLimit(`review:moderate:${user.id}`, {
    limit: 5,
    window: 60,
    prefix: "@arco/reviews/moderation",
  })

  if (!rateLimit.success) {
    logger.warn("Rate limit triggered while rejecting review", {
      moderatorId: user.id,
      reviewId: parseResult.data.reviewId,
      remaining: rateLimit.remaining,
      reset: rateLimit.reset,
    })
    return { success: false, error: "You are moderating reviews too quickly. Please wait and try again." }
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
