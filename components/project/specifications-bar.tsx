import { getTranslations } from "next-intl/server"

interface SpecificationsBarProps {
  location: string | null
  year: number | null
  type: string | null
  scope: string | null
  style: string | null
}

export async function SpecificationsBar({ location, year, type, scope, style }: SpecificationsBarProps) {
  const t = await getTranslations("project_detail")
  const specs = [
    { label: t("location"), value: location },
    { label: t("year"), value: year },
    { label: t("type"), value: type },
    { label: t("scope"), value: scope },
    { label: t("style"), value: style },
  ].filter(spec => spec.value)

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
