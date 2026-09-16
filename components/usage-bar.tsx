"use client"

/**
 * A usage meter: label, a filled track with the count inside it, and a
 * value on the right.
 *
 * The count rides inside the bar rather than above it so the number and
 * the thing it measures cannot drift apart when the bar is short — and
 * it slides out onto the track, switching to dark text, when the fill
 * is too small to hold it.
 *
 * Two shapes on Arco: published projects, where nothing is withheld,
 * and contributor credits, where the fill splits — bright for what the
 * public sees, dimmed for what the plan holds back. Dimmed rather than
 * absent, because those projects do exist; an empty stretch would say
 * the company has nothing there.
 *
 * See /admin/design → Usage bars.
 */
export function UsageBar({
  label,
  countLabel,
  fillPct,
  right,
  note = null,
  unbounded = false,
  lockedFromPct = null,
  markerLabel = null,
  endLabel = null,
}: {
  label: string
  /** Already-formatted, e.g. "6 projecten" or "Geen projecten". */
  countLabel: string
  fillPct: number
  right: string
  note?: string | null
  /**
   * No ceiling exists. The track becomes a dashed outline rather than a
   * solid groove — a measured groove always reads as a distance to fill
   * — and the fill stops well short of the end, leaving open room
   * inside it. The dashed boundary is what makes that room readable:
   * against a solid track the gap would mean "this much left", against
   * a broken one it means "and onward". The count carries the number;
   * the track only says the road continues.
   */
  unbounded?: boolean
  /**
   * Where the visible part ends and the withheld part begins. Past this
   * point the fill is dimmed rather than absent: those projects exist,
   * they are simply not on the public page. An empty track would say
   * the opposite — that there is nothing there.
   */
  lockedFromPct?: number | null
  /** Sits under the bar at lockedFromPct, e.g. "1 zichtbaar". */
  markerLabel?: string | null
  /** Sits under the far end of the fill — the way out of the limit. */
  endLabel?: string | null
}) {
  // An unbounded meter has no meaningful proportion to draw, so the
  // fill is a fixed stretch that fades out. Anything computed would
  // imply a denominator that does not exist.
  const filled = unbounded ? (fillPct > 0 ? 62 : 0) : Math.max(0, Math.min(100, fillPct))
  const locked = lockedFromPct != null ? Math.max(0, Math.min(filled, lockedFromPct)) : null
  const hasUnderLabels = Boolean(markerLabel || endLabel)
  // Below this the fill cannot hold its own label; the count moves out
  // onto the empty track instead of being clipped.
  const labelFitsInside = filled > 22

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <span style={{ fontSize: 14 }}>{label}</span>
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{right}</span>
      </div>

      <div style={{
        position: "relative", height: 28, borderRadius: 14, boxSizing: "border-box",
        // Bounded: a solid groove, because there really is a distance to
        // fill. Unbounded: a dashed outline, which does not promise one.
        background: unbounded ? "transparent" : "var(--arco-surface)",
        border: unbounded ? "1px dashed var(--arco-light-grey)" : undefined,
        overflow: "hidden",
      }}>
        {/* The whole of what the company has. Dimmed when part of it is
            withheld; the bright segment on top is what the public sees. */}
        <div style={{
          position: "absolute", inset: 0, width: `${filled}%`,
          background: locked != null ? "rgba(1, 109, 117, .22)" : "var(--primary, #016D75)",
          borderRadius: 14,
          transition: "width .2s ease",
        }} />
        {locked != null && (
          <div style={{
            position: "absolute", top: 0, bottom: 0, left: 0, width: `${locked}%`,
            background: "var(--primary, #016D75)", borderRadius: 14,
          }} />
        )}
        <span style={{
          position: "absolute", top: 0, bottom: 0, display: "flex", alignItems: "center",
          left: labelFitsInside ? 14 : `calc(${filled}% + 14px)`,
          fontSize: 13, fontWeight: 400, whiteSpace: "nowrap",
          color: labelFitsInside ? "#fff" : "var(--text-secondary)",
        }}>
          {countLabel}
        </span>
      </div>

      {/* Labels pinned under the two points that matter: where the
          visible part stops, and where the whole of it does. Reading
          left to right they state the limit and then the way past it. */}
      {hasUnderLabels && (
        <div style={{ position: "relative", height: 20, marginTop: 6 }}>
          {markerLabel && locked != null && (
            <span className="arco-small-text" style={{ position: "absolute", left: `${locked}%`, transform: "translateX(-50%)", whiteSpace: "nowrap" }}>
              {markerLabel}
            </span>
          )}
          {endLabel && (
            <span className="arco-small-text" style={{ position: "absolute", left: `${filled}%`, transform: "translateX(-50%)", whiteSpace: "nowrap" }}>
              {endLabel}
            </span>
          )}
        </div>
      )}

      {note && (
        <p className="arco-small-text" style={{ marginTop: 8, marginBottom: 0 }}>{note}</p>
      )}
    </div>
  )
}
