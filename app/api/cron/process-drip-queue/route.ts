import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { sendTransactionalEmail, type EmailTemplate, type EmailVariables } from "@/lib/email-service"
import { logger } from "@/lib/logger"

/**
 * Drip queue cron — runs every 5 minutes via Vercel Cron.
 *
 * Pulls due rows from public.email_drip_queue and sends them via the
 * shared lib/email-service.ts. Same renderer as every other email path
 * (admin test send, manual prospect send, etc.) — single source of truth.
 *
 * ── History of this route ────────────────────────────────────────────────
 *
 * Originally this work lived in a Supabase Edge Function
 * (supabase/functions/process-drip-queue/index.ts) called by pg_cron via
 * `net.http_post()`. That setup never worked: pg_net was not installed on
 * the project, so every cron tick failed with `schema "net" does not
 * exist` for 11 days straight before anyone noticed (cron.job_run_details
 * showed 261 failed runs, 0 succeeded). When we discovered this we also
 * realised pg_net's fire-and-forget HTTP would have hidden Edge Function
 * errors from cron observability anyway.
 *
 * Replaced with Vercel Cron calling this route directly. Benefits over
 * the old design:
 *   - Failures show up in Vercel logs immediately, not in
 *     cron.job_run_details where nobody looks
 *   - Real HTTP responses with status codes, not fire-and-forget
 *   - 5-minute schedule (Pro tier) instead of pg_cron's effective hourly
 *   - Same observability story as the rest of the app
 *   - One source of truth: lib/email-service.ts called directly, not via
 *     an inter-route HTTP hop
 *
 * The Edge Function and the /api/internal/send-drip-email route it called
 * are both deleted in the same commit.
 *
 * ── Auth ────────────────────────────────────────────────────────────────
 *
 * Vercel Cron sends a header `Authorization: Bearer ${CRON_SECRET}`
 * matching the value in vercel.json's env. We compare against
 * process.env.CRON_SECRET. Anything else (including unauthenticated
 * external requests) gets a 401.
 *
 * ── Behaviour ───────────────────────────────────────────────────────────
 *
 * - Caps each tick at BATCH_LIMIT rows so a backlog doesn't burn the
 *   route's max-duration on a single invocation
 * - Sends CONCURRENCY rows in parallel via Promise.all
 * - Stops retrying a row once attempt_count >= MAX_ATTEMPTS — admin can
 *   reset it from /admin/emails (PR 5)
 * - Permanent failures (unknown template) cancel the row immediately with
 *   a clear cancelled_reason
 * - Transient failures (Resend rejection, network blip) increment
 *   attempt_count and store last_error; retried on the next tick
 * - Pre-fetches featured projects for `discover-projects` rows (the
 *   welcome series uses this pattern; the prospect series doesn't need it)
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60 // seconds; Vercel Pro allows up to 300

const BATCH_LIMIT = 50
const CONCURRENCY = 5
const MAX_ATTEMPTS = 3

type QueueRow = {
  id: string
  email: string
  template: string
  variables: Record<string, unknown> | null
  company_id: string | null
  attempt_count: number
}

type SendOutcome = "sent" | "failed" | "cancelled"

export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}

async function handle(req: NextRequest): Promise<NextResponse> {
  // ── Auth ────────────────────────────────────────────────────────────────
  const expected = process.env.CRON_SECRET
  if (!expected) {
    // NOTE: lib/logger.ts has signature (message, context?) — NOT
    // (component, message, context) like a lot of other call sites in
    // this repo. The "component" convention is sitewide tech debt; we
    // use the actual signature here so the structured data lands in
    // Vercel logs correctly. To filter for drip-queue logs in Vercel,
    // search for "cron-drip-queue" — it's in the message string.
    logger.error("cron-drip-queue: CRON_SECRET not set on the server")
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    )
  }
  const header = req.headers.get("authorization") ?? ""
  const provided = header.startsWith("Bearer ") ? header.slice(7) : ""
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const supabase = createServiceRoleSupabaseClient()

  // ── Fetch due rows ─────────────────────────────────────────────────────
  const { data: dueEmails, error: fetchError } = await supabase
    .from("email_drip_queue")
    .select("id, email, template, variables, company_id, attempt_count")
    .lte("send_at", new Date().toISOString())
    .is("sent_at", null)
    .is("cancelled_at", null)
    .lt("attempt_count", MAX_ATTEMPTS)
    .order("send_at", { ascending: true })
    .limit(BATCH_LIMIT)

  if (fetchError) {
    logger.error("cron-drip-queue: Failed to fetch queue", { supabaseError: fetchError })
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  const rows = (dueEmails ?? []) as QueueRow[]
  if (rows.length === 0) {
    return NextResponse.json({ processed: 0, sent: 0, failed: 0, cancelled: 0 })
  }

  // ── Pre-fetch data that some templates need ────────────────────────────
  // discover-projects + welcome-homeowner both expect vars.projects with a
  // featured-projects list. welcome-homeowner additionally needs
  // vars.professionals with featured companies.
  //
  // The fetch helpers live in lib/email-featured-data.ts so the admin test
  // send path (sendTestEmail) can reuse them — this guarantees the admin
  // preview renders with the same data the real send will.
  const { fetchFeaturedProjectsForEmail, fetchFeaturedProfessionalsForEmail } = await import(
    "@/lib/email-featured-data"
  )
  type FeaturedProjectRow = Awaited<ReturnType<typeof fetchFeaturedProjectsForEmail>>[number]
  type FeaturedProfessionalRow = Awaited<ReturnType<typeof fetchFeaturedProfessionalsForEmail>>[number]

  let featuredProjects: FeaturedProjectRow[] | undefined
  let featuredProfessionals: FeaturedProfessionalRow[] | undefined

  const needsFeaturedProjects = rows.some(
    (r) => r.template === "discover-projects" || r.template === "welcome-homeowner",
  )
  const needsFeaturedProfessionals = rows.some((r) => r.template === "welcome-homeowner")

  if (needsFeaturedProjects) {
    // welcome-homeowner shows 4 cards (2x2); discover-projects shows 3.
    const limit = rows.some((r) => r.template === "welcome-homeowner") ? 4 : 3
    featuredProjects = await fetchFeaturedProjectsForEmail(limit)
  }

  if (needsFeaturedProfessionals) {
    featuredProfessionals = await fetchFeaturedProfessionalsForEmail()
  }

  // ── Process in concurrent batches ──────────────────────────────────────
  let sent = 0
  let failed = 0
  let cancelled = 0

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      batch.map((row) => sendOne(row, supabase, featuredProjects, featuredProfessionals)),
    )
    for (const r of results) {
      if (r === "sent") sent++
      else if (r === "failed") failed++
      else if (r === "cancelled") cancelled++
    }
  }

  return NextResponse.json({ processed: rows.length, sent, failed, cancelled })
}

async function sendOne(
  row: QueueRow,
  supabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  featuredProjects?: import("@/lib/email-featured-data").FeaturedProject[],
  featuredProfessionals?: import("@/lib/email-featured-data").FeaturedProfessional[],
): Promise<SendOutcome> {
  // Inject cron-side data into variables where the template expects it.
  const variables: EmailVariables = { ...((row.variables as EmailVariables | null) ?? {}) }
  if (row.template === "discover-projects" && featuredProjects) {
    variables.projects = featuredProjects
  }
  if (row.template === "welcome-homeowner") {
    if (featuredProjects) variables.projects = featuredProjects
    if (featuredProfessionals) variables.professionals = featuredProfessionals
  }

  let result: { success: boolean; messageId?: string; message?: string }
  try {
    result = await sendTransactionalEmail(
      row.email,
      row.template as EmailTemplate,
      variables,
    )
  } catch (err) {
    // Unhandled throw from the renderer or Resend client. Treat as transient.
    result = {
      success: false,
      message: err instanceof Error ? err.message : "Unknown send error",
    }
  }

  if (result.success) {
    const { error } = await supabase
      .from("email_drip_queue")
      .update({
        sent_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", row.id)
    if (error) {
      logger.error("cron-drip-queue: Failed to mark row sent", { rowId: row.id, supabaseError: error })
    }
    logger.info("cron-drip-queue: Sent", { template: row.template, email: row.email, messageId: result.messageId })
    return "sent"
  }

  // Permanent failure: template doesn't exist. Cancel immediately.
  const errorMessage = result.message ?? "Unknown send failure"
  const isPermanent = /not configured|not found/i.test(errorMessage)
  if (isPermanent) {
    const { error } = await supabase
      .from("email_drip_queue")
      .update({
        cancelled_at: new Date().toISOString(),
        cancelled_reason: "unknown_template",
        last_error: errorMessage,
      })
      .eq("id", row.id)
    if (error) {
      logger.error("cron-drip-queue: Failed to mark row cancelled", { rowId: row.id, supabaseError: error })
    }
    logger.warn("cron-drip-queue: Cancelled (unknown template)", { template: row.template, email: row.email, error: errorMessage })
    return "cancelled"
  }

  // Transient failure: increment, retry next tick. Cancel after MAX_ATTEMPTS.
  const nextAttempt = row.attempt_count + 1
  const willCancel = nextAttempt >= MAX_ATTEMPTS
  const update: Record<string, unknown> = {
    attempt_count: nextAttempt,
    last_error: errorMessage,
  }
  if (willCancel) {
    update.cancelled_at = new Date().toISOString()
    update.cancelled_reason = "max_attempts"
  }
  const { error } = await supabase
    .from("email_drip_queue")
    .update(update)
    .eq("id", row.id)
  if (error) {
    logger.error("cron-drip-queue: Failed to increment attempt", { rowId: row.id, supabaseError: error })
  }
  logger.warn(
    `cron-drip-queue: ${willCancel ? "Cancelled (max attempts)" : "Failed (will retry)"}`,
    {
      template: row.template,
      email: row.email,
      attempt: nextAttempt,
      maxAttempts: MAX_ATTEMPTS,
      error: errorMessage,
    },
  )
  return willCancel ? "cancelled" : "failed"
}
