"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import {
  HeroSection,
  BenefitsGrid,
  HowItWorks,
  FAQSection,
} from "@/components/landing"
import { EndorsementCarousel } from "@/components/ui/EndorsementCarousel"
import {
  getProfessionalBenefits,
  getProfessionalSteps,
  getProfessionalFAQ,
  getEndorsements,
} from "./data"
import { useAuth } from "@/contexts/auth-context"
import { useLoginModal } from "@/contexts/login-modal-context"
import { useCreateCompanyModal } from "@/contexts/create-company-modal-context"

export default function ProfessionalsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { openLoginModal } = useLoginModal()
  const { openCreateCompanyModal } = useCreateCompanyModal()
  const t = useTranslations("business.professionals")
  const tBusiness = useTranslations("business")

  const professionalBenefits = getProfessionalBenefits(t)
  const professionalSteps = getProfessionalSteps(t)
  const professionalFAQ = getProfessionalFAQ(t)
  const endorsements = getEndorsements(t)

  const handleCTA = useCallback(() => {
    if (!user) {
      openLoginModal("/create-company")
      return
    }
    openCreateCompanyModal()
  }, [user, openLoginModal, openCreateCompanyModal])

  return (
    <>
      <Header />

      <HeroSection
        audience="professionals"
        title={t("hero_title")}
        body={t("hero_body")}
      >
        <button
          type="button"
          onClick={handleCTA}
          className="landing-cta"
        >
          {t("cta_button")}
        </button>
      </HeroSection>

      <BenefitsGrid benefits={professionalBenefits} />
      <HowItWorks steps={professionalSteps} heading={tBusiness("how_it_works")} />

      <EndorsementCarousel
        endorsements={endorsements}
        subtitle={t("endorsement_subtitle")}
      />

      <FAQSection items={professionalFAQ} paddingTop={60} heading={tBusiness("faq_heading")} />

      <Footer />
    </>
  )
}
