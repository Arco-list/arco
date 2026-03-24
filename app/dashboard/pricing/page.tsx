"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useCompanyEntitlements } from "@/hooks/use-company-entitlements"

import { upgradeCompanyPlanAction } from "./actions"

export default function PricingPage() {
  const router = useRouter()
  const [upgradeError, setUpgradeError] = useState<string | null>(null)
  const [isUpgrading, startUpgradeTransition] = useTransition()
  const { isPlus, upgradeEligible, refresh } = useCompanyEntitlements()

  const canAttemptUpgrade = !isPlus && (upgradeEligible ?? true)

  const handleUpgrade = () => {
    if (!canAttemptUpgrade || isUpgrading) {
      return
    }

    startUpgradeTransition(async () => {
      setUpgradeError(null)

      const result = await upgradeCompanyPlanAction()

      if (!result.success) {
        const message = result.error ?? "We couldn't complete the upgrade. Please try again."
        setUpgradeError(message)
        toast.error("Upgrade unsuccessful", {
          description: message,
        })
        return
      }

      toast.success("You're on the Plus plan!", {
        description: "Your listings can now be set to Listed and appear on Discover.",
      })

      await refresh()
      router.refresh()
    })
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header navLinks={[{ href: "/dashboard/listings", label: "Listings" }, { href: "/dashboard/company", label: "Company" }]} />

      <main className="flex-1 pt-20 pb-8">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <h3 className="heading-4 mb-6 text-foreground">Plans</h3>


          <div className="flex w-full flex-col items-stretch gap-6 md:flex-row">
            <div className="flex w-full flex-col rounded-2xl border border-border bg-white p-6 text-left shadow-sm">
              <h3 className="heading-3 mb-2 text-foreground">Basic</h3>
              <p className="body-small text-text-secondary mb-4">Free forever, no credit card required</p>
              <span className="text-4xl font-medium">€0</span>
              <p className="body-small text-text-secondary">Per month</p>
              <Separator className="my-6" />
              <div className="flex flex-1 flex-col justify-between gap-6">
                <ul className="body-small space-y-3 text-text-secondary">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-muted-foreground" />
                    <span>Up to 3 projects</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-muted-foreground" />
                    <span>Custom company page with project portfolio</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-muted-foreground" />
                    <span>Collect user reviews</span>
                  </li>
                </ul>
                <Button variant="tertiary" size="tertiary" className="w-full" disabled={isPlus}>
                  {isPlus ? "Downgrade to Basic" : "Current plan"}
                </Button>
              </div>
            </div>
            <div className="flex w-full flex-col rounded-2xl border border-border bg-white p-6 text-left shadow-lg">
              <h3 className="heading-3 mb-2 text-foreground">Plus</h3>
              <p className="body-small text-red-600 font-medium mb-4">Free during beta</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold text-foreground line-through">€39</span>
                <span className="text-4xl font-semibold text-foreground">€0</span>
              </div>
              <p className="body-small text-text-secondary">Per month</p>
              <Separator className="my-6" />
              <div className="flex flex-1 flex-col justify-between gap-6">
                <ul className="body-small space-y-3 text-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-red-400" />
                    <span>Unlimited projects</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-red-400" />
                    <span>Custom company page with unlimited projects</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-red-400" />
                    <span>Collect user reviews</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-red-400" />
                    <span>Be displayed in professional searches</span>
                  </li>
                </ul>
                <Button
                  className="w-full bg-red-500 text-white hover:bg-red-600"
                  onClick={handleUpgrade}
                  disabled={!canAttemptUpgrade || isUpgrading}
                >
                  {isPlus ? (
                    "Current plan"
                  ) : isUpgrading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Upgrading…
                    </span>
                  ) : (
                    "Upgrade to Plus"
                  )}
                </Button>
                {!canAttemptUpgrade && !isPlus && (
                  <p className="body-small text-text-secondary">
                    Upgrades are temporarily unavailable. Contact support if you need help activating Plus.
                  </p>
                )}
                {upgradeError && <p className="body-small text-red-600">{upgradeError}</p>}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer maxWidth="max-w-7xl" />
    </div>
  )
}
