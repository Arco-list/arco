import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Two dev servers started from this directory share one .next and
  // clobber each other's webpack chunks — which surfaces as
  // "Cannot read properties of undefined (reading 'call')" inside
  // __webpack_require__ on a route that is perfectly fine. A second
  // server can set NEXT_DIST_DIR to keep its own build output; unset
  // (every normal run, and every deploy) this is exactly ".next".
  distDir: process.env.NEXT_DIST_DIR || ".next",
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Keep `sharp` external so its native `.node` binary survives the
  // Vercel serverless bundle. Without this, dynamic `await import("sharp")`
  // inside server actions (autoTagPhotosWithSpaces) can fail to load the
  // architecture-specific binary on the function runtime — sharp works
  // locally because the host has the right binary on disk, but Vercel's
  // Linux runtime needs the package required at runtime rather than
  // bundled by webpack. Same flag the Vercel + sharp docs recommend.
  serverExternalPackages: ["sharp"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "ogvobdcrectqsegqrquz.supabase.co" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**" },
      // Some imported photo sources (e.g. squarespace static hosts on
      // older portfolios) still serve over http. Mirror the https
      // wildcard so next/image accepts those URLs too.
      { protocol: "http", hostname: "**" },
    ],
  },
  // Note: the apex→www redirect is handled by Vercel domain config
  // (arcolist.com is set to redirect to www.arcolist.com in Vercel
  // Settings → Domains). We deliberately do NOT add a Next.js redirect
  // here — adding one in either direction creates a loop with Vercel's
  // own redirect. The canonical host is www.arcolist.com.
  async redirects() {
    return [
      // /admin/professionals was renamed to /admin/companies during the
      // company-centric refactor. Permanent redirect so old bookmarks
      // and external links land on the new route. Matches both the
      // locale-less form and the [locale] form.
      { source: "/admin/professionals", destination: "/admin/companies", permanent: true },
      { source: "/admin/professionals/:path*", destination: "/admin/companies/:path*", permanent: true },
      { source: "/:locale/admin/professionals", destination: "/:locale/admin/companies", permanent: true },
      { source: "/:locale/admin/professionals/:path*", destination: "/:locale/admin/companies/:path*", permanent: true },
    ]
  },
}

export default withNextIntl(nextConfig)
