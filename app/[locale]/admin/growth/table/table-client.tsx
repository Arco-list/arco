"use client"

import { useState, useTransition } from "react"
import type { GrowthMetrics, Timeframe } from "../actions"
import { fetchMetricTable, type MetricRow } from "./table-actions"

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "days", label: "Days" },
  { value: "weeks", label: "Weeks" },
  { value: "months", label: "Months" },
  { value: "years", label: "Years" },
]

const DRIVER_COLORS: Record<string, string> = {
  acquisition: "#2563eb",
  retention: "#7c3aed",
  monetization: "#0f766e",
  churn: "#dc2626",
}

// ─── Sparkline (inline in table cell) ─────────────────────────────────────────

function InlineSparkline({ datapoints, color }: { datapoints: number[]; color: string }) {
  const max = Math.max(...datapoints, 1)
  const w = 120
  const h = 28
  const pad = 2

  const points = datapoints.map((v, i) => {
    const x = pad + (i / (datapoints.length - 1)) * (w - pad * 2)
    const y = h - pad - (v / max) * (h - pad * 2)
    return { x, y, v }
  })

  const linePoints = points.map((p) => `${p.x},${p.y}`).join(" ")

  return (
    <div style={{ width: w, height: h }} className="relative">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <polyline points={linePoints} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="white" stroke={color} strokeWidth="1" />
        ))}
      </svg>
      {/* Value labels above dots */}
      <div className="absolute inset-0 flex justify-between items-start" style={{ padding: `0 ${pad}px` }}>
        {points.map((p, i) => (
          <span key={i} className="text-[8px] text-[#a1a1a0]" style={{ position: "absolute", left: p.x - 6, top: Math.max(p.y - 14, 0) }}>
            {p.v > 0 ? p.v : ""}
          </span>
        ))}
      </div>
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
        className={hasSubs ? "cursor-pointer" : ""}
        onClick={hasSubs ? () => setExpanded(!expanded) : undefined}
      >
        {/* Metric name */}
        <td>
          <div className="flex items-center gap-2">
            {hasSubs && (
              <svg width="10" height="10" viewBox="0 0 10 10" className={`shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}>
                <path d="M3 2L7 5L3 8" stroke="#a1a1a0" strokeWidth="1.2" fill="none" strokeLinecap="round" />
              </svg>
            )}
            {!hasSubs && <div style={{ width: 10 }} />}
            <span className="status-pill-dot shrink-0" style={{ background: color }} />
            <span className="text-[12px] font-medium text-[#1c1c1a]">{row.label}</span>
          </div>
        </td>

        {/* Definition */}
        <td>
          <span className="text-[11px] text-[#a1a1a0]">{row.definition ?? ""}</span>
        </td>

        {/* Total */}
        <td style={{ textAlign: "right" }}>
          <span className="arco-card-title">{row.total}</span>
        </td>

        {/* 6 data points */}
        {row.datapoints.map((v, i) => (
          <td key={i} style={{ textAlign: "center" }}>
            <span className="text-[11px] text-[#6b6b68]">{v || "·"}</span>
          </td>
        ))}

        {/* Sparkline */}
        <td>
          <InlineSparkline datapoints={row.datapoints} color={color} />
        </td>
      </tr>

      {/* Expanded sub-metrics */}
      {expanded && row.subs.map((sub) => (
        <tr key={sub.key} style={{ background: "var(--arco-white)" }}>
          <td>
            <div className="flex items-center gap-2 pl-7">
              <span className="text-[11px] text-[#6b6b68]">{sub.label}</span>
            </div>
          </td>
          <td />
          <td style={{ textAlign: "right" }}>
            <span className="text-[11px] text-[#6b6b68]">{sub.total}</span>
          </td>
          {sub.datapoints.map((v, i) => (
            <td key={i} style={{ textAlign: "center" }}>
              <span className="text-[10px] text-[#a1a1a0]">{v || "·"}</span>
            </td>
          ))}
          <td>
            <InlineSparkline datapoints={sub.datapoints} color="#a1a1a0" />
          </td>
        </tr>
      ))}
    </>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  initialMetrics: GrowthMetrics
}

export function GrowthTableClient({ initialMetrics }: Props) {
  const [timeframe, setTimeframe] = useState<Timeframe>("months")
  const [rows, setRows] = useState<MetricRow[]>([])
  const [labels, setLabels] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()
  const [loaded, setLoaded] = useState(false)

  // Load table data on mount and timeframe change
  const loadData = (tf: Timeframe) => {
    setTimeframe(tf)
    startTransition(async () => {
      const data = await fetchMetricTable(tf)
      setRows(data.rows)
      setLabels(data.labels)
      setLoaded(true)
    })
  }

  if (!loaded) loadData(timeframe)

  // Split rows by group
  const sepIndex = rows.findIndex((r) => r.key === "_sep")
  const proRows = sepIndex >= 0 ? rows.slice(0, sepIndex) : rows
  const clientRows = sepIndex >= 0 ? rows.slice(sepIndex + 1) : []

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="arco-section-title">Growth — Table View</h3>
          <p className="text-xs text-[#a1a1a0] mt-0.5">
            All lifecycle metrics over time · <a href="/admin/growth" className="text-[#6b6b68] hover:text-[#1c1c1a] underline transition-colors">Lifecycle view</a>
          </p>
        </div>
        <div className="flex items-center gap-1 border border-[#e5e5e4] rounded-[3px] overflow-hidden">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => loadData(tf.value)}
              className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${
                timeframe === tf.value ? "bg-[#1c1c1a] text-white" : "text-[#6b6b68] hover:bg-[#fafaf9]"
              } ${isPending ? "opacity-50" : ""}`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      <div className="arco-table-wrap rounded-[3px]">
        <table className="arco-table" style={{ minWidth: 0 }}>
          <thead>
            <tr>
              <th style={{ width: "16%", textAlign: "left" }}>Metric</th>
              <th style={{ width: "22%", textAlign: "left" }}>Definition</th>
              <th style={{ width: "7%", textAlign: "right" }}>Total</th>
              {labels.map((l, i) => (
                <th key={i} style={{ width: "8%", textAlign: "center" }}>{l}</th>
              ))}
              {/* Fill remaining labels if not loaded yet */}
              {labels.length === 0 && [0, 1, 2, 3, 4, 5].map((i) => (
                <th key={i} style={{ width: "8%", textAlign: "center" }}>—</th>
              ))}
              <th style={{ width: "15%", textAlign: "left" }}>Trend</th>
            </tr>
          </thead>

          <tbody>
            {/* Professional section */}
            <tr>
              <td colSpan={10} style={{ background: "white" }}>
                <p className="arco-eyebrow text-[#a1a1a0]">Professionals</p>
              </td>
            </tr>
            {proRows.map((row) => (
              <MetricRowComponent key={row.key} row={row} labels={labels} />
            ))}

            {/* Client section */}
            <tr>
              <td colSpan={10} style={{ background: "white" }}>
                <p className="arco-eyebrow text-[#a1a1a0]">Clients</p>
              </td>
            </tr>
            {clientRows.map((row) => (
              <MetricRowComponent key={row.key} row={row} labels={labels} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
