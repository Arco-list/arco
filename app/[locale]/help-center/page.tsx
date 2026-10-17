import type { Metadata } from "next"
import { arcoPageMeta } from "@/lib/seo/copy"
import { localeAlternates } from "@/lib/seo-utils"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Faq12 } from "@/components/faq12"

/** Was een statische `metadata` met een Engelse titel én een omschrijving
 *  die nog de marktplaats beschreef ("post projects, hire professionals")
 *  die met /new-project is verdwenen. Als generateMetadata kan hij bij de
 *  locale, en daarmee ook aan canonical + hreflang. */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  return {
    ...arcoPageMeta("/help-center", locale),
    alternates: localeAlternates(locale, "/help-center"),
  }
}

export default function HelpCenterPage() {
  return (
    <>
      <Header />
      <main>
        <Faq12 />
      </main>
      <Footer />
    </>
  )
}
