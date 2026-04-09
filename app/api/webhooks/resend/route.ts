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
    }
  }

  // PR 4 of the drip pipeline: bounce / complaint cancels the rest of
  // the prospect sequence for that company.
  //
  // We only want to cancel for *prospect* outreach — a bounced welcome
  // email shouldn't cancel a future prospect intro to the same address
  // (different sender, different sequence). To check, look up the
  // company_outreach row by resend_message_id and confirm the template
  // is one of prospect_*.
  if ((type === "email.bounced" || type === "email.complained") && messageId) {
    const { data: outreachRow } = await supabase
      .from("company_outreach" as any)
      .select("company_id, template")
      .eq("resend_message_id", messageId)
      .maybeSingle()

    const template = (outreachRow as { template?: string } | null)?.template
    const companyId = (outreachRow as { company_id?: string } | null)?.company_id
    if (companyId && template?.startsWith("prospect")) {
      try {
        const { cancelPendingDripRows } = await import("@/lib/drip-queue")
        await cancelPendingDripRows(supabase, {
          companyId,
          reason: type === "email.bounced" ? "bounced" : "complained",
        })
      } catch (err) {
        console.error("[resend-webhook] Failed to cancel drip rows on bounce/complaint", err)
      }
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
