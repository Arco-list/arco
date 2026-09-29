import { randomUUID } from "crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"

const BUCKET = "project-photos"
const MAX_BYTES = 15 * 1024 * 1024 // 15 MB — architects sometimes ship 10-12MB hi-res JPEGs
const FETCH_TIMEOUT_MS = 20_000
const CONCURRENCY = 5
// How long the whole batch may take before the rest is left as
// hotlinks. The comment below promises that mirroring never blocks an
// import — but a per-image timeout cannot keep that promise, because
// thirty images that each answer quickly still add up past the
// platform's function limit, and what dies there is the IMPORT, after
// the project row exists and before a single photo is written.
//
// zecc.nl showed it: once the URLs stopped being truncated the same
// twenty-one photos went from 2.4 kB each to 574 kB, and the import
// came back with the project and no pictures at all.
const TOTAL_BUDGET_MS = 45_000

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
}

function extFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    const m = pathname.match(/\.(jpe?g|png|webp|gif|avif)(?:$|\?)/)
    if (!m) return null
    return m[1] === "jpeg" ? "jpg" : m[1]
  } catch {
    return null
  }
}


// ── Is this a photograph, or is it furniture? ────────────────────────
//
// A NAME-BASED FILTER ONLY CATCHES WHAT SOMEBODY THOUGHT TO NAME. It
// knows facebook.png and /sharebuttons/; it does not know btn_fb_01.png
// or /assets/i/s3.png, and the next site will invent something else.
// Pixels are the thing that cannot be renamed: a 32px image is not a
// photograph of a building, whatever it is called.
//
// Read from the header rather than decoded, so it costs a few bytes of
// arithmetic on bytes already in memory rather than a decode pass and
// a dependency. A format not recognised here returns null and is kept
// — this is a net for the obvious, not a gate that has to be passed.
const MIN_LONGEST_SIDE = 200

function readImageSize(buf: Buffer): { width: number; height: number } | null {
  // PNG: IHDR is always the first chunk, width and height big-endian.
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  }
  // GIF: logical screen descriptor, little-endian.
  if (buf.length >= 10 && buf.toString("latin1", 0, 3) === "GIF") {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) }
  }
  // WebP: three container shapes, each carrying the size differently.
  if (buf.length >= 30 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") {
    const chunk = buf.toString("latin1", 12, 16)
    if (chunk === "VP8X") {
      return { width: (buf.readUIntLE(24, 3) & 0xffffff) + 1, height: (buf.readUIntLE(27, 3) & 0xffffff) + 1 }
    }
    if (chunk === "VP8 ") {
      return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff }
    }
    if (chunk === "VP8L") {
      const bits = buf.readUInt32LE(21)
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
    }
    return null
  }
  // JPEG: walk the segments to the start-of-frame, which is the only
  // place the dimensions live.
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue }
      const marker = buf[i + 1]
      // Standalone markers carry no length field.
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue }
      const isSOF = (marker >= 0xc0 && marker <= 0xcf)
        && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
      if (isSOF) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) }
      }
      i += 2 + buf.readUInt16BE(i + 2)
    }
  }
  return null
}

/** Too small to be anybody's project photo. */
const DROP = Symbol("drop")

/**
 * Fetch a single remote image and upload it to Supabase Storage. Returns the
 * new public URL, or `null` if any step failed (caller falls back to the
 * original hotlink so a single bad image never breaks the batch).
 */
async function mirrorOne(
  supabase: SupabaseClient,
  projectId: string,
  sourceUrl: string,
): Promise<string | typeof DROP | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(sourceUrl, {
      signal: controller.signal,
      // Some CDNs 403 on the default node user-agent; a browser UA is safer.
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ArcoBot/1.0; +https://arcolist.com)",
        // Prefer jpeg/png over content-negotiated webp/avif: the stored
        // bytes must stay decodable by the autoTag pipeline (jimp has no
        // webp decoder) and by older browsers. CDNs that only HAVE webp
        // still serve it — the fallback keeps working.
        Accept: "image/jpeg,image/png,image/*;q=0.8,*/*;q=0.5",
      },
      redirect: "follow",
    })
    if (!res.ok) {
      logger.warn("[mirror-images] source fetch failed", {
        sourceUrl,
        status: res.status,
      })
      return null
    }

    const contentLength = Number(res.headers.get("content-length") ?? 0)
    if (contentLength > MAX_BYTES) {
      logger.warn("[mirror-images] source too large", { sourceUrl, contentLength })
      return null
    }

    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase()
    if (contentType && !contentType.startsWith("image/")) {
      logger.warn("[mirror-images] non-image response", { sourceUrl, contentType })
      return null
    }

    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength === 0) return null
    if (buf.byteLength > MAX_BYTES) {
      logger.warn("[mirror-images] body too large", { sourceUrl, size: buf.byteLength })
      return null
    }

    // Measured before uploading: there is no reason to store a
    // sharing icon, and no reason to keep its hotlink either.
    const size = readImageSize(buf)
    if (size && Math.max(size.width, size.height) < MIN_LONGEST_SIDE) {
      logger.info("[mirror-images] dropped, too small to be a photo", {
        sourceUrl,
        width: size.width,
        height: size.height,
      })
      return DROP
    }

    const ext = EXT_BY_CONTENT_TYPE[contentType] ?? extFromUrl(sourceUrl) ?? "jpg"
    const objectKey = `${projectId}/${randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(objectKey, buf, {
        contentType: contentType || `image/${ext === "jpg" ? "jpeg" : ext}`,
        cacheControl: "3600",
        upsert: false,
      })
    if (uploadError) {
      logger.warn("[mirror-images] upload failed", { sourceUrl, message: uploadError.message })
      return null
    }

    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(objectKey)
    return publicUrlData?.publicUrl ?? null
  } catch (err) {
    logger.warn("[mirror-images] mirror threw", {
      sourceUrl,
      message: (err as Error)?.message ?? String(err),
    })
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Mirror a batch of remote image URLs into Supabase Storage.
 *
 * Returns a URL list of the same length + order as the input — for each
 * source URL either the new Supabase-hosted URL (when the mirror
 * succeeded) or the original URL (fallback). This lets the scrape
 * import path stay resilient: even if a source CDN 403s or times out,
 * the project still ends up with photos rendered from the hotlink.
 *
 * Concurrency is capped to CONCURRENCY so a 30-photo import doesn't
 * open 30 simultaneous outbound fetches.
 *
 * Must be called with a supabase client that has storage insert
 * permission on the `project-photos` bucket (service-role recommended;
 * the RLS on that bucket typically gates on ownership).
 */
export async function mirrorImagesToStorage(
  supabase: SupabaseClient,
  projectId: string,
  sourceUrls: string[],
): Promise<{ urls: string[]; mirroredCount: number; failedCount: number }> {
  if (sourceUrls.length === 0) {
    return { urls: [], mirroredCount: 0, failedCount: 0 }
  }

  const results: (string | typeof DROP | null)[] = new Array(sourceUrls.length).fill(null)

  const deadline = Date.now() + TOTAL_BUDGET_MS
  let cursor = 0
  let skippedForTime = 0
  const worker = async () => {
    while (true) {
      const idx = cursor++
      if (idx >= sourceUrls.length) return
      // Out of budget: stop copying and let the rest fall back to the
      // source URL. A hotlinked photo is worth having; an import that
      // times out leaves none.
      if (Date.now() > deadline) {
        skippedForTime++
        continue
      }
      results[idx] = await mirrorOne(supabase, projectId, sourceUrls[idx])
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, sourceUrls.length) }, worker))

  if (skippedForTime > 0) {
    logger.warn("[mirror-images] budget spent, remainder kept as hotlinks", {
      projectId,
      skipped: skippedForTime,
      total: sourceUrls.length,
    })
  }

  let mirroredCount = 0
  let failedCount = 0
  let droppedCount = 0
  const urls: string[] = []
  sourceUrls.forEach((src, i) => {
    const mirrored = results[i]
    // DROP is the one verdict that removes a row rather than falling
    // back: we fetched it, we measured it, and it is not a photograph.
    // Keeping the hotlink would only put the icon back.
    if (mirrored === DROP) {
      droppedCount++
      return
    }
    if (typeof mirrored === "string") {
      mirroredCount++
      urls.push(mirrored)
      return
    }
    failedCount++
    urls.push(src)
  })
  if (droppedCount > 0) {
    logger.info("[mirror-images] dropped images too small to be photos", {
      projectId,
      dropped: droppedCount,
      total: sourceUrls.length,
    })
  }

  return { urls, mirroredCount, failedCount }
}
