"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { AccountSettingsForm } from "@/components/account-settings-form"

export default function DashboardSettings() {
  return (
    <div className="min-h-screen bg-white">
      <Header navLinks={[{ href: "/dashboard/listings", label: "Listings" }, { href: "/dashboard/company", label: "Company" }, { href: "/dashboard/team", label: "Team" }, { href: "/dashboard/pricing", label: "Plans" }]} />

      <div className="wrap" style={{ paddingTop: 120, marginBottom: 60 }}>
        <AccountSettingsForm />
      </div>

      <Footer />
    </div>
  )
}
