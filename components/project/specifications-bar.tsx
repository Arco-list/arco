import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { translateScope, type ProjectScope } from "@/lib/project-translations"

export interface PhotographerCredit {
  name: string
  /** Company slug — required when isLive=true to render the link. */
  slug: string | null
  /** True when the photographer's company page is publicly viewable. */
  isLive: boolean
}

interface SpecificationsBarProps {
  location: string | null
  year: number | null
  type: string | null
  /** Canonical scope slug — translated to the current locale on render. */
  scope: ProjectScope | null
  style: string | null
  photographer?: PhotographerCredit | null
}

export async function SpecificationsBar({ location, year, type, scope, style, photographer }: SpecificationsBarProps) {
  const t = await getTranslations("project_detail")
  const locale = await getLocale()

  const photographerNode = photographer
    ? (photographer.isLive && photographer.slug
      ? (
        <Link href={`/photographers/${photographer.slug}`} className="spec-link">
          {photographer.name}
          <span aria-hidden="true" style={{ marginLeft: 4 }}>→</span>
        </Link>
      )
      : photographer.name)
    : null

  const specs = [
    { label: t("location"), value: location },
    { label: t("year"), value: year },
    { label: t("type"), value: type },
    { label: t("scope"), value: translateScope(scope, locale) },
    { label: t("style"), value: style },
    { label: t("photographer"), value: photographerNode },
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
