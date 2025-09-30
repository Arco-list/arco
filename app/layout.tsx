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
  title: "v0 App",
  description: "Created with v0",
  generator: "v0.app",
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
