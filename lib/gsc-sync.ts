// Google Search Console sync — pulls per-URL indexation + 28-day Search
// Analytics rollups for every published project and listed/prospected company,
// then writes them back to the SEO columns on those tables.
//
// Two GSC APIs in one job:
//   1. URL Inspection API (`urlInspection.index.inspect`) — per-URL verdict
//      (PASS / PARTIAL / FAIL / NEUTRAL) and the canonical Google picked.
//      Rate limit ~2,000 requests/day, current scale ~20 URLs.
//   2. Search Analytics API (`searchanalytics.query`) — bulk impressions /
//      clicks / CTR / position per page in a single call (one request per
//      property, returns up to 25k rows).
//
// Auth: service-account JWT signed with the private key from
// GOOGLE_GSC_SERVICE_ACCOUNT (JSON), exchanged at oauth2.googleapis.com/token
// for an access token. No npm dep — Node's built-in crypto handles RSA-SHA256.
//
// See docs/SETUP_GSC_SYNC.md for the one-time GCP + Search Console setup.
import crypto from "crypto"
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"

const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
const GSC_PROPERTY = "https://www.arcolist.com/"
const SITE_URL = "https://www.arcolist.com"

type ServiceAccount = {
  client_email: string
  private_key: string
  token_uri?: string
}

type IndexationState = "PASS" | "PARTIAL" | "FAIL" | "NEUTRAL" | "PENDING"

export type GscSyncResult = {
  projectsSynced: number
  companiesSynced: number
  total: number
  errorCount: number
  lastError: string | null
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

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

async function getAccessToken(): Promise<string> {
  const sa = loadServiceAccount()
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: "RS256", typ: "JWT" }
  // Domain-wide delegation: when GSC_IMPERSONATE_USER is set, the service
  // account acts as that Workspace user (who already has GSC property
  // access). Avoids the "Add user" path in Search Console, which Workspace
  // policy can refuse for non-domain emails. The `sub` claim is what
  // triggers impersonation; the Workspace admin must have authorised this
  // service account's Client ID + the webmasters.readonly scope under
  // admin.google.com → Security → API controls → Domain-wide delegation.
  const claim: Record<string, unknown> = {
    iss: sa.client_email,
    scope: GSC_SCOPE,
    aud: sa.token_uri || "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }
  const impersonate = process.env.GSC_IMPERSONATE_USER
  if (impersonate) claim.sub = impersonate
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`
  const signer = crypto.createSign("RSA-SHA256")
  signer.update(signingInput)
  signer.end()
  const signature = base64url(signer.sign(sa.private_key))
  const jwt = `${signingInput}.${signature}`

  const res = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Token exchange failed: ${res.status} ${body}`)
  }
  const json = (await res.json()) as { access_token: string }
  return json.access_token
}

// ─── URL Inspection ───────────────────────────────────────────────────────────

type InspectResponse = {
  inspectionResult?: {
    indexStatusResult?: {
      verdict?: string                 // PASS|PARTIAL|FAIL|NEUTRAL
      googleCanonical?: string         // canonical Google actually picked
      userCanonical?: string           // canonical we declared
    }
  }
}

async function inspectUrl(token: string, url: string): Promise<{
  state: IndexationState
  indexed: boolean
  canonicalChosen: string | null
}> {
  const res = await fetch(
    "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inspectionUrl: url, siteUrl: GSC_PROPERTY }),
    },
  )
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`URL inspection ${res.status} for ${url}: ${body}`)
  }
  const json = (await res.json()) as InspectResponse
  const verdict = (json.inspectionResult?.indexStatusResult?.verdict ?? "NEUTRAL") as IndexationState
  const canonicalChosen = json.inspectionResult?.indexStatusResult?.googleCanonical ?? null
  return {
    state: verdict,
    indexed: verdict === "PASS",
    canonicalChosen,
  }
}

// ─── Search Analytics ─────────────────────────────────────────────────────────

type SearchAnalyticsRow = {
  keys: string[]                       // [page url] when dimensions=['page']
  clicks: number
  impressions: number
  ctr: number                          // 0–1
  position: number
}

async function fetchPagePerformance28d(token: string): Promise<Map<string, {
  impressions: number
  clicks: number
  ctr: number
  position: number
}>> {
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(today.getDate() - 28)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  // Search Analytics still lives under the legacy Webmasters v3 path —
  // unlike URL Inspection, which is on searchconsole.googleapis.com v1.
  // https://developers.google.com/webmaster-tools/v1/searchanalytics/query
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_PROPERTY)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: fmt(startDate),
        endDate: fmt(today),
        dimensions: ["page"],
        rowLimit: 25000,
      }),
    },
  )
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Search Analytics ${res.status}: ${body}`)
  }
  const json = (await res.json()) as { rows?: SearchAnalyticsRow[] }
  const map = new Map<string, { impressions: number; clicks: number; ctr: number; position: number }>()
  for (const row of json.rows ?? []) {
    const url = row.keys?.[0]
    if (!url) continue
    map.set(url, {
      impressions: row.impressions,
      clicks: row.clicks,
      // CTR comes back as 0–1 from GSC; we store as percentage (0–100).
      ctr: Math.round(row.ctr * 100 * 100) / 100,
      position: Math.round(row.position * 100) / 100,
    })
  }
  return map
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

type RowToSync = {
  table: "projects" | "companies"
  id: string
  url: string
}

/**
 * Run a full GSC sync against every published project and every
 * listed/prospected company. Writes per-row indexation + 28-day performance
 * back to Supabase.
 *
 * Errors on a single URL are logged + counted but do not abort the run.
 */
export async function syncGscIndexation(): Promise<GscSyncResult> {
  const supabase = createServiceRoleSupabaseClient()
  const token = await getAccessToken()

  const [{ data: projectRows }, { data: companyRows }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, slug")
      .eq("status", "published")
      .not("slug", "is", null),
    supabase
      .from("companies")
      .select("id, slug")
      .in("status", ["listed", "prospected"])
      .not("slug", "is", null),
  ])

  const targets: RowToSync[] = [
    ...((projectRows ?? []).map((r) => ({
      table: "projects" as const,
      id: (r as any).id,
      url: `${SITE_URL}/projects/${(r as any).slug}`,
    }))),
    ...((companyRows ?? []).map((r) => ({
      table: "companies" as const,
      id: (r as any).id,
      url: `${SITE_URL}/professionals/${(r as any).slug}`,
    }))),
  ]

  // One Search Analytics call covers the whole property.
  const performance = await fetchPagePerformance28d(token)

  let projectsSynced = 0
  let companiesSynced = 0
  let errorCount = 0
  let lastError: string | null = null
  const now = new Date().toISOString()

  for (const target of targets) {
    try {
      const inspection = await inspectUrl(token, target.url)
      // Search Analytics indexes pages by their *Google-chosen* canonical, but
      // we'll match on our declared URL first and fall back to whatever Google
      // canonicalised to. Pages with no impressions are absent from the map.
      const perf =
        performance.get(target.url) ??
        (inspection.canonicalChosen ? performance.get(inspection.canonicalChosen) : undefined) ??
        null

      const update = {
        seo_indexed: inspection.indexed,
        seo_indexation_state: inspection.state,
        seo_canonical_chosen: inspection.canonicalChosen,
        seo_impressions_28d: perf?.impressions ?? 0,
        seo_clicks_28d: perf?.clicks ?? 0,
        seo_ctr_28d: perf?.ctr ?? 0,
        seo_position_28d: perf?.position ?? null,
        seo_synced_at: now,
      }
      const { error } = await supabase
        .from(target.table)
        .update(update as any)
        .eq("id", target.id)
      if (error) throw error

      if (target.table === "projects") projectsSynced += 1
      else companiesSynced += 1
    } catch (err) {
      errorCount += 1
      lastError = err instanceof Error ? err.message : String(err)
      logger.error("[gsc-sync] row failed", { url: target.url, error: lastError })
    }
  }

  return {
    projectsSynced,
    companiesSynced,
    total: targets.length,
    errorCount,
    lastError,
  }
}
