import { FAQPreview } from "./faq-preview"
import { DiscoverCardPreview } from "./discover-card-preview"

export const dynamic = "force-dynamic"

type GalleryCell = { kind: "L" | "P" | "Pano"; col: number; row: number; order?: number }
type GalleryCombo = { name: string; desc?: string; cells: GalleryCell[] }

const photoGalleryDesktopCombos: GalleryCombo[] = [
  { name: "Pano · 6×6", desc: "Full-width strip (aspect 2:1).", cells: [{ kind: "Pano", col: 6, row: 6 }] },
  // Pair patterns first — these fire ~75% of the time. PLL / LLP
  // triplets below are the ~25% variation for P+L+L / L+L+P runs.
  { name: "LP · 4×6 + 2×6", desc: "Wide L + portrait. Default visual order in alternation.", cells: [{ kind: "L", col: 4, row: 6 }, { kind: "P", col: 2, row: 6 }] },
  { name: "PL · 2×6 + 4×6", desc: "Same dims as LP, visual order flipped via CSS order. Alternates per pair.", cells: [{ kind: "P", col: 2, row: 6 }, { kind: "L", col: 4, row: 6 }] },
  { name: "LL · two 3×6", desc: "Two near-square cells, one row.", cells: [{ kind: "L", col: 3, row: 6 }, { kind: "L", col: 3, row: 6 }] },
  { name: "PP cropped · two 3×6", desc: "Mid-sequence P+P pair. Each P is cropped to a 1:1 square so the row fills cleanly (no mid-gap). Final-pair P+P keeps native 2×6 and accepts an end-gap.", cells: [{ kind: "P", col: 3, row: 6 }, { kind: "P", col: 3, row: 6 }] },
  { name: "PPLL · 2×6 + 4×6 (×2 rows)", desc: "[P, P, L, L] run packs as 2 interleaved LP pairs across 2 rows — P+L on row 1, P+L on row 2 — so the first P is not orphaned. Aspects preserved.", cells: [{ kind: "P", col: 2, row: 6 }, { kind: "L", col: 4, row: 6 }, { kind: "P", col: 2, row: 6 }, { kind: "L", col: 4, row: 6 }] },
  { name: "PPP · three 2×6", desc: "Three portraits side-by-side in one row.", cells: [{ kind: "P", col: 2, row: 6 }, { kind: "P", col: 2, row: 6 }, { kind: "P", col: 2, row: 6 }] },
  { name: "PLL · 3×12 + 3×6 + 3×6", desc: "25% chance: tall P + 2 stacked L. Otherwise renders as LP pair + full-width L.", cells: [{ kind: "P", col: 3, row: 12 }, { kind: "L", col: 3, row: 6 }, { kind: "L", col: 3, row: 6 }] },
  { name: "LLP · 3×6 + 3×6 + 3×12", desc: "25% chance: 2 stacked L + tall P (P rendered first via CSS order). Otherwise full-width L + LP pair.", cells: [{ kind: "L", col: 3, row: 6 }, { kind: "L", col: 3, row: 6 }, { kind: "P", col: 3, row: 12, order: -1 }] },
  { name: "Trailing L · 6×6", desc: "Stand-alone landscape becomes a full-width hero. Same cell as a Pano (aspect > 2.2). Also the mid-orphan P fallback (rare; trades 2:3 → 2:1 to avoid mid-gap).", cells: [{ kind: "L", col: 6, row: 6 }] },
  { name: "End-orphan P · 2×6", desc: "Only fires when the very last photo is a stand-alone P. Aspect preserved; end-gap to the right is acceptable per the no-mid-gap rule.", cells: [{ kind: "P", col: 2, row: 6 }] },
]

const photoGalleryMobileCombos: GalleryCombo[] = [
  { name: "Pano · 2×2", desc: "Panoramic spans the full row — preferred whenever a wide image is present (aspect > 2.2). Also fires for the gallery's first photo when it's a landscape and the next 4 photos form an LPPL interlock — opens the gallery with a statement hero.", cells: [{ kind: "Pano", col: 2, row: 2 }] },
  { name: "LL pair", desc: "Two square Ls side-by-side. 1 stripe = 2 row-units tall.", cells: [{ kind: "L", col: 1, row: 2 }, { kind: "L", col: 1, row: 2 }] },
  { name: "PP pair", desc: "Two portraits side-by-side. 1.5 stripes = 3 row-units tall.", cells: [{ kind: "P", col: 1, row: 3 }, { kind: "P", col: 1, row: 3 }] },
  { name: "LLL · LL pair + 2×2 hero", desc: "Long landscape runs break up with a Pano-style full-row L every 3rd photo (LL pair on the first stripe, 2×2 hero on the second). Skipped when the 4th photo is a P so the hero doesn't orphan it.", cells: [{ kind: "L", col: 1, row: 2 }, { kind: "L", col: 1, row: 2 }, { kind: "L", col: 2, row: 2 }] },
  { name: "L + P + P + L · 5 row-units", desc: "4 cells, 2 Ls + 2 Ps. Visual layout: L top-left, P top-right, P middle-left, L bottom-right. Each column = L (2) + P (3) = 5 row-units — clean interlock. Source order [L, P, L, P] also fires this via CSS order swap.", cells: [{ kind: "L", col: 1, row: 2 }, { kind: "P", col: 1, row: 3 }, { kind: "P", col: 1, row: 3 }, { kind: "L", col: 1, row: 2 }] },
  { name: "End single L · 2×2 hero", desc: "Stand-alone landscape at the gallery's tail goes full-row (Pano-style) so it doesn't sit lonely beside a column gap.", cells: [{ kind: "L", col: 2, row: 2 }] },
  { name: "End single P · 1×3", desc: "Portrait fallback for a stand-alone P at the tail.", cells: [{ kind: "P", col: 1, row: 3 }] },
]

const PHOTO_MOODS: Record<string, string> = {
  kitchen:
    "radial-gradient(120% 60% at 30% 20%, rgba(255,245,220,.55), transparent 55%)," +
    "radial-gradient(80% 60% at 70% 90%, rgba(120,90,60,.35), transparent 60%)," +
    "linear-gradient(180deg, #e2d7c1 0%, #b39775 55%, #6d4f34 100%)",
  bath:
    "radial-gradient(90% 50% at 20% 30%, rgba(220,235,245,.5), transparent 60%)," +
    "radial-gradient(70% 55% at 80% 85%, rgba(60,90,110,.4), transparent 60%)," +
    "linear-gradient(180deg, #c9d6dc 0%, #7a8f9b 60%, #3a4b57 100%)",
  living:
    "radial-gradient(100% 60% at 50% 15%, rgba(255,235,210,.45), transparent 55%)," +
    "radial-gradient(70% 50% at 20% 90%, rgba(90,60,40,.38), transparent 60%)," +
    "linear-gradient(180deg, #e6d9c2 0%, #b09371 55%, #6a4a30 100%)",
  bedroom:
    "radial-gradient(90% 50% at 40% 20%, rgba(255,220,220,.4), transparent 55%)," +
    "radial-gradient(70% 55% at 70% 90%, rgba(80,55,65,.35), transparent 60%)," +
    "linear-gradient(180deg, #e6cfc7 0%, #a8867a 60%, #4d3a35 100%)",
  exterior:
    "radial-gradient(100% 60% at 50% 15%, rgba(220,240,220,.4), transparent 55%)," +
    "radial-gradient(70% 55% at 30% 90%, rgba(45,65,40,.45), transparent 60%)," +
    "linear-gradient(180deg, #cee0c0 0%, #7fa06e 55%, #35502b 100%)",
  office:
    "radial-gradient(100% 60% at 60% 20%, rgba(230,235,245,.35), transparent 55%)," +
    "radial-gradient(60% 55% at 20% 90%, rgba(70,75,100,.4), transparent 60%)," +
    "linear-gradient(180deg, #d7ddea 0%, #6d7ba0 60%, #33395b 100%)",
}

// Bottom-flush black tile with the arco wordmark. Top corners rounded,
// bottom flush with the image edge — this is the shape emitted by the
// jimp compositor for every Pinterest pin and social share card.
//
// `pct` sizes the tile as a percentage of the containing card's width,
// so it stays proportional across viewport widths — pass this when the
// tile lives inside a responsive/masonry card. `size` gives an absolute
// pixel fallback for fixed-size demos.
function BrandedTile({
  size = 96,
  pct,
  radius = 12,
}: { size?: number; pct?: number; radius?: number }) {
  const dimensionStyle: React.CSSProperties = pct != null
    ? { width: `${pct}%`, aspectRatio: "1 / 1" }
    : { width: size, height: size }
  const radiusStyle = pct != null
    ? { borderRadius: "12% 12% 0 0" }
    : { borderRadius: `${radius}px ${radius}px 0 0` }
  return (
    <div style={{
      position: "absolute",
      right: "5%",
      bottom: 0,
      ...dimensionStyle,
      ...radiusStyle,
      background: "#000",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      filter: "drop-shadow(0 -2px 10px rgba(0,0,0,.22))",
    }}>
      <svg viewBox="26 90 184 55" xmlns="http://www.w3.org/2000/svg" aria-label="arco" style={{ width: "78%", height: "auto" }}>
        <path fill="#fff" d="M51.6904 92.6904C37.7704 92.6904 26.4804 104.12 26.6904 118.08C26.8904 131.4 37.7204 142.34 51.0404 142.68C56.1204 142.81 60.8604 141.42 64.8604 138.93V140.59C64.8604 141.34 65.4704 141.95 66.2204 141.95H75.3204C76.0704 141.95 76.6804 141.34 76.6804 140.59V117.69C76.6804 103.91 65.4704 92.6904 51.6804 92.6904H51.6904ZM51.6904 130.86C44.4304 130.86 38.5204 124.95 38.5204 117.69C38.5204 110.43 44.4304 104.52 51.6904 104.52C58.9504 104.52 64.8604 110.43 64.8604 117.69C64.8604 124.95 58.9504 130.86 51.6904 130.86Z" />
        <path fill="#fff" d="M121.55 98.8004L116.37 106.28C115.95 106.88 115.13 107.05 114.51 106.65C112.32 105.22 109.67 104.42 106.85 104.52C99.7198 104.78 94.1598 110.83 94.1598 117.97V140.59C94.1598 141.34 93.5498 141.95 92.7998 141.95H83.6998C82.9498 141.95 82.3398 141.34 82.3398 140.59V95.1204C82.3398 94.3704 82.9498 93.7604 83.6998 93.7604H92.7998C93.5498 93.7604 94.1598 94.3704 94.1598 95.1204V96.4504C97.9898 94.0704 102.5 92.6904 107.33 92.6904C112.45 92.6904 117.22 94.2404 121.19 96.8904C121.82 97.3104 121.98 98.1804 121.55 98.8004Z" />
        <path fill="#fff" d="M159.49 120.05C158.88 120.05 158.34 120.46 158.18 121.05C156.65 126.53 151.81 130.68 145.9 130.85C138.01 131.08 131.6 124.33 132.4 116.33C133.01 110.24 138.29 105.07 144.39 104.56C147.46 104.3 150.34 105.11 152.69 106.65C153.3 107.05 154.12 106.87 154.54 106.27L159.71 98.7902C160.14 98.1602 159.98 97.3002 159.35 96.8802C155.38 94.2302 150.62 92.6802 145.51 92.6802C137.86 92.6802 131.01 96.1302 126.42 101.55C125.96 102.09 125.53 102.64 125.12 103.21L124.78 103.71C122.08 107.7 120.5 112.51 120.5 117.67C120.5 123.81 122.72 129.44 126.42 133.8C131.01 139.22 137.86 142.67 145.51 142.67C153.16 142.67 160.01 139.22 164.6 133.8C167.48 130.39 169.47 126.2 170.2 121.6C170.33 120.78 169.68 120.04 168.85 120.04H159.49V120.05Z" />
        <path fill="#fff" d="M183.689 92.6904C176.049 92.6904 169.189 96.1404 164.599 101.56C161.879 104.77 159.959 108.69 159.139 112.99C158.979 113.82 159.639 114.59 160.479 114.59H169.939C170.529 114.59 171.039 114.21 171.229 113.65C172.959 108.5 177.639 104.67 183.309 104.52C191.199 104.3 197.609 111.06 196.789 119.07C196.169 125.15 190.889 130.31 184.799 130.81C181.739 131.06 178.869 130.26 176.519 128.73C175.909 128.33 175.089 128.51 174.669 129.11L169.489 136.59C169.059 137.22 169.219 138.08 169.849 138.5C174.129 141.35 179.329 142.92 184.909 142.66C197.679 142.05 208.039 131.68 208.649 118.91C209.339 104.57 197.869 92.6904 183.679 92.6904H183.689Z" />
      </svg>
    </div>
  )
}

function PhotoComboPreview({ combo, cols, unit, gap, autoFlow = "row" }: { combo: GalleryCombo; cols: number; unit: number; gap: number; autoFlow?: "row" | "dense" }) {
  const cellBg = (kind: GalleryCell["kind"]) => kind === "L" ? "#e8e8e6" : kind === "P" ? "#c4c4c2" : "#8b8b89"
  return (
    <div>
      <div className="arco-eyebrow" style={{ marginBottom: 10 }}>{combo.name}</div>
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, ${unit * 2}px)`,
        gridAutoRows: `${unit}px`,
        gridAutoFlow: autoFlow,
        gap: `${gap}px`,
        width: "fit-content",
        marginBottom: 10,
      }}>
        {combo.cells.map((cell, i) => (
          <div key={i} style={{
            gridColumn: `span ${cell.col}`,
            gridRow: `span ${cell.row}`,
            order: cell.order,
            background: cellBg(cell.kind),
            border: "1px solid #1c1c1a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            fontWeight: 500,
            color: "#1c1c1a",
            fontFamily: "monospace",
          }}>{cell.kind}</div>
        ))}
      </div>
      {combo.desc && <div className="arco-small-text" style={{ fontSize: 12 }}>{combo.desc}</div>}
    </div>
  )
}

export default function DesignPage() {
  const colors = [
    { name: "White", hex: "#FAFAF9", desc: "Main background for pages, cards, and content areas", border: true },
    { name: "Black", hex: "#1c1c1a", desc: "Primary text color, secondary buttons, active states" },
    { name: "Accent", hex: "#016D75", desc: "Primary buttons, link hovers, focus rings" },
    { name: "Surface", hex: "#f5f5f4", desc: "Elevated surfaces, card backgrounds" },
    { name: "Mid Gray", hex: "#6b6b68", desc: "Body text, descriptions" },
    { name: "Light Gray", hex: "#a1a1a0", desc: "Metadata, subtitles, disabled states" },
    { name: "Rule", hex: "#e5e5e4", desc: "Borders, dividers, separators" },
  ]

  const typography = [
    { name: "Hero", className: "arco-hero-title", specs: ".arco-hero-title · Serif, 400 · 42–72px (5.5vw) · ≤768 42px · ≤480 42px", preview: <h1 className="arco-hero-title">Exceptional architecture.<br/>Trusted professionals.</h1> },
    { name: "Page", className: "arco-page-title", specs: ".arco-page-title · Serif, 300 · 48px · ≤768 36px · ≤480 32px", preview: <h2 className="arco-page-title">The professional network architects trust</h2> },
    { name: "Section", className: "arco-section-title", specs: ".arco-section-title · Serif, 300 · 34px · ≤768 28px · ≤480 24px", preview: <h3 className="arco-section-title">Recent Projects</h3> },
    { name: "Sub-section", className: "arco-subsection-title", specs: ".arco-subsection-title · Serif, 300 · 26px · ≤768 22px · ≤480 20px", preview: <h3 className="arco-subsection-title">Curated Platform</h3> },
    { name: "Label", className: "arco-label", specs: ".arco-label · Sans, 500 · 15px", preview: <h4 className="arco-label">Primary Colors</h4> },
    { name: "Standard", className: "arco-card-title", specs: ".arco-card-title · Sans, 400 · 15px · Buttons, cards, input values", preview: <h4 className="arco-card-title">Contemporary Villa on the Amstel</h4> },
    { name: "Body", className: "arco-body-text", specs: ".arco-body-text · Sans, 300, Mid Gray · 15px", preview: <p className="arco-body-text">Arco is where leading architects publish their residential work and credential the professionals they collaborate with.</p> },
    { name: "Small", className: "arco-small-text", specs: ".arco-small-text · Sans, 400, Mid Gray · 14px", preview: <p className="arco-small-text">Footer links, captions, navigation, secondary information</p> },
    { name: "XS", className: "arco-xs-text", specs: ".arco-xs-text · Sans, 400, Mid Gray · 13px", preview: <p className="arco-xs-text">Filter pills, chips, load-more buttons, card subtitles</p> },
    { name: "Micro", className: "arco-micro-text", specs: ".arco-micro-text · Sans, 400, Mid Gray · 12px", preview: <p className="arco-micro-text">Status pills, badges, timestamps</p> },
    { name: "Eyebrow", className: "arco-eyebrow", specs: ".arco-eyebrow · Sans, 500, Uppercase · 11px", preview: <p className="arco-eyebrow">ARCHITECT · AMSTERDAM · 2024</p> },
  ]

  return (
    <div className="discover-page-title">
      <div className="wrap">
        <div style={{ maxWidth: 1200 }}>
          <h2 className="arco-page-title" style={{ marginBottom: 40 }}>Design system</h2>

          {/* COLORS */}
          <div style={{ marginBottom: 80 }}>
            <h2 className="arco-section-title" style={{ marginBottom: 24 }}>Color Palette</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 20 }}>
              {colors.map((c) => (
                <div key={c.hex}>
                  <div style={{ height: 100, background: c.hex, borderRadius: 6, marginBottom: 12, border: c.border ? "2px solid var(--rule)" : "1px solid var(--rule)" }} />
                  <div className="arco-card-title" style={{ marginBottom: 2 }}>{c.name}</div>
                  <div className="arco-eyebrow" style={{ marginBottom: 6 }}>{c.hex}</div>
                  <div className="arco-small-text">{c.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* TYPOGRAPHY */}
          <div style={{ marginBottom: 80 }}>
            <h2 className="arco-section-title" style={{ marginBottom: 24 }}>Typography</h2>
            <div>
              {typography.map((t, i) => (
                <div
                  key={t.className}
                  style={{
                    marginBottom: i === typography.length - 1 ? 0 : 32,
                    paddingBottom: i === typography.length - 1 ? 0 : 32,
                    borderBottom: i === typography.length - 1 ? "none" : "1px solid var(--rule)",
                  }}
                >
                  <div className="arco-card-title" style={{ marginBottom: 4 }}>{t.name}</div>
                  <div className="arco-eyebrow" style={{ marginBottom: 12 }}>{t.specs}</div>
                  {t.preview}
                </div>
              ))}
            </div>
          </div>

          {/* BUTTONS & LINKS */}
          <div style={{ marginBottom: 80 }}>
            <h2 className="arco-section-title" style={{ marginBottom: 24 }}>Buttons &amp; Links</h2>

            <div style={{ marginBottom: 48 }}>
              <h4 className="arco-label" style={{ marginBottom: 20 }}>Buttons</h4>
              <div style={{ background: "white", border: "1px solid var(--rule)", borderRadius: 6, padding: 40, marginBottom: 16 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", marginBottom: 24 }}>
                  <span className="arco-small-text" style={{ minWidth: 100 }}>Default</span>
                  <button className="btn-primary">Primary Button</button>
                  <button className="btn-secondary">Secondary Button</button>
                  <button className="btn-tertiary">Tertiary Button</button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
                  <span className="arco-small-text" style={{ minWidth: 100 }}>Disabled</span>
                  <button className="btn-primary" disabled>Primary Button</button>
                  <button className="btn-secondary" disabled>Secondary Button</button>
                  <button className="btn-tertiary" disabled>Tertiary Button</button>
                </div>
              </div>
              <div style={{ background: "var(--surface)", padding: "16px 20px", borderRadius: 6 }}>
                <p className="arco-small-text">
                  All buttons use <strong>Standard</strong> typography. Color differentiates role:<br />
                  <strong>.btn-primary</strong> — Teal bg, white text · <strong>.btn-secondary</strong> — Black bg, white text · <strong>.btn-tertiary</strong> — Transparent, rule border
                </p>
              </div>
            </div>

            <div>
              <h4 className="arco-label" style={{ marginBottom: 20 }}>Links</h4>
              <div style={{ background: "white", border: "1px solid var(--rule)", borderRadius: 6, padding: 40, marginBottom: 16 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  <div>
                    <div className="arco-eyebrow" style={{ marginBottom: 12 }}>Header links — .arco-header-link</div>
                    <div style={{ display: "flex", gap: 24 }}>
                      <a href="#" className="arco-header-link active">Projects</a>
                      <a href="#" className="arco-header-link">Professionals</a>
                    </div>
                  </div>
                  <div>
                    <div className="arco-eyebrow" style={{ marginBottom: 12 }}>Menu items — .arco-menu-item</div>
                    <div style={{ maxWidth: 220 }}>
                      <a href="#" className="arco-menu-item active">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
                        Listings
                      </a>
                      <a href="#" className="arco-menu-item">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                        Company
                      </a>
                    </div>
                  </div>
                  <div>
                    <div className="arco-eyebrow" style={{ marginBottom: 12 }}>Footer links — .footer-link</div>
                    <div style={{ background: "#1c1c1a", padding: "16px 20px", borderRadius: 4, display: "inline-flex", gap: 12 }}>
                      <a href="#" className="footer-link">About</a>
                      <span style={{ color: "#6b6b68" }}>·</span>
                      <a href="#" className="footer-link">Help Center</a>
                    </div>
                  </div>
                  <div>
                    <div className="arco-eyebrow" style={{ marginBottom: 12 }}>View all — .view-all-link</div>
                    <a href="#" className="view-all-link">View all projects →</a>
                  </div>
                  <div>
                    <div className="arco-eyebrow" style={{ marginBottom: 12 }}>Inline link</div>
                    <p className="arco-body-text" style={{ maxWidth: 600 }}>
                      Arco is where leading architects publish their work. We help <a href="#">discerning clients</a> discover exceptional teams.
                    </p>
                  </div>
                </div>
              </div>
              <div style={{ background: "var(--surface)", padding: "16px 20px", borderRadius: 6 }}>
                <p className="arco-small-text">
                  All links use <strong>Small</strong> typography. Differentiated by color and hover:<br />
                  <strong>.arco-header-link</strong> — Primary → Teal · <strong>.arco-menu-item</strong> — icon + text → Teal · <strong>.footer-link</strong> — Mid Gray → White · <strong>.view-all-link</strong> — Light Gray → Teal · <strong>Inline</strong> — Inherit, gray underline → Teal
                </p>
              </div>
            </div>
          </div>

          {/* FORM ELEMENTS */}
          <div style={{ marginBottom: 80 }}>
            <h2 className="arco-section-title" style={{ marginBottom: 24 }}>Form Elements</h2>
            <div>
              <h4 className="arco-label" style={{ marginBottom: 20 }}>Inputs</h4>
              <div style={{ background: "white", border: "1px solid var(--rule)", borderRadius: 6, padding: 40 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 500 }}>
                  <div>
                    <label className="arco-small-text" style={{ display: "block", marginBottom: 8 }}>Default Input</label>
                    <input type="text" placeholder="Enter text..." className="input-base input-default" style={{ width: "100%" }} />
                  </div>
                  <div>
                    <label className="arco-small-text" style={{ display: "block", marginBottom: 8 }}>Focused Input</label>
                    <input type="text" placeholder="Click to focus..." className="input-base" style={{ width: "100%", border: "1px solid var(--arco-black)" }} />
                  </div>
                  <div>
                    <label className="arco-small-text" style={{ display: "block", marginBottom: 8, color: "var(--destructive)" }}>Error Input</label>
                    <input type="text" placeholder="Invalid input..." className="input-base input-error" style={{ width: "100%" }} />
                    <p className="arco-small-text" style={{ marginTop: 4, color: "var(--destructive)" }}>This field is required</p>
                  </div>
                  <div>
                    <label className="arco-small-text" style={{ display: "block", marginBottom: 8 }}>Disabled Input</label>
                    <input type="text" placeholder="Disabled..." disabled className="input-base input-disabled" style={{ width: "100%" }} />
                  </div>
                  <div>
                    <label className="arco-small-text" style={{ display: "block", marginBottom: 8 }}>Textarea</label>
                    <textarea placeholder="Enter your message..." rows={3} className="input-base input-default" style={{ width: "100%", resize: "vertical" }} />
                  </div>
                  <div>
                    <label className="arco-small-text" style={{ display: "block", marginBottom: 8 }}>Select</label>
                    <select className="input-base input-default" style={{ width: "100%", cursor: "pointer" }}>
                      <option>Select a type...</option>
                      <option>Villa</option>
                      <option>Townhouse</option>
                      <option>Apartment</option>
                    </select>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 16, background: "var(--surface)", padding: "16px 20px", borderRadius: 6 }}>
                <p className="arco-small-text">
                  Values use <strong>Body</strong>, labels use <strong>Small</strong>. States: default (gray border) → focused (black) → error (red) → disabled (surface bg, 50% opacity).
                </p>
              </div>
            </div>
          </div>

          {/* PILLS & TAGS */}
          <div style={{ marginBottom: 80 }}>
            <h2 className="arco-section-title" style={{ marginBottom: 24 }}>Pills &amp; Tags</h2>

            <div style={{ marginBottom: 48 }}>
              <h4 className="arco-label" style={{ marginBottom: 20 }}>Status Pills</h4>
              <div style={{ background: "white", border: "1px solid var(--rule)", borderRadius: 6, padding: 40, marginBottom: 16 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  <span className="status-pill"><span className="status-pill-dot status-pill-dot--owner" />Owner</span>
                  <span className="status-pill"><span className="status-pill-dot status-pill-dot--featured" />Featured</span>
                  <span className="status-pill"><span className="status-pill-dot status-pill-dot--listed" />Listed</span>
                  <span className="status-pill"><span className="status-pill-dot status-pill-dot--invited" />Invited</span>
                  <span className="status-pill"><span className="status-pill-dot status-pill-dot--unlisted" />Unlisted</span>
                  <span className="status-pill"><span className="status-pill-dot status-pill-dot--pending" />Pending</span>
                  <span className="status-pill"><span className="status-pill-dot status-pill-dot--draft" />Draft</span>
                  <span className="status-pill"><span className="status-pill-dot status-pill-dot--removed" />Removed</span>
                  <span className="status-pill"><span className="status-pill-dot status-pill-dot--rejected" />Rejected</span>
                </div>
              </div>
              <div style={{ background: "var(--surface)", padding: "16px 20px", borderRadius: 6 }}>
                <p className="arco-small-text">Uses <strong>Micro</strong> typography. 7px dot, rule border, 24px radius. Dot color varies by variant.</p>
              </div>
            </div>

            <div style={{ marginBottom: 48 }}>
              <h4 className="arco-label" style={{ marginBottom: 20 }}>Inline Pills</h4>
              <div style={{ background: "white", border: "1px solid var(--rule)", borderRadius: 6, padding: 40, marginBottom: 16 }}>
                {/* Three groups: the standard status-pill variants (with /
                    without a dot, default grey outline), and the four
                    semantic colour variants (blue / green / orange / red).
                    Mirrors how inline pills render in /admin/companies,
                    /admin/sales, etc. */}
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  {/* Status pills — pair the label with one or more pills. */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <span className="arco-eyebrow" style={{ color: "#a1a1a0" }}>Status pills</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="arco-table-primary">Cloud Nine</span>
                      <span className="status-pill"><span className="status-pill-dot status-pill-dot--featured" />Featured</span>
                      <span className="status-pill">Owner</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="arco-table-primary">Welcome</span>
                      <span className="status-pill"><span className="status-pill-dot status-pill-dot--draft" />Draft</span>
                      <span className="status-pill">Day 0</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="arco-table-primary">Wolterinck</span>
                      <span className="status-pill"><span className="status-pill-dot status-pill-dot--listed" />Listed</span>
                      <span className="status-pill"><span className="status-pill-dot status-pill-dot--invited" />Invited</span>
                      <span className="status-pill"><span className="status-pill-dot status-pill-dot--unlisted" />Unlisted</span>
                    </div>
                  </div>

                  {/* Coloured pills — tags, not status. */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <span className="arco-eyebrow" style={{ color: "#a1a1a0" }}>Coloured pills</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span className="status-pill status-pill--blue">Day 0</span>
                      <span className="status-pill status-pill--blue">Day 1</span>
                      <span className="status-pill status-pill--blue">Day 7</span>
                      <span className="status-pill status-pill--green">Sent</span>
                      <span className="status-pill status-pill--orange">Beta</span>
                      <span className="status-pill status-pill--red">New</span>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ background: "var(--surface)", padding: "16px 20px", borderRadius: 6 }}>
                <p className="arco-small-text">
                  All variants share the <code>.status-pill</code> base — 10px / 2-8 padding / 12px radius, transparent background. <strong>Status pills</strong> use a <code>.status-pill-dot</code> + a <code>--state</code> modifier inside (Featured, Listed, Invited, Draft, Unlisted, Owner) — these represent a state. <strong>Coloured pills</strong> use a <code>.status-pill--colour</code> modifier (<code>blue</code> / <code>green</code> / <code>orange</code> / <code>red</code>) for a coloured border + matching text — use these for tags / markers (Day 1, Day 7, Sent count, etc.), not for status. Sit immediately after the label they annotate (8px gap, no tab).
                </p>
              </div>
            </div>

            <div>
              <h4 className="arco-label" style={{ marginBottom: 20 }}>Category Tags</h4>
              <div style={{ background: "white", border: "1px solid var(--rule)", borderRadius: 6, padding: 40, marginBottom: 16 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  <button className="category-tag active">All</button>
                  <button className="category-tag">Exterior</button>
                  <button className="category-tag">Living</button>
                  <button className="category-tag">Kitchen</button>
                  <button className="category-tag">Bedroom</button>
                  <button className="category-tag">Bathroom</button>
                </div>
              </div>
              <div style={{ background: "var(--surface)", padding: "16px 20px", borderRadius: 6 }}>
                <p className="arco-small-text">Uses <strong>Small</strong> typography (400 inactive, 500 active). Active: black fill, white text. Inactive: transparent, rule border → black on hover.</p>
              </div>
            </div>
          </div>

          {/* FILTERS */}
          <div style={{ marginBottom: 80 }}>
            <h2 className="arco-section-title" style={{ marginBottom: 24 }}>Filters</h2>

            <div style={{ marginBottom: 48 }}>
              <h4 className="arco-label" style={{ marginBottom: 20 }}>Filter Pills</h4>
              <div style={{ background: "white", border: "1px solid var(--rule)", borderRadius: 6, padding: 40, marginBottom: 16 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 24 }}>
                  <span className="arco-small-text" style={{ minWidth: 80 }}>Default</span>
                  <button className="filter-pill">All filters</button>
                  <button className="filter-pill">Space</button>
                  <button className="filter-pill">Location</button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 24 }}>
                  <span className="arco-small-text" style={{ minWidth: 80 }}>Active</span>
                  <button className="filter-pill" data-active="true">All filters<span className="filter-pill-badge">3</span></button>
                  <button className="filter-pill" data-active="true">Kitchen</button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                  <span className="arco-small-text" style={{ minWidth: 80 }}>With divider</span>
                  <button className="filter-pill">All filters</button>
                  <div className="filter-pill-divider" />
                  <button className="filter-pill">Type</button>
                </div>
              </div>
              <div style={{ background: "var(--surface)", padding: "16px 20px", borderRadius: 6 }}>
                <p className="arco-small-text">Uses <strong>XS</strong> typography. Rounded-full, rule border → black on active. Badge uses <strong>Micro</strong>.</p>
              </div>
            </div>

            <div>
              <h4 className="arco-label" style={{ marginBottom: 20 }}>Active Filter Chips</h4>
              <div style={{ background: "white", border: "1px solid var(--rule)", borderRadius: 6, overflow: "hidden", marginBottom: 16 }}>
                <div className="discover-chip-strip">
                  <div style={{ padding: "0 40px" }}>
                    <div className="discover-chip-strip-inner">
                      <button className="filter-chip">Kitchen <span className="filter-chip-close" aria-hidden="true">✕</span></button>
                      <button className="filter-chip">Amsterdam <span className="filter-chip-close" aria-hidden="true">✕</span></button>
                      <button className="filter-chip">Villa <span className="filter-chip-close" aria-hidden="true">✕</span></button>
                      <button className="filter-chip-clear-all">Clear all</button>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ background: "var(--surface)", padding: "16px 20px", borderRadius: 6 }}>
                <p className="arco-small-text">Uses <strong>Micro</strong> typography (500 weight). Black bg, white text, pill with ✕. Clear all: plain text button.</p>
              </div>
            </div>
          </div>

          {/* DISCOVER CARDS */}
          <div style={{ marginBottom: 80 }}>
            <h2 className="arco-section-title" style={{ marginBottom: 24 }}>Discover Cards</h2>

            <div>
              <h4 className="arco-label" style={{ marginBottom: 20 }}>Discover Grid</h4>
              <div style={{ background: "white", border: "1px solid var(--rule)", borderRadius: 6, padding: 40, marginBottom: 16 }}>
                <DiscoverCardPreview />
              </div>
              <div style={{ background: "var(--surface)", padding: "16px 20px", borderRadius: 6 }}>
                <p className="arco-small-text">
                  Live render of <code>.discover-card</code> — hover any card to see the photo nav arrows + dots and the save / share buttons. Both arrows and the heart toggle are fully wired in the preview so the scroll UX is verifiable, not just visual.<br />
                  Spacing uses <code>--grid-gap</code> (20px desktop · 16px iPad · 12px mobile), matching <code>/projects</code> exactly. Title <strong>Standard</strong>, subtitle <strong>XS</strong>. Image 4:3, 3px radius. Save fills red on toggle.
                </p>
              </div>
            </div>
          </div>

          {/* SECTION HEADERS */}
          <div style={{ marginBottom: 80 }}>
            <h2 className="arco-section-title" style={{ marginBottom: 24 }}>Section Headers</h2>
            <div>
              <h4 className="arco-label" style={{ marginBottom: 20 }}>Header with View All</h4>
              <div style={{ background: "white", border: "1px solid var(--rule)", borderRadius: 6, padding: 40, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <h2 className="arco-section-title">Recently Published</h2>
                  <a href="#" className="view-all-link">View all projects →</a>
                </div>
              </div>
              <div style={{ background: "var(--surface)", padding: "16px 20px", borderRadius: 6 }}>
                <p className="arco-small-text">Title uses <strong>Section</strong>. Action uses <strong>Small</strong> (.view-all-link, Light Gray → Teal).</p>
              </div>
            </div>
          </div>

          {/* LAYOUT COMPONENTS */}
          <div style={{ marginBottom: 80 }}>
            <h2 className="arco-section-title" style={{ marginBottom: 24 }}>Layout Components</h2>

            <div style={{ marginBottom: 48 }}>
              <h4 className="arco-label" style={{ marginBottom: 20 }}>How It Works Grid</h4>
              <div style={{ background: "var(--surface)", padding: 40, borderRadius: 6, marginBottom: 16 }}>
                <div className="how-grid">
                  <div className="how-card">
                    <div className="how-number">01</div>
                    <h3 className="how-title">First Step</h3>
                    <p className="how-body">This demonstrates the how-grid layout with proper spacing and typography.</p>
                  </div>
                  <div className="how-card">
                    <div className="how-number">02</div>
                    <h3 className="how-title">Second Step</h3>
                    <p className="how-body">Three-column grid with 40px gap, stacks on mobile.</p>
                  </div>
                  <div className="how-card">
                    <div className="how-number">03</div>
                    <h3 className="how-title">Third Step</h3>
                    <p className="how-body">Numbered cards with step-by-step content.</p>
                  </div>
                </div>
              </div>
              <div style={{ background: "var(--surface)", padding: "16px 20px", borderRadius: 6 }}>
                <p className="arco-small-text">
                  .how-number uses <strong>Section</strong> (serif). .how-title uses <strong>Label</strong>. .how-body uses <strong>Body</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div style={{ marginBottom: 80 }}>
            <h2 className="arco-section-title" style={{ marginBottom: 24 }}>FAQ</h2>
            <div style={{ background: "white", border: "1px solid var(--rule)", borderRadius: 6, padding: 40, marginBottom: 16 }}>
              <FAQPreview />
            </div>
            <div style={{ background: "var(--surface)", padding: "16px 20px", borderRadius: 6 }}>
              <p className="arco-small-text">
                Question uses <strong>Standard</strong> (15px, 400) → Teal on hover. Answer uses <strong>Body</strong>. Each item has a top + bottom rule; the <code>+</code> toggle rotates 45° when active and the answer animates open via <code>max-height</code>. Source: <code>FAQSection</code> in <code>components/landing</code>, items from <code>businesses/architects/data.ts</code>.
              </p>
            </div>
          </div>

          {/* POPUPS */}
          <div style={{ marginBottom: 80 }}>
            <h2 className="arco-section-title" style={{ marginBottom: 24 }}>Popups</h2>

            <div style={{ marginBottom: 48 }}>
              <h4 className="arco-label" style={{ marginBottom: 20 }}>Popup Card</h4>
              <div style={{ background: "rgba(0,0,0,0.08)", border: "1px solid var(--rule)", borderRadius: 6, padding: 40, display: "flex", justifyContent: "center", marginBottom: 16 }}>
                <div className="popup-card" style={{ position: "relative", maxWidth: 380, width: "100%" }}>
                  <div className="popup-header">
                    <h3 className="arco-section-title">Popup Title</h3>
                    <button type="button" className="popup-close" style={{ cursor: "default" }}>✕</button>
                  </div>
                  <p className="arco-body-text" style={{ marginBottom: 20 }}>
                    This is the standard popup card layout with header, close button, content area, and action buttons.
                  </p>
                  <div className="popup-actions">
                    <button type="button" className="btn-tertiary" style={{ flex: 1 }}>Cancel</button>
                    <button type="button" className="btn-secondary" style={{ flex: 1 }}>Save</button>
                  </div>
                </div>
              </div>
              <div style={{ background: "var(--surface)", padding: "16px 20px", borderRadius: 6 }}>
                <p className="arco-small-text">Title uses <strong>Section</strong>. Content uses <strong>Body</strong>. Buttons use <strong>Standard</strong>. White bg, 12px radius, 28px padding.</p>
              </div>
            </div>

            <div>
              <h4 className="arco-label" style={{ marginBottom: 20 }}>Status Modal</h4>
              <div style={{ background: "rgba(0,0,0,0.08)", border: "1px solid var(--rule)", borderRadius: 6, padding: 40, display: "flex", justifyContent: "center", marginBottom: 16 }}>
                <div className="popup-card" style={{ position: "relative", maxWidth: 380, width: "100%" }}>
                  <div className="popup-header">
                    <h3 className="arco-section-title">Update status</h3>
                    <button type="button" className="popup-close" style={{ cursor: "default" }}>✕</button>
                  </div>
                  <div className="status-modal-options">
                    <button type="button" className="status-modal-option selected" style={{ cursor: "default" }}>
                      <span className="status-modal-dot" style={{ background: "#22c55e" }} />
                      <div className="status-modal-option-text">
                        <span className="status-modal-option-label">Published</span>
                        <span className="status-modal-option-desc">Visible to everyone on Arco</span>
                      </div>
                    </button>
                    <button type="button" className="status-modal-option" style={{ cursor: "default" }}>
                      <span className="status-modal-dot" style={{ background: "#a1a1a0" }} />
                      <div className="status-modal-option-text">
                        <span className="status-modal-option-label">Unlisted</span>
                        <span className="status-modal-option-desc">Only people with the link can view</span>
                      </div>
                    </button>
                  </div>
                  <div className="popup-actions">
                    <button type="button" className="btn-tertiary" style={{ flex: 1 }}>Cancel</button>
                    <button type="button" className="btn-secondary" style={{ flex: 1 }}>Save</button>
                  </div>
                </div>
              </div>
              <div style={{ background: "var(--surface)", padding: "16px 20px", borderRadius: 6 }}>
                <p className="arco-small-text">Option label uses <strong>Small</strong> (500 weight). Description uses <strong>XS</strong>. 10px dot indicator. Selected: 2px black border, surface bg.</p>
              </div>
            </div>
          </div>

          {/* ALERTS */}
          <div style={{ marginBottom: 80 }}>
            <h2 className="arco-section-title" style={{ marginBottom: 24 }}>Alerts</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              <div className="arco-alert arco-alert--info">
                <svg className="arco-alert-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="8" r="7" /><path d="M8 7v4" /><circle cx="8" cy="4.5" r="0.5" fill="currentColor" stroke="none" />
                </svg>
                <div><strong>Info:</strong> Your project is under review by the Arco team. We'll email you once the review is complete.</div>
              </div>

              <div className="arco-alert arco-alert--warn">
                <svg className="arco-alert-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 1L1 14h14L8 1z" /><path d="M8 6v3" /><circle cx="8" cy="11.5" r="0.5" fill="currentColor" stroke="none" />
                </svg>
                <div><strong>23 photos are below the recommended resolution</strong> (1600 × 800px). Low-resolution images may be rejected during review.</div>
              </div>

              <div className="arco-alert arco-alert--danger">
                <svg className="arco-alert-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="8" r="7" /><path d="M10 6L6 10" /><path d="M6 6l4 4" />
                </svg>
                <div><strong>This action cannot be undone.</strong> Deleting this brand will permanently remove all products and photos.</div>
              </div>

              <div className="arco-alert arco-alert--success">
                <svg className="arco-alert-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="8" r="7" /><path d="M5 8l2 2 4-4" />
                </svg>
                <div><strong>Project published.</strong> Your project is now live and visible to homeowners across the Netherlands.</div>
              </div>
            </div>

            <div style={{ background: "var(--surface)", padding: "16px 20px", borderRadius: 6 }}>
              <p className="arco-small-text">
                Uses <strong>XS</strong> typography. 4 variants: .arco-alert--info (blue), .arco-alert--warn (amber), .arco-alert--danger (red), .arco-alert--success (green).<br />
                16px icon + text content. 12px 16px padding, 6px radius, 1px colored border.
              </p>
            </div>
          </div>

          {/* DATA TABLE */}
          <div style={{ marginBottom: 80 }}>
            <h2 className="arco-section-title" style={{ marginBottom: 24 }}>Data Table</h2>

            <div style={{ marginBottom: 48 }}>
              <h4 className="arco-label" style={{ marginBottom: 20 }}>Table</h4>
              <div className="arco-table-wrap" style={{ marginBottom: 16 }}>
                <table className="arco-table">
                  <thead>
                    <tr>
                      <th style={{ width: 32, paddingRight: 0 }}>
                        <input type="checkbox" className="arco-table-checkbox" />
                      </th>
                      <th>
                        <button className="arco-table-sort">
                          Company
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 15l5 5 5-5" /><path d="M7 9l5-5 5 5" /></svg>
                        </button>
                      </th>
                      <th>
                        <button className="arco-table-sort">
                          Domain
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 15l5 5 5-5" /><path d="M7 9l5-5 5 5" /></svg>
                        </button>
                      </th>
                      <th>
                        <button className="arco-table-sort">
                          Status
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 15l5 5 5-5" /><path d="M7 9l5-5 5 5" /></svg>
                        </button>
                      </th>
                      <th>
                        <button className="arco-table-sort">
                          Owner
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 15l5 5 5-5" /><path d="M7 9l5-5 5 5" /></svg>
                        </button>
                      </th>
                      <th>
                        <button className="arco-table-sort">
                          Project
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 15l5 5 5-5" /><path d="M7 9l5-5 5 5" /></svg>
                        </button>
                      </th>
                      <th>
                        <button className="arco-table-sort">
                          Created
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 15l5 5 5-5" /><path d="M7 9l5-5 5 5" /></svg>
                        </button>
                      </th>
                      <th style={{ width: 40 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {/* Row 1: Featured company with icon */}
                    <tr>
                      <td style={{ paddingRight: 0 }}><input type="checkbox" className="arco-table-checkbox" /></td>
                      <td style={{ paddingLeft: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1.5" style={{ flexShrink: 0 }}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                          <div className="arco-table-avatar" style={{ background: "#1c1c1a", color: "#fff" }}>W</div>
                          <div style={{ minWidth: 0 }}>
                            <div className="arco-table-primary arco-table-primary--wrap">Wolterinck</div>
                            <div className="arco-table-secondary">Architect +2 · Laren</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          askolli.com
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></svg>
                        </div>
                      </td>
                      <td>
                        <span className="arco-table-status">
                          <span className="arco-table-status-dot" style={{ background: "#f59e0b" }} />
                          Prospected
                        </span>
                      </td>
                      <td>niek@arcolist.com</td>
                      <td>
                        {/* Three inline-pill variants, as they render in the live
                            /admin/companies table. See Pills & Tags → Inline Pills
                            for the canonical examples. */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "nowrap" }}>
                          <span className="arco-table-status">
                            <span className="arco-table-status-dot" style={{ background: "#22c55e" }} />
                            Penthouse Amsterdam Z...
                          </span>
                          {/* With status dot — dot pill, full size (12px) */}
                          <span className="status-pill"><span className="status-pill-dot status-pill-dot--featured" />Featured</span>
                          {/* Coloured outline — blue border + text, no dot (compact) */}
                          <span className="status-pill" style={{ borderColor: "#bfdbfe", color: "#2563eb" }}>Day 0</span>
                          {/* Grey outline — default border, no dot (compact) */}
                          <span className="status-pill">Owner</span>
                        </div>
                      </td>
                      <td className="arco-table-nowrap">05 Apr 2026</td>
                      <td style={{ textAlign: "center" }}>
                        <button className="arco-table-action">···</button>
                      </td>
                    </tr>
                    {/* Row 2: Company with logo */}
                    <tr>
                      <td style={{ paddingRight: 0 }}><input type="checkbox" className="arco-table-checkbox" /></td>
                      <td style={{ paddingLeft: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c4c4c2" strokeWidth="1.5" style={{ flexShrink: 0 }}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                          <div className="arco-table-avatar" style={{ background: "#f5f5f4", color: "#6b6b68" }}>S</div>
                          <div style={{ minWidth: 0 }}>
                            <div className="arco-table-primary arco-table-primary--wrap">STATE Of Architecture</div>
                            <div className="arco-table-secondary">Architect · Eindhoven</div>
                          </div>
                        </div>
                      </td>
                      <td>statearchitecture.nl</td>
                      <td>
                        <span className="arco-table-status">
                          <span className="arco-table-status-dot" style={{ background: "#7c3aed" }} />
                          Listed
                        </span>
                      </td>
                      <td>info@statearchitecture.nl</td>
                      <td>
                        <span className="arco-table-status">
                          <span className="arco-table-status-dot" style={{ background: "#22c55e" }} />
                          Forest Retreat Villa W...
                        </span>
                      </td>
                      <td className="arco-table-nowrap">01 Mar 2026</td>
                      <td style={{ textAlign: "center" }}>
                        <button className="arco-table-action">···</button>
                      </td>
                    </tr>
                    {/* Row 3: Draft company, no project */}
                    <tr>
                      <td style={{ paddingRight: 0 }}><input type="checkbox" className="arco-table-checkbox" /></td>
                      <td style={{ paddingLeft: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c4c4c2" strokeWidth="1.5" style={{ flexShrink: 0 }}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                          <div className="arco-table-avatar" style={{ background: "#f5f5f4", color: "#6b6b68" }}>P</div>
                          <div style={{ minWidth: 0 }}>
                            <div className="arco-table-primary arco-table-primary--wrap">pham</div>
                            <div className="arco-table-secondary">Interior designer · Amsterdam</div>
                          </div>
                        </div>
                      </td>
                      <td>pham.nl</td>
                      <td>
                        <span className="arco-table-status">
                          <span className="arco-table-status-dot" style={{ background: "#2563eb" }} />
                          Draft
                        </span>
                      </td>
                      <td>—</td>
                      <td>—</td>
                      <td className="arco-table-nowrap">15 Feb 2026</td>
                      <td style={{ textAlign: "center" }}>
                        <button className="arco-table-action">···</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ background: "var(--surface)", padding: "16px 20px", borderRadius: 6 }}>
                <p className="arco-small-text">
                  All table text is <strong>Micro</strong> (12px). Headers: 500 weight, Mid Gray. Primary cells: 500 weight. Secondary cells: 400 weight, Mid Gray.<br />
                  Star: 14px, amber fill when featured, light gray outline when not. Avatar: 32px circle, initials or logo image.<br />
                  Status dot: 7px circle — only used for color-coded statuses. Pills without a dot (e.g. Owner) omit the dot. Hover: surface bg.
                </p>
              </div>
            </div>

            <div>
              <h4 className="arco-label" style={{ marginBottom: 20 }}>Pagination</h4>
              <div style={{ background: "white", border: "1px solid var(--rule)", borderRadius: 6, padding: "16px 20px", marginBottom: 16 }}>
                <div className="arco-table-pagination">
                  <span className="arco-table-pagination-count">26 results</span>
                  <div className="arco-table-pagination-nav">
                    <span className="arco-table-pagination-info">Page 1 of 2</span>
                    <button className="arco-table-pagination-btn" disabled>←</button>
                    <button className="arco-table-pagination-btn">→</button>
                  </div>
                </div>
              </div>
              <div style={{ background: "var(--surface)", padding: "16px 20px", borderRadius: 6 }}>
                <p className="arco-small-text">
                  Count and page info use <strong>Micro</strong> (Mid Gray). Arrow buttons: rule border, 28px square.
                </p>
              </div>
            </div>
          </div>

          {/* INLINE EDIT — `.spec-item-edit` */}
          <div style={{ marginBottom: 80 }}>
            <h2 className="arco-section-title" style={{ marginBottom: 24 }}>Inline edit cells</h2>
            <p className="arco-body-text" style={{ marginBottom: 24, maxWidth: 720 }}>
              Used inside <code>.specifications-bar</code> on detail bars (project edit, account, company settings).
              Hover and editing render identically — a charcoal outline that punches through the bar&rsquo;s top/bottom
              rules. The value <code>{`<div>`}</code> swaps for an <code>{`<input>`}</code> when editing; the input
              matches the div&rsquo;s metrics (15/400/1.3) so the cell does not shift on click. The outline&rsquo;s
              vertical inset matches the bar&rsquo;s padding (32px) — bump both together if you change one.
            </p>
            <div style={{ background: "white", border: "1px solid var(--rule)", borderRadius: 6, padding: "40px 40px 24px" }}>
              <div className="specifications-bar" style={{ marginBottom: 0 }}>
                <div className="spec-item-edit">
                  <span className="ec-badge">
                    <span className="ec-ico">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5Z" />
                      </svg>
                    </span>
                    <span className="ec-txt">Edit</span>
                  </span>
                  <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>Hover me</span>
                  <div className="arco-card-title">Bussum</div>
                </div>
                <div className="spec-item-edit editing">
                  <span className="ec-badge">
                    <span className="ec-ico">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5Z" />
                      </svg>
                    </span>
                    <span className="ec-txt">Edit</span>
                  </span>
                  <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>Editing state</span>
                  <input className="spec-inp" defaultValue="Search city…" />
                </div>
                <div className="spec-item-edit">
                  <span className="ec-badge">
                    <span className="ec-ico">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5Z" />
                      </svg>
                    </span>
                    <span className="ec-txt">Edit</span>
                  </span>
                  <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>Empty</span>
                  <div className="arco-card-title" style={{ color: "#b0b0ae" }}>Add phone</div>
                </div>
              </div>
              <p className="arco-small-text" style={{ marginTop: 32, color: "var(--text-secondary)" }}>
                Markup: <code>{`<div class="specifications-bar">`}</code> →{" "}
                <code>{`<div class="spec-item-edit [editing]">`}</code> with <code>.ec-badge</code>,{" "}
                <code>.spec-eyebrow</code>, and either a value <code>{`<div>`}</code> or a{" "}
                <code>.spec-inp</code>.
              </p>
            </div>
          </div>

          {/* BRANDED IMAGES */}
          <div style={{ marginBottom: 80 }}>
            <h2 className="arco-section-title" style={{ marginBottom: 24 }}>Branded images</h2>
            <p className="arco-body-text" style={{ marginBottom: 32, maxWidth: 720 }}>
              Composite images produced once on project publish and reused across channels.
              The compositor branches on source photo orientation: portrait → 2:3 Pinterest pin,
              landscape or square → 1:1 Pinterest pin, plus a 1200 × 630 rendition that serves
              as the project&rsquo;s <code>og:image</code> on Facebook / LinkedIn / iMessage.
              Same badge geometry on every output — the brand mark reads consistently regardless
              of where the image lands.
            </p>

            <h4 className="arco-label" style={{ marginBottom: 20 }}>Aspect ratios</h4>
            <div style={{ background: "white", border: "1px solid var(--rule)", borderRadius: 6, padding: 40, marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
                <div>
                  <div style={{
                    position: "relative", aspectRatio: "2/3", borderRadius: 4, overflow: "hidden",
                    background:
                      "radial-gradient(120% 60% at 30% 20%, rgba(255,245,220,.55), transparent 55%)," +
                      "radial-gradient(80% 60% at 70% 90%, rgba(120,90,60,.35), transparent 60%)," +
                      "linear-gradient(180deg, #e2d7c1 0%, #b39775 55%, #6d4f34 100%)",
                  }}>
                    <BrandedTile pct={16} />
                  </div>
                  <div className="arco-eyebrow" style={{ marginTop: 10 }}>Portrait pin · 1000 × 1500</div>
                </div>
                <div>
                  <div style={{
                    position: "relative", aspectRatio: "1/1", borderRadius: 4, overflow: "hidden",
                    background:
                      "radial-gradient(100% 60% at 50% 15%, rgba(255,235,210,.45), transparent 55%)," +
                      "radial-gradient(70% 50% at 20% 90%, rgba(90,60,40,.38), transparent 60%)," +
                      "linear-gradient(180deg, #e6d9c2 0%, #b09371 55%, #6a4a30 100%)",
                  }}>
                    <BrandedTile pct={16} />
                  </div>
                  <div className="arco-eyebrow" style={{ marginTop: 10 }}>Square pin · 1000 × 1000</div>
                </div>
                <div>
                  <div style={{
                    position: "relative", aspectRatio: "1200/630", borderRadius: 4, overflow: "hidden",
                    background:
                      "radial-gradient(90% 50% at 20% 30%, rgba(220,235,245,.5), transparent 60%)," +
                      "radial-gradient(70% 55% at 80% 85%, rgba(60,90,110,.4), transparent 60%)," +
                      "linear-gradient(180deg, #c9d6dc 0%, #7a8f9b 60%, #3a4b57 100%)",
                  }}>
                    <BrandedTile pct={16} />
                  </div>
                  <div className="arco-eyebrow" style={{ marginTop: 10 }}>Social og:image · 1200 × 630</div>
                </div>
              </div>
            </div>
            <div style={{ background: "var(--surface)", padding: "16px 20px", borderRadius: 6, marginBottom: 48 }}>
              <p className="arco-small-text">
                Badge: fixed black tile, ~130px wide in production output, flush to bottom edge,
                top corners rounded 12px, ~5% right inset. Same absolute pixel width across all
                three aspect ratios so the mark reads at consistent visual weight. Compositor:
                <code> lib/pinterest/composeBrandedImage.ts</code> (jimp), output persisted to
                <code> project-media/pins/type/{"{project_id}"}.jpg</code>,
                <code> project-media/pins/space/{"{feature_id}"}.jpg</code>,
                <code> project-media/social/{"{project_id}"}.jpg</code>.
              </p>
            </div>

            <h4 className="arco-label" style={{ marginBottom: 20 }}>On a Pinterest board</h4>
            <div style={{ background: "white", border: "1px solid var(--rule)", borderRadius: 6, padding: 32, marginBottom: 16 }}>
              <div style={{ columns: 4, columnGap: 12 }}>
                {[
                  { aspect: "2/3", grad: "kitchen" },
                  { aspect: "3/4", grad: "bath" },
                  { aspect: "1/1", grad: "living" },
                  { aspect: "1/1", grad: "bedroom" },
                  { aspect: "2/3", grad: "exterior" },
                  { aspect: "1/1", grad: "office" },
                  { aspect: "2/3", grad: "kitchen" },
                  { aspect: "3/4", grad: "living" },
                  { aspect: "4/5", grad: "bath" },
                  { aspect: "2/3", grad: "bedroom" },
                  { aspect: "1/1", grad: "exterior" },
                  { aspect: "2/3", grad: "office" },
                ].map((p, i) => (
                  <div
                    key={i}
                    style={{
                      display: "block",
                      breakInside: "avoid",
                      marginBottom: 12,
                      position: "relative",
                      borderRadius: 8,
                      overflow: "hidden",
                      aspectRatio: p.aspect,
                      background: PHOTO_MOODS[p.grad],
                    }}
                  >
                    <BrandedTile pct={22} />
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: "var(--surface)", padding: "16px 20px", borderRadius: 6 }}>
              <p className="arco-small-text">
                Portrait 2:3 pins get more feed real estate on Pinterest; square 1:1 pins preserve
                the composition of landscape source photos where a 2:3 crop would strip 60% of the
                width. Masonry grid absorbs the mix — the bottom-anchored badge stays at consistent
                geometry across formats so the board still reads as one cohesive Arco surface.
                Every pin, regardless of aspect, links to the same <code>/projects/{"{slug}"}</code>.
              </p>
            </div>
          </div>

          {/* PHOTO GALLERY LAYOUTS */}
          <div style={{ marginBottom: 80 }}>
            <h2 className="arco-section-title" style={{ marginBottom: 24 }}>Photo gallery layouts</h2>
            <p className="arco-body-text" style={{ marginBottom: 32, maxWidth: 720 }}>
              The project photo tour assigns grid spans based on photo orientation —
              <strong> L</strong> = landscape (aspect 0.9–2.2), <strong> P</strong> = portrait (aspect &lt; 0.9),
              <strong> Pano</strong> = panoramic (aspect &gt; 2.2). Desktop / iPad share a 6-col grid where the
              row-unit equals ½ a col-width (1 user row = 6 row-units = 3W tall). Mobile switches to a 2-col
              grid with <code>grid-auto-flow: dense</code>. Source: <code>assignSpans()</code> in <code>components/project/photo-tour.tsx</code>.
            </p>

            <h4 className="arco-label" style={{ marginBottom: 20 }}>Desktop / iPad (6-col)</h4>
            <div style={{ background: "white", border: "1px solid var(--rule)", borderRadius: 6, padding: 32, marginBottom: 32 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 36 }}>
                {photoGalleryDesktopCombos.map((combo) => (
                  <PhotoComboPreview key={combo.name} combo={combo} cols={6} unit={12} gap={3} />
                ))}
              </div>
            </div>

            <h4 className="arco-label" style={{ marginBottom: 20 }}>Mobile (2-col, dense flow)</h4>
            <div style={{ background: "white", border: "1px solid var(--rule)", borderRadius: 6, padding: 32, marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 36 }}>
                {photoGalleryMobileCombos.map((combo) => (
                  <PhotoComboPreview key={combo.name} combo={combo} cols={2} unit={22} gap={3} autoFlow="dense" />
                ))}
              </div>
            </div>
            <div style={{ background: "var(--surface)", padding: "16px 20px", borderRadius: 6 }}>
              <p className="arco-small-text">
                Desktop row-unit: <code>clamp(60px, 7.5vw, 100px)</code>, 8px gap. iPad: <code>clamp(48px, 6.25vw, 80px)</code>, 6px gap — vw factor tuned so cell aspect ratios match desktop as the viewport narrows.
                Mobile row-unit: <code>(100cqw − gap) / 4</code>, 4px gap — anchored to the gallery's own width via <code>container-type: inline-size</code> so L stays square and P stays 2:3 at any viewport.
              </p>
            </div>
          </div>

          {/* BREAKPOINTS */}
          <div style={{ marginBottom: 80 }}>
            <h2 className="arco-section-title" style={{ marginBottom: 24 }}>Responsive Breakpoints</h2>
            <div style={{ background: "white", border: "1px solid var(--rule)", borderRadius: 6, padding: 40 }}>
              <div style={{ display: "grid", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span className="arco-label" style={{ minWidth: 120 }}>Desktop</span>
                  <span className="arco-small-text">1024px and up</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span className="arco-label" style={{ minWidth: 120 }}>Tablet</span>
                  <span className="arco-small-text">768px – 1023px</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span className="arco-label" style={{ minWidth: 120 }}>Mobile</span>
                  <span className="arco-small-text">0px – 767px</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
