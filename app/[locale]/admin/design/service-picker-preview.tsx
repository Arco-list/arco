"use client"

import { useState } from "react"
import { Search } from "lucide-react"

import { resolveProfessionalServiceIcon } from "@/lib/icons/professional-services"
import { ServicePills } from "@/components/service-pills"
// The claim funnel's own stylesheet, for the chosen-rows and the search
// box — imported rather than copied, so this section shows what ships.
// The pills below come from the shared component and need no import.
import styles from "../../claim/claim.module.css"

/**
 * The services picker: the chosen services in order, a search row, and
 * the taxonomy below as collapsible groups of pills.
 *
 * Fake taxonomy, real slugs — the marks resolve through
 * resolveProfessionalServiceIcon exactly as they do in the funnel, so a
 * missing mark shows up here as a missing mark.
 */

const GROUPS: { slug: string; label: string; services: { slug: string; label: string }[] }[] = [
  {
    slug: "design-planning",
    label: "Ontwerp & planning",
    services: [
      { slug: "architect", label: "Architect" },
      { slug: "interior-designer", label: "Interieurontwerper" },
      { slug: "garden-designer", label: "Tuinontwerper" },
      { slug: "structural-engineer", label: "Constructeur" },
      { slug: "lighting-designer", label: "Lichtontwerper" },
    ],
  },
  {
    slug: "construction",
    label: "Bouw",
    services: [
      { slug: "builder", label: "Aannemer" },
      { slug: "tiles-stones", label: "Tegels & Natuursteen" },
      { slug: "roofing", label: "Dakbedekking" },
      { slug: "windows-doors", label: "Ramen & Deuren" },
      { slug: "kitchens", label: "Keukens" },
      { slug: "bathrooms", label: "Badkamers" },
    ],
  },
]

const ALL = GROUPS.flatMap((g) => g.services.map((s) => ({ ...s, group: g.label })))

export function ServicePickerPreview() {
  const [chosen, setChosen] = useState<string[]>(["interior-designer"])

  const toggle = (slug: string) =>
    setChosen((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]))

  return (
    <div style={{ maxWidth: 560 }}>
      <label className="form-label">Je diensten</label>
      <p className={styles.note} style={{ margin: "0 0 14px" }}>
        Sleep om te herschikken. De eerste dienst is je hoofddienst.
      </p>

      {/* Chosen, in order. The first is the primary one — the badge
          follows the name rather than leading it, so every name in the
          list starts at the same x. */}
      <div className={styles.svcSelectedList}>
        {chosen.map((slug, idx) => {
          const svc = ALL.find((s) => s.slug === slug)
          if (!svc) return null
          const Mark = resolveProfessionalServiceIcon(svc.slug)
          return (
            <div key={slug} className={styles.svcItem}>
              <span className={styles.svcGrip}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="4" r="1.2"/><circle cx="11" cy="4" r="1.2"/><circle cx="5" cy="8" r="1.2"/><circle cx="11" cy="8" r="1.2"/><circle cx="5" cy="12" r="1.2"/><circle cx="11" cy="12" r="1.2"/></svg>
              </span>
              <Mark size={28} strokeWidth={1} className={styles.svcItemMark} aria-hidden />
              <span className={styles.svcItemName}>{svc.label}</span>
              {idx === 0 && <span className={styles.svcPrimaryBadge}>Primair</span>}
              <button type="button" className={styles.svcRemove} aria-label="Verwijder" onClick={() => toggle(slug)}>×</button>
            </div>
          )
        })}
      </div>

      {/* Search-to-add: the selected row again, but dashed — "the next
          one goes here". Inert in the preview; the pills below are the
          interactive part. */}
      <div className={styles.svcAdd}>
        <Search size={14} />
        <input className={styles.svcAddInput} placeholder="Zoek of selecteer hieronder" readOnly />
      </div>

      {/* The shipped component, not a copy of it. */}
      <ServicePills
        groups={GROUPS.map((g) => ({
          id: g.slug,
          slug: g.slug,
          label: g.label,
          services: g.services.map((svc) => ({ id: svc.slug, slug: svc.slug, label: svc.label })),
        }))}
        selectedIds={chosen}
        onToggle={toggle}
      />
    </div>
  )
}
