// Google Search Console — per-URL indexatie.
//
// Loopt met de URL Inspection API (`urlInspection.index.inspect`) langs
// elk gepubliceerd project en elk listed/prospected bedrijf, en schrijft
// het oordeel (PASS / PARTIAL / FAIL / NEUTRAL), de canonical die Google
// koos en een 28-daagse rollup terug naar de seo_*-kolommen op die
// rijen. Limiet ~2.000 aanroepen per dag; de huidige lus doet er ~274.
//
// De SITEBREDE cijfers — per dag, per pagina, per zoekopdracht — staan
// in lib/seo/sync-pages.ts met een eigen cron. Ze stonden hier, achter
// deze lus, en haalden het einde van de functie niet meer.
//
// Authenticatie in lib/gsc/client.ts, gedeeld met die sync.
//
// Zie docs/SETUP_GSC_SYNC.md voor de eenmalige GCP + Search Console-setup.
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { getGscAccessToken, GSC_PROPERTY, SITE_URL } from "@/lib/gsc/client"


type IndexationState = "PASS" | "PARTIAL" | "FAIL" | "NEUTRAL" | "PENDING"

export type GscSyncResult = {
  projectsSynced: number
  companiesSynced: number
  total: number
  errorCount: number
  lastError: string | null
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

type InspectResponse = {
  inspectionResult?: {
    indexStatusResult?: {
      verdict?: string                 // PASS|PARTIAL|FAIL|NEUTRAL
      googleCanonical?: string         // canonical Google actually picked
      userCanonical?: string           // canonical we declared
    }
  }
}

// 8s per URL — typical responses are 1–3s. Beyond 8s the call is almost
// certainly hung (rare but does happen on URLs Google hasn't recrawled
// recently); we'd rather skip-and-retry-tomorrow than hold the whole cron
// hostage. With 79 URLs at concurrency 10 worst case is ~64s.
const URL_INSPECTION_TIMEOUT_MS = 8_000

async function inspectUrl(token: string, url: string): Promise<{
  state: IndexationState
  indexed: boolean
  canonicalChosen: string | null
}> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), URL_INSPECTION_TIMEOUT_MS)
  try {
    const res = await fetch(
      "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ inspectionUrl: url, siteUrl: GSC_PROPERTY }),
        signal: controller.signal,
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
  } finally {
    clearTimeout(timeoutId)
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

// DE DAGREEKS EN DE ZOEKOPDRACHTEN STAAN HIER NIET MEER.
//
// Ze stonden achter de lus hierboven en werden daardoor nooit bereikt:
// 274 URL-inspecties duurden vanaf 30 september langer dan de 300
// seconden van Vercel, en de run eindigde elke nacht op "This operation
// was aborted". Dat bleef vier dagen onzichtbaar, want de inspectie
// zelf slaagde wel en schreef netjes zijn rijen weg.
//
// Nu in lib/seo/sync-pages.ts met een eigen cron
// (/api/cron/sync-seo-pages). De cijfers horen niet achter de traagste
// aanroep van het platform te staan.

type RowToSync = {
  table: "projects" | "companies"
  id: string
  /** URL variants to inspect, most-likely-indexed first. Locale routing
   *  means the real indexed page is /nl/... or /en/... — the bare URL
   *  307-redirects, and URL Inspection reports a redirect as "not on
   *  Google" (NEUTRAL), which mis-flagged indexed pages as Not indexed. */
  urls: string[]
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
  const token = await getGscAccessToken()

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
      // nl + en only: the bare URL 307-redirects and always inspects as
      // NEUTRAL — paying 8s for it per non-indexed page blew the cron's
      // 300s budget (two 504s at the tail on 2026-08-24).
      urls: [
        `${SITE_URL}/nl/projects/${(r as any).slug}`,
        `${SITE_URL}/en/projects/${(r as any).slug}`,
      ],
    }))),
    ...((companyRows ?? []).map((r) => ({
      table: "companies" as const,
      id: (r as any).id,
      urls: [
        `${SITE_URL}/nl/professionals/${(r as any).slug}`,
        `${SITE_URL}/en/professionals/${(r as any).slug}`,
      ],
    }))),
  ]

  // One Search Analytics call covers the whole property.
  logger.info("[gsc-sync] fetching Search Analytics 28d window", { targetCount: targets.length })
  const performance = await fetchPagePerformance28d(token)
  logger.info("[gsc-sync] Search Analytics returned", { rowsWithImpressions: performance.size })

  let projectsSynced = 0
  let companiesSynced = 0
  let errorCount = 0
  let lastError: string | null = null
  const now = new Date().toISOString()

  // Process URL Inspection in batches of 10 in parallel. URL Inspection is
  // the slow part (1–8s per URL); serial would blow the 300s Vercel timeout
  // on ~80 URLs. Search Analytics is already a single bulk call. Each batch's
  // failures are isolated so one bad URL can't poison the whole run.
  const CONCURRENCY = 14
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY)
    logger.info("[gsc-sync] batch", { from: i, to: i + batch.length, total: targets.length })
    const results = await Promise.allSettled(
      batch.map(async (target) => {
        // Inspect variants until one is indexed; a page counts as indexed
        // when ANY of its locale variants is on Google. The first (nl)
        // result is the fallback verdict when none are.
        let inspection = await inspectUrl(token, target.urls[0])
        for (let v = 1; v < target.urls.length && !inspection.indexed; v++) {
          const next = await inspectUrl(token, target.urls[v])
          if (next.indexed) inspection = next
        }
        // Search Analytics splits impressions across the variants —
        // aggregate them (plus Google's chosen canonical if different).
        const perfUrls = new Set<string>(target.urls)
        if (inspection.canonicalChosen) perfUrls.add(inspection.canonicalChosen)
        let perf: { impressions: number; clicks: number; ctr: number; position: number | null } | null = null
        for (const u of perfUrls) {
          const p = performance.get(u)
          if (!p) continue
          if (!perf) perf = { impressions: 0, clicks: 0, ctr: 0, position: null }
          const prevImp = perf.impressions
          perf.impressions += p.impressions
          perf.clicks += p.clicks
          // Position: impression-weighted average across variants.
          perf.position = perf.position === null
            ? p.position
            : (perf.position * prevImp + (p.position ?? 0) * p.impressions) / Math.max(1, perf.impressions)
        }
        // Stored as a PERCENT (33.33, not 0.3333) — same unit as the
        // per-row mapping above; the admin tables append "%" verbatim.
        if (perf) perf.ctr = perf.impressions > 0 ? Math.round((perf.clicks / perf.impressions) * 100 * 100) / 100 : 0
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
        return target.table
      }),
    )
    for (let j = 0; j < results.length; j++) {
      const result = results[j]
      const target = batch[j]
      if (result.status === "fulfilled") {
        if (result.value === "projects") projectsSynced += 1
        else companiesSynced += 1
      } else {
        errorCount += 1
        lastError = result.reason instanceof Error ? result.reason.message : String(result.reason)
        logger.error("[gsc-sync] row failed", { url: target.urls[0], error: lastError })
      }
    }
  }

  logger.info("[gsc-sync] done", { projectsSynced, companiesSynced, errorCount })
  return {
    projectsSynced,
    companiesSynced,
    total: targets.length,
    errorCount,
    lastError,
  }
}
