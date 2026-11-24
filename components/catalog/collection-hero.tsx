"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { centeredFocus, focusFromClick, focusPosition, type Focus } from "@/lib/images/focus"

/**
 * Het grote beeld bovenaan een collectie, zoals de hero van een project:
 * over de volle breedte, bijgesneden rond het focuspunt — waar het product
 * staat (focus_x/focus_y, migratie 326; zonder punt het midden). Alleen
 * een studiobeeld op een effen of doorzichtige achtergrond komt heel op
 * een grijs vlak (contain), want bijgesneden staat dat slecht.
 *
 * `onPickFocus`: op de bewerkpagina zet een klik op het beeld het
 * focuspunt op die plek.
 */
export function CollectionHero({ src, alt, style, cutout = false, focus, onPickFocus }: {
  src: string
  alt: string
  style?: React.CSSProperties
  cutout?: boolean
  focus?: { x: number; y: number } | null
  onPickFocus?: (focus: { x: number; y: number }) => void
}) {
  // Het focuspunt in het midden van het vlak (centeredFocus). Dat hangt af
  // van de maat van de foto en van het vlak, dus pas na het laden en bij
  // elke andere breedte; daarvoor (en op de server) het punt zelf.
  const imgRef = useRef<HTMLImageElement>(null)
  const [applied, setApplied] = useState<Focus | null>(focus ?? null)
  const measure = useCallback(() => {
    const img = imgRef.current
    if (!img || !focus) { setApplied(focus ?? null); return }
    const box = img.getBoundingClientRect()
    if (!img.naturalWidth || !img.naturalHeight || !box.width || !box.height) { setApplied(focus); return }
    setApplied(centeredFocus(focus, img.naturalWidth / img.naturalHeight, box.width / box.height))
  }, [focus])
  useEffect(() => {
    measure()
    const img = imgRef.current
    if (!img || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(measure)
    ro.observe(img)
    return () => ro.disconnect()
  }, [measure, src])
  const position = focusPosition(applied)

  const pick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!onPickFocus || cutout) return
    // Terugrekenen met de positie die nu op het beeld staat.
    const f = focusFromClick(e, applied)
    if (f) onPickFocus(f)
  }

  return (
    <section className="collection-hero" data-fit={cutout ? "contain" : "cover"} style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        onLoad={measure}
        src={src}
        alt={alt}
        style={cutout ? undefined : { objectPosition: position, cursor: onPickFocus ? "crosshair" : undefined }}
        onClick={onPickFocus ? pick : undefined}
      />
    </section>
  )
}
