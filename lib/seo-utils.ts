/**
 * SEO utility functions for slug generation and validation
 */

/**
 * Generates a URL-friendly slug from a title
 */
function generateSlug(title: string, maxLength = 100): string {
  const slug = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-')          // Spaces to hyphens
    .replace(/-+/g, '-')           // Multiple hyphens to single
    .replace(/^-+|-+$/g, '')       // Remove leading/trailing hyphens
    .trim()
    .substring(0, maxLength)
    .replace(/-+$/g, '') // Remove trailing hyphen after truncation
  
  if (!slug) {
    throw new Error('Cannot generate slug: title contains no valid characters')
  }
  
  return slug
}

/**
 * Validates a slug format according to database constraints
 */
export function isValidSlug(slug: string, maxLength = 100): boolean {
  if (!slug || slug.length === 0 || slug.length > maxLength) return false
  if (slug.startsWith('-') || slug.endsWith('-')) return false
  if (slug.includes('--')) return false
  return /^[a-z0-9-]+$/.test(slug)
}

const MAX_SLUG_ATTEMPTS = 100

/**
 * Generates a unique slug by appending numbers if conflicts exist
 */
export async function generateUniqueSlug(
  baseTitle: string,
  checkExistsFn: (slug: string) => Promise<boolean>,
  excludeId?: string
): Promise<string> {
  const baseSlug = generateSlug(baseTitle)
  if (!baseSlug) {
    throw new Error('Unable to generate slug from title')
  }

  // Check if base slug is available
  if (!(await checkExistsFn(baseSlug))) {
    return baseSlug
  }

  // Try numbered variations
  let counter = 2
  while (counter <= MAX_SLUG_ATTEMPTS) {
    const numberedSlug = `${baseSlug}-${counter}`
    if (!(await checkExistsFn(numberedSlug))) {
      return numberedSlug
    }
    counter++
  }

  // Fallback with timestamp if we exhaust numbered options
  console.warn('Slug generation exhausted numbered attempts', { 
    baseSlug, 
    attempts: MAX_SLUG_ATTEMPTS,
    baseTitle
  })
  
  const timestamp = Date.now().toString(36)
  return `${baseSlug}-${timestamp}`
}

