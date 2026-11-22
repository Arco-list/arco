"use client"

import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { ChevronRight } from "lucide-react"

/**
 * Merktegels in rijen, met na ROWS rijen een "Meer merken"-knop in de
 * stijl van "Meer foto's" onder de Fototour (btn-tertiary + chevron).
 * Hoeveel tegels er op een rij passen hangt van de breedte af; dat meten
 * we in de browser (eerste tegel tegen de breedte van de rij). Tot die
 * meting tonen we er 3 × 8, wat op een desktop precies drie rijen is.
 *
 * Gebruikt op de bedrijfspagina en in company edit.
 */

const ROWS = 3
const GUESS_PER_ROW = 8
/** Ruimte tussen de tegels: 24px tussen de rijen (naam en volgende schijf
 *  liepen anders in elkaar over), 8px ernaast zoals overal bij disc tiles. */
export const BRAND_GRID_GAP = "24px 8px"

export function BrandRows<T>({ items, render, resetKey, locale }: {
  items: T[]
  /** Rendert de tegels (de rij zelf, met BRAND_GRID_GAP). */
  render: (visible: T[]) => ReactNode
  /** Bij een andere waarde (bv. de gekozen categorie) weer ingeklapt. */
  resetKey?: string | null
  locale: string
}) {
  const wrap = useRef<HTMLDivElement | null>(null)
  const [perRow, setPerRow] = useState(GUESS_PER_ROW)
  const [expanded, setExpanded] = useState(false)
  const [lastKey, setLastKey] = useState(resetKey)
  if (lastKey !== resetKey) {
    setLastKey(resetKey)
    setExpanded(false)
  }

  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const measure = () => {
      const tile = el.querySelector<HTMLElement>(".quick-tile")
      if (!tile) return
      const w = tile.getBoundingClientRect().width
      if (w <= 0) return
      setPerRow(Math.max(1, Math.floor((el.clientWidth + 8) / (w + 8))))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const limit = perRow * ROWS
  const clamped = !expanded && items.length > limit
  const nl = locale === "nl"

  return (
    <div ref={wrap}>
      {render(clamped ? items.slice(0, limit) : items)}
      {items.length > limit && (
        <div className="show-more-container">
          <button type="button" className="btn-tertiary" onClick={() => setExpanded((v) => !v)}>
            {expanded ? (nl ? "Minder merken" : "Fewer brands") : (nl ? "Meer merken" : "More brands")}
            <ChevronRight size={16} style={expanded ? { transform: "rotate(180deg)" } : undefined} />
          </button>
        </div>
      )}
    </div>
  )
}
