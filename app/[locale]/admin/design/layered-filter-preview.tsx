"use client"

import { useEffect, useRef, useState } from "react"

import { LayeredFilterPanel, layeredPath, layeredPillLabel, type LayeredGroup } from "@/components/filters/layered-filter"

/**
 * Voorbeeld van het gelaagde filter op /admin/design, met de echte
 * productsoorten (meerdere keuzes) en diensten (één keuze, zoals /brands
 * met ?kind=). De chips eronder tonen het pad van elke keuze.
 */

function ChevronDownIcon() {
  return (
    <svg className="filter-pill-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden>
      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function LayeredFilterPreview({ kinds, services }: { kinds: LayeredGroup[]; services: LayeredGroup[] }) {
  const [open, setOpen] = useState<"kind" | "service" | null>(null)
  const [kindPick, setKindPick] = useState<string[]>(() => {
    const furniture = kinds[0]
    return furniture?.children[0] ? [furniture.children[0].id] : []
  })
  const [servicePick, setServicePick] = useState<string[]>([])
  const barRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (barRef.current && !barRef.current.contains(e.target as Node)) setOpen(null) }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  const pill = (key: "kind" | "service", fallback: string, groups: LayeredGroup[], picked: string[]) => (
    <button
      type="button"
      className="filter-pill"
      data-active={picked.length > 0 || undefined}
      data-open={open === key || undefined}
      onClick={() => setOpen(open === key ? null : key)}
      aria-expanded={open === key}
    >
      {layeredPillLabel(groups, picked, fallback, "nl")}
      <ChevronDownIcon />
    </button>
  )

  const chips = [
    ...kindPick.map((id) => ({ key: `k-${id}`, label: layeredPath(kinds, id) ?? id, remove: () => setKindPick(kindPick.filter((x) => x !== id)) })),
    ...servicePick.map((id) => ({ key: `s-${id}`, label: layeredPath(services, id) ?? id, remove: () => setServicePick([]) })),
  ]

  return (
    <div ref={barRef}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div className="filter-pill-group" style={{ position: "relative" }}>
          {pill("kind", "Soort", kinds, kindPick)}
          <div className="filter-dropdown" data-open={open === "kind" ? "true" : undefined}>
            <LayeredFilterPanel groups={kinds} selected={kindPick} onChange={setKindPick} locale="nl" />
          </div>
        </div>
        <div className="filter-pill-group" style={{ position: "relative" }}>
          {pill("service", "Dienst", services, servicePick)}
          <div className="filter-dropdown" data-open={open === "service" ? "true" : undefined}>
            <LayeredFilterPanel
              groups={services}
              selected={servicePick}
              onChange={(next) => { setServicePick(next); setOpen(null) }}
              locale="nl"
              single
            />
          </div>
        </div>
      </div>
      <div className="discover-chip-strip-inner" style={{ marginTop: 16, minHeight: 28 }}>
        {chips.map((c) => (
          <button key={c.key} type="button" className="filter-chip" onClick={c.remove}>
            {c.label} <span className="filter-chip-close" aria-hidden="true">✕</span>
          </button>
        ))}
        {chips.length > 0 && (
          <button type="button" className="filter-chip-clear-all" onClick={() => { setKindPick([]); setServicePick([]) }}>Alles wissen</button>
        )}
      </div>
      {/* Ruimte zodat de geopende lijst binnen het voorbeeldvlak valt. */}
      <div style={{ height: open ? 400 : 0, transition: "height 0.2s" }} />
    </div>
  )
}
