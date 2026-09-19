"use client"

import { useTranslations } from "next-intl"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { FAQSection } from "@/components/landing"
import { PricingContributorCta, PricingSection } from "@/components/pricing-section"
import { useAuth } from "@/contexts/auth-context"

export function PricingClient() {
  const t = useTranslations("dashboard")
  const { user, profile } = useAuth()

  const userTypes = profile?.user_types as string[] | null
  const hasProfessionalRole = userTypes?.includes("professional") ?? false

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Dashboard nav for a signed-in professional, public marketing nav
          otherwise: one page serves the member comparing plans and the
          invited contributor weighing the price before signing up. */}
      {user && hasProfessionalRole ? (
        <Header navLinks={[
          { href: "/dashboard/listings", label: t("listings") },
          { href: "/dashboard/company", label: t("company") },
          { href: "/dashboard/team", label: t("team") },
          { href: "/dashboard/inbox", label: t("inbox") },
          { href: "/dashboard/subscription", label: t("subscription") },
        ]} />
      ) : (
        <Header />
      )}

      <main className="flex-1" style={{ paddingTop: 120 }}>
        <PricingSection />

        <FAQSection
          heading={t("pricing_faq_title")}
          items={[
            { question: t("pricing_faq_q1"), answer: t("pricing_faq_a1") },
            { question: t("pricing_faq_q4"), answer: t("pricing_faq_a4") },
            { question: t("pricing_faq_q2"), answer: t("pricing_faq_a2") },
            { question: t("pricing_faq_q3"), answer: t("pricing_faq_a3") },
            { question: t("pricing_faq_q5"), answer: t("pricing_faq_a5") },
            { question: t("pricing_faq_q6"), answer: t("pricing_faq_a6") },
          ]}
          paddingTop={56}
        />

        {/* Closing ask — after the FAQ has handled objections. */}
        <PricingContributorCta />
      </main>

      <Footer />
    </div>
  )
}
