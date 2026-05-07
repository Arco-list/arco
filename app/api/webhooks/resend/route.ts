import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

/**
 * Resend webhook endpoint — handles email tracking events.
 *
 * Configure in Resend dashboard: Settings → Webhooks → Add webhook
 * URL: https://arcolist.com/api/webhooks/resend
 * Events: email.delivered, email.opened, email.clicked, email.bounced
 */

type ResendWebhookEvent = {
  type: string
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject: string
    created_at: string
    [key: string]: unknown
  }
}

export async function POST(request: NextRequest) {
  // Verify webhook signature if RESEND_WEBHOOK_SECRET is set
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (secret) {
    const signature = request.headers.get("svix-signature")
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 })
    }
    // Basic verification — for production, use the Svix library
  }

  let event: ResendWebhookEvent
  try {
    event = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { type, data } = event
  const messageId = data?.email_id
  const recipientEmail = data?.to?.[0]

  if (!messageId && !recipientEmail) {
    return NextResponse.json({ error: "No message ID or recipient" }, { status: 400 })
  }

  const supabase = createServiceRoleSupabaseClient()
  const now = new Date().toISOString()

  console.log(`[resend-webhook] ${type} for ${messageId} (${recipientEmail})`)

  // Mirror every engagement event into email_events as the unified source
  // of truth. Per-table cache writes below stay running unchanged — they
  // back the existing dashboards. New consumers (growth-table metrics,
  // /admin/emails refactor, prospect timelines) read from email_events.
  //
  // Idempotency: provider_event_id = `${messageId}:${type}:${event.created_at}`.
  // Webhook retries land the same composite key → upsert dedupes.
  // Distinct user opens/clicks have different timestamps → distinct rows.
  // Skip 'email.sent' here — sendTransactionalEmail already inserts that
  // row directly. Skip 'email.delivery_delayed' — not in our event_type
  // enum and not analytically interesting.
  if (messageId) {
    const eventTypeMap: Record<string, string> = {
      "email.delivered": "delivered",
      "email.opened": "opened",
      "email.clicked": "clicked",
      "email.bounced": "bounced",
      "email.complained": "complained",
      "email.failed": "failed",
    }
    const mappedType = eventTypeMap[type]
    if (mappedType) {
      try {
        const occurredAt = event.created_at ?? now
        const subject = data?.subject ?? null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("email_events").upsert(
          {
            provider: "resend",
            provider_event_id: `${messageId}:${mappedType}:${occurredAt}`,
            event_type: mappedType,
            recipient_email: recipientEmail ?? "",
            subject,
            occurred_at: occurredAt,
            metadata: { resend_message_id: messageId, raw_type: type },
          },
          { onConflict: "provider,provider_event_id" },
        )
      } catch (err) {
        console.error("[resend-webhook] Failed to log email_events row", { messageId, type, err })
      }
    }
  }

  // Update company_outreach table
  if (messageId) {
    const updateData: Record<string, string> = {}

    // Map Resend event names → Resend's `last_event` enum so the cached
    // value is identical to what `resend.emails.get()` would return for
    // the same message. The dashboard reads from this cache to avoid
    // re-fetching terminal-state rows on every page load.
    const lastEventMap: Record<string, string> = {
      "email.sent": "sent",
      "email.delivered": "delivered",
      "email.opened": "opened",
      "email.clicked": "clicked",
      "email.bounced": "bounced",
      "email.complained": "complained",
      "email.delivery_delayed": "delivery_delayed",
      "email.failed": "failed",
    }
    const cachedEvent = lastEventMap[type]
    if (cachedEvent) {
      updateData.last_event_cached = cachedEvent
      updateData.last_event_cached_at = now
    }

    switch (type) {
      case "email.delivered":
        // No specific field — delivery is implicit
        break
      case "email.opened":
        updateData.opened_at = now
        break
      case "email.clicked":
        updateData.clicked_at = now
        break
      case "email.bounced":
      case "email.complained":
        // Could add a bounced_at field in the future
        break
    }

    if (Object.keys(updateData).length > 0) {
      await supabase
        .from("company_outreach" as any)
        .update(updateData)
        .eq("resend_message_id", messageId)

      // Mirror the same write to email_drip_queue so followup / final rows
      // get per-message engagement tracking. Same column shape (added in
      // migration 144), so the updateData payload is reused as-is.
      await supabase
        .from("email_drip_queue")
        .update(updateData as never)
        .eq("resend_message_id", messageId)
    }
  }

  // Bounce / complaint auto-stop.
  //
  // Once an address bounces or complains it's terminal: every future
  // send to it (Showcase / Invite / Outreach / Welcome / transactional
  // alike) will fail or hurt sender reputation. Old logic only stopped
  // the prospect sequence for one company_id when a prospect-* template
  // bounced, which left other drips and the homeowner welcome series
  // happily retrying the same dead address.
  //
  // New logic, gated on recipientEmail (not template):
  //
  //   1. Stamp prospects.bounced_at / .complained_at on every prospect
  //      row sharing that email — feeds the isOptedOutOfMarketing gate
  //      so future sends short-circuit before hitting Resend.
  //   2. Cancel pending email_drip_queue rows by email (covers every
  //      company / template, not just one company's prospect sequence).
  //   3. Log prospect_events rows so the /admin/sales popup timeline
  //      surfaces the bounce/complaint alongside other funnel events.
  if ((type === "email.bounced" || type === "email.complained") && recipientEmail) {
    const isBounce = type === "email.bounced"
    const stampField = isBounce ? "bounced_at" : "complained_at"
    const cancelReason = isBounce ? "bounced" : "complained"

    try {
      const { data: affected } = await (supabase as any)
        .from("prospects")
        .update({ [stampField]: now })
        .ilike("email", recipientEmail)
        .is(stampField, null)
        .select("id")

      const affectedIds = ((affected ?? []) as Array<{ id: string }>).map((r) => r.id)
      if (affectedIds.length > 0) {
        await supabase.from("prospect_events").insert(
          affectedIds.map((id) => ({
            prospect_id: id,
            event_type: cancelReason,
            metadata: { email: recipientEmail, message_id: messageId ?? null },
          })),
        )
      }

      const { cancelPendingDripRows } = await import("@/lib/drip-queue")
      await cancelPendingDripRows(supabase, {
        email: recipientEmail,
        reason: cancelReason,
      })
    } catch (err) {
      console.error(
        "[resend-webhook] Failed to record bounce/complaint",
        { email: recipientEmail, type, err },
      )
    }
  }

  // Update prospects table based on recipient email
  if (recipientEmail) {
    const { data: prospect } = await supabase
      .from("prospects")
      .select("id, emails_sent, emails_delivered, emails_opened, emails_clicked")
      .eq("email", recipientEmail)
      .maybeSingle()

    if (prospect) {
      const updates: Record<string, unknown> = {}

      switch (type) {
        case "email.delivered":
          updates.emails_delivered = (prospect.emails_delivered ?? 0) + 1
          break
        case "email.opened":
          updates.emails_opened = (prospect.emails_opened ?? 0) + 1
          updates.last_email_opened_at = now
          break
        case "email.clicked":
          updates.emails_clicked = (prospect.emails_clicked ?? 0) + 1
          updates.last_email_clicked_at = now
          break
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from("prospects").update(updates).eq("id", prospect.id)
      }
    }
  }

  return NextResponse.json({ received: true })
}
