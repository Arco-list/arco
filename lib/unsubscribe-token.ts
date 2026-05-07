import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Signed unsubscribe tokens.
 *
 * Embedded in every Showcase / Invite / Outreach email's `List-Unsubscribe`
 * header + visible footer link. The token binds an unsubscribe URL to a
 * specific recipient email so a malicious actor can't unsubscribe someone
 * else by guessing URLs.
 *
 * Format: `<base64url(email)>.<base64url(hmac_sha256(email, SECRET))>`
 *
 * Signed by email — not prospect_id — so one unsubscribe stops every drip
 * to that recipient regardless of which prospect row prompted the click.
 * If a person has both an Outreach and an Invite for the same address,
 * unsubscribing from either kills both, which is the standard CAN-SPAM /
 * GDPR / Gmail-bulk-sender expectation.
 *
 * Secret precedence: UNSUBSCRIBE_SECRET → CRON_SECRET. The fallback keeps
 * dev environments working without setting a second env var; production
 * should set UNSUBSCRIBE_SECRET to a dedicated random string so rotating
 * cron credentials doesn't void every outstanding unsubscribe URL.
 */

function getSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET
  if (!secret) {
    throw new Error(
      "Unsubscribe token signing requires UNSUBSCRIBE_SECRET or CRON_SECRET to be set",
    )
  }
  return secret
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

function fromBase64url(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/")
    + "=".repeat((4 - (input.length % 4)) % 4)
  return Buffer.from(padded, "base64")
}

function hmac(message: string): Buffer {
  return createHmac("sha256", getSecret()).update(message).digest()
}

/** Sign an unsubscribe token for the given recipient email (case-folded). */
export function signUnsubscribeToken(email: string): string {
  const normalised = email.trim().toLowerCase()
  const sig = hmac(normalised)
  return `${base64url(normalised)}.${base64url(sig)}`
}

/**
 * Verify and parse an unsubscribe token. Returns the recipient email on
 * success, `null` when the signature doesn't match — never throws on
 * malformed input so a hostile request can't 500 the endpoint.
 */
export function verifyUnsubscribeToken(token: string | null | undefined): string | null {
  if (!token || typeof token !== "string" || !token.includes(".")) return null
  const [emailPart, sigPart] = token.split(".", 2)
  if (!emailPart || !sigPart) return null

  let email: string
  let provided: Buffer
  try {
    email = fromBase64url(emailPart).toString("utf8")
    provided = fromBase64url(sigPart)
  } catch {
    return null
  }

  if (!email.includes("@")) return null

  const expected = hmac(email)
  if (provided.length !== expected.length) return null
  // Constant-time compare so token validity isn't leakable through timing.
  if (!timingSafeEqual(provided, expected)) return null

  return email
}

/**
 * Absolute unsubscribe URL for the email body / List-Unsubscribe header.
 * Base URL falls back to the production origin so dev sends still produce
 * a clickable link in tested staging mailboxes.
 */
export function buildUnsubscribeUrl(email: string, baseUrl?: string): string {
  const base = baseUrl
    || process.env.NEXT_PUBLIC_SITE_URL
    || "https://www.arcolist.com"
  const token = signUnsubscribeToken(email)
  return `${base.replace(/\/$/, "")}/api/unsubscribe?t=${encodeURIComponent(token)}`
}
