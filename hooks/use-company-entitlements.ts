"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { useAuth } from "@/contexts/auth-context"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import { getActiveCompanyIdClient } from "@/lib/active-company-client"

// Plan tiers are retired. This hook now only surfaces the
// service-category-based publishability gate (`canPublishProjects`) — i.e.
// whether the current user's company offers a service whose category is
// flagged as `can_publish_projects=true`. Photographers, for example, are
// not publishers under this rule.

type EntitlementState = {
  loading: boolean
  companyId: string | null
  error: string | null
  refresh: () => Promise<void>
  canPublishProjects: boolean
}

export function useCompanyEntitlements(): EntitlementState {
  const supabase = useMemo(() => getBrowserSupabaseClient(), [])
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [canPublish, setCanPublish] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchEntitlements = useCallback(async () => {
    if (!user?.id) {
      setCompanyId(null)
      setCanPublish(false)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const checkPublishEligibility = async (cId: string) => {
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

      const { data: eligible } = await supabase
        .from("categories")
        .select("id")
        .in("id", serviceIds)
        .eq("can_publish_projects", true)
        .limit(1)

      setCanPublish((eligible?.length ?? 0) > 0)
    }

    const applyResult = async (d: { id: string }) => {
      setCompanyId(d.id)
      await checkPublishEligibility(d.id)
      setLoading(false)
    }

    const clearResult = (errMsg?: string) => {
      setCompanyId(null)
      setCanPublish(false)
      setError(errMsg ?? null)
      setLoading(false)
    }

    // 1. Always prefer owned company (oldest first)
    const { data: ownedData, error: companyError } = await supabase
      .from("companies")
      .select("id")
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
        .select("id")
        .eq("id", activeId)
        .maybeSingle()

      if (activeCompany) {
        await applyResult(activeCompany)
        return
      }
    }

    // 3. Fallback: team membership (oldest first). Joined to persons so we
    // can match on the auth user; team roles only (no sales contacts).
    const { data: membership } = await supabase
      .from("company_contacts")
      .select("company_id, person:persons!inner(auth_user_id), companies(id)")
      .eq("person.auth_user_id", user.id)
      .in("role", ["owner", "admin", "member"])
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    const memberCompany = membership?.companies as unknown as { id: string } | null

    if (memberCompany) {
      await applyResult(memberCompany)
      return
    }

    clearResult()
  }, [supabase, user?.id])

  useEffect(() => {
    void fetchEntitlements()
  }, [fetchEntitlements])

  return {
    loading,
    companyId,
    error,
    refresh: fetchEntitlements,
    canPublishProjects: canPublish,
  }
}
