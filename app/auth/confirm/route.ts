import { NextRequest, NextResponse } from "next/server"
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/server"

// Handles email confirmation links clicked from auth emails.
// Exchanges the token_hash for a session, then redirects to the app.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tokenHash = searchParams.get("token_hash")
  const token = searchParams.get("token")
  const type = searchParams.get("type") as
    | "signup"
    | "recovery"
    | "magiclink"
    | "email_change"
    | "invite"
    | null
  const next = searchParams.get("next") ?? "/"

  const supabase = await createRouteHandlerSupabaseClient()

  const hash = tokenHash ?? token
  if (hash && type) {
    const otpType = type === "recovery" ? "recovery"
      : type === "magiclink" ? "magiclink"
      : type === "email_change" ? "email"
      : "signup"

    const { error } = await supabase.auth.verifyOtp({
      type: otpType,
      token_hash: hash,
    })
    if (error) {
      console.error("[auth/confirm] verifyOtp failed:", error.message)
      return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(error.message)}`, req.url))
    }
  }

  return NextResponse.redirect(new URL(next, req.url))
}
