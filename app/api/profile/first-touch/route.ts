import { NextResponse, type NextRequest } from "next/server"

import { createRouteHandlerSupabaseClient } from "@/lib/supabase/server"
import { categorizeFirstTouch } from "@/lib/source-attribution"
import { logger } from "@/lib/logger"

/**
 * Stamps profiles.first_touch_source for the current user using
 * PostHog `$initial_*` props the client read from window.posthog.
 * Idempotent — only writes when the row's first_touch_source is
 * still NULL, so retries or duplicate calls from a flaky network
 * don't overwrite an existing classification.
 *
 * Called from the post-signup client hook (lib/use-first-touch-stamp.ts).
 * Returns 204 in all non-error cases so the client can fire-and-forget.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      referringDomain?: string | null
      currentUrl?: string | null
      utmSource?: string | null
    }

    const supabase = await createRouteHandlerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return new NextResponse(null, { status: 401 })
    }

    const source = categorizeFirstTouch(
      body.referringDomain,
      body.currentUrl,
      body.utmSource,
    )

    // Only write when currently NULL — preserves the original
    // attribution if this endpoint is hit again later (e.g. user logs
    // back in on a different device that has its own PostHog state).
    const { error } = await (supabase as any)
      .from("profiles")
      .update({ first_touch_source: source })
      .eq("id", user.id)
      .is("first_touch_source", null)

    if (error) {
      logger.db("update", "profiles", "first_touch_source stamp failed", { userId: user.id }, error as Error)
    }
  } catch (e) {
    logger.error("first-touch stamp: unexpected error", {}, e as Error)
  }
  return new NextResponse(null, { status: 204 })
}
