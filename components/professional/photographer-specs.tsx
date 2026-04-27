import { getTranslations } from "next-intl/server"

interface PhotographerSpecsProps {
  location: string | null
  /** Year the studio was founded — surfaced as "Active since". */
  foundedYear: number | null
  /** Free-form specialty tags (Residential / Hospitality / Interior / etc.). */
  specialties: string[]
  /** Languages spoken — pulled from the linked professional record when claimed. */
  languages: string[]
  /** Distinct architect/owner companies this photographer has worked with. */
  collaborationsCount: number
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
  foundedYear,
  specialties,
  languages,
  collaborationsCount,
}: PhotographerSpecsProps) {
  const t = await getTranslations("professional_detail")

  const specs = [
    { label: t("location"), value: location },
    { label: t("active_since"), value: foundedYear },
    { label: t("specialties"), value: specialties.length > 0 ? specialties.join(" · ") : null },
    { label: t("languages"), value: languages.length > 0 ? languages.join(", ") : null },
    {
      label: t("architect_collaborations"),
      value: collaborationsCount > 0 ? collaborationsCount : null,
    },
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
