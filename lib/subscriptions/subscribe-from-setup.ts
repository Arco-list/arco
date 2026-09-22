import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { priceId, taxRateId, isStripeConfigured, stripeGet, stripePost } from "@/lib/stripe/rest"
import { mirrorSubscription, type StripeSubscription } from "@/lib/subscriptions/mirror"
import { LIVE_STATUSES, hasLiveSubscription, type Failure } from "@/lib/subscriptions/live-status"
import { setDefaultPaymentMethod } from "@/lib/subscriptions/set-default-method"
import { cancelUnpaidFirstPeriod } from "@/lib/subscriptions/nonpayment"

/**
 * Turn a completed mandate into a subscription.
 *
 * Shared by the page the reader returns to and by the webhook, because
 * they are two ways of learning the same thing. The page hears it from
 * the browser coming back; the webhook hears it from Stripe. A customer
 * who authorises in their banking app and never returns — a tab closed,
 * an app that does not hand back — would otherwise have given us a
 * mandate and received nothing, and nobody would know.
 *
 * Safe to run twice: the guards below refuse a second subscription, so
 * whichever arrives first wins and the other stops.
 */
export async function subscribeFromSetupIntent(
  setupIntentId: string,
  interval: "month" | "year",
  /** Verified caller. The page knows it from the session; the webhook
   *  takes it from the intent's own metadata, which Stripe signed. */
  companyId: string,
): Promise<{ status: string } | Failure> {
  if (!isStripeConfigured()) return { error: "not_configured" }
  if (!/^seti_[A-Za-z0-9_]+$/.test(setupIntentId)) return { error: "failed" }

  const resolved = { companyId }

  try {
    const intent = await stripeGet<{
      status?: string
      payment_method?: string | null
      customer?: string | null
      metadata?: Record<string, string> | null
    }>(`/setup_intents/${setupIntentId}`)

    // An id from a query string proves nothing on its own.
    if (intent.metadata?.company_id !== resolved.companyId) return { error: "failed" }
    if (intent.status !== "succeeded" || !intent.payment_method) return { error: "not_ready" }

    // The customer the mandate is actually attached to — never a fresh
    // ensureCustomer call. That looks the customer up in `subscriptions`,
    // and at this point in the flow there is no row there yet: the first
    // step made one customer and put the mandate on it, and asking again
    // would make a second and try to charge a payment method belonging
    // to the first. Stripe refuses that, correctly.
    const customerId = intent.customer
    if (!customerId) return { error: "failed" }

    // Checked twice on purpose. The first guard spares the reader the
    // form; this one is the one that prevents a second charge, and it
    // sits as close to the create call as it can.
    if (await hasLiveSubscription(resolved.companyId)) return { error: "already_subscribed" }

    // And once more at Stripe itself, because our own table can be
    // behind: the mirror is written after the subscription exists, and
    // a write that failed leaves a company looking unsubscribed while
    // it is paying. Only possible here, where the customer comes from
    // the mandate rather than from ensureCustomer inventing one.
    const atStripe = await stripeGet<{ data: { status: string }[] }>("/subscriptions", {
      customer: customerId,
      status: "all",
      limit: 20,
    })
    if (atStripe.data?.some((sub) => LIVE_STATUSES.includes(sub.status))) {
      return { error: "already_subscribed" }
    }

    const subscription = await stripePost<StripeSubscription & { status: string }>("/subscriptions", {
      customer: customerId,
      items: [{ price: priceId(interval) }],
      default_tax_rates: [taxRateId()],
      default_payment_method: intent.payment_method,
      metadata: { company_id: resolved.companyId },
      expand: ["items.data.price"],
    })

    // The subscription's own charge is covered by the line above; this
    // covers everything else Stripe bills this customer.
    await setDefaultPaymentMethod(customerId, intent.payment_method)

    // Written here rather than waiting for the webhook: the reader is
    // looking at the page now. The webhook confirms the same row later.
    await mirrorSubscription(createServiceRoleSupabaseClient(), subscription)

    // A subscription exists, and it is not a sale. `incomplete` means
    // the first charge was refused — a declined card, most often — and
    // the reader is standing in front of the form that can fix it.
    //
    // Reported as a failure because the alternative is what it did
    // before: the page took any non-error as success, sent them to the
    // subscription screen and congratulated them on Pro, while the
    // banner behind the dialog already read Gratis. The subscription
    // itself is cleaned up by the webhook, which cancels a first
    // period that was never paid for.
    //
    // SEPA does not land here. A debit in transit reports `processing`
    // on the payment and leaves the subscription past_due, which is a
    // real sale that simply has not settled.
    if (subscription.status === "incomplete" || subscription.status === "incomplete_expired") {
      logger.warn("First payment was declined", {
        companyId: resolved.companyId,
        subscriptionId: subscription.id,
      })
      // Withdrawn here, not left to the webhook.
      //
      // The invoice cannot be avoided — Stripe issues one as part of
      // creating a subscription, and there is no way to ask for a
      // subscription without it. Leaving it is avoidable, and we were
      // not avoiding it: a declined card left a subscription reading
      // `incomplete` and a bill reading `openstaand` on the reader's
      // invoice list, for a purchase that never happened.
      //
      // The webhook does the same thing on invoice.payment_failed, so
      // this is a duplicate — deliberately. That path is the safety net
      // for a decline that happens away from the browser; this one runs
      // while the reader is still on the page, and it is the difference
      // between never seeing the stray invoice and seeing it until an
      // event is delivered. Both are idempotent.
      // The instrument decides whether this leaves a trace. Read
      // now, while the payment method still exists and says what it
      // is — cancelling the subscription cancels its payment intent,
      // and after that a declined card looks exactly like a failed
      // direct debit.
      const method = await stripeGet<{ type?: string }>(
        `/payment_methods/${intent.payment_method}`,
      ).catch(() => null)
      await cancelUnpaidFirstPeriod(customerId, subscription.id, method?.type)
      return { error: "payment_declined" }
    }

    return { status: subscription.status }
  } catch (err) {
    logger.error("Subscription creation after setup failed", { companyId: resolved.companyId }, err as Error)
    return { error: "failed" }
  }
}
