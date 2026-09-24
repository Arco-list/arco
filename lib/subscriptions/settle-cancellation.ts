import "server-only"

import { logger } from "@/lib/logger"
import { stripeGet, stripePost } from "@/lib/stripe/rest"

/**
 * Money collected for time the customer will not get.
 *
 * Cancelling a subscription does not stop an invoice that is already
 * out. Stripe leaves it `open` with `auto_advance` on, and a SEPA debit
 * already handed to the bank cannot be recalled at all — it lands days
 * later, against a subscription that no longer exists.
 *
 * That is not a theoretical case. It happened the first time anyone
 * subscribed on the live account: a yearly plan taken by mistake,
 * cancelled within the hour, and €566,28 still travelling. The
 * customer would have seen the charge on their statement with nothing
 * behind it, and nothing in our code was going to notice.
 *
 * `forgiveOutstandingInvoices` covers the other ending — the one where
 * we cancel because nobody paid. This covers the ordinary one, where
 * somebody cancelled on purpose and their money is in the post.
 *
 * Two halves, because the timing decides which is possible:
 *
 *   nothing collected yet → void the invoice, and no money moves
 *   payment already away  → wait for it to land, then refund
 */

/**
 * Withdraw what a cancelled subscription still has outstanding.
 *
 * Only what can be withdrawn: an invoice whose payment is already
 * travelling cannot be voided, and trying leaves an error in the log
 * and the invoice exactly where it was. Those are picked up by
 * `refundIfAccessEnded` when the payment lands.
 */
export async function voidUncollectedInvoices(customerId: string): Promise<void> {
  try {
    const found = await stripeGet<{ data: { id: string; payment_intent?: string | null }[] }>(
      "/invoices",
      { customer: customerId, status: "open", limit: 10 },
    )

    for (const invoice of found.data ?? []) {
      // A payment in flight makes this invoice the other half's
      // problem. Voiding is refused while one is processing, and
      // asking anyway only adds noise.
      if (invoice.payment_intent) {
        const intent = await stripeGet<{ status?: string }>(
          `/payment_intents/${invoice.payment_intent}`,
        ).catch(() => null)
        if (intent?.status === "processing" || intent?.status === "succeeded") {
          logger.info("Invoice left open: its payment is already travelling", {
            invoiceId: invoice.id, paymentStatus: intent.status,
          })
          continue
        }
      }

      await stripePost(`/invoices/${invoice.id}/void_invoice`, {}).catch((err) =>
        logger.warn("Could not void an invoice after a cancellation", {
          invoiceId: invoice.id, error: String(err),
        }),
      )
    }
  } catch (err) {
    logger.error("Could not settle invoices after a cancellation", { customerId }, err as Error)
  }
}

/**
 * Give back what was collected for a period the customer no longer has.
 *
 * Called when an invoice is paid, which is the first moment a debit
 * handed to a bank days ago becomes actionable.
 *
 * The test is deliberately narrow: the subscription must be CANCELLED
 * and must have ended BEFORE the period this invoice billed for. A
 * subscription that runs to the end of what it charged owes nothing
 * back — which is every ordinary cancellation on Arco, because our own
 * cancel button sets cancel_at_period_end and access lasts exactly as
 * long as it was paid for.
 *
 * So this fires only on an immediate cancellation: an admin acting in
 * the Stripe dashboard, usually because somebody asked. Precisely the
 * case where a refund is what was meant and the debit was already gone.
 *
 * Refunded in full rather than prorated. The window it can fire in is
 * hours, not weeks, and inventing proration to keep a few euros of a
 * period we already declined to serve would be the wrong kind of
 * careful.
 */
export async function refundIfAccessEnded(invoiceId: string): Promise<void> {
  try {
    const invoice = await stripeGet<{
      subscription?: string | null
      payment_intent?: string | null
      period_end?: number | null
      amount_paid?: number | null
      charge?: string | null
    }>(`/invoices/${invoiceId}`)

    if (!invoice.subscription || !invoice.payment_intent) return
    if (!invoice.amount_paid || invoice.amount_paid <= 0) return

    const subscription = await stripeGet<{ status?: string; ended_at?: number | null }>(
      `/subscriptions/${invoice.subscription}`,
    ).catch(() => null)

    if (!subscription || subscription.status !== "canceled") return

    const endedAt = subscription.ended_at
    const periodEnd = invoice.period_end
    if (!endedAt || !periodEnd || endedAt >= periodEnd) return

    await stripePost("/refunds", {
      payment_intent: invoice.payment_intent,
      reason: "requested_by_customer",
      metadata: { arco_reason: "subscription_cancelled_before_period_end" },
    })

    logger.info("Refunded an invoice collected after the subscription ended", {
      invoiceId, subscriptionId: invoice.subscription, amount: invoice.amount_paid,
    })
  } catch (err) {
    // Never fatal: a refund that did not happen is money we still
    // hold and can return by hand. Throwing here would make Stripe
    // replay the whole invoice.paid handler, which mirrors and grants.
    logger.error("Could not refund an invoice after cancellation", { invoiceId }, err as Error)
  }
}
