import "server-only"

import { logger } from "@/lib/logger"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { stripeGet } from "@/lib/stripe/rest"
import { getSubscriptionRecipient } from "@/lib/subscriptions/notify"
import { foundingEndsAt } from "@/app/dashboard/subscription/checkout/constants"
import type { EmailTemplate, EmailVariables } from "@/lib/email-service"

/**
 * The subscription mails that belong to a date rather than an event.
 *
 * Three of the six warn about something that has not happened yet — a
 * yearly renewal, a founding period running out, a card about to
 * expire — so there is no webhook to hang them on. They go in
 * email_drip_queue, which already has a cron walking it, a
 * sent/cancelled ledger, and a dispatcher that resolves templates by
 * name. Building a second scheduler beside it would mean two things to
 * check when a mail fails to arrive.
 *
 * All three are scheduled FOURTEEN DAYS OUT, and that number is real
 * work: it is long enough to move money or change a card before the
 * debit, and short enough that the reader still remembers getting the
 * mail when it lands.
 */

const WARNING_DAYS = 14

/** The warning date for something happening on `when`. Null when that
 *  moment is already past — a reminder about a date that has gone is
 *  worse than none. */
function warningSlot(when: Date | null): string | null {
  if (!when) return null
  const slot = new Date(when.getTime() - WARNING_DAYS * 24 * 60 * 60 * 1000)
  return slot.getTime() > Date.now() ? slot.toISOString() : null
}

/**
 * Put one future mail on the queue, replacing whatever was there.
 *
 * Replacing matters. A yearly subscriber gets this reminder once every
 * year from the same row, and a founding member who claims, subscribes
 * and cancels would otherwise keep a warning about a period that no
 * longer applies. One row per company per sequence, always describing
 * the next thing that will happen.
 *
 * Non-fatal throughout: every caller is doing something more important
 * than scheduling a mail.
 */
async function scheduleOnce(
  companyId: string,
  template: EmailTemplate,
  sequence: string,
  sendAt: string | null,
  variables: EmailVariables = {},
): Promise<void> {
  try {
    const supabase = createServiceRoleSupabaseClient()

    // Clear first, so "no longer applicable" is expressible by calling
    // this with a null date.
    //
    // Including rows already sent, which is not the obvious choice and
    // is the one that matters. Migration 120 put a unique index on
    // (company_id, template), so a yearly subscriber whose reminder
    // went out last March would collide on the insert for this March —
    // and the reminder would have fired exactly once, in the first
    // year, with the failure buried in a log line. These rows are work
    // to be done, not a record of what was done; the record lives in
    // email_events.
    await (supabase.from("email_drip_queue") as any)
      .delete()
      .eq("company_id", companyId)
      .eq("sequence", sequence)

    if (!sendAt) return

    const recipient = await getSubscriptionRecipient(companyId)
    if (!recipient) {
      logger.error("No recipient to schedule a subscription mail for", { companyId, sequence })
      return
    }

    await (supabase.from("email_drip_queue") as any).insert({
      email: recipient.email,
      user_id: recipient.userId,
      company_id: companyId,
      template,
      sequence,
      send_at: sendAt,
      variables,
    })

    logger.info("Scheduled a subscription mail", { companyId, sequence, sendAt })
  } catch (err) {
    logger.error("Could not schedule a subscription mail", { companyId, sequence }, err as Error)
  }
}

/**
 * Warn a yearly subscriber before the money moves.
 *
 * Yearly only, and that is the whole point. A monthly charge is a
 * rhythm people recognise on a bank statement; a €566 debit eleven
 * months after the decision is the one nobody places, and an
 * unrecognised debit is how a chargeback starts.
 *
 * Re-run on every subscription event, so a switch from monthly to
 * yearly schedules it, a switch back clears it, and each renewal moves
 * it to the next period end.
 */
export async function scheduleRenewalReminder(
  companyId: string,
  interval: string | null | undefined,
  currentPeriodEnd: string | null | undefined,
  amountCents: number | null | undefined,
  stillAlive: boolean,
): Promise<void> {
  const renewsAt = interval === "year" && stillAlive && currentPeriodEnd
    ? new Date(currentPeriodEnd)
    : null

  await scheduleOnce(
    companyId,
    "renewal-reminder",
    "subscription-renewal",
    warningSlot(renewsAt && !Number.isNaN(renewsAt.getTime()) ? renewsAt : null),
    {
      renewal_at: currentPeriodEnd ?? null,
      amount_cents: amountCents ?? null,
    },
  )
}

/**
 * Warn a founding member before the give-away ends.
 *
 * The end date is derived from the claim by the same helper the banner
 * uses, so the mail cannot name a different day than the screen. That
 * was the risk worth designing out: this mail's entire job is to say
 * when, and a `when` that disagrees with the dashboard makes both
 * suspect.
 */
export async function scheduleFoundingEnding(
  companyId: string,
  claimedAt: string | null | undefined,
  priceCents: number,
): Promise<void> {
  const endsAt = foundingEndsAt(claimedAt)
  await scheduleOnce(
    companyId,
    "founding-ending",
    "founding",
    warningSlot(endsAt),
    {
      end_at: endsAt?.toISOString() ?? null,
      price_cents: priceCents,
    },
  )
}

/**
 * Warn before the card on file stops working.
 *
 * The only mail here that prevents its own bad news. Everything else
 * in this set reports something that already happened; a card expiry
 * is known months ahead, by us, and letting it run out is a failure we
 * chose not to avoid.
 *
 * Cards only. A SEPA mandate carries no expiry date — it ends when the
 * account holder revokes it, and nothing tells us that until a debit
 * comes back. iDEAL and bank debits therefore schedule nothing, which
 * is honest rather than a gap: there is no date to warn about.
 *
 * Stripe's dashboard can send its own version of this. Ours says what
 * happens to the page, which is the part a company acts on — the
 * generic one names a card and leaves the consequence to the
 * imagination.
 */
export async function scheduleCardExpiry(
  companyId: string,
  paymentMethodId: string | null | undefined,
  stillAlive: boolean,
): Promise<void> {
  if (!paymentMethodId || !stillAlive) {
    await scheduleOnce(companyId, "payment-method-expiring", "card-expiry", null)
    return
  }

  let card: { exp_month?: number; exp_year?: number; last4?: string } | null = null
  try {
    const method = await stripeGet<{
      type?: string
      card?: { exp_month?: number; exp_year?: number; last4?: string } | null
    }>(`/payment_methods/${paymentMethodId}`)
    card = method.type === "card" ? method.card ?? null : null
  } catch (err) {
    logger.warn("Could not read a payment method to schedule its expiry warning", {
      companyId, error: String(err),
    })
    return
  }

  if (!card?.exp_month || !card.exp_year) {
    // Not a card, or a card without an expiry we can read. Clear any
    // warning left over from a card they replaced with a mandate.
    await scheduleOnce(companyId, "payment-method-expiring", "card-expiry", null)
    return
  }

  // A card is valid through the END of its expiry month, so the moment
  // it stops working is the first instant of the next one.
  const dies = new Date(Date.UTC(card.exp_year, card.exp_month, 1))

  await scheduleOnce(
    companyId,
    "payment-method-expiring",
    "card-expiry",
    warningSlot(dies),
    { exp_month: card.exp_month, exp_year: card.exp_year, last4: card.last4 ?? null },
  )
}

/**
 * Drop the founding warning, because they bought.
 *
 * A founding member who subscribes still has a founding period that
 * runs out, so the row stays true about the date and false about
 * everything that matters: it would tell a paying customer their page
 * is about to go back to the free plan, and offer to sell them what
 * they just bought.
 *
 * Called from the webhook rather than the checkout, so it also covers
 * a subscription that started anywhere else.
 */
export async function cancelFoundingEnding(companyId: string): Promise<void> {
  await scheduleOnce(companyId, "founding-ending", "founding", null)
}
