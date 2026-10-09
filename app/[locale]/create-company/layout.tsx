import type React from "react"
import type { Metadata } from "next"

import { NO_INDEX } from "@/lib/seo-utils"

/**
 * /create-company is a client component, and a client component cannot
 * export metadata — so the robots directive for this redirect shim has
 * to live in a layout. It still renders HTML before the redirect fires,
 * which is exactly what a crawler sees.
 */
export const metadata: Metadata = { robots: NO_INDEX }

export default function CreateCompanyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>
}
