import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

/**
 * Pinterest board-cover image generator.
 *
 * Renders the 3-cell collage design approved in the /admin/design preview:
 *   ┌──────────────┬────────┐
 *   │              │ arco   │
 *   │  hero photo  │ square │
 *   │  board name  ├────────┤
 *   │  (Hero font) │ second │
 *   │              │ photo  │
 *   └──────────────┴────────┘
 *
 * Text is rendered by Satori (behind next/og's ImageResponse) using the
 * exact CormorantGaramond-Light TTF from public/fonts/ — same file
 * next/font ships to the browser, so board names match .arco-hero-title
 * pixel-for-pixel.
 *
 * Auth: admin session or Bearer CRON_SECRET (so refreshBoardCoversAction
 * can fetch this route from the server).
 */

export const runtime = "nodejs"
export const size = { width: 1000, height: 750 } // 4:3, Pinterest board cover
export const contentType = "image/png"

// ── Photo prep ──────────────────────────────────────────────────────────
// Satori's decoder skips WebP/AVIF/progressive-JPEG and silently renders a
// black rectangle. Sharp normalises everything to a baseline JPEG data URL
// that Satori can always read (same trick /opengraph-image.tsx uses).
async function fetchAsJpegDataUrl(url: string, targetW: number, targetH: number): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "image/jpeg,image/png;q=0.9,image/*;q=0.5" },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    const { default: sharp } = await import("sharp")
    const out = await sharp(buf)
      .resize({ width: targetW, height: targetH, fit: "cover" })
      .jpeg({ quality: 82, mozjpeg: true, progressive: false })
      .toBuffer()
    return `data:image/jpeg;base64,${out.toString("base64")}`
  } catch {
    return null
  }
}

// ── Board photo resolution ──────────────────────────────────────────────
// For a type board (category_id): pick the two most-recently-synced
// projects in that category, use each project's cover photo.
// For a space board (space_id): pick the two most-recently-synced
// features on that space, use each feature's cover photo.
async function loadBoardPhotos(boardRow: {
  space_id: string | null
  category_id: string | null
}): Promise<{ hero: string | null; second: string | null }> {
  const supabase = createServiceRoleSupabaseClient()
  let photoIds: (string | null)[] = []
  if (boardRow.category_id) {
    const { data: projects } = await supabase
      .from("projects")
      .select("id")
      .eq("project_type_category_id", boardRow.category_id)
      .eq("status", "published")
      .not("pinterest_pin_id", "is", null)
      .order("pinterest_synced_at", { ascending: false, nullsFirst: false })
      .limit(2)
    const ids = (projects ?? []).map((p) => p.id)
    for (const projectId of ids) {
      const { data: photos } = await supabase
        .from("project_photos")
        .select("url")
        .eq("project_id", projectId)
        .order("is_primary", { ascending: false })
        .order("order_index", { ascending: true })
        .limit(1)
      photoIds.push(photos?.[0]?.url ?? null)
    }
  } else if (boardRow.space_id) {
    const { data: features } = await supabase
      .from("project_features")
      .select("id, cover_photo_id")
      .eq("space_id", boardRow.space_id)
      .not("pinterest_pin_id", "is", null)
      .order("pinterest_synced_at", { ascending: false, nullsFirst: false })
      .limit(2)
    for (const f of features ?? []) {
      let photoUrl: string | null = null
      if (f.cover_photo_id) {
        const { data: photo } = await supabase
          .from("project_photos")
          .select("url")
          .eq("id", f.cover_photo_id)
          .maybeSingle()
        photoUrl = photo?.url ?? null
      }
      if (!photoUrl) {
        const { data: photo } = await supabase
          .from("project_photos")
          .select("url")
          .eq("feature_id", f.id)
          .order("order_index", { ascending: true })
          .limit(1)
          .maybeSingle()
        photoUrl = photo?.url ?? null
      }
      photoIds.push(photoUrl)
    }
  }
  const [heroUrl, secondUrl] = [photoIds[0] ?? null, photoIds[1] ?? null]
  const [hero, second] = await Promise.all([
    heroUrl ? fetchAsJpegDataUrl(heroUrl, Math.round(size.width * (2 / 3)), size.height) : null,
    secondUrl ? fetchAsJpegDataUrl(secondUrl, Math.round(size.width / 3), Math.round(size.height / 2)) : null,
  ])
  return { hero, second }
}

// ── Auth helper ─────────────────────────────────────────────────────────
async function authorised(req: Request): Promise<boolean> {
  // Server-to-server (cron / refresh action) sends the CRON_SECRET.
  const expected = process.env.CRON_SECRET
  const header = req.headers.get("authorization") ?? ""
  if (expected && header === `Bearer ${expected}`) return true
  // Admin browser session.
  const { createServerSupabaseClient } = await import("@/lib/supabase/server")
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_types")
      .eq("id", user.id)
      .maybeSingle()
    const types = Array.isArray(profile?.user_types) ? profile!.user_types : []
    return types.includes("admin")
  } catch {
    return false
  }
}

// ── Route handler ───────────────────────────────────────────────────────
export async function GET(
  req: Request,
  { params }: { params: Promise<{ boardId: string }> },
): Promise<Response> {
  const ok = await authorised(req)
  if (!ok) return new Response("Unauthorized", { status: 401 })

  const { boardId } = await params
  const supabase = createServiceRoleSupabaseClient()
  const { data: board } = await supabase
    .from("pinterest_boards")
    .select("id, board_name, space_id, category_id, spaces(name), categories(name)")
    .eq("id", boardId)
    .maybeSingle()
  if (!board) return new Response("Board not found", { status: 404 })

  const displayName =
    board.board_name
    ?? (board as { spaces?: { name?: string | null } | null }).spaces?.name
    ?? (board as { categories?: { name?: string | null } | null }).categories?.name
    ?? "Arco"

  const { hero, second } = await loadBoardPhotos({
    space_id: board.space_id,
    category_id: board.category_id,
  })

  const fontData = await readFile(join(process.cwd(), "public/fonts/CormorantGaramond-Light.ttf"))
  const arcoIconPath = join(process.cwd(), "public/Logo Icon (1).svg")
  const arcoIconSvg = await readFile(arcoIconPath, "utf-8")
  const arcoIconDataUrl = `data:image/svg+xml;base64,${Buffer.from(arcoIconSvg).toString("base64")}`

  const heroW = Math.round(size.width * (2 / 3))
  const rightW = size.width - heroW
  const cellH = Math.round(size.height / 2)

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#e6e5e0" }}>
        {/* Left 2/3 — hero photo with centered board name + CTA */}
        <div
          style={{
            display: "flex",
            width: heroW,
            height: size.height,
            position: "relative",
            background: "#8a7a5c",
          }}
        >
          {hero ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hero}
              alt=""
              width={heroW}
              height={size.height}
              style={{ width: heroW, height: size.height, objectFit: "cover" }}
            />
          ) : null}
          {/* Scrim so text stays legible over any photo */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              background: "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.5) 100%)",
            }}
          />
          {/* Board name + CTA, centered */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              textAlign: "center",
              padding: "40px",
            }}
          >
            <div
              style={{
                fontFamily: "Cormorant Garamond",
                fontWeight: 300,
                fontSize: 140,
                lineHeight: 1,
                letterSpacing: "-1.5px",
                textShadow: "0 2px 20px rgba(0,0,0,0.35)",
                marginBottom: 20,
              }}
            >
              {displayName}
            </div>
            <div
              style={{
                fontSize: 20,
                letterSpacing: "4px",
                textTransform: "uppercase",
                fontWeight: 500,
                opacity: 0.9,
              }}
            >
              Visit arcolist.com
            </div>
          </div>
        </div>

        {/* Right column — Arco square top + second photo bottom */}
        <div style={{ display: "flex", flexDirection: "column", width: rightW, height: size.height, gap: 4, marginLeft: 4 }}>
          <div
            style={{
              display: "flex",
              width: rightW,
              height: cellH - 2,
              background: "#000",
              alignItems: "center",
              justifyContent: "center",
              padding: 40,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={arcoIconDataUrl}
              alt="Arco"
              width={Math.round(rightW * 0.55)}
              height={Math.round(rightW * 0.55)}
            />
          </div>
          <div
            style={{
              display: "flex",
              width: rightW,
              height: cellH - 2,
              background: "#3a4b57",
            }}
          >
            {second ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={second}
                alt=""
                width={rightW}
                height={cellH - 2}
                style={{ width: rightW, height: cellH - 2, objectFit: "cover" }}
              />
            ) : null}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Cormorant Garamond",
          data: fontData,
          weight: 300,
          style: "normal",
        },
      ],
    },
  )
}
