import "server-only"

import { createServerActionSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { stripePost } from "@/lib/stripe/rest"

/**
 * Who is allowed to spend a company's money, and which Stripe customer
 * that company is.
 *
 * In a module of its own rather than in actions.ts: that file carries
 * "use server", where every exported async function becomes a callable
 * endpoint. These two are internal plumbing — an endpoint that hands
 * back a company id and email to anyone who asks is not something to
 * create by accident.
 */

const TEAM_ROLES: ("owner" | "admin" | "member")[] = ["owner", "admin", "member"]

export type OwnedCompany = { companyId: string; companyName: string; email: string | null }
export type OwnershipError = { error: "not_signed_in" | "no_company" | "not_owner" }

/**
 * Resolve the caller's company AND confirm they may spend its money.
 * Billing is an owner's decision: a team member can read the plan but
 * must not be able to start or change a subscription.
 */
export async function resolveOwnedCompany(): Promise<OwnedCompany | OwnershipError> {
  const supabase = await createServerActionSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "not_signed_in" }

  const service = createServiceRoleSupabaseClient()
  const { data: owned } = await service
    .from("companies")
    .select("id, name")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (owned) {
    // The person setting up the payment, not companies.email. That
    // column is the outreach address for companies not yet on Arco —
    // scraped, often empty, and nobody on the company's side is
    // watching it. Once a company is claimed, everything Arco sends
    // goes to people, and money is no exception: a failed direct debit
    // has to reach someone who can act on it.
    return { companyId: owned.id, companyName: owned.name, email: user.email ?? null }
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

/**
 * The Stripe customer for this company, created on first need.
 *
 * The id lives on the company, not on the subscription. It used to be
 * read from `subscriptions`, which is only written once a subscription
 * exists — so every attempt before that found nothing and made another
 * customer. A single iDEAL payment produced three, and a mandate given
 * on one of them could not be charged on another.
 *
 * Written the moment the customer is created, so the next caller finds
 * it whether or not anything was ever bought.
 */
export async function ensureCustomer(
  companyId: string,
  companyName: string,
  email: string | null,
): Promise<string> {
  const service = createServiceRoleSupabaseClient()

  const { data: company } = await service
    .from("companies")
    .select("stripe_customer_id")
    .eq("id", companyId)
    .maybeSingle()

  const known = (company as { stripe_customer_id?: string | null } | null)?.stripe_customer_id
  if (known) return known

  // Older companies were only ever recorded on their subscription.
  const { data: mirrored } = await service
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("company_id", companyId)
    .maybeSingle()

  const fromSubscription = (mirrored as { stripe_customer_id?: string } | null)?.stripe_customer_id
  if (fromSubscription) {
    await service
      .from("companies")
      .update({ stripe_customer_id: fromSubscription })
      .eq("id", companyId)
    return fromSubscription
  }

  const customer = await stripePost<{ id: string }>("/customers", {
    name: companyName,
    ...(email ? { email } : {}),
    metadata: { company_id: companyId },
  })

  // Immediately, and before anything is collected on it: this write is
  // the whole point of the column.
  await service
    .from("companies")
    .update({ stripe_customer_id: customer.id })
    .eq("id", companyId)

  return customer.id
}
