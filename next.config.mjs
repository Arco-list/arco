import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
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
}

export default withNextIntl(nextConfig)
