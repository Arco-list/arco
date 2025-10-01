import type { Metadata } from "next"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Faq12 } from "@/components/faq12"

export const metadata: Metadata = {
  title: "Help Center",
  description: "Get answers to frequently asked questions about using Arco. Learn how to post projects, hire professionals, and get the most out of our platform.",
}

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
