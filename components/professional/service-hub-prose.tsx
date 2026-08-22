import { FAQSection } from "@/components/landing/FAQSection"
import { SERVICE_HUB_PROSE } from "@/lib/professional-hubs"

/**
 * Editorial prose + FAQ for the national service hubs
 * (/professionals/architect, /professionals/interior-designer). Rendered
 * BELOW the grid via the grid's preFooter slot, JamesEdition-style: the
 * FAQ first, then a platform block ("find your architect on Arco", with
 * the live company count), then the editorial value sections. Text runs
 * at the same .wrap width as the FAQ. FAQ answers stay in the DOM
 * (CSS-collapsed) and are mirrored in FAQPage JSON-LD.
 */
export function ServiceHubProse({ hubSlug, locale, companyCount }: {
  hubSlug: string
  locale: string
  companyCount?: number
}) {
  const prose = SERVICE_HUB_PROSE[hubSlug]?.[locale === "nl" ? "nl" : "en"]
  if (!prose) return null

  const countText = companyCount && companyCount > 0
    ? String(companyCount)
    : locale === "nl" ? "tientallen" : "dozens of"
  const fillCount = (text: string) => text.replace("{count}", countText)

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: prose.faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  }

  return (
    <>
      <FAQSection items={prose.faqs} heading={prose.faqHeading} paddingTop={0} paddingBottom={40} align="left" />
      <section className="pb-16 max-md:pb-10 bg-white">
        <div className="wrap">
          {/* Left-aligned 760px column — same treatment as the discover
              roots' outros. */}
          <div style={{ maxWidth: 760 }}>
          <div style={{ marginBottom: 32 }}>
            <h2 className="arco-subsection-title">
              {prose.platform.heading}
            </h2>
            {prose.platform.paragraphs.map((paragraph, i) => (
              <p key={i} className="arco-body-text">
                {fillCount(paragraph)}
              </p>
            ))}
          </div>
          {prose.sections.map((section) => (
            <div key={section.heading} style={{ marginBottom: 32 }}>
              <h2 className="arco-subsection-title">
                {section.heading}
              </h2>
              {section.paragraphs.map((paragraph, i) => (
                <p key={i} className="arco-body-text">
                  {paragraph}
                </p>
              ))}
            </div>
          ))}
          </div>
        </div>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
    </>
  )
}
