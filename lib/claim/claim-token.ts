import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

/**
 * Signed, single-use claim tokens — the entry to the /claim funnel.
 *
 * Deliberately NOT an extension of lib/invites/accept-token.ts. That
 * token authorises one bounded act (flip a credit to live) and is
 * stateless, so replay is harmless. This one ends in a minted session
 * and a claimed company, so it needs the two properties the accept
 * token lacks: single use (claim_tokens.consumed_at) and a short TTL.
 *
 * The token is proof, not a session. Verifying it renders public
 * information about the recipient's own company; nothing is persisted
 * and no account exists until the explicit commit consumes it.
 *
 * Format: `<base64url(id:companyId:email:expiry)>.<base64url(hmac)>`
 */

// 14 days, not 48h: the e-mail sequences store the claim_url once and
// reuse it in follow-ups sent days later — a 48h token would hand every
// follow-up recipient an expired link. Still single-use and signed.
const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000

function getSecret(): string {
  const secret = process.env.INVITE_ACCEPT_SECRET
    || process.env.UNSUBSCRIBE_SECRET
    || process.env.CRON_SECRET
  if (!secret) {
    throw new Error(
      "Claim token signing requires INVITE_ACCEPT_SECRET, UNSUBSCRIBE_SECRET or CRON_SECRET to be set",
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

export type ClaimChannel = "invite" | "showcase" | "outreach" | "platform"

export type IssueClaimTokenInput = {
  companyId: string
  email: string
  /** The credit that carried the invite, when there is one. */
  creditId?: string | null
  /** Which funnel issued this — drives channel-specific copy on /claim. */
  channel?: ClaimChannel
}

/**
 * Issue a claim token: one row in claim_tokens plus the signed string.
 * The dispatcher will call this to build the email CTA once the flow
 * goes live; until then only manual/test issuance uses it.
 */
export async function issueClaimToken(
  input: IssueClaimTokenInput,
): Promise<{ token: string; url: string }> {
  const email = input.email.trim().toLowerCase()
  const expiry = Date.now() + TOKEN_TTL_MS
  const svc = createServiceRoleSupabaseClient()
  const { data, error } = await svc
    .from("claim_tokens" as never)
    .insert({
      company_id: input.companyId,
      credit_id: input.creditId ?? null,
      email,
      channel: input.channel ?? "invite",
      expires_at: new Date(expiry).toISOString(),
    } as never)
    .select("id")
    .single()
  if (error || !data) throw new Error(`claim token issuance failed: ${error?.message}`)

  const id = (data as { id: string }).id
  const body = `${id}:${input.companyId}:${email}:${expiry}`
  const token = `${base64url(body)}.${base64url(hmac(body))}`
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.arcolist.com"
  return { token, url: `${siteUrl}/claim?t=${encodeURIComponent(token)}` }
}

export type ClaimTokenResult =
  | { ok: true; id: string; companyId: string; email: string; creditId: string | null; channel: ClaimChannel; consumed: boolean }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" | "not_found" }

/**
 * Verify signature + expiry, then load the issuance row. Does NOT
 * consume — a GET (page view, mail scanner) must never spend the token.
 */
export async function verifyClaimToken(token: string | null | undefined): Promise<ClaimTokenResult> {
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
  if (parts.length !== 4) return { ok: false, reason: "malformed" }
  const [id, companyId, email, expiryRaw] = parts
  const expiry = Number(expiryRaw)
  if (!id || !companyId || !email || !Number.isFinite(expiry)) return { ok: false, reason: "malformed" }

  const expected = hmac(body)
  if (provided.length !== expected.length) return { ok: false, reason: "bad_signature" }
  if (!timingSafeEqual(provided, expected)) return { ok: false, reason: "bad_signature" }
  // Expiry after signature, so errors don't leak which ids are real.
  if (Date.now() > expiry) return { ok: false, reason: "expired" }

  const svc = createServiceRoleSupabaseClient()
  const { data } = await svc
    .from("claim_tokens" as never)
    .select("id, company_id, email, credit_id, channel, consumed_at")
    .eq("id", id)
    .maybeSingle()
  if (!data) return { ok: false, reason: "not_found" }
  const row = data as { id: string; company_id: string; email: string; credit_id: string | null; channel: string | null; consumed_at: string | null }
  return {
    ok: true,
    id: row.id,
    companyId: row.company_id,
    email: row.email,
    creditId: row.credit_id,
    channel: (row.channel as ClaimChannel) ?? "invite",
    consumed: row.consumed_at !== null,
  }
}

/**
 * Atomically consume the token. Only the caller that flips
 * consumed_at NULL → timestamp proceeds to create anything — same
 * claim-before-act lock as the invite dispatcher.
 */
export async function consumeClaimToken(id: string): Promise<boolean> {
  const svc = createServiceRoleSupabaseClient()
  const { data, error } = await svc
    .from("claim_tokens" as never)
    .update({ consumed_at: new Date().toISOString() } as never)
    .eq("id", id)
    .is("consumed_at", null)
    .select("id")
  if (error) {
    console.error("consumeClaimToken failed", error.message)
    return false
  }
  return ((data as unknown[])?.length ?? 0) > 0
}

/** Hand the claim back when the commit failed after consumption, so the
 *  recipient can retry instead of holding a dead link. */
export async function releaseClaimToken(id: string): Promise<void> {
  const svc = createServiceRoleSupabaseClient()
  await svc
    .from("claim_tokens" as never)
    .update({ consumed_at: null } as never)
    .eq("id", id)
}
