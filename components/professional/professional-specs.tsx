import { getTranslations } from "next-intl/server"

interface ProfessionalSpecsProps {
  location: string | null
  established: number | null
  teamSize: number | null
  languages: string[]
  certificates: string[]
}

export async function ProfessionalSpecs({
  location,
  established,
  teamSize,
  languages,
  certificates,
}: ProfessionalSpecsProps) {
  const t = await getTranslations("professional_detail")

  const specs = [
    { label: t("location"), value: location },
    { label: t("established"), value: established },
    { label: t("team_size"), value: teamSize ? t("people_count", { count: teamSize }) : null },
    { label: t("languages"), value: languages.length > 0 ? languages.join(', ') : null },
    { label: t("certificates"), value: certificates.length > 0 ? certificates.join(', ') : null },
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
