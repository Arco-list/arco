"use client"

import { focusFromClick, focusPosition } from "@/lib/images/focus"

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
  const position = focusPosition(focus)

  const pick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!onPickFocus || cutout) return
    const f = focusFromClick(e, focus)
    if (f) onPickFocus(f)
  }

  return (
    <section className="collection-hero" data-fit={cutout ? "contain" : "cover"} style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        style={cutout ? undefined : { objectPosition: position, cursor: onPickFocus ? "crosshair" : undefined }}
        onClick={onPickFocus ? pick : undefined}
      />
    </section>
  )
}
