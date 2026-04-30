import { ImageResponse } from "next/og"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { getSiteUrl } from "@/lib/utils"

// Run on Node so we can use sharp to normalise hero photos before
// handing them to Satori (its decoder doesn't handle WEBP/AVIF, and
// several CDNs we import from serve WEBP even when URLs end in .jpg).
export const runtime = "nodejs"

// 1200×630 is the Open Graph default. Every social/messaging crawler
// (Slack, WhatsApp, LinkedIn, Twitter/X, Facebook, iMessage) handles it
// natively and will down-sample for smaller previews.
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = "Arco"

// Fetch the hero photo and return a baseline JPEG data URL, resized to
// OG canvas. Satori (the renderer behind ImageResponse) silently fails
// on **progressive JPEGs** — the <img> slot renders but the pixel data
// stays black, which is what crawlers were seeing in WhatsApp / Slack
// previews. Two routes hit that bug:
//   1. Source already progressive (e.g. marcovanveldhuizen's exports).
//   2. Source is WebP/AVIF, sharp re-encodes with mozjpeg defaults
//      (which is progressive on).
// Always normalising through sharp + forcing `progressive: false` fixes
// both paths. Resizing to 1200×630 also caps the base64 string size so
// large source photos don't bloat the OG render's memory footprint.
async function loadHeroAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "image/jpeg,image/png;q=0.9,image/*;q=0.5" },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    // Dynamic import so Next.js's build-time "Collecting page data"
    // phase doesn't eagerly load sharp's native binary. Combined with
    // `pnpm.onlyBuiltDependencies: ["sharp"]` in package.json, this
    // keeps the build green on Vercel (where postinstall scripts are
    // off by default in pnpm 10).
    const { default: sharp } = await import("sharp")
    const out = await sharp(buf)
      .resize({ width: size.width, height: size.height, fit: "cover" })
      .jpeg({ quality: 85, mozjpeg: true, progressive: false })
      .toBuffer()
    return `data:image/jpeg;base64,${out.toString("base64")}`
  } catch {
    return null
  }
}

// Placement spec from Notion SEO doc — kept in sync with the Locked
// spec section and the mockups under docs/mockups/.
//   badge: 14% of canvas width → 168 on 1200-wide
//   right margin: 3.3% of canvas width → ~40 on 1200-wide
//   bottom: 0 (flush)
const BADGE_SIZE = Math.round(size.width * 0.14)
const RIGHT_MARGIN = Math.round(size.width * 0.033)

export default async function OgImage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { slug } = await params
  // Service-role client: the OG image endpoint is requested by anonymous
  // link-preview crawlers (WhatsApp, Slack, etc.), which carry no session
  // cookies, so RLS blocks the cookie-based server client from reading
  // project_photos. The service role is the canonical pattern for
  // server-rendered share assets.
  const supabase = createServiceRoleSupabaseClient()

  // One-hop redirect resolve — covers crawlers that hit an old slug.
  // Deeper chains fall through to the blank-card fallback (black bg + badge),
  // which is better than rendering nothing.
  const { data: redirect } = await supabase
    .from("project_redirects")
    .select("new_slug")
    .eq("old_slug", slug)
    .maybeSingle()
  const finalSlug = redirect?.new_slug ?? slug

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("slug", finalSlug)
    .maybeSingle()

  let heroUrl: string | null = null
  if (project) {
    const { data: photos, error: photoError } = await supabase
      .from("project_photos")
      .select("url")
      .eq("project_id", project.id)
      .order("is_primary", { ascending: false })
      .order("order_index", { ascending: true })
      .limit(1)
    heroUrl = photos?.[0]?.url ?? null
    if (photoError) console.error("[og-image:project] photos lookup failed", { slug, error: photoError.message })
  } else if (projectError) {
    console.error("[og-image:project] project lookup failed", { slug, finalSlug, error: projectError.message })
  } else {
    console.warn("[og-image:project] project not found", { slug, finalSlug })
  }

  const heroDataUrl = heroUrl ? await loadHeroAsDataUrl(heroUrl) : null
  const base = getSiteUrl()
  const badgeUrl = `${base}/arco-og-badge.png`

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          position: "relative",
          backgroundColor: "#1c1c1a",
        }}
      >
        {heroDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroDataUrl}
            alt=""
            width={size.width}
            height={size.height}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={badgeUrl}
          alt="Arco"
          width={BADGE_SIZE}
          height={BADGE_SIZE}
          style={{
            position: "absolute",
            right: RIGHT_MARGIN,
            bottom: 0,
            width: BADGE_SIZE,
            height: BADGE_SIZE,
          }}
        />
      </div>
    ),
    size,
  )
}
