"use server"

import {
  createServerActionSupabaseClient,
  createServiceRoleSupabaseClient,
} from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"

/**
 * Transactional sends for the Contact Card timeline.
 *
 * Reads the unified email_events table (populated by
 * sendTransactionalEmail on send + /api/webhooks/resend for
 * engagement). Only campaign_kind = 'transactional' — sales_outbound
 * already renders as sequence rows in the timeline and invite sends
 * belong to the invite sequence, so including either here would
 * duplicate rows.
 *
 * Engagement rows carry no template/campaign metadata of their own;
 * they join to the send row via metadata->>'resend_message_id'. Each
 * send is collapsed to its single strongest signal (same precedence
 * the SequenceRow pill uses).
 */

export type TransactionalEmailRow = {
  id: string
  template: string | null
  subject: string | null
  locale: string | null
  occurred_at: string
  engagement:
    | "sent"
    | "delivered"
    | "opened"
    | "clicked"
    | "bounced"
    | "complained"
    | "failed"
}

export type TransactionalEmailsResult =
  | { success: true; emails: TransactionalEmailRow[] }
  | { success: false; error: string }

// Strongest-signal precedence. Suppression states outrank engagement —
// a bounced email "read" by a scanner is still a bounced email.
const ENGAGEMENT_RANK: Record<TransactionalEmailRow["engagement"], number> = {
  sent: 0,
  delivered: 1,
  opened: 2,
  clicked: 3,
  failed: 4,
  bounced: 5,
  complained: 6,
}

export async function getTransactionalEmails(
  rawEmails: string[],
): Promise<TransactionalEmailsResult> {
  const supabase = await createServerActionSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: "Not authenticated" }

  const { data: viewerProfile } = await supabase
    .from("profiles")
    .select("user_types, admin_role")
    .eq("id", user.id)
    .maybeSingle()

  if (!isAdminUser(viewerProfile?.user_types, viewerProfile?.admin_role)) {
    return { success: false, error: "Not authorized" }
  }

  const emails = Array.from(
    new Set(rawEmails.map((e) => e?.trim().toLowerCase()).filter(Boolean)),
  )
  if (emails.length === 0) return { success: true, emails: [] }

  const svc = createServiceRoleSupabaseClient()

  // email_events isn't in the generated types yet (recent migration) —
  // same cast pattern the send/webhook writers use.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events = (svc as any).from("email_events")

  const { data: sentRows, error } = await events
    .select("id, template, subject, locale, occurred_at, metadata")
    .eq("event_type", "sent")
    .eq("campaign_kind", "transactional")
    .in("recipient_email", emails)
    .order("occurred_at", { ascending: false })
    .limit(30)

  if (error) return { success: false, error: error.message }

  const rows = (sentRows ?? []) as Array<{
    id: string
    template: string | null
    subject: string | null
    locale: string | null
    occurred_at: string
    metadata: { resend_message_id?: string } | null
  }>

  const messageIds = rows
    .map((r) => r.metadata?.resend_message_id)
    .filter((v): v is string => typeof v === "string" && v.length > 0)

  // Strongest engagement per message id.
  const bestByMessageId = new Map<string, TransactionalEmailRow["engagement"]>()
  if (messageIds.length > 0) {
    const { data: engRows } = await events
      .select("event_type, metadata")
      .neq("event_type", "sent")
      .in("metadata->>resend_message_id", messageIds)
    for (const e of (engRows ?? []) as Array<{
      event_type: string
      metadata: { resend_message_id?: string } | null
    }>) {
      const mid = e.metadata?.resend_message_id
      const type = e.event_type as TransactionalEmailRow["engagement"]
      if (!mid || !(type in ENGAGEMENT_RANK)) continue
      const current = bestByMessageId.get(mid)
      if (!current || ENGAGEMENT_RANK[type] > ENGAGEMENT_RANK[current]) {
        bestByMessageId.set(mid, type)
      }
    }
  }

  return {
    success: true,
    emails: rows.map((r) => ({
      id: r.id,
      template: r.template,
      subject: r.subject,
      locale: r.locale,
      occurred_at: r.occurred_at,
      engagement:
        (r.metadata?.resend_message_id
          ? bestByMessageId.get(r.metadata.resend_message_id)
          : undefined) ?? "sent",
    })),
  }
}
