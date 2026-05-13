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

  try {
    // ── Read every cacheable PostHog metric from metric_cache ─────────
    //
    // The cache (populated by /api/cron/sync-growth-metrics) stores true
    // bucket uniques per granularity. We no longer hit PostHog live for
    // these — page load went from ~3–5s to ~50ms, and the numbers stay
    // consistent across /admin/dashboard, /admin/dashboard/table, and
    // /admin/model since all three views read the same rows.
    //
    // Source breakdowns (Batch 3+4 below) stay live because they're
    // categorical (direct/google/social/email/referral) and don't fit
    // the per-period bucket cache shape. Adding a categorical cache is
    // a future task if those queries become a bottleneck.
    const { createServiceRoleSupabaseClient: createCacheClient } = await import("@/lib/supabase/server")
    const { loadCachedMetric } = await import("@/lib/growth-metric-cache")
    const cacheGranularity: "day" | "week" | "month" | "year" =
      hogqlVisitorInterval === "day" ? "day"
      : hogqlVisitorInterval === "week" ? "week"
      : hogqlVisitorInterval === "year" ? "year"
      : "month"
    const cacheFromDate = new Date(Date.now() - 9 * approxDaysPerInterval(cacheGranularity) * 86400000)
      .toISOString().slice(0, 10)
    const cacheClient = createCacheClient()

    const CACHED_KEYS = [
      "client_visitors", "pro_visitors", "apollo_visitors", "invite_visitors",
      "sharers", "project_shares", "professional_shares", "contacters", "responders",
      // Visitor source breakdowns — used for the Dashboard's source
      // cards and per-source time series (Direct / Google / Social /
      // Email / Referral).
      "client_visitors_direct", "client_visitors_google", "client_visitors_social",
      "client_visitors_email", "client_visitors_referral",
    ] as const
    type CachedKey = typeof CACHED_KEYS[number]
    const cacheMaps = await Promise.all(
      CACHED_KEYS.map((k) => loadCachedMetric(cacheClient, k, cacheGranularity, cacheFromDate)),
    )
    const cacheByKey: Record<CachedKey, Map<string, number>> = Object.fromEntries(
      CACHED_KEYS.map((k, i) => [k, cacheMaps[i]] as const),
    ) as Record<CachedKey, Map<string, number>>

    // Bucketize: cache rows → 8-element series aligned to the rolling
    // window (index 7 = current period). alignToCurrent handles the
    // edge case where the cache hasn't been synced for every period.
    const bucketize = (key: CachedKey): number[] => {
      const map = cacheByKey[key]
      if (!map || map.size === 0) return [0, 0, 0, 0, 0, 0, 0, 0]
      const periods = Array.from(map.keys()).sort()
      const values = periods.map((p) => map.get(p) ?? 0)
      return alignToCurrent(values, periods, hogqlVisitorInterval)
    }

    const clientVisitorsSeries = bucketize("client_visitors")
    const proVisitorsSeries = bucketize("pro_visitors")
    const apolloVisitorsSeries = bucketize("apollo_visitors")
    const inviteVisitorsSeries = bucketize("invite_visitors")
    const sharersSeries = bucketize("sharers")
    const projectSharesSeries = bucketize("project_shares")
    const professionalSharesSeries = bucketize("professional_shares")
    const contactersSeries = bucketize("contacters")

    // Window totals = sum of bucket values. Approximation for unique
    // metrics (a person active in 2 buckets is counted twice). Matches
    // the pre-cache semantics where window totals were also sums of
    // bucketed uniqs. For exact window-uniques, add a "window"
    // granularity to the cache.
    const clientVisitors = clientVisitorsSeries.reduce((a, b) => a + b, 0)
    const proVisitors = proVisitorsSeries.reduce((a, b) => a + b, 0)
    const apolloVisitors = apolloVisitorsSeries.reduce((a, b) => a + b, 0)
    const inviteVisitors = inviteVisitorsSeries.reduce((a, b) => a + b, 0)
    const clientActives = clientVisitors
    const clientActivesSeries = clientVisitorsSeries
    const contactersCount = contactersSeries.reduce((a, b) => a + b, 0)

    // Shares-per-client = total share events ÷ unique sharers per
    // bucket, rounded to one decimal. Derived at read time because the
    // ratio can't be averaged across granularities meaningfully.
    const sharesPerClientSeries = sharersSeries.map((sharers, i) => {
      if (!sharers) return 0
      const totalInBucket = (projectSharesSeries[i] ?? 0) + (professionalSharesSeries[i] ?? 0)
      return Math.round((totalInBucket / sharers) * 10) / 10
    })

    // ── Source breakdowns from cache ───────────────────────────────────
    //
    // The Dashboard's source cards (Direct / Organic search / Social /
    // Email / Referral) used to fire ~9 live HogQL queries per page
    // load — the majority of the route's latency. Reading the same
    // breakdowns from metric_cache drops that to ~50ms.
    //
    // Pro sources stay partially live: only Sales (Apollo) and Invites
    // are needed, both already in the cache. Pro referral categories
    // (Direct / Google / Referral subset) aren't cached yet — for now
    // we expose Sales (Apollo) + Invites only and let the rest grow
    // when needed.
    const clientVisitorsDirectSeries = bucketize("client_visitors_direct")
    const clientVisitorsGoogleSeries = bucketize("client_visitors_google")
    const clientVisitorsSocialSeries = bucketize("client_visitors_social")
    const clientVisitorsEmailSeries = bucketize("client_visitors_email")
    const clientVisitorsReferralSeries = bucketize("client_visitors_referral")

    // Window totals per source — sum of bucketed uniques. Same
    // approximation caveat as the parent visitor totals above.
    const directCount = clientVisitorsDirectSeries.reduce((a, b) => a + b, 0)
    const googleCount = clientVisitorsGoogleSeries.reduce((a, b) => a + b, 0)
    const socialCount = clientVisitorsSocialSeries.reduce((a, b) => a + b, 0)
    const emailCount = clientVisitorsEmailSeries.reduce((a, b) => a + b, 0)
    const referralCount = clientVisitorsReferralSeries.reduce((a, b) => a + b, 0)
    const clientSourceTotal = directCount + googleCount + socialCount + emailCount + referralCount

    const pct = (n: number) => (clientSourceTotal > 0 ? Math.round((n / clientSourceTotal) * 100) : 0)
    const clientSources: SourceGroup[] = [
      { label: "Direct", count: directCount, pct: pct(directCount) },
      { label: "Organic search", count: googleCount, pct: pct(googleCount) },
      { label: "Social", count: socialCount, pct: pct(socialCount) },
      { label: "Email", count: emailCount, pct: pct(emailCount) },
      { label: "Referral", count: referralCount, pct: pct(referralCount) },
    ].sort((a, b) => b.pct - a.pct)

    // Pro sources card — Sales (Apollo) + Invites from cache. Other
    // referring-domain categories would need pro-side filtered cache
    // keys (pro_visitors × source); skipped for now since the existing
    // dashboard only emphasised Apollo/Invites.
    const proTotal = (apolloVisitors ?? 0) + (inviteVisitors ?? 0)
    const proSources: SourceGroup[] = [
      ...(apolloVisitors ? [{ label: "Sales (Apollo)", count: apolloVisitors, pct: proTotal > 0 ? Math.round((apolloVisitors / proTotal) * 100) : 0 }] : []),
      ...(inviteVisitors ? [{ label: "Invites", count: inviteVisitors, pct: proTotal > 0 ? Math.round((inviteVisitors / proTotal) * 100) : 0 }] : []),
    ]

    // Shares headline counts — sum across the 8-bucket window so the
    // card totals agree with the sparklines rendered alongside them.
    // Same overcount caveat as the visitor totals above.
    const totalProjectShares = projectSharesSeries.reduce((a, b) => a + b, 0)
    const totalProShares = professionalSharesSeries.reduce((a, b) => a + b, 0)
    const totalShares = totalProjectShares + totalProShares
    const uniqueSharers = sharersSeries.reduce((a, b) => a + b, 0)
    const sharesPerClient = uniqueSharers > 0 ? Math.round((totalShares / uniqueSharers) * 10) / 10 : 0

    // Per-source time series — straight from cache, no live queries.
    // Pro source series keep their Sales/Invites entries from above.
    const clientSourceSeries: Record<string, number[]> = {
      direct: clientVisitorsDirectSeries,
      google: clientVisitorsGoogleSeries,
      social: clientVisitorsSocialSeries,
      email: clientVisitorsEmailSeries,
      referral: clientVisitorsReferralSeries,
    }
    const proSourceSeries: Record<string, number[]> = {
      sales_apollo: apolloVisitorsSeries ?? [],
      invites: inviteVisitorsSeries ?? [],
    }

    const responseData = {
      proVisitors,
      clientVisitors,
      clientActives,
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
      contacters: contactersCount,
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
 * Align a chronologically-ordered PostHog series to an 8-bucket window where
 * index 7 represents the current period (today / this week / this month / this year).
 * Buckets older than 7 periods ago are dropped; missing periods become 0.
 */
function approxDaysPerInterval(granularity: "day" | "week" | "month" | "year"): number {
  switch (granularity) {
    case "day": return 1
    case "week": return 7
    case "month": return 31
    case "year": return 366
  }
}

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

type SourceGroup = { label: string; pct: number; count: number }

