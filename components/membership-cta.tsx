"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"

export function MembershipCTA() {
  const t = useTranslations("home")
  const tn = useTranslations("nav")

  return (
    <section className="py-20 px-4 md:px-8 bg-white">
      <div className="max-w-[1100px] mx-auto">

        <h2 className="arco-page-title mb-4 text-center">
          {t("built_for_industry")}
        </h2>
        <p className="arco-body-text mb-12 max-w-[520px] mx-auto text-center">
          {t("built_for_industry_subtitle")}
        </p>

        <div className="membership-cta-grid">

          <div className="membership-cta-card">
            <p className="arco-eyebrow" style={{ marginBottom: 12 }}>{tn("for_architects")}</p>
            <h3 className="arco-section-title" style={{ marginBottom: 12 }}>
              {t("for_architects_title")}
            </h3>
            <p className="arco-body-text" style={{ marginBottom: 24 }}>
              {t("for_architects_body")}
            </p>
            <Link href="/businesses/architects" className="btn-primary" style={{ display: "inline-block" }}>
              {t("learn_more")}
            </Link>
          </div>

          <div className="membership-cta-card">
            <p className="arco-eyebrow" style={{ marginBottom: 12 }}>{tn("for_professionals")}</p>
            <h3 className="arco-section-title" style={{ marginBottom: 12 }}>
              {t("for_professionals_title")}
            </h3>
            <p className="arco-body-text" style={{ marginBottom: 24 }}>
              {t("for_professionals_body")}
            </p>
            <Link href="/businesses/professionals" className="btn-primary" style={{ display: "inline-block" }}>
              {t("learn_more")}
            </Link>
          </div>

        </div>

      </div>
    </section>
  )
}
