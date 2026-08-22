/**
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
        heading: "Ontdek gerealiseerde projecten op Arco",
        paragraphs: [
          `Op Arco ontdek je momenteel ${count} gerealiseerde architectuur- en interieurprojecten in Nederland — van rietgedekte villa's tot stadse penthouses. Filter op locatie, type, stijl of ruimte en bekijk elk project ruimte voor ruimte, gefotografeerd zoals het is opgeleverd.`,
          "Elk project vermeldt de studio's die het maakten — architect, interieurontwerper, fotograaf. Spreekt een project je aan, dan bekijk je het portfolio van het bureau en neem je rechtstreeks contact op.",
        ],
      }
    : {
        heading: "Discover realized projects on Arco",
        paragraphs: [
          `Arco currently features ${count} realized architecture and interior projects in the Netherlands — from thatched villas to urban penthouses. Filter by location, type, style or room, and browse every project room by room, photographed as delivered.`,
          "Every project credits the studios that made it — architect, interior designer, photographer. When a project speaks to you, explore the firm's portfolio and get in touch directly.",
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
