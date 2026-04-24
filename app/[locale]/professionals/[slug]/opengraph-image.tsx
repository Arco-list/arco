import { ImageResponse } from "next/og"
import { fetchProfessionalMetadata } from "@/lib/professionals/queries"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { getSiteUrl } from "@/lib/utils"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export const alt = "Arco"

const BADGE_SIZE = Math.round(size.width * 0.14)   // 168
const RIGHT_MARGIN = Math.round(size.width * 0.033) // ~40

export default async function OgImage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { slug, locale } = await params
  const professional = await fetchProfessionalMetadata(slug, { locale })
  let heroUrl: string | null = professional?.coverImageUrl ?? null

  // Fallback — fetchProfessionalMetadata returns null when a company has no
  // active team-member linked (common for prospected companies), losing the
  // hero. Look up a cover photo directly so those pages still get branded.
  if (!heroUrl) {
    const service = createServiceRoleSupabaseClient()
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)
    const { data: company } = isUuid
      ? await service.from("companies").select("id").eq("id", slug).maybeSingle()
      : await service.from("companies").select("id").eq("slug", slug).maybeSingle()
    if (company) {
      const { data: photos } = await service
        .from("company_photos")
        .select("url, is_cover")
        .eq("company_id", company.id)
        .order("is_cover", { ascending: false })
        .limit(1)
      heroUrl = photos?.[0]?.url ?? null
    }
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
