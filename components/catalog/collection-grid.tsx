"use client"

import { useRef, useState, type ReactNode } from "react"
import { ChevronRight, ChevronUp } from "lucide-react"

/**
 * Het collectieraster van een merk, ingeklapt als er veel zijn: op
 * computer en tablet de eerste 6 (twee rijen van drie), op telefoon de
 * eerste 4, met een knop die de rest openklapt. Een merk met net iets
 * meer dan dat toont alles — een knop voor één of twee kaarten is
 * irritanter dan een iets langere pagina: boven 8 collecties klapt het
 * in op computer en tablet, boven 6 op telefoon.
 *
 * Alle kaarten staan in de pagina; de verborgen kaarten worden alleen met
 * CSS weggestopt (zie .collection-grid in globals.css). Zo blijven ze
 * vindbaar voor zoekmachines, en hoeft de server niet te weten hoe breed
 * het scherm is.
 */

export const DESKTOP_VISIBLE = 6
export const MOBILE_VISIBLE = 4
const DESKTOP_COLLAPSE_ABOVE = 8
const MOBILE_COLLAPSE_ABOVE = 6

export function CollectionGrid({ cards, showAllLabel, hideLabel }: { cards: ReactNode[]; showAllLabel: string; /** Na openklappen: weer inklappen. */ hideLabel?: string }) {
  const [expanded, setExpanded] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)
  // Inklappen en terug naar het begin van het raster, anders sta je
  // ineens ver onder de collecties.
  const collapse = () => {
    setExpanded(false)
    const top = gridRef.current?.getBoundingClientRect().top
    if (top != null && top < 0) window.scrollBy({ top: top - 140, behavior: "smooth" })
  }
  const total = cards.length
  const desktopCollapsible = total > DESKTOP_COLLAPSE_ABOVE
  const mobileCollapsible = total > MOBILE_COLLAPSE_ABOVE

  return (
    <>
      <div ref={gridRef} className="discover-grid collection-grid" data-collapsed={!expanded && (desktopCollapsible || mobileCollapsible) ? "true" : "false"}>
        {cards.map((card, i) => {
          const cls = [
            desktopCollapsible && i >= DESKTOP_VISIBLE ? "cg-d" : "",
            mobileCollapsible && i >= MOBILE_VISIBLE ? "cg-m" : "",
          ].filter(Boolean).join(" ")
          return <div key={i} className={cls || undefined}>{card}</div>
        })}
      </div>
      {!expanded && (desktopCollapsible || mobileCollapsible) && (
        <div className={["collection-grid-more", desktopCollapsible ? "cg-more-d" : "", mobileCollapsible ? "cg-more-m" : ""].filter(Boolean).join(" ")}>
          {/* Zelfde knop als "Meer producten" en "Meer merken": tertiair met pijl. */}
          <button type="button" className="btn-tertiary" onClick={() => setExpanded(true)}>
            {showAllLabel}
            <ChevronRight size={16} />
          </button>
        </div>
      )}
      {expanded && hideLabel && (
        <div className={["collection-grid-more", desktopCollapsible ? "cg-more-d" : "", mobileCollapsible ? "cg-more-m" : ""].filter(Boolean).join(" ")}>
          <button type="button" className="btn-tertiary" onClick={collapse}>
            {hideLabel}
            <ChevronUp size={16} />
          </button>
        </div>
      )}
    </>
  )
}
