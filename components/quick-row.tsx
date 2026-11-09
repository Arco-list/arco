"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { useLocale } from "next-intl"

/**
 * De rij schijven onder de kop van een discover (diensten, ruimtes,
 * productgroepen) als carrousel: altijd alleen hele kaarten in beeld,
 * een pijl rechts die één kaart schuift, de linkerpijl zodra er iets
 * terug te schuiven is. Op touch gewoon swipen, met snap per kaart.
 *
 * Hele kaarten: we meten de breedte van de rij en delen die in zoveel
 * kaarten als er minimaal in passen (150px op desktop, 112px op mobiel).
 * Passen ze allemaal, dan staan ze op die breedte links uitgelijnd;
 * zijn het er meer, dan krijgen de kaarten samen precies de breedte van
 * de rij, zonder halve kaart aan de rechterkant. De pijlen staan half
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

export function QuickRow({ children }: { children: ReactNode }) {
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
    const minTile = window.matchMedia("(max-width: 768px)").matches ? MIN_TILE_MOBILE : MIN_TILE_DESKTOP
    const width = wrap.clientWidth
    const visible = Math.max(1, Math.floor((width + GAP) / (minTile + GAP)))
    // Passen alle kaarten? Dan op hun eigen breedte, links uitgelijnd —
    // zes productgroepen over de volle breedte uitsmeren oogt als een
    // tabel. Alleen als er meer kaarten zijn dan er passen vult de rij
    // de breedte, zodat er nooit een halve kaart aan de rechterkant staat.
    setTileW(total <= visible ? minTile : (width + GAP) / visible - GAP)
    setCanLeft(row.scrollLeft > 1)
    setCanRight(row.scrollLeft + row.clientWidth < row.scrollWidth - 1)
  }, [])

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
    const pitch = (tile?.getBoundingClientRect().width ?? MIN_TILE_DESKTOP) + GAP
    row.scrollBy({ left: dir * pitch, behavior: "smooth" })
  }

  const prev = locale === "nl" ? "Vorige" : "Previous"
  const next = locale === "nl" ? "Volgende" : "Next"
  const rowStyle = tileW == null ? undefined : ({ "--quick-tile-w": `${tileW}px` } as CSSProperties)

  return (
    <div ref={wrapRef} className="quick-row-wrap">
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
