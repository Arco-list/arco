import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/styles', '/admin', '/dashboard'],
    },
    sitemap: 'https://arco.com/sitemap.xml',
  }
}
