"use server"

import { revalidatePath } from "next/cache"

import { createServerActionSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"

type UpgradeResult = {
  success: boolean
  error?: string
  company?: {
    id: string
    plan_tier: "basic" | "plus"
    plan_expires_at: string | null
    upgrade_eligible: boolean
  }
}

/**
 * Temporary server action that simulates a successful billing upgrade by directly
 * updating the company row in Supabase. Replace this with Stripe checkout + webhook
 * hand-off once billing is wired end-to-end.
 */
export async function upgradeCompanyPlanAction(): Promise<UpgradeResult> {
  const supabase = await createServerActionSupabaseClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    logger.auth("pricing-upgrade", "Failed to load user for upgrade", undefined, userError)
    return { success: false, error: "We couldn't verify your session. Please sign in and try again." }
  }

  if (!user) {
    return { success: false, error: "You need to be signed in to upgrade." }
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, plan_tier, plan_expires_at, upgrade_eligible")
    .eq("owner_id", user.id)
    .maybeSingle()

  if (companyError) {
    logger.db("select", "companies", "Failed to load company for upgrade", { userId: user.id }, companyError)
    return { success: false, error: "We couldn't load your company details. Please try again." }
  }

  if (!company) {
    return { success: false, error: "Create a company profile before upgrading." }
  }

  if (company.plan_tier === "plus") {
    return { success: true, company }
  }

  const now = new Date()
  const provisionalExpiry = new Date(now)
  provisionalExpiry.setMonth(provisionalExpiry.getMonth() + 1)

  const { data: updatedCompany, error: updateError } = await supabase
    .from("companies")
    .update({
      plan_tier: "plus",
      plan_expires_at: provisionalExpiry.toISOString(),
      upgrade_eligible: false,
      // TODO: Replace direct mutation with Stripe webhook confirmation payload.
    })
    .eq("id", company.id)
    .select("id, plan_tier, plan_expires_at, upgrade_eligible")
    .single()

  if (updateError) {
    logger.db("update", "companies", "Failed to upgrade company plan", { companyId: company.id }, updateError)
    return { success: false, error: "We couldn't complete the upgrade. Please try again in a moment." }
  }

  revalidatePath("/dashboard/pricing")
  revalidatePath("/dashboard/company")
  revalidatePath("/dashboard/listings")
  revalidatePath("/projects")

  return { success: true, company: updatedCompany }
}

