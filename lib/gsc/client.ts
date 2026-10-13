import "server-only"

import crypto from "crypto"

/**
 * Eén ingang naar de Search Console API.
 *
 * De authenticatie stond in lib/gsc-sync.ts en was daar privé, dus een
 * tweede aanroeper zou hem hebben gekopieerd — inclusief het stuk dat
 * het makkelijkst stilletjes uit de pas loopt. Domain-wide delegation
 * (de `sub`-claim) is daar een voorbeeld van: zonder die claim heeft het
 * serviceaccount nul properties en antwoordt de API met 403 op álles.
 * Dat is een foutmelding die niets over de oorzaak zegt, dus hij hoort
 * op één plek te staan met de uitleg erbij.
 */

const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"

/** Zoals de property in Search Console geregistreerd staat — mét slash. */
export const GSC_PROPERTY = "https://www.arcolist.com/"
/** Zonder slash, voor het bouwen van URL's. */
export const SITE_URL = "https://www.arcolist.com"

type ServiceAccount = {
  client_email: string
  private_key: string
  token_uri?: string
}

function loadServiceAccount(): ServiceAccount {
  const raw = process.env.GOOGLE_GSC_SERVICE_ACCOUNT
  if (!raw) throw new Error("GOOGLE_GSC_SERVICE_ACCOUNT env var not set")
  try {
    const parsed = JSON.parse(raw) as ServiceAccount
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error("client_email or private_key missing")
    }
    return parsed
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`GOOGLE_GSC_SERVICE_ACCOUNT is not valid JSON: ${msg}`)
  }
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")
}

/**
 * Service-account JWT, ingewisseld voor een access token.
 *
 * GSC_IMPERSONATE_USER laat het serviceaccount optreden ALS die
 * Workspace-gebruiker, die de property al heeft. Dat scheelt de "Add
 * user"-route in Search Console, die Workspace-beleid kan weigeren voor
 * adressen buiten het domein. De `sub`-claim zet dat in gang; de
 * Workspace-beheerder moet de Client ID van dit serviceaccount plus de
 * scope hierboven hebben geautoriseerd onder Domain-wide delegation.
 */
export async function getGscAccessToken(): Promise<string> {
  const sa = loadServiceAccount()
  const now = Math.floor(Date.now() / 1000)
  const claim: Record<string, unknown> = {
    iss: sa.client_email,
    scope: GSC_SCOPE,
    aud: sa.token_uri || "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }
  const impersonate = process.env.GSC_IMPERSONATE_USER
  if (impersonate) claim.sub = impersonate

  const signingInput = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(JSON.stringify(claim))}`
  const signer = crypto.createSign("RSA-SHA256")
  signer.update(signingInput)
  signer.end()
  const jwt = `${signingInput}.${base64url(signer.sign(sa.private_key))}`

  const res = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`)
  return ((await res.json()) as { access_token: string }).access_token
}

export type SearchAnalyticsRow = {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

/** Eén Search Analytics-aanroep. Max 25.000 rijen per antwoord. */
export async function searchAnalyticsQuery(
  token: string,
  body: Record<string, unknown>,
): Promise<SearchAnalyticsRow[]> {
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_PROPERTY)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  )
  if (!res.ok) {
    throw new Error(`Search Analytics ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }
  return ((await res.json()) as { rows?: SearchAnalyticsRow[] }).rows ?? []
}

/** Alles ophalen, paginerend over startRow tot Google minder dan een volle pagina teruggeeft. */
export async function searchAnalyticsQueryAll(
  token: string,
  body: Record<string, unknown>,
  pageSize = 25000,
): Promise<{ rows: SearchAnalyticsRow[]; truncated: boolean }> {
  const rows: SearchAnalyticsRow[] = []
  let startRow = 0
  // Een plafond, zodat een onverwacht antwoord geen oneindige lus wordt.
  const MAX_PAGES = 20
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await searchAnalyticsQuery(token, { ...body, rowLimit: pageSize, startRow })
    rows.push(...batch)
    if (batch.length < pageSize) return { rows, truncated: false }
    startRow += pageSize
  }
  return { rows, truncated: true }
}
