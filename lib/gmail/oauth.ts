import "server-only"

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto"

/**
 * Gmail OAuth + token storage helpers.
 *
 * Why server-only: refresh tokens never leave the server. The browser
 * just initiates the consent redirect via /api/auth/gmail and lands
 * back at /api/auth/gmail/callback — token exchange + storage happen
 * in route handlers.
 *
 * Required env vars:
 *   GMAIL_OAUTH_CLIENT_ID         — from Google Cloud Console
 *   GMAIL_OAUTH_CLIENT_SECRET     — from Google Cloud Console
 *   GMAIL_TOKEN_ENCRYPTION_KEY    — 32-byte secret, hex or base64
 *                                   (we accept either, hashed to 32B)
 *   NEXT_PUBLIC_SITE_URL          — used to build redirect_uri
 *
 * Scopes requested up front (all sensitive — Testing-mode allowlist
 * required until verification):
 *   gmail.readonly  — list + read inbox messages
 *   gmail.send      — post replies via the composer (slice 4)
 *   gmail.modify    — mark threads read / archived (slice 3 polish)
 */

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
] as const

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

export function getRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://www.arcolist.com"
  return `${base.replace(/\/$/, "")}/api/auth/gmail/callback`
}

/**
 * Build the Google OAuth consent URL. `state` is a CSRF token signed
 * by the caller; we just embed it verbatim.
 *
 * `prompt=consent` + `access_type=offline` together force Google to
 * always issue a refresh token (otherwise re-consenting the same
 * account silently returns only an access token, breaking the cron).
 */
export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("GMAIL_OAUTH_CLIENT_ID"),
    redirect_uri: getRedirectUri(),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: SCOPES.join(" "),
    state,
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

export type TokenExchangeResult = {
  refreshToken: string
  accessToken: string
  expiresAt: Date
  email: string
}

/**
 * Exchange the OAuth code from /api/auth/gmail/callback for tokens.
 * Also fetches the connected user's email via Google's userinfo so
 * the connection row knows which mailbox it represents.
 */
export async function exchangeCodeForTokens(code: string): Promise<TokenExchangeResult> {
  const body = new URLSearchParams({
    code,
    client_id: requireEnv("GMAIL_OAUTH_CLIENT_ID"),
    client_secret: requireEnv("GMAIL_OAUTH_CLIENT_SECRET"),
    redirect_uri: getRedirectUri(),
    grant_type: "authorization_code",
  })

  const r = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  if (!r.ok) {
    const text = await r.text()
    throw new Error(`Google token exchange failed (${r.status}): ${text}`)
  }
  const json = (await r.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
    id_token?: string
  }

  if (!json.refresh_token) {
    throw new Error(
      "Google didn't return a refresh_token — usually means access_type=offline + prompt=consent weren't both honoured. " +
        "Revoke the app in https://myaccount.google.com/permissions and reconnect.",
    )
  }

  const expiresAt = new Date(Date.now() + json.expires_in * 1000)
  const email = await fetchUserEmail(json.access_token)
  return {
    refreshToken: json.refresh_token,
    accessToken: json.access_token,
    expiresAt,
    email,
  }
}

/** Refresh an access token using a stored refresh token. */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string
  expiresAt: Date
}> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: requireEnv("GMAIL_OAUTH_CLIENT_ID"),
    client_secret: requireEnv("GMAIL_OAUTH_CLIENT_SECRET"),
    grant_type: "refresh_token",
  })
  const r = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  if (!r.ok) {
    const text = await r.text()
    throw new Error(`Google token refresh failed (${r.status}): ${text}`)
  }
  const json = (await r.json()) as { access_token: string; expires_in: number }
  return {
    accessToken: json.access_token,
    expiresAt: new Date(Date.now() + json.expires_in * 1000),
  }
}

/**
 * Resolve the connected mailbox's email address.
 *
 * Uses Gmail's own /users/me/profile rather than Google's userinfo
 * endpoint — userinfo requires the openid/email/profile scope, which
 * we don't request (we only need Gmail). The Gmail profile endpoint
 * returns emailAddress and is already authorized by gmail.readonly.
 */
async function fetchUserEmail(accessToken: string): Promise<string> {
  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!r.ok) {
    const text = await r.text()
    throw new Error(`Failed to fetch Gmail profile: ${r.status} ${text}`)
  }
  const json = (await r.json()) as { emailAddress?: string }
  if (!json.emailAddress) throw new Error("Gmail profile response missing emailAddress")
  return json.emailAddress
}

// ─── Refresh-token encryption ────────────────────────────────────────────
//
// AES-256-GCM. The 32-byte key is derived from GMAIL_TOKEN_ENCRYPTION_KEY
// via SHA-256 so any sufficiently-random env value works (hex / base64 /
// raw passphrase). Format on disk:
//
//   base64url( <12B IV> <16B AUTH TAG> <CIPHERTEXT> )
//
// Self-contained — nothing else needs to know the layout to decrypt.

function getEncryptionKey(): Buffer {
  const raw = requireEnv("GMAIL_TOKEN_ENCRYPTION_KEY")
  return createHash("sha256").update(raw).digest()
}

export function encryptRefreshToken(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, ciphertext])
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

export function decryptRefreshToken(payload: string): string {
  const padded = payload.replace(/-/g, "+").replace(/_/g, "/")
    + "=".repeat((4 - (payload.length % 4)) % 4)
  const buf = Buffer.from(padded, "base64")
  if (buf.length < 12 + 16 + 1) throw new Error("Encrypted refresh token is too short")
  const iv = buf.subarray(0, 12)
  const authTag = buf.subarray(12, 28)
  const ciphertext = buf.subarray(28)
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv)
  decipher.setAuthTag(authTag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plaintext.toString("utf8")
}
