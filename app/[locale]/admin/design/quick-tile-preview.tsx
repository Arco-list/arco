"use client"

import { useState } from "react"
import { Check, Plus, X } from "lucide-react"

import { QuickRow } from "@/components/quick-row"
import { useBrandLogoFit } from "@/components/brand/brand-logo"
import { resolveFeatureIcon } from "@/lib/icons/project-features"
import { resolveProfessionalServiceIcon } from "@/lib/icons/professional-services"

// Een paar diensten zoals op /professionals: de getekende service mark in
// de schijf (72px, lijn 0.45; zie Service marks).
const SERVICE_SAMPLES = [
  { slug: "architect", label: "Architecten" },
  { slug: "interior-designer", label: "Interieurarchitecten" },
  { slug: "kitchens", label: "Keukenstudio's" },
  { slug: "garden-designer", label: "Tuinontwerpers" },
]

/**
 * De schijfkaart (cirkel + naam): .credit-card.service-quick-card.quick-tile
 * met .credit-icon en .quick-tile-label. Drie toepassingen, zelfde vorm:
 * de ingang onder de kop van een discover (ruimtes, diensten,
 * productgroepen), dezelfde schijf met een pictogram als er geen uitsnede
 * is, en de merkkiezer (project edit, bedrijfseditor) met plus en kruis.
 */

export type QuickTileSpace = { slug: string; label: string; cutoutUrl: string | null; iconKey: string | null }
export type QuickTileBrand = { id: string; name: string; logoUrl: string | null }

function BrandDisc({ brand }: { brand: QuickTileBrand }) {
  const { full, imgProps } = useBrandLogoFit(brand.logoUrl)
  if (!brand.logoUrl) return <span className="credit-icon-initials">{brand.name.charAt(0).toUpperCase()}</span>
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...imgProps}
      src={brand.logoUrl}
      alt=""
      className={full ? "credit-cutout" : undefined}
      style={full ? undefined : { width: "100%", height: "100%", objectFit: "contain", padding: "7%", boxSizing: "border-box", mixBlendMode: "multiply" }}
    />
  )
}

export function QuickTilePreview({ spaces, brands }: { spaces: QuickTileSpace[]; brands: QuickTileBrand[] }) {
  const [picked, setPicked] = useState<Set<string>>(new Set(brands.slice(0, 1).map((b) => b.id)))
  const toggle = (id: string) => setPicked((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      <div>
        <p className="arco-eyebrow" style={{ marginBottom: 16 }}>Discover-ingang (uitsnede)</p>
        <QuickRow>
          {spaces.map((s) => (
            <a key={s.slug} href="#quick-tiles" className="credit-card service-quick-card quick-tile" onClick={(e) => e.preventDefault()}>
              <div className="credit-icon">
                {s.cutoutUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.cutoutUrl} alt="" className="credit-cutout" />
                ) : (
                  (() => { const Icon = resolveFeatureIcon(s.iconKey ?? s.slug); return <Icon className="credit-icon-service" strokeWidth={1} /> })()
                )}
              </div>
              <h3 className="quick-tile-label">{s.label}</h3>
            </a>
          ))}
        </QuickRow>
      </div>

      <div>
        <p className="arco-eyebrow" style={{ marginBottom: 16 }}>Zonder uitsnede: service mark</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SERVICE_SAMPLES.map((sv) => {
            const Mark = resolveProfessionalServiceIcon(sv.slug)
            return (
              <div key={sv.slug} className="credit-card service-quick-card quick-tile">
                <div className="credit-icon"><Mark className="credit-icon-service" aria-hidden /></div>
                <h3 className="quick-tile-label">{sv.label}</h3>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <p className="arco-eyebrow" style={{ marginBottom: 16 }}>Merkkiezer: klik om te kiezen of weg te halen</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {brands.map((b) => {
            const selected = picked.has(b.id)
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => toggle(b.id)}
                aria-pressed={selected}
                className="credit-card service-quick-card quick-tile"
              >
                <div className="quick-tile-disc">
                  <div className="credit-icon">
                    <BrandDisc brand={b} />
                    <span className={`brand-pick-badge${selected ? " brand-pick-badge--remove" : ""}`} aria-hidden>
                      {selected ? <X size={16} /> : <Plus size={16} />}
                    </span>
                  </div>
                  {selected && (
                    <span className="quick-tile-badge" role="img" aria-label="Toegevoegd">
                      <Check size={12} strokeWidth={3} aria-hidden />
                    </span>
                  )}
                </div>
                <h3 className="quick-tile-label">{b.name}</h3>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
