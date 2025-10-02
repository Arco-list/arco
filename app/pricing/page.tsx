import type { Metadata } from "next"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { PricingSection } from "@/components/pricing-section"
import { Faq1 } from "@/components/faq1"

export const metadata: Metadata = {
  title: "Pricing Plans",
  description: "Choose the perfect plan for your needs. Free for homeowners, flexible subscription options for professionals.",
}

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <PricingSection />
        <Faq1 />
      </main>
      <Footer />
    </div>
  )
}
