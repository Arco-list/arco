import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

/**
 * Pinterest v5 API client — thin wrapper around the four calls we need:
 * create / delete / patch a pin, plus refresh_token.
 *
 * Auth model: the Arco business account's access + refresh tokens live in
 * a single-row `pinterest_auth` table (see migration 182). Access tokens
 * expire in 30 days, refresh in 1 year. This client refreshes lazily —
 * any call whose access token is < 60 s from expiry triggers a
 * refresh_token round-trip first, so the weekly health-check cron can
 * catch a refresh failure long before the token actually dies.
 *
 * Rate limits: Pinterest allows ~1000 pin operations / hr for a standard
 * app. The cron worker caps each tick at 8 rows (~96/hr sustained),
 * which is fine at Arco's current inventory; revisit if the queue starts
 * backlogging.
 *
 * Errors: bubble up as thrown Errors with the Pinterest response body
 * attached. The worker's try/catch decides transient vs. permanent.
 */

// API host — production by default. Override via env for the Sandbox
// host (https://api-sandbox.pinterest.com) while the app is in Trial
// access mode. Once Standard access is granted, unset the env.
const PINTEREST_API_HOST = (process.env.PINTEREST_API_BASE?.trim() || "https://api.pinterest.com").replace(/\/+$/, "")
const PINTEREST_API_BASE = `${PINTEREST_API_HOST}/v5`
// OAuth authorize URL. Pinterest reuses the production authorize URL
// for both environments (www.pinterest.com/oauth) — only the API host
// differs between prod and sandbox. Only override PINTEREST_AUTHORIZE_BASE
// if you have a specific reason (e.g. Pinterest's docs change and split
// the environments in the future).
const PINTEREST_AUTHORIZE_HOST = (process.env.PINTEREST_AUTHORIZE_BASE?.trim() || "https://www.pinterest.com").replace(/\/+$/, "")
const REFRESH_SKEW_SECONDS = 60

// ── Types ────────────────────────────────────────────────────────────────
export interface CreatePinInput {
  boardId: string
  title: string
  description: string
  link: string
  altText?: string
  imageUrl: string
}

export interface CreatePinOutput {
  pinId: string
  pinUrl: string | null
}

export interface PatchPinInput {
  pinId: string
  title?: string
  description?: string
  link?: string
}

// ── Access token cache ───────────────────────────────────────────────────
// In-memory only. The Vercel function may cold-start between cron ticks,
// which forces a DB read; harmless. If two ticks race a refresh we
// tolerate double-writes to pinterest_auth — the row is single-key so
// last-write-wins is fine.
let cachedToken: { token: string; expiresAt: Date } | null = null

async function getAccessToken(): Promise<string> {
  const now = new Date()
  if (
    cachedToken &&
    cachedToken.expiresAt.getTime() - now.getTime() > REFRESH_SKEW_SECONDS * 1000
  ) {
    return cachedToken.token
  }

  const supabase = createServiceRoleSupabaseClient()
  const { data, error } = await supabase
    .from("pinterest_auth")
    .select("access_token, refresh_token, access_token_expires_at, refresh_token_expires_at")
    .eq("id", 1)
    .maybeSingle()

  if (error) throw new Error(`pinterest_auth read failed: ${error.message}`)
  if (!data) throw new Error("pinterest_auth row missing — run the OAuth bootstrap first.")
  if (!data.refresh_token) {
    throw new Error(
      "pinterest_auth.refresh_token is null — run the OAuth bootstrap at /admin/pinterest to authorize the account.",
    )
  }

  const accessExpiry = data.access_token_expires_at
    ? new Date(data.access_token_expires_at)
    : new Date(0)

  if (
    data.access_token &&
    accessExpiry.getTime() - now.getTime() > REFRESH_SKEW_SECONDS * 1000
  ) {
    cachedToken = { token: data.access_token, expiresAt: accessExpiry }
    return data.access_token
  }

  // Refresh needed.
  const refreshed = await refreshAccessToken(data.refresh_token)
  cachedToken = { token: refreshed.access_token, expiresAt: refreshed.access_token_expires_at }
  return refreshed.access_token
}

// ── OAuth: refresh token grant ───────────────────────────────────────────
interface RefreshTokenResponse {
  access_token: string
  refresh_token?: string
  token_type: string
  expires_in: number
  refresh_token_expires_in?: number
  scope?: string
}

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string
  access_token_expires_at: Date
}> {
  const clientId = process.env.PINTEREST_CLIENT_ID
  const clientSecret = process.env.PINTEREST_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error("PINTEREST_CLIENT_ID / PINTEREST_CLIENT_SECRET not configured.")
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  })

  const res = await fetch(`${PINTEREST_API_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Pinterest refresh_token failed: HTTP ${res.status} — ${text}`)
  }
  const json = (await res.json()) as RefreshTokenResponse

  const now = new Date()
  const accessExpiresAt = new Date(now.getTime() + json.expires_in * 1000)
  const refreshExpiresAt = json.refresh_token_expires_in
    ? new Date(now.getTime() + json.refresh_token_expires_in * 1000)
    : null

  // Persist the rotated tokens. Only overwrite refresh_token if Pinterest
  // rotated it (some grants return the same one).
  const supabase = createServiceRoleSupabaseClient()
  const update: {
    access_token: string
    access_token_expires_at: string
    refresh_token?: string
    refresh_token_expires_at?: string
    scope?: string
  } = {
    access_token: json.access_token,
    access_token_expires_at: accessExpiresAt.toISOString(),
  }
  if (json.refresh_token) update.refresh_token = json.refresh_token
  if (refreshExpiresAt) update.refresh_token_expires_at = refreshExpiresAt.toISOString()
  if (json.scope) update.scope = json.scope

  const { error } = await supabase.from("pinterest_auth").update(update).eq("id", 1)
  if (error) {
    throw new Error(`pinterest_auth write failed: ${error.message}`)
  }
  return { access_token: json.access_token, access_token_expires_at: accessExpiresAt }
}

// ── OAuth: authorization code exchange (bootstrap only) ──────────────────
export interface ExchangeCodeInput {
  code: string
  redirectUri: string
}

export async function exchangeAuthCode(input: ExchangeCodeInput): Promise<void> {
  const clientId = process.env.PINTEREST_CLIENT_ID
  const clientSecret = process.env.PINTEREST_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error("PINTEREST_CLIENT_ID / PINTEREST_CLIENT_SECRET not configured.")
  }
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
  })
  const res = await fetch(`${PINTEREST_API_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Pinterest authorization_code exchange failed: HTTP ${res.status} — ${text}`)
  }
  const json = (await res.json()) as RefreshTokenResponse

  const now = new Date()
  const accessExpiresAt = new Date(now.getTime() + json.expires_in * 1000)
  const refreshExpiresAt = json.refresh_token_expires_in
    ? new Date(now.getTime() + json.refresh_token_expires_in * 1000)
    : null

  const supabase = createServiceRoleSupabaseClient()
  const { error } = await supabase
    .from("pinterest_auth")
    .update({
      access_token: json.access_token,
      refresh_token: json.refresh_token ?? null,
      access_token_expires_at: accessExpiresAt.toISOString(),
      refresh_token_expires_at: refreshExpiresAt?.toISOString() ?? null,
      scope: json.scope ?? null,
    })
    .eq("id", 1)
  if (error) throw new Error(`pinterest_auth write failed: ${error.message}`)
  cachedToken = { token: json.access_token, expiresAt: accessExpiresAt }
}

// ── HTTP helper ──────────────────────────────────────────────────────────
async function callPinterest<T>(
  method: string,
  path: string,
  body?: unknown,
  isRetry = false,
): Promise<T> {
  const token = await getAccessToken()
  const res = await fetch(`${PINTEREST_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  // On 401 the cached token may be stale (Pinterest revoked mid-window,
  // env switched, etc). Invalidate + retry once; if it fails again, bubble.
  if (res.status === 401 && !isRetry) {
    cachedToken = null
    return callPinterest<T>(method, path, body, true)
  }
  if (res.status === 204) return undefined as T
  const raw = await res.text()
  let json: unknown = null
  if (raw) {
    try { json = JSON.parse(raw) } catch { /* keep raw */ }
  }
  if (!res.ok) {
    const message =
      (json && typeof json === "object" && "message" in json && (json as { message?: string }).message) ||
      raw ||
      res.statusText
    const err = new Error(`Pinterest ${method} ${path} failed: HTTP ${res.status} — ${message}`)
    // Attach the status so the worker can classify transient (5xx / 429)
    // vs. permanent (400 / 401 / 403 / 404).
    ;(err as Error & { status?: number }).status = res.status
    throw err
  }
  return json as T
}

// ── Board operations ─────────────────────────────────────────────────────
export interface CreateBoardInput {
  name: string
  description?: string
  privacy?: "PUBLIC" | "PROTECTED" | "SECRET"
}

export interface CreateBoardOutput {
  boardId: string
  name: string
}

/** Paginate through every board on the connected account. Pinterest
 *  caps page_size at 250; the loop follows the `bookmark` cursor until
 *  the response omits it. */
export async function listBoards(): Promise<CreateBoardOutput[]> {
  const out: CreateBoardOutput[] = []
  let bookmark: string | undefined
  do {
    const qs = new URLSearchParams({ page_size: "250" })
    if (bookmark) qs.set("bookmark", bookmark)
    const res = await callPinterest<{ items: { id: string; name: string }[]; bookmark?: string }>(
      "GET",
      `/boards?${qs.toString()}`,
    )
    for (const item of res.items ?? []) {
      out.push({ boardId: item.id, name: item.name })
    }
    bookmark = res.bookmark
  } while (bookmark)
  return out
}

export async function createBoard(input: CreateBoardInput): Promise<CreateBoardOutput> {
  const body = {
    name: input.name,
    description: input.description,
    privacy: input.privacy ?? "PUBLIC",
  }
  const res = await callPinterest<{ id: string; name: string }>("POST", "/boards", body)
  return { boardId: res.id, name: res.name }
}

// ── Pin operations ───────────────────────────────────────────────────────
export async function createPin(input: CreatePinInput): Promise<CreatePinOutput> {
  const body = {
    board_id: input.boardId,
    title: input.title,
    description: input.description,
    link: input.link,
    alt_text: input.altText,
    media_source: {
      source_type: "image_url",
      url: input.imageUrl,
    },
  }
  const res = await callPinterest<{ id: string; url?: string }>("POST", "/pins", body)
  return { pinId: res.id, pinUrl: res.url ?? null }
}

export async function deletePin(pinId: string): Promise<void> {
  await callPinterest<void>("DELETE", `/pins/${pinId}`)
}

export async function patchPin(input: PatchPinInput): Promise<void> {
  const patch: Record<string, string> = {}
  if (input.title !== undefined) patch.title = input.title
  if (input.description !== undefined) patch.description = input.description
  if (input.link !== undefined) patch.link = input.link
  if (Object.keys(patch).length === 0) return
  await callPinterest<void>("PATCH", `/pins/${input.pinId}`, patch)
}

// ── Public authorize URL builder (used by the OAuth bootstrap route) ─────
export function buildAuthorizeUrl(input: {
  redirectUri: string
  state: string
  scopes?: string[]
}): string {
  const clientId = process.env.PINTEREST_CLIENT_ID
  if (!clientId) throw new Error("PINTEREST_CLIENT_ID not configured.")
  const scope = (input.scopes ?? [
    "pins:read",
    "pins:write",
    "boards:read",
    "boards:write",
  ]).join(",")
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: input.redirectUri,
    scope,
    state: input.state,
  })
  return `${PINTEREST_AUTHORIZE_HOST}/oauth/?${params.toString()}`
}
