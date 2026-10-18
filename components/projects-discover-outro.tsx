/**
 * Zelfde regel als bij /professionals: de eerste alinea is wat Google
 * als snippet kan tonen, dus hij draagt dezelfde boodschap als
 * projectDiscoverTitle/Description en past binnen ~160 tekens.
 *
 * Short platform block above the hub directory at the bottom of the
 * /projects discover root — the JE-style "what Arco adds" copy with the
 * live project count. No FAQ here on purpose: the inspiration intent
 * doesn't ask questions the way the hire intent does, and the service
 * hubs own the question-shaped content.
 */
export function ProjectsDiscoverOutro({ locale, projectCount }: { locale: string; projectCount: number }) {
  const nl = locale === "nl"
  const count = projectCount > 0 ? String(projectCount) : nl ? "honderden" : "hundreds of"
  const copy = nl
    ? {
        heading: "Gerealiseerde architectuurprojecten in Nederland",
        paragraphs: [
          `Op Arco ontdek je ${count} gerealiseerde architectuur- en interieurprojecten in Nederland, per ruimte gefotografeerd zoals ze zijn opgeleverd — van rietgedekte villa's tot stadse penthouses.`,
          "Bij elk project vind je iedereen die eraan werkte, van architect en interieurarchitect tot aannemer en meubelmaker. Erkenning wordt hier verdiend door gebouwd werk, niet door promotie.",
          "Filter op locatie, type, stijl of ruimte. Spreekt een project je aan, dan bekijk je het portfolio van het bureau erachter en benader je het rechtstreeks.",
        ],
      }
    : {
        heading: "Built architecture projects in the Netherlands",
        paragraphs: [
          `Arco features ${count} built architecture and interior projects in the Netherlands, photographed room by room as they were delivered — from thatched villas to urban penthouses.`,
          "Every project credits everyone who worked on it, from architect and interior designer to contractor and cabinet maker. Recognition is earned here by built work, not by promotion.",
          "Filter by location, type, style or room. When a project speaks to you, explore the portfolio of the firm behind it and get in touch directly.",
        ],
      }

  return (
    <section className="pb-16 max-md:pb-10 bg-white">
      <div className="wrap">
        {/* Sits BELOW "Populaire zoekopdrachten", left-aligned to it —
            closes the page the way JamesEdition's bottom text block does.
            Subsection-scale header: it's an outro, not a peer section.
            Width capped for line length only. */}
        <div style={{ maxWidth: 760 }}>
          <h2 className="arco-subsection-title">{copy.heading}</h2>
          {copy.paragraphs.map((paragraph, i) => (
            <p key={i} className="arco-body-text">
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </section>
  )
}
