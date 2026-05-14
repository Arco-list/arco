"use client"

import { useState, useRef, useCallback, useMemo } from "react"
import Image from "next/image"
import { ChevronRight } from "lucide-react"
import { useTranslations } from "next-intl"

interface Photo {
  id: string
  url: string
  caption: string | null
  feature_id: string | null
  /** Space slug derived from the feature's linked space */
  space?: string | null
  /** Native pixel dimensions from upload. When present we render the
   *  thumbnail at its native aspect ratio (so portrait photos stay
   *  tall and landscape photos stay wide in the masonry grid).
   *  Missing → fall back to 3:2 landscape, the legacy default. */
  width?: number | null
  height?: number | null
}

type Orientation = "portrait" | "landscape" | "pano"
function orientation(p: Photo): Orientation {
  if (!p.width || !p.height) return "landscape"
  const r = p.width / p.height
  if (r < 0.9) return "portrait"
  if (r > 2.2) return "pano"
  return "landscape"
}

// Pair-aware span assignment for the 6-col × 6-row-unit grid.
//
// Core rule: every row must consume the full 6 cols. Empty slots are
// only allowed at the very end of the gallery. To achieve this we use:
//   - Hard triplets (PPP / LLL / PLL / LLP) for 3-photo packs.
//   - `PPLL` interleaved (2 LP pairs sharing 2 rows) so a `[P, P, L, L]`
//     run packs cleanly without orphaning the first P.
//   - `PP` pair with two modes — mid-sequence crops both Ps to 3×6
//     squares; final pair keeps native 2×6 (end-gap is OK).
//   - Mid-sequence trailing-P stretches to full row (rare; trades P's
//     2:3 aspect for a 2:1 strip rather than leaving a mid-gap).
//
// Sizing math:
//   - 6 grid cols, 1 visual col = 2 grid cols.
//   - Row unit = grid-col-width / 2, so 1 user row = 6 row-units
//     (= 3W tall, where W = grid col width).
//   - 1 user row at the full 6-col width = 6W × 3W = aspect 2:1.
//   - Portrait default at 1 visual col × 1 user row = 2W × 3W = 2:3
//     (native — no crop).
//
// Span cheat sheet (col × row units, 1 user row = 6 row units):
//   Portrait default       2 × 6   → 1 visual col × 1 user row    (2:3, no crop)
//   Portrait square crop   3 × 6   → 1.5 visual col × 1 user row  (PP-pair mid-sequence)
//   Portrait tall variant  3 × 12  → 1.5 visual col × 2 user rows (PLL / LLP triplets only)
//   Portrait full-row      6 × 6   → 3 visual col × 1 user row    (only mid-orphan, very rare)
//   Landscape default      3 × 6   → 1.5 visual col × 1 user row  (LL pair / LLL pack)
//   Landscape paired-w-P   4 × 6   → 2 visual col × 1 user row    (LP / PL pair)
//   Landscape full row     6 × 6   → 3 visual col × 1 user row    (2:1 strip)
//   Pano                   6 × 6   → same as full row
//
// Visual order is fully controlled by CSS `order` — every cell gets
// an explicit value from a running cursor so subsequent blocks render
// after the current one regardless of source position. This lets the
// PPLL pattern interleave 4 cells across 2 rows (P, L, P, L visually
// from source [P, P, L, L]).
//
// `blockStartRow` records the user-row index AFTER each cell's block
// finishes. We use it to slice the photo set on first render so the
// initial view shows whole blocks ending within the first 3 user rows
// (instead of a fixed photo count).
type Span = { col: number; row: number; order?: number; blockStartRow: number }

function assignSpans(photos: Photo[]): Span[] {
  const out = new Array<Span>(photos.length)
  let i = 0
  // Counter and state for layout decisions across the gallery.
  let plCombosCount = 0
  let nextPLVisual: "LP" | "PL" = "LP"
  // Running user-row cursor (1 user row = 6 row-units in the grid).
  let currentRow = 0
  // Monotonic CSS `order` cursor. Each cell gets `nextOrder()` so the
  // visual sequence within a block is encoded directly in source —
  // and subsequent blocks always sort after the current one.
  let orderCursor = 0
  const nextOrder = () => orderCursor++

  // Renders a P+L pair to source positions iL (the L slot) and iP
  // (the P slot). nextPLVisual toggles LP/PL alternation; we set the
  // CSS order in *visual* sequence so the layout is independent of
  // which slot appears first in source. `startRow` is the user-row
  // where the enclosing block begins (stamped on both cells for the
  // row-based initial-reveal slicing).
  function pairLP(iL: number, iP: number, startRow: number) {
    plCombosCount += 1
    const desiredLeftIs = nextPLVisual === "LP" ? "L" : "P"
    if (desiredLeftIs === "L") {
      out[iL] = { col: 4, row: 6, order: nextOrder(), blockStartRow: startRow }
      out[iP] = { col: 2, row: 6, order: nextOrder(), blockStartRow: startRow }
    } else {
      out[iP] = { col: 2, row: 6, order: nextOrder(), blockStartRow: startRow }
      out[iL] = { col: 4, row: 6, order: nextOrder(), blockStartRow: startRow }
    }
    nextPLVisual = nextPLVisual === "LP" ? "PL" : "LP"
  }

  while (i < photos.length) {
    const o = orientation(photos[i])
    const nO = i + 1 < photos.length ? orientation(photos[i + 1]) : null
    const n2O = i + 2 < photos.length ? orientation(photos[i + 2]) : null
    const n3O = i + 3 < photos.length ? orientation(photos[i + 3]) : null
    // `currentRow` is the user-row the next block will start in. We
    // stamp it on every cell of the block as `blockStartRow`, then
    // advance it by the block's height at the end.
    const startRow = currentRow

    // Pano always full row.
    if (o === "pano") {
      out[i] = { col: 6, row: 6, order: nextOrder(), blockStartRow: startRow }
      currentRow += 1
      i += 1
      continue
    }

    // ── Hard triplets (always fire — fixed orientation packing) ──
    // Tall P (3×12) is reserved for combinations with 2 Ls (PLL / LLP
    // triplets below). Mixed L+P+P / P+L+P / P+P+L sequences fall
    // through to pair patterns so Tall P doesn't appear next to a P.
    if (o === "portrait" && nO === "portrait" && n2O === "portrait") {
      out[i] = { col: 2, row: 6, order: nextOrder(), blockStartRow: startRow }
      out[i + 1] = { col: 2, row: 6, order: nextOrder(), blockStartRow: startRow }
      out[i + 2] = { col: 2, row: 6, order: nextOrder(), blockStartRow: startRow }
      currentRow += 1
      i += 3
      continue
    }

    // ── No dedicated LLL pattern ──────────────────────────────────
    // Long landscape runs pack as consecutive LL pairs (1 user row
    // each), with the odd photo at the end falling through to the
    // trailing-L full-row hero. With LLL forcing a 2-row block per 3
    // Ls, a 6-photo run would consume 4 rows on first load instead
    // of 3 — bad initial-view density. Removing it doesn't lose the
    // "hero L" effect, since trailing-single L still produces one.
    //
    // ── PLL / LLP: 25% triplet, 75% pair + trailing single ────────
    if (o === "portrait" && nO === "landscape" && n2O === "landscape") {
      plCombosCount += 1
      if (plCombosCount % 4 === 0) {
        // Triplet: tall P (left) + 2 stacked L (right).
        // Source order [P, L, L] matches visual order.
        out[i] = { col: 3, row: 12, order: nextOrder(), blockStartRow: startRow }
        out[i + 1] = { col: 3, row: 6, order: nextOrder(), blockStartRow: startRow }
        out[i + 2] = { col: 3, row: 6, order: nextOrder(), blockStartRow: startRow }
      } else {
        // Pair PL + trailing single L. Don't double-count combos.
        plCombosCount -= 1
        pairLP(i + 1, i, startRow)
        out[i + 2] = { col: 6, row: 6, order: nextOrder(), blockStartRow: startRow }
      }
      currentRow += 2
      i += 3
      continue
    }
    if (o === "landscape" && nO === "landscape" && n2O === "portrait") {
      plCombosCount += 1
      if (plCombosCount % 4 === 0) {
        // Triplet: tall P (left) + 2 stacked L (right). Source order
        // [L, L, P] but visual is P-then-Ls, so render P first via
        // an earlier `order` value.
        out[i + 2] = { col: 3, row: 12, order: nextOrder(), blockStartRow: startRow }
        out[i] = { col: 3, row: 6, order: nextOrder(), blockStartRow: startRow }
        out[i + 1] = { col: 3, row: 6, order: nextOrder(), blockStartRow: startRow }
      } else {
        plCombosCount -= 1
        // Leading single L (full row) + LP pair
        out[i] = { col: 6, row: 6, order: nextOrder(), blockStartRow: startRow }
        pairLP(i + 1, i + 2, startRow)
      }
      currentRow += 2
      i += 3
      continue
    }

    // ── PPLL → 2 interleaved LP pairs across 2 rows ───────────────
    // Without this, [P, P, L, L] would orphan the first P (mid-gap).
    // Visual layout (each row 2+4=6 cols): row 0 = P(i) + L(i+2),
    // row 1 = P(i+1) + L(i+3). Aspects preserved, no gap.
    if (o === "portrait" && nO === "portrait" && n2O === "landscape" && n3O === "landscape") {
      out[i] = { col: 2, row: 6, order: nextOrder(), blockStartRow: startRow }       // P0 row 0
      out[i + 2] = { col: 4, row: 6, order: nextOrder(), blockStartRow: startRow }   // L2 row 0
      out[i + 1] = { col: 2, row: 6, order: nextOrder(), blockStartRow: startRow }   // P1 row 1
      out[i + 3] = { col: 4, row: 6, order: nextOrder(), blockStartRow: startRow }   // L3 row 1
      currentRow += 2
      i += 4
      continue
    }

    // ── PP pair ───────────────────────────────────────────────────
    // Mid-sequence: crop both Ps to 3×6 squares so the row fills (no
    // mid-gap). Final pair (last two photos overall): keep 2×6 native
    // aspect since an end-gap is acceptable.
    if (o === "portrait" && nO === "portrait") {
      const isFinalPair = i + 1 === photos.length - 1
      const span = isFinalPair ? 2 : 3
      out[i] = { col: span, row: 6, order: nextOrder(), blockStartRow: startRow }
      out[i + 1] = { col: span, row: 6, order: nextOrder(), blockStartRow: startRow }
      currentRow += 1
      i += 2
      continue
    }

    // ── Other pair patterns ───────────────────────────────────────
    if (o === "portrait" && nO === "landscape") {
      pairLP(i + 1, i, startRow)
      currentRow += 1
      i += 2
      continue
    }
    if (o === "landscape" && nO === "portrait") {
      pairLP(i, i + 1, startRow)
      currentRow += 1
      i += 2
      continue
    }
    if (o === "landscape" && nO === "landscape") {
      out[i] = { col: 3, row: 6, order: nextOrder(), blockStartRow: startRow }
      out[i + 1] = { col: 3, row: 6, order: nextOrder(), blockStartRow: startRow }
      currentRow += 1
      i += 2
      continue
    }

    // ── Trailing single ───────────────────────────────────────────
    const isLast = i === photos.length - 1
    if (o === "portrait" && isLast) {
      // End orphan P — keep native 2:3 aspect; end-gap is acceptable.
      out[i] = { col: 2, row: 6, order: nextOrder(), blockStartRow: startRow }
    } else {
      // Mid orphan P or any L: full row. For P this crops 2:3 → 2:1
      // (a wide strip), but only fires for rare configurations such
      // as [P, Pano, ...] where no pair / triplet rule applies. The
      // alternative would be a mid-gap, which the gallery forbids.
      out[i] = { col: 6, row: 6, order: nextOrder(), blockStartRow: startRow }
    }
    currentRow += 1
    i += 1
  }
  return out
}

// First-load reveal: include every block that *starts* before this
// user-row index. A 2-row block beginning at row 2 is included even
// though it extends to row 4 — gives "at least N rows" rather than
// "at most N rows" so we don't shortchange the first view. Anything
// starting at row N or later is gated behind the "more photos" button.
const INITIAL_ROWS = 3

// Mobile gets its own span pass. Allowed combinations:
//   - Pano       2 col × 2 row (full-width strip, preferred)
//   - LL pair    two 1 col × 2 row (squares)
//   - PP pair    two 1 col × 3 row (portraits)
//   - 4-cell interlock when next 4 photos are 2 Ls + 2 Ps in any order:
//     visual sequence becomes LPPL (or PLPL when starting on P), so
//     each column ends up with L + P = 2 + 3 = 5 row-units. Source
//     positions are remapped via CSS `order` so a "scrambled" run
//     like [L, P, L, P] also packs cleanly.
// PLL / LLP triplets are removed on mobile (no tall P). Singles
// (1×2 L or 1×3 P) only happen at the tail of the gallery.
type MobileSpan = { col: number; row: number; order: number }

function mobileAssignSpans(photos: Photo[]): MobileSpan[] {
  const out = new Array<MobileSpan>(photos.length)
  let i = 0
  let orderCursor = 0
  const next = () => orderCursor++

  while (i < photos.length) {
    const o = orientation(photos[i])
    const o1 = i + 1 < photos.length ? orientation(photos[i + 1]) : null
    const o2 = i + 2 < photos.length ? orientation(photos[i + 2]) : null
    const o3 = i + 3 < photos.length ? orientation(photos[i + 3]) : null

    // Pano always full-row.
    if (o === "pano") {
      out[i] = { col: 2, row: 2, order: next() }
      i += 1
      continue
    }

    // First-photo hero: when the gallery opens with an L and the next
    // 4 photos can form an LPPL/PLPL interlock (2 Ls + 2 Ps), promote
    // the first L to a 2×2 Pano-style cell. The interlock then fires
    // on photos 2-5. Galleries read better when they open with a
    // statement image rather than packing the first L into a small
    // square inside the interlock.
    if (i === 0 && o === "landscape" && i + 4 < photos.length) {
      const o4 = orientation(photos[i + 4])
      const next4 = [o1, o2, o3, o4]
      const lCount = next4.filter((x) => x === "landscape").length
      const pCount = next4.filter((x) => x === "portrait").length
      if (lCount === 2 && pCount === 2 && !next4.includes("pano")) {
        out[i] = { col: 2, row: 2, order: next() }
        i += 1
        continue
      }
    }

    // 4-cell interlock when next 4 are 2 Ls + 2 Ps (no pano).
    if (o1 && o2 && o3) {
      const ortns = [o, o1, o2, o3]
      const lCount = ortns.filter((x) => x === "landscape").length
      const pCount = ortns.filter((x) => x === "portrait").length
      if (lCount === 2 && pCount === 2 && !ortns.includes("pano")) {
        const lSrc: number[] = []
        const pSrc: number[] = []
        for (let k = 0; k < 4; k++) {
          (ortns[k] === "landscape" ? lSrc : pSrc).push(k)
        }
        // Visual layout: LPPL when first source is L, PLPL when first is P.
        // Each column ends up with one L (2 units) + one P (3 units) = 5 units.
        const visualPos = new Array<number>(4)
        if (o === "landscape") {
          visualPos[lSrc[0]] = 0
          visualPos[pSrc[0]] = 1
          visualPos[pSrc[1]] = 2
          visualPos[lSrc[1]] = 3
        } else {
          visualPos[pSrc[0]] = 0
          visualPos[lSrc[0]] = 1
          visualPos[pSrc[1]] = 2
          visualPos[lSrc[1]] = 3
        }
        const base = orderCursor
        orderCursor += 4
        for (let k = 0; k < 4; k++) {
          out[i + k] = {
            col: 1,
            row: ortns[k] === "landscape" ? 2 : 3,
            order: base + visualPos[k],
          }
        }
        i += 4
        continue
      }
    }

    // LLL: LL pair + 2×2 hero L (full-row strip). Lookahead skip if
    // the 4th photo is P — otherwise the hero would orphan it.
    // Generates a Pano-style cell every 3 Ls so long landscape runs
    // don't read as a wall of identical squares.
    if (o === "landscape" && o1 === "landscape" && o2 === "landscape" && o3 !== "portrait") {
      out[i]     = { col: 1, row: 2, order: next() }
      out[i + 1] = { col: 1, row: 2, order: next() }
      out[i + 2] = { col: 2, row: 2, order: next() }
      i += 3
      continue
    }

    // LL pair
    if (o === "landscape" && o1 === "landscape") {
      out[i] = { col: 1, row: 2, order: next() }
      out[i + 1] = { col: 1, row: 2, order: next() }
      i += 2
      continue
    }

    // PP pair
    if (o === "portrait" && o1 === "portrait") {
      out[i] = { col: 1, row: 3, order: next() }
      out[i + 1] = { col: 1, row: 3, order: next() }
      i += 2
      continue
    }

    // Trailing / fallback. Trailing-L at the gallery's tail goes full
    // row (2×2 hero) so it doesn't sit lonely with a 1-col gap next
    // to it. Mid-orphan L stays a 1×2 square so dense flow can pair
    // it up with surrounding cells. Trailing P always stays 1×3 to
    // preserve portrait aspect.
    const isLast = i === photos.length - 1
    if (o === "landscape" && isLast) {
      out[i] = { col: 2, row: 2, order: next() }
    } else if (o === "portrait") {
      out[i] = { col: 1, row: 3, order: next() }
    } else {
      out[i] = { col: 1, row: 2, order: next() }
    }
    i += 1
  }
  return out
}

interface PhotoTourProps {
  photos: Photo[]
  projectId: string
  /** Unique space slugs present on this project's photos */
  spaces?: string[]
}

const ALL_SLUG = "__all__"

// Title-case fallback for unknown slugs not in the i18n spaces namespace
// (e.g. future additions before translations land).
const slugToTitleCase = (slug: string) =>
  slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")

export function PhotoTour({ photos, spaces = [] }: PhotoTourProps) {
  const t = useTranslations("project_detail")
  const tSpaces = useTranslations("spaces")
  const [activeCategory, setActiveCategory] = useState<string>(ALL_SLUG)
  const [showMore, setShowMore] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  // Client-measured natural dimensions for photos whose width/height
  // weren't recorded in the DB. About two-thirds of historical photos
  // are NULL on those columns; without this fallback they'd get
  // cropped into the default 3:2 cell shape regardless of orientation.
  // Each image fires onLoadingComplete with naturalWidth/Height,
  // which seeds this map; subsequent renders pick up the real aspect.
  const [measuredDims, setMeasuredDims] = useState<Record<string, { w: number; h: number }>>({})
  const handleImgLoaded = useCallback((id: string, w: number, h: number) => {
    setMeasuredDims((prev) => prev[id] ? prev : { ...prev, [id]: { w, h } })
  }, [])

  // Merge stored + measured dimensions so the rest of the layout code
  // (aspect ratio, column span) reads one source of truth.
  const photosWithDims = useMemo<Photo[]>(() => photos.map((p) => {
    if (p.width && p.height) return p
    const m = measuredDims[p.id]
    return m ? { ...p, width: m.w, height: m.h } : p
  }), [photos, measuredDims])

  // Translate a space slug; fall back to a title-cased version of the slug
  // so unknown spaces still render a reasonable label instead of raw kebab.
  const labelForSlug = (slug: string) => {
    try {
      return tSpaces(slug as any)
    } catch {
      return slugToTitleCase(slug)
    }
  }

  // Build the pill list from actual spaces on photos. The "all" pill uses
  // a sentinel slug so state comparisons stay slug-based (labels can change
  // per-locale without breaking identity).
  const categories: Array<{ slug: string; label: string }> = [
    { slug: ALL_SLUG, label: t("all_photos") },
    ...spaces.map((slug) => ({ slug, label: labelForSlug(slug) })),
  ]

  // Filter photos by space. Source from photosWithDims so freshly
  // measured dimensions feed back into the rendered cells.
  const filteredPhotos = useMemo(() => activeCategory === ALL_SLUG
    ? photosWithDims
    : photosWithDims.filter((photo) => photo.space === activeCategory),
  [photosWithDims, activeCategory])

  // Compute spans on the full filtered set so look-ahead (e.g. LLLP →
  // LL + LP, not LLL + orphan) and pair-counter cadence are correct.
  // We later slice for display; the per-cell spans are stable.
  const allSpans = useMemo(() => assignSpans(filteredPhotos), [filteredPhotos])
  // Mobile spans run a separate algorithm — same photos, different
  // pattern set (Pano / LL / PP / LPPL interlock / end-singles).
  const allMobileSpans = useMemo(() => mobileAssignSpans(filteredPhotos), [filteredPhotos])

  // Row-based initial reveal: include every block whose start-row is
  // before INITIAL_ROWS. A block straddling the boundary (e.g. 2-row
  // block starting at row 2) is included whole — gives at-least-N
  // rows rather than at-most-N, since otherwise a tall third block
  // could leave the first view with only 2 rows.
  const initialCount = useMemo(() => {
    const overflow = allSpans.findIndex((s) => s.blockStartRow >= INITIAL_ROWS)
    return overflow === -1 ? allSpans.length : overflow
  }, [allSpans])

  const displayPhotos = showMore ? filteredPhotos : filteredPhotos.slice(0, initialCount)
  const remainingCount = filteredPhotos.length - initialCount

  // Lightbox always shows ALL photos (pills navigate, not filter)
  const lightboxPhotos = photosWithDims

  const openLightbox = (index: number) => {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  const closeLightbox = () => {
    setLightboxOpen(false)
  }

  const nextImage = () => {
    setLightboxIndex((prev) => (prev + 1) % lightboxPhotos.length)
  }

  const prevImage = () => {
    setLightboxIndex((prev) => (prev - 1 + lightboxPhotos.length) % lightboxPhotos.length)
  }

  const handleCategoryChange = (slug: string) => {
    setActiveCategory(slug)
    setShowMore(false)
    // If lightbox is open, reset to first image of new filtered set
    if (lightboxOpen) {
      setLightboxIndex(0)
    }
  }

  // In lightbox: navigate to the first photo of a given space
  const handleLightboxSpaceNav = (slug: string) => {
    const targetIndex = photosWithDims.findIndex((p) => p.space === slug)
    if (targetIndex !== -1) setLightboxIndex(targetIndex)
  }

  // Determine which space pill should be active based on current lightbox photo
  const activeLightboxSlug = lightboxOpen && photosWithDims[lightboxIndex]?.space
    ? photosWithDims[lightboxIndex].space
    : null

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') closeLightbox()
    if (e.key === 'ArrowRight') nextImage()
    if (e.key === 'ArrowLeft') prevImage()
  }

  // Touch swipe support
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    touchStartX.current = null
    touchStartY.current = null
    // Only swipe if horizontal movement is dominant and > 50px
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) nextImage()
      else prevImage()
    }
  }, [])

  return (
    <>
      {/* Photo tour Content - No wrap needed, already inside project-container */}
      <div id="photo-tour" className="photo-tour-content">
        <div className="section-header">
          <h2 className="arco-section-title">{t("photo_tour")}</h2>
        </div>

        {/* Category Tags — only show when photos have spaces */}
        {spaces.length > 0 && (
          <div className="category-tags">
            {categories.map(({ slug, label }) => (
              <button
                key={slug}
                className={`category-tag ${activeCategory === slug ? 'active' : ''}`}
                onClick={() => handleCategoryChange(slug)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

          {/* Photo Gallery — 6-col internal grid on desktop with a
              fixed row height. Portrait cells span 2 rows so they
              keep their tall shape; landscape variation cycles
              between 2 / 3 / 6 col widths inside a run.
              `grid-auto-flow: dense` packs items so the rows stay
              uniformly tall without leaving holes. Cells use
              object-fit:cover so photos crop to the cell rather than
              letterbox. */}
          <div className={`photo-gallery-grid ${showMore ? 'is-expanded' : ''}`}>
          {displayPhotos.map((photo, index) => {
            const { col, row, order } = allSpans[index]
            const m = allMobileSpans[index]
            return (
              <div
                key={photo.id}
                className="photo-cell"
                data-orientation={orientation(photo)}
                style={{
                  gridColumn: `span ${col}`,
                  gridRow: `span ${row}`,
                  order,
                  // Mobile spans are applied via CSS vars + a media
                  // query rule, so the mobile algorithm drives the
                  // layout independently of the desktop one.
                  ['--m-col' as string]: m.col,
                  ['--m-row' as string]: m.row,
                  ['--m-order' as string]: m.order,
                }}
                onClick={() => openLightbox(index)}
              >
                <Image
                  src={photo.url}
                  alt={photo.caption ?? 'Project photo'}
                  fill
                  className="photo-cell-img"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  onLoadingComplete={(img) => {
                    if ((!photo.width || !photo.height) && img.naturalWidth && img.naturalHeight) {
                      handleImgLoaded(photo.id, img.naturalWidth, img.naturalHeight)
                    }
                  }}
                />
              </div>
            )
          })}
        </div>

        {/* Show More/Less Buttons */}
        {remainingCount > 0 && (
          <div className="show-more-container">
            {!showMore ? (
              <button
                className="btn-tertiary"
                onClick={() => setShowMore(true)}
              >
                {t("more_photos")}
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                className="btn-tertiary"
                onClick={() => setShowMore(false)}
              >
                {t("less_photos")}
                <ChevronRight size={16} style={{ transform: "rotate(180deg)" }} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div 
          className="lightbox"
          onClick={closeLightbox}
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            {/* Close button */}
            <button 
              className="lightbox-close"
              onClick={closeLightbox}
              aria-label="Close"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6L18 18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Navigation arrows */}
            <button 
              className="lightbox-prev"
              onClick={prevImage}
              aria-label="Previous image"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M15 18L9 12L15 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            <button 
              className="lightbox-next"
              onClick={nextImage}
              aria-label="Next image"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M9 18L15 12L9 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Image — use the photo's native dimensions so the
                browser sizes correctly for both portrait and landscape
                without squishing. Falls back to 1920×1080 when
                dimensions are missing (legacy uploads). */}
            <div className="lightbox-image-container">
              <Image
                src={lightboxPhotos[lightboxIndex].url}
                alt={lightboxPhotos[lightboxIndex].caption ?? 'Project photo'}
                width={lightboxPhotos[lightboxIndex].width ?? 1920}
                height={lightboxPhotos[lightboxIndex].height ?? 1080}
                className="lightbox-image"
                priority
              />
            </div>

            {/* Space navigation pills — highlight based on current photo's space */}
            {spaces.length > 0 && (
              <div className="lightbox-categories">
                <div className="category-tags category-tags-dark">
                  {categories.filter(({ slug }) => slug !== ALL_SLUG).map(({ slug, label }) => (
                    <button
                      key={slug}
                      className={`category-tag category-tag-dark ${activeLightboxSlug === slug ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleLightboxSpaceNav(slug)
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Caption */}
            {lightboxPhotos[lightboxIndex].caption && (
              <div className="lightbox-caption">
                {lightboxPhotos[lightboxIndex].caption}
              </div>
            )}

            {/* Counter */}
            <div className="lightbox-counter">
              {lightboxIndex + 1} / {lightboxPhotos.length}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
