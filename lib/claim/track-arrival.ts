import "server-only"

import { logger } from "@/lib/logger"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { isLikelyMailScannerVisit, type ProspectVisitContext } from "@/lib/prospect-ref"

/**
 * Somebody opened the claim page.
 *
 * The Pro visitors step, written once for every channel. Invites,
 * Sales and the platform route all pass through here, so the funnel
 * finally compares like with like — before this, the step counted
 * PostHog sessions on /businesses while the rates under it divided by
 * server-side click logs.
 *
 * RECORDED BEFORE THE PAGE DECIDES WHAT TO SHOW. A consumed token, a
 * company a colleague already claimed, a context that will not load:
 * all of those are arrivals. What the page renders next answers a
 * different question.
 *
 * SCANNERS DO NOT COUNT. These links live in e-mail, and corporate
 * mail security opens every one of them from a datacenter. Same gate
 * the prospect and invite ledgers use — and it does not apply to the
 * platform route, which nobody was mailed.
 *
 * Never throws. A page must not fail because a counter did.
 */
export async function trackClaimArrival(input: {
  /** 'invite' | 'outreach' | 'showcase' from the token, 'platform' without one. */
  channel: string
  /** The address the token was issued to. Null for the platform route. */
  email?: string | null
  companyId?: string | null
  ctx?: ProspectVisitContext
}): Promise<void> {
  const channel = input.channel?.trim() || "platform"
  const email = input.email?.trim().toLowerCase() || null

  // Only mailed arrivals can be scanner traffic. A tokenless visitor
  // typed or clicked their way here from the site itself.
  if (email && input.ctx && isLikelyMailScannerVisit(input.ctx)) return

  try {
    const supabase = createServiceRoleSupabaseClient()
    await (supabase as unknown as {
      from: (t: string) => { insert: (v: Record<string, unknown>) => Promise<unknown> }
    })
      .from("claim_arrivals")
      .insert({ channel, email, company_id: input.companyId ?? null })
  } catch (err) {
    logger.error("Could not record a claim arrival", { channel }, err as Error)
  }
}
