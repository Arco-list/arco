"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createServerActionSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"

const ratingSchema = z.number().int().min(1, "Select a rating").max(5, "Rating must be 5 or less")

const reviewSchema = z.object({
  professionalId: z.string().uuid("We couldn't identify that professional."),
  overallRating: ratingSchema,
  qualityRating: ratingSchema.nullable().optional(),
  reliabilityRating: ratingSchema.nullable().optional(),
  communicationRating: ratingSchema.nullable().optional(),
  workCarriedOut: z.boolean({ required_error: "Let us know if work was carried out." }),
  comment: z
    .string()
    .trim()
    .max(500, "Your review can be up to 500 characters.")
    .optional(),
})

type CreateReviewInput = z.infer<typeof reviewSchema>

type ReviewActionResult =
  | {
      success: true
      data: { status: "pending_moderation" }
    }
  | {
      success: false
      error: string
      code?: string
    }

const isAccessDenied = (code?: string | null, message?: string | null) => {
  if (!code && !message) {
    return false
  }

  const normalizedMessage = message?.toLowerCase() ?? ""

  return (
    code === "42501" ||
    code === "PGRST301" ||
    normalizedMessage.includes("policy") ||
    normalizedMessage.includes("permission") ||
    normalizedMessage.includes("not allowed")
  )
}

export async function createReviewAction(rawInput: CreateReviewInput): Promise<ReviewActionResult> {
  const parseResult = reviewSchema.safeParse(rawInput)

  if (!parseResult.success) {
    const message = parseResult.error.issues[0]?.message ?? "We could not process your review."
    return { success: false, error: message }
  }

  const input = parseResult.data

  const supabase = await createServerActionSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    logger.auth("create-review", "Failed to verify session while creating review", undefined, authError)
    return {
      success: false,
      error: "We could not verify your session. Please sign in and try again.",
    }
  }

  if (!user) {
    return {
      success: false,
      error: "You need to sign in before leaving a review.",
    }
  }

  const sanitizedComment = input.comment?.trim()
  const insertPayload = {
    professional_id: input.professionalId,
    reviewer_id: user.id,
    overall_rating: input.overallRating,
    quality_rating: input.qualityRating ?? null,
    reliability_rating: input.reliabilityRating ?? null,
    communication_rating: input.communicationRating ?? null,
    work_completed: input.workCarriedOut,
    comment: sanitizedComment && sanitizedComment.length > 0 ? sanitizedComment : null,
    is_published: false,
  }

  const { data, error: insertError } = await supabase
    .from("reviews")
    .insert(insertPayload)
    .select("id")
    .maybeSingle()

  if (insertError) {
    logger.db(
      "insert",
      "reviews",
      "Failed to create review",
      {
        professionalId: input.professionalId,
        reviewerId: user.id,
      },
      insertError,
    )

    if (isAccessDenied(insertError.code, insertError.message)) {
      return {
        success: false,
        error: "You can only review professionals you've worked with.",
        code: insertError.code ?? undefined,
      }
    }

    return {
      success: false,
      error: "We couldn't save your review. Please try again.",
      code: insertError.code ?? undefined,
    }
  }

  if (!data) {
    return {
      success: false,
      error: "We couldn't confirm your review was saved. Please try again.",
    }
  }

  revalidatePath(`/professionals/${input.professionalId}`)
  revalidatePath("/admin/reviews")

  return {
    success: true,
    data: { status: "pending_moderation" },
  }
}
