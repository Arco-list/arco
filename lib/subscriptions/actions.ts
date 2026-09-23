"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { getSiteUrl } from "@/lib/utils"
import { logger } from "@/lib/logger"
import { isStripeConfigured, stripeGet, stripePost } from "@/lib/stripe/rest"
import { resolveOwnedCompany } from "@/lib/subscriptions/owned-company"

/**
 * What is left of the subscription actions once buying moved to
 * Elements: cancelling, and the door to Stripe's portal.
 *
 * Buying used to live here too, as a Stripe Checkout session. That path
 * is gone rather than kept around, because a second way to sell the
 * same thing does not stay a spare — it stays behind. It knew nothing
 * of the VAT check, the invoice address, the non-payment record or the
 * idempotency key, all of which were built against the Elements flow,
 * and reviving it would have quietly restored the bugs those fixed.
 * See lib/subscriptions/elements-actions.ts for why iDEAL forced the
 * move in the first place.
 */

type Failure = {
  error: "not_signed_in" | "no_company" | "not_owner" | "not_configured" | "nothing_to_manage" | "stale" | "failed"
}

/** The portal is a place you go, so what comes back is where to. */
type Result = { url: string } | Failure

/** A cancel is not — it changes a field and stays put. */
type ToggleResult = { ok: true } | Failure

/**
 * Cancel at period end, or take that back.
 *
 * Both used to hand off to Stripe's portal. They are one field on the
 * subscription, and sending someone to another site to flip it meant
 * leaving Arco at the exact moment they are deciding whether to stay —
 * with the words on that screen written by someone else. Changing a
 * payment method still goes to the portal: that genuinely needs a form
 * we should not be hosting.
 */
export async function setCancelAtPeriodEndAction(cancel: boolean): Promise<ToggleResult> {
  if (!isStripeConfigured()) return { error: "not_configured" }

  const resolved = await resolveOwnedCompany()
  if ("error" in resolved) return { error: resolved.error }

  const service = createServiceRoleSupabaseClient()
  const { data: row } = await service
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("company_id", resolved.companyId)
    .maybeSingle()

  const subscriptionId = (row as { stripe_subscription_id?: string } | null)?.stripe_subscription_id
  if (!subscriptionId) return { error: "nothing_to_manage" }

  try {
    // A subscription attached to a schedule cannot be cancelled: Stripe
    // refuses the field, because the schedule is what decides its
    // future. Someone who scheduled a switch to monthly and then
    // changed their mind about Pro altogether was simply stuck.
    //
    // Releasing hands the subscription back untouched — it stays the
    // yearly one it is, minus the phase that would have followed. That
    // phase is moot anyway: they are cancelling.
    if (cancel) {
      const current = await stripeGet<{ schedule?: string | null }>(`/subscriptions/${subscriptionId}`)
      if (current.schedule) {
        await stripePost(`/subscription_schedules/${current.schedule}/release`, {})
      }
    }

    const updated = await stripePost<{ cancel_at_period_end: boolean; canceled_at: number | null }>(
      `/subscriptions/${subscriptionId}`,
      { cancel_at_period_end: cancel },
    )

    // The webhook mirrors this too, but it arrives when it arrives and
    // the reader is looking at the page now. Writing it here as well
    // means the answer is on screen before the round trip finishes;
    // the webhook then confirms the same thing.
    await service
      .from("subscriptions")
      .update({
        cancel_at_period_end: Boolean(updated.cancel_at_period_end),
        canceled_at: updated.canceled_at ? new Date(updated.canceled_at * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("company_id", resolved.companyId)

    revalidatePath("/dashboard/subscription")
    revalidatePath("/admin/subscriptions")

    return { ok: true }
  } catch (err) {
    // The row we hold points at something Stripe no longer has. Saying
    // so beats "probeer het zo nog eens", which invites the reader to
    // retry a thing that cannot work.
    if ((err as { stripeCode?: string }).stripeCode === "resource_missing") {
      logger.error("Mirror points at a subscription Stripe does not have", {
        companyId: resolved.companyId,
        subscriptionId,
      })
      return { error: "stale" }
    }
    logger.error("Stripe cancel toggle failed", { companyId: resolved.companyId, cancel }, err as Error)
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
    .from("subscriptions")
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
      return_url: `${origin}/dashboard/subscription`,
      locale: "nl",
    })
    return { url: session.url }
  } catch (err) {
    logger.error("Stripe portal session failed", { companyId: resolved.companyId }, err as Error)
    return { error: "failed" }
  }
}
