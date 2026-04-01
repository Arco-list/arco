import { NextRequest, NextResponse } from "next/server"
import { trackProspectLandingVisit } from "@/lib/prospect-ref"

export async function GET(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get("ref")
  if (!ref) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  await trackProspectLandingVisit(ref)

  // Set cookie so we can link this prospect on signup (even with a different email)
  const response = NextResponse.json({ ok: true })
  response.cookies.set("prospect_ref", ref, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 90, // 90 days
    path: "/",
  })
  return response
}
