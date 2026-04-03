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
    return NextResponse.json({ error: "POSTHOG_PERSONAL_API_KEY not set" })
  }

  const tf = request.nextUrl.searchParams.get("tf") || "months"
  const dateFromMap: Record<string, string> = {
    days: "-8d",
    weeks: "-56d",
    months: "-8m",
    years: "-8y",
  }
  const intervalMap: Record<string, string> = {
    days: "day",
    weeks: "week",
    months: "month",
    years: "month",
  }
  const dateFrom = dateFromMap[tf] ?? "-8m"
  const posthogInterval = intervalMap[tf] ?? "month"

  try {
    const [proVisitors, clientVisitors, totalProjectShares, uniqueProjectSharers, totalProShares, uniqueProSharers, apolloVisitors, inviteVisitors, clientActives, sharersSeries, proVisitorsSeries, clientVisitorsSeries, clientActivesSeries, apolloVisitorsSeries, inviteVisitorsSeries, clientSourcesRaw, proSourcesRaw] = await Promise.all([
      // Pro visitors: /businesses pages
      fetchEventCount(apiKey, dateFrom, "$pageview", [
        { key: "$current_url", operator: "icontains", value: "/businesses", type: "event" },
      ], "dau"),
      // Client visitors: everything except /businesses, /admin, /dashboard
      fetchEventCount(apiKey, dateFrom, "$pageview", [
        { key: "$current_url", operator: "not_icontains", value: "/businesses", type: "event" },
        { key: "$current_url", operator: "not_icontains", value: "/admin", type: "event" },
        { key: "$current_url", operator: "not_icontains", value: "/dashboard", type: "event" },
      ], "dau"),
      // Total shares (projects + professionals)
      fetchEventCount(apiKey, dateFrom, "project_shared", [], "total"),
      // Unique users who shared (projects)
      fetchEventCount(apiKey, dateFrom, "project_shared", [], "dau"),
      // Total professional shares
      fetchEventCount(apiKey, dateFrom, "professional_shared", [], "total"),
      // Unique users who shared (professionals)
      fetchEventCount(apiKey, dateFrom, "professional_shared", [], "dau"),
      // Pro visitors from Apollo (URL contains ref=)
      fetchEventCount(apiKey, dateFrom, "$pageview", [
        { key: "$current_url", operator: "icontains", value: "/businesses", type: "event" },
        { key: "$current_url", operator: "icontains", value: "ref=", type: "event" },
      ], "dau"),
      // Pro visitors from invites (URL contains inviteEmail=)
      fetchEventCount(apiKey, dateFrom, "$pageview", [
        { key: "$current_url", operator: "icontains", value: "inviteEmail=", type: "event" },
      ], "dau"),
      // Client actives: unique visitors
      fetchEventCount(apiKey, dateFrom, "$pageview", [
        { key: "$current_url", operator: "not_icontains", value: "/businesses", type: "event" },
        { key: "$current_url", operator: "not_icontains", value: "/admin", type: "event" },
        { key: "$current_url", operator: "not_icontains", value: "/dashboard", type: "event" },
      ], "dau"),
      // Sharers time series
      fetchTimeSeries(apiKey, dateFrom, [], "project_shared", posthogInterval),
      // Pro visitors time series (6 buckets)
      fetchTimeSeries(apiKey, dateFrom, [
        { key: "$current_url", operator: "icontains", value: "/businesses", type: "event" },
      ], "$pageview", posthogInterval),
      // Client visitors time series
      fetchTimeSeries(apiKey, dateFrom, [
        { key: "$current_url", operator: "not_icontains", value: "/businesses", type: "event" },
        { key: "$current_url", operator: "not_icontains", value: "/admin", type: "event" },
        { key: "$current_url", operator: "not_icontains", value: "/dashboard", type: "event" },
      ], "$pageview", posthogInterval),
      // Client actives time series
      fetchTimeSeries(apiKey, dateFrom, [
        { key: "$current_url", operator: "not_icontains", value: "/admin", type: "event" },
        { key: "$current_url", operator: "not_icontains", value: "/dashboard", type: "event" },
      ], "$pageview", posthogInterval),
      // Apollo visitors time series
      fetchTimeSeries(apiKey, dateFrom, [
        { key: "$current_url", operator: "icontains", value: "/businesses", type: "event" },
        { key: "$current_url", operator: "icontains", value: "ref=", type: "event" },
      ], "$pageview", posthogInterval),
      // Invite visitors time series
      fetchTimeSeries(apiKey, dateFrom, [
        { key: "$current_url", operator: "icontains", value: "inviteEmail=", type: "event" },
      ], "$pageview", posthogInterval),
      // Client source breakdown (referring domain)
      fetchSourceBreakdown(apiKey, dateFrom, [
        { key: "$current_url", operator: "not_icontains", value: "/businesses", type: "event" },
        { key: "$current_url", operator: "not_icontains", value: "/admin", type: "event" },
        { key: "$current_url", operator: "not_icontains", value: "/dashboard", type: "event" },
      ]),
      // Pro source breakdown (referring domain)
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

    // Combine project + professional sharers (deduplicated via dau)
    const totalShares = (totalProjectShares ?? 0) + (totalProShares ?? 0)
    // Unique sharers: approximate by taking max of the two (can't deduplicate across events without HogQL)
    const uniqueSharers = Math.max(uniqueProjectSharers ?? 0, uniqueProSharers ?? 0)
    const sharesPerClient = uniqueSharers > 0 ? Math.round((totalShares / uniqueSharers) * 10) / 10 : 0

    // Fetch per-source time series for visitor breakdown charts
    const [directClientSeries, googleClientSeries, socialClientSeries, emailClientSeries, referralClientSeries,
           directProSeries, googleProSeries, referralProSeries] = await Promise.all([
      // Client source series
      fetchSourceTimeSeries(apiKey, dateFrom, "client", "direct", posthogInterval),
      fetchSourceTimeSeries(apiKey, dateFrom, "client", "google", posthogInterval),
      fetchSourceTimeSeries(apiKey, dateFrom, "client", "social", posthogInterval),
      fetchSourceTimeSeries(apiKey, dateFrom, "client", "email", posthogInterval),
      fetchSourceTimeSeries(apiKey, dateFrom, "client", "referral", posthogInterval),
      // Pro source series
      fetchSourceTimeSeries(apiKey, dateFrom, "pro", "direct", posthogInterval),
      fetchSourceTimeSeries(apiKey, dateFrom, "pro", "google", posthogInterval),
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

    return NextResponse.json({
      proVisitors,
      clientVisitors,
      clientActives: clientActives ?? 0,
      proVisitorsSeries: proVisitorsSeries ?? [],
      clientVisitorsSeries: clientVisitorsSeries ?? [],
      clientActivesSeries: clientActivesSeries ?? [],
      apolloVisitorsSeries: apolloVisitorsSeries ?? [],
      inviteVisitorsSeries: inviteVisitorsSeries ?? [],
      sharersSeries: sharersSeries ?? [],
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
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("PostHog API error:", msg)
    return NextResponse.json({ proVisitors: null, clientVisitors: null, sharers: null, clientSources: [], proSources: [], debug_error: msg })
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
          math,
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

async function fetchTimeSeries(
  apiKey: string,
  dateFrom: string,
  properties: Array<{ key: string; operator: string; value: string; type: string }>,
  event: string = "$pageview",
  interval: string = "month",
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
          math: "dau",
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

  // Take last 8 values (7 completed + 1 rolling)
  if (values.length <= 8) return values
  return values.slice(-8)
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
): Promise<number[]> {
  // Build referring domain filter based on source category
  const sourcePatterns: Record<string, { operator: string; values: string[] }> = {
    direct: { operator: "exact", values: ["$direct", "direct"] },
    google: { operator: "icontains", values: ["google"] },
    social: { operator: "icontains", values: ["linkedin", "facebook", "instagram", "twitter", "x.com", "pinterest"] },
    email: { operator: "icontains", values: ["mail", "outlook"] },
    referral: { operator: "none", values: [] }, // everything else — handled differently
  }

  const audienceProps = audience === "pro"
    ? [{ key: "$current_url", operator: "icontains", value: "/businesses", type: "event" }]
    : [
        { key: "$current_url", operator: "not_icontains", value: "/businesses", type: "event" },
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
    return fetchTimeSeries(apiKey, dateFrom, props, "$pageview", interval)
  }

  // For google/social/email — use icontains on referring_domain
  // Multiple patterns: fetch each and sum
  const allSeries: number[][] = []
  for (const val of cfg.values) {
    const props = [...audienceProps, { key: "$referring_domain", operator: "icontains", value: val, type: "event" }]
    allSeries.push(await fetchTimeSeries(apiKey, dateFrom, props, "$pageview", interval))
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
