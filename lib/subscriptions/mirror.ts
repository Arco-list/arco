import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { stripeGet } from "@/lib/stripe/rest"

/**
 * Writing Stripe's truth into our own table.
 *
 * Lifted out of the webhook route because the webhook is no longer the
 * only caller. A sandbox test proved why: the payment succeeded, Stripe
 * delivered the event to an endpoint that did not exist yet, and the
 * company stayed on Free while its subscription sat there active. One
 * missed delivery should not be able to do that, so the page the reader
 * returns to after checkout writes the same row.
 *
 * Safe to call twice — the upsert is keyed on company_id, and both
 * callers derive their data from the same Stripe objects.
 */

export type StripeSubscription = {
  id: string
  customer: string
  status: string
  cancel_at_period_end: boolean
  current_period_end: number | null
  trial_end: number | null
  canceled_at: number | null
  items: { data: { price: { id: string; recurring?: { interval?: string } | null } }[] }
  metadata?: Record<string, string> | null
}

type ServiceClient = ReturnType<typeof createServiceRoleSupabaseClient>

const toIso = (seconds: number | null | undefined) =>
  seconds ? new Date(seconds * 1000).toISOString() : null

/**
 * The company this subscription belongs to, in the order the answer is
 * cheapest and most certain:
 *
 *   1. the subscription's own metadata — Checkout stamps it there;
 *   2. a row we already mirrored for this customer — true for every
 *      change to an existing subscription;
 *   3. the customer's metadata at Stripe — the fallback for anything
 *      created from the dashboard rather than from our checkout.
 */
async function resolveCompanyId(
  supabase: ServiceClient,
  subscription: StripeSubscription,
): Promise<string | null> {
  const fromMetadata = subscription.metadata?.company_id
  if (fromMetadata) return fromMetadata

  const { data: mirrored } = await supabase
    .from("subscriptions" as never)
    .select("company_id")
    .eq("stripe_customer_id", subscription.customer)
    .maybeSingle()
  const known = (mirrored as { company_id?: string } | null)?.company_id
  if (known) return known

  try {
    const customer = await stripeGet<{ metadata?: Record<string, string> | null }>(
      `/customers/${subscription.customer}`,
    )
    return customer.metadata?.company_id ?? null
  } catch {
    return null
  }
}

export async function mirrorSubscription(
  supabase: ServiceClient,
  subscription: StripeSubscription,
): Promise<void> {
  const companyId = await resolveCompanyId(supabase, subscription)
  if (!companyId) {
    // Not ours, or a customer we have never seen: log and drop rather
    // than guess which company it belongs to.
    logger.error("Stripe subscription without a company", {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
    })
    return
  }

  const item = subscription.items?.data?.[0]

  // "First" has to mean first. The upsert rewrites the whole row, so
  // stamping the moment unconditionally would push the date forward on
  // every mirror while active — a column named first_payment_at that
  // actually held "last seen paid", which is a different fact and the
  // wrong one for deciding whether this subscription has ever been
  // good for its money.
  const paidNow = subscription.status === "active" || subscription.status === "trialing"
  const { data: existing } = paidNow
    ? await supabase
        .from("subscriptions" as never)
        .select("first_payment_at")
        .eq("company_id", companyId)
        .maybeSingle()
    : { data: null }
  const alreadyPaid = (existing as { first_payment_at?: string | null } | null)?.first_payment_at

  // One row per company: a company has one subscription, and an upgrade
  // replaces rather than accumulates.
  const { error } = await supabase
    .from("subscriptions" as never)
    .upsert(
      {
        company_id: companyId,
        stripe_customer_id: subscription.customer,
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        stripe_price_id: item?.price?.id ?? null,
        billing_interval: item?.price?.recurring?.interval ?? null,
        current_period_end: toIso(subscription.current_period_end),
        cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
        trial_end: toIso(subscription.trial_end),
        canceled_at: toIso(subscription.canceled_at),
        // The grant exists only to cover the gap between a repair
        // payment leaving and Stripe hearing that it landed. Any status
        // but `unpaid` means that gap has closed — the money arrived,
        // or the subscription moved on without it — and a deadline left
        // standing would quietly re-grant Pro if the company fell back
        // to unpaid inside the same ten days.
        // Omitted entirely while unpaid — PostgREST builds its SET list
        // from the keys present, so leaving it out preserves a deadline
        // this same call would otherwise wipe on its way past.
        ...(subscription.status === "unpaid" ? {} : { collection_pending_until: null }),
        // Stamped once, when money first arrives, and omitted every
        // other time so a later mirror can neither move nor wipe it. A
        // renewal that fails takes the subscription back to past_due,
        // and forgetting it had ever been paid would treat a two-year
        // customer like someone who has never given us a cent.
        ...(paidNow && !alreadyPaid ? { first_payment_at: new Date().toISOString() } : {}),
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "company_id" },
    )

  if (error) {
    logger.error(
      "Failed to mirror Stripe subscription",
      { companyId, subscriptionId: subscription.id },
      error as unknown as Error,
    )
    throw new Error(error.message)
  }
}

/**
 * Fetch a subscription by id and mirror it, swallowing failures.
 *
 * For the callers that are a safety net rather than the main path: the
 * reader is waiting on a page, and a mirror that did not take is not a
 * reason to tell them their payment failed. The webhook will do it
 * again anyway.
 */
export async function mirrorSubscriptionById(subscriptionId: string): Promise<void> {
  try {
    const subscription = await stripeGet<StripeSubscription>(`/subscriptions/${subscriptionId}`)
    await mirrorSubscription(createServiceRoleSupabaseClient(), subscription)
  } catch (err) {
    logger.error("Best-effort subscription mirror failed", { subscriptionId }, err as Error)
  }
}
