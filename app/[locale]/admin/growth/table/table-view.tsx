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
  const padX = 14
  const padY = 16
  const w = 100
  const h = 50
  const lastCompleted = n - 2 // index of last completed period

  const points = datapoints.map((v, i) => ({
    x: padX + (i / (n - 1)) * (w - padX * 2),
    y: h - padY - (v / max) * (h - padY * 2),
    v,
    isRolling: i === n - 1,
  }))

  // Solid line for completed periods (0 to n-2)
  const solidPoints = points.slice(0, lastCompleted + 1).map((p) => `${p.x},${p.y}`).join(" ")
  // Dotted line from last completed to rolling
  const dottedLine = points.length >= 2 ? { x1: points[lastCompleted].x, y1: points[lastCompleted].y, x2: points[n - 1].x, y2: points[n - 1].y } : null

  return (
    <div className="relative w-full" style={{ height: 60 }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {points.map((p, i) => (
          <line key={i} x1={p.x} y1={0} x2={p.x} y2={h} stroke="#f0f0ee" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
        ))}
        {/* Solid trend line (completed periods) */}
        <polyline points={solidPoints} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dotted line to rolling period */}
        {dottedLine && (
          <line x1={dottedLine.x1} y1={dottedLine.y1} x2={dottedLine.x2} y2={dottedLine.y2}
            stroke={color} strokeWidth="1.5" strokeDasharray="3,3" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
        )}
      </svg>

      {points.map((p, i) => {
        const leftPct = (p.x / w) * 100
        const topPct = (p.y / h) * 100
        return (
          <div key={i} className="absolute" style={{ left: `${leftPct}%`, top: `${topPct}%`, transform: "translate(-50%, -50%)" }}>
            <div className="w-[7px] h-[7px] rounded-full border-[1.5px] bg-white" style={{ borderColor: color, opacity: p.isRolling ? 0.6 : 1 }} />
            <span
              className="absolute text-[11px] font-medium whitespace-nowrap"
              style={{ bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 4, color: p.isRolling ? "#a1a1a0" : "#1c1c1a" }}
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
  const padX = 14
  const padY = 10
  const w = 100
  const h = 40
  const lastCompleted = n - 2

  const points = datapoints.map((v, i) => ({
    x: padX + (i / Math.max(n - 1, 1)) * (w - padX * 2),
    y: h - padY - (v / max) * (h - padY * 2),
    v,
    isRolling: i === n - 1,
  }))

  const solidPoints = points.slice(0, lastCompleted + 1).map((p) => `${p.x},${p.y}`).join(" ")
  const dottedLine = points.length >= 2 ? { x1: points[lastCompleted].x, y1: points[lastCompleted].y, x2: points[n - 1].x, y2: points[n - 1].y } : null

  return (
    <div className="relative w-full" style={{ height: 40 }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <polyline points={solidPoints} fill="none" stroke="#a1a1a0" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        {dottedLine && (
          <line x1={dottedLine.x1} y1={dottedLine.y1} x2={dottedLine.x2} y2={dottedLine.y2}
            stroke="#a1a1a0" strokeWidth="1" strokeDasharray="3,3" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
        )}
      </svg>
      {points.map((p, i) => {
        const leftPct = (p.x / w) * 100
        const topPct = (p.y / h) * 100
        return (
          <div key={i} className="absolute" style={{ left: `${leftPct}%`, top: `${topPct}%`, transform: "translate(-50%, -50%)" }}>
            <div className="w-[5px] h-[5px] rounded-full border bg-white" style={{ borderColor: "#a1a1a0", opacity: p.isRolling ? 0.5 : 1 }} />
            <span
              className="absolute text-[10px] font-medium whitespace-nowrap"
              style={{ bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 2, color: p.isRolling ? "#c4c4c2" : "#1c1c1a" }}
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
        <td className="px-4 py-2" style={{ width: "14%" }}>
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

        {/* Definition */}
        <td className="px-3 py-2" style={{ width: "24%" }}>
          <span className="text-[11px] text-[#a1a1a0]">{row.definition ?? ""}</span>
        </td>

        {/* Combined trendline */}
        <td className="px-4 py-2" style={{ width: "60%" }}>
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
          <td className="px-3 py-1.5">
            <span className="text-[10px] text-[#c4c4c2]">{sub.definition ?? ""}</span>
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
  const pad8 = (arr: number[] | undefined): number[] => {
    if (!arr || arr.length === 0) return [0, 0, 0, 0, 0, 0, 0, 0]
    if (arr.length >= 8) return arr.slice(0, 8)
    return [...arr, ...Array(8 - arr.length).fill(0)]
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
        ? { ...sub, total: match.count, datapoints: series ? pad8(series) : sub.datapoints }
        : { ...sub, datapoints: series ? pad8(series) : sub.datapoints }
    })
  }

  const sepIndex = rows.findIndex((r) => r.key === "_sep")
  const proRows = (sepIndex >= 0 ? rows.slice(0, sepIndex) : rows).map((r) => {
    if (r.key === "pro_visitors") return {
      ...r,
      total: proVisitors ?? 0,
      datapoints: pad8(proVisitorsSeries),
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
      datapoints: pad8(clientVisitorsSeries),
      subs: overrideSubs(r.subs, clientSources, clientSourceSeries),
    }
    if (r.key === "sharers") return { ...r, total: sharers ?? 0, datapoints: pad8(sharersSeries) }
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
            <th className="px-4 py-2 text-left" style={{ width: "16%" }}><span className="arco-eyebrow text-[#a1a1a0]">Metric</span></th>
            <th className="px-3 py-2 text-left" style={{ width: "24%" }}><span className="arco-eyebrow text-[#a1a1a0]">Definition</span></th>
            <th className="px-4 py-2" style={{ width: "60%" }}>
              <div className="flex justify-between" style={{ paddingLeft: "calc(14%)", paddingRight: "calc(14%)" }}>
                {(labels.length > 0 ? labels : ["—", "—", "—", "—", "—", "—", "—", "—"]).map((l, i, arr) => (
                  <span key={i} className="arco-eyebrow" style={{ color: i === arr.length - 1 ? "#c4c4c2" : "#a1a1a0" }}>{l}</span>
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
