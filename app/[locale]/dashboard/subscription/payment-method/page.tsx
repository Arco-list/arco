import { redirect } from "next/navigation"

import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { getBillingDetails } from "@/lib/subscriptions/get-billing-details"

import { PaymentMethodClient } from "./payment-method-client"

/**
 * Change the payment method on a running subscription, in Arco rather
 * than in Stripe's portal.
 *
 * Alongside the checkout study and admin-only for the same reason:
 * until the Elements checkout replaces the hosted one, shipping half a
 * migrated billing UI to real customers would leave them crossing
 * between two worlds for two halves of the same job.
 */
export default async function PaymentMethodPage({
  searchParams,
}: {
  searchParams: Promise<{ return?: string; setup_intent?: string }>
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) redirect("/login?redirectTo=/dashboard/subscription")


  const { return: returnTo, setup_intent: setupIntent } = await searchParams

  // What is on the subscription today, so the page can name what is
  // about to be replaced instead of asking blind.
  const service = createServiceRoleSupabaseClient()
  const { data: company } = await service
    .from("companies")
    .select("id")
    .eq("owner_id", session.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  const { data: row } = company
    ? await service
        .from("subscriptions" as never)
        .select("stripe_customer_id")
        .eq("company_id", company.id)
        .maybeSingle()
    : { data: null }

  const customerId = (row as { stripe_customer_id?: string } | null)?.stripe_customer_id ?? null
  const details = customerId ? await getBillingDetails(customerId, "nl") : null
  const pm = details?.paymentMethod ?? null
  const currentLabel = pm ? `${pm.label}${pm.last4 ? ` ···· ${pm.last4}` : ""}` : null

  return (
    <PaymentMethodClient
      returnTo={returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/dashboard/subscription"}
      currentLabel={currentLabel}
      defaultEmail={session.user.email ?? ""}
      resumeSetupIntent={setupIntent ?? null}
    />
  )
}
