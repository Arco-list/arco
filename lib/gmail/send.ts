import "server-only"

import { randomBytes } from "crypto"
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
  /**
   * Optional HTML alternative. When given, the message goes out as
   * multipart/alternative and bodyText becomes the fallback part.
   *
   * OPT-IN ON PURPOSE. Every existing caller sends text only and keeps
   * doing so — a reply typed in the inbox has nothing to gain from
   * markup, and silently turning the whole mailbox into HTML mail is a
   * change nobody asked for. Pass this only where the markup earns its
   * place, i.e. a link whose anchor text beats a 255-character URL.
   *
   * Keep it plain: an <a> and <br>, no styles, no tables, no images.
   * That is what Gmail's own compose window produces, and it is the
   * difference between a mail from a person and a mail from a system.
   */
  bodyHtml?: string | null
  /** Gmail thread id to reply within. Optional but strongly preferred. */
  threadId?: string | null
  /** RFC 5322 Message-ID header from the email being replied to (e.g. "<abc@example.com>"). */
  inReplyTo?: string | null
  /** RFC 5322 References chain, if any. We append inReplyTo if both are missing. */
  references?: string | null
  /** Our mailbox that RECEIVED the message being replied to (e.g.
   *  "niek@arcolist.com"). Gmail thread ids are per-mailbox, so the
   *  reply must go out through the same connection — sending via
   *  another mailbox with this thread id 404s ("Requested entity was
   *  not found"). Falls back to the oldest connection when absent. */
  preferredAddress?: string | null
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

  if (connErr) throw new Error(`Could not load gmail_connections: ${connErr.message}`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conns = (connections ?? []) as any[]
  const preferred = args.preferredAddress?.toLowerCase() ?? null
  const matched = preferred
    ? conns.find((c) => String(c.gmail_address).toLowerCase() === preferred) ?? null
    : null
  const conn = matched ?? conns[0]
  if (!conn) {
    throw new Error("No connected Gmail mailbox — connect one at /admin/inbox first.")
  }
  // Thread ids only exist within their own mailbox — if we couldn't
  // match the receiving mailbox's connection, drop the threadId and
  // let In-Reply-To/References do the threading instead of 404ing.
  const threadId = matched || !preferred ? args.threadId ?? null : null

  const accessToken = await getValidAccessToken(supabase, conn)
  const fromAddress = `Niek van Leeuwen <${conn.gmail_address}>`

  const raw = buildRawRfc2822({
    from: fromAddress,
    to: args.to,
    subject: args.subject,
    bodyText: args.bodyText,
    bodyHtml: args.bodyHtml ?? null,
    inReplyTo: args.inReplyTo ?? null,
    references: args.references ?? args.inReplyTo ?? null,
  })

  const post = (payload: { raw: string; threadId?: string }) =>
    fetch(`${GMAIL_API_BASE}/users/me/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

  let r = await post(threadId ? { raw, threadId } : { raw })

  // A thread id can go stale: the conversation was deleted from the
  // mailbox, or purged with age. Gmail answers that with a flat 404
  // "Requested entity was not found", which killed the send — a reply
  // to isis@enzoarchitecten.nl failed outright because the thread it
  // pointed at was from 11 May and no longer there.
  //
  // THREADING IS A NICETY, SENDING IS THE POINT. Dropping the id costs
  // the conversation grouping on OUR side only: In-Reply-To and
  // References still carry it, so the recipient's client threads the
  // reply exactly as before. Retried once, and only for the one error
  // the id can cause — the check above already handles the other
  // (a thread belonging to a different mailbox).
  if (!r.ok && r.status === 404 && threadId) {
    const stale = await r.text()
    logger.warn("[gmail-send] thread id not found, resending unthreaded", {
      threadId, mailbox: conn.gmail_address, body: stale.slice(0, 200),
    })
    r = await post({ raw })
  }

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
/** RFC 2045 hard-wrap: strict clients reject base64 lines over 76. */
function wrapB64(text: string): string {
  return Buffer.from(text, "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n")
}

function buildRawRfc2822(args: {
  from: string
  to: string
  subject: string
  bodyText: string
  bodyHtml?: string | null
  inReplyTo: string | null
  references: string | null
}): string {
  const headers: string[] = [
    `From: ${args.from}`,
    `To: ${args.to}`,
    `Subject: ${encodeMimeSubject(args.subject)}`,
    "MIME-Version: 1.0",
  ]
  if (args.inReplyTo) headers.push(`In-Reply-To: ${args.inReplyTo}`)
  if (args.references) headers.push(`References: ${args.references}`)

  let message: string
  if (args.bodyHtml) {
    // Random boundary: a fixed one can appear verbatim in a body and
    // split the message at the wrong place. Both parts are base64, so
    // the boundary can never collide with encoded content either way.
    const boundary = `=_arco_${randomBytes(12).toString("hex")}`
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
    // PLAIN FIRST, HTML LAST. Clients render the last part they
    // understand, so this order means an HTML client shows the link and
    // a text-only client falls back to the URL.
    message = [
      headers.join("\r\n"),
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: base64",
      "",
      wrapB64(args.bodyText),
      `--${boundary}`,
      "Content-Type: text/html; charset=utf-8",
      "Content-Transfer-Encoding: base64",
      "",
      wrapB64(args.bodyHtml),
      `--${boundary}--`,
    ].join("\r\n")
  } else {
    headers.push("Content-Type: text/plain; charset=utf-8")
    headers.push("Content-Transfer-Encoding: base64")
    message = headers.join("\r\n") + "\r\n\r\n" + wrapB64(args.bodyText)
  }
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
