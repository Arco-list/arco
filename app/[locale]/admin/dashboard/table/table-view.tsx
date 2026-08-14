"use client"

import { Fragment, useState } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { MetricRow } from "./table-actions"

const DRIVER_COLORS: Record<string, string> = {
  acquisition: "#2563eb",
  retention: "#7c3aed",
  monetization: "#0f766e",
  churn: "#dc2626",
}

// Small ⓘ icon revealing the metric definition on hover. Matches the
// Model page so users see the same affordance across views. Stops click
// propagation so opening the tooltip on an expandable row doesn't also
// toggle its expansion.
function InfoIcon({ definition }: { definition?: string }) {
  if (!definition) return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label="Definition"
          className="inline-flex shrink-0 items-center justify-center text-[#a1a1a0] hover:text-[#1c1c1a] transition-colors"
          style={{ marginLeft: 4, cursor: "help" }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1" fill="none" />
            <circle cx="6" cy="3.6" r="0.6" fill="currentColor" />
            <path d="M6 5.4v3.4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          </svg>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs text-left">
        {definition}
      </TooltipContent>
    </Tooltip>
  )
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
              style={{ bottom: 5, left: "50%", transform: "translateX(-50%)", color: p.isRolling ? "#a1a1a0" : "#1c1c1a" }}
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
              style={{ bottom: 4, left: "50%", transform: "translateX(-50%)", color: p.isRolling ? "#c4c4c2" : "#1c1c1a" }}
            >
              {p.v > 0 ? p.v : ""}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Inline conversion row (mirrors the Model view's "to X" rows) ─────────────

/** Same formatting rules as the Model view: dot when not computable or
 *  zero, one decimal under 10%, whole numbers above. */
function formatConversion(numerator: number, denominator: number): string {
  if (!denominator) return "·"
  const pct = (numerator / denominator) * 100
  if (pct === 0) return "·"
  if (pct < 10) return `${pct.toFixed(1)}%`
  return `${Math.round(pct)}%`
}

/** Per-bucket conversion percentages, x-aligned with the sparkline dots
 *  above (same padX/w math as TrendlineCell). `pull` lifts the row up
 *  into the sparkline's empty bottom padding — larger for the first CR
 *  row directly under a sparkline, small for CR rows that follow
 *  another CR row (which have no slack above them). */
function InlineCRCell({ numerator, denominator, pull = 6 }: { numerator: number[]; denominator: number[]; pull?: number }) {
  const n = denominator.length
  const padX = 6
  const w = 100
  return (
    <div className="relative w-full" style={{ height: 12, marginTop: -pull }}>
      {denominator.map((denom, i) => {
        const x = padX + (i / Math.max(n - 1, 1)) * (w - padX * 2)
        return (
          <span
            key={i}
            className="absolute text-[10px] font-medium whitespace-nowrap"
            style={{ left: `${(x / w) * 100}%`, top: "50%", transform: "translate(-50%, -50%)", color: "var(--primary, #016D75)" }}
          >
            {formatConversion(numerator[i] ?? 0, denom)}
          </span>
        )
      })}
    </div>
  )
}

/** Raw-value row at CR size, x-aligned with the sparkline dots — the
 *  table's counterpart of the Model view's ValueRow (SEO Impressions /
 *  CTR / Clicks under Ranked pros & Ranked projects). */
function ValueCell({ values, tone = "muted", format = "integer", pull = 6 }: {
  values: number[]
  tone?: "muted" | "accent"
  format?: "integer" | "percent"
  pull?: number
}) {
  const color = tone === "accent" ? "var(--primary, #016D75)" : "#6b6b68"
  const n = values.length
  const padX = 6
  const w = 100
  const fmt = (v: number): string => {
    if (v <= 0) return "·"
    if (format === "percent") return `${v}%`
    if (v >= 10000) return `${Math.round(v / 1000)}k`
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
    return String(v)
  }
  return (
    <div className="relative w-full" style={{ height: 12, marginTop: -pull }}>
      {values.map((v, i) => {
        const x = padX + (i / Math.max(n - 1, 1)) * (w - padX * 2)
        return (
          <span
            key={i}
            className="absolute text-[10px] font-medium whitespace-nowrap"
            style={{ left: `${(x / w) * 100}%`, top: "50%", transform: "translate(-50%, -50%)", color }}
          >
            {fmt(v)}
          </span>
        )
      })}
    </div>
  )
}

/** A row can carry an inline funnel CR ("to Signups") rendered directly
 *  beneath it — attached in GrowthTableView, not part of MetricRow.
 *  targetLabel feeds the per-source sub CRs ("to Signups from Direct"). */
type RowWithCR = MetricRow & {
  inlineCR?: { label: string; targetLabel: string; numerator: number[]; denominator: number[] }
}

// ─── Metric Row ───────────────────────────────────────────────────────────────

function MetricRowComponent({ row, labels }: { row: RowWithCR; labels: string[] }) {
  const [expanded, setExpanded] = useState(false)
  const color = DRIVER_COLORS[row.driver] ?? "#6b6b68"
  const hasSubs = row.subs.length > 0

  // Parent-level CR block: the funnel "to X" CR (if any) followed by the
  // row's labelled extraCRs (% Accepted, % Sharers, …) — same order as
  // the Model view. All render always-visible directly under the parent.
  const parentCRs: Array<{ label: string; numerator: number[]; denominator: number[] }> = [
    ...(row.inlineCR
      ? [{ label: row.inlineCR.label, numerator: row.inlineCR.numerator, denominator: row.inlineCR.denominator }]
      : []),
    ...(row.extraCRs ?? []),
  ]
  const hasAttachedCR = parentCRs.length > 0

  return (
    <>
      {/* Desktop row */}
      <tr
        className={`hidden md:table-row ${hasSubs ? "cursor-pointer" : ""} ${hasAttachedCR ? "arco-cr-attached" : ""}`}
        style={hasAttachedCR ? { borderBottom: "none" } : undefined}
        onClick={hasSubs ? () => setExpanded(!expanded) : undefined}
      >
        <td>
          <div className="flex items-center gap-2">
            {hasSubs ? (
              <svg width="10" height="10" viewBox="0 0 10 10" className={`shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}>
                <path d="M3 2L7 5L3 8" stroke="#a1a1a0" strokeWidth="1.2" fill="none" strokeLinecap="round" />
              </svg>
            ) : <div style={{ width: 10 }} />}
            <span className="status-pill-dot shrink-0" style={{ background: color }} />
            <span className="text-[12px] font-medium text-[#1c1c1a]">{row.label}</span>
            <InfoIcon definition={row.definition} />
          </div>
        </td>
        <td>
          <TrendlineCell datapoints={row.datapoints} labels={labels} color={color} />
        </td>
      </tr>
      {/* Mobile row — single cell spanning full width */}
      <tr
        className={`md:hidden ${hasSubs ? "cursor-pointer" : ""} ${hasAttachedCR ? "arco-cr-attached" : ""}`}
        style={hasAttachedCR ? { borderBottom: "none" } : undefined}
        onClick={hasSubs ? () => setExpanded(!expanded) : undefined}
      >
        <td colSpan={2}>
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

      {/* Parent-level CR block — the funnel "to X" CR plus any labelled
          extraCRs (% Accepted, % Sharers, …), always visible directly
          under the parent, like the Model view. Middle rows suppress
          their bottom border so the block reads as one section; the
          last row keeps it as the separator to the next metric. */}
      {parentCRs.map((cr, idx) => {
        const isLast = idx === parentCRs.length - 1
        // First CR row sits directly under the sparkline, which carries
        // ~19px of empty bottom padding — pull it up into that slack.
        // Subsequent CR rows follow another CR row and have none.
        const pull = idx === 0 ? 16 : 6
        return (
          <Fragment key={cr.label}>
            <tr className="hidden md:table-row arco-cr-row" style={isLast ? undefined : { borderBottom: "none" }}>
              <td>
                <div className="flex items-center" style={{ paddingLeft: 31, marginTop: -pull }}>
                  <span className="text-[10px] font-medium" style={{ color: "var(--primary, #016D75)" }}>
                    {cr.label}
                  </span>
                </div>
              </td>
              <td>
                <InlineCRCell numerator={cr.numerator} denominator={cr.denominator} pull={pull} />
              </td>
            </tr>
            <tr className="md:hidden arco-cr-row" style={isLast ? undefined : { borderBottom: "none" }}>
              <td colSpan={2}>
                <div className="flex items-center pl-3 mb-0.5">
                  <span className="text-[10px] font-medium" style={{ color: "var(--primary, #016D75)" }}>
                    {cr.label}
                  </span>
                </div>
                <InlineCRCell numerator={cr.numerator} denominator={cr.denominator} />
              </td>
            </tr>
          </Fragment>
        )
      })}

      {/* Expanded sub-metrics — subs with a crNumerator get their own
          attached per-source CR row ("to Signups from Direct"), same as
          the Model view's PerSourceCRRow. */}
      {expanded && row.subs.map((sub) => {
        // A sub can attach up to three kinds of CR-size rows, in Model
        // order: the per-source funnel CR ("to New Pros from Sales"),
        // its self-declared customCR ("% Unique", "% Retained", …), and
        // raw valueRows (SEO Impressions / CTR / Clicks).
        const subCRs: Array<{ label: string; numerator: number[]; denominator: number[] }> = []
        if (sub.crNumerator && row.inlineCR) {
          subCRs.push({ label: `to ${row.inlineCR.targetLabel} from ${sub.label}`, numerator: sub.crNumerator.datapoints, denominator: sub.datapoints })
        }
        if (sub.customCR) {
          subCRs.push({ label: sub.customCR.label, numerator: sub.customCR.numerator, denominator: sub.customCR.denominator })
        }
        const valueRows = sub.valueRows ?? []
        const attachedCount = subCRs.length + valueRows.length
        const hasAttached = attachedCount > 0
        return (
        <Fragment key={sub.key}>
          {/* Desktop sub-row */}
          <tr className={`hidden md:table-row ${hasAttached ? "arco-cr-attached" : ""}`} style={hasAttached ? { borderBottom: "none" } : undefined}>
            <td>
              <div className="flex items-center gap-2 pl-7">
                <span className="text-[11px] text-[#1c1c1a]">{sub.label}</span>
                <InfoIcon definition={sub.definition} />
              </div>
            </td>
            <td>
              <SubTrendlineCell datapoints={sub.datapoints} />
            </td>
          </tr>
          {/* Mobile sub-row */}
          <tr className={`md:hidden ${hasAttached ? "arco-cr-attached" : ""}`} style={hasAttached ? { borderBottom: "none" } : undefined}>
            <td colSpan={2}>
              <div className="flex items-center gap-1.5 mb-0.5 pl-3">
                <span className="text-[10px] text-[#6b6b68]">{sub.label}</span>
              </div>
              <SubTrendlineCell datapoints={sub.datapoints} />
            </td>
          </tr>
          {subCRs.map((cr, idx) => {
            const isLast = idx === attachedCount - 1
            // Sub sparklines carry ~10px of bottom slack — smaller pull
            // than the parent rows, and only for the first attached row.
            const pull = idx === 0 ? 10 : 6
            return (
              <Fragment key={cr.label}>
                <tr className="hidden md:table-row arco-cr-row" style={isLast ? undefined : { borderBottom: "none" }}>
                  <td>
                    <div className="flex items-center pl-7" style={{ marginTop: -pull }}>
                      <span className="text-[10px] font-medium" style={{ color: "var(--primary, #016D75)" }}>
                        {cr.label}
                      </span>
                    </div>
                  </td>
                  <td>
                    <InlineCRCell numerator={cr.numerator} denominator={cr.denominator} pull={pull} />
                  </td>
                </tr>
                <tr className="md:hidden arco-cr-row" style={isLast ? undefined : { borderBottom: "none" }}>
                  <td colSpan={2}>
                    <div className="flex items-center pl-5 mb-0.5">
                      <span className="text-[10px] font-medium" style={{ color: "var(--primary, #016D75)" }}>
                        {cr.label}
                      </span>
                    </div>
                    <InlineCRCell numerator={cr.numerator} denominator={cr.denominator} />
                  </td>
                </tr>
              </Fragment>
            )
          })}
          {valueRows.map((vr, idx) => {
            const isLast = subCRs.length + idx === attachedCount - 1
            // Only pull up when this is the first attached row under the
            // sub's sparkline; rows following another CR row have no slack.
            const pull = subCRs.length === 0 && idx === 0 ? 10 : 6
            const color = vr.tone === "accent" ? "var(--primary, #016D75)" : "#6b6b68"
            return (
              <Fragment key={vr.label}>
                <tr className="hidden md:table-row arco-cr-row" style={isLast ? undefined : { borderBottom: "none" }}>
                  <td>
                    <div className="flex items-center pl-7" style={{ marginTop: -pull }}>
                      <span className="text-[10px] font-medium" style={{ color }}>
                        {vr.label}
                      </span>
                    </div>
                  </td>
                  <td>
                    <ValueCell values={vr.values} tone={vr.tone} format={vr.format} pull={pull} />
                  </td>
                </tr>
                <tr className="md:hidden arco-cr-row" style={isLast ? undefined : { borderBottom: "none" }}>
                  <td colSpan={2}>
                    <div className="flex items-center pl-5 mb-0.5">
                      <span className="text-[10px] font-medium" style={{ color }}>
                        {vr.label}
                      </span>
                    </div>
                    <ValueCell values={vr.values} tone={vr.tone} format={vr.format} />
                  </td>
                </tr>
              </Fragment>
            )
          })}
        </Fragment>
        )
      })}
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
  projectShares?: number
  professionalShares?: number
  sharesPerClient?: number
  projectSharesSeries?: number[]
  professionalSharesSeries?: number[]
  sharesPerClientSeries?: number[]
  clientSources?: Array<{ label: string; pct: number; count: number }>
  proSources?: Array<{ label: string; pct: number; count: number }>
  apolloVisitorsSeries?: number[]
  inviteVisitorsSeries?: number[]
  clientSourceSeries?: Record<string, number[]>
  proSourceSeries?: Record<string, number[]>
}

export function GrowthTableView({
  rows, labels, isPending,
  proVisitors, clientVisitors, proVisitorsSeries, clientVisitorsSeries,
  clientActives, clientActivesSeries,
  sharers, sharersSeries,
  projectShares, professionalShares, sharesPerClient,
  projectSharesSeries, professionalSharesSeries, sharesPerClientSeries,
  clientSources, proSources,
  apolloVisitorsSeries, inviteVisitorsSeries,
  clientSourceSeries, proSourceSeries,
}: Props) {
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
    if (r.key === "pros_contacted") {
      // "to Pro visitors" — table-actions ships the cohort-honest
      // numerator (Sales + Invites visitors, email-keyed) via
      // inlineCRNumerator; the Model view renders it and now the table
      // does too. Also unlocks the per-source sub CRs (Sales / Invites
      // / Outbound each carry a crNumerator).
      const target = rows.find((x) => x.key === "pro_visitors")
      return {
        ...r,
        inlineCR: r.inlineCRNumerator && target
          ? { label: `to ${target.label}`, targetLabel: target.label, numerator: r.inlineCRNumerator.datapoints, denominator: r.datapoints }
          : undefined,
      }
    }
    if (r.key === "pro_visitors") {
      // Same inline CR treatment as client Visitors: "to New Pros"
      // under the parent, per-source CRs under each expanded sub.
      const displayed = pad8(proVisitorsSeries)
      const newProsRow = rows.find((x) => x.key === "new_pros")
      return {
        ...r,
        total: proVisitors ?? 0,
        datapoints: displayed,
        // Subs intentionally NOT overridden: table-actions' series are
        // canonical (server-side Sales/Invites click logs + entry-
        // classified channel caches + the Other remainder). The old
        // override swapped Invites for the legacy invite_visitors cache
        // and carried a dead 'sales_apollo' key, so displayed subs
        // diverged from the Model view's.
        inlineCR: newProsRow
          ? { label: `to ${newProsRow.label}`, targetLabel: newProsRow.label, numerator: newProsRow.datapoints, denominator: displayed }
          : undefined,
      }
    }
    return r
  })
  const clientRows = (sepIndex >= 0 ? rows.slice(sepIndex + 1) : []).map((r) => {
    if (r.key === "client_visitors") {
      // Inline funnel CR under Visitors ("to Signups"), like the Model
      // view. Denominator = the SAME series the row displays (the
      // PostHog override), so the percentages match the numbers above.
      const displayed = pad8(clientVisitorsSeries)
      const signupsRow = rows.find((x) => x.key === "client_signups")
      return {
        ...r,
        total: clientVisitors ?? 0,
        datapoints: displayed,
        subs: overrideSubs(r.subs, clientSources, clientSourceSeries),
        inlineCR: signupsRow
          ? { label: `to ${signupsRow.label}`, targetLabel: signupsRow.label, numerator: signupsRow.datapoints, denominator: displayed }
          : undefined,
      }
    }
    if (r.key === "sharers") {
      const sharesSubSeriesByKey: Record<string, number[]> = {
        shares_per_client: pad8(sharesPerClientSeries),
        projects_shared: pad8(projectSharesSeries),
        professionals_shared: pad8(professionalSharesSeries),
      }
      const sharesSubTotalByKey: Record<string, number> = {
        shares_per_client: sharesPerClient ?? 0,
        projects_shared: projectShares ?? 0,
        professionals_shared: professionalShares ?? 0,
      }
      return {
        ...r,
        total: sharers ?? 0,
        datapoints: pad8(sharersSeries),
        subs: r.subs.map((sub) => {
          const series = sharesSubSeriesByKey[sub.key]
          const total = sharesSubTotalByKey[sub.key]
          return series
            ? { ...sub, total: total ?? sub.total, datapoints: series }
            : sub
        }),
      }
    }
    return r
  })

  if (rows.length === 0) {
    return <p className="text-[12px] text-[#a1a1a0] py-8 text-center">{isPending ? "Loading..." : "Loading table data..."}</p>
  }

  return (
    <div className="arco-table-wrap rounded-[3px]">
      {/* Date labels — full width on mobile, positioned to match SVG dot coordinates */}
      <div className="bg-[#fafaf9] border-b border-[#e5e5e4] md:hidden py-2 px-3">
        <div className="relative" style={{ height: 16 }}>
          {(labels.length > 0 ? labels : ["—", "—", "—", "—", "—", "—", "—", "—"]).map((l, i, arr) => {
            const n = arr.length
            const leftPct = (6 + (i / (n - 1)) * (100 - 12))
            return (
              <span key={i} className="absolute text-[9px] font-medium uppercase tracking-wider whitespace-nowrap" style={{ left: `${leftPct}%`, transform: "translateX(-50%)", color: i === arr.length - 1 ? "#c4c4c2" : "#a1a1a0" }}>{l}</span>
            )
          })}
        </div>
      </div>
      <table className="arco-table md:table-fixed" style={{ minWidth: 0 }}>
        <colgroup className="hidden md:table-column-group">
          <col style={{ width: "30%" }} />
          <col />
        </colgroup>
        <thead className="hidden md:table-header-group">
          <tr>
            <th style={{ textAlign: "left" }}><span className="arco-eyebrow text-[#a1a1a0]">Metric</span></th>
            <th>
              <div className="relative" style={{ height: 16 }}>
                {(labels.length > 0 ? labels : ["—", "—", "—", "—", "—", "—", "—", "—"]).map((l, i, arr) => {
                  const n = arr.length
                  const leftPct = (6 + (i / (n - 1)) * (100 - 12))
                  return (
                    <span key={i} className="absolute arco-eyebrow whitespace-nowrap" style={{ left: `${leftPct}%`, transform: "translateX(-50%)", color: i === arr.length - 1 ? "#c4c4c2" : "#a1a1a0" }}>{l}</span>
                  )
                })}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Clients */}
          <tr>
            <td colSpan={2} style={{ background: "white" }}>
              <p className="arco-eyebrow text-[#a1a1a0]">Clients</p>
            </td>
          </tr>
          {clientRows.map((row) => <MetricRowComponent key={row.key} row={row} labels={labels} />)}

          {/* Professionals */}
          <tr>
            <td colSpan={2} style={{ background: "white" }}>
              <p className="arco-eyebrow text-[#a1a1a0]">Professionals</p>
            </td>
          </tr>
          {proRows.map((row) => <MetricRowComponent key={row.key} row={row} labels={labels} />)}
        </tbody>
      </table>
    </div>
  )
}
