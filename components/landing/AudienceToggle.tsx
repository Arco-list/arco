"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"

interface AudienceToggleProps {
  active: "architects" | "professionals"
}

export function AudienceToggle({ active }: AudienceToggleProps) {
  const t = useTranslations("business")

  return (
    <div className="audience-toggle">
      <Link
        href="/businesses/architects"
        className={`toggle-seg${active === "architects" ? " active" : ""}`}
      >
        {t("for_architects")}
      </Link>
      <Link
        href="/businesses/professionals"
        className={`toggle-seg${active === "professionals" ? " active" : ""}`}
      >
        {t("for_professionals")}
      </Link>
    </div>
  )
}
