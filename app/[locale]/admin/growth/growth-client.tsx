"use client"

import { useState, useEffect, useTransition } from "react"
import type { GrowthMetrics, Timeframe } from "./actions"
import { fetchGrowthMetrics } from "./actions"
import { MetricDetailModal } from "./metric-detail-modal"
import { GrowthTableView } from "./table/table-view"
import { fetchMetricTable, type MetricRow } from "./table/table-actions"

interface Props {
  initialMetrics: GrowthMetrics
}

const DRIVER = {
  acquisition: { border: "#93c5fd", label: "#2563eb" },
  retention: { border: "#c4b5fd", label: "#7c3aed" },
  monetization: { border: "#6ee7b7", label: "#0f766e" },
  churn: { border: "#fca5a5", label: "#dc2626" },
}
type Driver = keyof typeof DRIVER

const G = 36 // grid gap — enough for conversion % labels

// Mini sparkline for lifecycle cards — with dots and value labels
function CardSparkline({ datapoints, color }: { datapoints: number[]; color: string }) {
  if (!datapoints || datapoints.length === 0) return null
  const max = Math.max(...datapoints, 1)
  const n = datapoints.length
  const w = 100
  const h = 40
  const padX = 8
  const padY = 14
  const lastCompleted = n - 2

  const points = datapoints.map((v, i) => ({
    x: padX + (i / (n - 1)) * (w - padX * 2),
    y: h - padY + 2 - (v / max) * (h - padY * 2),
    v,
    isRolling: i === n - 1,
  }))

  const solidLine = points.slice(0, lastCompleted + 1).map((p) => `${p.x},${p.y}`).join(" ")
  const last = points[lastCompleted]
  const rolling = points[n - 1]

  return (
    <div className="relative w-full" style={{ height: h }}>
      {/* Lines SVG — stretched to fill */}
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
        <polyline points={solidLine} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        {last && rolling && (
          <line x1={last.x} y1={last.y} x2={rolling.x} y2={rolling.y}
            stroke={color} strokeWidth="1.5" strokeDasharray="3,3" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
        )}
      </svg>
      {/* Dots + labels — positioned with percentage */}
      {points.map((p, i) => {
        const leftPct = (p.x / w) * 100
        const topPct = (p.y / h) * 100
        return (
          <div key={i} className="group/dot" style={{ position: "absolute", left: `${leftPct}%`, top: `${topPct}%`, padding: 4, margin: -4, zIndex: 2 }}>
            <svg width="7" height="7" viewBox="0 0 7 7" style={{ display: "block", position: "absolute", left: "50%", top: "50%", marginLeft: "-3.5px", marginTop: "-3.5px" }}>
              <circle cx="3.5" cy="3.5" r="2.5" fill="white" stroke={color} strokeWidth="1.5" opacity={p.isRolling ? 0.6 : 1} />
            </svg>
            {/* Number label sitting directly above the dot, centered horizontally */}
            <span
              className={`absolute whitespace-nowrap ${p.isRolling ? "" : "opacity-0 group-hover/dot:opacity-100 transition-opacity"}`}
              style={{ left: "50%", top: 0, transform: "translate(-50%, calc(-100% - 2px))", fontSize: 11, fontWeight: 500, color: "#1c1c1a", pointerEvents: p.isRolling ? undefined : "none" }}
            >
              {p.v}
            </span>
          </div>
        )
      })}
    </div>
  )
}

const ROLLING_LABEL: Record<string, string> = {
  days: "today",
  weeks: "this week",
  months: "this month",
  years: "this year",
}

// Card with optional connectors and sparkline chart.
// dataName is a stable identifier for measurement queries — used when a
// connector line needs to span across grid boundaries (e.g. the
// Signups → Drafts bridge that crosses the Clients / Professionals
// divider). connDownHeight overrides the default G height of the down
// connector when set.
function Card({ label, value, driver, connRight, connDown, connUp, connDownHeight, datapoints, metricKey, onCardClick, timeframe, dataName }: {
  label: string; value: number | string | null; driver: Driver
  connRight?: string; connDown?: string; connUp?: string
  connDownHeight?: number | string
  datapoints?: number[]
  metricKey?: string
  onCardClick?: (key: string, value: number | string | null) => void
  timeframe?: string
  dataName?: string
}) {
  const c = DRIVER[driver]
  return (
    <div className="relative h-full" style={{ overflow: "visible" }} data-card-name={dataName}>
      {/* Right connector */}
      {connRight !== undefined && (
        <div className="absolute" style={{ left: "100%", top: "50%", transform: "translateY(-50%)", width: G, zIndex: 20 }}>
          {connRight && connRight !== "—" && (
            <span className="absolute text-[10px] font-medium text-[#6b6b68]" style={{ top: -16, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap" }}>{connRight}</span>
          )}
          <div className="w-full border-t border-[#d4d4d3]" />
        </div>
      )}
      {/* Down connector */}
      {connDown !== undefined && (
        <div className="absolute" style={{ top: "100%", left: "50%", transform: "translateX(-50%)", height: connDownHeight ?? G, zIndex: 20 }}>
          {connDown && connDown !== "—" && (
            <span className="absolute text-[10px] font-medium text-[#6b6b68] bg-white px-1" style={{ left: 8, top: "50%", transform: "translateY(-50%)", whiteSpace: "nowrap" }}>{connDown}</span>
          )}
          <div className="h-full border-l border-[#d4d4d3]" />
        </div>
      )}
      {/* Up connector */}
      {connUp !== undefined && (
        <div className="absolute" style={{ bottom: "100%", left: "50%", transform: "translateX(-50%)", height: G, zIndex: 20 }}>
          {connUp && connUp !== "—" && (
            <span className="absolute text-[10px] font-medium text-[#6b6b68]" style={{ left: 8, top: "50%", transform: "translateY(-50%)", whiteSpace: "nowrap" }}>{connUp}</span>
          )}
          <div className="h-full border-l border-[#d4d4d3]" />
        </div>
      )}
      {/* Card body */}
      <div
        className={`rounded-[3px] border border-[#e5e5e4] bg-white px-3 py-2.5 relative z-10 ${metricKey ? "cursor-pointer hover:border-[#c4c4c2] transition-colors" : ""}`}
        style={{ height: 80 }}
        onClick={metricKey && onCardClick ? () => onCardClick(metricKey, value) : undefined}
      >
        <div className="flex items-center gap-[6px] mb-1">
          <span className="status-pill-dot" style={{ background: c.label }} />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 400, color: "var(--text-primary)" }}>{label}</span>
        </div>
        {datapoints && <CardSparkline datapoints={datapoints} color={c.label} />}
        {timeframe && (
          <span className="absolute bottom-2 right-3" style={{ fontSize: 8, color: "#a1a1a0" }}>{ROLLING_LABEL[timeframe]}</span>
        )}
      </div>
    </div>
  )
}

function Empty() { return <div /> }

function MetricCard({ label, value, sub, highlight }: { label: string; value: string | number; sub?: string; highlight?: boolean }) {
  return (
    <div className="border border-[#e5e5e4] rounded-[3px] bg-white p-5">
      <p className="arco-eyebrow mb-1.5" style={{ color: "#a1a1a0" }}>{label}</p>
      <p className={`arco-card-title ${highlight ? "text-[#016D75]" : ""}`}>{value}</p>
      {sub && <p className="text-[10px] text-[#a1a1a0] mt-1">{sub}</p>}
    </div>
  )
}

function MiniChart({ data, label }: { data: Array<{ week: string; count: number }>; label: string }) {
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div className="border border-[#e5e5e4] rounded-[3px] bg-white p-5">
      <p className="arco-eyebrow text-[#a1a1a0] mb-3">{label}</p>
      <div className="flex items-end gap-1" style={{ height: 80 }}>
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[9px] text-[#a1a1a0]">{d.count || ""}</span>
            <div className="w-full rounded-sm" style={{ height: `${Math.max((d.count / max) * 60, 2)}px`, background: d.count > 0 ? "#016D75" : "#e5e5e4" }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[9px] text-[#a1a1a0]">{data[0]?.week}</span>
        <span className="text-[9px] text-[#a1a1a0]">{data[data.length - 1]?.week}</span>
      </div>
    </div>
  )
}

const TIMEFRAMES: { value: Timeframe; label: string; shortLabel: string }[] = [
  { value: "days", label: "Days", shortLabel: "D" },
  { value: "weeks", label: "Weeks", shortLabel: "W" },
  { value: "months", label: "Months", shortLabel: "M" },
  { value: "years", label: "Years", shortLabel: "Y" },
]

export function GrowthClient({ initialMetrics }: Props) {
  const [metrics, setMetrics] = useState(initialMetrics)
  const [timeframe, setTimeframe] = useState<Timeframe>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("arco_growth_timeframe")
      if (saved && ["days", "weeks", "months", "years"].includes(saved)) return saved as Timeframe
    }
    return "months"
  })
  const [isPending, startTransition] = useTransition()
  const [view, setView] = useState<"lifecycle" | "table">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("arco_growth_view")
      if (saved === "lifecycle" || saved === "table") return saved
    }
    return "lifecycle"
  })
  const [tableRows, setTableRows] = useState<MetricRow[]>([])
  const [tableLabels, setTableLabels] = useState<string[]>([])
  const [posthogData, setPosthogData] = useState<{
    proVisitors: number | null
    clientVisitors: number | null
    sharers: number | null
    contacters: number | null
    sharesPerClient: number
    projectShares: number
    professionalShares: number
    apolloVisitors: number
    inviteVisitors: number
    clientActives: number
    clientActivesSeries: number[]
    apolloVisitorsSeries: number[]
    inviteVisitorsSeries: number[]
    proVisitorsSeries: number[]
    clientVisitorsSeries: number[]
    sharersSeries: number[]
    projectSharesSeries: number[]
    professionalSharesSeries: number[]
    sharesPerClientSeries: number[]
    clientSources: Array<{ label: string; pct: number; count: number }>
    proSources: Array<{ label: string; pct: number; count: number }>
    clientSourceSeries: Record<string, number[]>
    proSourceSeries: Record<string, number[]>
    loaded: boolean
  }>({ proVisitors: null, clientVisitors: null, sharers: null, contacters: null, sharesPerClient: 0, projectShares: 0, professionalShares: 0, apolloVisitors: 0, inviteVisitors: 0, clientActives: 0, clientActivesSeries: [], apolloVisitorsSeries: [], inviteVisitorsSeries: [], proVisitorsSeries: [], clientVisitorsSeries: [], sharersSeries: [], projectSharesSeries: [], professionalSharesSeries: [], sharesPerClientSeries: [], clientSources: [], proSources: [], clientSourceSeries: {}, proSourceSeries: {}, loaded: false })

  // Surface PostHog API errors instead of silently rendering zeros across the
  // dashboard. The most common cause is POSTHOG_PERSONAL_API_KEY missing in
  // Vercel — without this banner, the only symptom is "all metrics are 0"
  // which is indistinguishable from "no traffic yet".
  const [posthogError, setPosthogError] = useState<string | null>(null)

  // Age in minutes of the cached PostHog data per timeframe. Used to disable
  // the refresh button when every timeframe is < 30 minutes old and to
  // guarantee that "Refresh all" work reflects the real cache state.
  const [cacheAgeByTimeframe, setCacheAgeByTimeframe] = useState<Record<Timeframe, number | null>>({
    days: null,
    weeks: null,
    months: null,
    years: null,
  })

  // True while a manual "refresh all" is running — keeps the button disabled
  // and the spinner visible for the entire parallel fetch sequence.
  const [isRefreshingAll, setIsRefreshingAll] = useState(false)

  // Minutes threshold below which the refresh button is hidden as disabled.
  // Matches the shortest cache TTL (days = 30min) so we never give the user
  // a button that wouldn't actually fetch new data.
  const REFRESH_DEBOUNCE_MINUTES = 30

  const [detailMetric, setDetailMetric] = useState<string | null>(null)
  const [detailValue, setDetailValue] = useState<number | string | null>(null)

  // The Signups → Drafts cross-grid bridge needs a height that exactly spans
  // from the bottom of the Signups card to the top of the Drafts card.
  // Calculating that with rowGap + card height + marginTop arithmetic is
  // brittle (different deploy environments rendered different gaps;
  // hardcoded values cycled between under- and over-shooting). Measuring
  // both cards' bounding rects after mount gives the exact pixel distance.
  const [signupsDraftsBridgeHeight, setSignupsDraftsBridgeHeight] = useState<number>(280)
  useEffect(() => {
    const measure = () => {
      const sig = document.querySelector('[data-card-name="signups"]')?.getBoundingClientRect()
      const drf = document.querySelector('[data-card-name="drafts"]')?.getBoundingClientRect()
      if (!sig || !drf) return
      const h = drf.top - sig.bottom
      if (h > 0 && Math.abs(h - signupsDraftsBridgeHeight) > 1) {
        setSignupsDraftsBridgeHeight(h)
      }
    }
    // Initial measurement after first paint, then on resize. Posthog data
    // arriving later doesn't change layout so we don't measure on that.
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [view, signupsDraftsBridgeHeight])

  const openDetail = (key: string, value: number | string | null) => {
    setDetailMetric(key)
    setDetailValue(value)
  }

  // Build conversion rates per metric for the popup
  const getConversions = (key: string | null) => {
    if (!key || !metrics.cohortedRates) return []
    const cr = metrics.cohortedRates
    // visitorToSignup / proVisitorToDraft / signupToSharer / signupToContacter
    // are PostHog ↔ Supabase composite rates — declared further down in this
    // component (just before the return). Reading them here works because
    // getConversions is invoked at render time, after all locals exist.
    const r = {
      visitorToSignup,
      proVisitorToDraft,
      signupToSharer,
      signupToContacter,
    }
    const convMap: Record<string, Array<{ label: string; value: string }>> = {
      drafts: [
        { label: "← From signup", value: cr.signupToDraft },
        { label: "→ Listed", value: cr.proSignupToActive },
      ],
      actives: [
        { label: "← From draft", value: cr.proSignupToActive },
        { label: "→ Publisher", value: cr.proActiveToPublisher },
        { label: "→ Subscriber", value: cr.proActiveToSubscriber },
      ],
      publishers: [
        { label: "← From active", value: cr.proActiveToPublisher },
        { label: "→ Inviter", value: cr.proPublisherToInviter },
      ],
      inviters: [
        { label: "← From publisher", value: cr.proPublisherToInviter },
      ],
      subscribers: [
        { label: "← From active", value: cr.proActiveToSubscriber },
      ],
      client_visitors: [
        { label: "→ Signup", value: r.visitorToSignup },
      ],
      pro_visitors: [
        { label: "→ Draft", value: r.proVisitorToDraft },
      ],
      client_signups: [
        { label: "← From visitor", value: r.visitorToSignup },
        { label: "→ Draft (cross-funnel)", value: cr.signupToDraft },
        { label: "→ Sharer", value: r.signupToSharer },
        { label: "→ Saver", value: cr.clientSignupToSaver },
        { label: "→ Contacter", value: r.signupToContacter },
      ],
      client_actives: [
        { label: "← From signup", value: "—" },
        { label: "→ Saver", value: cr.clientSignupToSaver },
      ],
      sharers: [
        { label: "← From signup", value: r.signupToSharer },
      ],
      savers: [
        { label: "← From signup", value: cr.clientSignupToSaver },
      ],
      inquirers: [
        { label: "← From signup", value: r.signupToContacter },
      ],
    }
    return convMap[key] ?? []
  }

  // Low-level fetch: hits the API, records the cache age for the given
  // timeframe, and returns the parsed payload. Does NOT update `posthogData`
  // — use fetchPosthog() for that. The separation lets the refresh-all
  // handler warm other timeframes' cache rows without overwriting the
  // currently-rendered data.
  const fetchPosthogRaw = async (tf: Timeframe, force: boolean = false): Promise<any> => {
    const url = `/api/growth-posthog?tf=${tf}${force ? "&refresh=1" : ""}`
    const r = await fetch(url)
    if (!r.ok) {
      let message = `PostHog API request failed (HTTP ${r.status})`
      try {
        const body = await r.json()
        if (body?.error) message = body.error
      } catch { /* non-JSON error response */ }
      throw new Error(message)
    }
    const data = await r.json()
    if (typeof data?._age_minutes === "number") {
      setCacheAgeByTimeframe((prev) => ({ ...prev, [tf]: data._age_minutes }))
    }
    return data
  }

  const fetchPosthog = (tf: Timeframe, force: boolean = false) => {
    if (force) setPosthogData((prev) => ({ ...prev, loaded: false }))
    fetchPosthogRaw(tf, force)
      .then((d) => {
        setPosthogError(null)
        setPosthogData({
          proVisitors: d.proVisitors ?? null,
          clientVisitors: d.clientVisitors ?? null,
          sharers: d.sharers ?? null,
          contacters: d.contacters ?? null,
          sharesPerClient: d.sharesPerClient ?? 0,
          projectShares: d.projectShares ?? 0,
          professionalShares: d.professionalShares ?? 0,
          apolloVisitors: d.apolloVisitors ?? 0,
          inviteVisitors: d.inviteVisitors ?? 0,
          clientActives: d.clientActives ?? 0,
          clientActivesSeries: d.clientActivesSeries ?? [],
          apolloVisitorsSeries: d.apolloVisitorsSeries ?? [],
          inviteVisitorsSeries: d.inviteVisitorsSeries ?? [],
          proVisitorsSeries: d.proVisitorsSeries ?? [],
          clientVisitorsSeries: d.clientVisitorsSeries ?? [],
          sharersSeries: d.sharersSeries ?? [],
          projectSharesSeries: d.projectSharesSeries ?? [],
          professionalSharesSeries: d.professionalSharesSeries ?? [],
          sharesPerClientSeries: d.sharesPerClientSeries ?? [],
          clientSources: d.clientSources ?? [],
          proSources: d.proSources ?? [],
          clientSourceSeries: d.clientSourceSeries ?? {},
          proSourceSeries: d.proSourceSeries ?? {},
          loaded: true,
        })
      })
      .catch((err: Error) => {
        setPosthogError(err.message ?? "Unknown error fetching PostHog data")
        setPosthogData((prev) => ({ ...prev, loaded: true }))
      })
  }

  /**
   * Refresh all four timeframes sequentially and overwrite their cache
   * rows. Runs one at a time so the parallel PostHog API calls per
   * timeframe (~22 calls each) don't collide with each other's rate
   * limits. Only the currently-rendered timeframe updates `posthogData`;
   * the others just warm their cache row so the next tab switch is fast.
   */
  const refreshAllTimeframes = async () => {
    if (isRefreshingAll) return
    setIsRefreshingAll(true)
    setPosthogData((prev) => ({ ...prev, loaded: false }))

    // Fetch the active timeframe first so the visible chart updates as
    // soon as possible. Then warm the other three in the background.
    const activeTf = timeframe
    const otherTfs: Timeframe[] = (["days", "weeks", "months", "years"] as Timeframe[]).filter(
      (tf) => tf !== activeTf,
    )

    try {
      // Active tab first: fetch + hydrate posthogData so the chart
      // updates as soon as the first fetch finishes.
      const activeData = await fetchPosthogRaw(activeTf, true)
      setPosthogError(null)
      setPosthogData({
        proVisitors: activeData.proVisitors ?? null,
        clientVisitors: activeData.clientVisitors ?? null,
        sharers: activeData.sharers ?? null,
        contacters: activeData.contacters ?? null,
        sharesPerClient: activeData.sharesPerClient ?? 0,
        projectShares: activeData.projectShares ?? 0,
        professionalShares: activeData.professionalShares ?? 0,
        apolloVisitors: activeData.apolloVisitors ?? 0,
        inviteVisitors: activeData.inviteVisitors ?? 0,
        clientActives: activeData.clientActives ?? 0,
        clientActivesSeries: activeData.clientActivesSeries ?? [],
        apolloVisitorsSeries: activeData.apolloVisitorsSeries ?? [],
        inviteVisitorsSeries: activeData.inviteVisitorsSeries ?? [],
        proVisitorsSeries: activeData.proVisitorsSeries ?? [],
        clientVisitorsSeries: activeData.clientVisitorsSeries ?? [],
        sharersSeries: activeData.sharersSeries ?? [],
        projectSharesSeries: activeData.projectSharesSeries ?? [],
        professionalSharesSeries: activeData.professionalSharesSeries ?? [],
        sharesPerClientSeries: activeData.sharesPerClientSeries ?? [],
        clientSources: activeData.clientSources ?? [],
        proSources: activeData.proSources ?? [],
        clientSourceSeries: activeData.clientSourceSeries ?? {},
        proSourceSeries: activeData.proSourceSeries ?? {},
        loaded: true,
      })

      // Other tabs: warm their cache rows sequentially so we don't
      // overlap PostHog's rate limits. Errors on secondary fetches are
      // non-fatal — the active tab already rendered.
      for (const tf of otherTfs) {
        try {
          await fetchPosthogRaw(tf, true)
        } catch (err) {
          console.warn(`[refreshAll] Failed to refresh ${tf}:`, err)
        }
      }
    } catch (err) {
      const e = err as Error
      setPosthogError(e.message ?? "Unknown error refreshing PostHog data")
      setPosthogData((prev) => ({ ...prev, loaded: true }))
    } finally {
      setIsRefreshingAll(false)
    }
  }

  useEffect(() => {
    // Allow ?refresh=1 in the page URL to bypass the posthog_cache row.
    const force =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("refresh") === "1"
    fetchPosthog(timeframe, force)
    // Load table data on mount for lifecycle sparklines
    startTransition(async () => {
      const data = await fetchMetricTable(timeframe)
      setTableRows(data.rows)
      setTableLabels(data.labels)
    })
  }, [])

  const handleTimeframeChange = (tf: Timeframe) => {
    setTimeframe(tf)
    if (typeof window !== "undefined") localStorage.setItem("arco_growth_timeframe", tf)
    fetchPosthog(tf)
    startTransition(async () => {
      const [metricsData, tableData] = await Promise.all([
        fetchGrowthMetrics(tf),
        fetchMetricTable(tf),
      ])
      setMetrics(metricsData)
      setTableRows(tableData.rows)
      setTableLabels(tableData.labels)
    })
  }

  const handleViewChange = (v: "lifecycle" | "table") => {
    setView(v)
    if (typeof window !== "undefined") localStorage.setItem("arco_growth_view", v)
    if (v === "table" && tableRows.length === 0) {
      startTransition(async () => {
        const data = await fetchMetricTable(timeframe)
        setTableRows(data.rows)
        setTableLabels(data.labels)
      })
    }
  }

  // Helper to get sparkline datapoints from table rows
  const dp = (key: string): number[] | undefined => {
    const row = tableRows.find((r) => r.key === key)
    return row?.datapoints
  }

  const pr = metrics.professionals
  const ho = metrics.clients
  const cr = metrics.cohortedRates

  // Cross-source conversion rates: PostHog (numerator/denominator) ÷ Supabase
  // for the visitor → signup / visitor → draft pair, or PostHog event
  // counts ÷ Supabase signup count for the signup → sharer / contacter
  // pair. These can't live in cohortedRates because actions.ts only sees
  // Supabase data — composing them here is the simplest cross-source path.
  //
  // Caveats:
  //   - Visitor totals are timeframe-bound (PostHog returns a window), but
  //     signup/draft totals from Supabase are all-time. The ratio is
  //     therefore approximate. Visitor windows on /admin/growth typically
  //     cover the same window the user is reading, so the bias is small in
  //     practice.
  //   - PostHog uniq(person_id) for sharer/contacter events includes
  //     anonymous people who fired the event without ever signing up. At
  //     low scale this is rare, but the rate can exceed 100% if many anon
  //     visitors share a project. Capped to 100% for display.
  const pctRate = (numerator: number | null | undefined, denominator: number | null | undefined): string => {
    if (!denominator || denominator === 0) return "—"
    if (numerator == null) return "—"
    const v = (numerator / denominator) * 100
    if (!isFinite(v)) return "—"
    return `${Math.min(Math.round(v), 100)}%`
  }
  const visitorToSignup = pctRate(metrics.clientUsers, posthogData.clientVisitors)
  const proVisitorToDraft = pctRate(metrics.draftCompanies, posthogData.proVisitors)
  const signupToSharer = pctRate(posthogData.sharers, metrics.clientUsers)
  const signupToContacter = pctRate(posthogData.contacters, metrics.clientUsers)

  return (
    <>
      {posthogError && (
        <div
          role="alert"
          className="mb-6 rounded-[3px] border border-[#fecaca] bg-[#fef2f2] p-4 text-sm text-[#991b1b]"
        >
          <p className="font-medium">PostHog data unavailable</p>
          <p className="mt-1 text-xs text-[#991b1b]/80">{posthogError}</p>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h3 className="arco-section-title">Growth</h3>
          <p className="text-xs text-[#a1a1a0] mt-0.5">
            Lifecycle model and key metrics · <a href="/admin/growth/events" className="text-[#6b6b68] hover:text-[#1c1c1a] underline transition-colors">Tracking events</a>
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* View toggle */}
          <div className="flex items-center gap-1 border border-[#e5e5e4] rounded-[3px] overflow-hidden">
            <button
              onClick={() => handleViewChange("lifecycle")}
              className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${view === "lifecycle" ? "bg-[#1c1c1a] text-white" : "text-[#6b6b68] hover:bg-[#fafaf9]"}`}
            >
              Lifecycle
            </button>
            <button
              onClick={() => handleViewChange("table")}
              className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${view === "table" ? "bg-[#1c1c1a] text-white" : "text-[#6b6b68] hover:bg-[#fafaf9]"}`}
            >
              Table
            </button>
          </div>
          {/* Timeframe toggle */}
          <div className="flex items-center gap-1 border border-[#e5e5e4] rounded-[3px] overflow-hidden">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => handleTimeframeChange(tf.value)}
              className={`px-2 sm:px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                timeframe === tf.value
                  ? "bg-[#1c1c1a] text-white"
                  : "text-[#6b6b68] hover:bg-[#fafaf9]"
              } ${isPending ? "opacity-50" : ""}`}
            >
              <span className="sm:hidden">{tf.shortLabel}</span>
              <span className="hidden sm:inline">{tf.label}</span>
            </button>
          ))}
          </div>
          {/* Refresh PostHog data — busts the posthog_cache row for every
              timeframe (days/weeks/months/years) sequentially. Disabled
              while a refresh is in flight and when every known timeframe
              is < REFRESH_DEBOUNCE_MINUTES old. */}
          {(() => {
            const ages = (["days", "weeks", "months", "years"] as Timeframe[])
              .map((tf) => cacheAgeByTimeframe[tf])
              .filter((a): a is number => typeof a === "number")
            const allKnownAndFresh =
              ages.length > 0 && ages.every((a) => a < REFRESH_DEBOUNCE_MINUTES)
            const maxKnownAge = ages.length > 0 ? Math.max(...ages) : null
            const disabled = isRefreshingAll || !posthogData.loaded || allKnownAndFresh
            const title = isRefreshingAll
              ? "Refreshing all timeframes…"
              : allKnownAndFresh
                ? `All timeframes refreshed in the last ${REFRESH_DEBOUNCE_MINUTES} minutes`
                : maxKnownAge !== null
                  ? `Refresh all timeframes (oldest cache: ${maxKnownAge} min)`
                  : "Refresh all timeframes"
            const spinning = isRefreshingAll || !posthogData.loaded
            return (
              <button
                onClick={() => void refreshAllTimeframes()}
                disabled={disabled}
                title={title}
                aria-label={title}
                className="flex items-center justify-center h-[26px] w-[26px] border border-[#e5e5e4] rounded-[3px] text-[#6b6b68] hover:bg-[#fafaf9] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={spinning ? "animate-spin" : ""}>
                  <path d="M10.5 2v3h-3" />
                  <path d="M10.5 5A4.5 4.5 0 1 0 9 9.5" />
                </svg>
              </button>
            )
          })()}
        </div>
      </div>

      {view === "table" ? (
        <GrowthTableView
          rows={tableRows} labels={tableLabels} isPending={isPending}
          proVisitors={posthogData.proVisitors} clientVisitors={posthogData.clientVisitors}
          proVisitorsSeries={posthogData.proVisitorsSeries} clientVisitorsSeries={posthogData.clientVisitorsSeries}
          clientActives={posthogData.clientActives} clientActivesSeries={posthogData.clientActivesSeries}
          sharers={posthogData.sharers} sharersSeries={posthogData.sharersSeries}
          projectShares={posthogData.projectShares} professionalShares={posthogData.professionalShares}
          sharesPerClient={posthogData.sharesPerClient}
          projectSharesSeries={posthogData.projectSharesSeries}
          professionalSharesSeries={posthogData.professionalSharesSeries}
          sharesPerClientSeries={posthogData.sharesPerClientSeries}
          clientSources={posthogData.clientSources} proSources={posthogData.proSources}
          apolloVisitorsSeries={posthogData.apolloVisitorsSeries} inviteVisitorsSeries={posthogData.inviteVisitorsSeries}
          clientSourceSeries={posthogData.clientSourceSeries} proSourceSeries={posthogData.proSourceSeries}
        />
      ) : (
      <div className="mb-12 overflow-x-auto">
        <div style={{ minWidth: 1100 }}>

        {/* Column headers — Monetization sits in col 3, the column where the
            Subscribers card lives in the pro grid (and Contacters now sits
            above Subscribers in the same column). Acquisition (col 0) and
            Retention (col 2) keep their existing positions. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: G, marginBottom: 16 }}>
          <p className="arco-eyebrow" style={{ color: DRIVER.acquisition.label }}>Acquisition</p>
          <Empty />
          <p className="arco-eyebrow" style={{ color: DRIVER.retention.label }}>Retention</p>
          <p className="arco-eyebrow" style={{ color: DRIVER.monetization.label }}>Monetization</p>
          <Empty /><Empty /><Empty />
        </div>

        {/* ── Clients ─────────────────────────────────────────────────── */}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", columnGap: G, rowGap: 16, overflow: "visible", alignItems: "stretch" }}>
          {/* Row 1: Sharers (above the Signups→Contacters line) */}
          <Empty /><Empty />
          <Card label="Sharers" value={posthogData.sharers} metricKey="sharers" onCardClick={openDetail} driver="retention" connDown="" timeframe={timeframe} datapoints={posthogData.sharersSeries.length > 0 ? posthogData.sharersSeries : dp("sharers")} />
          <Empty /><Empty /><Empty /><Empty />

          {/* Row 2: Visitors → Signups → junction (branches up to Sharers,
              down to Savers). Contacters has been moved to the pro grid
              above Subscribers, so the horizontal continuation line that
              previously extended past the junction is gone. */}
          <Card label="Visitors" value={posthogData.clientVisitors} metricKey="client_visitors" onCardClick={openDetail} driver="acquisition" connRight={visitorToSignup} timeframe={timeframe} datapoints={posthogData.clientVisitorsSeries.length > 0 ? posthogData.clientVisitorsSeries : dp("client_visitors")} />
          {/* connDownHeight is measured at runtime — see signupsDraftsBridgeHeight
              effect below. Falls back to 280 on first render before measurement
              completes; the useEffect updates it once both cards are in the DOM. */}
          <Card label="Signups" value={ho.signups} metricKey="client_signups" onCardClick={openDetail} driver="acquisition" connRight="" connDown={cr.signupToDraft} connDownHeight={signupsDraftsBridgeHeight} dataName="signups" timeframe={timeframe} datapoints={dp("client_signups")} />
          {/* Junction: horizontal stem extends from Signups (left) all the
              way to Contacters (right, col 3) crossing the column gap.
              Vertical branches up (Sharers) and down (Savers). */}
          <div className="relative h-full" style={{ overflow: "visible" }}>
            {/* Horizontal stem: full junction width + gap, so it reaches
                Contacters' left edge in col 3. */}
            <div className="absolute" style={{ left: 0, top: "50%", transform: "translateY(-50%)", width: `calc(100% + ${G}px)`, zIndex: 20 }}>
              <div className="w-full border-t border-[#d4d4d3]" />
            </div>
            {/* Vertical branch up to Sharers */}
            <div className="absolute" style={{ left: "50%", transform: "translateX(-50%)", top: -16, bottom: "50%", zIndex: 20 }}>
              <div className="h-full border-l border-[#d4d4d3]" />
              {signupToSharer && signupToSharer !== "—" && (
                <span className="absolute text-[10px] font-medium text-[#6b6b68] bg-white px-1" style={{ left: 8, top: "50%", transform: "translateY(-50%)", whiteSpace: "nowrap" }}>{signupToSharer}</span>
              )}
            </div>
            {/* Vertical branch down to Savers */}
            <div className="absolute" style={{ left: "50%", transform: "translateX(-50%)", top: "50%", bottom: -16, zIndex: 20 }}>
              <div className="h-full border-l border-[#d4d4d3]" />
              {cr.clientSignupToSaver && cr.clientSignupToSaver !== "—" && (
                <span className="absolute text-[10px] font-medium text-[#6b6b68] bg-white px-1" style={{ left: 8, top: "50%", transform: "translateY(-50%)", whiteSpace: "nowrap" }}>{cr.clientSignupToSaver}</span>
              )}
            </div>
          </div>
          {/* Contacters lives in the Clients (top) grid at col 3 — same row
              as Signups, vertically aligned with the Subscribers card in
              the pro grid (which is also col 3). The Monetization column
              header sits above this column. */}
          <Card label="Contacters" metricKey="inquirers" onCardClick={openDetail} value={posthogData.contacters ?? "—"} driver="monetization" timeframe={timeframe} datapoints={dp("inquirers")} />
          <Empty /><Empty /><Empty />

          {/* Row 3: Savers (below the Signups→Contacters line) */}
          <Empty /><Empty />
          <Card label="Savers" value={ho.savedProjects} metricKey="savers" onCardClick={openDetail} driver="retention" connUp="" timeframe={timeframe} datapoints={dp("savers")} />
          <Empty /><Empty /><Empty /><Empty />
        </div>

        {/* ── Divider with labels ─────────────────────────────────────────── */}
        {/* The Signups → Drafts cross-funnel conversion rate is rendered as a
            connDown line on the Signups card (with `connDownHeight={200}`)
            that passes through this divider down to the Drafts card. */}
        <div className="relative my-6">
          <div className="border-t border-[#e5e5e4]" />
          <div className="absolute left-0" style={{ top: -18 }}>
            <p className="arco-eyebrow text-[#a1a1a0] bg-white pr-2">Clients ↑</p>
          </div>
          <div className="absolute left-0" style={{ top: 4 }}>
            <p className="arco-eyebrow text-[#a1a1a0] bg-white pr-2">Professionals ↓</p>
          </div>
        </div>

        {/* ── Professionals ───────────────────────────────────────────────── */}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: G, overflow: "visible", alignItems: "stretch", marginTop: 24 }}>
          {/* Row 1: Responders only. Contacters lives in the Clients grid
              (top, col 3 — same column as Subscribers below). Expanders /
              Contractors removed — will be folded back as supporting
              metrics on the Subscribers card. */}
          <Empty /><Empty />
          <Card label="Responders" metricKey="responders" onCardClick={openDetail} value="—" driver="retention" connDown="" timeframe={timeframe} datapoints={dp("responders")} />
          <Empty /><Empty /><Empty /><Empty />

          {/* Row 2: main flow. Renewers removed — Subscribers connects
              directly to Churners. Churners shifted from col 5 → col 4 so
              the line between them is a single column gap. */}
          <Card label="Visitors" value={posthogData.proVisitors} metricKey="pro_visitors" onCardClick={openDetail} driver="acquisition" connRight={proVisitorToDraft} timeframe={timeframe} datapoints={posthogData.proVisitorsSeries.length > 0 ? posthogData.proVisitorsSeries : dp("pro_visitors")} />
          <Card label="Drafts" value={metrics.draftCompanies} metricKey="drafts" onCardClick={openDetail} driver="acquisition" connRight={cr.proSignupToActive} dataName="drafts" timeframe={timeframe} datapoints={dp("drafts")} />
          <Card label="Listed" metricKey="actives" onCardClick={openDetail} value={metrics.listedCompanies} driver="retention" connRight={cr.proActiveToSubscriber} connUp="" connDown={cr.proActiveToPublisher} timeframe={timeframe} datapoints={dp("actives")} />
          <Card label="Subscribers" metricKey="subscribers" onCardClick={openDetail} value={pr.subscribed} driver="monetization" connRight="" timeframe={timeframe} datapoints={dp("subscribers")} />
          <Card label="Churners" metricKey="churn" onCardClick={openDetail} value="—" driver="churn" timeframe={timeframe} datapoints={dp("churn")} />
          <Empty /><Empty />

          {/* Row 3: Publishers only — Contractors removed. */}
          <Empty /><Empty />
          <Card label="Publishers" metricKey="publishers" onCardClick={openDetail} value={metrics.publisherCompanies} driver="retention" connUp="" connDown={cr.proPublisherToInviter} timeframe={timeframe} datapoints={dp("publishers")} />
          <Empty /><Empty /><Empty /><Empty />

          {/* Row 4: Inviter */}
          <Empty /><Empty />
          <Card label="Inviters" metricKey="inviters" onCardClick={openDetail} value={pr.inviterCompanies} driver="retention" connUp="" timeframe={timeframe} datapoints={dp("inviters")} />
          <Empty /><Empty /><Empty /><Empty />
        </div>
        </div>
      </div>
      )}

      {/* Metric detail modal */}
      <MetricDetailModal
        metricKey={detailMetric}
        currentValue={detailValue}
        conversions={getConversions(detailMetric)}
        sources={detailMetric === "pro_visitors" ? posthogData.proSources : posthogData.clientSources}
        sourceSeries={detailMetric === "pro_visitors" ? posthogData.proSourceSeries : posthogData.clientSourceSeries}
        mainSeries={detailMetric === "pro_visitors" ? posthogData.proVisitorsSeries : detailMetric === "client_visitors" ? posthogData.clientVisitorsSeries : undefined}
        timeframe={timeframe}
        onTimeframeChange={handleTimeframeChange}
        onClose={() => setDetailMetric(null)}
      />
    </>
  )
}
