import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

/**
 * Storage helpers for the pre-generated Pinterest / social share images.
 *
 * Bucket: pinterest-media (public, JPEG only, 5 MB cap — see migration 183).
 *
 * Layout:
 *   pins/type/{project_id}.jpg     — one per published project (type board)
 *   pins/space/{feature_id}.jpg    — one per non-Exterior feature with a cover
 *   social/{project_id}.jpg        — one per published project (og:image)
 *
 * All operations run through the service-role client because writes to
 * this bucket only ever originate from server-side flows (the cron
 * compositor, admin backfill actions). No client-side upload path.
 */

const BUCKET = "pinterest-media"
const CACHE_CONTROL = "public, max-age=31536000, immutable"

// ── Object key builders ──────────────────────────────────────────────────
export const pinTypeObjectKey = (projectId: string): string =>
  `pins/type/${projectId}.jpg`

export const pinSpaceObjectKey = (featureId: string): string =>
  `pins/space/${featureId}.jpg`

export const socialObjectKey = (projectId: string): string =>
  `social/${projectId}.jpg`

// ── Public URL ───────────────────────────────────────────────────────────
export function getBrandedImageUrl(objectKey: string): string {
  const supabase = createServiceRoleSupabaseClient()
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectKey)
  return data.publicUrl
}

// ── Upload ───────────────────────────────────────────────────────────────
// Overwrites any existing object at the same key. Pinterest never
// re-fetches an image on a live pin (patch doesn't accept a new image),
// so overwriting on republish is safe: the old pin has already been
// deleted before a fresh publish enqueues.
export async function uploadBrandedImage(
  objectKey: string,
  buffer: Buffer,
): Promise<string> {
  const supabase = createServiceRoleSupabaseClient()
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(objectKey, buffer, {
      contentType: "image/jpeg",
      cacheControl: CACHE_CONTROL,
      upsert: true,
    })
  if (error) {
    throw new Error(
      `Failed to upload pinterest media at ${objectKey}: ${error.message}`,
    )
  }
  return getBrandedImageUrl(objectKey)
}

// ── Delete ───────────────────────────────────────────────────────────────
// No-op on missing objects — the caller's flow (project/feature deletion)
// is idempotent by design.
export async function deleteBrandedImage(objectKey: string): Promise<void> {
  const supabase = createServiceRoleSupabaseClient()
  const { error } = await supabase.storage.from(BUCKET).remove([objectKey])
  if (error) {
    // Log but don't throw — a stale-but-orphaned object is preferable to
    // aborting an unpublish flow. The bucket has no PII; leftover images
    // are ignorable.
    console.warn(`[pinterest-storage] failed to remove ${objectKey}: ${error.message}`)
  }
}
