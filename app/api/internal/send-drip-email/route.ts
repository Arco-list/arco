import { NextRequest, NextResponse } from "next/server"
import { sendTransactionalEmail, type EmailTemplate, type EmailVariables } from "@/lib/email-service"

/**
 * Internal drip-queue renderer + sender.
 *
 * Called by the Supabase Edge Function `process-drip-queue` for each row it
 * pulls off the queue. The Edge Function owns scheduling, batching, retry
 * counting, and error write-back; this route owns *rendering and sending*
 * so we have a single source of truth for email templates.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Why this exists (the rationale that goes with PR 2 of the drip pipeline):
 *
 * The Edge Function used to inline its own copies of baseLayout / heading /
 * body / button and three template renderers. That worked for the homeowner
 * welcome series (which never changes), but meant every change to
 * lib/email-service.ts was invisible to the cron — the company card, the
 * logo fallback, the Supabase image transforms, the new prospect templates,
 * none of it would have reached the drip pipeline without hand-porting.
 *
 * Instead: the Edge Function POSTs here, we call sendTransactionalEmail
 * from lib/email-service.ts, and every future template change flows to the
 * cron automatically. The cost is one extra HTTP hop per send (~200-500ms
 * Supabase → Vercel), which is acceptable at our send volume.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Auth
 *
 * Gated by a shared secret (`DRIP_QUEUE_SECRET`) that must match in both
 * Vercel env (this side) and Supabase Edge Function secrets (caller side).
 * Generate with `openssl rand -hex 32`, paste the same value in both places.
 *
 * We use Bearer token rather than a signed request because this is a purely
 * internal path between two of our own services — no third party is calling
 * it, so the complexity of HMAC signing isn't justified.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * Contract
 *
 * Request:  POST /api/internal/send-drip-email
 *   Headers: Authorization: Bearer <DRIP_QUEUE_SECRET>
 *   Body:    { id: string, template: EmailTemplate, email: string,
 *              variables: EmailVariables }
 *
 * Responses:
 *   200 { ok: true, messageId: string | null }
 *     — email queued at Resend; Edge Function marks sent_at.
 *   400 { ok: false, error: "bad_request", message: string }
 *     — malformed body; Edge Function logs and leaves row untouched.
 *   401 { ok: false, error: "unauthorized" }
 *     — secret mismatch; Edge Function logs and leaves row untouched.
 *   422 { ok: false, error: "unknown_template", message: string }
 *     — template not in lib/email-service.ts TEMPLATE_RENDERERS.
 *       Permanent failure; Edge Function should NOT retry this row.
 *   502 { ok: false, error: "send_failed", message: string }
 *     — Resend rejected the send; Edge Function increments attempt_count
 *       and writes last_error, retrying up to MAX_ATTEMPTS.
 *   500 { ok: false, error: "internal", message: string }
 *     — unexpected. Treated as transient; will retry.
 */

export const runtime = "nodejs" // needs the full Node runtime for Resend SDK
export const dynamic = "force-dynamic"

type Body = {
  id?: string
  template?: string
  email?: string
  variables?: EmailVariables
}

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const expected = process.env.DRIP_QUEUE_SECRET
  if (!expected) {
    // Server misconfigured. Treat as 500 so the cron retries later when
    // someone's fixed the env var, rather than giving up permanently.
    return NextResponse.json(
      { ok: false, error: "internal", message: "DRIP_QUEUE_SECRET not set on server" },
      { status: 500 },
    )
  }

  const header = req.headers.get("authorization") ?? ""
  const provided = header.startsWith("Bearer ") ? header.slice(7) : ""
  if (!provided || provided !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  // ── Parse body ──────────────────────────────────────────────────────────
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: "Invalid JSON body" },
      { status: 400 },
    )
  }

  const { id, template, email, variables } = body
  if (!id || !template || !email) {
    return NextResponse.json(
      { ok: false, error: "bad_request", message: "Missing id, template, or email" },
      { status: 400 },
    )
  }

  // ── Send via the single source of truth ───────────────────────────────
  // sendTransactionalEmail handles template lookup, renderer dispatch,
  // from-address selection (Niek for prospect-*, noreply for everything
  // else), and reply_to. If it returns { success: false } we need to
  // distinguish "template doesn't exist" (permanent, 422) from "Resend
  // rejected" (transient, 502) so the cron knows whether to retry.
  try {
    const result = await sendTransactionalEmail(
      email,
      template as EmailTemplate,
      variables ?? {},
    )

    if (result.success) {
      return NextResponse.json(
        { ok: true, messageId: result.messageId ?? null },
        { status: 200 },
      )
    }

    // Distinguish permanent vs transient failures. The send function only
    // returns { success: false, message } today — we pattern-match the
    // message to classify. "Template X not configured" is the one known
    // permanent failure; everything else is treated as transient.
    const message = result.message ?? "Unknown send failure"
    const isPermanent = /not configured|not found/i.test(message)
    return NextResponse.json(
      {
        ok: false,
        error: isPermanent ? "unknown_template" : "send_failed",
        message,
      },
      { status: isPermanent ? 422 : 502 },
    )
  } catch (err) {
    // Unhandled throw from the send path. Rare — usually means a thrown
    // exception inside a template renderer or a Resend client-side crash.
    // Transient by default; cron retries.
    return NextResponse.json(
      {
        ok: false,
        error: "internal",
        message: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
