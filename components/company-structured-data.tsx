import { getSiteUrl } from "@/lib/utils"
import type { ProfessionalDetail } from "@/lib/professionals/types"

/**
 * JSON-LD structured data for company (professional) detail pages.
 *
 * Schema design and rationale: see the SEO strategy doc on Notion
 * (Bar 3 — Understandable). Notable choices:
 * - Type is ProfessionalService (more specific than LocalBusiness, matches
 *   "architect near me" search intent).
 * - @id is the same string referenced from project pages' author/contributor,
 *   so Google joins the entity graph.
 * - sameAs combines website + domain + every row from company_social_links.
 *   This is the single most important field for entity disambiguation.
 * - Reviews/ratings (aggregateRating, review) are intentionally omitted —
 *   we no longer ship that feature.
 * - priceRange is intentionally omitted — we don't capture pricing per
 *   company and emitting a stub for everyone is noise.
 */
interface CompanyStructuredDataProps {
  professional: ProfessionalDetail
  /** Active locale; used to localise the description and inLanguage hint */
  locale: string
}

const ISO_LANG_MAP: Record<string, string> = {
  dutch: "nl",
  nederlands: "nl",
  english: "en",
  engels: "en",
  french: "fr",
  frans: "fr",
  german: "de",
  duits: "de",
  spanish: "es",
  spaans: "es",
  italian: "it",
  italiaans: "it",
}

const toIsoLanguage = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  // Already an ISO 639-1 code
  if (/^[a-z]{2}$/i.test(trimmed)) return trimmed.toLowerCase()
  return ISO_LANG_MAP[trimmed.toLowerCase()] ?? trimmed
}

export function CompanyStructuredData({ professional, locale }: CompanyStructuredDataProps) {
  const baseUrl = getSiteUrl()
  const companyUrl = `${baseUrl}/professionals/${professional.slug}`
  const companyId = `${companyUrl}#org`
  const company = professional.company

  // sameAs: website + domain + social links. Dedupe and require valid URL.
  const websiteUrl = company.website || (company.domain ? `https://${company.domain}` : null)
  const sameAsRaw = [
    websiteUrl,
    ...professional.socialLinks.map((s) => s.url).filter(Boolean),
  ].filter((url): url is string => typeof url === "string" && url.length > 0)
  const sameAs = Array.from(new Set(sameAsRaw))

  // address + geo
  const addressParts = {
    ...(company.address ? { streetAddress: company.address } : {}),
    ...(company.city ? { addressLocality: company.city } : {}),
    ...(company.country ? { addressCountry: company.country } : {}),
  }
  const hasAddress = Object.keys(addressParts).length > 0

  // Languages → ISO 639-1 where possible, otherwise pass through.
  const knowsLanguage = company.languages
    .map(toIsoLanguage)
    .filter((value) => value.length > 0)

  // Certificates → EducationalOccupationalCredential entries.
  const hasCredential = company.certificates
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((name) => ({
      "@type": "EducationalOccupationalCredential",
      name: name.trim(),
    }))

  // numberOfEmployees → QuantitativeValue with min/max when both present,
  // single value when only one is set, omitted entirely when neither.
  let numberOfEmployees: Record<string, unknown> | undefined
  if (company.teamSizeMin !== null && company.teamSizeMax !== null) {
    numberOfEmployees = {
      "@type": "QuantitativeValue",
      minValue: company.teamSizeMin,
      maxValue: company.teamSizeMax,
    }
  } else if (company.teamSizeMin !== null) {
    numberOfEmployees = { "@type": "QuantitativeValue", value: company.teamSizeMin }
  } else if (company.teamSizeMax !== null) {
    numberOfEmployees = { "@type": "QuantitativeValue", value: company.teamSizeMax }
  }

  // knowsAbout = the company's resolved service names. company.services is
  // already the resolved/dedupe list from fetchProfessionalDetail.
  const knowsAbout = company.services.length > 0 ? company.services : undefined

  // areaServed: we don't store an explicit service area yet. Conservative
  // starting point is the company's country (often a studio works across
  // its whole country). Skip if no country.
  const areaServed = company.country
    ? [{ "@type": "Country", name: company.country }]
    : undefined

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": companyId,
    url: companyUrl,
    name: professional.name,
    ...(professional.description ? { description: professional.description } : {}),
    ...(professional.gallery[0]?.url ? { image: professional.gallery[0].url } : {}),
    ...(company.logoUrl ? { logo: company.logoUrl } : {}),
    ...(company.email ? { email: company.email } : {}),
    ...(company.phone ? { telephone: company.phone } : {}),
    ...(hasAddress
      ? {
          address: { "@type": "PostalAddress", ...addressParts },
        }
      : {}),
    ...(areaServed ? { areaServed } : {}),
    ...(knowsAbout ? { knowsAbout } : {}),
    ...(knowsLanguage.length > 0 ? { knowsLanguage } : {}),
    ...(hasCredential.length > 0 ? { hasCredential } : {}),
    ...(company.foundedYear ? { foundingDate: String(company.foundedYear) } : {}),
    ...(numberOfEmployees ? { numberOfEmployees } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    isPartOf: {
      "@type": "WebSite",
      name: "Arco",
      url: baseUrl,
    },
    inLanguage: locale,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": companyUrl,
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData),
      }}
    />
  )
}
