"use server"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

export type InboundEmailStatus = "unread" | "read" | "replied" | "archived"

/**
 * Inbox tab key — drives the WHERE clause on inbound_emails.status.
 *
 *   active   — unread + read (the working inbox; default tab)
 *   replied  — admin already responded
 *   archived — admin dismissed without replying
 *   all      — everything (debug / search)
 */
export type InboundTab = "active" | "replied" | "archived" | "all"

export type InboundEmailRow = {
  id: string
  fromEmail: string
  fromName: string | null
  subject: string | null
  snippet: string | null
  receivedAt: string
  status: InboundEmailStatus
  prospectId: string | null
  prospectCompanyName: string | null
  prospectStatus: string | null
  prospectChannel: string | null
}

export type InboundEmailDetail = InboundEmailRow & {
  threadId: string | null
  toEmails: string[]
  bodyHtml: string | null
  bodyText: string | null
  metadata: Record<string, unknown>
}

type FetchOpts = {
  tab?: InboundTab
  search?: string
  limit?: number
  offset?: number
}

export type FetchInboundResult = {
  emails: InboundEmailRow[]
  total: number
  unreadCount: number
}

/**
 * List inbound emails for the inbox table. Filters are post-WHERE on
 * status; the prospect join happens in JS to keep the query simple
 * (per-page row counts are <= 50, so a second IN-list lookup is fine).
 *
 * unreadCount is the badge counter on the Inbox tab — counted across
 * the whole table regardless of the active filter.
 */
export async function fetchInboundEmails(opts: FetchOpts = {}): Promise<FetchInboundResult> {
  const supabase = createServiceRoleSupabaseClient()
  const { tab = "active", search, limit = 50, offset = 0 } = opts

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("inbound_emails")
    .select(
      "id, from_email, from_name, subject, snippet, received_at, status, prospect_id",
      { count: "exact" },
    )
    .order("received_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (tab === "active") {
    query = query.in("status", ["unread", "read"])
  } else if (tab !== "all") {
    query = query.eq("status", tab)
  }

  if (search) {
    const escaped = search.replace(/[%_]/g, (c) => `\\${c}`)
    query = query.or(
      `from_email.ilike.%${escaped}%,from_name.ilike.%${escaped}%,subject.ilike.%${escaped}%,snippet.ilike.%${escaped}%`,
    )
  }

  const { data, count, error } = await query
  if (error) {
    console.error("[inbox] fetchInboundEmails failed", error)
    return { emails: [], total: 0, unreadCount: 0 }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[]
  const prospectIds = Array.from(
    new Set(rows.map((r) => r.prospect_id).filter((id): id is string => Boolean(id))),
  )
  const prospectMap = new Map<
    string,
    { company_name: string | null; status: string; source: string }
  >()
  if (prospectIds.length > 0) {
    const { data: prospects } = await supabase
      .from("prospects")
      .select("id, company_name, status, source")
      .in("id", prospectIds)
    for (const p of prospects ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = p as any
      prospectMap.set(row.id, {
        company_name: row.company_name,
        status: row.status,
        source: row.source,
      })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: unreadCount } = await (supabase as any)
    .from("inbound_emails")
    .select("id", { count: "exact", head: true })
    .eq("status", "unread")

  const emails: InboundEmailRow[] = rows.map((r) => {
    const p = r.prospect_id ? prospectMap.get(r.prospect_id) : null
    return {
      id: r.id,
      fromEmail: r.from_email,
      fromName: r.from_name,
      subject: r.subject,
      snippet: r.snippet,
      receivedAt: r.received_at,
      status: r.status,
      prospectId: r.prospect_id,
      prospectCompanyName: p?.company_name ?? null,
      prospectStatus: p?.status ?? null,
      prospectChannel: p?.source ?? null,
    }
  })

  return { emails, total: count ?? 0, unreadCount: unreadCount ?? 0 }
}

/**
 * Single inbound email with full body + prospect context. Used by the
 * detail popup. Marks the row as 'read' as a side effect when it was
 * 'unread' — same pattern as Gmail / most inbox UIs.
 */
export async function fetchInboundEmailDetail(id: string): Promise<InboundEmailDetail | null> {
  const supabase = createServiceRoleSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("inbound_emails")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (error || !data) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any
  let prospect: { company_name: string | null; status: string; source: string } | null = null
  if (row.prospect_id) {
    const { data: p } = await supabase
      .from("prospects")
      .select("id, company_name, status, source")
      .eq("id", row.prospect_id)
      .maybeSingle()
    if (p) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pr = p as any
      prospect = { company_name: pr.company_name, status: pr.status, source: pr.source }
    }
  }

  // Mark as read — fire and forget. The eq("status", "unread") guard
  // makes this idempotent so re-opening already-read emails is a no-op.
  if (row.status === "unread") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabase as any)
      .from("inbound_emails")
      .update({ status: "read", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "unread")
      .then(() => undefined)
  }

  return {
    id: row.id,
    fromEmail: row.from_email,
    fromName: row.from_name,
    subject: row.subject,
    snippet: row.snippet,
    receivedAt: row.received_at,
    status: row.status === "unread" ? "read" : row.status,
    prospectId: row.prospect_id,
    prospectCompanyName: prospect?.company_name ?? null,
    prospectStatus: prospect?.status ?? null,
    prospectChannel: prospect?.source ?? null,
    threadId: row.thread_id,
    toEmails: row.to_emails ?? [],
    bodyHtml: row.body_html,
    bodyText: row.body_text,
    metadata: row.metadata ?? {},
  }
}

export async function archiveInboundEmail(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("inbound_emails")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function unarchiveInboundEmail(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("inbound_emails")
    .update({ status: "read", updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

/**
 * Drop a connected Gmail mailbox from /admin/inbox. Deletes the
 * gmail_connections row and best-effort revokes the refresh token at
 * Google so a stale browser session can't keep using it.
 *
 * inbound_emails rows previously synced through this mailbox stay
 * around — they're keyed on provider_message_id, not the connection,
 * and represent real history we don't want to lose. They'll continue
 * to show up under Archived / All on the inbox tabs.
 */
export async function disconnectGmailConnection(
  gmailAddress: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleSupabaseClient()

  // Pull the encrypted refresh token first so we can revoke at Google
  // before the row is gone. Best-effort — a failure here doesn't block
  // the local disconnect (the worst case is a stale token that no
  // longer maps to anything in our DB).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row } = await (supabase as any)
    .from("gmail_connections")
    .select("refresh_token")
    .eq("gmail_address", gmailAddress)
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteErr } = await (supabase as any)
    .from("gmail_connections")
    .delete()
    .eq("gmail_address", gmailAddress)

  if (deleteErr) return { success: false, error: deleteErr.message }

  if (row && (row as { refresh_token: string }).refresh_token) {
    try {
      const { decryptRefreshToken } = await import("@/lib/gmail/oauth")
      const refresh = decryptRefreshToken((row as { refresh_token: string }).refresh_token)
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      })
    } catch (err) {
      console.error("[inbox] revoke after disconnect failed (non-fatal)", err)
    }
  }

  return { success: true }
}

export async function markInboundEmailUnread(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceRoleSupabaseClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("inbound_emails")
    .update({ status: "unread", updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}
