"use client"

import { useState, type ReactNode } from "react"

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

export function CollectionGrid({ cards, showAllLabel }: { cards: ReactNode[]; showAllLabel: string }) {
  const [expanded, setExpanded] = useState(false)
  const total = cards.length
  const desktopCollapsible = total > DESKTOP_COLLAPSE_ABOVE
  const mobileCollapsible = total > MOBILE_COLLAPSE_ABOVE

  return (
    <>
      <div className="discover-grid collection-grid" data-collapsed={!expanded && (desktopCollapsible || mobileCollapsible) ? "true" : "false"}>
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
          <button type="button" className="btn-secondary" onClick={() => setExpanded(true)}>{showAllLabel}</button>
        </div>
      )}
    </>
  )
}
