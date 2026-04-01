"use client"

import { useCallback, useEffect, useRef } from "react"
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
import { trackPageView } from "@/lib/tracking"
import type { PreloadedCompany } from "@/app/businesses/actions"

interface ProfessionalsLandingClientProps {
  preloadedCompany?: PreloadedCompany | null
  inviteEmail?: string | null
}

export default function ProfessionalsLandingClient({
  preloadedCompany,
  inviteEmail,
}: ProfessionalsLandingClientProps) {
  const { user } = useAuth()
  const { openLoginModal } = useLoginModal()
  const { openCreateCompanyModal } = useCreateCompanyModal()
  const t = useTranslations("business.professionals")
  const tBusiness = useTranslations("business")
  const autoOpenedRef = useRef(false)

  useEffect(() => { trackPageView("/businesses/professionals") }, [])

  // Auto-open the claim modal when user is logged in and we have preloaded company data
  // (happens after auth redirect back to this page)
  useEffect(() => {
    if (user && preloadedCompany && !autoOpenedRef.current) {
      autoOpenedRef.current = true
      openCreateCompanyModal(preloadedCompany)
    }
  }, [user, preloadedCompany, openCreateCompanyModal])

  const professionalBenefits = getProfessionalBenefits(t)
  const professionalSteps = getProfessionalSteps(t)
  const professionalFAQ = getProfessionalFAQ(t)
  const endorsements = getEndorsements(t)

  // Build the redirect URL that preserves the inviteEmail param
  const selfUrl = inviteEmail
    ? `/businesses/professionals?inviteEmail=${encodeURIComponent(inviteEmail)}`
    : "/create-company"

  const handleCTA = useCallback(() => {
    if (!user) {
      openLoginModal(selfUrl)
      return
    }
    openCreateCompanyModal(preloadedCompany ?? undefined)
  }, [user, openLoginModal, openCreateCompanyModal, preloadedCompany, selfUrl])

  const ctaLabel = preloadedCompany
    ? t("cta_claim_button", { company: preloadedCompany.name })
    : t("cta_button")

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
          {ctaLabel}
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
