"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"

export default function ForbiddenError() {
  const t = useTranslations("errors")
  const tc = useTranslations("common")
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: "80px 24px" }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <p className="arco-eyebrow" style={{ marginBottom: 16 }}>403</p>
        <h1 className="arco-page-title" style={{ marginBottom: 12 }}>{t("forbidden_title")}</h1>
        <p className="arco-body" style={{ marginBottom: 40 }}>
          {t("forbidden_description")}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <Link href="/dashboard" className="btn btn-primary">{tc("go_to_dashboard")}</Link>
          <Link href="/" className="btn btn-secondary">{tc("go_home")}</Link>
        </div>
      </div>
    </div>
  )
}
