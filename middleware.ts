import { NextResponse, type NextRequest } from "next/server"
import createMiddleware from "next-intl/middleware"

import { updateSession } from "@/lib/supabase/middleware"
import { routing } from "@/i18n/routing"
import { locales, defaultLocale, type Locale } from "@/i18n/config"

const intlMiddleware = createMiddleware(routing)

const LOCALE_COOKIE = "NEXT_LOCALE"
const PREFIXES = locales.map((l) => `/${l}`)

/**
 * Pick the locale to land on for a first-visit (no NEXT_LOCALE cookie)
 * request that has no locale prefix in the URL. Rules:
 *
 *   1. If the browser explicitly prefers Dutch (any nl-* tag), use 'nl'.
 *   2. If the browser explicitly prefers English (en-*), use 'en'.
 *   3. If the browser sends an Accept-Language header for any other
 *      language (de, fr, it, …), use 'en' — defaulting non-Dutch
 *      visitors to English instead of the historical 'nl' default.
 *   4. If no Accept-Language header is present (curl, scrapers,
 *      server-to-server), fall back to defaultLocale ('nl').
 *
 * Built-in next-intl detection picks the first defined locale that
 * matches; without this resolver a German browser would fall through
 * to defaultLocale = 'nl', which is not what we want.
 */
function resolveInitialLocale(request: NextRequest): Locale {
  const header = request.headers.get("accept-language")
  if (!header) return defaultLocale

  // Parse "en-US,en;q=0.9,de;q=0.8" into [{tag, q}, …] sorted by q desc.
  const tags = header
    .split(",")
    .map((part) => {
      const [tag, ...rest] = part.trim().split(";")
      const qPart = rest.find((r) => r.startsWith("q="))
      const q = qPart ? parseFloat(qPart.slice(2)) : 1
      return { tag: tag.toLowerCase(), q: Number.isFinite(q) ? q : 1 }
    })
    .filter((t) => t.tag.length > 0)
    .sort((a, b) => b.q - a.q)

  for (const { tag } of tags) {
    const primary = tag.split("-")[0]
    if (primary === "nl") return "nl"
    if (primary === "en") return "en"
  }

  // Header was sent but doesn't include nl or en — non-Dutch-speaking
  // user (German, French, etc). Default them to English.
  return "en"
}

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

  // First-visit locale resolution: when the URL has no locale prefix and
  // no NEXT_LOCALE cookie is set yet, pre-seed the cookie with our custom
  // resolver. next-intl reads the cookie before negotiating the
  // Accept-Language header, so this gives us full control while keeping
  // its redirect / hreflang machinery intact.
  const hasLocalePrefix = PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  )
  const hasLocaleCookie = request.cookies.has(LOCALE_COOKIE)
  if (!hasLocalePrefix && !hasLocaleCookie) {
    const resolved = resolveInitialLocale(request)
    // Mutate the incoming request's cookies so intlMiddleware sees it
    // when it inspects the request below. We don't write a Set-Cookie on
    // the response — intlMiddleware will redirect to /<locale>/<path>,
    // and on the redirected request the URL prefix will be authoritative.
    request.cookies.set(LOCALE_COOKIE, resolved)
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
