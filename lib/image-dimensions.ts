/**
 * Probe image dimensions from a URL by reading just enough bytes to
 * parse the header (JPEG, PNG, WebP, GIF). Avoids downloading the
 * full image file.
 *
 * Falls back to fetching the full image if range requests aren't
 * supported or the header can't be parsed from partial data.
 */

type Dimensions = { width: number; height: number }

/** Read a 2-byte big-endian unsigned int */
const readU16BE = (buf: Uint8Array, offset: number) =>
  (buf[offset] << 8) | buf[offset + 1]

/** Read a 4-byte big-endian unsigned int */
const readU32BE = (buf: Uint8Array, offset: number) =>
  ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0

/** Read a 4-byte little-endian unsigned int */
const readU32LE = (buf: Uint8Array, offset: number) =>
  (buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24)) >>> 0

function parsePNG(buf: Uint8Array): Dimensions | null {
  // PNG: bytes 0-7 are signature, IHDR chunk starts at 8
  // Width at offset 16 (4 bytes BE), Height at offset 20 (4 bytes BE)
  if (buf.length < 24) return null
  if (buf[0] !== 0x89 || buf[1] !== 0x50) return null
  return { width: readU32BE(buf, 16), height: readU32BE(buf, 20) }
}

function parseJPEG(buf: Uint8Array): Dimensions | null {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null
  let offset = 2
  while (offset < buf.length - 1) {
    if (buf[offset] !== 0xff) return null
    const marker = buf[offset + 1]
    // SOF markers: C0-C3, C5-C7, C9-CB, CD-CF
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      if (offset + 9 > buf.length) return null
      const height = readU16BE(buf, offset + 5)
      const width = readU16BE(buf, offset + 7)
      return { width, height }
    }
    // Skip this segment
    if (offset + 3 >= buf.length) return null
    const segmentLength = readU16BE(buf, offset + 2)
    offset += 2 + segmentLength
  }
  return null
}

function parseWebP(buf: Uint8Array): Dimensions | null {
  // RIFF....WEBP
  if (buf.length < 30) return null
  if (buf[0] !== 0x52 || buf[1] !== 0x49 || buf[2] !== 0x46 || buf[3] !== 0x46) return null
  if (buf[8] !== 0x57 || buf[9] !== 0x45 || buf[10] !== 0x42 || buf[11] !== 0x50) return null

  // VP8 lossy
  if (buf[12] === 0x56 && buf[13] === 0x50 && buf[14] === 0x38 && buf[15] === 0x20) {
    if (buf.length < 30) return null
    const width = (buf[26] | (buf[27] << 8)) & 0x3fff
    const height = (buf[28] | (buf[29] << 8)) & 0x3fff
    return { width, height }
  }
  // VP8L lossless
  if (buf[12] === 0x56 && buf[13] === 0x50 && buf[14] === 0x38 && buf[15] === 0x4c) {
    if (buf.length < 25) return null
    const b0 = buf[21]; const b1 = buf[22]; const b2 = buf[23]; const b3 = buf[24]
    const width = 1 + (((b1 & 0x3f) << 8) | b0)
    const height = 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 >> 6) & 0x3))
    return { width, height }
  }
  return null
}

function parseDimensions(buf: Uint8Array): Dimensions | null {
  return parsePNG(buf) ?? parseJPEG(buf) ?? parseWebP(buf)
}

/**
 * Probe dimensions of a remote image URL.
 * Tries a Range request first (fast, ~64KB), falls back to full fetch.
 */
export async function probeImageDimensions(url: string): Promise<Dimensions | null> {
  try {
    // Try range request — most CDNs support this
    const rangeRes = await fetch(url, {
      headers: {
        Range: "bytes=0-65535",
        "User-Agent": "Mozilla/5.0 (compatible; ArcoBot/1.0)",
      },
      signal: AbortSignal.timeout(10000),
    })

    if (rangeRes.ok || rangeRes.status === 206) {
      const buf = new Uint8Array(await rangeRes.arrayBuffer())
      const dims = parseDimensions(buf)
      if (dims && dims.width > 0 && dims.height > 0) return dims
    }

    // Full fetch fallback (for servers that don't support Range)
    const fullRes = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ArcoBot/1.0)" },
      signal: AbortSignal.timeout(15000),
    })
    if (!fullRes.ok) return null
    const buf = new Uint8Array(await fullRes.arrayBuffer())
    return parseDimensions(buf)
  } catch {
    return null
  }
}

/**
 * Probe dimensions for multiple image URLs in parallel (limited concurrency).
 * Returns a map of URL → {width, height}.
 */
export async function probeMultipleImageDimensions(
  urls: string[],
  concurrency = 5,
): Promise<Map<string, Dimensions>> {
  const results = new Map<string, Dimensions>()
  const queue = [...urls]

  const worker = async () => {
    while (queue.length > 0) {
      const url = queue.shift()!
      const dims = await probeImageDimensions(url)
      if (dims) results.set(url, dims)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, () => worker()))
  return results
}
