import { getSiteUrl } from "@/lib/utils"

/**
 * JSON-LD structured data for project detail pages.
 *
 * Schema design and rationale: see the SEO strategy doc on Notion
 * (Bar 3 — Understandable). Notable choices:
 * - Author = the project owner professional, mapped to a ProfessionalService
 *   @id that exactly matches what we emit on /professionals/[slug] so
 *   Google joins the entity graph.
 * - Contributor = every other credited professional from project_professionals.
 * - Keywords + about = project type + scope + style (belt and braces — the
 *   legacy `keywords` field plus the modern typed `about` array).
 * - hasPart = related projects from the same owner (cross-link signal).
 * - locationCreated honours `share_exact_location`: when false, only city/region
 *   is emitted, no streetAddress and no geo coordinates.
 */
interface StructuredProfessional {
  /** Slug of the company; used to build the @id matching /professionals/[slug] */
  companySlug: string | null
  /** Display name of the company */
  companyName: string
  /** Service category (e.g. "Interior design", "Construction") used as `roleName` */
  roleName: string | null
}

interface StructuredRelatedProject {
  slug: string | null
  title: string
}

interface ProjectStructuredDataProps {
  project: {
    id: string
    title: string
    description?: string | null
    slug?: string | null
    createdAt?: string | null
    updatedAt?: string | null
    locale?: string
    /** Resolved category name (e.g. "Villa", "Apartment") */
    type?: string | null
    /** Resolved scope ("New Build", "Renovation", "Interior Design") */
    scope?: string | null
    /** Resolved style preference (e.g. "Modern") */
    style?: string | null
    location: {
      city?: string | null
      region?: string | null
      country?: string | null
      latitude?: number | null
      longitude?: number | null
      shareExactLocation?: boolean | null
    }
  }
  /** All project photo URLs in display order; first is the cover. */
  imageUrls: string[]
  /** Project owner professional (single, primary credit) */
  owner: StructuredProfessional | null
  /** Other credited professionals */
  contributors: StructuredProfessional[]
  /** Related projects from the same owner */
  relatedProjects: StructuredRelatedProject[]
}

const stripHtml = (html: string | null | undefined): string | null => {
  if (!html) return null
  const stripped = html.replace(/<[^>]*>/g, "").trim()
  return stripped.length > 0 ? stripped : null
}

const truncate = (text: string, max: number): string => {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + "…"
}

const buildProfessionalId = (baseUrl: string, slug: string | null): string | null =>
  slug ? `${baseUrl}/professionals/${slug}#org` : null

export function ProjectStructuredData({
  project,
  imageUrls,
  owner,
  contributors,
  relatedProjects,
}: ProjectStructuredDataProps) {
  const baseUrl = getSiteUrl()
  const projectUrl = project.slug ? `${baseUrl}/projects/${project.slug}` : `${baseUrl}/projects/${project.id}`

  // Description: strip HTML, fall back to a generic line, cap at 250 chars
  // (Google truncates around 160 anyway; the structured data field is unbounded
  // but bloating it costs payload size with no benefit).
  const descriptionRaw = stripHtml(project.description) ?? `Architectural project: ${project.title}`
  const description = truncate(descriptionRaw, 250)

  // Cap images at 6 — enough to be eligible for image carousel rich results
  // without inflating the JSON-LD payload.
  const images = imageUrls.filter(Boolean).slice(0, 6)

  // Build the locationCreated block, honouring share_exact_location.
  // When false: emit city/region only, no streetAddress, no geo. This matches
  // how the visible page already obscures location for privacy-sensitive owners.
  const locationName = [project.location.city, project.location.region, project.location.country]
    .filter(Boolean)
    .join(", ") || null

  const showExact = project.location.shareExactLocation !== false
  const hasGeo =
    showExact &&
    typeof project.location.latitude === "number" &&
    typeof project.location.longitude === "number"

  const locationCreated = locationName
    ? {
        "@type": "Place",
        name: locationName,
        address: {
          "@type": "PostalAddress",
          ...(project.location.city ? { addressLocality: project.location.city } : {}),
          ...(project.location.region ? { addressRegion: project.location.region } : {}),
          ...(project.location.country ? { addressCountry: project.location.country } : {}),
        },
        ...(hasGeo
          ? {
              geo: {
                "@type": "GeoCoordinates",
                latitude: project.location.latitude,
                longitude: project.location.longitude,
              },
            }
          : {}),
      }
    : undefined

  // Type/scope/style → keywords (flat) + about (typed). Belt and braces.
  const topicValues = [project.type, project.scope, project.style]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim())

  const keywords = topicValues.length > 0 ? topicValues : undefined
  const about =
    topicValues.length > 0
      ? topicValues.map((name) => ({ "@type": "Thing", name }))
      : undefined

  // Author: project owner mapped to a ProfessionalService entity. Skip if
  // we don't have a slug (we'd be emitting a dangling @id).
  const authorId = owner ? buildProfessionalId(baseUrl, owner.companySlug) : null
  const author = authorId
    ? {
        "@type": "ProfessionalService",
        "@id": authorId,
        name: owner!.companyName,
      }
    : undefined

  // Contributors: same shape, plus roleName from the company's primary
  // service category.
  const contributor = contributors
    .map((c) => {
      const id = buildProfessionalId(baseUrl, c.companySlug)
      if (!id) return null
      return {
        "@type": "ProfessionalService",
        "@id": id,
        name: c.companyName,
        ...(c.roleName ? { roleName: c.roleName } : {}),
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

  // hasPart: related projects from the same owner. Each is itself a CreativeWork.
  const hasPart = relatedProjects
    .filter((rp) => rp.slug)
    .slice(0, 5)
    .map((rp) => ({
      "@type": "CreativeWork",
      "@id": `${baseUrl}/projects/${rp.slug}`,
      name: rp.title,
      url: `${baseUrl}/projects/${rp.slug}`,
    }))

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "@id": projectUrl,
    url: projectUrl,
    name: project.title,
    description,
    ...(images.length > 0 ? { image: images } : {}),
    genre: "Architecture",
    inLanguage: project.locale ?? "en",
    ...(project.createdAt ? { datePublished: project.createdAt } : {}),
    ...(project.updatedAt ? { dateModified: project.updatedAt } : {}),
    ...(keywords ? { keywords } : {}),
    ...(about ? { about } : {}),
    ...(locationCreated ? { locationCreated } : {}),
    ...(author ? { author } : {}),
    ...(contributor.length > 0 ? { contributor } : {}),
    ...(hasPart.length > 0 ? { hasPart } : {}),
    isPartOf: {
      "@type": "WebSite",
      name: "Arco",
      url: baseUrl,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": projectUrl,
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
