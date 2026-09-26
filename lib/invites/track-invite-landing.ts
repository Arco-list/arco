import "server-only"

import { logger } from "@/lib/logger"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { isLikelyMailScannerVisit, type ProspectVisitContext } from "@/lib/prospect-ref"

/**
 * An invited pro opening the page their credit points at.
 *
 * The middle step of the Invites funnel, and for a while it was not
 * being measured. `landing_visited_at` was stamped in one place only —
 * /businesses/professionals?inviteEmail= — and when the claim funnel
 * went live the invite emails started carrying a signed /claim link
 * instead. Nothing there stamped anything.
 *
 * The result read as behaviour rather than as a gap: 58 claim tokens
 * issued in September against 1 recorded visit, so the funnel showed
 * pros being invited and then, apparently, ignoring us. Four of the
 * five companies that became contributors that month had no visit
 * against their name while holding a credit they had accepted.
 *
 * So both entrances stamp, through here.
 *
 * SCANNERS DO NOT COUNT. Corporate mail security opens every link in
 * every message from a datacenter before the recipient sees it, which
 * is why the PostHog version of this number ran higher than the number
 * of people invited. Same gate the prospect side uses.
 *
 * FIRST VISIT ONLY, and never backwards: the `is(null)` filter means a
 * second reading of the same mail does not move the date, and the
 * funnel keeps dating the pro from when they first arrived.
 */
export async function trackInviteLandingVisit(
  email: string,
  ctx?: ProspectVisitContext,
): Promise<void> {
  const normalised = email?.trim().toLowerCase()
  if (!normalised) return

  if (ctx && isLikelyMailScannerVisit(ctx)) {
    logger.debug("Ignoring likely mail-scanner invite landing visit", {
      email: normalised, country: ctx.country,
    })
    return
  }

  try {
    const supabase = createServiceRoleSupabaseClient()
    // Every outstanding credit for this address, not just the one that
    // carried the link. A pro credited on three projects who opens one
    // mail has visited as a person, and the funnel counts people.
    //
    // Cast until lib/supabase/types.ts is regenerated with
    // landing_visited_at (migration 161).
    await (supabase as unknown as {
      from: (t: string) => {
        update: (v: Record<string, string>) => {
          eq: (c: string, v: string) => { is: (c: string, v: null) => Promise<unknown> }
        }
      }
    })
      .from("project_professionals")
      .update({ landing_visited_at: new Date().toISOString() })
      .eq("invited_email", normalised)
      .is("landing_visited_at", null)
  } catch (err) {
    // Never fatal: this is bookkeeping behind a page that has already
    // decided what to render.
    logger.error("Could not record an invite landing visit", { email: normalised }, err as Error)
  }
}
