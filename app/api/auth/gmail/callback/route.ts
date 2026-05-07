import { NextRequest, NextResponse } from "next/server"
import { exchangeCodeForTokens, encryptRefreshToken } from "@/lib/gmail/oauth"
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"

/**
 * Gmail OAuth callback.
 *
 * Receives the `code` Google issued after consent + the `state` we
 * embedded (format: `<csrf>.<user_id>`). Validates the state cookie
 * matches, exchanges the code for tokens, encrypts the refresh token,
 * and upserts a row into gmail_connections keyed on the gmail_address.
 *
 * Idempotent — if the same admin reconnects the same mailbox, the
 * existing row is updated in place (refresh token + access token are
 * rotated, last_history_id stays so we don't re-sync).
 */
export const dynamic = "force-dynamic"

const REDIRECT_AFTER = "/admin/inbox?connected=1"
const REDIRECT_FAIL = "/admin/inbox?error="

function fail(reason: string, request: NextRequest, status = 400): NextResponse {
  logger.error("[gmail-oauth] callback failed", { reason })
  const url = new URL(request.url)
  url.pathname = "/admin/inbox"
  url.search = `?error=${encodeURIComponent(reason)}`
  return NextResponse.redirect(url, { status: 303 })
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  const state = request.nextUrl.searchParams.get("state")
  const errorParam = request.nextUrl.searchParams.get("error")

  if (errorParam) return fail(errorParam, request)
  if (!code || !state) return fail("missing_code_or_state", request)

  // State has shape `<csrfBytes>.<userId>` per /api/auth/gmail.
  const [csrf, userId] = state.split(".", 2)
  const cookieState = request.cookies.get("gmail_oauth_state")?.value
  if (!csrf || !userId || !cookieState || cookieState !== csrf) {
    return fail("state_mismatch", request)
  }

  // Re-check admin gate after the redirect roundtrip — caller could
  // have logged out between consent and callback.
  const supabase = await createServerSupabaseClient()
  const { data: userData } = await supabase.auth.getUser()
  const sessionUser = userData?.user
  if (!sessionUser || sessionUser.id !== userId) {
    return fail("session_user_mismatch", request, 401)
  }

  let tokens: Awaited<ReturnType<typeof exchangeCodeForTokens>>
  try {
    tokens = await exchangeCodeForTokens(code)
  } catch (err) {
    return fail(err instanceof Error ? err.message : "token_exchange_failed", request, 500)
  }

  // Service role for the upsert — gmail_connections is operated on
  // exclusively by server-side code, never user-facing.
  const service = createServiceRoleSupabaseClient()
  const { error } = await (service as any)
    .from("gmail_connections")
    .upsert(
      {
        user_id: sessionUser.id,
        gmail_address: tokens.email,
        refresh_token: encryptRefreshToken(tokens.refreshToken),
        access_token: tokens.accessToken,
        access_token_expires_at: tokens.expiresAt.toISOString(),
        last_sync_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "gmail_address" },
    )

  if (error) {
    return fail(`db_upsert_failed:${error.message}`, request, 500)
  }

  const url = new URL(request.url)
  url.pathname = "/admin/inbox"
  url.search = "?connected=1"
  const response = NextResponse.redirect(url, { status: 303 })
  response.cookies.delete("gmail_oauth_state")
  return response
}

// Suppress unused-import lint when REDIRECT_AFTER / REDIRECT_FAIL are
// only referenced via the inlined URL builder above.
void REDIRECT_AFTER
void REDIRECT_FAIL
