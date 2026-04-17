import { getLocale, getTranslations } from "next-intl/server"
import { translateScope, type ProjectScope } from "@/lib/project-translations"

interface SpecificationsBarProps {
  location: string | null
  year: number | null
  type: string | null
  /** Canonical scope slug — translated to the current locale on render. */
  scope: ProjectScope | null
  style: string | null
}

export async function SpecificationsBar({ location, year, type, scope, style }: SpecificationsBarProps) {
  const t = await getTranslations("project_detail")
  const locale = await getLocale()
  const specs = [
    { label: t("location"), value: location },
    { label: t("year"), value: year },
    { label: t("type"), value: type },
    { label: t("scope"), value: translateScope(scope, locale) },
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
