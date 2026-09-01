import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Signed credit-acceptance tokens.
 *
 * Carried by the "Accepteer vermelding" CTA in professional-invite mail.
 * Today accepting a credit costs seven steps — log in, find the project
 * card among your listings, hover it, open the kebab, choose "Status
 * bijwerken", pick a status, save — and the funnel dies there: 18
 * invites sent, 3 landing visits, 0 accepts. The token removes the
 * NAVIGATION (finding the right credit), never the AUTHORISATION.
 *
 * Format: `<base64url(creditId:email:expiry)>.<base64url(hmac)>`
 *
 * Bound to the project_professionals row AND the address it was sent to,
 * so a token for one credit cannot accept another, and forwarding it
 * does not let a third party act as the recipient — a claimed company
 * still has to be signed in as itself (see acceptCreditAction).
 *
 * Expires after 7 days: an invite that has sat unopened for a week
 * should go through the normal signed-in path rather than a stale link.
 *
 * Secret precedence mirrors lib/unsubscribe-token.ts so dev environments
 * work without a second env var.
 */

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

function getSecret(): string {
  const secret = process.env.INVITE_ACCEPT_SECRET
    || process.env.UNSUBSCRIBE_SECRET
    || process.env.CRON_SECRET
  if (!secret) {
    throw new Error(
      "Invite accept token signing requires INVITE_ACCEPT_SECRET, UNSUBSCRIBE_SECRET or CRON_SECRET to be set",
    )
  }
  return secret
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64url(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/")
    + "=".repeat((4 - (input.length % 4)) % 4)
  return Buffer.from(padded, "base64")
}

function hmac(message: string): Buffer {
  return createHmac("sha256", getSecret()).update(message).digest()
}

export type AcceptTokenPayload = {
  /** project_professionals.id this token accepts. */
  creditId: string
  /** Address the invite was sent to, case-folded. */
  email: string
}

/** Sign an acceptance token for one credit, valid for 7 days. */
export function signAcceptToken(input: AcceptTokenPayload): string {
  const email = input.email.trim().toLowerCase()
  const expiry = Date.now() + TOKEN_TTL_MS
  const body = `${input.creditId}:${email}:${expiry}`
  return `${base64url(body)}.${base64url(hmac(body))}`
}

export type AcceptTokenResult =
  | { ok: true; creditId: string; email: string }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" }

/**
 * Verify and parse an acceptance token. Never throws on hostile input —
 * a malformed token must not 500 the endpoint.
 */
export function verifyAcceptToken(token: string | null | undefined): AcceptTokenResult {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return { ok: false, reason: "malformed" }
  }
  const [bodyPart, sigPart] = token.split(".", 2)
  if (!bodyPart || !sigPart) return { ok: false, reason: "malformed" }

  let body: string
  let provided: Buffer
  try {
    body = fromBase64url(bodyPart).toString("utf8")
    provided = fromBase64url(sigPart)
  } catch {
    return { ok: false, reason: "malformed" }
  }

  const parts = body.split(":")
  if (parts.length !== 3) return { ok: false, reason: "malformed" }
  const [creditId, email, expiryRaw] = parts
  const expiry = Number(expiryRaw)
  if (!creditId || !email || !Number.isFinite(expiry)) return { ok: false, reason: "malformed" }

  const expected = hmac(body)
  if (provided.length !== expected.length) return { ok: false, reason: "bad_signature" }
  // Constant-time compare so validity isn't leakable through timing.
  if (!timingSafeEqual(provided, expected)) return { ok: false, reason: "bad_signature" }

  // Expiry is checked AFTER the signature so an attacker can't probe
  // for valid credit ids by watching which errors come back.
  if (Date.now() > expiry) return { ok: false, reason: "expired" }

  return { ok: true, creditId, email }
}
