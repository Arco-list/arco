/**
 * Breedte en hoogte uit de kop van een afbeelding (JPEG, PNG, WebP, GIF),
 * zonder beeldbibliotheek. Genoeg voor "liggend of staand"; null als het
 * formaat onbekend of de kop onleesbaar is.
 */
export function imageSize(buf: Uint8Array): { width: number; height: number } | null {
  const u16be = (o: number) => (buf[o] << 8) | buf[o + 1]
  const u16le = (o: number) => buf[o] | (buf[o + 1] << 8)
  const u24le = (o: number) => buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16)
  const u32be = (o: number) => ((buf[o] << 24) | (buf[o + 1] << 16) | (buf[o + 2] << 8) | buf[o + 3]) >>> 0
  const ascii = (o: number, n: number) => String.fromCharCode(...Array.from(buf.subarray(o, o + n)))

  if (buf.length < 24) return null

  // PNG: IHDR direct na de handtekening.
  if (buf[0] === 0x89 && ascii(1, 3) === "PNG") return { width: u32be(16), height: u32be(20) }

  // GIF
  if (ascii(0, 3) === "GIF") return { width: u16le(6), height: u16le(8) }

  // WebP: VP8 (lossy), VP8L (lossless) of VP8X (uitgebreid).
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const chunk = ascii(12, 4)
    if (chunk === "VP8 ") return { width: u16le(26) & 0x3fff, height: u16le(28) & 0x3fff }
    if (chunk === "VP8L") {
      const b = buf.subarray(21, 25)
      return { width: 1 + (((b[1] & 0x3f) << 8) | b[0]), height: 1 + (((b[3] & 0xf) << 10) | (b[2] << 2) | ((b[1] & 0xc0) >> 6)) }
    }
    if (chunk === "VP8X") return { width: 1 + u24le(24), height: 1 + u24le(27) }
    return null
  }

  // JPEG: door de segmenten tot een SOF-marker (frame-kop met de maten).
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let o = 2
    while (o + 9 < buf.length) {
      if (buf[o] !== 0xff) { o++; continue }
      const marker = buf[o + 1]
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01 || marker === 0xff) { o += marker === 0xff ? 1 : 2; continue }
      const len = u16be(o + 2)
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
      if (isSof) return { width: u16be(o + 7), height: u16be(o + 5) }
      o += 2 + len
    }
  }
  return null
}
