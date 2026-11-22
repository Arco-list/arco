import { getTranslations } from "next-intl/server"

import { SpecAddress, SpecWebsite } from "@/components/professional/spec-website"

interface ProfessionalSpecsProps {
  location: string | null
  /** Kantooradres; met straat wordt de Locatie-cel een kaartlink. */
  address: string | null
  city: string | null
  /** Naam en Google-vermelding, voor de kaartlink. */
  name: string
  placeId: string | null
  established: number | null
  teamSize: number | null
  certificates: string[]
  /** Domein van het bedrijf (zonder https://); laatste cel van de balk. */
  domain: string | null
}

export async function ProfessionalSpecs({
  location,
  address,
  city,
  name,
  placeId,
  established,
  teamSize,
  certificates,
  domain,
}: ProfessionalSpecsProps) {
  const t = await getTranslations("professional_detail")

  const specs = [
    { label: t("location"), value: location || address ? <SpecAddress name={name} address={address} city={city} placeId={placeId} fallback={location} /> : null },
    { label: t("established"), value: established },
    { label: t("team_size"), value: teamSize ? t("people_count", { count: teamSize }) : null },
    { label: t("certificates"), value: certificates.length > 0 ? certificates.join(', ') : null },
    { label: t("website"), value: domain ? <SpecWebsite domain={domain} /> : null },
  ].filter(spec => spec.value) // Only show specs with values

  if (specs.length === 0) return null

  return (
    <section className="specifications-bar">
      {specs.map((spec) => (
        <div key={spec.label} className="spec-item">
          <span className="arco-eyebrow">{spec.label}</span>
          <div className="arco-card-title">{spec.value}</div>
        </div>
      ))}
    </section>
  )
}
