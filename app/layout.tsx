import type React from "react"
import type { Metadata } from "next"
import { Cormorant_Garamond } from "next/font/google"
import { SpeedInsights } from "@vercel/speed-insights/next"
import "./globals.css"
import { getSiteUrl } from "@/lib/utils"

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Arco - Connect with Architecture & Design Professionals",
    template: "%s | Arco",
  },
  description:
    "Find and collaborate with top architecture, interior design, and construction professionals in the Netherlands. Post projects, browse portfolios, and bring your vision to life.",
  keywords: [
    "architecture",
    "interior design",
    "construction",
    "professionals",
    "Netherlands",
    "renovation",
    "building projects",
  ],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
      // Google's SERP favicon picker wants a raster icon that's a
      // multiple of 48px declared via <link rel="icon">; without these
      // it falls back to the 16/32px .ico and renders the logo as a
      // tiny badge inside its circle instead of full-bleed.
      { url: "/android-chrome-192x192.png", type: "image/png", sizes: "192x192" },
      { url: "/android-chrome-512x512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html suppressHydrationWarning className={cormorant.variable}>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}
