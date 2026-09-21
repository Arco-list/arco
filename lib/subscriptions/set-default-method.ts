import "server-only"

import { logger } from "@/lib/logger"
import { stripePost } from "@/lib/stripe/rest"

/**
 * Make a mandate the default in both places Stripe looks.
 *
 * A subscription's `default_payment_method` covers the recurring
 * charge and nothing else. Everything else Stripe bills — a one-off
 * invoice, and crucially `POST /invoices/{id}/pay` called without an
 * explicit method — falls back to the CUSTOMER's
 * `invoice_settings.default_payment_method`. We set only the first,
 * which made the payment-method page look right and the repair fail:
 * the page read the subscription and showed the new account, while
 * paying the open invoice was refused with "There is no
 * `default_payment_method` set on this Customer or Invoice."
 *
 * Both callers — the first subscription and a later replacement — go
 * through here so the two cannot drift again.
 *
 * The customer write is deliberately not fatal. The subscription is
 * already on the new method by the time this runs, so the recurring
 * charge is safe; failing the whole action here would tell a reader
 * their mandate did not land when it did.
 */
export async function setDefaultPaymentMethod(
  customerId: string,
  paymentMethodId: string,
): Promise<void> {
  try {
    await stripePost(`/customers/${customerId}`, {
      invoice_settings: { default_payment_method: paymentMethodId },
    })
  } catch (err) {
    logger.error(
      "Could not set the customer's default payment method",
      { customerId },
      err as Error,
    )
  }
}
