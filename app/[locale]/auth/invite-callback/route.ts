import { NextResponse, type NextRequest } from "next/server"

import { createRouteHandlerSupabaseClient } from "@/lib/supabase/server"

const ALLOWED_PARAMS = new Set(["redirectTo", "invite", "email"])

const buildRedirectUrl = (origin: string, basePath: string, params: URLSearchParams) => {
  const url = new URL(basePath, origin)
  for (const key of ALLOWED_PARAMS) {
    const value = params.get(key)
    if (value) {
      url.searchParams.set(key, value)
    }
  }
  return url
}

export async function GET(request: NextRequest) {
  const incomingParams = request.nextUrl.searchParams
  const accessToken = incomingParams.get("access_token")
  const refreshToken = incomingParams.get("refresh_token")
  const error = incomingParams.get("error")
  const errorDescription = incomingParams.get("error_description")

  const preservedParams = new URLSearchParams()
  for (const key of ALLOWED_PARAMS) {
    const value = incomingParams.get(key)
    if (value) {
      preservedParams.set(key, value)
    }
  }

  const origin = request.nextUrl.origin

  if (error) {
    const loginUrl = buildRedirectUrl(origin, "/login", preservedParams)
    loginUrl.searchParams.set("error", "invite_invalid")
    if (errorDescription) {
      loginUrl.searchParams.set("details", errorDescription)
    }
    return NextResponse.redirect(loginUrl)
  }

  if (!accessToken || !refreshToken) {
    const loginUrl = buildRedirectUrl(origin, "/login", preservedParams)
    loginUrl.searchParams.set("error", "invite_missing_tokens")
    return NextResponse.redirect(loginUrl)
  }

  const supabase = await createRouteHandlerSupabaseClient()
  const { error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  })

  if (sessionError) {
    const loginUrl = buildRedirectUrl(origin, "/login", preservedParams)
    loginUrl.searchParams.set("error", "invite_session_failed")
    if (sessionError.message) {
      loginUrl.searchParams.set("details", sessionError.message)
    }
    return NextResponse.redirect(loginUrl)
  }

  const redirectTo = preservedParams.get("redirectTo") ?? "/auth/admin-onboarding"
  const destination = buildRedirectUrl(origin, redirectTo, preservedParams)
  return NextResponse.redirect(destination)
}

export const dynamic = "force-dynamic"
