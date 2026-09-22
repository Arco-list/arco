import { NextRequest, NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "node:crypto"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { stripeGet } from "@/lib/stripe/rest"
import { mirrorSubscription, type StripeSubscription } from "@/lib/subscriptions/mirror"
import { subscribeFromSetupIntent } from "@/lib/subscriptions/subscribe-from-setup"
import {
  cancelUnpaidFirstPeriod,
  forgiveOutstandingInvoices,
  isNonpaymentCancellation,
  recordNonpaymentCancellation,
} from "@/lib/subscriptions/nonpayment"

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
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!secret) {
    logger.error("Stripe webhook called without STRIPE_WEBHOOK_SECRET set", {})
    return NextResponse.json({ error: "not_configured" }, { status: 500 })
  }

  const payload = await request.text()
  if (!verifySignature(payload, request.headers.get("stripe-signature"), secret)) {
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
        const subscription = event.data.object as unknown as StripeSubscription & {
          cancellation_details?: { reason?: string | null } | null
        }
        await mirrorSubscription(supabase, subscription)

        // Remembered after the mirror, so the row exists to look the
        // company up from, and only for Stripe's own cancellations —
        // somebody who chooses to leave has not done anything that
        // should follow them back.
        if (
          event.type === "customer.subscription.deleted" &&
          isNonpaymentCancellation(subscription.cancellation_details?.reason)
        ) {
          const companyId = subscription.metadata?.company_id
          if (companyId) await recordNonpaymentCancellation(supabase, companyId)
          // And forgive what it billed. Stripe's account setting has
          // already marked the invoice uncollectible by now, which is
          // the safe resting place if this never runs — but it reads as
          // a debt we gave up on, and we mean to withdraw it.
          if (subscription.customer) await forgiveOutstandingInvoices(subscription.customer)
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
        const invoice = event.data.object as { subscription?: string; customer?: string }
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
