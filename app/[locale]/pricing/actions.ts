"use server"

import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"

/** Resolve the calling user's company id — owner first, then team
 *  membership via the legacy professionals table. */
async function resolveCompanyId(): Promise<string | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const service = createServiceRoleSupabaseClient()
  const { data: owned } = await service
    .from("companies")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle()
  if (owned?.id) return owned.id

  const { data: membership } = await service
    .from("professionals")
    .select("company_id")
    .eq("user_id", user.id)
    .not("company_id", "is", null)
    .limit(1)
    .maybeSingle()
  return membership?.company_id ?? null
}

/** Whether the current user's company has claimed founding access. */
export async function getFoundingClaimStatus(): Promise<{ claimed: boolean }> {
  const companyId = await resolveCompanyId()
  if (!companyId) return { claimed: false }
  const service = createServiceRoleSupabaseClient()
  const { data } = await service
    .from("companies")
    .select("founding_claimed_at")
    .eq("id", companyId)
    .maybeSingle()
  return { claimed: Boolean((data as any)?.founding_claimed_at) }
}

/** Stamp the founding claim (idempotent — first click wins). The
 *  durable counterpart of the PostHog upgrade_intent event, and the
 *  counter behind the "first 100 companies" promise. */
export async function claimFoundingAccess(): Promise<{ claimed: boolean }> {
  const companyId = await resolveCompanyId()
  if (!companyId) return { claimed: false }
  const service = createServiceRoleSupabaseClient()
  await service
    .from("companies")
    .update({ founding_claimed_at: new Date().toISOString() } as any)
    .eq("id", companyId)
    .is("founding_claimed_at", null)
  return { claimed: true }
}
