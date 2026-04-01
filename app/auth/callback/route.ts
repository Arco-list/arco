import { NextResponse, type NextRequest } from "next/server"

import { createRouteHandlerSupabaseClient } from "@/lib/supabase/server"
import { resolveRedirectPath } from "@/lib/auth-redirect"
import { logger } from "@/lib/logger"

/**
 * Root-level auth callback — handles OAuth/magic-link redirects that arrive
 * without a locale prefix (e.g. /auth/callback?code=...).
 * This is necessary because Supabase and Google redirect to /auth/callback,
 * but the i18n migration moved the route under app/[locale]/auth/callback.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const redirectParam = requestUrl.searchParams.get("redirect_to")
  const redirectTo = resolveRedirectPath(redirectParam)
  const type = requestUrl.searchParams.get("type")
  const callbackId = Math.random().toString(36).substring(7)

  logger.auth("callback", "Root auth callback started", { callbackId, hasCode: !!code, redirectTo })

  // Handle token_hash verification
  const tokenHash = requestUrl.searchParams.get("token_hash")
  const tokenType = requestUrl.searchParams.get("type")

  if (tokenHash && tokenType) {
    const supabase = await createRouteHandlerSupabaseClient()
    try {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: tokenType as any,
      })
      if (error) {
        logger.auth("callback", "Token verification failed", { callbackId, error: error.message })
        return NextResponse.redirect(`${requestUrl.origin}/?error=auth_error`)
      }
      return NextResponse.redirect(new URL(redirectTo, requestUrl.origin))
    } catch (error) {
      logger.auth("callback", "Unexpected error during token verification", { callbackId }, error as Error)
      return NextResponse.redirect(`${requestUrl.origin}/?error=unexpected_error`)
    }
  }

  if (code) {
    const supabase = await createRouteHandlerSupabaseClient()
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        logger.auth("callback", "Code exchange failed", { callbackId, error: error.message })
        return NextResponse.redirect(`${requestUrl.origin}/?error=auth_error`)
      }

      logger.auth("callback", "Code exchange successful", { callbackId, userId: data.user?.id })

      // Password recovery
      if (type === "recovery" || redirectTo === "/update-password") {
        return NextResponse.redirect(`${requestUrl.origin}/update-password`)
      }

      // Create profile if missing
      if (data.user) {
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", data.user.id)
          .single()

        if (!existingProfile) {
          await supabase.from("profiles").insert({
            id: data.user.id,
            user_types: ["client"],
          } as any)
        }
      }

      return NextResponse.redirect(new URL(redirectTo, requestUrl.origin))
    } catch (error) {
      logger.auth("callback", "Unexpected error", { callbackId }, error as Error)
      return NextResponse.redirect(`${requestUrl.origin}/?error=unexpected_error`)
    }
  }

  return NextResponse.redirect(`${requestUrl.origin}/?error=no_code`)
}
