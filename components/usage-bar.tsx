"use client"

/** Track height. The pill radius follows it, so one number moves both. */
const TRACK_HEIGHT = 34
const TRACK_RADIUS = TRACK_HEIGHT / 2

/**
 * A usage meter: a count line and the bar that draws it.
 *
 * The count line is the one the discovery grids use — number in black,
 * noun beside it — so "6 gepubliceerde projecten" reads the same here
 * as it does over a grid of them. The bar below is then free to say
 * only what the number cannot: how much of it the plan is showing.
 *
 * Two shapes on Arco: published projects, where nothing is withheld,
 * and contributor credits, where the fill splits — bright for what the
 * public sees, dimmed for what the plan holds back. Dimmed rather than
 * absent, because those projects do exist; an empty stretch would say
 * the company has nothing there. A split bar names its own halves and
 * drops the total: three numbers over two segments is one number too
 * many, and the reader has to work out which belongs to what.
 *
 * See /admin/design → Usage bars.
 */
export function UsageBar({
  label,
  count,
  fillPct,
  note = null,
  unbounded = false,
  lockedFromPct = null,
  lockedLabel = null,
  markerLabel = null,
  endLabel = null,
  endLabelHref = null,
  onEndLabelClick = null,
}: {
  /** The noun the count counts, already pluralised for it — e.g.
   *  "gepubliceerde projecten". Set in the count line above the bar. */
  label: string
  count: number
  fillPct: number
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
  /** Rides inside the dimmed stretch, e.g. "5 projecten niet zichtbaar". */
  lockedLabel?: string | null
  /** Sits under the bar at lockedFromPct, e.g. "1 gratis". */
  markerLabel?: string | null
  /** Sits under the far end of the TRACK — the way past the limit, put
   *  where the road runs out rather than where the fill stops. */
  endLabel?: string | null
  /** Makes endLabel a text link pointing somewhere. Serializable, so a
   *  Server Component can pass it; onEndLabelClick cannot. */
  endLabelHref?: string | null
  /** Makes endLabel a text link that runs something. Give it the same
   *  destination as the page's own upgrade button. Client-side only. */
  onEndLabelClick?: (() => void) | null
}) {
  // An unbounded meter has no meaningful proportion to draw, so the
  // fill is a fixed stretch that stops short of the end. Anything
  // computed would imply a denominator that does not exist.
  const filled = unbounded ? (fillPct > 0 ? 62 : 0) : Math.max(0, Math.min(100, fillPct))
  const locked = lockedFromPct != null ? Math.max(0, Math.min(filled, lockedFromPct)) : null
  const hasUnderLabels = Boolean(markerLabel || endLabel)
  // A split fill carries its own labels, which changes where the total
  // can go: see the two branches below.
  const split = locked != null && Boolean(lockedLabel)
  // Nothing used yet, but an allowance to show: the bar draws the one
  // free credit as an empty slot, one project wide and in the same
  // place a used bar would put it. The open road past it is then the
  // whole point of the picture — that is what upgrading buys.
  const nothingYet = unbounded && filled === 0 && Boolean(markerLabel)
  // Everything on the track is placed off --u-fill rather than off a
  // baked-in percentage, so one media query can lengthen the fill on a
  // narrow screen and the segments, labels and marks all follow. The
  // split is held as a SHARE of the fill for the same reason: scaled
  // together, 1-of-6 stays 1-of-6.
  const lockedShare = locked != null && filled > 0 ? locked / filled : 0
  const ofFill = (share: number) => `calc(var(--u-fill) * ${share})`
  // The open bar's fill lives entirely in the stylesheet, because an
  // inline custom property would outrank the media query that lengthens
  // it on a phone. Every other case has a real proportion to state, and
  // states it here.
  const open = unbounded && filled > 0

  return (
    <div
      className={`usage-bar${open ? " usage-bar--open" : ""}${nothingYet ? " usage-bar--slot" : ""}`}
      style={open || nothingYet ? undefined : ({ "--u-fill": `${filled}%` } as React.CSSProperties)}
    >
      {/* The same count line the discovery grids use: the number in
          black, the noun beside it in secondary. One convention for
          "how many of these do you have", wherever it is asked. */}
      <p className="discover-results-count" style={{ marginBottom: 8 }}>
        <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>{count}</strong>{" "}
        {label}
      </p>

      <div style={{
        position: "relative", height: TRACK_HEIGHT, borderRadius: TRACK_RADIUS, boxSizing: "border-box",
        // Bounded: a solid groove, because there really is a distance to
        // fill. Unbounded: a dashed outline, which does not promise one.
        background: unbounded ? "transparent" : "var(--arco-surface)",
        border: unbounded ? "1px dashed var(--arco-light-grey)" : undefined,
        // The slot has to sit ON the track's own outline to hide it, so
        // it needs the extra pixel a clipped box would eat.
        overflow: nothingYet ? "visible" : "hidden",
      }}>
        {/* The whole of what the company has. Dimmed when part of it is
            withheld; the bright segment on top is what the public sees.
            With nothing used yet the same stretch is drawn as an empty
            slot: outlined rather than filled, because it is room for a
            project rather than a project. */}
        <div style={{
          position: "absolute",
          boxSizing: "border-box",
          ...(nothingYet
            ? {
                // Laid over the track's outline rather than inside it —
                // opaque, so the dashes stop at the slot and pick up
                // again past it, exactly as they do around a filled
                // segment. Same pill shape as a used credit: the empty
                // slot is that credit, waiting. The extra pixel on each
                // side is the track's own border; the right edge still
                // lands on --u-fill, where the marker points.
                top: -1, bottom: -1, left: -1, width: "calc(var(--u-fill) + 1px)",
                borderRadius: TRACK_RADIUS + 1,
                border: "1px solid var(--arco-light-grey)",
                background: "var(--background)",
              }
            : {
                top: 0, bottom: 0, left: 0, width: "var(--u-fill)",
                borderRadius: TRACK_RADIUS,
                background: locked != null ? "rgba(1, 109, 117, .22)" : "var(--primary, #016D75)",
              }),
          transition: "width .2s ease",
        }} />
        {locked != null && (
          <div style={{
            position: "absolute", top: 0, bottom: 0, left: 0, width: ofFill(lockedShare),
            background: "var(--primary, #016D75)", borderRadius: TRACK_RADIUS,
          }} />
        )}
        {/* What the plan holds back, named inside the stretch it
            occupies: the label and the thing it describes are then the
            same object rather than a legend to cross-reference. Set
            against the far edge of that stretch, where the fill stops,
            so it reads as the count that stretch arrives at. */}
        {split && (
          <span style={{
            position: "absolute", top: 0, bottom: 0,
            left: ofFill(lockedShare), width: ofFill(1 - lockedShare),
            display: "flex", alignItems: "center", justifyContent: "flex-end",
            paddingRight: 14, boxSizing: "border-box",
            fontSize: 13, color: "var(--primary, #016D75)", whiteSpace: "nowrap",
          }}>
            {lockedLabel}
          </span>
        )}
      </div>

      {/* Labels pinned under the two points that matter: where the free
          allowance stops, and where the track itself runs out. Reading
          left to right they state the limit and then the way past it. */}
      {hasUnderLabels && (
        <div style={{ position: "relative", height: 22, marginTop: 6 }}>
          {markerLabel && (
            <span
              className="arco-small-text"
              style={{
                position: "absolute", whiteSpace: "nowrap",
                // Centred on the boundary it marks: the end of the used
                // stretch, or — with nothing used — the end of the slot
                // standing in for it.
                ...(nothingYet || locked
                  ? { left: ofFill(nothingYet ? 1 : lockedShare), transform: "translateX(-50%)" }
                  : { left: 0 }),
              }}
            >
              {markerLabel}
            </span>
          )}
          {/* When the way past the limit is an action, it looks like
              one. Same destination as the plan's own upgrade button —
              two words that promise the same thing must not lead to two
              different places. */}
          {endLabel && onEndLabelClick && (
            <button
              type="button"
              className="arco-text-link arco-text-link--primary"
              onClick={onEndLabelClick}
              style={{ position: "absolute", right: 0 }}
            >
              {endLabel}
            </button>
          )}
          {endLabel && !onEndLabelClick && endLabelHref && (
            <a
              href={endLabelHref}
              className="arco-text-link arco-text-link--primary"
              style={{ position: "absolute", right: 0 }}
            >
              {endLabel}
            </a>
          )}
          {endLabel && !onEndLabelClick && !endLabelHref && (
            <span className="arco-small-text" style={{ position: "absolute", right: 0, whiteSpace: "nowrap" }}>
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
