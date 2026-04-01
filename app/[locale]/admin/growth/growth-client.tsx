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

type SubMetric = { value: number | string | null; label: string }

// Card with optional connectors and supporting metrics
function Card({ label, value, driver, connRight, connDown, connUp, subs, metricKey, onCardClick }: {
  label: string; value: number | string | null; driver: Driver
  connRight?: string; connDown?: string; connUp?: string
  subs?: SubMetric[]
  metricKey?: string
  onCardClick?: (key: string, value: number | string | null) => void
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
        className={`rounded-[3px] border border-[#e5e5e4] bg-white px-4 py-3 relative z-10 ${metricKey ? "cursor-pointer hover:border-[#c4c4c2] transition-colors" : ""}`}
        style={{ height: 100 }}
        onClick={metricKey && onCardClick ? () => onCardClick(metricKey, value) : undefined}
      >
        <div className="flex items-center gap-[6px] mb-1.5">
          <span className="status-pill-dot" style={{ background: c.label }} />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 400, color: "var(--text-primary)" }}>{label}</span>
        </div>
        <p className="arco-card-title mb-1">{value ?? "—"}</p>
        {subs && subs.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {subs.slice(0, 2).map((s, i) => (
              <div key={i} className="flex items-baseline gap-1">
                <span className="text-[11px] font-medium text-[#1c1c1a]">{s.value ?? "—"}</span>
                <span className="text-[10px] text-[#a1a1a0]">{s.label}</span>
              </div>
            ))}
          </div>
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

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "ytd", label: "Year to date" },
  { value: "all", label: "All time" },
]

export function GrowthClient({ initialMetrics }: Props) {
  const [metrics, setMetrics] = useState(initialMetrics)
  const [timeframe, setTimeframe] = useState<Timeframe>("all")
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

  useEffect(() => { fetchPosthog(timeframe) }, [])

  const handleTimeframeChange = (tf: Timeframe) => {
    setTimeframe(tf)
    fetchPosthog(tf)
    startTransition(async () => {
      const [metricsData, tableData] = await Promise.all([
        fetchGrowthMetrics(tf),
        view === "table" ? fetchMetricTable(tf) : Promise.resolve(null),
      ])
      setMetrics(metricsData)
      if (tableData) {
        setTableRows(tableData.rows)
        setTableLabels(tableData.labels)
      }
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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: G, overflow: "visible", alignItems: "stretch" }}>
          {/* Row 1: Sharers (above Actives) */}
          <Empty /><Empty />
          <Card label="Sharers" value={posthogData.sharers} metricKey="sharers" onCardClick={openDetail} driver="retention" connDown="" subs={[
            { value: posthogData.sharesPerClient || "—", label: "shares/client" },
            { value: posthogData.projectShares, label: "projects" },
            { value: posthogData.professionalShares, label: "professionals" },
          ]} />
          <Empty /><Empty /><Empty /><Empty />

          {/* Row 2: Visitors → Signups → Actives → Inquirers */}
          <Card label="Visitors" value={posthogData.clientVisitors} metricKey="client_visitors" onCardClick={openDetail} driver="acquisition" connRight="" subs={posthogData.clientSources.slice(0, 2).map((s) => ({ value: `${s.pct}%`, label: s.label.toLowerCase() }))} />
          <Card label="Signups" value={ho.signups} metricKey="client_signups" onCardClick={openDetail} driver="acquisition" connRight="" subs={[{ value: "—", label: "google" }, { value: "—", label: "email" }]} />
          <Card label="Actives" value={posthogData.clientActives} metricKey="client_actives" onCardClick={openDetail} driver="retention" connRight="" connUp="" connDown="" subs={[]} />
          <Empty />
          <Card label="Inquirers" metricKey="inquirers" onCardClick={openDetail} value="—" driver="monetization" subs={[{ value: "—", label: "contacted" }]} />
          <Empty /><Empty />

          {/* Row 3: Savers (below Actives) */}
          <Empty /><Empty />
          <Card label="Savers" value={ho.savedProjects} metricKey="savers" onCardClick={openDetail} driver="retention" connUp="" subs={[{ value: ho.savesPerClient, label: "saves/client" }]} />
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
          <Card label="Responders" metricKey="responders" onCardClick={openDetail} value="—" driver="retention" connDown="" subs={[{ value: "—", label: "replies" }]} />
          <Empty /><Empty />
          <Card label="Expansions" metricKey="expansions" onCardClick={openDetail} value="—" driver="monetization" connDown="" subs={[{ value: "—", label: "upgrades" }]} />
          <Empty />

          {/* Row 2: main flow */}
          <Card label="Visitors" value={posthogData.proVisitors} metricKey="pro_visitors" onCardClick={openDetail} driver="acquisition" connRight="" subs={posthogData.proSources.map((s) => ({ value: `${s.pct}%`, label: s.label.toLowerCase() }))} />
          <Card label="Draft" value={metrics.draftCompanies} metricKey="drafts" onCardClick={openDetail} driver="acquisition" connRight="" subs={[]} />
          <Card label="Listed" metricKey="actives" onCardClick={openDetail} value={metrics.listedCompanies} driver="retention" connRight="" connUp="" connDown={cr.proActiveToPublisher} subs={[{ value: metrics.unlistedCompanies, label: "unlisted" }]} />
          <Card label="Trials" metricKey="trials" onCardClick={openDetail} value="—" driver="retention" connRight="" subs={[{ value: "—", label: "started" }]} />
          <Card label="Subscribers" metricKey="subscribers" onCardClick={openDetail} value={pr.subscribed} driver="monetization" connRight="" subs={[{ value: "—", label: "MRR" }]} />
          <Card label="Renewals" metricKey="renewals" onCardClick={openDetail} value="—" driver="monetization" connRight="" connUp="" connDown="" subs={[{ value: "—", label: "renewed" }]} />
          <Card label="Churn" metricKey="churn" onCardClick={openDetail} value="—" driver="churn" subs={[{ value: "—", label: "lost" }]} />

          {/* Row 3: Publisher, Contraction */}
          <Empty /><Empty />
          <Card label="Publishers" metricKey="publishers" onCardClick={openDetail} value={metrics.publisherCompanies} driver="retention" connUp="" connDown={cr.proPublisherToInviter} subs={[{ value: metrics.publishedProjects, label: "projects" }]} />
          <Empty /><Empty />
          <Card label="Contractions" metricKey="contractions" onCardClick={openDetail} value="—" driver="monetization" connUp="" subs={[{ value: "—", label: "downgrades" }]} />
          <Empty />

          {/* Row 4: Inviter */}
          <Empty /><Empty />
          <Card label="Inviters" metricKey="inviters" onCardClick={openDetail} value={pr.inviterCompanies} driver="retention" connUp="" subs={[{ value: pr.professionalsInvited, label: "pros invited" }, { value: pr.invitesAcceptedPct, label: "accepted" }]} />
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
