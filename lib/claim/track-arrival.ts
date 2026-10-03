import "server-only"

import { logger } from "@/lib/logger"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { isLikelyMailScannerVisit, type ProspectVisitContext } from "@/lib/prospect-ref"

/** Two arrivals for one address this close together are one machine
 *  following its own redirect, not somebody opening a page twice. */
const BURST_WINDOW_MS = 2_000

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
 * SCANNERS ARE MARKED, NOT DROPPED. This used to return early when the
 * country/user-agent gate fired, which made it a filter nobody could
 * audit: the facts it judged on were gone the moment the function
 * returned. On 3 October the server counted 59 unique addresses on
 * /claim where PostHog saw 14, and nothing in the table could say why
 * — so the row is always written now, with the context and the verdict
 * on it, and the read side excludes the flagged ones. Same shape as the
 * Resend webhook: the raw fact stays, the flag keeps it out of the
 * counters. A filter that discards cannot be corrected; one that marks
 * can.
 *
 * Never throws. A page must not fail because a counter did.
 */
export async function trackClaimArrival(input: {
  /** 'invite' | 'outreach' | 'showcase' | 'outbound' from the token, 'platform' without one. */
  channel: string
  /** The address the token was issued to. Null for the platform route. */
  email?: string | null
  companyId?: string | null
  ctx?: ProspectVisitContext
}): Promise<void> {
  const channel = input.channel?.trim() || "platform"
  const email = input.email?.trim().toLowerCase() || null
  const country = input.ctx?.country?.trim()?.toUpperCase() || null
  const userAgent = input.ctx?.userAgent?.slice(0, 300) || null

  try {
    const supabase = createServiceRoleSupabaseClient()

    // Only mailed arrivals can be scanner traffic. A tokenless visitor
    // typed or clicked their way here from the site itself.
    let machineReason: string | null = null
    if (email && input.ctx && isLikelyMailScannerVisit(input.ctx)) {
      // Which half of the gate fired — the two fail for different
      // reasons and only one of them is reliable. Geo weeds out
      // datacenters abroad; it cannot see a scanner running in
      // Amsterdam, which is where Azure's West Europe region is.
      machineReason = country && !["NL", "BE"].includes(country) ? "geo" : "user_agent"
    }

    // A second arrival for the same address within two seconds. The
    // signal the geo gate misses: 34 of 68 repeat arrivals in October
    // came this fast, which no hand produces.
    if (!machineReason && email) {
      const since = new Date(Date.now() - BURST_WINDOW_MS).toISOString()
      const { data: recent } = await (supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (c: string, v: string) => {
              gte: (c: string, v: string) => { limit: (n: number) => Promise<{ data: unknown[] | null }> }
            }
          }
        }
      })
        .from("claim_arrivals")
        .select("id")
        .eq("email", email)
        .gte("created_at", since)
        .limit(1)
      if (Array.isArray(recent) && recent.length > 0) machineReason = "burst"
    }

    await (supabase as unknown as {
      from: (t: string) => { insert: (v: Record<string, unknown>) => Promise<unknown> }
    })
      .from("claim_arrivals")
      .insert({
        channel,
        email,
        company_id: input.companyId ?? null,
        country,
        user_agent: userAgent,
        machine_reason: machineReason,
      })
  } catch (err) {
    logger.error("Could not record a claim arrival", { channel }, err as Error)
  }
}
