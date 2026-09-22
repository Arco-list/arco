import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { logger } from "@/lib/logger"
import { stripeDelete, stripeGet, stripePost } from "@/lib/stripe/rest"

/**
 * What happens when somebody does not pay.
 *
 * Two rules, and they only make sense together.
 *
 * The first: a subscription whose FIRST payment fails is cancelled on
 * the spot rather than put through dunning. Dunning exists to recover
 * money from a customer who has paid before and probably will again —
 * a card that expired, a balance that was short for a day. None of
 * that applies to someone who has never paid us. Running the full
 * retry schedule for them only hands out three more weeks of the
 * product, because Pro is granted on the mandate and `past_due` keeps
 * it granted.
 *
 * The second: the cancellation is remembered on the company, so the
 * next attempt does not get the product on credit again.
 *
 * Together they close a loop that cost nothing to run: give a mandate
 * on an empty account, take Pro, let the debit fail, keep Pro through
 * dunning, get cancelled, start again minutes later. Round one now
 * yields the few days a SEPA debit spends in transit — near enough a
 * trial, and one we might have offered anyway — and every round after
 * it yields nothing.
 *
 * The outstanding invoice is voided rather than pursued. It is one
 * period at most, and a demand we will not enforce is worse than no
 * demand: it sits red on their invoice list, drives a banner offering
 * to repair a subscription that no longer exists, and buys us nothing.
 */

/**
 * An invoice the customer should never see.
 *
 * A card either works or it does not, in the second it takes to ask.
 * Someone trying three cards would collect three withdrawn invoices for
 * a purchase that never happened — a list of their own typing mistakes,
 * presented as financial history.
 *
 * A bank debit is different and the difference is real, not cosmetic.
 * iDEAL and SEPA put money in transit for days; an invoice that records
 * that is a document about something that actually occurred, and it
 * stays visible whichever way it ends. So this marks only the
 * synchronous failures, and it is set where we still know which
 * instrument was used — after the void the payment intent is cancelled
 * and a declined card is indistinguishable from a failed debit.
 */
export const HIDDEN_METADATA_KEY = "arco_hidden"

/**
 * Withdraw what a failed subscription billed.
 *
 * Both statuses, because the invoice arrives here by two roads. Our own
 * first-payment cancellation leaves it `open`; Stripe's end-of-dunning
 * cancellation runs the account's "mark the invoice as uncollectible"
 * setting first. An uncollectible invoice can still be voided — the two
 * roads meet here.
 *
 * Void rather than uncollectible as the resting state, because the two
 * say different things to the person reading their invoice list.
 * Uncollectible is "you owed this and we gave up", which stays red and
 * true forever. Void is "this document is withdrawn", which is what we
 * actually mean: we cancelled the subscription, so there is no period
 * to bill for.
 */
export async function forgiveOutstandingInvoices(
  customerId: string,
  /** Keep these off the customer's invoice list entirely — see
   *  HIDDEN_METADATA_KEY. */
  hide = false,
): Promise<void> {
  for (const status of ["open", "uncollectible"] as const) {
    try {
      const found = await stripeGet<{ data: { id: string }[] }>("/invoices", {
        customer: customerId,
        status,
        limit: 10,
      })
      for (const invoice of found.data ?? []) {
        await stripePost(`/invoices/${invoice.id}/void_invoice`, {}).catch((err) =>
          logger.warn("Could not void an invoice after cancelling for non-payment", {
            invoiceId: invoice.id, error: String(err),
          }),
        )
        if (hide) {
          // After the void, which Stripe allows: metadata is writable
          // on a voided invoice, so the order costs nothing and this
          // way the stamp lands even if the void was already done for
          // us by the cancellation.
          await stripePost(`/invoices/${invoice.id}`, {
            metadata: { [HIDDEN_METADATA_KEY]: "declined_first_payment" },
          }).catch((err) =>
            logger.warn("Could not mark an invoice as hidden", {
              invoiceId: invoice.id, error: String(err),
            }),
          )
        }
      }
    } catch (err) {
      logger.error("Could not list invoices to void after cancelling", { customerId, status }, err as Error)
    }
  }
}

/** Stripe's own word for "I cancelled this because they did not pay". */
export function isNonpaymentCancellation(reason: string | null | undefined): boolean {
  return reason === "payment_failed"
}

/**
 * Cancel a subscription whose first payment never arrived, and forgive
 * what it billed.
 *
 * Idempotent by way of Stripe: cancelling a cancelled subscription and
 * voiding a voided invoice both fail harmlessly, and the webhook that
 * calls this can arrive twice.
 */
export async function cancelUnpaidFirstPeriod(
  customerId: string,
  subscriptionId: string,
  /** The instrument that was refused. A card's failure is instant and
   *  leaves nothing worth recording; a bank debit's is not. */
  methodType?: string | null,
): Promise<void> {
  try {
    await stripeDelete(`/subscriptions/${subscriptionId}`)
  } catch (err) {
    logger.error("Could not cancel a subscription after its first payment failed", { subscriptionId }, err as Error)
    return
  }

  // After the cancellation, not before: voiding first would let Stripe
  // finalise the next period's invoice into the gap.
  await forgiveOutstandingInvoices(customerId, methodType === "card")
}

/**
 * Remember that this company did not pay.
 *
 * On the company rather than the subscription, because the
 * subscriptions row is upserted on company_id: the moment they
 * subscribe again, every trace of the one that failed is overwritten.
 */
export async function recordNonpaymentCancellation(
  supabase: SupabaseClient,
  companyId: string,
): Promise<void> {
  const { data: row } = await supabase
    .from("companies")
    .select("nonpayment_cancellations")
    .eq("id", companyId)
    .maybeSingle()

  const seen = (row as { nonpayment_cancellations?: number } | null)?.nonpayment_cancellations ?? 0

  const { error } = await supabase
    .from("companies")
    .update({ nonpayment_cancellations: seen + 1 } as never)
    .eq("id", companyId)

  if (error) {
    logger.error("Could not record a non-payment cancellation", { companyId, error: error.message })
    return
  }
  logger.info("Recorded a non-payment cancellation", { companyId, total: seen + 1 })
}
