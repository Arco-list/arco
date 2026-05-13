import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { EmailTemplate } from "@/lib/email-service"

/**
 * Dispatch the Outreach intro email + enqueue the rest of the sequence.
 *
 * Mirrors the existing prospect-* dispatcher (sendProspectEmailAction)
 * for the new Apollo-source / cold-outreach flow:
 *
 *   Day 0  → outreach-intro fires immediately via Resend
 *   Day 3  → outreach-followup enqueued in email_drip_queue
 *   Day 10 → outreach-final enqueued in email_drip_queue
 *
 * Variables threaded into all three: firstname, company_name, ref_url
 * (CTA URL with ?ref=<email> for landing-page attribution). The
 * outreach renderers in lib/email-service.ts read these directly.
 *
 * company_id is OPTIONAL — Apollo cold contacts often aren't linked
 * to a marketplace companies row yet (the domain might not match an
 * existing company). The drip queue accepts company_id=null; the
 * cancellation hooks key on email so unsubscribe / bounce / reply
 * still cancel pending rows correctly.
 */

export type DispatchOutreachIntroArgs = {
  email: string
  /** First name to address the recipient by — falls back to the
   *  email local part when the prospect has no contact_name. */
  firstName: string
  companyName: string
  /** Optional — null for Apollo contacts whose domain doesn't yet
   *  match a companies row. Cancellations key on email anyway. */
  companyId?: string | null
  /** Optional CTA URL override. When omitted the renderer falls back
   *  to the standard architects landing page with ?ref=<email>. */
  refUrl?: string | null
}

export type DispatchOutreachIntroResult = {
  success: boolean
  error?: string
  warning?: string
}

const FOLLOWUP_DAYS = 3
const FINAL_DAYS = 10

export async function dispatchOutreachIntro(
  supabase: SupabaseClient<any, any, any>,
  args: DispatchOutreachIntroArgs,
): Promise<DispatchOutreachIntroResult> {
  const { email, firstName, companyName, companyId, refUrl } = args

  const variables = {
    firstname: firstName,
    company_name: companyName,
    ...(refUrl ? { ref_url: refUrl } : {}),
    email,
  }

  // 1. Fire the intro via Resend. sendTransactionalEmail handles the
  //    isOptedOutOfMarketing gate (skips bounced/complained/unsubscribed
  //    recipients) + List-Unsubscribe headers + email_events logging.
  const { sendTransactionalEmail } = await import("@/lib/email-service")
  const introResult = await sendTransactionalEmail(
    email,
    "outreach-intro" satisfies EmailTemplate,
    variables,
    { companyId: companyId ?? undefined },
  )
  if (!introResult.success) {
    return { success: false, error: introResult.message ?? "outreach-intro send failed" }
  }
  // Skipped due to opt-out — surface as a warning so the caller can
  // bubble it to the admin without rolling back the prospect's
  // sequence state.
  if (introResult.message === "recipient opted out of marketing") {
    return { success: true, warning: "Recipient is opted out — drip not enqueued." }
  }

  // 2. Enqueue followup + final. Sequence label 'outreach' lets the
  //    drip cron + cancellation hooks recognise this as one logical
  //    series. nextBusinessSlot skips weekends so a Friday intro
  //    schedules the followup for Wednesday, not Monday;
  //    claimNextSendSlot then picks the next free 5-min slot in
  //    the day's window so the followup doesn't collide with other
  //    sends already scheduled at 09:00 sharp.
  const { nextBusinessSlot } = await import("@/lib/date-utils")
  const { claimNextSendSlot } = await import("@/lib/drip-queue")
  const stepConfig = [
    {
      template: "outreach-followup" as const,
      step: 1,
      sendAt: (await claimNextSendSlot(supabase, nextBusinessSlot(FOLLOWUP_DAYS))).toISOString(),
    },
    {
      template: "outreach-final" as const,
      step: 2,
      sendAt: (await claimNextSendSlot(supabase, nextBusinessSlot(FINAL_DAYS))).toISOString(),
    },
  ]

  for (const { template, step, sendAt } of stepConfig) {
    const { error: insertError } = await (supabase as any)
      .from("email_drip_queue")
      .insert({
        company_id: companyId ?? null,
        email,
        template,
        sequence: "outreach",
        step,
        variables,
        send_at: sendAt,
      })
    // 23505 = unique violation. Means a row for this (company, template)
    // already exists from a previous enrollment. Skip silently — the
    // cron will pick up whichever row's send_at is sooner.
    if (insertError && (insertError as { code?: string }).code !== "23505") {
      console.error("[dispatch-outreach-intro] enqueue failed", { template, insertError })
    }
  }

  return { success: true }
}
