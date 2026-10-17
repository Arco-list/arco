import type { Metadata } from "next"

import { arcoPageMeta } from "@/lib/seo/copy"

/**
 * Metadata voor /homeowner, in een layout omdat page.tsx 'use client' is.
 *
 * Een clientcomponent kan geen `metadata` exporteren, dus de pagina erfde
 * de `title.default` uit app/layout.tsx — een Engelse regel die geen
 * pagina bewust draagt. Een layout rendert op de server en kan dat wel.
 *
 * NOINDEX, met opzet. Dit is het ingelogde account: vier tabs met
 * opgeslagen projecten, opgeslagen professionals, berichten en
 * instellingen. Er is niets te vinden voor wie niet is ingelogd, en een
 * omschrijving zou suggereren van wel. De tabs blijven ?tab= — ze zijn
 * daarmee deelbaar en de terugknop werkt, en aparte routes zouden hier
 * niets toevoegen wat een noindex-pagina nodig heeft.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  return arcoPageMeta("/homeowner", locale)
}

export default function HomeownerLayout({ children }: { children: React.ReactNode }) {
  return children
}
