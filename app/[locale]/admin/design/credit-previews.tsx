"use client"

import { ArrowRight } from "lucide-react"

import { resolveProfessionalServiceIcon } from "@/lib/icons/professional-services"

/**
 * The two surfaces that render a project's credited professionals.
 *
 * The public cards use the real global classes (.credit-card,
 * .credit-icon, .credit-card-projects …), so what shows here is exactly
 * what ships — including the hover rule on the project count.
 *
 * The editor table cannot: its row rules live in a <style> block inside
 * app/[locale]/dashboard/edit/[id]/page.tsx rather than in globals.css,
 * so they are unreachable from here. The block below mirrors them. Keep
 * the two in step, or lift those rules into globals.css and delete this
 * copy — the column widths and the 44px disc are the parts that drift.
 */

type Row = {
  slug: string
  company: string
  service: string
  contact: string
  status: "owner" | "featured" | "invited"
  statusLabel: string
}

const ROWS: Row[] = [
  { slug: "architect", company: "Bongers Architecten", service: "Architect", contact: "Jij", status: "owner", statusLabel: "Eigenaar" },
  { slug: "tiles-stones", company: "Lucen", service: "Tegels & Natuursteen", contact: "Niek", status: "featured", statusLabel: "Uitgelicht" },
  { slug: "interior-designer", company: "Versteegh-Design", service: "Interieurontwerper", contact: "stephen@versteegh-design.com", status: "invited", statusLabel: "Uitgenodigd" },
]

const CARDS = [
  { slug: "architect", company: "Bongers Architecten", service: "Architect", projects: 6 },
  { slug: "tiles-stones", company: "Lucen", service: "Tiles & Stones", projects: 1 },
  { slug: "interior-designer", company: "Versteegh-Design", service: "Interior Designer", projects: null },
]

export function CreditPreviews() {
  return (
    <>
      <style>{`
        .cp-rows { display: flex; flex-direction: column; }
        .cp-head { display: flex; align-items: center; gap: 18px; padding: 0 8px 10px; border-bottom: 1px solid #eeeeed; }
        .cp-head-icon { flex: 0 0 44px; }
        .cp-row { display: flex; align-items: center; gap: 18px; text-align: left; padding: 13px 8px; border-bottom: 1px solid #eeeeed; }
        .cp-row .credit-icon { width: 44px; height: 44px; margin: 0; flex-shrink: 0; }
        .cp-row .credit-icon-service { width: 23px; height: 23px; }
        .cp-name { flex: 1 1 auto; min-width: 0; font-size: 14px; font-weight: 400; color: var(--arco-black);
                   line-height: 1.5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cp-service { flex: 0 0 190px; font-size: 14px; color: var(--text-secondary, #6b6b68); line-height: 1.5; }
        .cp-contact { flex: 0 0 250px; font-size: 14px; color: var(--text-secondary, #6b6b68); line-height: 1.5;
                      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cp-status { flex: 0 0 130px; display: flex; align-items: center; }
        .cp-status .status-pill { font-size: 12px; padding: 3px 10px; }
        @media (max-width: 768px) { .cp-head { display: none; } }
      `}</style>

      <h4 className="arco-label" style={{ marginBottom: 20 }}>Editor rows &mdash; project edit</h4>
      <div style={{ background: "white", border: "1px solid var(--rule)", borderRadius: 6, padding: "28px 24px", marginBottom: 16 }}>
        <div className="cp-rows">
          <div className="cp-head" aria-hidden>
            <span className="cp-head-icon" />
            <span className="arco-eyebrow" style={{ flex: "1 1 auto", minWidth: 0 }}>Bedrijf</span>
            <span className="arco-eyebrow" style={{ flex: "0 0 190px" }}>Dienst</span>
            <span className="arco-eyebrow" style={{ flex: "0 0 250px" }}>Contact</span>
            <span className="arco-eyebrow" style={{ flex: "0 0 130px" }}>Status</span>
          </div>
          {ROWS.map((row) => {
            const Icon = resolveProfessionalServiceIcon(row.slug)
            return (
              <div className="cp-row" key={row.company}>
                <div className="credit-icon">
                  <Icon className="credit-icon-service" strokeWidth={1} aria-hidden />
                </div>
                <span className="cp-name">{row.company}</span>
                <span className="cp-service">{row.service}</span>
                <span className="cp-contact">{row.contact}</span>
                <span className="cp-status">
                  <span className="status-pill">
                    <span className={`status-pill-dot status-pill-dot--${row.status}`} />
                    {row.statusLabel}
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <div style={{ background: "var(--surface)", padding: "16px 20px", borderRadius: 6, marginBottom: 48 }}>
        <p className="arco-small-text">
          One row per credit, sorted by status &mdash; owner first, then Featured, Listed,
          Created, Invited &mdash; with the service order breaking ties inside each band, so
          rows do not scramble within a group. Every field is edited in place; the row&rsquo;s
          hover outline and cursor carry the affordance, which is why nothing here is
          underlined. The status pill runs at 12px to match the project card on Listings,
          rather than the 10px the admin tables use.
        </p>
      </div>

      <h4 className="arco-label" style={{ marginBottom: 20 }}>Public cards &mdash; project detail</h4>
      <div style={{ background: "white", border: "1px solid var(--rule)", borderRadius: 6, padding: "40px 24px", marginBottom: 16 }}>
        <div className="credits-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {CARDS.map((card) => {
            const Icon = resolveProfessionalServiceIcon(card.slug)
            const body = (
              <>
                <p className="arco-eyebrow">{card.service}</p>
                <div className="credit-icon">
                  <Icon className="credit-icon-service" strokeWidth={1} aria-hidden />
                </div>
                <h3 className="arco-label">{card.company}</h3>
                {card.projects !== null && (
                  <p className="credit-card-projects">
                    {/* The live card gets this from an ICU plural; spelled
                        out here so the preview does not show "1 projects". */}
                    <span className="credit-card-projects-label">
                      {card.projects} {card.projects === 1 ? "project" : "projects"}
                    </span>
                    <ArrowRight className="credit-card-arrow" size={14} strokeWidth={1.5} aria-hidden />
                  </p>
                )}
              </>
            )
            return card.projects !== null ? (
              <a href="#credits" className="credit-card" key={card.company}>{body}</a>
            ) : (
              <div className="credit-card credit-card--plain" key={card.company}>{body}</div>
            )
          })}
        </div>
      </div>
      <div style={{ background: "var(--surface)", padding: "16px 20px", borderRadius: 6 }}>
        <p className="arco-small-text">
          <strong>.credit-card</strong> &mdash; service eyebrow, 100px disc, company name.
          A company with a logo shows it filling the disc; the rest fall back to their
          service mark rather than to initials, which said nothing.<br />
          Credits sort <strong>owner &rarr; has an Arco page &rarr; trade order</strong>, so
          the cards that lead somewhere come first. Only a claimed company has a page, and
          for those the project count carries the link &mdash;
          <strong> .credit-card-projects</strong> in <strong>--primary-ink</strong> with an
          arrow that steps 2px right on hover. A credit with no page behind it renders as
          <strong> .credit-card--plain</strong>: same layout, nothing interactive, no dead link.
        </p>
      </div>
    </>
  )
}
