"use client"

import { useState, type KeyboardEvent, type ReactNode } from "react"

/**
 * Een sectie in de lade "Alle filters" (projecten, professionals,
 * producten): titel met de zwarte cirkel van het aantal keuzes, inklapbaar.
 */
export function DrawerSection({ title, activeCount, selectedLabel, children }: {
  title: string
  activeCount: number
  /** Voor schermlezers: "2 geselecteerd". */
  selectedLabel: string
  children: ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div className="drawer-section" data-collapsed={collapsed}>
      <div
        className="drawer-section-header"
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((c) => !c)}
        onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
          if (e.key === " " || e.key === "Enter") { e.preventDefault(); setCollapsed((c) => !c) }
        }}
      >
        <div className="drawer-section-header-left">
          <span className="drawer-section-title">{title}</span>
          {/* Zelfde zwarte cirkel als op de pills en in de dropdowns. */}
          {activeCount > 0 && (
            <span className="filter-pill-badge" aria-label={selectedLabel}>{activeCount}</span>
          )}
        </div>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"
          className="drawer-section-chevron">
          <path d="M2 4l3 3 3-3" />
        </svg>
      </div>
      {!collapsed && <div className="drawer-section-body">{children}</div>}
    </div>
  )
}
