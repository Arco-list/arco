"use server"

import { headers } from "next/headers"

import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { getSiteUrl } from "@/lib/utils"
import { logger } from "@/lib/logger"
import { PRICE_IDS, TAX_RATE_ID, isStripeConfigured, stripePost } from "@/lib/stripe/rest"

type Result = { url: string } | { error: "not_signed_in" | "no_company" | "not_owner" | "not_configured" | "nothing_to_manage" | "failed" }

const TEAM_ROLES: ("owner" | "admin" | "member")[] = ["owner", "admin", "member"]

/**
 * Resolve the caller's company AND confirm they may spend its money.
 * Billing is an owner's decision: a team member can read the plan but
 * must not be able to start or change a subscription.
 */
async function resolveOwnedCompany(): Promise<
  { companyId: string; companyName: string; email: string | null } | { error: "not_signed_in" | "no_company" | "not_owner" }
> {
  const supabase = await createServerActionSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "not_signed_in" }

  const service = createServiceRoleSupabaseClient()
  const { data: owned } = await service
    .from("companies")
    .select("id, name, email")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (owned) {
    return { companyId: owned.id, companyName: owned.name, email: owned.email ?? user.email ?? null }
  }

  // Signed in, but not an owner anywhere: distinguish "you have no
  // company" from "you are on a team but may not do this", so the UI
  // can say which.
  const { data: membership } = await service
    .from("company_contacts")
    .select("company_id, person:persons!inner(auth_user_id)")
    .eq("person.auth_user_id", user.id)
    .in("role", TEAM_ROLES)
    .limit(1)
    .maybeSingle()

  return { error: membership ? "not_owner" : "no_company" }
}

/** The Stripe customer for this company, created on first need. */
async function ensureCustomer(companyId: string, companyName: string, email: string | null): Promise<string> {
  const service = createServiceRoleSupabaseClient()
  const { data: existing } = await service
    .from("subscriptions" as never)
    .select("stripe_customer_id")
    .eq("company_id", companyId)
    .maybeSingle()

  const known = (existing as { stripe_customer_id?: string } | null)?.stripe_customer_id
  if (known) return known

  const customer = await stripePost<{ id: string }>("/customers", {
    name: companyName,
    ...(email ? { email } : {}),
    metadata: { company_id: companyId },
  })
  return customer.id
}

/**
 * Start a Checkout session for Pro.
 *
 * SEPA first, card second: direct debit costs €0,35 flat against 2,8%
 * on a business card, and it is the method we want people on. Checkout
 * collects the mandate itself, which is the step a hand-rolled flow got
 * wrong in the sandbox.
 */
export async function startCheckoutAction(interval: "month" | "year"): Promise<Result> {
  if (!isStripeConfigured()) return { error: "not_configured" }

  const resolved = await resolveOwnedCompany()
  if ("error" in resolved) return { error: resolved.error }

  try {
    const customerId = await ensureCustomer(resolved.companyId, resolved.companyName, resolved.email)
    const origin = (await headers()).get("origin") ?? getSiteUrl()

    const session = await stripePost<{ url: string }>("/checkout/sessions", {
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: interval === "month" ? PRICE_IDS.monthly : PRICE_IDS.yearly, quantity: 1 }],
      payment_method_types: ["sepa_debit", "card"],
      // Company purchase: the invoice needs a VAT number and an address
      // the buyer's bookkeeper will accept.
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      subscription_data: {
        default_tax_rates: [TAX_RATE_ID],
        metadata: { company_id: resolved.companyId },
      },
      success_url: `${origin}/dashboard/billing?checkout=success`,
      cancel_url: `${origin}/dashboard/billing?checkout=cancelled`,
      locale: "nl",
    })

    return { url: session.url }
  } catch (err) {
    logger.error("Stripe checkout session failed", { companyId: resolved.companyId }, err as Error)
    return { error: "failed" }
  }
}

/**
 * Open Stripe's Customer Portal — the one screen for invoices, payment
 * method, cancelling and un-cancelling. Everything a billing page would
 * otherwise have to build, hosted and PCI-scoped by Stripe.
 */
export async function openPortalAction(): Promise<Result> {
  if (!isStripeConfigured()) return { error: "not_configured" }

  const resolved = await resolveOwnedCompany()
  if ("error" in resolved) return { error: resolved.error }

  const service = createServiceRoleSupabaseClient()
  const { data: row } = await service
    .from("subscriptions" as never)
    .select("stripe_customer_id")
    .eq("company_id", resolved.companyId)
    .maybeSingle()

  const customerId = (row as { stripe_customer_id?: string } | null)?.stripe_customer_id
  // No customer means no invoices, no payment method, nothing to
  // cancel. Sending them to an empty portal would be worse than saying
  // there is nothing there yet.
  if (!customerId) return { error: "nothing_to_manage" }

  try {
    const origin = (await headers()).get("origin") ?? getSiteUrl()
    const session = await stripePost<{ url: string }>("/billing_portal/sessions", {
      customer: customerId,
      return_url: `${origin}/dashboard/billing`,
      locale: "nl",
    })
    return { url: session.url }
  } catch (err) {
    logger.error("Stripe portal session failed", { companyId: resolved.companyId }, err as Error)
    return { error: "failed" }
  }
}
