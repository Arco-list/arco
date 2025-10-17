/**
 * SEO utility functions for slug generation and validation
 */

/**
 * Generates a URL-friendly slug from a title
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-')          // Spaces to hyphens
    .replace(/-+/g, '-')           // Multiple hyphens to single
    .replace(/^-+|-+$/g, '')       // Remove leading/trailing hyphens
    .trim()
}

/**
 * Validates a slug format according to database constraints
 */
export function isValidSlug(slug: string): boolean {
  if (!slug || slug.length === 0) return false
  return /^[a-z0-9-]+$/.test(slug)
}

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
  while (counter <= 100) { // Prevent infinite loops
    const numberedSlug = `${baseSlug}-${counter}`
    if (!(await checkExistsFn(numberedSlug))) {
      return numberedSlug
    }
    counter++
  }

  // Fallback with timestamp if we exhaust numbered options
  const timestamp = Date.now().toString(36)
  return `${baseSlug}-${timestamp}`
}

/**
 * Validates SEO field lengths according to best practices
 */
export function validateSeoFields(fields: {
  title?: string | null
  description?: string | null
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  if (fields.title) {
    if (fields.title.length < 30) {
      errors.push('SEO title should be at least 30 characters')
    }
    if (fields.title.length > 60) {
      errors.push('SEO title should not exceed 60 characters')
    }
  }

  if (fields.description) {
    if (fields.description.length < 120) {
      errors.push('SEO description should be at least 120 characters')
    }
    if (fields.description.length > 160) {
      errors.push('SEO description should not exceed 160 characters')
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Generates SEO status based on available fields
 */
export function calculateSeoStatus(fields: {
  slug?: string | null
  seoTitle?: string | null
  seoDescription?: string | null
}): 'Ready' | 'Partial' | 'Missing' {
  const hasSlug = Boolean(fields.slug?.trim())
  const hasTitle = Boolean(fields.seoTitle?.trim())
  const hasDescription = Boolean(fields.seoDescription?.trim())

  if (hasSlug && hasTitle && hasDescription) {
    return 'Ready'
  } else if (hasSlug || hasTitle || hasDescription) {
    return 'Partial'
  } else {
    return 'Missing'
  }
}