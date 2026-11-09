import type React from "react"
import { getLocale, getTranslations } from "next-intl/server"

import { locationKindLabel, type LocationRecord } from "@/lib/locations/types"

/**
 * "Showrooms" op de bedrijfspagina: de vestigingen uit `locations`
 * (migratie 297), als kaarten in het contactraster. Het hoofdadres
 * blijft in het contactblok staan; dit zijn de plekken waar je langs
 * kunt. Op de merkpagina hergebruikt met de eigen vestigingen van het
 * merk.
 */
export async function ProfessionalLocations({ locations, heading, inWrap = true }: { locations: LocationRecord[]; heading?: string; /** false als de ouder al een .wrap is (merkpagina). */ inWrap?: boolean }) {
  if (locations.length === 0) return null
  const [t, locale] = await Promise.all([getTranslations("professional_detail"), getLocale()])

  const Wrap = ({ children }: { children: React.ReactNode }) => (inWrap ? <div className="wrap">{children}</div> : <>{children}</>)
  return (
    <section id="showrooms" style={{ marginBottom: 60 }}>
      <Wrap>
        <div className="section-header">
          <h2 className="arco-section-title">{heading ?? t("showrooms")}</h2>
        </div>
        <div className="contact-grid">
          {locations.map((loc) => {
            const street = loc.streetAddress ?? loc.address?.split(",")[0]?.trim() ?? null
            const cityLine = [loc.postalCode, loc.city].filter(Boolean).join(" ")
            const mapsQuery = encodeURIComponent(loc.address ?? [street, loc.city].filter(Boolean).join(", "))
            return (
              <div key={loc.id} className="contact-card">
                <span className="arco-eyebrow">{locationKindLabel(loc.kind, locale)}</span>
                <p className="arco-card-title" style={{ margin: "12px 0 4px" }}>{loc.name ?? loc.city ?? street}</p>
                {street && <p className="arco-body-text" style={{ margin: 0 }}>{street}</p>}
                {cityLine && <p className="arco-body-text" style={{ margin: 0 }}>{cityLine}</p>}
                {loc.openingHours && <p className="arco-body-text" style={{ margin: "8px 0 0", color: "#6b6b68", whiteSpace: "pre-line" }}>{loc.openingHours}</p>}
                <p className="arco-body-text" style={{ margin: "8px 0 0", display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {loc.phone && <a href={`tel:${loc.phone.replace(/\s+/g, "")}`} className="text-link-plain">{loc.phone}</a>}
                  {loc.address && (
                    <a href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`} target="_blank" rel="noopener noreferrer" className="text-link-plain">
                      {t("route")} →
                    </a>
                  )}
                </p>
              </div>
            )
          })}
        </div>
      </Wrap>
    </section>
  )
}
