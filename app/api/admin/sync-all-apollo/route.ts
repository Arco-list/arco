/**
 * One-shot: reconcile every company's Apollo account stage.
 *
 * Why this exists:
 *   syncCompanyToApollo() fires on status *changes* only (company status
 *   edits + prospect funnel transitions). Companies whose state hasn't
 *   changed since the last resolver/mapping update sit at a stale stage
 *   in Apollo indefinitely. This endpoint recomputes and pushes the
 *   resolved stage (lifecycle + Sales-funnel overlay — see
 *   lib/company-apollo-sync.ts) for all companies in one pass. With
 *   create-on-miss in the sync, this run is also what backfills Apollo
 *   accounts for organic companies (direct signups) into the mirror.
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
 *   - Every stage name the resolver can emit must exist in the Apollo
 *     workspace picklist (Settings → Account stages): Prospect,
 *     Contacted, Visitor, Signup, Invited, Created, Listed, Unlisted,
 *     Deactivated — otherwise that row's sync silently no-ops.
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
  // Uncached companies cost up to 3 Apollo calls (search → create →
  // stage update); a full catalog pass can exceed Vercel's maxDuration.
  // Stop cleanly before the platform kills us and report how many
  // companies remain — re-running resumes where this pass left off
  // (cached apollo_account_ids make later passes much cheaper), so the
  // operator just re-runs until remaining hits 0.
  const TIME_BUDGET_MS = (maxDuration - 30) * 1000
  const startedAt = Date.now()
  let attempted = 0
  let failed = 0
  const failures: Array<{ id: string; name: string | null; error: string }> = []

  // Benign, permanent skip reasons — a freemail domain will never sync
  // and shouldn't read as a failure on every run.
  const SKIP_REASONS = new Set(["no domain", "freemail domain"])
  let skipped = 0

  for (const c of rows) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break
    attempted++
    try {
      const result = await syncCompanyToApollo(c.id)
      if (!result.synced) {
        if (SKIP_REASONS.has(result.reason)) {
          skipped++
        } else {
          // Real failure — most commonly Apollo's accounts/update rate
          // cap (200/hour on the current plan): a burst of passes 429s
          // the tail and those accounts keep a stale stage.
          failed++
          failures.push({ id: c.id, name: c.name, error: result.reason })
          logger.warn("sync-all-apollo: company failed", { companyId: c.id, name: c.name, error: result.reason })
        }
      }
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      failures.push({ id: c.id, name: c.name, error: msg })
      logger.warn("sync-all-apollo: company failed", { companyId: c.id, name: c.name, error: msg })
    }
    // Rate-limit pause between every call
    if (attempted < rows.length) await sleep(RATE_LIMIT_SLEEP_MS)
  }

  const remaining = rows.length - attempted
  logger.info("sync-all-apollo: done", { total: rows.length, attempted, failed, skipped, remaining })

  return NextResponse.json({
    total: rows.length,
    attempted,
    failed,
    skipped,
    remaining,
    failures,
    note:
      (remaining > 0
        ? `Time budget reached — ${remaining} companies not yet synced this pass. Re-run until remaining is 0. `
        : "") +
      (failed > 0
        ? "Failures listed above — rate-cap (429) failures resolve by re-running after the hour window resets. "
        : "") +
      "Skipped = permanently unsyncable (no domain / freemail domain).",
  })
}
