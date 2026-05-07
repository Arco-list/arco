import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { cancelPendingDripRows } from "@/lib/drip-queue"
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token"
import { logger } from "@/lib/logger"

/**
 * One-click unsubscribe endpoint.
 *
 * Triggered from two places per email:
 *   - The `List-Unsubscribe` HTTPS URL — Gmail/Apple Mail call it via
 *     POST when the inbox-client unsubscribe link is clicked. Honours
 *     RFC 8058 (List-Unsubscribe-Post: List-Unsubscribe=One-Click).
 *   - The visible "Unsubscribe" footer link in the email body — opens
 *     in the recipient's browser via GET.
 *
 * Both flows resolve to the same effect:
 *   1. Verify the signed token (binds the URL to a specific email).
 *   2. Stamp prospects.unsubscribed_at on every prospect row sharing
 *      that email — one unsubscribe = stop every Arco drip to them.
 *   3. Cancel any pending email_drip_queue rows by email.
 *   4. Log a single email_events row (event_type='unsubscribed') so
 *      the /admin/sales popup + sequence engagement pill surface it.
 *
 * GET returns a tiny HTML confirmation; POST returns 200 with no body
 * (Gmail doesn't render a POST response — it just needs the 2xx).
 *
 * Idempotent — repeated unsubscribes are a no-op after the first.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function handle(token: string | null): Promise<{ ok: boolean; email?: string; status: number }> {
  const email = verifyUnsubscribeToken(token)
  if (!email) {
    return { ok: false, status: 400 }
  }

  const supabase = createServiceRoleSupabaseClient()

  // 1. Mark every matching prospect as unsubscribed (idempotent — already-
  //    unsubscribed rows just get the same timestamp re-stamped).
  const now = new Date().toISOString()
  const { data: updated, error: updateError } = await (supabase as any)
    .from("prospects")
    .update({ unsubscribed_at: now })
    .ilike("email", email)
    .is("unsubscribed_at", null)
    .select("id")

  if (updateError) {
    logger.error("[unsubscribe] failed to update prospects", { email, supabaseError: updateError })
    // Don't fail the request — Gmail expects 2xx for one-click. We'll
    // retry visibility next time but the cancel + event below still
    // make sure the recipient stops receiving mail.
  }

  const newlyUnsubscribed = (updated as Array<{ id: string }> | null)?.length ?? 0

  // 2. Cancel any pending drip rows targeting this email. cancelPendingDripRows
  //    is idempotent — already-cancelled rows aren't touched.
  try {
    await cancelPendingDripRows(supabase, { email, reason: "unsubscribed" })
  } catch (err) {
    logger.error("[unsubscribe] drip cancellation failed", { email, error: err })
  }

  // 3. Attribute the unsubscribe to the recipient's most recent send so
  //    the /admin/emails Sent table can promote that row's status to
  //    "Unsubscribed" instead of "Clicked" (the click was on the
  //    unsubscribe link itself). Token only carries the email — the
  //    most-recent send is a reasonable proxy for "the email they just
  //    unsubscribed from" since recipients rarely act on weeks-old mail.
  let resendMessageId: string | null = null
  try {
    const { data: lastSent } = await (supabase as any)
      .from("email_events")
      .select("provider_event_id")
      .eq("provider", "resend")
      .eq("event_type", "sent")
      .ilike("recipient_email", email)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    resendMessageId = (lastSent as { provider_event_id?: string } | null)?.provider_event_id ?? null
  } catch (err) {
    logger.error("[unsubscribe] last-send lookup failed", { email, error: err })
  }

  // 4. Log to email_events. metadata.resend_message_id (when present)
  //    lets the Sent table query promote that specific row's status to
  //    Unsubscribed via the existing engagement-event join.
  try {
    await (supabase as any).from("email_events").insert({
      provider: "arco",
      provider_event_id: `unsubscribe:${email}:${now}`,
      event_type: "unsubscribed",
      recipient_email: email,
      campaign_kind: "sales_outbound",
      occurred_at: now,
      metadata: resendMessageId
        ? { resend_message_id: resendMessageId, source: "list_unsubscribe" }
        : { source: "list_unsubscribe" },
    })
  } catch (err) {
    logger.error("[unsubscribe] email_events insert failed", { email, error: err })
  }

  // 5. Log a prospect_events row per affected prospect so the popup's
  //    Event History timeline surfaces the unsubscribe alongside other
  //    funnel events (status changes, sends, etc.).
  if (updated && (updated as Array<{ id: string }>).length > 0) {
    try {
      await supabase.from("prospect_events").insert(
        (updated as Array<{ id: string }>).map((row) => ({
          prospect_id: row.id,
          event_type: "unsubscribed",
          metadata: { email, source: "list_unsubscribe" },
        })),
      )
    } catch (err) {
      logger.error("[unsubscribe] prospect_events insert failed", { email, error: err })
    }
  }

  // 6. Mirror to profiles.notification_preferences for any auth user with
  //    this email. Keeps the in-app Marketing toggle in sync — a logged-
  //    in user clicking unsubscribe in an email and a logged-in user
  //    flipping the toggle off in settings end up at the same state.
  //    profiles.email may not be the auth email (it isn't always backfilled),
  //    so we resolve via auth.admin.listUsers as the source of truth.
  try {
    const { data: usersList } = await (supabase as any).auth.admin.listUsers({
      page: 1,
      perPage: 200,
    })
    const matched = (usersList?.users ?? []).filter(
      (u: { email?: string | null }) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
    )
    for (const u of matched as Array<{ id: string }>) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("notification_preferences")
        .eq("id", u.id)
        .maybeSingle()
      const current = ((prof as any)?.notification_preferences ?? {}) as Record<string, unknown>
      await (supabase as any)
        .from("profiles")
        .update({
          notification_preferences: { ...current, marketing: false },
          updated_at: new Date().toISOString(),
        })
        .eq("id", u.id)
    }
  } catch (err) {
    logger.error("[unsubscribe] profile preference mirror failed", { email, error: err })
  }

  logger.info("[unsubscribe] processed", { email, newlyUnsubscribed })
  return { ok: true, email, status: 200 }
}

export async function POST(request: NextRequest) {
  // RFC 8058 one-click: token may arrive as `?t=...` or in the form body
  // (`List-Unsubscribe=One-Click`). Read query first; some clients also
  // send a urlencoded body.
  const token = request.nextUrl.searchParams.get("t")
  const result = await handle(token)
  return new NextResponse(null, { status: result.status })
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t")
  const result = await handle(token)

  if (!result.ok) {
    return new NextResponse(
      htmlPage({
        title: "Unsubscribe link expired",
        body: "This unsubscribe link is invalid or expired. If you keep receiving emails you didn't ask for, reply to any email from Arco and we'll remove you manually.",
      }),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
    )
  }

  return new NextResponse(
    htmlPage({
      title: "You've been unsubscribed",
      body: `We've stopped all sales emails to <strong>${escapeHtml(result.email ?? "this address")}</strong>. You won't hear from us again unless you reach out first.`,
    }),
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  )
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function htmlPage({ title, body }: { title: string; body: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)} · Arco</title>
<style>
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #ffffff; color: #1c1c1a; }
.wrap { max-width: 480px; margin: 0 auto; padding: 80px 24px; }
h1 { margin: 0 0 16px; font-size: 22px; font-weight: 400; font-family: Georgia, "Times New Roman", serif; }
p { margin: 0 0 16px; font-size: 15px; font-weight: 300; line-height: 1.6; color: #4a4a48; }
.footer { margin-top: 48px; font-size: 12px; color: #a1a1a0; }
a { color: #016D75; }
</style>
</head>
<body>
<div class="wrap">
<h1>${escapeHtml(title)}</h1>
<p>${body}</p>
<p class="footer">Arco Global BV · KvK 94568189 · Amsterdam, Netherlands</p>
</div>
</body>
</html>`
}
