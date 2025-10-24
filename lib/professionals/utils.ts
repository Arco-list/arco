import type { ProfessionalCard } from "./types"

/**
 * Type representing a featured item (company or professional) from the homepage
 */
export type FeaturedItem = {
  id: string
  name: string
  title: string
  location: string
  rating: number
  reviews: number
  image: string | null
  href: string
}

/**
 * Extracts the slug from a professional/company href path
 * @param href The href path (e.g., "/professionals/acme-design")
 * @returns The slug portion (e.g., "acme-design")
 */
export function extractSlugFromHref(href: string): string {
  // Remove leading slash if present
  const cleanHref = href.startsWith("/") ? href.slice(1) : href

  // Split by slash and get the last segment
  const segments = cleanHref.split("/")
  return segments[segments.length - 1] || ""
}

/**
 * Converts a FeaturedItem (from homepage) to ProfessionalCard format (used by save functionality)
 *
 * Note: professionalId is set to empty string because featured items only contain company-level data.
 * This is acceptable because the save functionality uses companyId as the primary identifier.
 *
 * @param item The featured item to convert
 * @returns ProfessionalCard suitable for saving
 */
export function featuredItemToProfessionalCard(item: FeaturedItem): ProfessionalCard {
  return {
    id: item.id,
    slug: extractSlugFromHref(item.href),
    companyId: item.id,
    professionalId: "", // Not available in featured item data; save uses companyId instead
    name: item.name,
    profession: item.title,
    location: item.location,
    rating: item.rating,
    reviewCount: item.reviews,
    image: item.image ?? "",
    specialties: [],
    isVerified: false,
    domain: null,
  }
}
