import type React from "react"

// Root layout — minimal wrapper, locale layout handles everything
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
