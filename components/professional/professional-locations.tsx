import type React from "react"
import { getLocale, getTranslations } from "next-intl/server"

import type { LocationRecord } from "@/lib/locations/types"
import { LocationCards } from "@/components/locations/location-cards"

/**
 * "Showrooms" op de bedrijfspagina: de vestigingen uit `locations`
 * (migratie 297), als kaarten zoals een professionalkaart (foto, naam,
 * soort · plaats); een klik opent adres, telefoon en openingstijden. Het hoofdadres
 * staat in de details-balk; dit zijn de plekken waar je langs kunt. Bij
 * één vestiging heet de kop "Showroom". Op de merkpagina hergebruikt met de eigen vestigingen van het
 * merk.
 */
export async function ProfessionalLocations({ locations, heading, inWrap = true, fallbackLogoUrl }: { locations: LocationRecord[]; heading?: string; /** Logo voor showrooms zonder foto. */ fallbackLogoUrl?: string | null; /** false als de ouder al een .wrap is (merkpagina). */ inWrap?: boolean }) {
  if (locations.length === 0) return null
  const [t, locale] = await Promise.all([getTranslations("professional_detail"), getLocale()])

  const Wrap = ({ children }: { children: React.ReactNode }) => (inWrap ? <div className="wrap">{children}</div> : <>{children}</>)
  return (
    <section id="showrooms" style={{ marginBottom: 60 }}>
      <Wrap>
        <div className="section-header">
          <h2 className="arco-section-title">{heading ?? (locations.length === 1 ? t("showroom") : t("showrooms"))}</h2>
        </div>
        <LocationCards mode="public" locations={locations} fallbackLogoUrl={fallbackLogoUrl} locale={locale} />
      </Wrap>
    </section>
  )
}
