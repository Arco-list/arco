import { getTranslations } from "next-intl/server"

import { SpecAddress, SpecWebsite } from "@/components/professional/spec-website"

interface PhotographerSpecsProps {
  location: string | null
  /** Kantooradres; met straat wordt de Locatie-cel een kaartlink. */
  address: string | null
  city: string | null
  /** Naam en Google-vermelding, voor de kaartlink. */
  name: string
  placeId: string | null
  /** Year the studio was founded — surfaced as "Established" so the
   *  detail page matches the label the owner sees on their company
   *  edit specs bar (t("established") = "Opgericht"). */
  foundedYear: number | null
  /** Free-form specialty tags (Residential / Hospitality / Interior / etc.). */
  specialties: string[]
  /** Distinct architect/owner companies this photographer has worked with. */
  collaborationsCount: number
  /** Domein van de studio (zonder https://); laatste cel van de balk. */
  domain: string | null
}

/**
 * Photographer-variant of <ProfessionalSpecs>.
 *
 * Mirrors the 5-cell layout but swaps in fields that matter to the
 * audience this page serves (architects searching for a photographer).
 * Empty cells are filtered out, identical to ProfessionalSpecs.
 */
export async function PhotographerSpecs({
  location,
  address,
  city,
  name,
  placeId,
  foundedYear,
  specialties,
  collaborationsCount,
  domain,
}: PhotographerSpecsProps) {
  const t = await getTranslations("professional_detail")

  const specs = [
    { label: t("location"), value: location || address ? <SpecAddress name={name} address={address} city={city} placeId={placeId} fallback={location} /> : null },
    { label: t("established"), value: foundedYear },
    { label: t("specialties"), value: specialties.length > 0 ? specialties.join(" · ") : null },
    {
      label: t("architect_collaborations"),
      value: collaborationsCount > 0 ? collaborationsCount : null,
    },
    { label: t("website"), value: domain ? <SpecWebsite domain={domain} /> : null },
  ].filter((spec) => spec.value !== null && spec.value !== undefined && spec.value !== "")

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
