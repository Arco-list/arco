"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"

export default function NotFoundError() {
  const t = useTranslations("errors")
  const tc = useTranslations("common")
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: "80px 24px" }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <p className="arco-eyebrow" style={{ marginBottom: 16 }}>404</p>
        <h1 className="arco-page-title" style={{ marginBottom: 12 }}>{t("not_found_title")}</h1>
        <p className="arco-body" style={{ marginBottom: 40 }}>
          {t("not_found_description")}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <Link href="/" className="btn btn-primary">{tc("go_home")}</Link>
          <Link href="/projects" className="btn btn-secondary">{t("browse_projects")}</Link>
        </div>
      </div>
    </div>
  )
}
