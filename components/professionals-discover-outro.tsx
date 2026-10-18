import { FAQSection } from "@/components/landing/FAQSection"

/**
 * De eerste alinea hier IS in de praktijk de zoekresultaat-snippet:
 * Google negeert onze meta description op deze pagina en pakt dit blok
 * (gezien in de SERP, met "Read more" eronder). Daarom draagt hij
 * dezelfde boodschap als proDiscoverTitle/Description in lib/seo/copy.ts,
 * en staat het hele verhaal binnen ~160 tekens — daarna kapt Google af.
 * De oude versie kapte af op "Geen advertenties of leadformulieren:",
 * dus precies vóór het punt dat het verschil maakte.
 *
 * "binnenhuisarchitect" en "interieurontwerper" staan er bewust in. De
 * merknaam is interieurarchitect en blijft dat in titels en koppen, maar
 * de zoekvraag staat op de synoniemen (691 resp. 561 vertoningen in 90
 * dagen tegen 808 voor interieurarchitect) en die kwamen op deze pagina
 * nergens meer voor. Lopende tekst is de plek waar een synoniem kan
 * staan zonder de merktaal te verwateren.
 *
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
        heading: "Architecten en vakmensen in Nederland met opgeleverd werk",
        paragraphs: [
          `Op Arco vind je ${companies} Nederlandse bedrijven, van architect en interieurarchitect tot aannemer en meubelmaker. Samen leverden ze ${projects} projecten op, per ruimte gefotografeerd.`,
          "Zoek je een binnenhuisarchitect of interieurontwerper? Wij helpen opdrachtgevers aan een netwerk van professionals — van interieurarchitect tot aannemer — die hun reputatie hebben verdiend door vakmanschap, niet door reclame.",
          "Filter op dienst of locatie. Bij elk project staan de betrokken vakmensen, van interieurarchitect tot aannemer, vermeld door de architect die met ze samenwerkte.",
        ],
      }
    : {
        heading: "Dutch architects and specialists with delivered work",
        paragraphs: [
          `Arco lists ${companies} Dutch companies, from architect and interior designer to contractor and cabinet maker. Together they delivered ${projects} projects, photographed room by room.`,
          "Looking for an interior architect or interior designer? We connect clients with a network of professionals — from interior designer to contractor — who earned their reputation through craftsmanship, not advertising.",
          "Filter by service or location. Every project credits the specialists involved, from interior designer to contractor, named by the architect who worked with them.",
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
          answer: "Ja. Architecten, interieurarchitecten en andere professionals kunnen hun bureau vermelden en gerealiseerde projecten publiceren via “Vermeld jouw bedrijf” bovenaan de pagina.",
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
