"use client"

import { useTranslations } from "next-intl"

export function FeaturesSection() {
  const t = useTranslations("home")

  const features = [
    { number: "01", title: t("feature_1_title"), description: t("feature_1_body") },
    { number: "02", title: t("feature_2_title"), description: t("feature_2_body") },
    { number: "03", title: t("feature_3_title"), description: t("feature_3_body") },
  ]

  return (
    <div className="how-section">
      <div className="wrap">
        <div className="section-header">
          <h2 className="arco-section-title">{t("how_arco_works")}</h2>
        </div>
        <div className="how-grid">
          {features.map((feature) => (
            <div key={feature.number} className="how-card">
              <div className="how-number">{feature.number}</div>
              <h3 className="how-title">{feature.title}</h3>
              <p className="how-body">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
