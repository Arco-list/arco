import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { nextBusinessSlot } from "@/lib/date-utils"
import { logger } from "@/lib/logger"

/**
 * Enrol a contact into the Outreach drip without sending the intro
 * immediately. Mirrors `dispatchOutreachIntro` but enqueues all
 * three steps (intro + followup + final) into email_drip_queue
 * instead of firing the intro live.
 *
 * Why a separate path from dispatchOutreachIntro:
 *
 *   - dispatchOutreachIntro is the manual "Start sequence" path —
 *     admin clicks a button, intro fires now, so they get instant
 *     feedback that the send went out.
 *   - enrolOutreachContact is the bulk auto-enrol path used when
 *     Apollo's list sync brings in fresh contacts. We want all
 *     intro sends to land in the next-business-morning slot
 *     (nextBusinessSlot(0) clamps off-hours / weekend imports
 *     forward to Mon 09:00) so 50 imports done on Friday afternoon
 *     don't blast 50 emails at midnight.
 *
 * Status semantics:
 *   - sequence_status flips to 'active' immediately (the contact is
 *     enrolled even if the intro hasn't fired yet)
 *   - prospects.status stays 'prospect' — flips to 'contacted' only
 *     when the cron actually sends the intro (in process-drip-queue).
 *     This makes bounces / opt-outs actionable BEFORE first contact.
 */

export type EnrolOutreachArgs = {
  prospectId: string
  email: string
  firstName: string
  companyName: string
  companyId?: string | null
  refUrl?: string | null
  /** Apollo contact id of the imported contact — surfaced under the
   *  Sequence Enroled event metadata so the popup timeline shows
   *  "Source: Apollo / Contact ID / List ID" instead of the bare
   *  template_set + scheduled blob. */
  apolloContactId?: string | null
  apolloListId?: string | null
}

export type EnrolOutreachResult = {
  success: boolean
  error?: string
  /** Per-step send_at the cron will respect — handy for callers that
   *  want to log when the first touch is scheduled. */
  scheduled?: { intro: string; followup: string; final: string }
}

const FOLLOWUP_DAYS = 3
const FINAL_DAYS = 10

export async function enrolOutreachContact(
  supabase: SupabaseClient<any, any, any>,
  args: EnrolOutreachArgs,
): Promise<EnrolOutreachResult> {
  const { prospectId, email, firstName, companyName, companyId, refUrl, apolloContactId, apolloListId } = args

  const variables = {
    firstname: firstName,
    company_name: companyName,
    ...(refUrl ? { ref_url: refUrl } : {}),
    email,
  }

  const introAt = nextBusinessSlot(0).toISOString()
  const followupAt = nextBusinessSlot(FOLLOWUP_DAYS).toISOString()
  const finalAt = nextBusinessSlot(FINAL_DAYS).toISOString()

  const stepConfig = [
    { template: "outreach-intro", step: 0, sendAt: introAt },
    { template: "outreach-followup", step: 1, sendAt: followupAt },
    { template: "outreach-final", step: 2, sendAt: finalAt },
  ] as const

  let inserted = 0
  for (const { template, step, sendAt } of stepConfig) {
    const { error } = await (supabase as any)
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
    if (error && (error as { code?: string }).code !== "23505") {
      logger.error("[enrol-outreach] enqueue failed", { template, error })
      // Continue — partial enrolment beats nothing. The cron skips
      // missing rows; admin can re-enrol via Restart sequence later.
    } else if (!error) {
      inserted++
    }
  }

  if (inserted === 0) {
    return { success: false, error: "Failed to enqueue any drip rows" }
  }

  // Flip sequence_status now so the row shows as Active immediately
  // even though the intro hasn't fired yet. status stays 'prospect'
  // — flipped to 'contacted' by the drip cron on actual intro send.
  await (supabase as any)
    .from("prospects")
    .update({ sequence_status: "active", updated_at: new Date().toISOString() })
    .eq("id", prospectId)

  await supabase.from("prospect_events").insert({
    prospect_id: prospectId,
    event_type: "sequence_enroled",
    metadata: {
      // Capitalised so the popup timeline renders "Source: Apollo"
      // straight from the metadata without a value-side display map.
      source: "Apollo",
      ...(apolloContactId ? { apollo_contact_id: apolloContactId } : {}),
      ...(apolloListId ? { apollo_list_id: apolloListId } : {}),
      template_set: "outreach",
      scheduled: { intro: introAt, followup: followupAt, final: finalAt },
    },
  })

  return {
    success: true,
    scheduled: { intro: introAt, followup: followupAt, final: finalAt },
  }
}
