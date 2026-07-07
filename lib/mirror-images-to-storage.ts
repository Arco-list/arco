import { randomUUID } from "crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"

const BUCKET = "project-photos"
const MAX_BYTES = 15 * 1024 * 1024 // 15 MB — architects sometimes ship 10-12MB hi-res JPEGs
const FETCH_TIMEOUT_MS = 20_000
const CONCURRENCY = 5

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

/**
 * Fetch a single remote image and upload it to Supabase Storage. Returns the
 * new public URL, or `null` if any step failed (caller falls back to the
 * original hotlink so a single bad image never breaks the batch).
 */
async function mirrorOne(
  supabase: SupabaseClient,
  projectId: string,
  sourceUrl: string,
): Promise<string | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(sourceUrl, {
      signal: controller.signal,
      // Some CDNs 403 on the default node user-agent; a browser UA is safer.
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ArcoBot/1.0; +https://arcolist.com)" },
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

  const results: (string | null)[] = new Array(sourceUrls.length).fill(null)

  let cursor = 0
  const worker = async () => {
    while (true) {
      const idx = cursor++
      if (idx >= sourceUrls.length) return
      results[idx] = await mirrorOne(supabase, projectId, sourceUrls[idx])
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, sourceUrls.length) }, worker))

  let mirroredCount = 0
  let failedCount = 0
  const urls = sourceUrls.map((src, i) => {
    const mirrored = results[i]
    if (mirrored) {
      mirroredCount++
      return mirrored
    }
    failedCount++
    return src
  })

  return { urls, mirroredCount, failedCount }
}
