"use client"

import { DashboardHeader } from "@/components/dashboard-header"
import { Footer } from "@/components/footer"
import { AccountSettingsForm } from "@/components/account-settings-form"

export default function DashboardSettings() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <DashboardHeader />

      <main className="flex-1 pt-20 pb-8">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <h1 className="mb-8 text-2xl font-semibold text-foreground">Settings</h1>

          <AccountSettingsForm />
        </div>
      </main>

      <Footer maxWidth="max-w-7xl" />
    </div>
  )
}
