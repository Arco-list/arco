import { NextRequest, NextResponse } from "next/server"
import { trackProspectLandingVisit } from "@/lib/prospect-ref"

export async function GET(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get("ref")
  if (!ref) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  await trackProspectLandingVisit(ref)
  return NextResponse.json({ ok: true })
}
