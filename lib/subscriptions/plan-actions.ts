"use server"

import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { getCompanyBilling } from "@/lib/subscriptions/get-company-subscription"

/**
 * Whether a company is on Pro, for surfaces that need to explain a
 * limit rather than enforce one.
 *
 * A server action because the browser client cannot read
 * `subscriptions`, and because the caller should not be able to ask
 * about a company it has nothing to do with: membership is checked
 * before the answer is given.
 */
export async function getCompanyIsProAction(companyId: string): Promise<{ isPro: boolean }> {
  const supabase = await createServerActionSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { isPro: false }

  const service = createServiceRoleSupabaseClient()

  const { data: owned } = await service
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("owner_id", user.id)
    .maybeSingle()

  if (!owned) {
    const { data: member } = await service
      .from("company_contacts")
      .select("company_id, person:persons!inner(auth_user_id)")
      .eq("company_id", companyId)
      .eq("person.auth_user_id", user.id)
      .limit(1)
      .maybeSingle()

    if (!member) return { isPro: false }
  }

  const billing = await getCompanyBilling(companyId)
  return { isPro: billing.plan === "pro" }
}
