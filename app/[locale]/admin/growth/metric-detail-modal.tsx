"use client"

import { useState, useEffect, useTransition } from "react"
import { METRIC_DEFS, type MetricDef } from "./metric-definitions"
import { fetchMetricTimeSeries, type TimeSeriesPoint } from "./metric-detail-actions"

type Timeframe = "days" | "weeks" | "months" | "years"

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

// ─── Trendline (same style as table view) ─────────────────────────────────────

function Trendline({ data, color, height = 56, showLabels = true }: {
  data: TimeSeriesPoint[]; color: string; height?: number; showLabels?: boolean
}) {
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return <div className="flex items-center" style={{ height }}><span className="text-[10px] text-[#c4c4c2] italic">No data yet</span></div>
  }

  const max = Math.max(...data.map((d) => d.value), 1)
  const n = data.length
  const padX = 12
  const padY = 14
  const w = 100
  const h = 50

  const points = data.map((v, i) => ({
    x: padX + (i / Math.max(n - 1, 1)) * (w - padX * 2),
    y: h - padY - (v.value / max) * (h - padY * 2),
    v: v.value,
  }))

  const linePoints = points.map((p) => `${p.x},${p.y}`).join(" ")

  // Map points to percentage positions within padded area
  const pctPoints = points.map((p) => ({
    left: ((p.x - padX) / (w - padX * 2)) * 100,
    top: (p.y / h) * 100,
    v: p.v,
  }))

  const svgLinePoints = points.map((p) => {
    const x = padX + ((p.x - padX) / (w - padX * 2)) * (w - padX * 2)
    return `${x},${p.y}`
  }).join(" ")

  return (
    <div className="relative w-full" style={{ height, paddingLeft: 20, paddingRight: 20 }}>
      <div className="relative w-full h-full">
        <svg width="100%" height="100%" viewBox={`${padX} 0 ${w - padX * 2} ${h}`} preserveAspectRatio="none">
          <polyline points={linePoints} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {/* Dots + labels */}
        {pctPoints.map((p, i) => (
          <div key={i} className="absolute" style={{ left: `${p.left}%`, top: `${p.top}%`, transform: "translate(-50%, -50%)" }}>
            <div className="w-[7px] h-[7px] rounded-full border-[1.5px] bg-white" style={{ borderColor: color }} />
            {showLabels && (
              <span className="absolute text-[11px] font-medium text-[#1c1c1a] whitespace-nowrap" style={{ bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 4 }}>
                {p.v > 0 ? p.v : ""}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Time labels row ──────────────────────────────────────────────────────────

function TimeLabels({ data }: { data: TimeSeriesPoint[] }) {
  if (data.length === 0) return null
  const n = data.length

  return (
    <div className="relative w-full" style={{ height: 18, paddingLeft: 20, paddingRight: 20 }}>
      <div className="relative w-full h-full">
        {data.map((d, i) => {
          const leftPct = (i / Math.max(n - 1, 1)) * 100
          return (
            <span key={i} className="absolute whitespace-nowrap" style={{ left: `${leftPct}%`, transform: "translateX(-50%)", color: "#a1a1a0", fontSize: 9, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {d.date}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ─── Metric section ───────────────────────────────────────────────────────────

function MetricSection({ title, definition, value, data, color, isMain }: {
  title: string; definition: string; value: number | string; data: TimeSeriesPoint[]; color: string; isMain?: boolean
}) {
  return (
    <div className={isMain ? "mb-6" : "mb-4"}>
      <div className="flex items-baseline justify-between mb-0.5">
        <span className={isMain ? "text-[12px] font-medium text-[#1c1c1a]" : "text-[11px] font-medium text-[#1c1c1a]"}>{title}</span>
        <span className={isMain ? "arco-card-title" : "text-[13px] font-normal text-[#1c1c1a]"}>{value}</span>
      </div>
      <p className="text-[10px] text-[#a1a1a0] mb-2">{definition}</p>
      <Trendline data={data} color={isMain ? color : "#a1a1a0"} height={isMain ? 72 : 48} showLabels />
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

type ConversionRate = { label: string; value: string }
type SourceData = { label: string; pct: number; count: number }

interface MetricDetailModalProps {
  metricKey: string | null
  currentValue: number | string | null
  conversions?: ConversionRate[]
  sources?: SourceData[]
  sourceSeries?: Record<string, number[]>
  mainSeries?: number[]
  timeframe: Timeframe
  onTimeframeChange: (tf: Timeframe) => void
  onClose: () => void
}

export function MetricDetailModal({ metricKey, currentValue, conversions, sources, sourceSeries, mainSeries, timeframe: tf, onTimeframeChange: setTf, onClose }: MetricDetailModalProps) {
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([])
  const [total, setTotal] = useState<number>(0)
  const [isPending, startTransition] = useTransition()

  const def = metricKey ? METRIC_DEFS[metricKey] : null

  useEffect(() => {
    if (!metricKey || !def) return
    startTransition(async () => {
      const data = await fetchMetricTimeSeries(metricKey, tf)
      setTimeSeries(data.timeSeries)
      setTotal(data.total)
    })
  }, [metricKey, tf])

  if (!metricKey || !def) return null

  const color = DRIVER_COLORS[def.driver] ?? "#6b6b68"
  const mainValue = def.source === "supabase" ? total : (currentValue ?? "—")

  // For PostHog metrics, use the pre-fetched mainSeries if server action returned nothing
  const effectiveTimeSeries = timeSeries.length > 0 ? timeSeries
    : (mainSeries && mainSeries.length > 0
      ? mainSeries.map((v, i) => ({ date: `W${i + 1}`, value: v }))
      : [])

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/30 p-6" onClick={onClose}>
      <div className="bg-white rounded-[3px] shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e5e5e4] shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="status-pill-dot" style={{ background: color }} />
              <span className="arco-label">{def.title}</span>
            </div>
            <button onClick={onClose} className="text-[#a1a1a0] hover:text-[#1c1c1a] transition-colors text-lg">✕</button>
          </div>
          {/* Timeframe selector */}
          <div className="flex items-center gap-1 mt-3 border border-[#e5e5e4] rounded-[3px] overflow-hidden w-fit">
            {TIMEFRAMES.map((t) => (
              <button
                key={t.value}
                onClick={() => setTf(t.value)}
                className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                  tf === t.value ? "bg-[#1c1c1a] text-white" : "text-[#6b6b68] hover:bg-[#fafaf9]"
                } ${isPending ? "opacity-50" : ""}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1 overflow-x-hidden">

          {/* Time labels (shared across all charts) */}
          <TimeLabels data={effectiveTimeSeries} />

          {/* Main metric */}
          <MetricSection
            title={def.title}
            definition={def.definition}
            value={mainValue}
            data={effectiveTimeSeries}
            color={color}
            isMain
          />

          {/* Conversion rates (as chart sections) */}
          {conversions && conversions.length > 0 && (
            <>
              <p className="arco-eyebrow text-[#a1a1a0] mb-3">Conversions</p>
              {conversions.map((c, i) => (
                <MetricSection
                  key={i}
                  title={c.label}
                  definition="Cohorted conversion rate"
                  value={c.value}
                  data={[]}
                  color="#a1a1a0"
                />
              ))}
            </>
          )}

          {/* Supporting metrics */}
          {(metricKey === "client_visitors" || metricKey === "pro_visitors") ? (
            <>
              <p className="arco-eyebrow text-[#a1a1a0] mb-3">Traffic sources</p>
              {(() => {
                // The "google" key remains for historical reasons (PostHog
                // route, table mapping, definition list) — but the user-facing
                // label is "Organic search" since the matched values now
                // cover all major search engines, not just Google.
                const sourceKeyMap: Record<string, string> = {
                  "Direct": "direct", "Organic search": "google", "Social": "social",
                  "Email": "email", "Referral": "referral",
                  "Sales (Apollo)": "sales_apollo", "Invites": "invites",
                }
                // Use sources if available, otherwise fall back to def.subs
                const items = sources && sources.length > 0
                  ? sources.map((s) => ({ label: s.label, definition: `${s.count} visitors`, value: `${s.pct}%`, key: sourceKeyMap[s.label] }))
                  : def.subs.map((sub) => ({ label: sub.label, definition: sub.definition, value: "—", key: sourceKeyMap[sub.label] ?? sub.key }))

                return items.map((item) => {
                  const rawSeries = item.key && sourceSeries ? sourceSeries[item.key] ?? [] : []
                  const seriesData: TimeSeriesPoint[] = rawSeries.map((v, i) => ({
                    date: effectiveTimeSeries[i]?.date ?? `W${i + 1}`,
                    value: v,
                  }))
                  return (
                    <MetricSection
                      key={item.label}
                      title={item.label}
                      definition={item.definition}
                      value={item.value}
                      data={seriesData}
                      color="#a1a1a0"
                    />
                  )
                })
              })()}
            </>
          ) : def.subs.length > 0 ? (
            <>
              <p className="arco-eyebrow text-[#a1a1a0] mb-3">Supporting metrics</p>
              {def.subs.map((sub) => (
                <MetricSection
                  key={sub.key}
                  title={sub.label}
                  definition={sub.definition}
                  value="—"
                  data={effectiveTimeSeries}
                  color="#a1a1a0"
                />
              ))}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
