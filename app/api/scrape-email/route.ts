import { NextRequest, NextResponse } from "next/server"

import { createServerSupabaseClient } from "@/lib/supabase/server"

/**
 * GET /api/scrape-email?domain=example.nl
 *
 * Google Places has no email field, so the tier 2/3 credit flow only
 * knows the company's domain. Most Dutch SME sites publish their inbox
 * in the footer or on /contact — fetch those, extract addresses, and
 * return the best same-domain candidate so the invite email can be
 * prefilled instead of asking the publisher to guess the local part.
 */

const EMAIL_RE = /[A-Z0-9][A-Z0-9._%+-]*@[A-Z0-9.-]+\.[A-Z]{2,}/gi
// Common footer noise that regexes out of HTML but is never an inbox.
const JUNK = /(example\.|sentry\.|wixpress|@(2x|3x)\b|\.(png|jpg|jpeg|webp|svg|gif)$)/i
// Preferred local parts, best first — generic inboxes beat personal ones
// for an unsolicited invite.
const PREFERRED = ["info", "contact", "hallo", "hello", "mail", "welkom", "office", "post"]

async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 6000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    })
    clearTimeout(timer)
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/html")) return null
    return await res.text()
  } catch {
    return null
  }
}

function pickEmail(html: string, domain: string): string | null {
  // Undo the most common obfuscations before matching.
  const text = html
    .replace(/\s*\[at\]\s*|\s*\(at\)\s*|&#64;|&commat;/gi, "@")
    .replace(/\s*\[dot\]\s*|\s*\(dot\)\s*/gi, ".")
    .replace(/%40/g, "@")
  const found = [...new Set((text.match(EMAIL_RE) ?? []).map((e) => e.toLowerCase()))]
    .filter((e) => !JUNK.test(e))
  if (found.length === 0) return null

  const bare = domain.toLowerCase().replace(/^www\./, "")
  const sameDomain = found.filter((e) => e.endsWith(`@${bare}`) || e.endsWith(`.${bare}`))
  const pool = sameDomain.length > 0 ? sameDomain : []
  if (pool.length === 0) return null

  for (const local of PREFERRED) {
    const hit = pool.find((e) => e.startsWith(`${local}@`))
    if (hit) return hit
  }
  return pool[0]
}

export async function GET(request: NextRequest) {
  const domain = request.nextUrl.searchParams.get("domain")?.trim().toLowerCase()
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return NextResponse.json({ error: "valid domain required" }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  // Homepage first (footers usually carry the inbox), then the usual
  // contact paths. Stop at the first hit — latency beats completeness
  // here, the user is sitting in an input field.
  const candidates = [
    `https://${domain}`,
    `https://${domain}/contact`,
    `https://${domain}/contact/`,
    `https://www.${domain}/contact`,
  ]
  for (const url of candidates) {
    const html = await fetchPage(url)
    if (!html) continue
    const email = pickEmail(html, domain)
    if (email) return NextResponse.json({ email })
  }
  return NextResponse.json({ email: null })
}
