import { ImageResponse } from "next/og"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { getSiteUrl } from "@/lib/utils"

export const runtime = "nodejs"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = "Arco"

const BADGE_SIZE = Math.round(size.width * 0.14)   // 168
const RIGHT_MARGIN = Math.round(size.width * 0.033) // ~40

// Fetch the hero photo and return a baseline JPEG data URL, resized to
// OG canvas. Kept in sync with the identical helper in
// projects/[slug]/opengraph-image.tsx — see the longer note there for
// why we always normalise through sharp + force `progressive: false`
// (Satori silently fails on progressive JPEGs).
async function loadHeroAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "image/jpeg,image/png;q=0.9,image/*;q=0.5" },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
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

export default async function OgImage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { slug } = await params
  // Service role — the OG endpoint is requested by anonymous link-preview
  // crawlers with no session cookies, and many companies have no active
  // team-member link (common for prospected ones), which makes the usual
  // fetchProfessionalMetadata path return null. Query the cover photo
  // directly so every listed/prospected company gets a branded card.
  const service = createServiceRoleSupabaseClient()

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)
  const { data: company, error: companyError } = isUuid
    ? await service.from("companies").select("id").eq("id", slug).maybeSingle()
    : await service.from("companies").select("id").eq("slug", slug).maybeSingle()

  let heroUrl: string | null = null
  if (company) {
    const { data: photos, error: photoError } = await service
      .from("company_photos")
      .select("url, is_cover")
      .eq("company_id", company.id)
      .order("is_cover", { ascending: false })
      .limit(1)
    heroUrl = photos?.[0]?.url ?? null
    if (photoError) console.error("[og-image:professional] photos lookup failed", { slug, error: photoError.message })
  } else if (companyError) {
    console.error("[og-image:professional] company lookup failed", { slug, error: companyError.message })
  } else {
    console.warn("[og-image:professional] company not found", { slug })
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
