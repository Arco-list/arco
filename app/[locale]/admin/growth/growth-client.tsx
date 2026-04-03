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
function CardSparkline({ datapoints, color, rollingLabel }: { datapoints: number[]; color: string; rollingLabel?: string }) {
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
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
        <polyline points={solidLine} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        {last && rolling && (
          <line x1={last.x} y1={last.y} x2={rolling.x} y2={rolling.y}
            stroke={color} strokeWidth="1.5" strokeDasharray="3,3" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
        )}
      </svg>
      {points.map((p, i) => {
        const leftPct = (p.x / w) * 100
        const topPct = (p.y / h) * 100
        return (
          <div key={i} className="absolute" style={{ left: `${leftPct}%`, top: `${topPct}%`, transform: "translate(-50%, -50%)" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", border: `1.5px solid ${color}`, background: "white", opacity: p.isRolling ? 0.5 : 1 }} />
            {p.isRolling && (
              <span
                className="absolute whitespace-nowrap"
                style={{ bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 2, fontSize: 12, fontWeight: 600, color: "#1c1c1a" }}
              >
                {p.v}
              </span>
            )}
          </div>
        )
      })}
      {rollingLabel && (
        <div style={{ textAlign: "right", marginTop: 1 }}>
          <span style={{ fontSize: 8, color: "#a1a1a0" }}>{rollingLabel}</span>
        </div>
      )}
    </div>
  )
}

const ROLLING_LABEL: Record<string, string> = {
  days: "today",
  weeks: "this week",
  months: "this month",
  years: "this year",
}

// Card with optional connectors and sparkline chart
function Card({ label, value, driver, connRight, connDown, connUp, datapoints, metricKey, onCardClick, timeframe }: {
  label: string; value: number | string | null; driver: Driver
  connRight?: string; connDown?: string; connUp?: string
  datapoints?: number[]
  metricKey?: string
  onCardClick?: (key: string, value: number | string | null) => void
  timeframe?: string
}) {
  const c = DRIVER[driver]
  return (
    <div className="relative h-full" style={{ overflow: "visible" }}>
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
        <div className="absolute" style={{ top: "100%", left: "50%", transform: "translateX(-50%)", height: G, zIndex: 20 }}>
          {connDown && connDown !== "—" && (
            <span className="absolute text-[10px] font-medium text-[#6b6b68]" style={{ left: 8, top: "50%", transform: "translateY(-50%)", whiteSpace: "nowrap" }}>{connDown}</span>
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
        {datapoints && <CardSparkline datapoints={datapoints} color={c.label} rollingLabel={timeframe ? ROLLING_LABEL[timeframe] : undefined} />}
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

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "days", label: "Days" },
  { value: "weeks", label: "Weeks" },
  { value: "months", label: "Months" },
  { value: "years", label: "Years" },
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
  const [view, setView] = useState<"lifecycle" | "table">("lifecycle")
  const [tableRows, setTableRows] = useState<MetricRow[]>([])
  const [tableLabels, setTableLabels] = useState<string[]>([])
  const [posthogData, setPosthogData] = useState<{
    proVisitors: number | null
    clientVisitors: number | null
    sharers: number | null
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
    clientSources: Array<{ label: string; pct: number; count: number }>
    proSources: Array<{ label: string; pct: number; count: number }>
    clientSourceSeries: Record<string, number[]>
    proSourceSeries: Record<string, number[]>
    loaded: boolean
  }>({ proVisitors: null, clientVisitors: null, sharers: null, sharesPerClient: 0, projectShares: 0, professionalShares: 0, apolloVisitors: 0, inviteVisitors: 0, clientActives: 0, clientActivesSeries: [], apolloVisitorsSeries: [], inviteVisitorsSeries: [], proVisitorsSeries: [], clientVisitorsSeries: [], sharersSeries: [], clientSources: [], proSources: [], clientSourceSeries: {}, proSourceSeries: {}, loaded: false })

  const [detailMetric, setDetailMetric] = useState<string | null>(null)
  const [detailValue, setDetailValue] = useState<number | string | null>(null)

  const openDetail = (key: string, value: number | string | null) => {
    setDetailMetric(key)
    setDetailValue(value)
  }

  // Build conversion rates per metric for the popup
  const getConversions = (key: string | null) => {
    if (!key || !metrics.cohortedRates) return []
    const cr = metrics.cohortedRates
    const convMap: Record<string, Array<{ label: string; value: string }>> = {
      drafts: [
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
      client_signups: [
        { label: "→ Active", value: "—" },
      ],
      client_actives: [
        { label: "← From signup", value: "—" },
        { label: "→ Saver", value: cr.clientSignupToSaver },
      ],
      savers: [
        { label: "← From active", value: "—" },
      ],
      inquirers: [
        { label: "← From active", value: "—" },
      ],
    }
    return convMap[key] ?? []
  }

  const fetchPosthog = (tf: Timeframe) => {
    fetch(`/api/growth-posthog?tf=${tf}`)
      .then((r) => r.json())
      .then((d) => {
        setPosthogData({
          proVisitors: d.proVisitors ?? null,
          clientVisitors: d.clientVisitors ?? null,
          sharers: d.sharers ?? null,
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
          clientSources: d.clientSources ?? [],
          proSources: d.proSources ?? [],
          clientSourceSeries: d.clientSourceSeries ?? {},
          proSourceSeries: d.proSourceSeries ?? {},
          loaded: true,
        })
      })
      .catch(() => {})
  }

  useEffect(() => {
    fetchPosthog(timeframe)
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

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="arco-section-title">Growth</h3>
          <p className="text-xs text-[#a1a1a0] mt-0.5">
            Lifecycle model and key metrics · <a href="/admin/growth/events" className="text-[#6b6b68] hover:text-[#1c1c1a] underline transition-colors">Tracking events</a>
          </p>
        </div>
        <div className="flex items-center gap-3">
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
              className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                timeframe === tf.value
                  ? "bg-[#1c1c1a] text-white"
                  : "text-[#6b6b68] hover:bg-[#fafaf9]"
              } ${isPending ? "opacity-50" : ""}`}
            >
              {tf.label}
            </button>
          ))}
          </div>
        </div>
      </div>

      {view === "table" ? (
        <GrowthTableView
          rows={tableRows} labels={tableLabels} isPending={isPending}
          proVisitors={posthogData.proVisitors} clientVisitors={posthogData.clientVisitors}
          proVisitorsSeries={posthogData.proVisitorsSeries} clientVisitorsSeries={posthogData.clientVisitorsSeries}
          clientActives={posthogData.clientActives} clientActivesSeries={posthogData.clientActivesSeries}
          sharers={posthogData.sharers} sharersSeries={posthogData.sharersSeries}
          clientSources={posthogData.clientSources} proSources={posthogData.proSources}
          apolloVisitorsSeries={posthogData.apolloVisitorsSeries} inviteVisitorsSeries={posthogData.inviteVisitorsSeries}
          clientSourceSeries={posthogData.clientSourceSeries} proSourceSeries={posthogData.proSourceSeries}
        />
      ) : (
      <div className="mb-12">
        <p className="arco-h4 mb-6">Lifecycle Model</p>

        {/* Column headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: G, marginBottom: 16 }}>
          <p className="arco-eyebrow" style={{ color: DRIVER.acquisition.label }}>Acquisition</p>
          <Empty />
          <p className="arco-eyebrow" style={{ color: DRIVER.retention.label }}>Retention</p>
          <Empty />
          <p className="arco-eyebrow" style={{ color: DRIVER.monetization.label }}>Monetization</p>
          <Empty /><Empty />
        </div>

        {/* ── Clients ─────────────────────────────────────────────────── */}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", columnGap: G, rowGap: 16, overflow: "visible", alignItems: "stretch" }}>
          {/* Row 1: Sharers (above the Signups→Contacters line) */}
          <Empty /><Empty />
          <Card label="Sharers" value={posthogData.sharers} metricKey="sharers" onCardClick={openDetail} driver="retention" connDown="" timeframe={timeframe} datapoints={posthogData.sharersSeries.length > 0 ? posthogData.sharersSeries : dp("sharers")} />
          <Empty /><Empty /><Empty /><Empty />

          {/* Row 2: Visitors → Signups → ─── → Contacters (with branches up/down) */}
          <Card label="Visitors" value={posthogData.clientVisitors} metricKey="client_visitors" onCardClick={openDetail} driver="acquisition" connRight="" timeframe={timeframe} datapoints={posthogData.clientVisitorsSeries.length > 0 ? posthogData.clientVisitorsSeries : dp("client_visitors")} />
          <Card label="Signups" value={ho.signups} metricKey="client_signups" onCardClick={openDetail} driver="acquisition" connRight="" timeframe={timeframe} datapoints={dp("client_signups")} />
          {/* Junction: horizontal line with vertical branches to Sharers (up) and Savers (down) */}
          <div className="relative h-full" style={{ overflow: "visible" }}>
            {/* Horizontal line through center — extends across gap to next column */}
            <div className="absolute" style={{ left: 0, top: "50%", transform: "translateY(-50%)", width: `calc(100% + ${G}px)`, zIndex: 20 }}>
              <div className="w-full border-t border-[#d4d4d3]" />
            </div>
            {/* Vertical branch up to Sharers */}
            <div className="absolute" style={{ left: "50%", transform: "translateX(-50%)", top: -16, bottom: "50%", zIndex: 20 }}>
              <div className="h-full border-l border-[#d4d4d3]" />
            </div>
            {/* Vertical branch down to Savers */}
            <div className="absolute" style={{ left: "50%", transform: "translateX(-50%)", top: "50%", bottom: -16, zIndex: 20 }}>
              <div className="h-full border-l border-[#d4d4d3]" />
            </div>
          </div>
          {/* Horizontal continuation line across the empty column to Contacters */}
          <div className="relative h-full" style={{ overflow: "visible" }}>
            <div className="absolute" style={{ left: 0, top: "50%", transform: "translateY(-50%)", width: `calc(100% + ${G}px)`, zIndex: 20 }}>
              <div className="w-full border-t border-[#d4d4d3]" />
            </div>
          </div>
          <Card label="Contacters" metricKey="inquirers" onCardClick={openDetail} value="—" driver="monetization" timeframe={timeframe} datapoints={dp("inquirers")} />
          <Empty /><Empty />

          {/* Row 3: Savers (below the Signups→Contacters line) */}
          <Empty /><Empty />
          <Card label="Savers" value={ho.savedProjects} metricKey="savers" onCardClick={openDetail} driver="retention" connUp="" timeframe={timeframe} datapoints={dp("savers")} />
          <Empty /><Empty /><Empty /><Empty />
        </div>

        {/* ── Divider with labels ─────────────────────────────────────────── */}
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
          {/* Row 1: Responder, Expansion */}
          <Empty /><Empty />
          <Card label="Responders" metricKey="responders" onCardClick={openDetail} value="—" driver="retention" connDown="" timeframe={timeframe} datapoints={dp("responders")} />
          <Empty />
          <Card label="Expanders" metricKey="expansions" onCardClick={openDetail} value="—" driver="monetization" connDown="" timeframe={timeframe} datapoints={dp("expansions")} />
          <Empty /><Empty />

          {/* Row 2: main flow */}
          <Card label="Visitors" value={posthogData.proVisitors} metricKey="pro_visitors" onCardClick={openDetail} driver="acquisition" connRight="" timeframe={timeframe} datapoints={posthogData.proVisitorsSeries.length > 0 ? posthogData.proVisitorsSeries : dp("pro_visitors")} />
          <Card label="Drafts" value={metrics.draftCompanies} metricKey="drafts" onCardClick={openDetail} driver="acquisition" connRight="" timeframe={timeframe} datapoints={dp("drafts")} />
          <Card label="Listed" metricKey="actives" onCardClick={openDetail} value={metrics.listedCompanies} driver="retention" connRight="" connUp="" connDown={cr.proActiveToPublisher} timeframe={timeframe} datapoints={dp("actives")} />
          <Card label="Subscribers" metricKey="subscribers" onCardClick={openDetail} value={pr.subscribed} driver="monetization" connRight="" timeframe={timeframe} datapoints={dp("subscribers")} />
          <Card label="Renewers" metricKey="renewals" onCardClick={openDetail} value="—" driver="monetization" connRight="" connUp="" connDown="" timeframe={timeframe} datapoints={dp("renewals")} />
          <Card label="Churners" metricKey="churn" onCardClick={openDetail} value="—" driver="churn" timeframe={timeframe} datapoints={dp("churn")} />
          <Empty />

          {/* Row 3: Publisher, Contraction */}
          <Empty /><Empty />
          <Card label="Publishers" metricKey="publishers" onCardClick={openDetail} value={metrics.publisherCompanies} driver="retention" connUp="" connDown={cr.proPublisherToInviter} timeframe={timeframe} datapoints={dp("publishers")} />
          <Empty />
          <Card label="Contractors" metricKey="contractions" onCardClick={openDetail} value="—" driver="monetization" connUp="" timeframe={timeframe} datapoints={dp("contractions")} />
          <Empty /><Empty />

          {/* Row 4: Inviter */}
          <Empty /><Empty />
          <Card label="Inviters" metricKey="inviters" onCardClick={openDetail} value={pr.inviterCompanies} driver="retention" connUp="" timeframe={timeframe} datapoints={dp("inviters")} />
          <Empty /><Empty /><Empty /><Empty />
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
