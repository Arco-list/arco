"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { useLocale } from "next-intl"

/**
 * De rij schijven onder de kop van een discover (diensten, ruimtes,
 * productgroepen) als carrousel: een pijl rechts die één kaart schuift, de linkerpijl zodra er iets
 * terug te schuiven is. Op touch gewoon swipen, met snap per kaart.
 *
 * Vaste maat: schijven zijn overal 150px breed (112px op mobiel) met 8px
 * ertussen, links uitgelijnd — dezelfde afstand als op /projects, ook als
 * er meer zijn dan er passen (dan loopt de laatste half onder de pijl, als
 * hint dat er meer is). Met `fill` rekken de kaarten op tot de rij precies
 * vol is, zonder halve kaart; dat is voor merkkaarten. De pijlen staan half
 * over de rand van de inhoud, in de marge van de pagina.
 */

const GAP = 8
const MIN_TILE_DESKTOP = 150
const MIN_TILE_MOBILE = 112

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {dir === "left" ? <path d="M10 3L5 8l5 5" /> : <path d="M6 3l5 5-5 5" />}
    </svg>
  )
}

export function QuickRow({ children, minTile, arrowTop, gap = GAP, fill = false }: {
  children: ReactNode
  /** Minimale kaartbreedte; standaard de schijven (150 desktop, 112 mobiel). */
  minTile?: { desktop: number; mobile: number }
  /** Hoogte van het midden van de pijlen (px of CSS); standaard het midden van een schijf. */
  arrowTop?: number | string
  /** Ruimte tussen de kaarten; standaard 8px (schijven). */
  gap?: number
  /** Kaarten oprekken tot de rij precies vol is (merkkaarten). Standaard
   *  niet: schijven houden overal dezelfde maat en afstand als op
   *  /projects, ook als er meer zijn dan er passen. */
  fill?: boolean
}) {
  const locale = useLocale()
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const rowRef = useRef<HTMLDivElement | null>(null)
  const [tileW, setTileW] = useState<number | null>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const measure = useCallback(() => {
    const wrap = wrapRef.current
    const row = rowRef.current
    if (!wrap || !row) return
    const total = row.children.length
    if (total === 0) return
    const mobile = window.matchMedia("(max-width: 768px)").matches
    const min = mobile ? (minTile?.mobile ?? MIN_TILE_MOBILE) : (minTile?.desktop ?? MIN_TILE_DESKTOP)
    const width = wrap.clientWidth
    const visible = Math.max(1, Math.floor((width + gap) / (min + gap)))
    // Passen alle kaarten? Dan op hun eigen breedte, links uitgelijnd —
    // zes productgroepen over de volle breedte uitsmeren oogt als een
    // tabel. Alleen als er meer kaarten zijn dan er passen vult de rij
    // de breedte, zodat er nooit een halve kaart aan de rechterkant staat.
    setTileW(!fill || total <= visible ? min : (width + gap) / visible - gap)
    setCanLeft(row.scrollLeft > 1)
    setCanRight(row.scrollLeft + row.clientWidth < row.scrollWidth - 1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minTile?.desktop, minTile?.mobile, gap, fill])

  // Na elke breedtewijziging opnieuw meten: de eerste meting zet de
  // kaartbreedte, de tweede (op tileW) leest de scrollruimte die daar
  // uit volgt.
  useLayoutEffect(() => { measure() }, [measure, tileW])
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(() => measure())
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [measure])

  const step = (dir: 1 | -1) => {
    const row = rowRef.current
    if (!row) return
    const tile = row.firstElementChild as HTMLElement | null
    const pitch = (tile?.getBoundingClientRect().width ?? MIN_TILE_DESKTOP) + gap
    row.scrollBy({ left: dir * pitch, behavior: "smooth" })
  }

  const prev = locale === "nl" ? "Vorige" : "Previous"
  const next = locale === "nl" ? "Volgende" : "Next"
  // De kaartbreedte op de buitenste laag: de rij én de pijlen (die kunnen
  // hun hoogte uit de kaartbreedte rekenen) lezen hem.
  const wrapStyle = ({
    ...(tileW == null ? {} : { "--quick-tile-w": `${tileW}px` }),
    ...(arrowTop == null ? {} : { "--quick-row-arrow-top": typeof arrowTop === "number" ? `${arrowTop}px` : arrowTop }),
  } as CSSProperties)
  const rowStyle = gap === GAP ? undefined : ({ gap: `${gap}px` } as CSSProperties)

  return (
    <div ref={wrapRef} className="quick-row-wrap" style={wrapStyle}>
      <div ref={rowRef} className="quick-row" style={rowStyle} onScroll={measure}>
        {children}
      </div>
      {canLeft && (
        <button type="button" className="quick-row-arrow quick-row-arrow--left" onClick={() => step(-1)} aria-label={prev}>
          <Chevron dir="left" />
        </button>
      )}
      {canRight && (
        <button type="button" className="quick-row-arrow quick-row-arrow--right" onClick={() => step(1)} aria-label={next}>
          <Chevron dir="right" />
        </button>
      )}
    </div>
  )
}
