"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { getSiteUrl } from "@/lib/utils"
import { logger } from "@/lib/logger"
import { priceId, taxRateId, isStripeConfigured, stripeGet, stripePost } from "@/lib/stripe/rest"
import { mirrorSubscriptionById } from "@/lib/subscriptions/mirror"
import { ensureCustomer, resolveOwnedCompany } from "@/lib/subscriptions/owned-company"

type Failure = {
  error: "not_signed_in" | "no_company" | "not_owner" | "not_configured" | "nothing_to_manage" | "stale" | "failed"
}

/** The portal is still a place you go. */
type Result = { url: string } | Failure

/** Checkout is not: it mounts on our own page, so what comes back is
 *  the secret that lets the browser draw it. */
type CheckoutResult = { clientSecret: string } | Failure

/** And a cancel is neither — it changes a field and stays put. */
type ToggleResult = { ok: true } | Failure

export type CheckoutOutcome = "paid" | "processing" | "open" | "unknown"

/**
 * A return path is a path on this site and nothing else. Checkout hands
 * the value straight back to the browser, so an unchecked one would let
 * anything that can link to the checkout page choose where a paying
 * customer lands afterwards.
 */
function safeReturnPath(path: string | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/dashboard/subscription"
  return path
}

/**
 * Start a Checkout session for Pro.
 *
 * SEPA first, card second: direct debit costs €0,35 flat against 2,8%
 * on a business card, and it is the method we want people on. Checkout
 * collects the mandate itself, which is the step a hand-rolled flow got
 * wrong in the sandbox.
 *
 * The session is embedded, so this returns a client secret rather than
 * a URL: the form is Stripe's, the page around it is ours.
 */
export async function startCheckoutAction(
  interval: "month" | "year",
  returnPath?: string,
): Promise<CheckoutResult> {
  if (!isStripeConfigured()) return { error: "not_configured" }

  const resolved = await resolveOwnedCompany()
  if ("error" in resolved) return { error: resolved.error }

  try {
    const customerId = await ensureCustomer(resolved.companyId, resolved.companyName, resolved.email)
    const origin = (await headers()).get("origin") ?? getSiteUrl()

    const back = safeReturnPath(returnPath)

    const session = await stripePost<{ client_secret: string }>("/checkout/sessions", {
      // Mounted in our own page rather than hosted on Stripe's: the
      // form is identical, but nobody has to leave arcolist.com to
      // hand over a mandate.
      ui_mode: "embedded",
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId(interval), quantity: 1 }],
      // iDEAL first: for a Dutch buyer it is the method they recognise,
      // and for a subscription it sets up a SEPA mandate — so the first
      // payment costs one iDEAL fee and every renewal after it is a
      // €0,35 direct debit. Listing the types explicitly means the
      // dashboard's own toggles cannot quietly change the offer.
      payment_method_types: ["ideal", "sepa_debit", "card"],
      // Company purchase: the invoice needs a VAT number and an address
      // the buyer's bookkeeper will accept.
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      // Required whenever an existing customer is handed to Checkout
      // with address or VAT collection on: without it Stripe refuses
      // the session rather than silently dropping what it collected,
      // because it has nowhere to write the name and address back to.
      customer_update: { name: "auto", address: "auto" },
      // The founding-period trial rides on this: a 100%-off coupon for
      // N months is a promotion code the reader types at checkout, so
      // the trial runs through the same flow as a paid signup — mandate
      // and all — instead of a second, untested path.
      allow_promotion_codes: true,
      subscription_data: {
        default_tax_rates: [taxRateId()],
        metadata: { company_id: resolved.companyId },
      },
      // Checkout substitutes the real id for the placeholder when it
      // sends the reader back, and the page reads it: a return is not
      // the same thing as a payment, least of all over SEPA.
      return_url: `${origin}${back}${back.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
      // Stamped twice on purpose — here so the return can prove the
      // session belongs to the reader's company, and on the
      // subscription so the webhook can mirror it.
      metadata: { company_id: resolved.companyId },
      locale: "nl",
    })

    return { clientSecret: session.client_secret }
  } catch (err) {
    logger.error("Stripe checkout session failed", { companyId: resolved.companyId }, err as Error)
    return { error: "failed" }
  }
}

/**
 * What actually happened, read back from Stripe when Checkout returns.
 *
 * Landing on the return URL only means the reader finished the form.
 * A card charges there and then; a SEPA debit does not — it clears over
 * days and can still fail — so the page says "in behandeling" for one
 * and "gelukt" for the other instead of guessing.
 */
export async function checkoutStatusAction(sessionId: string): Promise<CheckoutOutcome> {
  if (!isStripeConfigured()) return "unknown"

  // The id goes into a URL path, so it is checked before it gets there.
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return "unknown"

  const resolved = await resolveOwnedCompany()
  if ("error" in resolved) return "unknown"

  try {
    const session = await stripeGet<{
      status?: string
      payment_status?: string
      subscription?: string | null
      metadata?: Record<string, string> | null
    }>(`/checkout/sessions/${sessionId}`)

    // Someone else's session id in the query string tells this reader
    // nothing about their own company.
    if (session.metadata?.company_id !== resolved.companyId) return "unknown"

    if (session.status !== "complete") return session.status === "open" ? "open" : "unknown"

    // The webhook is the primary path and usually wins the race. This
    // is the second one: a sandbox test showed a completed payment
    // leaving a company on Free because the event went to an endpoint
    // that did not exist. Both write the same row from the same Stripe
    // objects, so whichever arrives second changes nothing.
    if (session.subscription) await mirrorSubscriptionById(session.subscription)

    return session.payment_status === "paid" || session.payment_status === "no_payment_required"
      ? "paid"
      : "processing"
  } catch (err) {
    logger.error("Stripe checkout status lookup failed", { sessionId }, err as Error)
    return "unknown"
  }
}

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
