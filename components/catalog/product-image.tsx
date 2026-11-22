"use client"

import { useEffect, useState } from "react"

/**
 * Productfoto in een vak (collectie-edit en collectiepagina). Studio-
 * beelden van merken hebben vaak een brede lege rand rond het meubel
 * (doorzichtig of wit), waardoor het product klein in het vak staat. We
 * meten in de browser waar het product in de foto staat en tonen alleen
 * dat stuk, met een vaste marge van 6% in het vak. Lukt meten niet (geen
 * CORS, nog niet geladen), dan de foto zoals hij is.
 *
 * Een foto met een eigen achtergrond (een studiowand, een sfeerbeeld:
 * de inhoud beslaat vrijwel de hele foto) hoort niet in het kader — dat
 * wordt een foto-in-een-foto. Die vult het vak, zonder marge.
 */
type Fit = { src: string | null; full: boolean }
const cache = new Map<string, Fit>()

function useTrimmed(url: string | null): Fit {
  const [fit, setFit] = useState<Fit>(url ? cache.get(url) ?? { src: null, full: false } : { src: null, full: false })
  useEffect(() => {
    if (!url) { setFit({ src: null, full: false }); return }
    if (cache.has(url)) { setFit(cache.get(url)!); return }
    const done = (f: Fit) => { cache.set(url, f); if (alive) setFit(f) }
    let alive = true
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      try {
        const w = img.naturalWidth, h = img.naturalHeight
        if (!w || !h) throw new Error("no size")
        // Meten op een verkleinde kopie; uitsnijden op het origineel.
        const scale = Math.min(1, 400 / Math.max(w, h))
        const sw = Math.max(1, Math.round(w * scale)), sh = Math.max(1, Math.round(h * scale))
        const probe = document.createElement("canvas")
        probe.width = sw; probe.height = sh
        const pctx = probe.getContext("2d", { willReadFrequently: true })!
        pctx.drawImage(img, 0, 0, sw, sh)
        const data = pctx.getImageData(0, 0, sw, sh).data
        let x0 = sw, y0 = sh, x1 = -1, y1 = -1
        for (let y = 0; y < sh; y++) {
          for (let x = 0; x < sw; x++) {
            const i = (y * sw + x) * 4
            const a = data[i + 3]
            // Inhoud: niet doorzichtig en niet (bijna) wit.
            const blank = a < 16 || (data[i] > 242 && data[i + 1] > 242 && data[i + 2] > 242)
            if (!blank) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
          }
        }
        if (x1 < 0) throw new Error("empty")
        const bx = x0 / scale, by = y0 / scale, bw = (x1 - x0 + 1) / scale, bh = (y1 - y0 + 1) / scale
        // Vrijwel vol: een eigen achtergrond, dus het vak vullen.
        if (bw * bh > 0.85 * w * h) { done({ src: null, full: true }); return }
        const out = document.createElement("canvas")
        out.width = Math.round(bw); out.height = Math.round(bh)
        out.getContext("2d")!.drawImage(img, bx, by, bw, bh, 0, 0, out.width, out.height)
        done({ src: out.toDataURL("image/png"), full: false })
      } catch {
        done({ src: null, full: false })
      }
    }
    img.onerror = () => done({ src: null, full: false })
    img.src = url
    return () => { alive = false }
  }, [url])
  return fit
}

export function ProductImage({ url, alt, padding = "6%" }: { url: string; alt: string; padding?: string }) {
  const fit = useTrimmed(url)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={fit.src ?? url}
      alt={alt}
      loading="lazy"
      decoding="async"
      style={fit.full
        ? { width: "100%", height: "100%", objectFit: "cover", display: "block" }
        : { width: "100%", height: "100%", objectFit: "contain", padding, boxSizing: "border-box", mixBlendMode: "multiply" }}
    />
  )
}
