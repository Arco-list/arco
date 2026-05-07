import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { syncAllGmailConnections } from "@/lib/gmail/sync"
import { logger } from "@/lib/logger"

/**
 * Gmail inbox sync cron — pulls new messages for every connected
 * mailbox, ingests them into inbound_emails, matches replies to
 * prospects, and auto-cancels their pending drip rows.
 *
 * Vercel cron schedule: every 5 minutes. Cadence chosen
 * so a reply stops the drip well before the next followup fires —
 * follow-ups schedule on business-day boundaries, not minute ones.
 *
 * Auth: Bearer ${CRON_SECRET}. Mirrors the other cron handlers.
 *
 * The endpoint is intentionally side-effect-only — it returns a small
 * status object for the Vercel cron history but the durable state
 * (last_history_id, sync errors) lives in gmail_connections.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
  }
  const header = request.headers.get("authorization") ?? ""
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : ""
  const queryToken = request.nextUrl.searchParams.get("secret") ?? ""
  if (bearer !== expected && queryToken !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const supabase = createServiceRoleSupabaseClient()
  try {
    const results = await syncAllGmailConnections(supabase)
    const totals = results.reduce(
      (acc, r) => ({
        fetched: acc.fetched + r.fetched,
        matched: acc.matched + r.matched,
        errors: acc.errors + r.errors,
      }),
      { fetched: 0, matched: 0, errors: 0 },
    )
    return NextResponse.json({ ok: true, ...totals, perConnection: results })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error("[cron-sync-gmail] failed", { error: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
