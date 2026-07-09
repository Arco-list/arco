import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { randomBytes } from "node:crypto"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { buildAuthorizeUrl } from "@/lib/pinterest/client"

/**
 * Kick off the OAuth handshake with Pinterest. Admin-only.
 *
 * Generates a random `state` value, stashes it in a short-lived cookie
 * so the callback can verify the redirect wasn't tampered with, then
 * bounces the browser to Pinterest's authorize page.
 *
 * The redirect_uri sent to Pinterest must match one of the URIs
 * registered on the Pinterest developer app — set it to the corresponding
 * /oauth/callback path for whichever locale/host you're launching from.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const STATE_COOKIE = "pinterest_oauth_state"
const STATE_COOKIE_MAX_AGE = 600 // 10 minutes

async function ensureAdmin(): Promise<Response | null> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
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

  const state = randomBytes(24).toString("hex")
  const url = new URL(req.url)
  // Callback lives at the sibling route; match locale + host of the
  // request so the OAuth redirect target survives environments (localhost,
  // staging, prod) without needing a per-env config.
  const localeSegment = url.pathname.split("/")[1] ?? "en"
  const redirectUri = `${url.origin}/${localeSegment}/admin/pinterest/oauth/callback`

  const cookieStore = await cookies()
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_COOKIE_MAX_AGE,
  })

  const authorizeUrl = buildAuthorizeUrl({ redirectUri, state })
  return NextResponse.redirect(authorizeUrl)
}
