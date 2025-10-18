import type React from "react"
import type { Metadata } from "next"
import { Poppins } from "next/font/google"
import "./globals.css"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { RootProviders } from "@/components/root-providers"
import { buildSession } from "@/lib/auth-utils"

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "Arco - Connect with Architecture & Design Professionals",
    template: "%s | Arco",
  },
  description: "Find and collaborate with top architecture, interior design, and construction professionals in the Netherlands. Post projects, browse portfolios, and bring your vision to life.",
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
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await createServerSupabaseClient()
  const [{ data: sessionData }, { data: userData }] = await Promise.all([
    supabase.auth.getSession(),
    supabase.auth.getUser(),
  ])

  const session = buildSession(sessionData.session, userData.user)

  return (
    <html lang="en" className={poppins.variable}>
      <body className={poppins.className}>
        <RootProviders initialSession={session}>{children}</RootProviders>
      </body>
    </html>
  )
}
