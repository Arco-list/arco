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
        .select("stripe_customer_id, status, canceled_reason")
        .eq("company_id", company.id)
        .maybeSingle()
    : { data: null }

  const mirrored = row as {
    stripe_customer_id?: string
    status?: string
    canceled_reason?: string | null
  } | null

  // The subscriptions row is not the only place a customer is known,
  // and here it is the wrong one to ask first: it only exists AFTER a
  // subscription succeeded, which is exactly the case this page is
  // not in.
  //
  // Migration 247 put the id on the company for this reason, and
  // ensureCustomer writes it there the moment the customer is made —
  // before anything is collected on it. Reading only the mirror meant
  // a mandate that was given but never turned into a subscription was
  // invisible: the reader was sent back to their bank, paid the
  // verification cent again, and produced a second orphaned mandate.
  // That happened twice in one morning.
  const { data: companyRow } = company
    ? await service
        .from("companies" as never)
        .select("stripe_customer_id")
        .eq("id", company.id)
        .maybeSingle()
    : { data: null }

  const customerId =
    mirrored?.stripe_customer_id
    ?? (companyRow as { stripe_customer_id?: string | null } | null)?.stripe_customer_id
    ?? null

  // Never fatal. The id can point at a customer this Stripe cannot
  // see — one deleted from the dashboard, or one belonging to the
  // other mode — and a checkout that will not render is worse than one
  // that forgets a saved mandate.
  const details = customerId
    ? await getBillingDetails(customerId, "nl").catch(() => null)
    : null
  const pm = details?.paymentMethod ?? null
  const savedMethod = pm ? `${pm.label}${pm.last4 ? ` ···· ${pm.last4}` : ""}` : null

  // The mandate we hold is the one the last subscription was charging.
  // If that subscription ended because the money never came, offering
  // it back as the quickest way through this form is offering the
  // failure again — so the card says so, and something else is
  // selected instead.
  //
  // Two endings mean that, and the second was missing. A subscription
  // Stripe gave up collecting ends at `canceled` with a reason. One
  // whose FIRST charge was refused never gets that far: it expires at
  // `incomplete_expired` with no reason at all, because there were no
  // retries to exhaust. A declined card was therefore offered straight
  // back, preselected, as "niets in te vullen".
  //
  // `first_payment_at` is the honest test for the second case — unset
  // means this subscription was never once paid for — but a status
  // check needs no extra column to be true.
  //
  // Neither covers somebody who cancelled on purpose: their mandate
  // works, and a red warning there would send them hunting for an IBAN
  // over a problem they never had.
  const savedMethodFailed =
    (mirrored?.status === "canceled" && mirrored?.canceled_reason === "payment_failed")
    || mirrored?.status === "incomplete"
    || mirrored?.status === "incomplete_expired"

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
      savedMethodFailed={savedMethodFailed}
      companyAddress={companyAddress}
    />
  )
}
