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
 * Two shapes on Arco: published projects (always full, "unlimited" on
 * the right, never reaching a limit is the point) and contributor
 * credits, where the track's length is everything the company has, the
 * fill is what the public actually sees, and the dashed mark shows
 * where the Free plan stops.
 *
 * See /admin/design → Usage bars.
 */
export function UsageBar({
  label,
  countLabel,
  fillPct,
  markerPct = null,
  right,
  note = null,
}: {
  label: string
  /** Already-formatted, e.g. "6 projecten" or "Geen projecten". */
  countLabel: string
  fillPct: number
  /** Percentage along the track where the plan's limit sits. */
  markerPct?: number | null
  right: string
  note?: string | null
}) {
  const filled = Math.max(0, Math.min(100, fillPct))
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
        position: "relative", height: 28, borderRadius: 14,
        background: "var(--arco-surface)", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0, width: `${filled}%`,
          background: "var(--primary, #016D75)", borderRadius: 14,
          transition: "width .2s ease",
        }} />
        {/* Where the plan stops. Drawn over the fill so it stays visible
            on both sides of the boundary. */}
        {markerPct != null && (
          <div style={{
            position: "absolute", top: 0, bottom: 0, left: `${Math.min(100, Math.max(0, markerPct))}%`,
            borderLeft: "2px dashed rgba(255,255,255,.85)",
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

      {note && (
        <p className="arco-small-text" style={{ marginTop: 8, marginBottom: 0 }}>{note}</p>
      )}
    </div>
  )
}
