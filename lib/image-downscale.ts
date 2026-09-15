/**
 * Client-side downscaling for photo uploads.
 *
 * The project-photos bucket caps a single object at 10 MB, and a modern
 * camera or phone clears that with one shot — those uploads used to die
 * at the storage call ("Payload too large") with nothing the pro could
 * do about it. Rather than refusing the file, we re-encode it in the
 * browser: long edge clamped to MAX_EDGE, JPEG quality stepped down
 * until it fits. A 24 MP JPEG lands around 2-3 MB at quality 0.85 with
 * no visible loss at the sizes the site renders (the hero tops out
 * around 2000 px wide).
 *
 * Deliberately NOT a general image pipeline: files that already fit are
 * returned untouched, so the common case costs nothing and the original
 * bytes reach storage unmodified.
 */

/** Storage ceiling for one object, minus headroom for the multipart envelope. */
const TARGET_BYTES = 9.5 * 1024 * 1024
/** Long edge after downscaling — well above anything the site renders. */
const MAX_EDGE = 4000
/** Quality ladder; the first rung that fits wins. */
const QUALITY_STEPS = [0.85, 0.75, 0.65, 0.55]

export type DownscaleResult = {
  file: File
  /** True when the file was re-encoded (used for the "compressed" notice). */
  changed: boolean
  originalBytes: number
}

function canDownscale(): boolean {
  return (
    typeof window !== "undefined"
    && typeof createImageBitmap === "function"
    && typeof document !== "undefined"
  )
}

async function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality)
  })
}

/**
 * Returns a file that fits the storage ceiling. Falls back to the
 * original on any failure — the caller's own size validation then
 * reports it, exactly as before this existed.
 */
export async function downscaleForUpload(file: File): Promise<DownscaleResult> {
  const originalBytes = file.size
  if (file.size <= TARGET_BYTES || !canDownscale()) {
    return { file, changed: false, originalBytes }
  }

  let bitmap: ImageBitmap | null = null
  try {
    // Re-encoding drops EXIF, so the rotation flag has to be baked into
    // the pixels here — without this, phone photos arrive sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return { file, changed: false, originalBytes }
    // White matte: JPEG has no alpha, and a transparent PNG would
    // otherwise composite onto black.
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)

    for (const quality of QUALITY_STEPS) {
      const blob = await encode(canvas, quality)
      if (!blob) break
      if (blob.size <= TARGET_BYTES) {
        const name = file.name.replace(/\.[^.]+$/, "") + ".jpg"
        return {
          file: new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified }),
          changed: true,
          originalBytes,
        }
      }
    }
    return { file, changed: false, originalBytes }
  } catch {
    return { file, changed: false, originalBytes }
  } finally {
    bitmap?.close()
  }
}
