"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { useAuth } from "@/contexts/auth-context"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import type { Database } from "@/lib/supabase/types"

type PlanTier = Database["public"]["Enums"]["company_plan_tier"]

type EntitlementState = {
  loading: boolean
  planTier: PlanTier | null
  planExpiresAt: string | null
  upgradeEligible: boolean | null
  companyId: string | null
  error: string | null
  refresh: () => Promise<void>
  isPlus: boolean
  canListProjects: boolean
  canSetListedStatus: boolean
}

export function useCompanyEntitlements(): EntitlementState {
  const supabase = useMemo(() => getBrowserSupabaseClient(), [])
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [planTier, setPlanTier] = useState<PlanTier | null>(null)
  const [planExpiresAt, setPlanExpiresAt] = useState<string | null>(null)
  const [upgradeEligible, setUpgradeEligible] = useState<boolean | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchEntitlements = useCallback(async () => {
    if (!user?.id) {
      setPlanTier(null)
      setPlanExpiresAt(null)
      setUpgradeEligible(null)
      setCompanyId(null)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: companyError } = await supabase
      .from("companies")
      .select("id, plan_tier, plan_expires_at, upgrade_eligible")
      .eq("owner_id", user.id)
      .maybeSingle()

    if (companyError) {
      setPlanTier(null)
      setPlanExpiresAt(null)
      setUpgradeEligible(null)
      setCompanyId(null)
      setError(companyError.message)
      setLoading(false)
      return
    }

    if (!data) {
      setPlanTier(null)
      setPlanExpiresAt(null)
      setUpgradeEligible(null)
      setCompanyId(null)
      setLoading(false)
      return
    }

    setPlanTier(data.plan_tier)
    setPlanExpiresAt(data.plan_expires_at)
    setUpgradeEligible(data.upgrade_eligible)
    setCompanyId(data.id)
    setLoading(false)
  }, [supabase, user?.id])

  useEffect(() => {
    void fetchEntitlements()
  }, [fetchEntitlements])

  const isPlus = planTier === "plus"

  return {
    loading,
    planTier,
    planExpiresAt,
    upgradeEligible,
    companyId,
    error,
    refresh: fetchEntitlements,
    isPlus,
    canListProjects: isPlus,
    canSetListedStatus: isPlus,
  }
}
