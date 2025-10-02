import type React from "react"
import type { Metadata } from "next"
import { Poppins } from "next/font/google"
import "./globals.css"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { RootProviders } from "@/components/root-providers"

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

  const session = sessionData.session
    ? {
        ...sessionData.session,
        user: userData.user ?? sessionData.session.user,
      }
    : null

  return (
    <html lang="en" className={poppins.variable}>
      <body className={poppins.className}>
        <RootProviders initialSession={session}>{children}</RootProviders>
      </body>
    </html>
  )
}
