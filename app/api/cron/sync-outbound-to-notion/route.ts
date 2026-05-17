import { NextRequest, NextResponse } from "next/server"
import { syncOutboundToNotion } from "@/lib/notion/outbound-sync"
import { logger } from "@/lib/logger"

/**
 * Supabase -> Notion sync of the Outbound database.
 *
 * Two passes per run:
 *   1. Funnel: prospects with status in (visitor, signup, company, active),
 *      deduped per company, primary contact = most recent email.
 *   2. Direct enrichment: any Notion row with a Website but no funnel match
 *      gets looked up against admin/companies; if a company exists, the row
 *      is filled and tagged Channel=Direct.
 *
 * One-way only. Manual rep fields in Notion (Contact status, Last contacted,
 * Scheduled, Notes) are never overwritten.
 *
 * Auth: Vercel Cron passes `Authorization: Bearer ${CRON_SECRET}`. Same
 * route handler accepts a `?secret=` query param so it can be invoked from
 * an authenticated admin server action without a header.
 *
 * Env vars:
 *   - CRON_SECRET (existing)
 *   - NOTION_API_KEY (shared with the Outbound database)
 *   - NOTION_OUTBOUND_DB_ID (362f3c0385e480cead0bd417b06836a9)
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

  const startedAt = Date.now()
  try {
    const result = await syncOutboundToNotion()
    logger.info("[sync-outbound-to-notion] completed", {
      ...result,
      durationMs: Date.now() - startedAt,
    })
    return NextResponse.json({ ok: true, durationMs: Date.now() - startedAt, ...result })
  } catch (err) {
    logger.error("[sync-outbound-to-notion] failed", { err: String(err) })
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
