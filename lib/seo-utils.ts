import { getSiteUrl } from "@/lib/utils"
import { locales, defaultLocale } from "@/i18n/config"

/**
 * SEO utility functions for slug generation and validation
 */

/**
 * Pages that must never show up in a search result.
 *
 * Nobody searches for a password-reset form, and a visitor who lands on
 * one from Google is lost rather than helped. Every account and funnel
 * page was indexable until now: robots.txt only excludes /styles,
 * /admin and /dashboard, so the whole sign-up, claim and new-project
 * flow was fair game. /reset-password was in fact picked up, and was
 * shown 21 times between August and October for one click.
 *
 * Found by the catch-all row on the SEO page — the bucket that holds
 * every URL the page-type rules do not recognise. That row exists to be
 * read, not emptied: these pages leave it by becoming noindex, not by
 * having a classification rule written for them.
 *
 * follow stays ON. The links on these pages still lead to real pages
 * and should keep passing their signal; there is just nothing here
 * worth listing.
 */
export const NO_INDEX = { index: false, follow: true } as const

/**
 * Canonical + hreflang voor één pad, in de vorm die Google nodig heeft.
 *
 * Dezelfde constructie als `localizedUrls` in de sitemap, maar dan voor
 * de <head>. Het stond al in de hub-pagina's en ontbrak precies op de
 * twee pagina's met het meeste verkeer: de homepagina en /about hadden
 * geen generateMetadata, dus geen canonical en geen hreflang. Zonder
 * die twee kiest Google zelf welke URL en welke taal hij toont — en dat
 * deed hij ook: /about stond boven /nl/about, / boven /nl.
 *
 * `path` begint met een slash of is leeg voor de homepagina.
 */
export function localeAlternates(locale: string, path: string) {
  const base = getSiteUrl()
  return {
    canonical: `${base}/${locale}${path}`,
    languages: {
      ...Object.fromEntries(locales.map((l) => [l, `${base}/${l}${path}`])),
      "x-default": `${base}/${defaultLocale}${path}`,
    },
  }
}


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

