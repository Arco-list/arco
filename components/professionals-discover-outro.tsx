import { FAQSection } from "@/components/landing/FAQSection"

/**
 * Bottom of the /professionals discover root, mirroring the projects root:
 * professional hub directory first, then the marketplace-level FAQ (left-
 * aligned, FAQPage JSON-LD), then the platform outro block (live counts,
 * the realized-work matching pitch). Service-SPECIFIC prose and FAQs live
 * on the service hubs (service-hub-prose.tsx) — this level only answers
 * marketplace questions, so the two never duplicate.
 */
export function ProfessionalsDiscoverOutro({ locale, companyCount, projectCount }: {
  locale: string
  companyCount: number
  projectCount: number
}) {
  const nl = locale === "nl"
  const companies = companyCount > 0 ? String(companyCount) : nl ? "tientallen" : "dozens of"
  const projects = projectCount > 0 ? String(projectCount) : nl ? "honderden" : "hundreds of"

  const platform = nl
    ? {
        heading: "Vind jouw architect of interieurontwerper op Arco",
        paragraphs: [
          `Op Arco vind je momenteel ${companies} Nederlandse architectenbureaus en interieurstudio's, met samen ${projects} gerealiseerde projecten. Geen advertenties of leadformulieren: je beoordeelt elk bureau op gebouwd werk, gefotografeerd ruimte voor ruimte.`,
          "Gebruik de filters om te zoeken op dienst of locatie. Herken je jouw ambitie in een gerealiseerd project, dan neem je rechtstreeks en kosteloos contact op met de studio erachter.",
        ],
      }
    : {
        heading: "Find your architect or interior designer on Arco",
        paragraphs: [
          `Arco currently features ${companies} Dutch architecture firms and interior studios, with ${projects} realized projects between them. No ads, no lead forms: you judge every firm by built work, photographed room by room.`,
          "Use the filters to search by service or location. When you recognize your ambition in a realized project, you contact the studio behind it directly and free of charge.",
        ],
      }

  const faqs = nl
    ? [
        {
          question: "Is Arco gratis voor opdrachtgevers?",
          answer: "Ja. Zoeken, projecten bekijken en contact opnemen met bureaus is volledig kosteloos. Arco is geen tussenpersoon en rekent geen commissie — je schakelt rechtstreeks met de studio.",
        },
        {
          question: "Hoe neem ik contact op met een bureau?",
          answer: "Elk bureau heeft een eigen pagina met gerealiseerde projecten en contactgegevens. Je benadert het bureau rechtstreeks — zonder leadformulier of tussenstap.",
        },
        {
          question: "Hoe worden de bureaus op Arco geselecteerd?",
          answer: "Elk bureau op Arco presenteert gerealiseerd, gepubliceerd werk. Je beoordeelt een studio dus niet op beloften of advertenties, maar op wat er daadwerkelijk is gebouwd — inclusief de professionals waarmee is samengewerkt.",
        },
        {
          question: "Kan ik mijn eigen bureau op Arco vermelden?",
          answer: "Ja. Architecten, interieurontwerpers en andere professionals kunnen hun bureau vermelden en gerealiseerde projecten publiceren via “Vermeld jouw bedrijf” bovenaan de pagina.",
        },
      ]
    : [
        {
          question: "Is Arco free for clients?",
          answer: "Yes. Searching, browsing projects and contacting firms is entirely free of charge. Arco is not a middleman and charges no commission — you deal with the studio directly.",
        },
        {
          question: "How do I contact a firm?",
          answer: "Every firm has its own page with realized projects and contact details. You approach the firm directly — no lead forms, no steps in between.",
        },
        {
          question: "How are the firms on Arco selected?",
          answer: "Every firm on Arco presents realized, published work. You judge a studio not by promises or ads, but by what has actually been built — including the professionals it collaborated with.",
        },
        {
          question: "Can I list my own firm on Arco?",
          answer: "Yes. Architects, interior designers and other professionals can list their firm and publish realized projects via “List your business” at the top of the page.",
        },
      ]

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  }

  return (
    <>
      <FAQSection items={faqs} heading={nl ? "Veelgestelde vragen" : "Frequently asked questions"} paddingTop={0} paddingBottom={40} align="left" />
      <section className="pb-16 max-md:pb-10 bg-white">
        <div className="wrap">
          <div style={{ maxWidth: 760 }}>
            <h2 className="arco-subsection-title">{platform.heading}</h2>
            {platform.paragraphs.map((paragraph, i) => (
              <p key={i} className="arco-body-text">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
    </>
  )
}
