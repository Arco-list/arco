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
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "ogvobdcrectqsegqrquz.supabase.co" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**" },
    ],
  },
  // Note: the apex→www redirect is handled by Vercel domain config
  // (arcolist.com is set to redirect to www.arcolist.com in Vercel
  // Settings → Domains). We deliberately do NOT add a Next.js redirect
  // here — adding one in either direction creates a loop with Vercel's
  // own redirect. The canonical host is www.arcolist.com.
}

export default withNextIntl(nextConfig)
