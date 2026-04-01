"use client"

import { useState } from "react"
import type { MetricRow } from "./table-actions"

const DRIVER_COLORS: Record<string, string> = {
  acquisition: "#2563eb",
  retention: "#7c3aed",
  monetization: "#0f766e",
  churn: "#dc2626",
}

// ─── Trendline with labels spanning all 6 columns ─────────────────────────────

function TrendlineCell({ datapoints, labels, color }: { datapoints: number[]; labels: string[]; color: string }) {
  const max = Math.max(...datapoints, 1)
  const n = datapoints.length
  const padX = 20
  const padY = 16
  const w = 100
  const h = 50

  const points = datapoints.map((v, i) => ({
    x: padX + (i / (n - 1)) * (w - padX * 2),
    y: h - padY - (v / max) * (h - padY * 2),
    v,
  }))

  const linePoints = points.map((p) => `${p.x},${p.y}`).join(" ")

  return (
    <div className="relative w-full" style={{ height: 60 }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {/* Grid lines at each data point */}
        {points.map((p, i) => (
          <line key={i} x1={p.x} y1={0} x2={p.x} y2={h} stroke="#f0f0ee" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
        ))}
        {/* Trend line */}
        <polyline points={linePoints} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots — rendered outside preserveAspectRatio=none to keep them round */}
      </svg>

      {/* Dots and value labels */}
      {points.map((p, i) => {
        const leftPct = (p.x / w) * 100
        const topPct = (p.y / h) * 100
        return (
          <div key={i} className="absolute" style={{ left: `${leftPct}%`, top: `${topPct}%`, transform: "translate(-50%, -50%)" }}>
            {/* Dot */}
            <div className="w-[7px] h-[7px] rounded-full border-[1.5px] bg-white" style={{ borderColor: color }} />
            {/* Value label above */}
            <span
              className="absolute text-[11px] font-medium text-[#1c1c1a] whitespace-nowrap"
              style={{ bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 4 }}
            >
              {p.v > 0 ? p.v : "·"}
            </span>
          </div>
        )
      })}

    </div>
  )
}

// ─── Sub-metric trendline (smaller, grey) ─────────────────────────────────────

function SubTrendlineCell({ datapoints }: { datapoints: number[] }) {
  const hasData = datapoints.some((v) => v > 0)

  if (!hasData) {
    return <div className="w-full flex items-center" style={{ height: 40 }}>
      <span className="text-[10px] text-[#c4c4c2] italic">No data yet</span>
    </div>
  }

  const max = Math.max(...datapoints, 1)
  const n = datapoints.length
  const padX = 20
  const padY = 10
  const w = 100
  const h = 40

  const points = datapoints.map((v, i) => ({
    x: padX + (i / Math.max(n - 1, 1)) * (w - padX * 2),
    y: h - padY - (v / max) * (h - padY * 2),
    v,
  }))

  const linePoints = points.map((p) => `${p.x},${p.y}`).join(" ")

  return (
    <div className="relative w-full" style={{ height: 40 }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <polyline points={linePoints} fill="none" stroke="#a1a1a0" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {/* Dots and labels */}
      {points.map((p, i) => {
        const leftPct = (p.x / w) * 100
        const topPct = (p.y / h) * 100
        return (
          <div key={i} className="absolute" style={{ left: `${leftPct}%`, top: `${topPct}%`, transform: "translate(-50%, -50%)" }}>
            <div className="w-[5px] h-[5px] rounded-full border bg-white" style={{ borderColor: "#a1a1a0" }} />
            <span
              className="absolute text-[10px] font-medium text-[#1c1c1a] whitespace-nowrap"
              style={{ bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 2 }}
            >
              {p.v > 0 ? p.v : ""}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Metric Row ───────────────────────────────────────────────────────────────

function MetricRowComponent({ row, labels }: { row: MetricRow; labels: string[] }) {
  const [expanded, setExpanded] = useState(false)
  const color = DRIVER_COLORS[row.driver] ?? "#6b6b68"
  const hasSubs = row.subs.length > 0

  return (
    <>
      <tr
        className={`border-b border-[#f0f0ee] hover:bg-[#fafaf9] transition-colors ${hasSubs ? "cursor-pointer" : ""}`}
        onClick={hasSubs ? () => setExpanded(!expanded) : undefined}
      >
        {/* Metric name */}
        <td className="px-4 py-2" style={{ width: "18%" }}>
          <div className="flex items-center gap-2">
            {hasSubs ? (
              <svg width="10" height="10" viewBox="0 0 10 10" className={`shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}>
                <path d="M3 2L7 5L3 8" stroke="#a1a1a0" strokeWidth="1.2" fill="none" strokeLinecap="round" />
              </svg>
            ) : <div style={{ width: 10 }} />}
            <span className="status-pill-dot shrink-0" style={{ background: color }} />
            <span className="text-[12px] font-medium text-[#1c1c1a]">{row.label}</span>
          </div>
        </td>

        {/* Total */}
        <td className="px-3 py-2 text-right" style={{ width: "8%" }}>
          <span className="arco-card-title">{row.total}</span>
        </td>

        {/* Combined trendline */}
        <td className="px-4 py-2" style={{ width: "74%" }}>
          <TrendlineCell datapoints={row.datapoints} labels={labels} color={color} />
        </td>
      </tr>

      {/* Expanded sub-metrics */}
      {expanded && row.subs.map((sub) => (
        <tr key={sub.key} className="border-b border-[#f0f0ee]">
          <td className="px-4 py-1.5">
            <div className="flex items-center gap-2 pl-7">
              <span className="text-[11px] text-[#1c1c1a]">{sub.label}</span>
            </div>
          </td>
          <td className="px-3 py-1.5 text-right">
            <span className="text-[13px] font-normal text-[#1c1c1a]">{sub.total}</span>
          </td>
          <td className="px-4 py-1.5">
            <SubTrendlineCell datapoints={sub.datapoints} />
          </td>
        </tr>
      ))}
    </>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  rows: MetricRow[]
  labels: string[]
  isPending: boolean
  proVisitors?: number | null
  clientVisitors?: number | null
  proVisitorsSeries?: number[]
  clientVisitorsSeries?: number[]
  clientActives?: number | null
  clientActivesSeries?: number[]
  sharers?: number | null
  sharersSeries?: number[]
  clientSources?: Array<{ label: string; pct: number; count: number }>
  proSources?: Array<{ label: string; pct: number; count: number }>
  apolloVisitorsSeries?: number[]
  inviteVisitorsSeries?: number[]
  clientSourceSeries?: Record<string, number[]>
  proSourceSeries?: Record<string, number[]>
}

export function GrowthTableView({ rows, labels, isPending, proVisitors, clientVisitors, proVisitorsSeries, clientVisitorsSeries, clientActives, clientActivesSeries, sharers, sharersSeries, clientSources, proSources, apolloVisitorsSeries, inviteVisitorsSeries, clientSourceSeries, proSourceSeries }: Props) {
  const pad6 = (arr: number[] | undefined): number[] => {
    if (!arr || arr.length === 0) return [0, 0, 0, 0, 0, 0]
    if (arr.length >= 6) return arr.slice(0, 6)
    return [...arr, ...Array(6 - arr.length).fill(0)]
  }

  // Map source label → sub key for matching
  const sourceKeyMap: Record<string, string> = {
    "Direct": "direct",
    "Google": "google",
    "Organic search": "google",
    "Social": "social",
    "Email": "email",
    "Referral": "referral",
    "Sales (Apollo)": "sales_apollo",
    "Invites": "invites",
  }

  const overrideSubs = (
    subs: typeof rows[0]["subs"],
    sources: Array<{ label: string; pct: number; count: number }> | undefined,
    seriesMap?: Record<string, number[]>,
  ) => {
    if (!sources || sources.length === 0) return subs
    return subs.map((sub) => {
      const match = sources.find((s) => sourceKeyMap[s.label] === sub.key)
      const series = seriesMap?.[sub.key]
      return match
        ? { ...sub, total: match.count, datapoints: series ? pad6(series) : sub.datapoints }
        : { ...sub, datapoints: series ? pad6(series) : sub.datapoints }
    })
  }

  const sepIndex = rows.findIndex((r) => r.key === "_sep")
  const proRows = (sepIndex >= 0 ? rows.slice(0, sepIndex) : rows).map((r) => {
    if (r.key === "pro_visitors") return {
      ...r,
      total: proVisitors ?? 0,
      datapoints: pad6(proVisitorsSeries),
      subs: overrideSubs(r.subs, proSources, {
        sales_apollo: apolloVisitorsSeries ?? [],
        invites: inviteVisitorsSeries ?? [],
        ...(proSourceSeries ?? {}),
      }),
    }
    return r
  })
  const clientRows = (sepIndex >= 0 ? rows.slice(sepIndex + 1) : []).map((r) => {
    if (r.key === "client_visitors") return {
      ...r,
      total: clientVisitors ?? 0,
      datapoints: pad6(clientVisitorsSeries),
      subs: overrideSubs(r.subs, clientSources, clientSourceSeries),
    }
    if (r.key === "client_actives") return { ...r, total: clientActives ?? 0, datapoints: pad6(clientActivesSeries) }
    if (r.key === "sharers") return { ...r, total: sharers ?? 0, datapoints: pad6(sharersSeries) }
    return r
  })

  if (rows.length === 0) {
    return <p className="text-[12px] text-[#a1a1a0] py-8 text-center">{isPending ? "Loading..." : "Loading table data..."}</p>
  }

  return (
    <div className="border border-[#e5e5e4] rounded-[3px] overflow-hidden">
      <table className="w-full table-fixed">
        <thead>
          <tr className="bg-[#fafaf9] border-b border-[#e5e5e4]">
            <th className="px-4 py-2 text-left" style={{ width: "18%" }}><span className="arco-eyebrow text-[#a1a1a0]">Metric</span></th>
            <th className="px-3 py-2 text-right" style={{ width: "8%" }}><span className="arco-eyebrow text-[#a1a1a0]">Total</span></th>
            <th className="px-4 py-2" style={{ width: "74%" }}>
              <div className="flex justify-between" style={{ paddingLeft: "calc(20%)", paddingRight: "calc(20%)" }}>
                {(labels.length > 0 ? labels : ["—", "—", "—", "—", "—", "—"]).map((l, i) => (
                  <span key={i} className="arco-eyebrow text-[#a1a1a0]">{l}</span>
                ))}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Clients */}
          <tr className="border-b border-[#e5e5e4]">
            <td colSpan={3} className="px-4 py-2 bg-white">
              <p className="arco-eyebrow text-[#a1a1a0]">Clients</p>
            </td>
          </tr>
          {clientRows.map((row) => <MetricRowComponent key={row.key} row={row} labels={labels} />)}

          {/* Professionals */}
          <tr className="border-b border-[#e5e5e4]">
            <td colSpan={3} className="px-4 py-2 bg-white">
              <p className="arco-eyebrow text-[#a1a1a0]">Professionals</p>
            </td>
          </tr>
          {proRows.map((row) => <MetricRowComponent key={row.key} row={row} labels={labels} />)}
        </tbody>
      </table>
    </div>
  )
}
