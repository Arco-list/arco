"use client"

import { useEffect, useMemo, useState, type KeyboardEvent } from "react"

/**
 * Gelaagd filter: groepen links, wat erin zit rechts (/admin/design → Filters).
 *
 * Eén component voor elk filter met twee lagen — soorten producten
 * (Meubels › Banken & fauteuils) en diensten (Bouw › Keukenstudio). De laag
 * blijkt uit de plek, niet uit inspringing: links de groepen, rechts de
 * onderdelen van de actieve groep. Hover op een groep toont zijn onderdelen,
 * klikken kiest de hele groep. Op een smal scherm (geen hover) opent het
 * pijltje de onderdelen: "‹ Groep" met wat erin zit.
 *
 * Keuzeregels (de ouder bewaart de keuze; dit component meldt de nieuwe):
 * - een groep kiezen haalt de gekozen onderdelen van die groep weg;
 * - een onderdeel kiezen haalt de groep zelf weg;
 * - bij `single` blijft er hooguit één keuze over.
 */

/** `children` op een onderdeel: een derde laag (soorten onder een subgroep). */
export type LayeredOption = { id: string; label: string; count?: number; children?: LayeredOption[] }
export type LayeredGroup = LayeredOption & { children: LayeredOption[] }

const COPY = {
  nl: { back: "Terug", more: (n: number) => `+${n}` },
  en: { back: "Back", more: (n: number) => `+${n}` },
}

function CheckIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden>
      <path d="M1.5 4.5l2 2L7.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Chevron({ dir }: { dir: "right" | "left" }) {
  return (
    <svg width="7" height="11" viewBox="0 0 7 11" fill="none" aria-hidden style={dir === "left" ? { transform: "rotate(180deg)" } : undefined}>
      <path d="M1.5 1.5l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** De nieuwe keuze na een klik op een groep (`childId` leeg), een onderdeel
 *  of een soort onder een onderdeel (`grandchildId`). */
export function nextLayeredSelection(groups: LayeredGroup[], selected: string[], groupId: string, childId: string | null, single = false, grandchildId: string | null = null): string[] {
  const id = grandchildId ?? childId ?? groupId
  const has = selected.includes(id)
  if (single) return has ? [] : [id]
  if (has) return selected.filter((s) => s !== id)
  const group = groups.find((g) => g.id === groupId)
  const child = childId ? group?.children.find((c) => c.id === childId) : undefined
  // Wat erboven en eronder hangt valt weg: een groep omvat zijn onderdelen
  // en soorten, een soort kiezen maakt de groep als geheel ongedaan.
  const above = new Set(grandchildId ? [groupId, childId] : childId ? [groupId] : [])
  const below = new Set(
    grandchildId ? [] :
    childId ? (child?.children ?? []).map((k) => k.id) :
    (group?.children ?? []).flatMap((c) => [c.id, ...(c.children ?? []).map((k) => k.id)]),
  )
  return [...selected.filter((s) => !above.has(s) && !below.has(s)), id]
}

/** Pad van een keuze, voor chips: "Meubels › Banken & fauteuils". */
export function layeredPath(groups: LayeredGroup[], id: string): string | null {
  for (const g of groups) {
    if (g.id === id) return g.label
    for (const c of g.children) {
      if (c.id === id) return `${g.label} › ${c.label}`
      const k = c.children?.find((x) => x.id === id)
      if (k) return `${g.label} › ${c.label} › ${k.label}`
    }
  }
  return null
}

/** Tekst op de pill: de eerste keuze, en hoeveel er nog meer zijn. */
export function layeredPillLabel(groups: LayeredGroup[], selected: string[], fallback: string, locale: string): string {
  const labels = selected
    .map((id) => {
      const flat = groups.flatMap((g) => [g, ...g.children, ...g.children.flatMap((c) => c.children ?? [])])
      return flat.find((o) => o.id === id)?.label
    })
    .filter((l): l is string => Boolean(l))
  if (labels.length === 0) return fallback
  const t = locale === "nl" ? COPY.nl : COPY.en
  return labels.length === 1 ? labels[0] : `${labels[0]} ${t.more(labels.length - 1)}`
}

export function LayeredFilterPanel({
  groups,
  selected,
  onChange,
  locale,
  single = false,
}: {
  groups: LayeredGroup[]
  selected: string[]
  onChange: (next: string[]) => void
  locale: string
  /** Hooguit één keuze (een radio in plaats van vinkjes). */
  single?: boolean
}) {
  const selectedSet = useMemo(() => new Set(selected), [selected])
  const groupHasPick = (g: LayeredGroup) => selectedSet.has(g.id) || childPicks(g) > 0
  const childPicks = (g: LayeredGroup) => g.children.reduce((n, c) => n + (selectedSet.has(c.id) ? 1 : 0) + (c.children ?? []).filter((k) => selectedSet.has(k.id)).length, 0)

  // Actieve groep (rechts getoond): bij openen die met een keuze, anders de
  // eerste. Hover of focus op een groep maakt hem actief; klikken kiest hem.
  const [activeId, setActiveId] = useState<string | null>(() => groups.find(groupHasPick)?.id ?? groups[0]?.id ?? null)
  // Op mobiel (geen hover): eerst de groepen, het pijltje opent de subgroepen
  // (en bij drie lagen de soorten van een subgroep).
  const [stage, setStage] = useState<"groups" | "children" | "kinds">("groups")
  // Drie lagen (soorten onder subgroepen): een derde kolom.
  const threeLevel = groups.some((g) => g.children.some((c) => (c.children?.length ?? 0) > 0))
  const kindPicks = (c: LayeredOption) => (c.children ?? []).filter((k) => selectedSet.has(k.id)).length
  const [activeChildId, setActiveChildId] = useState<string | null>(null)
  useEffect(() => {
    if (activeId && groups.some((g) => g.id === activeId)) return
    setActiveId(groups.find(groupHasPick)?.id ?? groups[0]?.id ?? null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups])

  const active = groups.find((g) => g.id === activeId) ?? null
  // Actieve subgroep (derde kolom): die met een keuze, anders de eerste met soorten.
  const activeChild = active
    ? active.children.find((c) => c.id === activeChildId)
      ?? active.children.find((c) => kindPicks(c) > 0)
      ?? active.children.find((c) => (c.children?.length ?? 0) > 0)
      ?? null
    : null
  const pick = (groupId: string, childId: string | null) => onChange(nextLayeredSelection(groups, selected, groupId, childId, single))
  const onKey = (fn: () => void) => (e: KeyboardEvent) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); fn() } }
  const box = (checked: boolean) => (
    <div className={`filter-checkbox${single ? " filter-checkbox--radio" : ""}`}>{checked && <CheckIcon />}</div>
  )
  const open = (id: string) => { setActiveId(id); setActiveChildId(null); setStage("children") }
  const openChild = (id: string) => { setActiveChildId(id); setStage("kinds") }

  return (
    <div className="layered-filter" data-stage={stage} data-levels={threeLevel ? 3 : 2}>
      <div className="layered-filter-groups" role="listbox" aria-label="Groups">
        {groups.map((g) => {
          const checked = selectedSet.has(g.id)
          const n = childPicks(g)
          return (
            <div
              key={g.id}
              className="layered-filter-group"
              data-active={g.id === activeId || undefined}
              data-checked={checked || undefined}
              role="option"
              aria-selected={checked}
              tabIndex={0}
              onMouseEnter={() => { if (g.id !== activeId) { setActiveId(g.id); setActiveChildId(null) } }}
              onFocus={() => { if (g.id !== activeId) { setActiveId(g.id); setActiveChildId(null) } }}
              onClick={() => pick(g.id, null)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") { e.preventDefault(); open(g.id); return }
                onKey(() => pick(g.id, null))(e)
              }}
            >
              {box(checked)}
              <span className="layered-filter-group-label">{g.label}</span>
              {n > 0 ? <span className="filter-pill-badge">{n}</span> : g.count !== undefined && <span className="layered-filter-count">{g.count}</span>}
              {g.children.length > 0 ? (
                <button
                  type="button"
                  className="layered-filter-open"
                  aria-label={g.label}
                  tabIndex={-1}
                  onClick={(e) => { e.stopPropagation(); open(g.id) }}
                >
                  <Chevron dir="right" />
                </button>
              ) : <span className="layered-filter-open" aria-hidden />}
            </div>
          )
        })}
      </div>

      {threeLevel ? (
        <>
          <div className="layered-filter-children layered-filter-mid" role="listbox" aria-label={active?.label}>
            {active && (
              <>
                <button type="button" className="layered-filter-back" onClick={() => setStage("groups")}>
                  <Chevron dir="left" />
                  {active.label}
                </button>
                {active.children.map((c) => {
                  const checked = selectedSet.has(c.id)
                  const n = kindPicks(c)
                  const hasKinds = (c.children?.length ?? 0) > 0
                  return (
                    <div
                      key={c.id}
                      className="layered-filter-group"
                      data-active={c.id === activeChild?.id || undefined}
                      data-checked={checked || undefined}
                      role="option"
                      aria-selected={checked}
                      tabIndex={0}
                      onMouseEnter={() => setActiveChildId(c.id)}
                      onFocus={() => setActiveChildId(c.id)}
                      onClick={() => pick(active.id, c.id)}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowRight" && hasKinds) { e.preventDefault(); openChild(c.id); return }
                        onKey(() => pick(active.id, c.id))(e)
                      }}
                    >
                      {box(checked)}
                      <span className="layered-filter-group-label">{c.label}</span>
                      {n > 0 && <span className="filter-pill-badge">{n}</span>}
                      {hasKinds ? (
                        <button
                          type="button"
                          className="layered-filter-open"
                          aria-label={c.label}
                          tabIndex={-1}
                          onClick={(e) => { e.stopPropagation(); openChild(c.id) }}
                        >
                          <Chevron dir="right" />
                        </button>
                      ) : <span className="layered-filter-open" aria-hidden />}
                    </div>
                  )
                })}
              </>
            )}
          </div>

          <div className="layered-filter-kinds" role="listbox" aria-label={activeChild?.label}>
            {active && activeChild && (
              <>
                <button type="button" className="layered-filter-back" onClick={() => setStage("children")}>
                  <Chevron dir="left" />
                  {activeChild.label}
                </button>
                {(activeChild.children ?? []).map((k) => {
                  const checked = selectedSet.has(k.id)
                  const onClick = () => onChange(nextLayeredSelection(groups, selected, active.id, activeChild.id, single, k.id))
                  return (
                    <div
                      key={k.id}
                      className="filter-dropdown-option"
                      data-checked={checked || undefined}
                      role="option"
                      aria-selected={checked}
                      tabIndex={0}
                      onClick={onClick}
                      onKeyDown={onKey(onClick)}
                    >
                      <div className="filter-dropdown-option-left">
                        {box(checked)}
                        <span className="filter-dropdown-label">{k.label}</span>
                      </div>
                      {k.count !== undefined && <span className="layered-filter-count">{k.count}</span>}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </>
      ) : (
      <div className="layered-filter-children" role="listbox" aria-label={active?.label}>
          {active && (
            <>
              <button type="button" className="layered-filter-back" onClick={() => setStage("groups")}>
                <Chevron dir="left" />
                {active.label}
              </button>
              {active.children.map((c) => {
                const checked = selectedSet.has(c.id)
                const onClick = () => pick(active.id, c.id)
                return (
                  <div key={c.id}>
                    <div
                      className="filter-dropdown-option"
                      data-checked={checked || undefined}
                      role="option"
                      aria-selected={checked}
                      tabIndex={0}
                      onClick={onClick}
                      onKeyDown={onKey(onClick)}
                    >
                      <div className="filter-dropdown-option-left">
                        {box(checked)}
                        <span className="filter-dropdown-label" style={c.children?.length ? { fontWeight: 500 } : undefined}>{c.label}</span>
                      </div>
                      {c.count !== undefined && <span className="layered-filter-count">{c.count}</span>}
                    </div>
                    {/* Derde laag: de soorten onder deze subgroep, ingesprongen. */}
                    {(c.children ?? []).map((k) => {
                      const kChecked = selectedSet.has(k.id)
                      const onKind = () => onChange(nextLayeredSelection(groups, selected, active.id, c.id, single, k.id))
                      return (
                        <div
                          key={k.id}
                          className="filter-dropdown-option"
                          data-checked={kChecked || undefined}
                          role="option"
                          aria-selected={kChecked}
                          tabIndex={0}
                          style={{ paddingLeft: 36 }}
                          onClick={onKind}
                          onKeyDown={onKey(onKind)}
                        >
                          <div className="filter-dropdown-option-left">
                            {box(kChecked)}
                            <span className="filter-dropdown-label">{k.label}</span>
                          </div>
                          {k.count !== undefined && <span className="layered-filter-count">{k.count}</span>}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}
