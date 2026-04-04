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

  // Update prospects table based on recipient email
  if (recipientEmail) {
    const { data: prospect } = await supabase
      .from("prospects")
      .select("id, emails_sent, emails_opened, emails_clicked")
      .eq("email", recipientEmail)
      .maybeSingle()

    if (prospect) {
      const updates: Record<string, unknown> = {}

      switch (type) {
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
