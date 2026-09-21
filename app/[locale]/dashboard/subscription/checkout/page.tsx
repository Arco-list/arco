import { redirect } from "next/navigation"

import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { getBillingDetails } from "@/lib/subscriptions/get-billing-details"

import { CheckoutClient } from "./checkout-client"
import { freeUntilLabel } from "./constants"

/**
 * Pay for Pro without leaving Arco.
 *
 * Stripe Elements, not Stripe's own hosted or embedded page: the bank
 * choice, the IBAN field and the card fields are theirs (iframes, so
 * no card number ever touches Arco), everything around them is ours.
 * A mandate is taken first and the subscription created against it —
 * iDEAL cannot be attached to a subscription any other way, and the
 * order has the side benefit that a bounced payment leaves no orphaned
 * subscription behind.
 *
 * Its own chrome — wordmark, language, a way out — and no site nav:
 * this is a step, not a place you browsed to.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ interval?: string; return?: string; setup_intent?: string }>
}) {
  // Every action behind this page checks ownership for itself, but a
  // signed-out visitor should meet the login screen rather than a
  // payment form that can only fail.
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) redirect("/login?redirectTo=/dashboard/subscription")

  const { interval, return: returnTo, setup_intent: setupIntent } = await searchParams

  // The mandate confirmation and the invoices both go here, so the
  // field starts on the address they signed in with. companies.email is
  // the wrong source: it is the outreach address for companies not yet
  // on Arco, and 20 of the 34 companies that have an owner have none.
  const defaultEmail = session.user.email ?? ""

  // A mandate from a subscription that has since ended. The customer
  // outlives the subscription, so a company that paid before is still
  // authorised — and asking again would be asking for nothing.
  const service = createServiceRoleSupabaseClient()
  const { data: company } = await service
    .from("companies")
    .select("id, address, postal_code, city, country")
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
  const savedMethod = pm ? `${pm.label}${pm.last4 ? ` ···· ${pm.last4}` : ""}` : null

  // Computed on the server so the client never renders a different date
  // than the one that was sent, and so the page can name a day — which
  // is what a promise about next spring has to do to mean anything.
  const freeUntil = freeUntilLabel()

  // The address the company already gave us, so the invoice carries the
  // one they see on their own page rather than a second one they have to
  // type. Absent for a company that has not filled it in — then the
  // lookup opens empty, which is the honest state.
  const c = company as {
    address?: string | null
    postal_code?: string | null
    city?: string | null
    country?: string | null
  } | null
  const companyAddress = c?.address && c?.city
    ? {
        streetAddress: c.address,
        postalCode: c.postal_code ?? null,
        city: c.city,
        // companies.country holds a display name ("Netherlands"), and
        // Stripe wants an ISO code. Passing the name straight through
        // put "Netherlands" in the country field of a live invoice.
        country: /^[A-Z]{2}$/.test(c.country ?? "") ? c.country! : "NL",
      }
    : null

  return (
    <CheckoutClient
      // The cycle is read here rather than in the client, so the price
      // is settled before anything renders: arriving from the monthly
      // card and landing on a yearly total is the kind of small
      // betrayal a checkout cannot afford, even in a drawing.
      interval={interval === "month" ? "month" : "year"}
      returnTo={returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/dashboard/subscription"}
      freeUntil={freeUntil}
      // Stripe appends this when the browser comes back from a bank.
      resumeSetupIntent={setupIntent ?? null}
      defaultEmail={defaultEmail}
      savedMethod={savedMethod}
      companyAddress={companyAddress}
    />
  )
}
