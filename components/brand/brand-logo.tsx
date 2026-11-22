"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Het logo van een merk, overal hetzelfde: heeft het een eigen gekleurde
 * achtergrond (Foscarini rood, Moooi zwart), dan vult het de hele cirkel.
 * Staat het op wit of is het doorzichtig (Flos, Drop, Carropools), dan
 * krijgt het de grijze schijf van de dienstkaarten en past het er met
 * marge in, zodat het niet op de witte pagina zweeft. We lezen de vier
 * hoeken van het logo; dat kan in de browser omdat onze opslag CORS
 * toestaat. Lukt het lezen niet (een logo van een andere host), dan blijft
 * het bij grijs en past het logo binnen.
 *
 * `useBrandLogoFit` is de beslissing zelf, voor plekken die hun eigen
 * schijf hebben (de merkkiezer op de projectpagina); `BrandLogo` is de
 * schijf mét beslissing.
 */

const hasBackgroundCache = new Map<string, boolean>()

/** true/false: wel/geen eigen achtergrond; null: de pixels waren niet te
 *  lezen (een eerder zonder CORS geladen kopie uit de browsercache). */
function detectBackground(img: HTMLImageElement): boolean | null {
  try {
    const size = 16
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return false
    ctx.drawImage(img, 0, 0, size, size)
    const corners = [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1]]
    // Alleen echt wit telt als "geen achtergrond". Een gebroken wit of
    // lichtgrijs vlak (Ariostea, Louis Poulsen: ~241) vult de cirkel; met
    // marge en multiply op de grijze schijf leest dat vlak anders als een
    // donkerder binnencirkel met een lichte rand eromheen.
    return corners.every(([x, y]) => {
      const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data
      return a > 200 && !(r > 248 && g > 248 && b > 248)
    })
  } catch {
    return null
  }
}

/** Een eigen kopie met CORS laden (andere cache-sleutel) en die lezen. */
function probeBackground(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = new window.Image()
    probe.crossOrigin = "anonymous"
    probe.onload = () => resolve(detectBackground(probe) ?? false)
    probe.onerror = () => resolve(false)
    probe.src = `${url}${url.includes("?") ? "&" : "?"}fit=1`
  })
}

export function useBrandLogoFit(url: string | null) {
  const [full, setFull] = useState<boolean>(() => (url ? (hasBackgroundCache.get(url) ?? false) : false))
  // Een logo van een andere host zonder CORS-headers laadt met
  // crossOrigin niet; dan zonder, en zonder detectie.
  const [cors, setCors] = useState(true)
  const ref = useRef<HTMLImageElement | null>(null)

  const decide = (img: HTMLImageElement) => {
    if (!url) return
    if (hasBackgroundCache.has(url)) { setFull(hasBackgroundCache.get(url)!); return }
    const result = detectBackground(img)
    if (result !== null) {
      hasBackgroundCache.set(url, result)
      setFull(result)
      return
    }
    // Niet te lezen: niet onthouden als "geen achtergrond" (dan kreeg
    // hetzelfde logo op de ene plek een rand en op de andere niet), maar
    // een eigen kopie lezen.
    probeBackground(url).then((probed) => {
      hasBackgroundCache.set(url, probed)
      setFull(probed)
    })
  }
  // Een logo dat al uit de cache komt, vuurt onLoad soms vóór React het hoort.
  useEffect(() => {
    const img = ref.current
    if (img && img.complete && img.naturalWidth > 0) decide(img)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  return {
    full,
    imgProps: {
      ref,
      crossOrigin: cors ? ("anonymous" as const) : undefined,
      onLoad: (e: React.SyntheticEvent<HTMLImageElement>) => decide(e.currentTarget),
      onError: () => { if (cors) setCors(false) },
    },
  }
}

/**
 * Alleen het beeld, voor een schijf die er al is (.credit-icon,
 * .pro-card-logo): grijs, rond, overflow verborgen. Eigen achtergrond →
 * vult de schijf; wit of doorzichtig → 7% marge op het grijs.
 */
export function LogoFill({ src, alt = "" }: { src: string; alt?: string }) {
  const { full, imgProps } = useBrandLogoFit(src)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...imgProps}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      style={full
        ? { width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%", display: "block" }
        : { width: "100%", height: "100%", objectFit: "contain", padding: "7%", boxSizing: "border-box", mixBlendMode: "multiply", display: "block" }}
    />
  )
}

export function BrandLogo({ logoUrl, name, size = 100, alt = "" }: { logoUrl: string | null; name: string; size?: number; alt?: string }) {
  const { full, imgProps } = useBrandLogoFit(logoUrl)
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        width: size, height: size, borderRadius: "50%", overflow: "hidden",
        background: logoUrl && full ? "transparent" : "var(--arco-surface)",
      }}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          {...imgProps}
          src={logoUrl}
          alt={alt || name}
          style={full
            ? { width: "100%", height: "100%", objectFit: "cover", display: "block" }
            : { width: "100%", height: "100%", objectFit: "contain", padding: "7%", boxSizing: "border-box", mixBlendMode: "multiply", display: "block" }}
        />
      ) : (
        <span style={{ fontFamily: "var(--font-sans)", fontSize: Math.round(size * 0.32), fontWeight: 300, color: "var(--arco-mid)", userSelect: "none" }}>
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  )
}
