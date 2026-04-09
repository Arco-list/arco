import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isAdminUser } from "@/lib/auth-utils"

const POSTHOG_API_URL = "https://eu.posthog.com"
const POSTHOG_PROJECT_ID = "104218"

export async function GET(request: NextRequest) {
  // Auth check
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_types, admin_role")
    .eq("id", user.id)
    .single()
  if (!profile || !isAdminUser(profile.user_types, profile.admin_role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY
  if (!apiKey) {
    // Return 503 (not 200) so the client can distinguish "config error"
    // from "successful empty response". Previously this returned 200 OK
    // with { error } and the client silently rendered zeros across the
    // whole growth dashboard.
    return NextResponse.json(
      { error: "POSTHOG_PERSONAL_API_KEY not set on the server. Set it in Vercel → Settings → Environment Variables." },
      { status: 503 },
    )
  }

  const tf = request.nextUrl.searchParams.get("tf") || "months"
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1"
  const dateFromMap: Record<string, string> = {
    days: "-8d",
    weeks: "-56d",
    months: "-8m",
    years: "-8y",
  }
  // TrendsQuery paths ask PostHog for `month` and post-aggregate into years
  // because PostHog's TrendsQuery doesn't support `interval: year`. HogQL
  // paths use `year` natively via toStartOfYear() — more accurate and
  // saves the aggregation step entirely.
  const intervalMap: Record<string, string> = {
    days: "day",
    weeks: "week",
    months: "month",
    years: "month",
  }
  const hogqlIntervalMap: Record<string, string> = {
    days: "day",
    weeks: "week",
    months: "month",
    years: "year",
  }
  // Cache TTL per timeframe — shorter for days, longer for years
  const cacheTtlMinutes: Record<string, number> = {
    days: 30,
    weeks: 60,
    months: 360,
    years: 1440,
  }
  const dateFrom = dateFromMap[tf] ?? "-8m"
  const posthogInterval = intervalMap[tf] ?? "month"
  const hogqlVisitorInterval = hogqlIntervalMap[tf] ?? "month"
  const aggregateYears = tf === "years"
  const ttl = cacheTtlMinutes[tf] ?? 360

  // Check cache first
  if (!forceRefresh) {
    const { createServiceRoleSupabaseClient } = await import("@/lib/supabase/server")
    const cacheClient = createServiceRoleSupabaseClient()
    const { data: cached } = await cacheClient
      .from("posthog_cache")
      .select("data, fetched_at")
      .eq("timeframe", tf)
      .maybeSingle()

    if (cached) {
      const age = (Date.now() - new Date(cached.fetched_at).getTime()) / 60000
      if (age < ttl) {
        return NextResponse.json({ ...cached.data as object, _cached: true, _age_minutes: Math.round(age) })
      }
    }
  }

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

  // HogQL URL predicates.
  //   - Client: ALL unique pageview users, no URL filter. Matches the
  //     "Unique visitors" count on PostHog's web analytics dashboard
  //     exactly, so the two surfaces agree.
  //   - Pro: subset who specifically landed on /businesses/* (pro marketing
  //     pages — architect recruitment funnel).
  //   - Apollo/Invite: referral subsets keyed off URL params.
  const CLIENT_URL_PREDICATE = `1 = 1`
  const PRO_URL_PREDICATE = `properties.$current_url ILIKE '%/businesses%'`
  const APOLLO_URL_PREDICATE = `properties.$current_url ILIKE '%/businesses%' AND properties.$current_url ILIKE '%ref=%'`
  const INVITE_URL_PREDICATE = `properties.$current_url ILIKE '%inviteEmail=%'`

  try {
    // Batch 1: Core counts. Shares metrics are derived from the single
    // HogQL query in Batch 2 — no separate Batch 1 calls needed.
    const [proVisitors, clientVisitors] = await Promise.all([
      fetchVisitorCountHogQL(apiKey, dateFrom, PRO_URL_PREDICATE),
      fetchVisitorCountHogQL(apiKey, dateFrom, CLIENT_URL_PREDICATE),
    ])

    await delay(500)

    // Batch 2: Time series
    //
    // Visitor series (client + pro + apollo + invite) use HogQL because
    // the equivalent TrendsQuery with `not_icontains` was silently
    // dropping ~90% of users (observed: 7 vs 378 unique visitors in a
    // 7-day window). See fetchHogQL/fetchVisitorSeriesHogQL above.
    const [
      sharesAllSeries,
      proVisitorsHog,
      clientVisitorsHog,
      apolloVisitorsHog,
      inviteVisitorsHog,
    ] = await Promise.all([
      // All four Sharers metrics (sharers / project_shares / professional_shares
      // / shares_per_client) in a single HogQL query. HogQL instead of
      // TrendsQuery because stacked math filters on custom events were
      // returning inconsistent bucket shapes and dropping professional shares.
      fetchSharesSeriesHogQL(apiKey, dateFrom, hogqlVisitorInterval),
      fetchVisitorSeriesHogQL(apiKey, dateFrom, hogqlVisitorInterval, PRO_URL_PREDICATE),
      fetchVisitorSeriesHogQL(apiKey, dateFrom, hogqlVisitorInterval, CLIENT_URL_PREDICATE),
      fetchVisitorSeriesHogQL(apiKey, dateFrom, hogqlVisitorInterval, APOLLO_URL_PREDICATE),
      fetchVisitorSeriesHogQL(apiKey, dateFrom, hogqlVisitorInterval, INVITE_URL_PREDICATE),
    ])
    const sharersSeries = sharesAllSeries.sharersSeries
    const projectSharesSeries = sharesAllSeries.projectSharesSeries
    const professionalSharesSeries = sharesAllSeries.professionalSharesSeries
    const sharesPerClientSeries = sharesAllSeries.sharesPerClientSeries

    // Align each HogQL series to the 8-bucket window using the same
    // per-period alignment helper the TrendsQuery series use. This ensures
    // the rolling bucket (index 7) always represents the current period
    // no matter how many buckets HogQL returned.
    const proVisitorsSeries = alignToCurrent(proVisitorsHog.values, proVisitorsHog.days, hogqlVisitorInterval)
    const clientVisitorsSeries = alignToCurrent(clientVisitorsHog.values, clientVisitorsHog.days, hogqlVisitorInterval)
    const clientActivesSeries = clientVisitorsSeries // same query
    const apolloVisitorsSeries = alignToCurrent(apolloVisitorsHog.values, apolloVisitorsHog.days, hogqlVisitorInterval)
    const inviteVisitorsSeries = alignToCurrent(inviteVisitorsHog.values, inviteVisitorsHog.days, hogqlVisitorInterval)

    // Derive counts from series to avoid extra API calls
    const clientActives = clientVisitors // same query
    const apolloVisitors = apolloVisitorsSeries.reduce((a, b) => a + b, 0)
    const inviteVisitors = inviteVisitorsSeries.reduce((a, b) => a + b, 0)

    await delay(500)

    // Batch 3: Source breakdowns (2 calls). Client filter now drops only
    // /admin and /dashboard — /businesses is client-facing landing pages
    // and was previously being excluded incorrectly.
    const [clientSourcesRaw, proSourcesRaw] = await Promise.all([
      fetchSourceBreakdown(apiKey, dateFrom, [
        { key: "$current_url", operator: "not_icontains", value: "/admin", type: "event" },
        { key: "$current_url", operator: "not_icontains", value: "/dashboard", type: "event" },
      ]),
      fetchSourceBreakdown(apiKey, dateFrom, [
        { key: "$current_url", operator: "icontains", value: "/businesses", type: "event" },
      ]),
    ])

    // Group sources into categories
    const clientSources = groupSources(clientSourcesRaw)
    // Pro sources: prepend Sales (Apollo) and Invites, then standard referring domain categories
    const proReferralSources = groupSources(proSourcesRaw)
    const proTotal = (apolloVisitors ?? 0) + (inviteVisitors ?? 0) + proReferralSources.reduce((s, r) => s + r.count, 0)
    const proSources: SourceGroup[] = [
      ...(apolloVisitors ? [{ label: "Sales (Apollo)", count: apolloVisitors, pct: proTotal > 0 ? Math.round((apolloVisitors / proTotal) * 100) : 0 }] : []),
      ...(inviteVisitors ? [{ label: "Invites", count: inviteVisitors, pct: proTotal > 0 ? Math.round((inviteVisitors / proTotal) * 100) : 0 }] : []),
      ...proReferralSources,
    ]

    // Headline counts derived from the HogQL sharers series — sum across
    // the 8-bucket window so the card totals agree with the sparkline.
    // `uniqueSharers` is NOT the sum of bucketed uniqs (a user who shared
    // on two different days would be counted twice); for that we'd need
    // a separate HogQL query with no GROUP BY. For now the series is what
    // the UI actually renders, so the aggregate matches the bars shown.
    const totalProjectShares = projectSharesSeries.reduce((a, b) => a + b, 0)
    const totalProShares = professionalSharesSeries.reduce((a, b) => a + b, 0)
    const totalShares = totalProjectShares + totalProShares
    // Sum of bucketed uniq(person_id) — acceptable approximation of the
    // headline "Sharers" card that matches the per-bucket line chart.
    const uniqueSharers = sharersSeries.reduce((a, b) => a + b, 0)
    const sharesPerClient = uniqueSharers > 0 ? Math.round((totalShares / uniqueSharers) * 10) / 10 : 0

    await delay(500)

    // Batch 4: Per-source time series (8 calls)
    const [directClientSeries, googleClientSeries, socialClientSeries, emailClientSeries, referralClientSeries,
           directProSeries, googleProSeries, referralProSeries] = await Promise.all([
      // Client source series
      fetchSourceTimeSeries(apiKey, dateFrom, "client", "direct", posthogInterval, aggregateYears),
      fetchSourceTimeSeries(apiKey, dateFrom, "client", "google", posthogInterval, aggregateYears),
      fetchSourceTimeSeries(apiKey, dateFrom, "client", "social", posthogInterval, aggregateYears),
      fetchSourceTimeSeries(apiKey, dateFrom, "client", "email", posthogInterval, aggregateYears),
      fetchSourceTimeSeries(apiKey, dateFrom, "client", "referral", posthogInterval),
      // Pro source series
      fetchSourceTimeSeries(apiKey, dateFrom, "pro", "direct", posthogInterval, aggregateYears),
      fetchSourceTimeSeries(apiKey, dateFrom, "pro", "google", posthogInterval, aggregateYears),
      fetchSourceTimeSeries(apiKey, dateFrom, "pro", "referral", posthogInterval),
    ])

    const clientSourceSeries: Record<string, number[]> = {
      direct: directClientSeries, google: googleClientSeries,
      social: socialClientSeries, email: emailClientSeries, referral: referralClientSeries,
    }
    const proSourceSeries: Record<string, number[]> = {
      sales_apollo: apolloVisitorsSeries ?? [], invites: inviteVisitorsSeries ?? [],
      direct: directProSeries, google: googleProSeries, referral: referralProSeries,
    }

    const responseData = {
      proVisitors,
      clientVisitors,
      clientActives: clientActives ?? 0,
      proVisitorsSeries: proVisitorsSeries ?? [],
      clientVisitorsSeries: clientVisitorsSeries ?? [],
      clientActivesSeries: clientActivesSeries ?? [],
      apolloVisitorsSeries: apolloVisitorsSeries ?? [],
      inviteVisitorsSeries: inviteVisitorsSeries ?? [],
      sharersSeries: sharersSeries ?? [],
      projectSharesSeries,
      professionalSharesSeries,
      sharesPerClientSeries,
      sharers: uniqueSharers,
      totalShares,
      projectShares: totalProjectShares ?? 0,
      professionalShares: totalProShares ?? 0,
      sharesPerClient,
      apolloVisitors: apolloVisitors ?? 0,
      inviteVisitors: inviteVisitors ?? 0,
      clientSources,
      proSources,
      clientSourceSeries,
      proSourceSeries,
    }

    // Save to cache
    try {
      const { createServiceRoleSupabaseClient } = await import("@/lib/supabase/server")
      const cacheClient = createServiceRoleSupabaseClient()
      await cacheClient.from("posthog_cache").upsert({
        timeframe: tf,
        data: responseData,
        fetched_at: new Date().toISOString(),
      })
    } catch {}

    // Fresh fetches report _age_minutes = 0 so the client can use the
    // same freshness check for cached and live responses (e.g. disabling
    // the refresh button for 30 minutes after a bust).
    return NextResponse.json({ ...responseData, _cached: false, _age_minutes: 0 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("PostHog API error:", msg)
    return NextResponse.json({ proVisitors: null, clientVisitors: null, sharers: null, clientSources: [], proSources: [], debug_error: msg })
  }
}

/**
 * Run a raw HogQL query against PostHog and return the rows.
 * Used for the Visitors metrics because PostHog's TrendsQuery with stacked
 * `not_icontains` filters silently drops most users (observed: ~7 vs ~450
 * actual unique visitors). HogQL's uniqIf(...) gives us exact semantic
 * control over what counts as a user and returns the right numbers.
 */
async function fetchHogQL<T = any>(apiKey: string, query: string): Promise<T[]> {
  const res = await fetch(`${POSTHOG_API_URL}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: { kind: "HogQLQuery", query },
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    console.error("PostHog HogQL failed:", res.status, errText)
    return []
  }

  const data = await res.json()
  // HogQL response shape: { columns: string[], results: unknown[][], types: string[] }
  const columns: string[] = data?.columns ?? []
  const rows: unknown[][] = data?.results ?? []
  return rows.map((row) => {
    const obj: Record<string, unknown> = {}
    columns.forEach((col, i) => {
      obj[col] = row[i]
    })
    return obj as T
  })
}

/**
 * Map our timeframe interval into a HogQL DateTime truncation expression.
 * Returns a SQL fragment that snaps a timestamp to the start of its bucket.
 */
function hogqlBucketExpr(interval: string): string {
  switch (interval) {
    case "day": return "toStartOfDay(timestamp)"
    case "week": return "toStartOfWeek(timestamp)"
    case "month": return "toStartOfMonth(timestamp)"
    case "year": return "toStartOfYear(timestamp)"
    default: return "toStartOfDay(timestamp)"
  }
}

/**
 * Count unique Visitors in a date range with a URL predicate expressed
 * inline as a HogQL fragment. Used for both clientVisitors (exclude admin /
 * dashboard) and proVisitors (only /businesses). Returns a single number.
 */
async function fetchVisitorCountHogQL(
  apiKey: string,
  dateFrom: string,
  urlPredicate: string,
): Promise<number | null> {
  // uniq(person_id) not uniq(distinct_id): PostHog stitches
  // anonymous → identified sessions into a single person, and Web Analytics
  // uses the stitched count. Using distinct_id directly inflates numbers
  // (observed: 156 vs 69 for a single day) because every anonymous session
  // counts as a separate row until the user logs in.
  const query = `
    SELECT uniq(person_id) AS users
    FROM events
    WHERE event = '$pageview'
      AND timestamp >= now() - interval '${hogqlIntervalFor(dateFrom)}'
      AND (${urlPredicate})
  `
  const rows = await fetchHogQL<{ users: number }>(apiKey, query)
  return rows[0]?.users ?? null
}

/**
 * Fetch all four Sharers metrics in a single HogQL query.
 *
 * The TrendsQuery path for these was unreliable — `project_shared` /
 * `professional_shared` with `math: "total"` returned inconsistent bucket
 * shapes, and the DAU series used for the denominator only counted
 * project sharers, so professional-only shares were silently dropped.
 *
 * One HogQL query fixes both: we compute uniq(person_id) across both
 * event types and count each event type per bucket in one pass.
 * Returned series are aligned to the same 8-bucket window as the
 * visitor metrics.
 */
async function fetchSharesSeriesHogQL(
  apiKey: string,
  dateFrom: string,
  interval: string,
): Promise<{
  sharersSeries: number[]
  projectSharesSeries: number[]
  professionalSharesSeries: number[]
  sharesPerClientSeries: number[]
}> {
  const bucket = hogqlBucketExpr(interval)
  const query = `
    SELECT
      ${bucket} AS bucket,
      uniq(person_id) AS sharers,
      countIf(event = 'project_shared') AS project_shares,
      countIf(event = 'professional_shared') AS professional_shares
    FROM events
    WHERE event IN ('project_shared', 'professional_shared')
      AND timestamp >= now() - interval '${hogqlIntervalFor(dateFrom)}'
    GROUP BY bucket
    ORDER BY bucket ASC
  `
  const rows = await fetchHogQL<{
    bucket: string
    sharers: number
    project_shares: number
    professional_shares: number
  }>(apiKey, query)

  const days = rows.map((r) => r.bucket)
  const sharersRaw = rows.map((r) => Number(r.sharers ?? 0))
  const projectSharesRaw = rows.map((r) => Number(r.project_shares ?? 0))
  const professionalSharesRaw = rows.map((r) => Number(r.professional_shares ?? 0))

  const sharersSeries = alignToCurrent(sharersRaw, days, interval)
  const projectSharesSeries = alignToCurrent(projectSharesRaw, days, interval)
  const professionalSharesSeries = alignToCurrent(professionalSharesRaw, days, interval)

  // Per-bucket shares/client: total shares ÷ unique sharers, to one decimal.
  const sharesPerClientSeries = sharersSeries.map((sharers, i) => {
    if (!sharers || sharers === 0) return 0
    const totalInBucket = (projectSharesSeries[i] ?? 0) + (professionalSharesSeries[i] ?? 0)
    return Math.round((totalInBucket / sharers) * 10) / 10
  })

  return {
    sharersSeries,
    projectSharesSeries,
    professionalSharesSeries,
    sharesPerClientSeries,
  }
}

/**
 * Bucket series of unique Visitors for the same predicate.
 * Returns { days: iso strings, values: counts } in chronological order.
 */
async function fetchVisitorSeriesHogQL(
  apiKey: string,
  dateFrom: string,
  interval: string,
  urlPredicate: string,
): Promise<{ days: string[]; values: number[] }> {
  const bucket = hogqlBucketExpr(interval)
  // See fetchVisitorCountHogQL for the person_id vs distinct_id rationale.
  const query = `
    SELECT ${bucket} AS bucket, uniq(person_id) AS users
    FROM events
    WHERE event = '$pageview'
      AND timestamp >= now() - interval '${hogqlIntervalFor(dateFrom)}'
      AND (${urlPredicate})
    GROUP BY bucket
    ORDER BY bucket ASC
  `
  const rows = await fetchHogQL<{ bucket: string; users: number }>(apiKey, query)
  return {
    days: rows.map((r) => r.bucket),
    values: rows.map((r) => Number(r.users ?? 0)),
  }
}

/**
 * Convert the `dateFrom` param (e.g. "-8d", "-56d", "-8m", "-8y") into the
 * equivalent HogQL interval expression.
 */
function hogqlIntervalFor(dateFrom: string): string {
  // dateFrom is always "-<N><unit>" where unit is d/w/m/y
  const match = dateFrom.match(/^-(\d+)([dwmy])$/)
  if (!match) return "8 day"
  const n = match[1]
  const u = match[2]
  switch (u) {
    case "d": return `${n} day`
    case "w": return `${n} week`
    case "m": return `${n} month`
    case "y": return `${n} year`
    default: return `${n} day`
  }
}

async function fetchEventCount(
  apiKey: string,
  dateFrom: string,
  event: string,
  properties: Array<{ key: string; operator: string; value: string; type: string }>,
  math: string = "total"
): Promise<number | null> {
  const res = await fetch(`${POSTHOG_API_URL}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: {
        kind: "TrendsQuery",
        series: [{
          kind: "EventsNode",
          event,
          // Same in-flight-bucket undercount as fetchTimeSeries: swap dau for
          // monthly_active when bucketed monthly.
          math: math === "dau" ? "monthly_active" : math,
          ...(properties.length > 0 ? { properties } : {}),
        }],
        dateRange: { date_from: dateFrom },
        interval: "month",
      },
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    console.error("PostHog query failed:", res.status, errText)
    return null
  }

  const data = await res.json()
  const values = data?.results?.[0]?.data ?? []
  return values.reduce((sum: number, v: number) => sum + v, 0)
}

async function fetchClientActives(apiKey: string, dateFrom: string): Promise<number | null> {
  // Users who viewed 2+ pages (engaged visitors, not bounces)
  const res = await fetch(`${POSTHOG_API_URL}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: {
        kind: "TrendsQuery",
        series: [{
          kind: "EventsNode",
          event: "$pageview",
          math: "dau",
          properties: [
            { key: "$current_url", operator: "not_icontains", value: "/admin", type: "event" },
            { key: "$current_url", operator: "not_icontains", value: "/dashboard", type: "event" },
            { key: "$session_duration", operator: "gt", value: 0, type: "session" },
          ],
        }],
        dateRange: { date_from: dateFrom },
        interval: "month",
        properties: [
          { key: "$pageview_count", operator: "gt", value: 1, type: "session" },
        ],
      },
    }),
  })

  if (!res.ok) return null
  const data = await res.json()
  const values = data?.results?.[0]?.data ?? []
  return values.reduce((sum: number, v: number) => sum + v, 0)
}

// PostHog's `dau` math at non-day intervals undercounts the *current* (partial)
// bucket — for the in-flight month it can return values like `2` instead of the
// real ~136 unique users. Use the interval-matching active-users math instead;
// for completed buckets the result matches `dau` exactly.
function uniqueUsersMathFor(interval: string): string {
  switch (interval) {
    case "week": return "weekly_active"
    case "month": return "monthly_active"
    default: return "dau"
  }
}

async function fetchTimeSeries(
  apiKey: string,
  dateFrom: string,
  properties: Array<{ key: string; operator: string; value: string; type: string }>,
  event: string = "$pageview",
  interval: string = "month",
  aggregateToYears: boolean = false,
  /**
   * Math to apply to the series. Defaults to the unique-users math for the
   * given interval (dau/weekly_active/monthly_active) — same as the
   * existing callers. Pass `"total"` to get a raw event count per bucket
   * (e.g. "projects shared per week", not "unique sharers per week").
   */
  math?: string,
): Promise<number[]> {
  const res = await fetch(`${POSTHOG_API_URL}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: {
        kind: "TrendsQuery",
        series: [{
          kind: "EventsNode",
          event,
          math: math ?? uniqueUsersMathFor(interval),
          ...(properties.length > 0 ? { properties } : {}),
        }],
        dateRange: { date_from: dateFrom },
        interval,
      },
    }),
  })

  if (!res.ok) return []

  const data = await res.json()
  const values: number[] = data?.results?.[0]?.data ?? []
  // PostHog returns ISO dates in `days` array (e.g. "2024-01-01")
  const days: string[] = data?.results?.[0]?.days ?? []

  // Aggregate monthly data into yearly buckets
  if (aggregateToYears && days.length > 0) {
    const yearMap = new Map<string, number>()
    for (let i = 0; i < values.length; i++) {
      const year = days[i]?.substring(0, 4) ?? ""
      if (year && /^\d{4}$/.test(year)) {
        yearMap.set(year, (yearMap.get(year) ?? 0) + (values[i] ?? 0))
      }
    }
    const sorted = Array.from(yearMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    const yearValues = sorted.map(([, v]) => v)
    return alignToCurrent(yearValues, sorted.map(([k]) => `${k}-01-01`), "year")
  }

  // Align values to an 8-element window where index 7 = current period.
  // PostHog can return 8 or 9 buckets depending on date_from arithmetic; rather
  // than blindly slicing the tail (which can leave the rolling bucket pointing
  // at the wrong period if the last bucket isn't actually "now"), we place each
  // value at its correct offset based on `days[]`.
  return alignToCurrent(values, days, interval)
}

/**
 * Align a chronologically-ordered PostHog series to an 8-bucket window where
 * index 7 represents the current period (today / this week / this month / this year).
 * Buckets older than 7 periods ago are dropped; missing periods become 0.
 */
function alignToCurrent(values: number[], days: string[], interval: string): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0, 0]
  if (values.length === 0 || days.length === 0) return out

  const now = new Date()
  const todayKey = bucketKey(now, interval)

  for (let i = 0; i < values.length; i++) {
    const d = days[i]
    if (!d) continue
    const date = new Date(d)
    if (Number.isNaN(date.getTime())) continue
    const ago = todayKey - bucketKey(date, interval)
    const idx = 7 - ago
    if (idx >= 0 && idx < 8) out[idx] = values[i] ?? 0
  }
  return out
}

function bucketKey(date: Date, interval: string): number {
  switch (interval) {
    case "day":
      // Days since unix epoch (UTC) — stable integer per calendar day.
      return Math.floor(date.getTime() / 86400000)
    case "week": {
      // ISO 8601 week index, anchored to Monday. Naive `days / 7` divides
      // from the unix epoch (Thursday 1970-01-01), which would put week
      // boundaries on Thursday and offset every label by 3 days. The
      // closest Monday on-or-before the epoch is Monday Dec 29 1969 at
      // days = -3, so shifting by +3 makes that Monday week index 0:
      //   Mon Dec 29 1969 → 0, Sun Jan 4 1970 → 0, Mon Jan 5 1970 → 1.
      const days = Math.floor(date.getTime() / 86400000)
      return Math.floor((days + 3) / 7)
    }
    case "month":
      return date.getFullYear() * 12 + date.getMonth()
    case "year":
      return date.getFullYear()
    default:
      return Math.floor(date.getTime() / 86400000)
  }
}

async function fetchChannelBreakdown(
  apiKey: string,
  dateFrom: string,
  event: string,
  property: string,
): Promise<Array<{ source: string; count: number }>> {
  const res = await fetch(`${POSTHOG_API_URL}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: {
        kind: "TrendsQuery",
        series: [{ kind: "EventsNode", event, math: "total" }],
        breakdownFilter: {
          breakdowns: [{ property, type: "event" }],
          breakdown_limit: 10,
        },
        dateRange: { date_from: dateFrom },
        interval: "month",
      },
    }),
  })

  if (!res.ok) return []

  const data = await res.json()
  return (data?.results ?? []).map((r: any) => ({
    source: r.breakdown_value ?? r.label ?? "unknown",
    count: (r.data ?? []).reduce((sum: number, v: number) => sum + v, 0),
  }))
}

async function fetchSourceBreakdown(
  apiKey: string,
  dateFrom: string,
  properties: Array<{ key: string; operator: string; value: string; type: string }> = [],
): Promise<Array<{ source: string; count: number }>> {
  const res = await fetch(`${POSTHOG_API_URL}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: {
        kind: "TrendsQuery",
        series: [{
          kind: "EventsNode",
          event: "$pageview",
          math: "dau",
          ...(properties.length > 0 ? { properties } : {}),
        }],
        breakdownFilter: {
          breakdowns: [{ property: "$referring_domain", type: "event" }],
          breakdown_limit: 20,
        },
        dateRange: { date_from: dateFrom },
        interval: "month",
      },
    }),
  })

  if (!res.ok) return []

  const data = await res.json()
  const results = data?.results ?? []
  return results.map((r: any) => ({
    source: r.breakdown_value ?? r.label ?? "unknown",
    count: (r.data ?? []).reduce((sum: number, v: number) => sum + v, 0),
  }))
}

async function fetchSourceTimeSeries(
  apiKey: string,
  dateFrom: string,
  audience: "client" | "pro",
  source: "direct" | "google" | "social" | "email" | "referral",
  interval: string = "month",
  aggregateToYears: boolean = false,
): Promise<number[]> {
  // Build referring domain filter based on source category
  const sourcePatterns: Record<string, { operator: string; values: string[] }> = {
    direct: { operator: "exact", values: ["$direct", "direct"] },
    google: { operator: "icontains", values: ["google"] },
    social: { operator: "icontains", values: ["linkedin", "facebook", "instagram", "twitter", "x.com", "pinterest"] },
    email: { operator: "icontains", values: ["mail", "outlook"] },
    referral: { operator: "none", values: [] }, // everything else — handled differently
  }

  // Client audience now includes /businesses since those are client-facing
  // landing pages — we only strip /admin and /dashboard internal traffic.
  // Matches the new Client URL predicate used by the HogQL visitor queries.
  //
  // Known caveat: PostHog's stacked not_icontains semantics still undercount
  // here, but the source-breakdown series are derivative metrics (they feed
  // the drill-down, not the headline number) so exact accuracy matters less
  // than for the Visitors row itself. Left on TrendsQuery for now — can
  // migrate to HogQL if/when the drill-downs need the same precision.
  const audienceProps = audience === "pro"
    ? [{ key: "$current_url", operator: "icontains", value: "/businesses", type: "event" }]
    : [
        { key: "$current_url", operator: "not_icontains", value: "/admin", type: "event" },
        { key: "$current_url", operator: "not_icontains", value: "/dashboard", type: "event" },
      ]

  const cfg = sourcePatterns[source]

  // For referral, we can't easily filter in a single query — return empty for now
  // (referral = total - direct - google - social - email, computed client-side)
  if (source === "referral") return []

  // For direct, use exact match on $referring_domain
  if (source === "direct") {
    const props = [...audienceProps, { key: "$referring_domain", operator: "exact", value: "$direct", type: "event" }]
    return fetchTimeSeries(apiKey, dateFrom, props, "$pageview", interval, aggregateToYears)
  }

  // For google/social/email — use icontains on referring_domain
  // Multiple patterns: fetch each and sum
  const allSeries: number[][] = []
  for (const val of cfg.values) {
    const props = [...audienceProps, { key: "$referring_domain", operator: "icontains", value: val, type: "event" }]
    allSeries.push(await fetchTimeSeries(apiKey, dateFrom, props, "$pageview", interval, aggregateToYears))
  }

  if (allSeries.length === 0) return []
  const maxLen = Math.max(...allSeries.map((s) => s.length))
  const combined: number[] = []
  for (let i = 0; i < maxLen; i++) {
    combined.push(allSeries.reduce((sum, s) => sum + (s[i] ?? 0), 0))
  }
  return combined
}

type SourceGroup = { label: string; pct: number; count: number }

function groupSources(raw: Array<{ source: string; count: number }>): SourceGroup[] {
  const groups: Record<string, number> = {
    Direct: 0,
    Google: 0,
    Social: 0,
    Email: 0,
    Referral: 0,
  }

  const SKIP = ["localhost", "vercel.app", "vercel.com", "accounts.google.com"]

  for (const { source, count } of raw) {
    if (!source || typeof source !== "string") continue
    const s = source.toLowerCase()
    if (SKIP.some((skip) => s.includes(skip))) continue

    if (s === "$direct" || s === "direct") {
      groups["Direct"] += count
    } else if (s.includes("google")) {
      groups["Google"] += count
    } else if (s.includes("linkedin") || s.includes("facebook") || s.includes("instagram") || s.includes("twitter") || s.includes("x.com") || s.includes("pinterest")) {
      groups["Social"] += count
    } else if (s.includes("mail") || s.includes("outlook")) {
      groups["Email"] += count
    } else {
      groups["Referral"] += count
    }
  }

  const total = Object.values(groups).reduce((a, b) => a + b, 0)

  return Object.entries(groups)
    .map(([label, count]) => ({ label, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.pct - a.pct)
}
