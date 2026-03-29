"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"

export default function UnauthorizedError() {
  const t = useTranslations("errors")
  const ta = useTranslations("auth")
  const tc = useTranslations("common")
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: "80px 24px" }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <p className="arco-eyebrow" style={{ marginBottom: 16 }}>401</p>
        <h1 className="arco-page-title" style={{ marginBottom: 12 }}>{t("unauthorized_title")}</h1>
        <p className="arco-body" style={{ marginBottom: 40 }}>
          {t("unauthorized_description")}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <Link href="/login" className="btn btn-primary">{ta("sign_in")}</Link>
          <Link href="/" className="btn btn-secondary">{tc("go_home")}</Link>
        </div>
      </div>
    </div>
  )
}
