"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { DashboardHeader } from "@/components/dashboard-header"
import { Footer } from "@/components/footer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { useCompanyEntitlements } from "@/hooks/use-company-entitlements"

import { upgradeCompanyPlanAction } from "./actions"

export default function PricingPage() {
  const router = useRouter()
  const [isAnnually, setIsAnnually] = useState(false)
  const [upgradeError, setUpgradeError] = useState<string | null>(null)
  const [isUpgrading, startUpgradeTransition] = useTransition()
  const { planTier, isPlus, loading, upgradeEligible, planExpiresAt, refresh } = useCompanyEntitlements()

  const currentPlanLabel = isPlus ? "Plus" : "Basic"
  const canAttemptUpgrade = !isPlus && (upgradeEligible ?? true)
  const renewalLabel = planExpiresAt
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(planExpiresAt))
    : null

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
    <div className="flex min-h-screen flex-col bg-gray-50">
      <DashboardHeader />

      <main className="flex-1 py-8">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <h1 className="mb-6 text-2xl font-semibold text-gray-900">Pricing</h1>

          <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <p className="max-w-3xl text-sm text-gray-600 md:text-base">
              Choose the plan that fits your studio. Plus unlocks public project listings, premium placement in
              discovery, and unlimited portfolio publishing.
            </p>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Save up to 20% with yearly billing
              </span>
              <div className="flex h-11 w-fit shrink-0 items-center rounded-md border border-gray-200 bg-white p-1 text-lg">
                <RadioGroup
                  defaultValue="monthly"
                  className="h-full grid-cols-2"
                  onValueChange={(value) => {
                    setIsAnnually(value === "annually")
                  }}
                >
                  <div className='has-[button[data-state="checked"]]:bg-background h-full rounded-md transition-all'>
                    <RadioGroupItem
                      value="monthly"
                      id="monthly"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="monthly"
                      className="flex h-full cursor-pointer items-center justify-center px-7 text-sm font-semibold text-gray-500 transition-colors peer-data-[state=checked]:text-gray-900"
                    >
                      Monthly
                    </Label>
                  </div>
                  <div className='has-[button[data-state="checked"]]:bg-background h-full rounded-md transition-all'>
                    <RadioGroupItem
                      value="annually"
                      id="annually"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="annually"
                      className="flex h-full cursor-pointer items-center justify-center gap-1 px-7 text-sm font-semibold text-gray-500 transition-colors peer-data-[state=checked]:text-gray-900"
                    >
                      Yearly
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col items-stretch gap-6 md:flex-row">
            <div className="flex w-full flex-col rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm">
              <Badge variant="outline" className="mb-6 w-fit rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                Basic
              </Badge>
              <span className="text-4xl font-medium">$0</span>
              <p className="text-muted-foreground invisible">Per month</p>
              <Separator className="my-6" />
              <div className="flex flex-1 flex-col justify-between gap-6">
                <ul className="space-y-3 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-gray-400" />
                    <span>Up to 3 projects</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-gray-400" />
                    <span>Company page with project portfolio</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-gray-400" />
                    <span>Review collection</span>
                  </li>
                </ul>
                <Button variant="outline" className="w-full" disabled>
                  {isPlus ? "Included in Plus" : "Current plan"}
                </Button>
              </div>
            </div>
            <div className="flex w-full flex-col rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-lg">
              <Badge className="mb-6 w-fit rounded-full bg-red-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-700">
                Plus
              </Badge>
              {isAnnually ? (
                <>
                  <div className="flex items-center gap-3">
                    <span className="text-4xl font-semibold text-gray-900">€39</span>
                    <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                      20% off
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500">Per year</p>
                </>
              ) : (
                <>
                  <span className="text-4xl font-semibold text-gray-900">€39</span>
                  <p className="text-sm text-gray-500">Per month</p>
                </>
              )}
              <Separator className="my-6" />
              <div className="flex flex-1 flex-col justify-between gap-6">
                <ul className="space-y-3 text-sm text-gray-700">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-red-400" />
                    <span>Unlimited projects</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-red-400" />
                    <span>Company page with unlimited projects</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-red-400" />
                    <span>Review collection</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-red-400" />
                    <span>Priority placement in professional searches</span>
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
                  <p className="text-sm text-gray-500">
                    Upgrades are temporarily unavailable. Contact support if you need help activating Plus.
                  </p>
                )}
                {upgradeError && <p className="text-sm text-red-600">{upgradeError}</p>}
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Billing</h2>
                <p className="mt-2 text-sm font-medium text-gray-900">You are on the {currentPlanLabel} plan</p>
                <p className="mt-1 text-sm text-gray-500">
                  {isPlus
                    ? renewalLabel
                      ? `Plan renews on ${renewalLabel}.`
                      : "Your Plus benefits are active."
                    : "Upgrade to unlock public listings and search visibility."}
                </p>
              </div>
              <Button variant="outline" className="w-full sm:w-auto" disabled={!isPlus || loading}>
                Manage subscription
              </Button>
            </div>
          </div>
        </div>
      </main>

      <Footer maxWidth="max-w-7xl" />
    </div>
  )
}
