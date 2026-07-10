import { readFile } from "node:fs/promises"
import { join } from "node:path"

/**
 * Composite source photo + Arco brand tile into a Pinterest pin or social
 * share image. Pure function: URL in → JPEG Buffer out.
 *
 * ── Output shapes ─────────────────────────────────────────────────────────
 *
 *   target: "pin"     → 1000 × 1500 (2:3) when source is portrait
 *                       1000 × 1000 (1:1) when source is landscape or square
 *   target: "social"  → 1200 × 630 always (og:image aspect)
 *
 * Pinterest tolerates 1:1 well; only 16:9 landscape gets penalised in the
 * feed. Branching on source aspect preserves room composition for
 * landscape source photos where a forced 2:3 crop would strip 60% of the
 * width. See docs/pinterest-sync.md for the reasoning.
 *
 * ── Badge ─────────────────────────────────────────────────────────────────
 *
 * The Arco brand tile — black rounded-square wordmark from
 * /public/arco-og-badge.png — is drawn flush to the bottom edge of the
 * output with top corners rounded and bottom corners squared off (so it
 * meets the image edge cleanly). Sized to ~130 px absolute on every
 * output so the mark reads at consistent visual weight across formats.
 * Right inset: 5% of image width.
 *
 * ── Encoder ───────────────────────────────────────────────────────────────
 *
 * JPEG quality 82. Delivers ~180–260 KB per pin, ~140–200 KB per social —
 * balances filesize vs. visible artifacts on interior-design photography
 * where soft gradients (curtains, walls) are easy to posterize.
 *
 * ── Runtime ───────────────────────────────────────────────────────────────
 *
 * Uses jimp (pure-JS) rather than sharp for the same reason autoTag does
 * — sharp's libvips binary doesn't survive Next 15's server-action
 * webpack bundle. Slower but async relative to the enqueue path.
 */

export type CompositeTarget = "pin" | "social"

export interface CompositeInput {
  sourceUrl: string
  target: CompositeTarget
}

export interface CompositeOutput {
  buffer: Buffer
  width: number
  height: number
  mimeType: "image/jpeg"
}

// ── Constants ────────────────────────────────────────────────────────────
const PIN_PORTRAIT = { w: 1000, h: 1500 } as const
const PIN_SQUARE = { w: 1000, h: 1000 } as const
const SOCIAL = { w: 1200, h: 630 } as const

// Absolute badge width in the output. Kept constant across formats so the
// brand mark reads at identical visual weight in Pinterest and social
// previews alike.
const BADGE_WIDTH = 150
const BADGE_INSET_RATIO = 0.05

// Corner radius of the top corners of the badge as a fraction of tile
// height. 15% roughly matches the border-radius: 12px on 96px used in
// the admin/design preview.
const BADGE_CORNER_RATIO = 0.15

// Source badge PNG on disk. Loaded once and cached at module init to
// avoid re-reading and re-decoding on every pin.
const BADGE_ASSET_PATH = join(process.cwd(), "public", "arco-og-badge.png")

// ── Cached badge source ──────────────────────────────────────────────────
// The raw arco-og-badge.png has a rounded square with all four corners
// rounded. We fill in the bottom two corners at composite time so the
// tile reads as sitting flush against the image edge.
let cachedBadgeBuffer: Buffer | null = null
async function loadBadgeBuffer(): Promise<Buffer> {
  if (cachedBadgeBuffer) return cachedBadgeBuffer
  cachedBadgeBuffer = await readFile(BADGE_ASSET_PATH)
  return cachedBadgeBuffer
}

// ── Source fetch ─────────────────────────────────────────────────────────
// Mirrors autoTag's fetch dance for hot-link-protected CDNs (Squarespace,
// WordPress). Restricted Accept header — jimp 1.6.1 cannot decode WEBP
// or AVIF, and CDNs will happily serve those if we advertise support.
async function fetchSource(url: string): Promise<Buffer> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  let origin: string | undefined
  try {
    origin = new URL(url).origin + "/"
  } catch {
    // fall through — bare URL, no origin hint
  }
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        ...(origin ? { Referer: origin } : {}),
        Accept:
          "image/jpeg,image/png,image/gif,image/bmp,image/tiff;q=0.9,image/*;q=0.5",
      },
    })
    if (!res.ok) {
      throw new Error(`Source fetch failed: HTTP ${res.status} ${res.statusText}`)
    }
    return Buffer.from(await res.arrayBuffer())
  } finally {
    clearTimeout(timeout)
  }
}

// ── Aspect decision ──────────────────────────────────────────────────────
function pickTargetSize(
  sourceWidth: number,
  sourceHeight: number,
  target: CompositeTarget,
): { w: number; h: number } {
  if (target === "social") return { ...SOCIAL }
  // Portrait sources → 2:3 pin. Landscape or square sources → 1:1 pin.
  const isPortrait = sourceHeight > sourceWidth
  return isPortrait ? { ...PIN_PORTRAIT } : { ...PIN_SQUARE }
}

// ── Compositor ───────────────────────────────────────────────────────────
export async function composeBrandedImage(
  input: CompositeInput,
): Promise<CompositeOutput> {
  const { sourceUrl, target } = input
  const { Jimp } = await import("jimp")

  const [sourceBuffer, badgeBuffer] = await Promise.all([
    fetchSource(sourceUrl),
    loadBadgeBuffer(),
  ])

  // ── Prepare source photo ───────────────────────────────────────────────
  const source = await Jimp.read(sourceBuffer)
  const { w: targetW, h: targetH } = pickTargetSize(
    source.bitmap.width,
    source.bitmap.height,
    target,
  )

  // jimp's cover() resizes + center-crops to fill the target rect.
  // Preserves aspect and picks the center of the source photo, which is
  // a reasonable default for interior shots where the composition is
  // usually framed centrally.
  source.cover({ w: targetW, h: targetH })

  // ── Prepare badge ──────────────────────────────────────────────────────
  const badge = await Jimp.read(badgeBuffer)
  // Square the bottom edge of the rounded badge. Scan the bottom N rows
  // (where N is the corner radius) and set any transparent pixel to
  // opaque black, so the tile now has flat bottom corners meeting the
  // image edge cleanly.
  const badgeH = badge.bitmap.height
  const badgeW = badge.bitmap.width
  const cornerRows = Math.ceil(badgeH * BADGE_CORNER_RATIO)
  const startY = Math.max(0, badgeH - cornerRows)
  for (let y = startY; y < badgeH; y++) {
    for (let x = 0; x < badgeW; x++) {
      const idx = (y * badgeW + x) * 4
      const alpha = badge.bitmap.data[idx + 3]
      if (alpha < 255) {
        badge.bitmap.data[idx] = 0
        badge.bitmap.data[idx + 1] = 0
        badge.bitmap.data[idx + 2] = 0
        badge.bitmap.data[idx + 3] = 255
      }
    }
  }
  // Resize badge to the constant BADGE_WIDTH so every output carries the
  // same absolute-pixel mark.
  badge.resize({ w: BADGE_WIDTH, h: BADGE_WIDTH })

  // ── Composite ──────────────────────────────────────────────────────────
  const rightInset = Math.round(targetW * BADGE_INSET_RATIO)
  const badgeX = targetW - BADGE_WIDTH - rightInset
  const badgeY = targetH - BADGE_WIDTH
  source.composite(badge, badgeX, badgeY)

  const buffer = await source.getBuffer("image/jpeg", { quality: 82 })
  return { buffer, width: targetW, height: targetH, mimeType: "image/jpeg" }
}
