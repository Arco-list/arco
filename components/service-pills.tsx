"use client"

import { resolveProfessionalServiceIcon } from "@/lib/icons/professional-services"

/**
 * Choosing what a company does.
 *
 * The same control wherever that question is asked — the claim funnel,
 * the company editor, the add-professional popover on a project. It
 * used to be three hand-drawn copies, and they drifted: one carried its
 * service mark at 18px while the others shipped 24. A design page can
 * only catch that if there is one thing to look at.
 *
 * Each pill wears its service mark, resolved from the real category
 * slug, so a service is recognisable before it is read and a service
 * without a mark shows up as a gap rather than reaching production
 * unnoticed. Selection is border + tint + aria-pressed, never a tick:
 * two glyphs left of the label read as clutter.
 *
 * Styles live in globals.css (.service-pill*); see /design → Form
 * Elements → Services picker.
 */

export type ServicePillService = {
  id: string
  label: string
  /** categories.slug — what the mark is resolved from. */
  slug?: string | null
}

export type ServicePillGroup = {
  id: string
  label: string
  /** categories.slug of the group, for the mark's category fallback. */
  slug?: string | null
  services: ServicePillService[]
}

export function ServicePills({
  groups,
  selectedIds,
  onToggle,
  max,
  openGroupIds,
  collapsible = true,
  fill = false,
  groupLabels = true,
}: {
  groups: ServicePillGroup[]
  selectedIds: string[]
  onToggle: (serviceId: string) => void
  /** Cap on selections. At the cap, unchosen pills go quiet. */
  max?: number
  /** Groups to start expanded. Defaults to any group holding a
   *  selection, else the first — so the reader lands where their own
   *  work already is. */
  openGroupIds?: string[]
  /** Off inside a popover that is already scrollable: the extra click
   *  buys nothing there. */
  collapsible?: boolean
  /** Grow the pills to fill each row, for narrow panels where a ragged
   *  right edge is the widest thing on screen. */
  fill?: boolean
  /**
   * Off when the list is already narrowed to one company's own services:
   * naming the category above a single pill tells the reader something
   * they can see, and turns a three-item list into six lines.
   */
  groupLabels?: boolean
}) {
  const atMax = max != null && selectedIds.length >= max

  const isOpen = (group: ServicePillGroup, index: number) => {
    if (openGroupIds) return openGroupIds.includes(group.id)
    const holdsSelection = group.services.some((s) => selectedIds.includes(s.id))
    return holdsSelection || (index === 0 && !groups.some((g) => g.services.some((s) => selectedIds.includes(s.id))))
  }

  const renderPill = (service: ServicePillService, group: ServicePillGroup) => {
    const on = selectedIds.includes(service.id)
    const blocked = atMax && !on
    const Icon = resolveProfessionalServiceIcon(service.slug ?? service.label, group.slug ?? group.label)
    return (
      <button
        key={service.id}
        type="button"
        aria-pressed={on}
        disabled={blocked}
        className={`service-pill${on ? " service-pill--on" : ""}${blocked ? " service-pill--disabled" : ""}`}
        onClick={() => {
          if (blocked) return
          onToggle(service.id)
        }}
      >
        <Icon size={22} strokeWidth={1} className="service-pill-icon" aria-hidden />
        {service.label}
      </button>
    )
  }

  const renderPills = (group: ServicePillGroup) => (
    <div className={`service-pills${fill ? " service-pills--fill" : ""}`} style={{ padding: "4px 0 11px" }}>
      {group.services.map((service) => renderPill(service, group))}
    </div>
  )

  // Narrowed to one company: the categories have nothing left to sort,
  // so the pills stand on their own.
  if (!groupLabels) {
    return (
      <div className={`service-pills${fill ? " service-pills--fill" : ""}`} style={{ padding: "4px 0 0" }}>
        {groups.flatMap((group) => group.services.map((service) => renderPill(service, group)))}
      </div>
    )
  }

  return (
    <>
      {groups.map((group, index) => {
        const count = group.services.filter((s) => selectedIds.includes(s.id)).length

        const label = (
          <>
            <span>{group.label}</span>
            {count > 0 && <span className="filter-pill-badge">{count}</span>}
          </>
        )

        if (!collapsible) {
          return (
            <div key={group.id} className="service-pill-group">
              <div className="service-pill-group-summary" style={{ cursor: "default" }}>
                {label}
              </div>
              {renderPills(group)}
            </div>
          )
        }

        return (
          <details key={group.id} className="service-pill-group" open={isOpen(group, index)}>
            <summary className="service-pill-group-summary">
              {label}
              <span className="service-pill-group-chevron" aria-hidden>
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </summary>
            {renderPills(group)}
          </details>
        )
      })}
    </>
  )
}
