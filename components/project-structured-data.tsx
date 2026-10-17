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

/**
 * De fotograafcredit, zoals de specs-balk hem ook krijgt.
 *
 * Fotografen staan NIET in `contributors`: de credits-query sluit ze uit
 * (`companies.audience <> 'pro'`) omdat ze hun eigen plek in de specs-balk
 * hebben en anders dubbel zouden staan. Wie de fotograaf hier uit de
 * contributors probeert te vissen, zoekt in de enige lijst waar hij per
 * definitie niet staat.
 */
interface StructuredPhotographer {
  name: string
  slug: string | null
  /** Alleen een `listed` bedrijf heeft een pagina die rendert. */
  isLive: boolean
}

interface StructuredPhoto {
  url: string | null
  altText?: string | null
  caption?: string | null
  width?: number | null
  height?: number | null
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
  /** All project photos in display order; first is the cover. Meer dan
   *  alleen de URL, want de credits en de afmetingen zijn juist wat een
   *  ImageObject onderscheidt van een kale string. */
  photos: StructuredPhoto[]
  /** Project owner professional (single, primary credit) */
  owner: StructuredProfessional | null
  /** Other credited professionals */
  contributors: StructuredProfessional[]
  /** Gecrediteerde fotograaf, bron voor `creditText` op elke foto */
  photographer?: StructuredPhotographer | null
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
  photos,
  owner,
  contributors,
  photographer = null,
  relatedProjects,
}: ProjectStructuredDataProps) {
  const baseUrl = getSiteUrl()
  const projectUrl = project.slug ? `${baseUrl}/projects/${project.slug}` : `${baseUrl}/projects/${project.id}`

  // Description: strip HTML, fall back to a generic line, cap at 250 chars
  // (Google truncates around 160 anyway; the structured data field is unbounded
  // but bloating it costs payload size with no benefit).
  const descriptionRaw = stripHtml(project.description) ?? `Architectural project: ${project.title}`
  const description = truncate(descriptionRaw, 250)

  /**
   * Foto's als ImageObject in plaats van een rij URL-strings.
   *
   * Een string zegt Google alleen WAAR het beeld staat. Een ImageObject
   * zegt wie het heeft gemaakt, en dat is op dit platform het hele punt:
   * "geen beeld zonder herkomst" is een merkprincipe, en dit is de enige
   * plek waar die herkomst machineleesbaar wordt. Google Afbeeldingen
   * toont `creditText` bij het beeld, dus de fotograaf krijgt zijn naam
   * ook buiten de projectpagina mee.
   *
   * De fotograaf komt uit de credits, niet uit een veld op de foto: op
   * Arco credit de architect één fotograaf voor het hele project, en
   * precies die vermelding is wat hem onderscheidt van een naam in een
   * EXIF-veld dat niemand controleert. Daarom één fotograaf voor alle
   * foto's van het project, en niet een per foto.
   *
   * `creator.url` alleen bij een `listed` bedrijf, dezelfde regel die de
   * specs-balk volgt: een niet-listed fotograaf heeft geen pagina, en een
   * url in de structured data die 404't is een belofte die we niet nakomen.
   *
   * GEEN `license` of `acquireLicensePage`. Die twee leveren het
   * "Licensable"-label op in Google Afbeeldingen, en dat zou beweren dat
   * deze beelden te licentiëren zijn. Dat is niet zo — ze zijn van de
   * fotograaf en Arco verkoopt er niets van. Een badge die een onwaarheid
   * vertelt is erger dan geen badge.
   *
   * Nog steeds gemaximeerd op zes: genoeg voor het afbeeldingencarrousel,
   * zonder de JSON-LD op te blazen.
   */
  const photographerCredit = photographer
    ? {
        creditText: photographer.name,
        creator: {
          "@type": "Organization",
          name: photographer.name,
          ...(photographer.isLive && photographer.slug
            ? { url: `${baseUrl}/photographers/${photographer.slug}` }
            : {}),
        },
      }
    : null
  const images = photos
    .filter((p) => Boolean(p.url))
    .slice(0, 6)
    .map((p) => ({
      "@type": "ImageObject",
      contentUrl: p.url as string,
      ...(p.width ? { width: p.width } : {}),
      ...(p.height ? { height: p.height } : {}),
      ...(p.caption?.trim() || p.altText?.trim()
        ? { caption: (p.caption?.trim() || p.altText?.trim()) as string }
        : {}),
      ...(photographerCredit ?? {}),
    }))

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
    // WebSite `name` intentionally omitted — Google reads this as one of
    // the brand hints it uses when appending "- Arco" to the SERP title.
    // The @id/url is enough to establish the site relationship for
    // structured-data crawlers without giving Google the string to
    // splice into the title.
    isPartOf: {
      "@type": "WebSite",
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
