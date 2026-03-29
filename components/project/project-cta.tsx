import Link from "next/link"
import { getTranslations } from "next-intl/server"

export async function ProjectCTA() {
  const t = await getTranslations("project_detail")
  return (
    <section className="intro-cta-section">
      <div className="wrap">
        <h2>{t("cta_heading")}</h2>
        <Link href="/plan-project" className="btn-secondary">
          {t("cta_button")}
        </Link>
      </div>
    </section>
  )
}
