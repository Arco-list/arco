import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import {
  publishProjectPin,
  publishFeaturePin,
  deleteProjectPin,
  deleteFeaturePin,
  patchProjectPin,
  patchFeaturePin,
} from "@/lib/pinterest/pin-workflow"

/**
 * Pinterest queue cron — runs every 5 minutes via Vercel Cron.
 *
 * Drains pinterest_queue: pulls up to BATCH_LIMIT pending rows and
 * dispatches each to the matching workflow (publish / delete / patch)
 * for either a project (type board) or a feature (space board).
 *
 * Rate: BATCH_LIMIT × 12 ticks/hr = 96 pin ops / hr, well under
 * Pinterest's ~1000 pin ops / hr ceiling. Bump BATCH_LIMIT if the queue
 * consistently backs up.
 *
 * Errors:
 *   * permanentError (thrown from pin-workflow.ts) → cancel the row with
 *     a reason. No retry.
 *   * HTTP 4xx from Pinterest (except 429) → same treatment.
 *   * HTTP 5xx / 429 / network → transient. Increment attempts, retry
 *     next tick until MAX_ATTEMPTS.
 *
 * Cron auth: same shape as process-drip-queue — Bearer CRON_SECRET.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

const BATCH_LIMIT = 8
const MAX_ATTEMPTS = 3

interface QueueRow {
  id: string
  target_type: "project" | "feature"
  target_id: string
  action: "publish" | "delete" | "patch"
  attempts: number
}

interface Outcome {
  ok: boolean
  reason?: string
  permanent?: boolean
}

export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}

async function handle(req: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
  }
  const header = req.headers.get("authorization") ?? ""
  const provided = header.startsWith("Bearer ") ? header.slice(7) : ""
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const supabase = createServiceRoleSupabaseClient()

  const { data: rows, error: fetchError } = await supabase
    .from("pinterest_queue")
    .select("id, target_type, target_id, action, attempts")
    .is("processed_at", null)
    .is("cancelled_at", null)
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT)

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  const results = { published: 0, deleted: 0, patched: 0, transient: 0, cancelled: 0 }

  // Serial rather than parallel — Pinterest rate limits are looser per
  // second than per hour, but hitting 8 pin creates in parallel from a
  // cold worker occasionally trips their per-second bucket. Serial keeps
  // the pattern simple and observable in logs.
  for (const row of rows as QueueRow[]) {
    const outcome = await runOne(row)
    if (outcome.ok) {
      await supabase
        .from("pinterest_queue")
        .update({ processed_at: new Date().toISOString(), last_error: null })
        .eq("id", row.id)
      if (row.action === "publish") results.published++
      else if (row.action === "delete") results.deleted++
      else results.patched++
    } else if (outcome.permanent) {
      await supabase
        .from("pinterest_queue")
        .update({
          cancelled_at: new Date().toISOString(),
          cancelled_reason: outcome.reason ?? "unknown",
          last_error: outcome.reason ?? null,
        })
        .eq("id", row.id)
      // Also stamp the sync_error on the target row so admin can see
      // which project/feature failed.
      await stampTargetError(supabase, row, outcome.reason ?? "cancelled")
      results.cancelled++
    } else {
      await supabase
        .from("pinterest_queue")
        .update({ attempts: row.attempts + 1, last_error: outcome.reason ?? null })
        .eq("id", row.id)
      await stampTargetError(supabase, row, outcome.reason ?? "transient error")
      results.transient++
    }
  }

  return NextResponse.json({ processed: rows.length, ...results })
}

async function runOne(row: QueueRow): Promise<Outcome> {
  try {
    if (row.target_type === "project") {
      if (row.action === "publish") await publishProjectPin(row.target_id)
      else if (row.action === "delete") await deleteProjectPin(row.target_id)
      else await patchProjectPin(row.target_id)
    } else {
      if (row.action === "publish") await publishFeaturePin(row.target_id)
      else if (row.action === "delete") await deleteFeaturePin(row.target_id)
      else await patchFeaturePin(row.target_id)
    }
    return { ok: true }
  } catch (err) {
    const asErr = err as Error & { status?: number; permanent?: boolean }
    const message = asErr.message ?? "unknown error"
    if (asErr.permanent) {
      return { ok: false, permanent: true, reason: message }
    }
    // 4xx (except 401 and 429) is permanent — Pinterest is telling us the
    // payload is bad or the pin has gone away; retrying won't help.
    // 401 stays transient because the fix is usually operational (token
    // refresh, env switch, re-auth) and we don't want a bad-auth window
    // to cascade-cancel hundreds of rows.
    if (
      asErr.status &&
      asErr.status >= 400 &&
      asErr.status < 500 &&
      asErr.status !== 429 &&
      asErr.status !== 401
    ) {
      return { ok: false, permanent: true, reason: message }
    }
    return { ok: false, permanent: false, reason: message }
  }
}

async function stampTargetError(
  supabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  row: QueueRow,
  message: string,
): Promise<void> {
  const table = row.target_type === "project" ? "projects" : "project_features"
  await supabase
    .from(table)
    .update({ pinterest_sync_error: message.slice(0, 500) })
    .eq("id", row.target_id)
}
