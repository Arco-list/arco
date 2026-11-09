"use client"

/**
 * De gedeelde randen van de merk- en seriepagina: dezelfde EDIT-chip,
 * dezelfde scroll naar een sectie, en de regels die de bedrijfspagina
 * inline draagt (components/company-edit/company-edit-client.tsx) maar
 * die niet in globals.css staan. Eén bron, zodat de twee pagina's niet
 * uit elkaar groeien.
 */

export const EditBadge = () => (
  <span className="ec-badge">
    <span className="ec-ico">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5Z" />
      </svg>
    </span>
    <span className="ec-txt">Edit</span>
  </span>
)

/** De hover-pill op een kaart ("Edit series"), zoals op ListingCard. */
export const PILL: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 7,
  fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 400,
  color: "#fff", border: "1px solid rgba(255,255,255,.25)", borderRadius: 100,
  padding: "8px 18px",
  backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
}

export function scrollToSection(id: string) {
  const el = document.getElementById(id)
  if (el) window.scrollTo({ top: el.offsetTop - 130, behavior: "smooth" })
}

export const EDIT_PAGE_CSS = `
  /* Mirrors the company edit page's inline rules that are not in
     globals.css (.ec, .spec-item-edit and .edit-specs-bar are). */
  .spec-inp-inline { width: 100%; text-align: center; font-size: 15px; font-weight: 400; color: #1c1c1a; background: transparent; border: none; border-bottom: 1px solid transparent; outline: none; padding: 0 0 2px; font-family: inherit; cursor: pointer; line-height: 1.3; -moz-appearance: textfield; }
  .spec-inp-inline::-webkit-outer-spin-button, .spec-inp-inline::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .spec-inp-inline::placeholder { color: #b0b0ae; }
  .spec-inp-inline:read-only { pointer-events: none; }
  .spec-item-edit.editing .spec-inp-inline { border-bottom-color: rgba(1,109,117,.3); cursor: text; pointer-events: auto; }
  .spec-item-edit.editing .spec-eyebrow { color: #016D75; }
  .spec-item-edit.editing::before { border-color: #016D75; }
  .spec-item-edit.editing .ec-ico, .spec-item-edit.editing .ec-txt { color: #016D75; }
  .dd-panel { position: absolute; left: 50%; transform: translateX(-50%); background: #fff; border: 1px solid #e8e8e6; border-radius: 7px; box-shadow: 0 12px 40px rgba(0,0,0,.12); overflow: hidden; min-width: 180px; z-index: 20; top: calc(100% + 4px); }
  .dd-row { display: flex; align-items: center; justify-content: space-between; padding: 9px 14px; cursor: pointer; transition: background .1s; font-size: 13px; font-weight: 300; color: #1c1c1a; }
  .dd-row:hover { background: #f5f5f3; }
  .dd-row.sel { font-weight: 500; }
  .dd-row.child { padding-left: 30px; }
  .dd-check { color: #016D75; font-size: 11px; }
  .service-popup-badge { cursor: pointer; transition: opacity .15s; }
  .service-popup-badge:hover { opacity: 0.7; }
  .contact-row { display: flex; gap: 40px; flex-wrap: wrap; }
  .contact-row-item { flex: 1; min-width: 160px; position: relative; cursor: pointer; padding: 14px; }
  .contact-row-item::before { content: ''; position: absolute; inset: 0; border: 1px solid transparent; border-radius: 5px; transition: border-color .18s; pointer-events: none; }
  .contact-row-item:hover::before { border-color: #1c1c1a; }
  .contact-row-item.on::before { border-color: #016D75; }
  .contact-row-item.on { cursor: default; }
  .contact-row-item.static { cursor: default; }
  .contact-row-item.static:hover::before { border-color: transparent; }
  .contact-row-item .ec-badge { position: absolute; top: -8px; left: 6px; display: flex; align-items: center; gap: 4px; background: #fff; padding: 0 4px; pointer-events: none; z-index: 1; }
  .contact-row-item .ec-ico { display: flex; align-items: center; color: #c8c8c6; transition: color .18s; }
  .contact-row-item .ec-txt { font-size: 10px; font-weight: 400; letter-spacing: .04em; text-transform: uppercase; color: #c8c8c6; white-space: nowrap; transition: color .15s; }
  .contact-row-item:hover .ec-ico, .contact-row-item:hover .ec-txt { color: #1c1c1a; }
  .contact-row-item.on .ec-ico, .contact-row-item.on .ec-txt { color: #016D75; }
  .contact-row-value { font-size: 15px; font-weight: 400; color: #1c1c1a; margin: 8px 0 0; line-height: 1.4; }
  .contact-row-sub { font-size: 13px; color: #a1a1a0; margin: 4px 0 0; }
  .contact-row-placeholder { color: #b0b0ae; font-weight: 400; }
  .contact-edit-input { width: 100%; font-size: 15px; font-weight: 400; color: #1c1c1a; background: transparent; border: none; border-bottom: 1px solid rgba(1,109,117,.3); outline: none; padding: 0 0 2px; font-family: inherit; margin-top: 8px; }
  @media (max-width: 768px) { .contact-row { flex-direction: column; gap: 24px; } }
  /* Hero image of a series: the .ec outline sits around the picture. */
  .hero-cover-edit { position: relative; cursor: pointer; }
  .hero-cover-edit img { display: block; }
`
