"use client"

import { Fragment, useState } from "react"
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
  const padX = 6
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
      {/* Lines SVG — stretched to fill */}
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
        {points.map((p, i) => (
          <line key={i} x1={p.x} y1={0} x2={p.x} y2={h} stroke="#f0f0ee" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
        ))}
        <polyline points={solidPoints} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        {dottedLine && (
          <line x1={dottedLine.x1} y1={dottedLine.y1} x2={dottedLine.x2} y2={dottedLine.y2}
            stroke={color} strokeWidth="1.5" strokeDasharray="3,3" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
        )}
      </svg>

      {/* Dots + labels — positioned with percentage to match viewBox */}
      {points.map((p, i) => {
        const leftPct = (p.x / w) * 100
        const topPct = (p.y / h) * 100
        return (
          <div key={i} style={{ position: "absolute", left: `${leftPct}%`, top: `${topPct}%` }}>
            {/* Dot — rendered as a separate non-stretched SVG centered on the point */}
            <svg width="7" height="7" viewBox="0 0 7 7" style={{ display: "block", position: "absolute", left: "-3.5px", top: "-3.5px" }}>
              <circle cx="3.5" cy="3.5" r="2.5" fill="white" stroke={color} strokeWidth="1.5" opacity={p.isRolling ? 0.6 : 1} />
            </svg>
            <span
              className="absolute text-[11px] font-medium whitespace-nowrap"
              style={{ bottom: 4, left: "50%", transform: "translate(-50%, -100%)", color: p.isRolling ? "#a1a1a0" : "#1c1c1a" }}
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
  const padX = 6
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
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
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
          <div key={i} style={{ position: "absolute", left: `${leftPct}%`, top: `${topPct}%` }}>
            <svg width="5" height="5" viewBox="0 0 5 5" style={{ display: "block", position: "absolute", left: "-2.5px", top: "-2.5px" }}>
              <circle cx="2.5" cy="2.5" r="1.75" fill="white" stroke="#a1a1a0" strokeWidth="1" opacity={p.isRolling ? 0.5 : 1} />
            </svg>
            <span
              className="absolute text-[10px] font-medium whitespace-nowrap"
              style={{ bottom: 3, left: "50%", transform: "translate(-50%, -100%)", color: p.isRolling ? "#c4c4c2" : "#1c1c1a" }}
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
      {/* Desktop row */}
      <tr
        className={`border-b border-[#f0f0ee] hover:bg-[#fafaf9] transition-colors hidden md:table-row ${hasSubs ? "cursor-pointer" : ""}`}
        onClick={hasSubs ? () => setExpanded(!expanded) : undefined}
      >
        <td className="px-4 py-2">
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
        <td className="px-3 py-2">
          <span className="text-[11px] text-[#a1a1a0]">{row.definition ?? ""}</span>
          {row.source && (
            <span className={`ml-1.5 text-[9px] font-medium px-1.5 py-0.5 rounded ${row.source === "posthog" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"}`}>
              {row.source === "posthog" ? "PostHog" : "Supabase"}
            </span>
          )}
        </td>
        <td className="px-4 py-2">
          <TrendlineCell datapoints={row.datapoints} labels={labels} color={color} />
        </td>
      </tr>
      {/* Mobile row — single cell spanning full width */}
      <tr
        className={`border-b border-[#f0f0ee] md:hidden ${hasSubs ? "cursor-pointer" : ""}`}
        onClick={hasSubs ? () => setExpanded(!expanded) : undefined}
      >
        <td className="px-3 py-2" colSpan={3}>
          <div className="flex items-center gap-1.5 mb-1">
            {hasSubs ? (
              <svg width="8" height="8" viewBox="0 0 10 10" className={`shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}>
                <path d="M3 2L7 5L3 8" stroke="#a1a1a0" strokeWidth="1.2" fill="none" strokeLinecap="round" />
              </svg>
            ) : <div style={{ width: 8 }} />}
            <span className="status-pill-dot shrink-0" style={{ background: color, width: 5, height: 5 }} />
            <span className="text-[11px] font-medium text-[#1c1c1a]">{row.label}</span>
          </div>
          <TrendlineCell datapoints={row.datapoints} labels={labels} color={color} />
        </td>
      </tr>

      {/* Expanded sub-metrics */}
      {expanded && row.subs.map((sub) => (
        <Fragment key={sub.key}>
          {/* Desktop sub-row */}
          <tr className="border-b border-[#f0f0ee] hidden md:table-row">
            <td className="px-4 py-1.5">
              <div className="flex items-center gap-2 pl-7">
                <span className="text-[11px] text-[#1c1c1a]">{sub.label}</span>
              </div>
            </td>
            <td className="px-3 py-1.5">
              <span className="text-[10px] text-[#c4c4c2]">{sub.definition ?? ""}</span>
              {sub.source && (
                <span className={`ml-1 text-[8px] font-medium px-1 py-0.5 rounded ${sub.source === "posthog" ? "bg-blue-50 text-blue-500" : "bg-emerald-50 text-emerald-500"}`}>
                  {sub.source === "posthog" ? "PostHog" : "Supabase"}
                </span>
              )}
            </td>
            <td className="px-4 py-1.5">
              <SubTrendlineCell datapoints={sub.datapoints} />
            </td>
          </tr>
          {/* Mobile sub-row */}
          <tr className="border-b border-[#f0f0ee] md:hidden">
            <td className="px-3 py-1.5" colSpan={3}>
              <div className="flex items-center gap-1.5 mb-0.5 pl-3">
                <span className="text-[10px] text-[#6b6b68]">{sub.label}</span>
              </div>
              <SubTrendlineCell datapoints={sub.datapoints} />
            </td>
          </tr>
        </Fragment>
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
  // Align to 8 buckets where index 7 is the rolling/most-recent period.
  // PostHog returns chronologically ordered data, so we keep the LAST 8 values
  // (or pad zeros to the LEFT for sparse series) — never drop the rolling bucket.
  const pad8 = (arr: number[] | undefined): number[] => {
    if (!arr || arr.length === 0) return [0, 0, 0, 0, 0, 0, 0, 0]
    if (arr.length >= 8) return arr.slice(-8)
    return [...Array(8 - arr.length).fill(0), ...arr]
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
      {/* Date labels — full width on mobile, positioned to match SVG dot coordinates */}
      <div className="bg-[#fafaf9] border-b border-[#e5e5e4] md:hidden py-2 px-3">
        <div className="relative" style={{ height: 16 }}>
          {(labels.length > 0 ? labels : ["—", "—", "—", "—", "—", "—", "—", "—"]).map((l, i, arr) => {
            const n = arr.length
            const leftPct = (6 + (i / (n - 1)) * (100 - 12))
            return (
              <span key={i} className="absolute text-[9px] font-medium uppercase tracking-wider" style={{ left: `${leftPct}%`, transform: "translateX(-50%)", color: i === arr.length - 1 ? "#c4c4c2" : "#a1a1a0" }}>{l}</span>
            )
          })}
        </div>
      </div>
      <table className="w-full md:table-fixed">
        <colgroup className="hidden md:table-column-group">
          <col style={{ width: "16%" }} />
          <col style={{ width: "24%" }} />
          <col />
        </colgroup>
        <thead className="hidden md:table-header-group">
          <tr className="bg-[#fafaf9] border-b border-[#e5e5e4]">
            <th className="px-4 py-2 text-left"><span className="arco-eyebrow text-[#a1a1a0]">Metric</span></th>
            <th className="px-3 py-2 text-left"><span className="arco-eyebrow text-[#a1a1a0]">Definition</span></th>
            <th className="px-4 py-2">
              <div className="relative" style={{ height: 16 }}>
                {(labels.length > 0 ? labels : ["—", "—", "—", "—", "—", "—", "—", "—"]).map((l, i, arr) => {
                  const n = arr.length
                  const leftPct = (6 + (i / (n - 1)) * (100 - 12))
                  return (
                    <span key={i} className="absolute arco-eyebrow" style={{ left: `${leftPct}%`, transform: "translateX(-50%)", color: i === arr.length - 1 ? "#c4c4c2" : "#a1a1a0" }}>{l}</span>
                  )
                })}
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
