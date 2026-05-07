import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "node:crypto"
import { buildAuthUrl } from "@/lib/gmail/oauth"
import { createServerSupabaseClient } from "@/lib/supabase/server"

/**
 * Initiate Gmail OAuth.
 *
 * Caller hits /api/auth/gmail (the "Connect Gmail" button on
 * /admin/inbox). We require the caller to be a signed-in admin,
 * generate a CSRF state cookie, and redirect to Google's consent
 * screen. The matching callback at /api/auth/gmail/callback validates
 * the state and exchanges the code.
 *
 * No body — pure redirect endpoint.
 */
export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  // Light admin gate — full RLS + policy gating happens at table writes
  // anyway. The OAuth flow itself is harmless without admin context;
  // this just keeps the connect button from being usable by random
  // signed-in users.
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_types, admin_role")
    .eq("id", user.id)
    .maybeSingle()
  const isAdmin = (profile as { user_types?: string[]; admin_role?: string | null } | null)?.user_types?.includes("admin")
    || Boolean((profile as { admin_role?: string | null } | null)?.admin_role)
  if (!isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const state = randomBytes(16).toString("hex")
  // Stash state + the user_id we want to attach the connection to in
  // a short-lived signed cookie so the callback can verify.
  const response = NextResponse.redirect(buildAuthUrl(`${state}.${user.id}`))
  response.cookies.set("gmail_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/api/auth/gmail",
  })
  return response
}
