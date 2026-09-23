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
  /** `price` arrives as a full Price object, so the amount is here
   *  without an expand — net of tax, which is what Stripe stores and
   *  what the tax rate is then applied to. */
  items: { data: { price: { id: string; unit_amount?: number | null; recurring?: { interval?: string } | null } }[] }
  metadata?: Record<string, string> | null
  /** The mandate the recurring charge runs on. Read to warn before a
   *  card on it expires. */
  default_payment_method?: string | null
  /** Why it ended. `cancellation_requested` and `payment_failed` are
   *  very different facts about the mandate we still hold. */
  cancellation_details?: { reason?: string | null } | null
  /** The bill this subscription last raised. Named rather than searched
   *  for, because a list query moments after a status change can miss
   *  it in both the status it left and the one it is entering. */
  latest_invoice?: string | null
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
    .from("subscriptions")
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

  // "First" has to mean first, and it has to mean THIS subscription's
  // first. Two ways to get that wrong, and the row's shape invites
  // both: it is one per company, keyed on company_id, so a new
  // subscription overwrites the old one's row.
  //
  // Stamp it on every mirror and the column holds "last seen paid",
  // which is a different fact. Carry it across a change of
  // subscription and a brand-new one inherits its predecessor's
  // payment — that one actually happened, and it is the worse of the
  // two: the webhook reads this to tell a first payment from a
  // renewal, so an inherited stamp makes a first debit that bounces
  // look like a renewal and sends it through three weeks of dunning
  // instead of ending it.
  //
  // So the value is computed rather than omitted, and a different
  // subscription id starts from nothing.
  const paidNow = subscription.status === "active" || subscription.status === "trialing"
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("first_payment_at, stripe_subscription_id")
    .eq("company_id", companyId)
    .maybeSingle()
  const previous = existing as {
    first_payment_at?: string | null
    stripe_subscription_id?: string | null
  } | null
  const sameSubscription = previous?.stripe_subscription_id === subscription.id
  const carried = sameSubscription ? (previous?.first_payment_at ?? null) : null
  const firstPaymentAt = carried ?? (paidNow ? new Date().toISOString() : null)

  // One row per company: a company has one subscription, and an upgrade
  // replaces rather than accumulates.
  const { error } = await supabase
    .from("subscriptions")
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
        canceled_reason: subscription.cancellation_details?.reason ?? null,
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
        first_payment_at: firstPaymentAt,
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

