/**
 * Image URL validation and security utilities
 * Protects against XSS attacks via malicious image URLs
 */

const ALLOWED_IMAGE_HOSTS = [
  'supabase.co',
  'placeholder.svg',
  'placeholder.com',
  'via.placeholder.com',
  'images.unsplash.com',
  'placehold.co',
] as const

const ALLOWED_IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.avif',
  '.svg',
] as const

/**
 * Validates if a URL is safe to use as an image source
 * @param url - The image URL to validate
 * @returns true if the URL is safe, false otherwise
 */
function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }

  // Allow relative paths (for local assets)
  if (url.startsWith('/')) {
    return true
  }

  // Validate absolute URLs
  try {
    const parsedUrl = new URL(url)

    // Reject javascript: and data: URLs (common XSS vectors)
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return false
    }

    // Check if hostname is in allowed list
    const hostname = parsedUrl.hostname
    const isAllowedHost = ALLOWED_IMAGE_HOSTS.some(allowedHost => {
      return hostname === allowedHost || hostname.endsWith(`.${allowedHost}`)
    })

    if (!isAllowedHost) {
      // If not in allowed list, at least check for valid image extension
      const hasValidExtension = ALLOWED_IMAGE_EXTENSIONS.some(ext =>
        parsedUrl.pathname.toLowerCase().endsWith(ext)
      )

      return hasValidExtension
    }

    return true
  } catch {
    // Invalid URL
    return false
  }
}

/**
 * Sanitizes an image URL, returning a safe fallback if invalid
 * @param url - The image URL to sanitize
 * @param fallback - The fallback URL to use if invalid (defaults to placeholder)
 * @returns A safe image URL
 */
export function sanitizeImageUrl(
  url: string | null | undefined,
  fallback: string = '/placeholder.svg'
): string {
  if (isValidImageUrl(url)) {
    return url!
  }

  return fallback
}

/**
 * Get dimensions for Next.js Image component based on context
 * Helps prevent layout shift and improves performance
 */
export const IMAGE_SIZES = {
  avatar: { width: 40, height: 40 },
  avatarLarge: { width: 80, height: 80 },
  thumbnail: { width: 64, height: 64 },
  card: { width: 300, height: 200 },
  cardLarge: { width: 400, height: 300 },
  hero: { width: 1200, height: 600 },
  gallery: { width: 800, height: 600 },
  logo: { width: 200, height: 200 },
} as const
