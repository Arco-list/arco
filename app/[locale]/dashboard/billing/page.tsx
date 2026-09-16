import { redirect } from "next/navigation"

import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { getActiveCompanyId } from "@/lib/active-company"
import { getCompanyBilling } from "@/lib/subscriptions/get-company-subscription"
import { getProjectUsage } from "@/lib/subscriptions/get-project-usage"
import { getBillingDetails } from "@/lib/subscriptions/get-billing-details"
import { EMPTY_BILLING_DETAILS } from "@/lib/subscriptions/billing-details-types"
import { isPreviewState, previewBilling, previewBillingDetails } from "@/lib/subscriptions/preview-states"
import { isAdminUser } from "@/lib/auth-utils"
import { BillingClient } from "./billing-client"

// Same team roles the team page uses — a company's own people may see
// what the company pays; the sales 'contact' bucket may not.
const TEAM_ROLES: ("owner" | "admin" | "member")[] = ["owner", "admin", "member"]

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ company_id?: string; preview?: string }>
  params?: Promise<{ locale: string }>
}) {
  const { company_id: companyIdParam, preview } = await searchParams
  const supabase = await createServerSupabaseClient()

  // A missing session is not an exception — it is a logged-out visitor.
  // Throwing here (as the team page does) turns the sign-in redirect
  // into a 500 for anyone arriving without a cookie.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?redirectTo=/dashboard/billing")

  const serviceClient = createServiceRoleSupabaseClient()

  // Company resolution mirrors the team page: URL param → owned → cookie
  // → first membership. Kept identical so the company switcher behaves
  // the same everywhere in the dashboard.
  let company: { id: string; name: string; owner_id: string | null } | null = null

  if (companyIdParam) {
    const { data } = await serviceClient
      .from("companies")
      .select("id, name, owner_id")
      .eq("id", companyIdParam)
      .maybeSingle()
    if (data) company = data
  }

  if (!company) {
    const { data } = await supabase
      .from("companies")
      .select("id, name, owner_id")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
    if (data) company = data
  }

  if (!company) {
    const activeId = await getActiveCompanyId()
    if (activeId) {
      const { data: contact } = await serviceClient
        .from("company_contacts")
        .select("company_id, person:persons!inner(auth_user_id), company:companies(id, name, owner_id)")
        .eq("company_id", activeId)
        .in("role", TEAM_ROLES)
        .eq("person.auth_user_id", user.id)
        .maybeSingle()
      const matched = contact?.company as unknown as { id: string; name: string; owner_id: string | null } | null
      if (matched) company = matched
    }
  }

  if (!company) {
    const { data: contact } = await serviceClient
      .from("company_contacts")
      .select("created_at, person:persons!inner(auth_user_id), company:companies(id, name, owner_id)")
      .eq("person.auth_user_id", user.id)
      .in("role", TEAM_ROLES)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
    const matched = contact?.company as unknown as { id: string; name: string; owner_id: string | null } | null
    if (matched) company = matched
  }

  if (!company) redirect("/create-company")

  // Admin preview: render a synthetic state through the real code path,
  // so states that are slow (a year-old subscription), rare (a failed
  // collection) or deliberately unreachable (a trial, ruled out in D2)
  // can still be reviewed. Display only — nothing is written, and a
  // non-admin asking for one simply gets their own real state.
  let billing = await getCompanyBilling(company.id)
  let previewState: string | null = null

  if (preview) {
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("user_types, admin_role")
      .eq("id", user.id)
      .maybeSingle()
    const admin = isAdminUser(
      (profile as { user_types?: string[] | null } | null)?.user_types,
      (profile as { admin_role?: string | null } | null)?.admin_role,
    )
    if (admin && isPreviewState(preview)) {
      billing = previewBilling(preview)
      previewState = preview
    }
  }

  // Usage is read against the plan the page is about to render — in a
  // preview that is the synthetic plan, so the bars match the state
  // being reviewed rather than the admin's own company.
  const usage = await getProjectUsage(company.id, billing.plan === "pro")

  // Invoices and payment method come straight from Stripe — not
  // mirrored locally, because nothing in the product depends on them.
  const details = previewState
    ? previewBillingDetails(previewState as never)
    : billing.stripeCustomerId
      ? await getBillingDetails(billing.stripeCustomerId, "nl")
      : EMPTY_BILLING_DETAILS

  return (
    <BillingClient
      companyName={company.name}
      usage={usage}
      details={details}
      isOwner={company.owner_id === user.id || Boolean(previewState)}
      billing={billing}
      previewState={previewState}
    />
  )
}
