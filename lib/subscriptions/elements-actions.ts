"use server"

import { headers } from "next/headers"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { priceId, taxRateId, isStripeConfigured, stripeGet, stripePost } from "@/lib/stripe/rest"
import { mirrorSubscription, type StripeSubscription } from "@/lib/subscriptions/mirror"
import { ensureCustomer, resolveOwnedCompany } from "@/lib/subscriptions/owned-company"

/**
 * The Elements checkout: mandate first, subscription second.
 *
 * Stripe settles this order for us. A subscription created with
 * `payment_behavior: default_incomplete` refuses iDEAL outright —
 * "`ideal` can't be used with subscriptions that have collection_method
 * set to charge_automatically" — and iDEAL cannot be added to an
 * invoice's PaymentIntent afterwards either. A SetupIntent takes it
 * happily, and for a Dutch buyer iDEAL is the method that matters.
 *
 * So: collect a payment method, then build the subscription on it. Two
 * things fall out of that which are worth more than the convenience of
 * a single call. iDEAL produces a SEPA mandate, so the first payment is
 * a bank redirect and every renewal after it is a €0,35 direct debit.
 * And no subscription exists until there is something to charge, so an
 * abandoned form cannot leave an `incomplete` row sitting where a
 * working subscription should be.
 */

type Failure = {
  error:
    | "not_signed_in" | "no_company" | "not_owner" | "not_configured"
    | "failed" | "not_ready" | "already_subscribed" | "nothing_to_replace" | "no_saved_method"
    | "nothing_to_switch" | "same_interval"
}

/** Statuses that mean the company is already paying, or owes us. */
const LIVE_STATUSES = ["active", "trialing", "past_due", "unpaid"]

/**
 * Whether this company already has a subscription worth protecting.
 *
 * Nothing stopped a second one before, so a reader who pressed twice —
 * or came back to a tab — got charged twice. Keyed on the company
 * rather than the Stripe customer, because a customer is created per
 * attempt until the first subscription pins one down.
 */
async function hasLiveSubscription(companyId: string): Promise<boolean> {
  const { data } = await createServiceRoleSupabaseClient()
    .from("subscriptions" as never)
    .select("status")
    .eq("company_id", companyId)
    .maybeSingle()

  const status = (data as { status?: string } | null)?.status
  return Boolean(status && LIVE_STATUSES.includes(status))
}

export type ElementsMethod = "ideal" | "sepa" | "card"

const STRIPE_METHOD: Record<ElementsMethod, string> = {
  ideal: "ideal",
  sepa: "sepa_debit",
  card: "card",
}

/** Only a path on this site, so the return cannot be pointed elsewhere. */
function safeReturnPath(path: string | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/dashboard/subscription"
  return path
}

/**
 * Step one: a SetupIntent for the method the reader picked.
 *
 * One method per intent rather than all three at once — the element we
 * mount is chosen by our own cards, and an intent that offers methods
 * the page is not showing invites Stripe to render a chooser we already
 * drew ourselves.
 */
export async function startSetupAction(
  method: ElementsMethod,
  returnPath?: string,
  /** "subscribe" needs there to be no subscription yet; "replace"
   *  needs there to be one. Same mandate, opposite precondition. */
  purpose: "subscribe" | "replace" = "subscribe",
): Promise<{ clientSecret: string; returnUrl: string } | Failure> {
  if (!isStripeConfigured()) return { error: "not_configured" }

  const resolved = await resolveOwnedCompany()
  if ("error" in resolved) return { error: resolved.error }

  const live = await hasLiveSubscription(resolved.companyId)
  // Before any details are collected. Buying with a subscription in
  // place has nothing to buy; replacing a mandate without one has
  // nothing to replace. Either way, saying so now beats saying it
  // after someone has typed their IBAN.
  if (purpose === "subscribe" && live) return { error: "already_subscribed" }
  if (purpose === "replace" && !live) return { error: "nothing_to_replace" }

  try {
    const customerId = await ensureCustomer(resolved.companyId, resolved.companyName, resolved.email)
    const origin = (await headers()).get("origin") ?? ""
    const back = safeReturnPath(returnPath)

    const intent = await stripePost<{ client_secret: string }>("/setup_intents", {
      customer: customerId,
      payment_method_types: [STRIPE_METHOD[method]],
      // The whole point: this mandate is used again, months from now,
      // without the reader present.
      usage: "off_session",
      metadata: { company_id: resolved.companyId },
    })

    return {
      clientSecret: intent.client_secret,
      // iDEAL leaves the page entirely and comes back here; card and
      // SEPA finish in place but Stripe still wants somewhere to land.
      returnUrl: `${origin}${back}${back.includes("?") ? "&" : "?"}setup=1`,
    }
  } catch (err) {
    logger.error("Stripe setup intent failed", { companyId: resolved.companyId, method }, err as Error)
    return { error: "failed" }
  }
}

/**
 * Step two: build the subscription on the mandate that was just given.
 *
 * Deliberately not `error_if_incomplete`. A SEPA debit is days in
 * transit — it reports `processing`, not `succeeded` — and treating
 * that as a failure would reject the method we most want people on.
 * The status comes back instead, and the page says what is true.
 */
export async function completeSubscriptionAction(
  setupIntentId: string,
  interval: "month" | "year",
): Promise<{ status: string } | Failure> {
  if (!isStripeConfigured()) return { error: "not_configured" }
  if (!/^seti_[A-Za-z0-9_]+$/.test(setupIntentId)) return { error: "failed" }

  const resolved = await resolveOwnedCompany()
  if ("error" in resolved) return { error: resolved.error }

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

    // Written here rather than waiting for the webhook: the reader is
    // looking at the page now. The webhook confirms the same row later.
    await mirrorSubscription(createServiceRoleSupabaseClient(), subscription)

    return { status: subscription.status }
  } catch (err) {
    logger.error("Subscription creation after setup failed", { companyId: resolved.companyId }, err as Error)
    return { error: "failed" }
  }
}

/**
 * Point a running subscription at a new mandate, and let go of the old.
 *
 * The detach is not housekeeping. Stripe's portal drops the previous
 * method when you change it; doing this ourselves means we own that
 * too, and without it the customer collects a payment method per
 * change — three identical SEPA entries showed up in the sandbox from
 * three attempts alone.
 */
export async function replacePaymentMethodAction(setupIntentId: string): Promise<{ ok: true } | Failure> {
  if (!isStripeConfigured()) return { error: "not_configured" }
  if (!/^seti_[A-Za-z0-9_]+$/.test(setupIntentId)) return { error: "failed" }

  const resolved = await resolveOwnedCompany()
  if ("error" in resolved) return { error: resolved.error }

  const service = createServiceRoleSupabaseClient()
  const { data: row } = await service
    .from("subscriptions" as never)
    .select("stripe_subscription_id, stripe_customer_id")
    .eq("company_id", resolved.companyId)
    .maybeSingle()

  const mirrored = row as { stripe_subscription_id?: string; stripe_customer_id?: string } | null
  if (!mirrored?.stripe_subscription_id) return { error: "nothing_to_replace" }

  try {
    const intent = await stripeGet<{
      status?: string
      payment_method?: string | null
      customer?: string | null
      metadata?: Record<string, string> | null
    }>(`/setup_intents/${setupIntentId}`)

    if (intent.metadata?.company_id !== resolved.companyId) return { error: "failed" }
    if (intent.status !== "succeeded" || !intent.payment_method) return { error: "not_ready" }
    // A mandate given on one customer cannot be charged on another.
    if (intent.customer !== mirrored.stripe_customer_id) return { error: "failed" }

    const before = await stripeGet<{ default_payment_method?: string | null }>(
      `/subscriptions/${mirrored.stripe_subscription_id}`,
    )

    const subscription = await stripePost<StripeSubscription & { status: string }>(
      `/subscriptions/${mirrored.stripe_subscription_id}`,
      { default_payment_method: intent.payment_method },
    )

    // Only once the subscription is safely on the new one.
    const previous = before.default_payment_method
    if (previous && previous !== intent.payment_method) {
      try {
        await stripePost(`/payment_methods/${previous}/detach`, {})
      } catch (err) {
        // A stranded old method is untidy, not broken: the charge will
        // go to the new one either way.
        logger.error("Could not detach the replaced payment method", { previous }, err as Error)
      }
    }

    // A method swapped during dunning is only half the repair. Stripe
    // would retry on its own schedule, which can be days; the reader
    // just fixed the thing and expects it settled. Best-effort, because
    // a retry that fails must not undo a mandate that worked.
    if (["past_due", "unpaid"].includes(subscription.status)) {
      try {
        const invoices = await stripeGet<{ data: { id: string; status: string }[] }>("/invoices", {
          subscription: mirrored.stripe_subscription_id,
          status: "open",
          limit: 1,
        })
        const open = invoices.data?.[0]
        if (open) {
          const paid = await stripePost<StripeSubscription & { status: string }>(
            `/invoices/${open.id}/pay`,
            {},
          )
          logger.info("Retried an open invoice after a payment method change", {
            invoiceId: open.id,
            result: (paid as unknown as { status?: string }).status,
          })
          const refreshed = await stripeGet<StripeSubscription & { status: string }>(
            `/subscriptions/${mirrored.stripe_subscription_id}`,
          )
          await mirrorSubscription(service, refreshed)
          return { ok: true }
        }
      } catch (err) {
        logger.error("Could not retry the open invoice", { companyId: resolved.companyId }, err as Error)
      }
    }

    await mirrorSubscription(service, subscription)
    return { ok: true }
  } catch (err) {
    logger.error("Replacing the payment method failed", { companyId: resolved.companyId }, err as Error)
    return { error: "failed" }
  }
}

/**
 * Subscribe on a mandate the customer already gave us.
 *
 * Cancelling a subscription does not revoke a payment method, so a
 * company that paid before is still authorised. Asking them to hand
 * over an IBAN they already gave is work for nothing — and the one
 * moment you least want to add friction is someone deciding to come
 * back.
 *
 * No SetupIntent, therefore no confirmation step and no redirect: the
 * subscription is created directly on the stored method.
 */
export async function subscribeWithSavedMethodAction(
  interval: "month" | "year",
): Promise<{ status: string } | Failure> {
  if (!isStripeConfigured()) return { error: "not_configured" }

  const resolved = await resolveOwnedCompany()
  if ("error" in resolved) return { error: resolved.error }
  if (await hasLiveSubscription(resolved.companyId)) return { error: "already_subscribed" }

  const service = createServiceRoleSupabaseClient()
  const { data: row } = await service
    .from("subscriptions" as never)
    .select("stripe_customer_id")
    .eq("company_id", resolved.companyId)
    .maybeSingle()

  // The customer survives the subscription; without one there was never
  // a mandate to reuse.
  const customerId = (row as { stripe_customer_id?: string } | null)?.stripe_customer_id
  if (!customerId) return { error: "no_saved_method" }

  try {
    const methods = await stripeGet<{ data: { id: string }[] }>("/payment_methods", {
      customer: customerId,
      limit: 1,
    })
    const paymentMethod = methods.data?.[0]?.id
    if (!paymentMethod) return { error: "no_saved_method" }

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
      default_payment_method: paymentMethod,
      metadata: { company_id: resolved.companyId },
      expand: ["items.data.price"],
    })

    await mirrorSubscription(service, subscription)
    return { status: subscription.status }
  } catch (err) {
    logger.error("Subscribing on a saved method failed", { companyId: resolved.companyId }, err as Error)
    return { error: "failed" }
  }
}

/** The subscription and the item on it, which a price change addresses. */
async function liveSubscriptionItem(companyId: string) {
  const { data: row } = await createServiceRoleSupabaseClient()
    .from("subscriptions" as never)
    .select("stripe_subscription_id")
    .eq("company_id", companyId)
    .maybeSingle()

  const id = (row as { stripe_subscription_id?: string } | null)?.stripe_subscription_id
  if (!id) return null

  const subscription = await stripeGet<{
    status: string
    items: { data: { id: string; price: { id: string; recurring?: { interval?: string } | null } }[] }
  }>(`/subscriptions/${id}`)

  if (!LIVE_STATUSES.includes(subscription.status)) return null

  const item = subscription.items?.data?.[0]
  if (!item) return null

  return { subscriptionId: id, itemId: item.id, interval: item.price?.recurring?.interval ?? null }
}

/**
 * What switching to the other billing cycle costs today.
 *
 * Asked before anything changes, because a switch mid-period is not
 * free: Stripe credits the unused part of the running cycle and charges
 * the new one. A button that moves a few hundred euro has to say so
 * first — "overstappen" is not a word that prepares anyone for that.
 */
export type SwitchPreview = {
  /** The new cycle's charge for the remaining time, before tax. */
  newAmount: number
  /** Credit for the part of the running period already paid, negative. */
  credit: number
  /** Whatever the total adds on top of the subtotal. */
  tax: number
  /** What Stripe will actually collect. */
  amountDue: number
  /** True when nothing happens today: the change lands at renewal. */
  atPeriodEnd?: boolean
}

export async function previewIntervalSwitchAction(
  interval: "month" | "year",
): Promise<SwitchPreview | Failure> {
  if (!isStripeConfigured()) return { error: "not_configured" }

  const resolved = await resolveOwnedCompany()
  if ("error" in resolved) return { error: resolved.error }

  try {
    const current = await liveSubscriptionItem(resolved.companyId)
    if (!current) return { error: "nothing_to_switch" }
    if (current.interval === interval) return { error: "same_interval" }

    // Downgrading moves no money: the year is paid for and stays paid
    // for. Prorating it instead would credit most of the year against
    // one month, leave a balance sitting on the customer, and report
    // "€ 0,00 te voldoen" — technically right and completely
    // uninformative.
    if (current.interval === "year" && interval === "month") {
      return { newAmount: 0, credit: 0, tax: 0, amountDue: 0, atPeriodEnd: true }
    }

    const preview = await stripePost<{
      amount_due?: number
      subtotal?: number
      total?: number
      lines?: { data: { amount: number }[] }
    }>("/invoices/create_preview", {
      subscription: current.subscriptionId,
      subscription_details: {
        items: [{ id: current.itemId, price: priceId(interval) }],
        proration_behavior: "create_prorations",
      },
    })

    // A proration comes back as two lines: what the new cycle costs for
    // the time remaining, and a credit for the part of the old one
    // already paid. Split by sign rather than by position, which is not
    // guaranteed. Tax is the difference between subtotal and total, so
    // it holds whichever shape the API version reports it in.
    const lines = preview.lines?.data ?? []
    const newAmount = lines.filter((l) => l.amount > 0).reduce((sum, l) => sum + l.amount, 0)
    const credit = lines.filter((l) => l.amount < 0).reduce((sum, l) => sum + l.amount, 0)
    const subtotal = preview.subtotal ?? newAmount + credit
    const total = preview.total ?? subtotal

    return {
      newAmount,
      credit,
      tax: total - subtotal,
      amountDue: preview.amount_due ?? total,
      atPeriodEnd: false,
    }
  } catch (err) {
    logger.error("Could not preview an interval switch", { companyId: resolved.companyId, interval }, err as Error)
    return { error: "failed" }
  }
}

/**
 * Move a running subscription to the other billing cycle.
 *
 * Immediately, with proration: the unused part of the current period is
 * credited and the new one charged now. The alternative — switching at
 * renewal — means holding a promise for a month and explaining a delay
 * to someone who just pressed a button. No mandate is collected: the
 * one already on the subscription pays for it.
 */
export async function switchIntervalAction(
  interval: "month" | "year",
): Promise<{ status: string } | Failure> {
  if (!isStripeConfigured()) return { error: "not_configured" }

  const resolved = await resolveOwnedCompany()
  if ("error" in resolved) return { error: resolved.error }

  try {
    const current = await liveSubscriptionItem(resolved.companyId)
    if (!current) return { error: "nothing_to_switch" }
    if (current.interval === interval) return { error: "same_interval" }

    const downgrading = current.interval === "year" && interval === "month"

    if (downgrading) {
      // Not a price change. Changing the price on the subscription moves
      // the billing cycle with it, whatever proration_behavior says —
      // a paid year became a month and invoiced immediately. Deferring
      // to the end of a period is what a schedule is for: phase one is
      // the year already bought, untouched, and phase two picks up the
      // monthly price the day it expires. `release` hands the
      // subscription back afterwards so it simply carries on.
      const schedule = await stripePost<{
        id: string
        phases: { start_date: number; end_date: number; items: { price: string }[] }[]
      }>("/subscription_schedules", { from_subscription: current.subscriptionId })

      const phase = schedule.phases[0]
      await stripePost(`/subscription_schedules/${schedule.id}`, {
        end_behavior: "release",
        phases: [
          {
            // Echoed back verbatim: an update replaces every phase, so
            // anything left out here is dropped — the tax rate included.
            items: [{ price: phase.items[0].price, quantity: 1 }],
            default_tax_rates: [taxRateId()],
            start_date: phase.start_date,
            end_date: phase.end_date,
          },
          {
            items: [{ price: priceId("month"), quantity: 1 }],
            default_tax_rates: [taxRateId()],
            proration_behavior: "none",
          },
        ],
      })

      // The subscription itself is unchanged, which is the point: it
      // still reads as the yearly plan it is until the day it is not.
      const unchanged = await stripeGet<StripeSubscription & { status: string }>(
        `/subscriptions/${current.subscriptionId}`,
      )
      await mirrorSubscription(createServiceRoleSupabaseClient(), unchanged)
      return { status: unchanged.status }
    }

    // Upgrading is the opposite case: they want the cheaper rate now,
    // so the difference is settled now.
    const subscription = await stripePost<StripeSubscription & { status: string }>(
      `/subscriptions/${current.subscriptionId}`,
      {
        items: [{ id: current.itemId, price: priceId("year") }],
        proration_behavior: "create_prorations",
        expand: ["items.data.price"],
      },
    )

    await mirrorSubscription(createServiceRoleSupabaseClient(), subscription)
    return { status: subscription.status }
  } catch (err) {
    logger.error("Switching the billing interval failed", { companyId: resolved.companyId, interval }, err as Error)
    return { error: "failed" }
  }
}
