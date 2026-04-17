import { defineRouting } from 'next-intl/routing'
import { locales, defaultLocale } from './config'

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always', // Always show locale prefix: /nl/ and /en/
  // Built-in detection respects the NEXT_LOCALE cookie + Accept-Language.
  // middleware.ts pre-resolves the locale on cookie-less first visits so
  // non-Dutch browsers land on /en instead of /nl. defaultLocale stays
  // 'nl' as the final fallback when no Accept-Language is sent at all
  // (curl, server-to-server, etc.).
  localeDetection: true,
})
