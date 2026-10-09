import type React from "react"
import type { Metadata } from "next"

import { NO_INDEX } from "@/lib/seo-utils"

/**
 * The new-project wizard, kept out of search.
 *
 * A layout rather than six metadata exports: /new-project itself
 * redirects, but get-started, details, photos, professionals and import
 * are real pages, and none of them declared any metadata. Next merges
 * metadata down the tree, so one robots field here covers every step —
 * including steps added later, which is the point. A page that wants
 * its own title still gets one; only the robots field is inherited.
 */
export const metadata: Metadata = { robots: NO_INDEX }

export default function NewProjectLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>
}
