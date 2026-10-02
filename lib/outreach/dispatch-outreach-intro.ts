import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { EmailTemplate } from "@/lib/email-service"

/**
 * Dispatch the Outreach intro email + enqueue the rest of the sequence.
 *
 * Mirrors the existing prospect-* dispatcher (sendProspectEmailAction)
 * for the new Apollo-source / cold-outreach flow:
 *
 *   Day 0  → outreach-intro   enqueued in email_drip_queue
 *   Day 3  → outreach-followup enqueued in email_drip_queue
 *   Day 10 → outreach-final    enqueued in email_drip_queue
 *
 * All three go through the queue, so all three land in the 09:00–15:00
 * Amsterdam window. The intro used to fire straight through Resend,
 * which put the send time at the mercy of whatever enrolled the
 * prospect.
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

/** Day 0 — "the next free slot in today's window", not "immediately".
 *  nextBusinessSlot(0) already means today when today still has window
 *  left, and the next business morning when it does not. */
const INTRO_DAYS = 0
const FOLLOWUP_DAYS = 3
const FINAL_DAYS = 10

export async function dispatchOutreachIntro(
  supabase: SupabaseClient<any, any, any>,
  args: DispatchOutreachIntroArgs,
): Promise<DispatchOutreachIntroResult> {
  const { email, firstName, companyName, companyId, refUrl } = args

  // Asked HERE now that the intro is scheduled rather than sent. It used
  // to be answered inside sendTransactionalEmail on the way out, which
  // is still where it protects the recipient — this one stops us
  // enrolling someone who already said no, and lets the caller tell the
  // admin so instead of leaving three rows to be skipped silently.
  const { isOptedOutOfMarketing } = await import("@/lib/email/opt-out")
  if (await isOptedOutOfMarketing(email, null)) {
    return { success: true, warning: "Recipient is opted out — sequence not scheduled." }
  }

  // The CTA is the claim funnel: mint a token when the prospect has a
  // companies row (channel resolved from live data), else land on the
  // tokenless platform funnel. An explicitly passed refUrl still wins.
  let claimRef = refUrl ?? null
  if (!claimRef) {
    try {
      if (companyId) {
        const { resolveClaimChannel } = await import("@/lib/claim/resolve-channel")
        const { issueClaimToken } = await import("@/lib/claim/claim-token")
        const resolved = await resolveClaimChannel(companyId)
        const issued = await issueClaimToken({
          companyId,
          creditId: resolved.channel === "invite" ? resolved.creditId : null,
          email: email.toLowerCase(),
          channel: resolved.channel,
        })
        claimRef = issued.url
      } else {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.arcolist.com"
        claimRef = `${siteUrl}/claim`
      }
    } catch (err) {
      console.error("[dispatch-outreach-intro] claim token mint failed, using template fallback", err)
    }
  }

  const variables = {
    firstname: firstName,
    company_name: companyName,
    ...(claimRef ? { ref_url: claimRef } : {}),
    email,
  }

  // Enqueue all three steps, intro included. Sequence label 'outreach'
  // lets the drip cron + cancellation hooks recognise this as one
  // logical series. nextBusinessSlot skips weekends so a Friday intro
  // schedules the followup for Wednesday, not Monday; claimSequenceSlots
  // then picks free slots inside the day's window so the steps don't
  // collide with other sends already scheduled at 09:00 sharp.
  //
  // THE INTRO USED TO FIRE HERE, straight through Resend. That made the
  // send time whatever time something happened to enrol the prospect —
  // for this series, the releaser cron's hours, which are UTC and so
  // ran to 17:00 Amsterdam in summer. 416 of 1,313 outreach intros
  // landed outside the 09:00–15:00 window; not one follow-up did.
  //
  // nextBusinessSlot(0) is "the next valid slot from now": inside the
  // window that is within minutes, outside it the next business
  // morning. So nothing is delayed that needn't be.
  const { nextBusinessSlot } = await import("@/lib/date-utils")
  const { claimSequenceSlots } = await import("@/lib/drip-queue")
  // Claimed together so the steps can never be compressed onto one
  // day when the queue is under pressure — see claimSequenceSlots.
  const [introSlot, followupSlot, finalSlot] = await claimSequenceSlots(supabase, [
    nextBusinessSlot(INTRO_DAYS),
    nextBusinessSlot(FOLLOWUP_DAYS),
    nextBusinessSlot(FINAL_DAYS),
  ])
  const stepConfig = [
    { template: "outreach-intro" as const satisfies EmailTemplate, step: 0, sendAt: introSlot.toISOString() },
    { template: "outreach-followup" as const, step: 1, sendAt: followupSlot.toISOString() },
    { template: "outreach-final" as const, step: 2, sendAt: finalSlot.toISOString() },
  ]

  let introQueued = false
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
    const code = (insertError as { code?: string } | null)?.code
    // 23505 = unique violation. Means a pending row for this
    // (recipient, template) already exists from a previous enrollment.
    // Not a failure — the cron will pick up whichever row's send_at is
    // sooner, and the contact is enrolled either way. Keyed per CONTACT
    // since migration 273; it used to be per company, which dropped
    // every colleague after the first.
    if (!insertError || code === "23505") {
      if (step === 0) introQueued = true
      continue
    }
    console.error("[dispatch-outreach-intro] enqueue failed", { template, insertError })
  }

  // The intro IS the sequence now. Reporting success with nothing
  // scheduled is what left contacts sitting at sequence_status='active'
  // having never been mailed — the caller flips them to active on this
  // return value, so it has to be the truth.
  if (!introQueued) {
    return { success: false, error: "Could not schedule the outreach intro" }
  }

  return { success: true }
}
