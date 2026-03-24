"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
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
  professionalBenefits,
  professionalSteps,
  professionalFAQ,
  endorsements,
} from "./data"
import { useAuth } from "@/contexts/auth-context"
import { useLoginModal } from "@/contexts/login-modal-context"
import { useCreateCompanyModal } from "@/contexts/create-company-modal-context"

export default function ProfessionalsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { openLoginModal } = useLoginModal()
  const { openCreateCompanyModal } = useCreateCompanyModal()

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
        title="Be recognised through the work you've delivered."
        body="Arco is a curated architecture network where professionals are credited on real projects. When architects tag you, clients see your work and can reach out directly."
      >
        <button
          type="button"
          onClick={handleCTA}
          className="landing-cta"
        >
          Create your company →
        </button>
      </HeroSection>

      <BenefitsGrid benefits={professionalBenefits} />
      <HowItWorks steps={professionalSteps} />

      <EndorsementCarousel
        endorsements={endorsements}
        subtitle="The professionals on Arco are here because an architect vouched for their work."
      />

      <FAQSection items={professionalFAQ} paddingTop={60} />

      <Footer />
    </>
  )
}
