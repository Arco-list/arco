"use client"

import { useTranslations } from "next-intl"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { AccountSettingsForm } from "@/components/account-settings-form"

export default function DashboardSettings() {
  const t = useTranslations("dashboard")
  return (
    <div className="min-h-screen bg-white">
      <Header navLinks={[{ href: "/dashboard/listings", label: t("listings") }, { href: "/dashboard/company", label: t("company") }, { href: "/dashboard/team", label: t("team") }, { href: "/dashboard/pricing", label: t("plans") }]} />

      <div className="wrap" style={{ paddingTop: 120, marginBottom: 60 }}>
        <AccountSettingsForm />
      </div>

      <Footer />
    </div>
  )
}
