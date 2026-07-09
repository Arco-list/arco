import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { exchangeAuthCode } from "@/lib/pinterest/client"

/**
 * OAuth callback from Pinterest. Verifies the state token, exchanges the
 * authorization code for access + refresh tokens, and persists them into
 * `pinterest_auth` (single-row keyed on id=1).
 *
 * Success → redirect back to /admin/pinterest with ?connected=1.
 * Failure → redirect back with ?error=<code> so the dashboard can
 * surface the reason instead of leaving the admin on a bare error page.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const STATE_COOKIE = "pinterest_oauth_state"

async function ensureAdmin(): Promise<Response | null> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_types")
    .eq("id", user.id)
    .maybeSingle()
  const types = Array.isArray(profile?.user_types) ? profile!.user_types : []
  if (!types.includes("admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }
  return null
}

export async function GET(req: Request): Promise<Response> {
  const denied = await ensureAdmin()
  if (denied) return denied

  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const errParam = url.searchParams.get("error")

  const localeSegment = url.pathname.split("/")[1] ?? "en"
  const dashboardUrl = new URL(`/${localeSegment}/admin/pinterest`, url.origin)

  if (errParam) {
    dashboardUrl.searchParams.set("error", errParam)
    return NextResponse.redirect(dashboardUrl)
  }

  const cookieStore = await cookies()
  const expectedState = cookieStore.get(STATE_COOKIE)?.value
  cookieStore.delete(STATE_COOKIE)

  if (!code || !state || !expectedState || state !== expectedState) {
    dashboardUrl.searchParams.set("error", "invalid_state")
    return NextResponse.redirect(dashboardUrl)
  }

  const redirectUri = `${url.origin}/${localeSegment}/admin/pinterest/oauth/callback`
  try {
    await exchangeAuthCode({ code, redirectUri })
  } catch (err) {
    console.error("[pinterest-oauth] token exchange failed", err)
    dashboardUrl.searchParams.set("error", "exchange_failed")
    return NextResponse.redirect(dashboardUrl)
  }

  dashboardUrl.searchParams.set("connected", "1")
  return NextResponse.redirect(dashboardUrl)
}
