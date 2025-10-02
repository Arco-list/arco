import { NextResponse, type NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/middleware"

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/homeowner")) {
    return NextResponse.next({ request: { headers: request.headers } })
  }

  return updateSession(request)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
