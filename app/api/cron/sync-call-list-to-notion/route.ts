import { NextRequest, NextResponse } from "next/server"
import { syncCallListToNotion } from "@/lib/notion/call-list-sync"
import { logger } from "@/lib/logger"

/**
 * Daily Supabase → Notion sync of the Outbound Sales call list.
 *
 * Pulls three target segments and upserts each into the Notion Call list DB:
 *   1. Apollo-sourced visitors (prospects table, landing_visited_at IS NOT NULL)
 *   2. Organic drafts (companies status='draft', not Apollo-sourced)
 *   3. Contacted invites (project_professionals invited_email, not yet accepted)
 *
 * One-way only. Manual rep-owned fields in Notion (Outbound status, Notes,
 * Touches, Last touch, Follow-up, ICP score, Status) are never overwritten.
 *
 * Auth: Vercel Cron passes `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Env vars required:
 *   - CRON_SECRET (existing)
 *   - NOTION_API_KEY (new — internal Notion integration token, must be shared
 *     with the Call list database)
 *   - NOTION_CALL_LIST_DB_ID (new — 871086078a974d4d9e61504a59fd03a3)
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
    const result = await syncCallListToNotion()
    logger.info("[sync-call-list-to-notion] completed", {
      ...result,
      durationMs: Date.now() - startedAt,
    })
    return NextResponse.json({ ok: true, durationMs: Date.now() - startedAt, ...result })
  } catch (err) {
    logger.error("[sync-call-list-to-notion] failed", { err: String(err) })
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
