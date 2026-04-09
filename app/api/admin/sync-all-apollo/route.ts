/**
 * One-shot: push every company's current status to Apollo as an account stage.
 *
 * Why this exists:
 *   syncCompanyToApollo() fires on status *changes* only (via the server
 *   actions in admin/professionals and create-company). Companies whose
 *   status hasn't changed since the last Apollo mapping update sit at a
 *   stale stage in Apollo indefinitely. After renaming `added` → `unclaimed`
 *   in migration 128, any company previously mapped to the "Added" stage
 *   in Apollo needs to be moved to "Unclaimed". This endpoint reconciles
 *   all companies in one pass.
 *
 * How to run:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     https://www.arcolist.com/api/admin/sync-all-apollo
 *
 *   (or open in a browser with ?secret=...&dry_run=1 to preview first)
 *
 * Prerequisites:
 *   - CRON_SECRET set in Vercel env (already used by /api/cron/*)
 *   - APOLLO_API_KEY set
 *   - Every Apollo stage in COMPANY_STATUS_TO_APOLLO_STAGE must exist in
 *     the Apollo workspace (Settings → Account stages) — otherwise that
 *     row's sync silently no-ops.
 *
 * Rate limiting:
 *   Apollo's account update endpoint is ~60/min. We sleep 1.2s between
 *   calls (50/min) to stay comfortably under the ceiling. With ~25
 *   companies this takes ~30s and finishes within Vercel's 60s default.
 *   For larger catalogs the route sets maxDuration = 300.
 *
 * Safety:
 *   - Auth via CRON_SECRET (Bearer header or ?secret= query param).
 *   - ?dry_run=1 lists what would sync without calling Apollo.
 *   - Non-fatal per-company: one failure logs + continues with the next.
 */

import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { syncCompanyToApollo } from "@/lib/company-apollo-sync"
import { logger } from "@/lib/logger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

const RATE_LIMIT_SLEEP_MS = 1200

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))

export async function GET(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
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

  const dryRun = request.nextUrl.searchParams.get("dry_run") === "1"

  if (!process.env.APOLLO_API_KEY && !dryRun) {
    return NextResponse.json({ error: "APOLLO_API_KEY not configured" }, { status: 500 })
  }

  // ── Load companies ──────────────────────────────────────────────────────
  const supabase = createServiceRoleSupabaseClient()
  const { data: companies, error } = await supabase
    .from("companies")
    .select("id, name, status")
    .order("created_at", { ascending: true })

  if (error) {
    logger.error("sync-all-apollo: Failed to load companies", { supabaseError: error })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (companies ?? []) as Array<{ id: string; name: string | null; status: string | null }>

  if (dryRun) {
    // Preview: count by status so the operator can sanity-check before
    // running the real sync.
    const byStatus: Record<string, number> = {}
    for (const c of rows) {
      const s = c.status ?? "null"
      byStatus[s] = (byStatus[s] ?? 0) + 1
    }
    return NextResponse.json({
      dry_run: true,
      total: rows.length,
      byStatus,
      note: "No Apollo API calls made. Remove ?dry_run=1 to execute.",
    })
  }

  // ── Sync loop ───────────────────────────────────────────────────────────
  let attempted = 0
  let failed = 0
  const failures: Array<{ id: string; name: string | null; error: string }> = []

  for (const c of rows) {
    attempted++
    try {
      // syncCompanyToApollo handles "no domain" and "no apollo match"
      // cases gracefully — they log at debug level and return without
      // throwing. Real failures (network, HTTP errors) do throw.
      await syncCompanyToApollo(c.id)
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      failures.push({ id: c.id, name: c.name, error: msg })
      logger.warn("sync-all-apollo: company failed", { companyId: c.id, name: c.name, error: msg })
    }
    // Rate-limit pause between every call
    if (attempted < rows.length) await sleep(RATE_LIMIT_SLEEP_MS)
  }

  logger.info("sync-all-apollo: done", { total: rows.length, attempted, failed })

  return NextResponse.json({
    total: rows.length,
    attempted,
    failed,
    failures,
    note:
      "Companies without a domain or without an Apollo account match are " +
      "counted as successful — syncCompanyToApollo logs them at debug level " +
      "and returns without pushing. Check logs for the full picture.",
  })
}
