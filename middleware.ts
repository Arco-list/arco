import { NextResponse, type NextRequest } from "next/server"
import createMiddleware from "next-intl/middleware"

import { updateSession } from "@/lib/supabase/middleware"
import { routing } from "@/i18n/routing"

const intlMiddleware = createMiddleware(routing)

export async function middleware(request: NextRequest) {
  // Skip i18n for API routes, static files, auth callbacks
  const { pathname } = request.nextUrl
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/auth/v1") ||
    pathname.match(/\.(ico|svg|png|jpg|jpeg|webp|gif|woff|woff2|ttf|css|js|json|webmanifest)$/)
  ) {
    return NextResponse.next()
  }

  // Homeowner route — skip Supabase session update
  if (pathname.startsWith("/homeowner")) {
    return intlMiddleware(request)
  }

  // Run Supabase session update first
  const sessionResponse = await updateSession(request)

  // Then run i18n middleware
  const intlResponse = intlMiddleware(request)

  // Merge headers from session response into intl response
  if (sessionResponse && intlResponse) {
    sessionResponse.headers.forEach((value, key) => {
      intlResponse.headers.set(key, value)
    })
  }

  return intlResponse ?? sessionResponse
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
