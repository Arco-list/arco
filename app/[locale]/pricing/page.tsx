import type { Metadata } from "next"
import { arcoPageMeta } from "@/lib/seo/copy"

import { localeAlternates } from "@/lib/seo-utils"

import { PricingClient } from "./pricing-client"

/**
 * Plans and pricing — one page, for everyone.
 *
 * It lived at /dashboard/pricing with this route importing it, because
 * the page is a client component and only a server file may export
 * metadata. The wrapper is the right half of that arrangement; the
 * second route was not. Pricing is public — the contributor-pays model
 * only works if an invited professional can read the price BEFORE
 * signing up — and a member reaching it from the dashboard sees the
 * same page with the dashboard's own nav.
 *
 * What a member manages rather than compares lives at
 * /dashboard/subscription, which is where "Abonnement" now leads.
 */
/**
 * Statische `metadata` kon de locale niet lezen, dus deze pagina gaf
 * geen canonical en geen hreflang — net als de homepagina en /about.
 * Zonder die twee kiest Google zelf welke URL en welke taalversie hij
 * toont, en dat deed hij ook: de locale-loze variant stond boven de
 * canonieke. Als generateMetadata kan hij wel bij `params`.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  return {
    ...arcoPageMeta("/pricing", locale),
    alternates: localeAlternates(locale, "/pricing"),
  }
}

export default function PricingPage() {
  return <PricingClient />
}
