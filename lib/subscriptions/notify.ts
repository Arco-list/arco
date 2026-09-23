import "server-only"

import { logger } from "@/lib/logger"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { getCompanyEmailRecipients } from "@/lib/companies/company-email-recipients"
import { sendTransactionalEmail, type EmailTemplate, type EmailVariables } from "@/lib/email-service"

/**
 * Sending the mails a subscription generates.
 *
 * Two questions this file answers once, so the callers do not each
 * answer them differently.
 *
 * WHO. Not `customer.email` — that is the invoice address, and it is
 * deliberately editable so it can point at a bookkeeper. A bookkeeper
 * does not need to hear that projects came off a page, and cannot act
 * on it. These go to the account owner, who is also the only person
 * the subscription actions will let change anything. Company mail
 * falls back to the team's mailing list only when there is no owner
 * left, because silence is the one outcome worse than a stray mail.
 *
 * WHETHER IT MAY FAIL. Always. A mail that does not send must never
 * take a webhook down with it — the webhook's job is to keep Stripe
 * and our tables in agreement, and Stripe retries a 500 by replaying
 * the whole event. A failed send would then re-run the cancellation,
 * the credit sweep and the invoice void on every retry, to deliver one
 * notification. So every function here swallows and logs.
 */

export type SubscriptionRecipient = {
  email: string
  /** Lets the mailer resolve the reader's own language. */
  userId: string | null
}

/**
 * The person a subscription's mail is addressed to.
 *
 * Owner first, by auth email. The fallback list is the same one the
 * rest of the company's transactional mail uses; its first entry is
 * the closest thing to an owner that is left.
 */
export async function getSubscriptionRecipient(
  companyId: string,
): Promise<SubscriptionRecipient | null> {
  const supabase = createServiceRoleSupabaseClient()

  const { data: company } = await supabase
    .from("companies")
    .select("owner_id, name")
    .eq("id", companyId)
    .maybeSingle()

  const ownerId = (company as { owner_id?: string | null } | null)?.owner_id
  if (ownerId) {
    const { data: owner } = await supabase.auth.admin.getUserById(ownerId)
    const email = owner?.user?.email?.trim().toLowerCase()
    if (email) return { email, userId: ownerId }
  }

  const fallback = await getCompanyEmailRecipients(companyId)
  return fallback[0] ?? null
}

/** The company's own name, for mails that say it out loud. */
async function companyName(companyId: string): Promise<string | null> {
  const supabase = createServiceRoleSupabaseClient()
  const { data } = await supabase
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .maybeSingle()
  return (data as { name?: string | null } | null)?.name ?? null
}

/**
 * Send one subscription mail, and never throw.
 *
 * Returns whether it went out, for callers that want to log it — not
 * for callers that want to branch on it. Nothing downstream of a
 * notification should depend on the notification.
 */
export async function notifySubscriber(
  companyId: string,
  template: EmailTemplate,
  vars: EmailVariables = {},
): Promise<boolean> {
  try {
    const recipient = await getSubscriptionRecipient(companyId)
    if (!recipient) {
      // Worth an error rather than a shrug: a paying company with
      // nobody to write to is a broken record, not a quiet edge case.
      logger.error("No recipient for a subscription mail", { companyId, template })
      return false
    }

    const name = vars.company_name ?? (await companyName(companyId))

    const result = await sendTransactionalEmail(
      recipient.email,
      template,
      { ...vars, company_name: name ?? undefined },
      { userId: recipient.userId, companyId },
    )

    if (!result.success) {
      logger.error("Subscription mail refused", {
        companyId, template, reason: result.message,
      })
      return false
    }
    logger.info("Subscription mail sent", { companyId, template })
    return true
  } catch (err) {
    logger.error("Subscription mail failed", { companyId, template }, err as Error)
    return false
  }
}
