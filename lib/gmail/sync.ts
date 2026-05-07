import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { decryptRefreshToken, refreshAccessToken } from "./oauth"
import { logger } from "@/lib/logger"

/**
 * Gmail sync for /admin/inbox.
 *
 * Slice 2 of the inbox build. Per cron run (every 5 minutes via
 * /api/cron/sync-gmail) we:
 *
 *   1. Pick up each gmail_connections row.
 *   2. Refresh the access token if it's expired.
 *   3. Pull new messages — first run does a small backfill (last 50
 *      inbox messages) so the inbox isn't empty immediately after
 *      connect; subsequent runs use users.history.list keyed on the
 *      stored last_history_id.
 *   4. For each new message, fetch full content, parse headers/body,
 *      try to match the From address to a prospect, and upsert the
 *      row into inbound_emails.
 *   5. On a prospect match: stamp prospects.replied_at, cancel pending
 *      drip rows by email (reason 'replied'), log a prospect_events
 *      row so the popup timeline surfaces the reply.
 *   6. Advance gmail_connections.last_history_id.
 *
 * Failure semantics: per-message errors are logged but don't fail the
 * sync (we'd rather make partial progress). A connection-level error
 * (auth refresh failed, etc.) writes last_sync_error and stops that
 * row's run — other connections still proceed.
 */

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1"
const INITIAL_BACKFILL_LIMIT = 50

type GmailConnectionRow = {
  id: string
  user_id: string
  gmail_address: string
  refresh_token: string
  access_token: string | null
  access_token_expires_at: string | null
  last_history_id: string | null
}

export type SyncResult = {
  gmail_address: string
  fetched: number
  matched: number
  errors: number
  lastError: string | null
}

/** Run sync for every connected mailbox. */
export async function syncAllGmailConnections(
  supabase: SupabaseClient<any, any, any>,
): Promise<SyncResult[]> {
  const { data: connections } = await (supabase as any)
    .from("gmail_connections")
    .select("id, user_id, gmail_address, refresh_token, access_token, access_token_expires_at, last_history_id")

  const rows = (connections ?? []) as GmailConnectionRow[]
  const results: SyncResult[] = []
  for (const conn of rows) {
    try {
      results.push(await syncConnection(supabase, conn))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error("[gmail-sync] connection failed", { gmail_address: conn.gmail_address, error: message })
      await markConnectionError(supabase, conn.id, message)
      results.push({ gmail_address: conn.gmail_address, fetched: 0, matched: 0, errors: 1, lastError: message })
    }
  }
  return results
}

async function syncConnection(
  supabase: SupabaseClient<any, any, any>,
  conn: GmailConnectionRow,
): Promise<SyncResult> {
  const accessToken = await getValidAccessToken(supabase, conn)

  let messageIds: string[]
  let nextHistoryId: string | null = null

  if (!conn.last_history_id) {
    // First run for this mailbox — fetch the latest INBOX messages so
    // the inbox is immediately useful, plus the current historyId for
    // incremental syncs going forward.
    const profile = await gmailFetch<{ historyId: string }>(accessToken, "/users/me/profile")
    nextHistoryId = profile.historyId
    const list = await gmailFetch<{ messages?: Array<{ id: string }> }>(
      accessToken,
      `/users/me/messages?labelIds=INBOX&maxResults=${INITIAL_BACKFILL_LIMIT}`,
    )
    messageIds = (list.messages ?? []).map((m) => m.id)
  } else {
    // Incremental — pull every messageAdded event since last_history_id.
    // history.list paginates via pageToken; we follow until exhausted
    // or 5 pages (safety cap — at 5min cadence the list shouldn't grow
    // beyond that).
    const ids = new Set<string>()
    let pageToken: string | undefined
    let latestHistoryId = conn.last_history_id
    for (let page = 0; page < 5; page++) {
      const params = new URLSearchParams({
        startHistoryId: conn.last_history_id,
        historyTypes: "messageAdded",
      })
      if (pageToken) params.set("pageToken", pageToken)
      const history = await gmailFetch<{
        history?: Array<{
          id: string
          messagesAdded?: Array<{ message: { id: string; labelIds?: string[] } }>
        }>
        historyId?: string
        nextPageToken?: string
      }>(accessToken, `/users/me/history?${params.toString()}`)
      for (const h of history.history ?? []) {
        if (h.id) latestHistoryId = h.id
        for (const ma of h.messagesAdded ?? []) {
          // Only ingest messages that landed in INBOX — Sent + Drafts
          // come through history too but we only care about replies.
          if (ma.message.labelIds?.includes("INBOX")) ids.add(ma.message.id)
        }
      }
      if (history.historyId) latestHistoryId = history.historyId
      if (!history.nextPageToken) break
      pageToken = history.nextPageToken
    }
    messageIds = Array.from(ids)
    nextHistoryId = latestHistoryId
  }

  let fetched = 0
  let matched = 0
  let errors = 0
  let lastError: string | null = null

  for (const messageId of messageIds) {
    try {
      const message = await fetchMessage(accessToken, messageId)
      const parsed = parseMessage(message)
      const matchedProspect = await ingestInboundEmail(supabase, parsed)
      fetched++
      if (matchedProspect) matched++
    } catch (err) {
      errors++
      lastError = err instanceof Error ? err.message : String(err)
      logger.error("[gmail-sync] message ingest failed", {
        messageId,
        gmail_address: conn.gmail_address,
        error: lastError,
      })
    }
  }

  await (supabase as any)
    .from("gmail_connections")
    .update({
      last_history_id: nextHistoryId,
      last_sync_at: new Date().toISOString(),
      last_sync_error: errors > 0 ? lastError : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conn.id)

  return { gmail_address: conn.gmail_address, fetched, matched, errors, lastError }
}

/**
 * Returns a non-expired Gmail access token, refreshing via the stored
 * refresh token when needed and persisting the new access token to the
 * gmail_connections row.
 */
async function getValidAccessToken(
  supabase: SupabaseClient<any, any, any>,
  conn: GmailConnectionRow,
): Promise<string> {
  // 60-second buffer so we don't hand out a token that's about to expire
  // mid-sync (a minute is comfortably longer than any single API call).
  const stillValid = conn.access_token
    && conn.access_token_expires_at
    && new Date(conn.access_token_expires_at).getTime() - Date.now() > 60_000
  if (stillValid && conn.access_token) return conn.access_token

  const refreshed = await refreshAccessToken(decryptRefreshToken(conn.refresh_token))
  await (supabase as any)
    .from("gmail_connections")
    .update({
      access_token: refreshed.accessToken,
      access_token_expires_at: refreshed.expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", conn.id)
  return refreshed.accessToken
}

async function gmailFetch<T>(accessToken: string, path: string): Promise<T> {
  const r = await fetch(`${GMAIL_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!r.ok) {
    const text = await r.text()
    throw new Error(`Gmail API ${path} failed (${r.status}): ${text}`)
  }
  return (await r.json()) as T
}

type GmailMessage = {
  id: string
  threadId: string
  internalDate: string
  snippet?: string
  labelIds?: string[]
  payload: {
    headers?: Array<{ name: string; value: string }>
    mimeType?: string
    body?: { data?: string }
    parts?: GmailMessagePart[]
  }
}

type GmailMessagePart = {
  mimeType?: string
  body?: { data?: string }
  parts?: GmailMessagePart[]
}

async function fetchMessage(accessToken: string, messageId: string): Promise<GmailMessage> {
  return gmailFetch<GmailMessage>(
    accessToken,
    `/users/me/messages/${encodeURIComponent(messageId)}?format=full`,
  )
}

type ParsedMessage = {
  providerMessageId: string
  threadId: string
  fromEmail: string
  fromName: string | null
  toEmails: string[]
  subject: string | null
  snippet: string | null
  bodyText: string | null
  bodyHtml: string | null
  receivedAt: string
  metadata: Record<string, unknown>
}

function parseMessage(msg: GmailMessage): ParsedMessage {
  const headers = new Map(
    (msg.payload.headers ?? []).map((h) => [h.name.toLowerCase(), h.value] as const),
  )
  const fromHeader = headers.get("from") ?? ""
  const { email: fromEmail, name: fromName } = parseAddress(fromHeader)
  const toHeader = headers.get("to") ?? ""
  const toEmails = toHeader
    .split(",")
    .map((s) => parseAddress(s).email)
    .filter(Boolean)
  const subject = headers.get("subject") ?? null
  const receivedAt = msg.internalDate
    ? new Date(Number(msg.internalDate)).toISOString()
    : new Date().toISOString()

  const { text, html } = extractBody(msg.payload)
  return {
    providerMessageId: msg.id,
    threadId: msg.threadId,
    fromEmail,
    fromName,
    toEmails,
    subject,
    snippet: msg.snippet ?? null,
    bodyText: text,
    bodyHtml: html,
    receivedAt,
    metadata: {
      labelIds: msg.labelIds ?? [],
      messageId: headers.get("message-id") ?? null,
      inReplyTo: headers.get("in-reply-to") ?? null,
      references: headers.get("references") ?? null,
    },
  }
}

/**
 * Parse "Name <email@x.com>" or bare "email@x.com". Pretty forgiving —
 * we'd rather get a usable email out of a malformed header than throw.
 */
function parseAddress(raw: string): { email: string; name: string | null } {
  const trimmed = raw.trim()
  const angleMatch = trimmed.match(/^(?:"?([^"]*)"?\s*)?<([^>]+)>$/)
  if (angleMatch) {
    return { name: angleMatch[1]?.trim() || null, email: angleMatch[2].trim().toLowerCase() }
  }
  return { email: trimmed.toLowerCase(), name: null }
}

/**
 * Walk the multipart payload tree looking for text/plain + text/html.
 * Returns the first of each it finds, decoded from Gmail's base64url.
 */
function extractBody(part: GmailMessage["payload"] | GmailMessagePart): {
  text: string | null
  html: string | null
} {
  let text: string | null = null
  let html: string | null = null

  const visit = (p: GmailMessage["payload"] | GmailMessagePart): void => {
    if (p.mimeType === "text/plain" && !text && p.body?.data) {
      text = decodeBase64Url(p.body.data)
    } else if (p.mimeType === "text/html" && !html && p.body?.data) {
      html = decodeBase64Url(p.body.data)
    }
    for (const child of p.parts ?? []) visit(child)
  }
  visit(part)
  return { text, html }
}

function decodeBase64Url(data: string): string {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/")
    + "=".repeat((4 - (data.length % 4)) % 4)
  return Buffer.from(padded, "base64").toString("utf8")
}

/**
 * Insert (or skip if already present) the parsed message into
 * inbound_emails. On match to a prospect, stamp replied_at, cancel
 * pending drips, log a prospect_events row.
 *
 * Returns true when a prospect matched.
 */
async function ingestInboundEmail(
  supabase: SupabaseClient<any, any, any>,
  parsed: ParsedMessage,
): Promise<boolean> {
  // Try to resolve the sender to a prospect (or several with the same
  // email). cancelPendingDripRows uses the email selector so one entry
  // covers every linked company.
  const { data: prospects } = await (supabase as any)
    .from("prospects")
    .select("id, email")
    .ilike("email", parsed.fromEmail)
  const matched = (prospects ?? []) as Array<{ id: string; email: string }>

  // Upsert the inbound row. ON CONFLICT (provider, provider_message_id)
  // means re-syncing the same message is a no-op.
  const { error: insertErr } = await (supabase as any)
    .from("inbound_emails")
    .upsert(
      {
        provider: "gmail",
        provider_message_id: parsed.providerMessageId,
        thread_id: parsed.threadId,
        from_email: parsed.fromEmail,
        from_name: parsed.fromName,
        to_emails: parsed.toEmails,
        subject: parsed.subject,
        snippet: parsed.snippet,
        body_text: parsed.bodyText,
        body_html: parsed.bodyHtml,
        received_at: parsed.receivedAt,
        prospect_id: matched[0]?.id ?? null,
        metadata: parsed.metadata,
      },
      { onConflict: "provider,provider_message_id" },
    )
  if (insertErr) throw new Error(`inbound_emails upsert failed: ${insertErr.message}`)

  if (matched.length === 0) return false

  // Stamp prospects.replied_at + log events. Idempotent via the
  // .is(replied_at, null) guard so resyncs don't re-stamp the timestamp.
  const replyAt = parsed.receivedAt
  const { data: stamped } = await (supabase as any)
    .from("prospects")
    .update({ replied_at: replyAt })
    .ilike("email", parsed.fromEmail)
    .is("replied_at", null)
    .select("id")
  const newlyStampedIds = ((stamped ?? []) as Array<{ id: string }>).map((r) => r.id)

  if (newlyStampedIds.length > 0) {
    await supabase.from("prospect_events").insert(
      newlyStampedIds.map((id) => ({
        prospect_id: id,
        event_type: "replied",
        metadata: {
          email: parsed.fromEmail,
          gmail_message_id: parsed.providerMessageId,
          subject: parsed.subject,
        },
      })),
    )
  }

  // Cancel pending drips by email (covers every company / template
  // they were enrolled in). Idempotent — already-cancelled rows aren't
  // touched again.
  try {
    const { cancelPendingDripRows } = await import("@/lib/drip-queue")
    await cancelPendingDripRows(supabase, {
      email: parsed.fromEmail,
      reason: "replied",
    })
  } catch (err) {
    logger.error("[gmail-sync] drip cancellation on reply failed", {
      email: parsed.fromEmail,
      error: err,
    })
  }

  return true
}

async function markConnectionError(
  supabase: SupabaseClient<any, any, any>,
  connectionId: string,
  message: string,
): Promise<void> {
  await (supabase as any)
    .from("gmail_connections")
    .update({
      last_sync_error: message,
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId)
}
