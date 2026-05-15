"use client"

import { Fragment, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { MetricRow } from "../dashboard/table/table-actions"
import { syncGrowthMetricsAction } from "./actions"
import { backfillFirstTouchSource } from "./backfill-first-touch"

// Lifecycle phase → dot color. Matches the Table view so the same
// visual key applies across both pages.
const DRIVER_COLORS: Record<string, string> = {
  acquisition: "#2563eb",
  retention: "#7c3aed",
  monetization: "#0f766e",
  churn: "#dc2626",
}

const DRIVER_LABEL: Record<string, string> = {
  acquisition: "Acquisition",
  retention: "Retention",
  monetization: "Monetization",
  churn: "Churn",
}

function formatNumber(n: number): string {
  if (!n) return "·"
  return n.toLocaleString("en-US")
}

// Small ⓘ icon that reveals the metric's definition on hover. Stops
// click propagation so opening the tooltip on an expandable metric row
// doesn't also collapse / expand it.
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

// Month-over-month delta vs the prior bucket. Returns null when the
// prior bucket has no signal (zero baseline → division undefined) or
// when both are zero. Sub-10% deltas show one decimal so small but
// non-trivial moves remain readable; ≥10% rounds to whole numbers.
function formatGrowth(current: number, prev: number): { label: string; color: string } | null {
  if (!prev) return null
  const pct = ((current - prev) / prev) * 100
  if (!Number.isFinite(pct)) return null
  const sign = pct >= 0 ? "+" : ""
  const magnitude = Math.abs(pct)
  const rounded = magnitude < 10 ? pct.toFixed(1) : Math.round(pct).toString()
  return {
    label: `${sign}${rounded}%`,
    color: pct >= 0 ? "#059669" : "#dc2626",
  }
}

// Right-side gutter reserved for the growth indicator inside every
// numeric / CR cell. The number anchors to its left edge; growth
// (when present) renders inside the gutter left-aligned. CR rows
// reserve the same gutter so values stay column-aligned. Headers
// add the same width as padding-right so the period label's right
// edge lines up with the number's right edge, not with the growth.
const GROWTH_GUTTER_PX = 40

function GrowthGutter({ growth }: { growth: { label: string; color: string } | null }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: GROWTH_GUTTER_PX,
        marginLeft: 6,
        textAlign: "left",
        whiteSpace: "nowrap",
      }}
    >
      {growth && (
        <span className="text-[9px] font-medium" style={{ color: growth.color }}>
          {growth.label}
        </span>
      )}
    </span>
  )
}

// Number cell + inline MoM growth indicator. Used for both metric
// and sub-row data cells so the comparison signal applies uniformly.
// CR rows skip the indicator (growth-of-a-percentage is confusing)
// but reserve the same gutter so values stay column-aligned.
function NumberCellWithGrowth({
  value,
  prev,
  textClassName,
}: {
  value: number
  prev: number | null
  textClassName: string
}) {
  const growth = prev !== null ? formatGrowth(value, prev) : null
  return (
    <td className="arco-table-nowrap" style={{ textAlign: "right" }}>
      <span className={textClassName}>{formatNumber(value)}</span>
      <GrowthGutter growth={growth} />
    </td>
  )
}

// Per-month conversion rate: numerator / denominator. Returns "·" when
// the denominator is zero (no signal) or when numerator is also zero.
// Sub-10% values get one decimal; everything else rounds to whole %
// — matches how planning models display micro vs macro CRs without
// drowning in decimals.
function formatConversion(numerator: number, denominator: number): string {
  if (!denominator) return "·"
  const pct = (numerator / denominator) * 100
  if (pct === 0) return "·"
  if (pct < 10) return `${pct.toFixed(1)}%`
  return `${Math.round(pct)}%`
}

// Slim "to {next metric} — X%" row. Two placements:
//   - "chain" mode: rendered between two adjacent absolute-metric rows
//     in a user-type funnel chain. The standard layout for most rows.
//   - "inline" mode: rendered inside another metric's expanded view as
//     the first sub-row (currently Visitors → Signups). Same data, just
//     visually grouped with the parent metric.
//
// Both modes use the same row treatment so CR rows always look the
// same regardless of where they sit in the table: muted accent on the
// metric-cell side, italicised percentages, smaller type, indented one
// level past the chevron column.
function ConversionRowComponent({
  from,
  to,
  columnCount,
  placement = "chain",
  fromValues,
  toValues,
  label,
  isLast,
}: {
  from: MetricRow
  to: MetricRow
  columnCount: number
  placement?: "chain" | "inline"
  /** Optional override for the denominator side. When omitted we use
   *  from.datapoints — i.e. the conversion from `from` to `to`. */
  fromValues?: number[]
  /** Optional override for the numerator side. When omitted we use
   *  to.datapoints. Used when only part of `to` counts toward the
   *  ratio — e.g. pros_contacted → pro_visitors should credit only
   *  Sales + Invites visitors, not the full pro_visitors total. */
  toValues?: number[]
  /** Optional label override (e.g. "Direct → Signups"). Defaults to
   *  "to {to.label}". */
  label?: string
  isLast?: boolean
}) {
  const fromArr = fromValues ?? from.datapoints
  const toArr = toValues ?? to.datapoints
  // No background — the CR row sits visually attached to the metric
  // above it. We also remove the top border so there's no horizontal
  // divider between the absolute row and the CR row directly below.
  // The teal accent on the text is the only visual cue that says
  // "this is a derived ratio, not a count."
  return (
    <tr
      className="arco-cr-row"
      style={{ borderTop: "none", borderBottom: isLast ? undefined : "none" }}
    >
      <td>
        <div className="flex items-center gap-2 pl-7">
          <span className="text-[10px] font-medium" style={{ color: "var(--primary, #016D75)" }}>
            {label ?? `to ${to.label}`}
          </span>
        </div>
      </td>
      {fromArr.map((fromVal, i) => {
        const toVal = toArr[i] ?? 0
        return (
          <td key={i} className="arco-table-nowrap" style={{ textAlign: "right" }}>
            <span className="text-[10px] font-medium" style={{ color: "var(--primary, #016D75)" }}>
              {formatConversion(toVal, fromVal)}
            </span>
            <GrowthGutter growth={null} />
          </td>
        )
      })}
      {fromArr.length < columnCount
        && Array.from({ length: columnCount - fromArr.length }).map((_, i) => (
          <td key={`pad-${i}`} />
        ))}
    </tr>
  )
}

// Self-contained CR row rendered under a sub-row. Same visual treatment
// as PerSourceCRRow but the label, numerator and denominator are fully
// declared by the sub (via sub.customCR). Used for accounting ratios
// under MAU (% Retained / % Re-activated / % Churn) where the
// denominator isn't `datapoints` and the row isn't a funnel conversion.
function CustomCRRow({
  label,
  numerator,
  denominator,
  columnCount,
  isLast,
}: {
  label: string
  numerator: number[]
  denominator: number[]
  columnCount: number
  /** Restores the default 1px bottom border when this is the closing
   *  row of the parent's expansion — keeps the absolute row that
   *  follows visually separated. Suppressed otherwise so consecutive
   *  CR rows read as one section. */
  isLast?: boolean
}) {
  return (
    <tr
      className="arco-cr-row"
      style={{ borderTop: "none", borderBottom: isLast ? undefined : "none" }}
    >
      <td>
        <div className="flex items-center gap-2 pl-7">
          <span className="text-[10px] font-medium" style={{ color: "var(--primary, #016D75)" }}>
            {label}
          </span>
        </div>
      </td>
      {denominator.map((denom, i) => {
        const num = numerator[i] ?? 0
        return (
          <td key={i} className="arco-table-nowrap" style={{ textAlign: "right" }}>
            <span className="text-[10px] font-medium" style={{ color: "var(--primary, #016D75)" }}>
              {formatConversion(num, denom)}
            </span>
            <GrowthGutter growth={null} />
          </td>
        )
      })}
      {denominator.length < columnCount
        && Array.from({ length: columnCount - denominator.length }).map((_, i) => (
          <td key={`pad-${i}`} />
        ))}
    </tr>
  )
}

// Absolute-value row rendered at CR-row size (10px) underneath a sub.
// Same layout as CustomCRRow but shows raw values formatted via
// formatNumber (or a "N%" string when format = "percent"). `tone`
// controls the text color — "accent" reads as the teal primary,
// "muted" as the secondary grey. Used today by Ranked pros to surface
// SEO Impressions / CTR / Clicks alongside the conversion rate above.
function ValueRow({
  label,
  values,
  columnCount,
  tone = "muted",
  format = "integer",
  isLast,
}: {
  label: string
  values: number[]
  columnCount: number
  tone?: "muted" | "accent"
  format?: "integer" | "percent"
  isLast?: boolean
}) {
  const color = tone === "accent" ? "var(--primary, #016D75)" : "#6b6b68"
  return (
    <tr
      className="arco-cr-row"
      style={{ borderTop: "none", borderBottom: isLast ? undefined : "none" }}
    >
      <td>
        <div className="flex items-center gap-2 pl-7">
          <span className="text-[10px] font-medium" style={{ color }}>
            {label}
          </span>
        </div>
      </td>
      {values.map((v, i) => {
        const display = format === "percent"
          ? (v > 0 ? `${v}%` : "·")
          : formatNumber(v)
        return (
          <td key={i} className="arco-table-nowrap" style={{ textAlign: "right" }}>
            <span className="text-[10px] font-medium" style={{ color }}>
              {display}
            </span>
            <GrowthGutter growth={null} />
          </td>
        )
      })}
      {values.length < columnCount
        && Array.from({ length: columnCount - values.length }).map((_, i) => (
          <td key={`pad-${i}`} />
        ))}
    </tr>
  )
}

// Slim per-source CR row rendered under a source sub-row inside an
// expanded metric. Mirrors ConversionRowComponent's inline styling
// (subtle left-border + italic muted text) but takes raw numerator/
// denominator arrays directly so the source-attributed signups
// (sub.crNumerator) can be wired in without constructing a fake
// MetricRow.
function PerSourceCRRow({
  sourceLabel,
  toLabel,
  numerator,
  denominator,
  columnCount,
  isLast,
}: {
  sourceLabel: string
  toLabel: string
  numerator: number[]
  denominator: number[]
  columnCount: number
  isLast?: boolean
}) {
  return (
    <tr
      className="arco-cr-row"
      style={{ borderTop: "none", borderBottom: isLast ? undefined : "none" }}
    >
      <td>
        <div className="flex items-center gap-2 pl-7">
          <span className="text-[10px] font-medium" style={{ color: "var(--primary, #016D75)" }}>
            to {toLabel} from {sourceLabel}
          </span>
        </div>
      </td>
      {denominator.map((denom, i) => {
        const num = numerator[i] ?? 0
        return (
          <td key={i} className="arco-table-nowrap" style={{ textAlign: "right" }}>
            <span className="text-[10px] font-medium" style={{ color: "var(--primary, #016D75)" }}>
              {formatConversion(num, denom)}
            </span>
            <GrowthGutter growth={null} />
          </td>
        )
      })}
      {denominator.length < columnCount
        && Array.from({ length: columnCount - denominator.length }).map((_, i) => (
          <td key={`pad-${i}`} />
        ))}
    </tr>
  )
}

// One metric row + its driver-breakdown expansion. The Quizlet model
// uses Summary as the headline view with each metric expanding into
// its acquisition/retention/monetization detail; same idea here, just
// flatter — there's no separate detail tab, just an inline accordion.
//
// `inlineCRTo`: when present, the conversion-rate row to that target
// renders INSIDE this row's expansion (as the first sub-row) instead
// of as a chain CR between absolute rows. Per-source CR rows under
// each driver sub then use the same target. Used for Visitors today;
// other sections can opt in row-by-row.
function MetricRowComponent({
  row,
  columnCount,
  inlineCRTo,
}: {
  row: MetricRow
  columnCount: number
  inlineCRTo?: MetricRow
}) {
  const [expanded, setExpanded] = useState(false)
  const color = DRIVER_COLORS[row.driver] ?? "#6b6b68"
  const driverLabel = DRIVER_LABEL[row.driver] ?? row.driver
  // Inline-CR mode forces an expand chevron even when there are no
  // sub rows, since the CR row is now nested inside the expansion.
  // Same applies for extraCRs (parent→other-metric ratios).
  const hasSubs = row.subs.length > 0 || !!inlineCRTo || (row.extraCRs?.length ?? 0) > 0
  // Either an inline CR or an extraCR attaches directly below the
  // parent row, so the row treats both the same way for visual
  // attachment (suppressed bottom border + tightened padding).
  const hasAttachedCR = !!inlineCRTo || (row.extraCRs?.length ?? 0) > 0
  return (
    <>
      <tr
        className={[
          hasSubs ? "cursor-pointer hover:bg-[#fafaf9]" : "",
          // Tighten the bottom padding when an inline CR follows so
          // the pair reads as a single visual unit.
          hasAttachedCR && expanded ? "arco-cr-attached" : "",
        ].filter(Boolean).join(" ")}
        onClick={hasSubs ? () => setExpanded(!expanded) : undefined}
        // Suppress the row-divider when an inline CR is rendered right
        // below — visually attaches the CR to its parent metric.
        style={hasAttachedCR && expanded ? { borderBottom: "none" } : undefined}
      >
        <td>
          <div className="flex items-center gap-2">
            {hasSubs ? (
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                className={`shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
              >
                <path d="M3 2L7 5L3 8" stroke="#a1a1a0" strokeWidth="1.2" fill="none" strokeLinecap="round" />
              </svg>
            ) : (
              <span style={{ width: 10 }} />
            )}
            <span
              className="status-pill-dot shrink-0"
              style={{ background: color }}
              title={driverLabel}
            />
            <span className="text-[12px] font-medium text-[#1c1c1a]">{row.label}</span>
            <InfoIcon definition={row.definition} />
          </div>
        </td>
        {row.datapoints.map((v, i) => (
          <NumberCellWithGrowth
            key={i}
            value={v}
            prev={i > 0 ? row.datapoints[i - 1] : null}
            textClassName="text-[12px] text-[#1c1c1a]"
          />
        ))}
        {/* Pad columns when row datapoints under-fill the header row. */}
        {row.datapoints.length < columnCount
          && Array.from({ length: columnCount - row.datapoints.length }).map((_, i) => (
            <td key={`pad-${i}`} />
          ))}
      </tr>

      {expanded && (
        <>
          {/* Definition row removed per design — the metric label is
              self-explanatory and the definition row added vertical
              noise inside the dropdown. Hover-tooltip on the metric
              label could reintroduce the text later if needed. */}

          {/* Inline parent-level CR row — sits above the source-level
              sub rows so the reader sees "Visitors → Signups: X%" before
              drilling into the per-source breakdown. Section-closing,
              so isLast=true keeps a line under it. */}
          {inlineCRTo && (
            <ConversionRowComponent
              from={row}
              to={inlineCRTo}
              toValues={row.inlineCRNumerator?.datapoints}
              columnCount={columnCount}
              placement="inline"
              isLast
            />
          )}

          {/* Extra parent-level CRs — used when the funnel branches from
              the parent into multiple targets (MAC → Sharers/Savers/
              Contacters). The block reads as one section: no lines
              between consecutive extraCRs, only the LAST extraCR keeps
              its bottom border to separate the block from what follows
              (subs or the next absolute row). */}
          {row.extraCRs?.map((cr, idx) => (
            <CustomCRRow
              key={cr.label}
              label={cr.label}
              numerator={cr.numerator}
              denominator={cr.denominator}
              columnCount={columnCount}
              isLast={idx === (row.extraCRs?.length ?? 0) - 1}
            />
          ))}

          {row.subs.map((sub) => {
            const hasPerSourceCR = !!sub.crNumerator && !!inlineCRTo
            const hasCustomCR = !!sub.customCR
            const valueRows = sub.valueRows ?? []
            const hasValueRows = valueRows.length > 0
            const hasAttachedCR = hasPerSourceCR || hasCustomCR || hasValueRows
            return (
              <Fragment key={sub.key}>
                <tr
                  className={hasAttachedCR ? "arco-cr-attached" : ""}
                  // Suppress the row-divider when a CR row follows,
                  // same rationale as the parent metric row above.
                  style={hasAttachedCR ? { borderBottom: "none" } : undefined}
                >
                  <td>
                    <div className="pl-7 text-[11px] text-[#6b6b68] flex items-center">
                      <span>{sub.label}</span>
                      <InfoIcon definition={sub.definition} />
                    </div>
                  </td>
                  {sub.datapoints.map((v, i) => (
                    <NumberCellWithGrowth
                      key={i}
                      value={v}
                      prev={i > 0 ? sub.datapoints[i - 1] : null}
                      textClassName="text-[11px] text-[#a1a1a0]"
                    />
                  ))}
                  {sub.datapoints.length < columnCount
                    && Array.from({ length: columnCount - sub.datapoints.length }).map((_, i) => (
                      <td key={`pad-${i}`} />
                    ))}
                </tr>
                {/* Per-source CR row. Uses sub.crNumerator (source-
                    attributed signups via PostHog $initial_referring_domain)
                    as the numerator, sub.datapoints as the denominator.
                    Skipped when crNumerator isn't set — keeps the per-sub
                    CR pattern opt-in. */}
                {/* Each sub + its CR reads as one section: the sub row
                    suppresses its bottom border (above) and the CR row
                    closes the section with its own border-bottom. */}
                {hasPerSourceCR && (
                  <PerSourceCRRow
                    sourceLabel={sub.label}
                    toLabel={inlineCRTo!.label}
                    numerator={sub.crNumerator!.datapoints}
                    denominator={sub.datapoints}
                    columnCount={columnCount}
                    isLast
                  />
                )}
                {/* Self-contained CR (% Retained / % Churn / % Re-activated
                    under MAU). Renders independently of inlineCRTo since
                    these are accounting ratios, not funnel conversions. */}
                {hasCustomCR && (
                  <CustomCRRow
                    label={sub.customCR!.label}
                    numerator={sub.customCR!.numerator}
                    denominator={sub.customCR!.denominator}
                    columnCount={columnCount}
                    isLast={!hasValueRows}
                  />
                )}
                {hasValueRows && valueRows.map((vr, idx) => (
                  <ValueRow
                    key={vr.label}
                    label={vr.label}
                    values={vr.values}
                    columnCount={columnCount}
                    tone={vr.tone}
                    format={vr.format}
                    isLast={idx === valueRows.length - 1}
                  />
                ))}
              </Fragment>
            )
          })}
        </>
      )}
    </>
  )
}

interface Props {
  initialRows: MetricRow[]
  initialLabels: string[]
  initialLastSynced: string | null
}

function formatRelativeSync(iso: string | null): string {
  if (!iso) return "never synced"
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return "synced just now"
  if (mins < 60) return `synced ${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `synced ${hours}h ago`
  const days = Math.floor(hours / 24)
  return `synced ${days}d ago`
}

export function GrowthModelClient({ initialRows, initialLabels, initialLastSynced }: Props) {
  const router = useRouter()
  const [isSyncing, startSync] = useTransition()
  const [isBackfilling, startBackfill] = useTransition()
  const [lastSynced, setLastSynced] = useState(initialLastSynced)

  const handleSync = () => {
    startSync(async () => {
      const result = await syncGrowthMetricsAction()
      if (result.success) {
        const seconds = (result.durationMs / 1000).toFixed(1)
        toast.success(`Synced ${result.upserted} daily rows in ${seconds}s`)
        setLastSynced(new Date().toISOString())
        // Refresh the page so the cached metric counts pull through.
        router.refresh()
      } else {
        toast.error(`Sync failed: ${result.errors.join("; ") || "unknown"}`)
      }
    })
  }

  const handleBackfill = () => {
    startBackfill(async () => {
      const result = await backfillFirstTouchSource()
      if (result.error) {
        toast.error(`Backfill failed: ${result.error}`)
        return
      }
      toast.success(
        `Stamped ${result.profilesUpdated} profile${result.profilesUpdated === 1 ? "" : "s"}` +
        ` + ${result.companiesUpdated} compan${result.companiesUpdated === 1 ? "y" : "ies"}`,
      )
      router.refresh()
    })
  }

  // The Pros/Clients separator lives in the row stream as a synthetic
  // _sep row. Split here so each user-type section gets its own
  // sub-header inside the same table.
  const sepIndex = initialRows.findIndex((r) => r.key === "_sep")
  const proRows = sepIndex >= 0 ? initialRows.slice(0, sepIndex) : initialRows
  const clientRows = sepIndex >= 0 ? initialRows.slice(sepIndex + 1) : []
  const columnCount = initialLabels.length

  // Every absolute-metric row renders its conversion-to-next inside
  // its own expansion (no chain CR rows between rows). The last row
  // of each user-type section naturally has no inlineCRTo because
  // there's nothing to convert to. Specific rows can opt out of the
  // inline CR via SUPPRESS_INLINE_CR — used when the next-row
  // transition isn't a meaningful conversion (e.g. Signups → MAU,
  // which is a stock-to-flow comparison, not a funnel rate).
  // Rows that opt out of the auto "to next funnel row" inline CR. Used
  // when the transition isn't a meaningful conversion (Signups → MAU is
  // stock-to-flow) or when the row defines its own MAC-based CRs via
  // `extraCRs` and the auto chain would be misleading (e.g. MAC → Sharers
  // is captured by % Sharers under MAC; Sharers → Savers / Savers →
  // Contacters then suppressed because the funnel goes MAC → each).
  const SUPPRESS_INLINE_CR = new Set<string>([
    "client_signups",
    "active_clients",
    "sharers",
    "savers",
    // New Pros → Listed Pros: not a meaningful funnel rate. New Pros
    // is a per-period flow ("onboarded this period"); Listed Pros is
    // a cumulative snapshot ("currently listed"). The ratio doesn't
    // describe a conversion.
    "new_pros",
    // Listed Pros → Published Projects: replaced by the dedicated
    // "to Publishers" / "% Ranked Pros" CRs under Listed Pros (set
    // via extraCRs).
    "actives",
    // Published Projects → Invited Pros: not a meaningful funnel
    // rate (the two are separate retention motions on the same pros,
    // not a sequential conversion).
    "published_projects",
    // Invited Pros → Responders: same — invitations and responses
    // operate on different actors (publishers invite; pros respond
    // to client inquiries), so the chain CR isn't a real conversion.
    "invited_pros",
  ])

  return (
    <>
      {/* Header mirrors the layout used on /admin/dashboard so the three
          views (Lifecycle / Table / Model) share the same chrome. */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h3 className="arco-section-title">Growth model</h3>
          <p className="text-xs text-[#a1a1a0] mt-0.5">
            Month-by-month planning grid · {" "}
            <a href="/admin/dashboard" className="text-[#6b6b68] hover:text-[#1c1c1a] underline transition-colors">
              Lifecycle view
            </a>
            {" · "}
            <a href="/admin/dashboard/table" className="text-[#6b6b68] hover:text-[#1c1c1a] underline transition-colors">
              Table view
            </a>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#a1a1a0]">{formatRelativeSync(lastSynced)}</span>
          <button
            onClick={handleBackfill}
            disabled={isBackfilling}
            className="h-8 px-3 text-[11px] font-medium border border-[#e5e5e4] rounded-[3px] text-[#1c1c1a] hover:bg-[#fafaf9] transition-colors disabled:opacity-50"
            title="One-shot: stamp first_touch_source on profiles + companies from PostHog"
          >
            {isBackfilling ? "Backfilling…" : "Backfill"}
          </button>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="h-8 px-3 text-[11px] font-medium border border-[#e5e5e4] rounded-[3px] text-[#1c1c1a] hover:bg-[#fafaf9] transition-colors disabled:opacity-50"
          >
            {isSyncing ? "Syncing…" : "Sync"}
          </button>
        </div>
      </div>

      {/* Phase legend — explains the dots without a dedicated grouping
          column. Section headings stay user-type (Pros/Clients) only. */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {(["acquisition", "retention", "monetization", "churn"] as const).map((d) => (
          <span key={d} className="flex items-center gap-1.5 text-[11px] text-[#6b6b68]">
            <span className="status-pill-dot shrink-0" style={{ background: DRIVER_COLORS[d] }} />
            {DRIVER_LABEL[d]}
          </span>
        ))}
      </div>

      {/* overflowX: visible suppresses the horizontal scrollbar on
          desktop — the Model table is sized to fit the content area,
          and the zero-width growth indicators spill into the right
          padding without forcing scroll. */}
      <div className="arco-table-wrap rounded-[3px]" style={{ overflowX: "visible" }}>
        <table className="arco-table" style={{ minWidth: 0 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", minWidth: 220 }}>Metric</th>
              {initialLabels.map((l, i) => (
                <th key={i} className="arco-table-nowrap" style={{ textAlign: "right", minWidth: 80 }}>
                  {/* Header text sits in the same right position as
                      the number below — both are followed by the
                      growth gutter, so the labels line up with the
                      values instead of the growth indicators. */}
                  <span>{l}</span>
                  <span
                    style={{
                      display: "inline-block",
                      width: GROWTH_GUTTER_PX,
                      marginLeft: 6,
                    }}
                  />
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            <tr>
              <td colSpan={columnCount + 1} style={{ background: "white" }}>
                <p className="arco-eyebrow text-[#a1a1a0]">Clients</p>
              </td>
            </tr>
            {clientRows.map((row, i) => {
              const nextRow = i < clientRows.length - 1 ? clientRows[i + 1] : null
              const inlineCR = nextRow && !SUPPRESS_INLINE_CR.has(row.key) ? nextRow : undefined
              return (
                <Fragment key={row.key}>
                  <MetricRowComponent
                    row={row}
                    columnCount={columnCount}
                    inlineCRTo={inlineCR}
                  />
                </Fragment>
              )
            })}

            <tr>
              <td colSpan={columnCount + 1} style={{ background: "white" }}>
                <p className="arco-eyebrow text-[#a1a1a0]">Professionals</p>
              </td>
            </tr>
            {proRows.map((row, i) => {
              const nextRow = i < proRows.length - 1 ? proRows[i + 1] : null
              const inlineCR = nextRow && !SUPPRESS_INLINE_CR.has(row.key) ? nextRow : undefined
              return (
                <Fragment key={row.key}>
                  <MetricRowComponent
                    row={row}
                    columnCount={columnCount}
                    inlineCRTo={inlineCR}
                  />
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
