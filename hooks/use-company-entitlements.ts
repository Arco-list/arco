"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { useAuth } from "@/contexts/auth-context"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import { getActiveCompanyIdClient } from "@/lib/active-company-client"
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
  canPublishProjects: boolean
}

export function useCompanyEntitlements(): EntitlementState {
  const supabase = useMemo(() => getBrowserSupabaseClient(), [])
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [planTier, setPlanTier] = useState<PlanTier | null>(null)
  const [planExpiresAt, setPlanExpiresAt] = useState<string | null>(null)
  const [upgradeEligible, setUpgradeEligible] = useState<boolean | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [canPublish, setCanPublish] = useState(false)
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

    const checkPublishEligibility = async (cId: string) => {
      // Get company's services
      const { data: company } = await supabase
        .from("companies")
        .select("services_offered, primary_service_id")
        .eq("id", cId)
        .maybeSingle()

      const serviceIds = [
        ...(company?.services_offered ?? []),
        ...(company?.primary_service_id ? [company.primary_service_id] : []),
      ].filter(Boolean)

      if (serviceIds.length === 0) {
        setCanPublish(false)
        return
      }

      // Check if any of these services have can_publish_projects enabled
      const { data: eligible } = await supabase
        .from("categories")
        .select("id")
        .in("id", serviceIds)
        .eq("can_publish_projects", true)
        .limit(1)

      setCanPublish((eligible?.length ?? 0) > 0)
    }

    const applyResult = async (d: { id: string; plan_tier: PlanTier; plan_expires_at: string | null; upgrade_eligible: boolean | null }) => {
      setPlanTier(d.plan_tier)
      setPlanExpiresAt(d.plan_expires_at)
      setUpgradeEligible(d.upgrade_eligible)
      setCompanyId(d.id)
      await checkPublishEligibility(d.id)
      setLoading(false)
    }

    const clearResult = (errMsg?: string) => {
      setPlanTier(null)
      setPlanExpiresAt(null)
      setUpgradeEligible(null)
      setCompanyId(null)
      setCanPublish(false)
      setError(errMsg ?? null)
      setLoading(false)
    }

    // 1. Always prefer owned company (oldest first)
    const { data: ownedData, error: companyError } = await supabase
      .from("companies")
      .select("id, plan_tier, plan_expires_at, upgrade_eligible")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (companyError) {
      clearResult(companyError.message)
      return
    }

    if (ownedData) {
      await applyResult(ownedData)
      return
    }

    // 2. No owned company — check cookie for active company (membership)
    const activeId = getActiveCompanyIdClient()
    if (activeId) {
      const { data: activeCompany } = await supabase
        .from("companies")
        .select("id, plan_tier, plan_expires_at, upgrade_eligible")
        .eq("id", activeId)
        .maybeSingle()

      if (activeCompany) {
        await applyResult(activeCompany)
        return
      }
    }

    // 3. Fallback: team membership (oldest first)
    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id, companies(id, plan_tier, plan_expires_at, upgrade_eligible)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    const memberCompany = membership?.companies as unknown as {
      id: string
      plan_tier: PlanTier
      plan_expires_at: string | null
      upgrade_eligible: boolean | null
    } | null

    if (memberCompany) {
      await applyResult(memberCompany)
      return
    }

    clearResult()
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
    canPublishProjects: canPublish,
  }
}
