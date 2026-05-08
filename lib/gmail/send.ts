import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getValidAccessToken } from "./sync"
import { logger } from "@/lib/logger"

/**
 * Send a threaded reply via the Gmail API.
 *
 * Used by the /admin/inbox Respond popup. Looks up the gmail_connection
 * (we use the first connected mailbox — practically always
 * hello@arcolist.com today), refreshes its access token if needed,
 * builds an RFC 2822 message with In-Reply-To + References headers
 * threaded to the original Message-ID, and POSTs it via
 * users.messages.send.
 *
 * Returns the new Gmail message id on success. Errors propagate so
 * the UI can surface them to the admin.
 *
 * Threading caveat: Gmail uses both `threadId` (its own grouping) and
 * the standard `In-Reply-To`/`References` headers. We pass both so the
 * thread renders correctly in the recipient's inbox client AND
 * subsequent replies from them get matched back to this thread by our
 * sync.
 */

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1"

export type SendReplyArgs = {
  /** Recipient's email address — usually the original sender we're replying to. */
  to: string
  /** Subject line. We don't auto-prefix "Re:" — caller decides. */
  subject: string
  /** Plain-text body. UTF-8 OK; we base64-encode the body so accents pass through. */
  bodyText: string
  /** Gmail thread id to reply within. Optional but strongly preferred. */
  threadId?: string | null
  /** RFC 5322 Message-ID header from the email being replied to (e.g. "<abc@example.com>"). */
  inReplyTo?: string | null
  /** RFC 5322 References chain, if any. We append inReplyTo if both are missing. */
  references?: string | null
}

export type SendReplyResult = {
  messageId: string
  threadId: string
  fromAddress: string
}

export async function sendGmailReply(
  supabase: SupabaseClient<any, any, any>,
  args: SendReplyArgs,
): Promise<SendReplyResult> {
  const { data: connections, error: connErr } = await (supabase as any)
    .from("gmail_connections")
    .select("id, gmail_address, refresh_token, access_token, access_token_expires_at")
    .order("created_at", { ascending: true })
    .limit(1)

  if (connErr) throw new Error(`Could not load gmail_connections: ${connErr.message}`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conn = ((connections ?? []) as any[])[0]
  if (!conn) {
    throw new Error("No connected Gmail mailbox — connect one at /admin/inbox first.")
  }

  const accessToken = await getValidAccessToken(supabase, conn)
  const fromAddress = `Niek van Leeuwen <${conn.gmail_address}>`

  const raw = buildRawRfc2822({
    from: fromAddress,
    to: args.to,
    subject: args.subject,
    bodyText: args.bodyText,
    inReplyTo: args.inReplyTo ?? null,
    references: args.references ?? args.inReplyTo ?? null,
  })

  const body: { raw: string; threadId?: string } = { raw }
  if (args.threadId) body.threadId = args.threadId

  const r = await fetch(`${GMAIL_API_BASE}/users/me/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!r.ok) {
    const text = await r.text()
    logger.error("[gmail-send] failed", { status: r.status, body: text })
    throw new Error(`Gmail send failed (${r.status}): ${text}`)
  }

  const json = (await r.json()) as { id: string; threadId: string }
  return { messageId: json.id, threadId: json.threadId, fromAddress }
}

/**
 * Build a base64url-encoded RFC 2822 message Gmail can accept on
 * users.messages.send. Body is base64-encoded with charset=utf-8 so
 * Dutch characters (ë, ï, é) survive the round-trip; subject is RFC
 * 2047 encoded-word when it contains non-ASCII so threading clients
 * don't mangle it.
 */
function buildRawRfc2822(args: {
  from: string
  to: string
  subject: string
  bodyText: string
  inReplyTo: string | null
  references: string | null
}): string {
  const headers: string[] = [
    `From: ${args.from}`,
    `To: ${args.to}`,
    `Subject: ${encodeMimeSubject(args.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
  ]
  if (args.inReplyTo) headers.push(`In-Reply-To: ${args.inReplyTo}`)
  if (args.references) headers.push(`References: ${args.references}`)

  const bodyB64 = Buffer.from(args.bodyText, "utf8")
    .toString("base64")
    // Hard-wrap at 76 chars per RFC 2045. Most clients tolerate longer
    // but some strict ones reject.
    .replace(/(.{76})/g, "$1\r\n")

  const message = headers.join("\r\n") + "\r\n\r\n" + bodyB64
  return Buffer.from(message, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

/**
 * RFC 2047 encoded-word for non-ASCII subjects. Pure-ASCII subjects
 * pass through unmodified (most readable + smallest payload).
 */
function encodeMimeSubject(subject: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(subject)) return subject
  const encoded = Buffer.from(subject, "utf8").toString("base64")
  return `=?UTF-8?B?${encoded}?=`
}
