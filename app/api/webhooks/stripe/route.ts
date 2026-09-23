import { NextRequest, NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "node:crypto"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { stripeGet } from "@/lib/stripe/rest"
import { mirrorSubscription, type StripeSubscription } from "@/lib/subscriptions/mirror"
import { subscribeFromSetupIntent } from "@/lib/subscriptions/subscribe-from-setup"
import { getCompanyBilling } from "@/lib/subscriptions/get-company-subscription"
import { enforceCreditAllowance, restoreHeldBackCredits } from "@/lib/subscriptions/enforce-credit-allowance"
import {
  cancelUnpaidFirstPeriod,
  forgiveOutstandingInvoices,
  endedOverNonpayment,
  recordNonpaymentCancellation,
} from "@/lib/subscriptions/nonpayment"
import { notifySubscriber } from "@/lib/subscriptions/notify"
import { cancelFoundingEnding, scheduleCardExpiry, scheduleRenewalReminder } from "@/lib/subscriptions/schedule-mail"
import { grossCents } from "@/app/dashboard/subscription/checkout/constants"

/**
 * Stripe webhook — the only thing that writes a subscription.
 *
 * Checkout hands the reader to Stripe and brings them back a second
 * later; what actually happened is told here, by Stripe, in its own
 * time. So the page never writes a plan on the strength of a redirect:
 * it reads the mirror this endpoint keeps, and the mirror is only ever
 * as true as Stripe's last event.
 *
 * Configure at Stripe → Developers → Webhooks:
 *   URL     https://www.arcolist.com/api/webhooks/stripe
 *   Events  checkout.session.completed,
 *           customer.subscription.created / .updated / .deleted,
 *           invoice.paid, invoice.payment_failed
 *
 * Locally: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
 * prints the whsec_… that goes in STRIPE_WEBHOOK_SECRET.
 */

// Stripe signs the raw bytes, so the body must not be parsed before it
// is verified — hence request.text() and a manual JSON.parse after.
export const dynamic = "force-dynamic"

/** How far out of step a timestamp may be before we treat the call as a
 *  replay rather than a delayed delivery. Stripe's own default. */
const TOLERANCE_SECONDS = 300

/**
 * Verify Stripe's `t=…,v1=…` header: an HMAC-SHA256 of `${t}.${body}`
 * under the endpoint secret. Written out rather than pulled from the
 * SDK — this is the whole of it, and the SDK is not installable here
 * (the pnpm store in this checkout is a version ahead of the lockfile).
 */
function verifySignature(payload: string, header: string | null, secret: string): boolean {
  if (!header) return false

  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const [k, ...rest] = kv.split("=")
      return [k.trim(), rest.join("=")]
    }),
  )
  const timestamp = Number(parts.t)
  const signature = parts.v1
  if (!timestamp || !signature) return false

  // A signature that is valid but old is a replay, so the timestamp is
  // part of what is checked, not decoration.
  if (Math.abs(Date.now() / 1000 - timestamp) > TOLERANCE_SECONDS) return false

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex")
  const a = Buffer.from(expected, "utf8")
  const b = Buffer.from(signature, "utf8")
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: NextRequest) {
  // More than one secret, because more than one sender is legitimate.
  //
  // A configured endpoint signs with the secret Stripe shows in the
  // dashboard; `stripe listen` signs with its own. Holding one meant
  // swapping the value and restarting to move between them, so a
  // deployed endpoint and a local listener could never both work.
  //
  // Comma-separated, tried in turn. Each is still verified in full:
  // this widens who may sign, not what counts as a signature.
  const secrets = (process.env.STRIPE_WEBHOOK_SECRET ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

  if (secrets.length === 0) {
    logger.error("Stripe webhook called without STRIPE_WEBHOOK_SECRET set", {})
    return NextResponse.json({ error: "not_configured" }, { status: 500 })
  }

  const payload = await request.text()
  const stripeSignature = request.headers.get("stripe-signature")
  if (!secrets.some((secret) => verifySignature(payload, stripeSignature, secret))) {
    // Unsigned or stale: 400, never 500 — a retry would not help.
    return NextResponse.json({ error: "bad_signature" }, { status: 400 })
  }

  let event: { id: string; type: string; data: { object: Record<string, unknown> } }
  try {
    event = JSON.parse(payload)
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 })
  }

  const supabase = createServiceRoleSupabaseClient()

  // Stripe retries, replays, and occasionally delivers out of order.
  // The insert is the lock: a duplicate id collides on the primary key
  // and we stop, rather than applying the same event twice.
  const { error: claimError } = await supabase
    .from("stripe_events" as never)
    .insert({ id: event.id, type: event.type } as never)

  if (claimError) {
    // 23505 = unique_violation: already handled, and that is a success
    // from Stripe's point of view.
    if ((claimError as { code?: string }).code === "23505") {
      return NextResponse.json({ received: true, duplicate: true })
    }
    logger.error("Stripe event claim failed", { eventId: event.id, type: event.type }, claimError as unknown as Error)
    return NextResponse.json({ error: "claim_failed" }, { status: 500 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        // The session carries only the subscription's id, and the
        // object Stripe sends with subscription events is the one we
        // want — so fetch it rather than mirroring half a record.
        const subscriptionId = (event.data.object as { subscription?: string }).subscription
        if (subscriptionId) {
          const subscription = await stripeGet<StripeSubscription>(`/subscriptions/${subscriptionId}`)
          await mirrorSubscription(supabase, subscription)
        }
        break
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as unknown as StripeSubscription
        await mirrorSubscription(supabase, subscription)

        // Whatever the plan now allows, make it true.
        //
        // Not only on `deleted`: a subscription that lapses to unpaid,
        // or is downgraded, loses its entitlement without any event
        // called "deleted". Asked after the mirror, so the billing it
        // reads is the one Stripe just described, and cheap when
        // nothing is over the line — which is almost always.
        const companyForCredits = subscription.metadata?.company_id
        // How many projects this event actually took off the page. Kept
        // because the mail below is worth more with it: "back to the
        // free limit" is policy, "3 projecten staan niet meer op je
        // pagina" is what happened.
        let demotedCount = 0
        if (companyForCredits) {
          const billing = await getCompanyBilling(companyForCredits)
          if (billing.plan === "pro") {
            // Bought the unlimited page; get the unlimited page. Leaving
            // the credits where the free limit parked them would make
            // the reader finish their own purchase, one menu at a time.
            await restoreHeldBackCredits(companyForCredits)
          } else {
            demotedCount = (await enforceCreditAllowance(companyForCredits)).length
          }

          // Re-decided on every subscription event rather than only at
          // signup, because every one of them can change the answer: a
          // switch to yearly earns the reminder, a switch back removes
          // it, a renewal moves it to the next period, and a
          // cancellation clears it. One call that recomputes beats four
          // call sites that each remember to.
          // A real subscription outranks founding access, so the
          // warning that founding is ending stops being true the
          // moment one exists.
          if (billing.source === "subscription") await cancelFoundingEnding(companyForCredits)

          await scheduleCardExpiry(
            companyForCredits,
            subscription.default_payment_method,
            billing.plan === "pro",
          )

          const netAmount = subscription.items?.data?.[0]?.price?.unit_amount ?? null
          await scheduleRenewalReminder(
            companyForCredits,
            billing.interval,
            billing.currentPeriodEnd,
            // Gross, because the mail names what leaves the account
            // and Stripe stores the price net of the tax rate it then
            // applies. The same arithmetic the checkout draws.
            netAmount === null ? null : grossCents(netAmount),
            billing.plan === "pro" && !billing.cancelAtPeriodEnd,
          )
        }

        // Remembered after the mirror, so the row exists to look the
        // company up from, and only for Stripe's own cancellations —
        // somebody who chooses to leave has not done anything that
        // should follow them back.
        if (
          event.type === "customer.subscription.deleted" &&
          endedOverNonpayment(subscription.cancellation_details?.reason, subscription.metadata)
        ) {
          const companyId = subscription.metadata?.company_id
          if (companyId) await recordNonpaymentCancellation(supabase, companyId)
          // And forgive what it billed. Stripe's account setting has
          // already marked the invoice uncollectible by now, which is
          // the safe resting place if this never runs — but it reads as
          // a debt we gave up on, and we mean to withdraw it.
          if (subscription.customer) {
            await forgiveOutstandingInvoices(subscription.customer, subscription.latest_invoice)
          }
          // Last, because the mail promises the invoice is withdrawn
          // and the credits are held rather than lost. Sending it
          // before those ran would make it a forecast.
          if (companyId) {
            await notifySubscriber(companyId, "subscription-ended-nonpayment", {
              hidden_count: demotedCount,
            })
          }
        }
        break
      }

      /**
       * A mandate that completed away from the browser.
       *
       * iDEAL sends the customer to their bank and relies on them
       * coming back to finish; when they do, the page creates the
       * subscription itself. When they do not — a closed tab, a
       * banking app that never hands back — the mandate exists at
       * Stripe and nothing else does. This is the other way of
       * hearing about it.
       *
       * Only for a setup that carries an interval: replacing a
       * payment method uses the same object and must not create a
       * subscription. The guards inside refuse a second one, so a
       * reader who does return races with this and loses harmlessly.
       */
      case "setup_intent.succeeded": {
        const intent = event.data.object as {
          id?: string
          metadata?: Record<string, string> | null
        }
        const companyId = intent.metadata?.company_id
        const interval = intent.metadata?.interval
        if (intent.id && companyId && (interval === "month" || interval === "year")) {
          const result = await subscribeFromSetupIntent(intent.id, interval, companyId)
          if ("error" in result && result.error !== "already_subscribed") {
            logger.warn("Subscription from setup_intent.succeeded did not complete", {
              setupIntentId: intent.id, companyId, reason: result.error,
            })
          }
        }
        break
      }

      case "invoice.paid":
      case "invoice.payment_failed": {
        // The invoice moves the subscription's status (active ⇄
        // past_due), and that status is what the product reads.
        const invoice = event.data.object as {
          subscription?: string
          customer?: string
          amount_due?: number
          attempt_count?: number
          next_payment_attempt?: number | null
        }
        const subscriptionId = invoice.subscription
        if (subscriptionId) {
          const subscription = await stripeGet<StripeSubscription>(`/subscriptions/${subscriptionId}`)
          await mirrorSubscription(supabase, subscription)

          // A first payment that fails ends the subscription here,
          // rather than after three weeks of retries. Read from our own
          // row and after the mirror above, so `first_payment_at`
          // reflects everything Stripe has told us: unset means this
          // subscription has never once been paid for, and there is
          // nothing for dunning to recover.
          if (event.type === "invoice.payment_failed" && invoice.customer) {
            const { data: row } = await supabase
              .from("subscriptions" as never)
              .select("first_payment_at")
              .eq("stripe_subscription_id" as never, subscriptionId as never)
              .maybeSingle()
            const everPaid = (row as { first_payment_at?: string | null } | null)?.first_payment_at
            if (!everPaid) {
              await cancelUnpaidFirstPeriod(invoice.customer, subscriptionId)
              // No mail from here. The cancellation above fires
              // customer.subscription.deleted, and that branch sends
              // Back to Free — after the credits have been swept, so it
              // can say how many projects actually came off the page.
              // Sending here would be a forecast of its own side
              // effects, and would arrive twice.
            } else if (invoice.attempt_count === 1 && subscription.metadata?.company_id) {
              // A renewal, and only on the FIRST refusal. Stripe fires
              // this event on every retry in the schedule; one mail per
              // attempt would turn a recoverable card problem into four
              // identical warnings, which is how people learn to ignore
              // the fourth.
              await notifySubscriber(subscription.metadata.company_id, "payment-failed", {
                amount_cents: invoice.amount_due,
                next_attempt_at: invoice.next_payment_attempt
                  ? new Date(invoice.next_payment_attempt * 1000).toISOString()
                  : null,
              })
            }
          }
        }
        break
      }

      default:
        // Subscribed to more than we act on: an unhandled type is still
        // a delivered one, and 200 stops Stripe retrying it forever.
        break
    }

    await supabase
      .from("stripe_events" as never)
      .update({ processed_at: new Date().toISOString() } as never)
      .eq("id", event.id)

    return NextResponse.json({ received: true })
  } catch (err) {
    // Release the claim so Stripe's retry can have another go — an
    // event that failed halfway must not look handled.
    await supabase.from("stripe_events" as never).delete().eq("id", event.id)
    logger.error("Stripe webhook handler failed", { eventId: event.id, type: event.type }, err as Error)
    return NextResponse.json({ error: "handler_failed" }, { status: 500 })
  }
}
