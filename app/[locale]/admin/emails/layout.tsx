import type { Metadata } from "next"

/** De pagina zelf is een clientcomponent en kan geen metadata
 *  exporteren; een layout ernaast wel. */
export const metadata: Metadata = { title: "Emails" }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
