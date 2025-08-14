import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Faq12 } from "@/components/faq12"

export default function HelpCenterPage() {
  return (
    <>
      <Header />
      <main className="flex items-center justify-center">
        <Faq12 />
      </main>
      <Footer />
    </>
  )
}
