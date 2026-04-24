import { ImageResponse } from "next/og"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getSiteUrl } from "@/lib/utils"

// 1200×630 is the Open Graph default. Every social/messaging crawler
// (Slack, WhatsApp, LinkedIn, Twitter/X, Facebook, iMessage) handles it
// natively and will down-sample for smaller previews.
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = "Arco"

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
  const supabase = await createServerSupabaseClient()

  // One-hop redirect resolve — covers crawlers that hit an old slug.
  // Deeper chains fall through to the blank-card fallback (black bg + badge),
  // which is better than rendering nothing.
  const { data: redirect } = await supabase
    .from("project_redirects")
    .select("new_slug")
    .eq("old_slug", slug)
    .maybeSingle()
  const finalSlug = redirect?.new_slug ?? slug

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("slug", finalSlug)
    .maybeSingle()

  let heroUrl: string | null = null
  if (project) {
    const { data: photos } = await supabase
      .from("project_photos")
      .select("url")
      .eq("project_id", project.id)
      .order("is_primary", { ascending: false })
      .order("order_index", { ascending: true })
      .limit(1)
    heroUrl = photos?.[0]?.url ?? null
  }

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
        {heroUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroUrl}
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
