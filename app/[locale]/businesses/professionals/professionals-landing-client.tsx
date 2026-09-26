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
import { PricingContributorCta, PricingSection } from "@/components/pricing-section"
import { ProfessionalCarousel, type ProfessionalCarouselCard } from "@/components/landing/professional-carousel"
import {
  getProfessionalBenefits,
  getProfessionalSteps,
  getProfessionalFAQ,
} from "./data"
import { useAuth } from "@/contexts/auth-context"
import { Link, useRouter } from "@/i18n/navigation"
import { trackPageView } from "@/lib/tracking"
import type { PreloadedCompany } from "@/app/businesses/actions"

interface ProfessionalsLandingClientProps {
  preloadedCompany?: PreloadedCompany | null
  inviteEmail?: string | null
  recentProfessionals?: ProfessionalCarouselCard[]
}

export default function ProfessionalsLandingClient({
  preloadedCompany,
  inviteEmail,
  recentProfessionals = [],
}: ProfessionalsLandingClientProps) {
  const { user } = useAuth()
  const router = useRouter()
  const t = useTranslations("business.professionals")
  const tBusiness = useTranslations("business")
  const autoOpenedRef = useRef(false)

  useEffect(() => {
    trackPageView("/businesses/professionals")
    // Advance the invite prospect to "visitor" — mirrors the ?ref
    // tracking on /businesses/architects. The invite claim URL carries
    // inviteEmail instead of ref, and the tracker resolves prospects by
    // email, so without this a clicked Invite email never moved the
    // contact past "Contacted".
    if (inviteEmail) {
      fetch(`/api/prospect-track?ref=${encodeURIComponent(inviteEmail)}`).catch(() => {})
    }
  }, [inviteEmail])

  /**
   * One door, and it is /claim.
   *
   * This page used to run its own signup: a login modal, then a
   * create-company modal, with /create-company as the fallback
   * destination. That made it a second entrance next to the claim
   * funnel — invisible to anything that counts arrivals on /claim, so a
   * pro who came in this way appeared in no channel at all.
   *
   * A preloaded company here is a Google Places result, not an Arco
   * row, so it travels as ?p= — the parameter /claim resolves
   * client-side. No login modal either: /claim asks for an account on
   * its own last step, and asking twice was never the point.
   */
  const claimHref = preloadedCompany?.placeId
    ? `/claim?p=${encodeURIComponent(preloadedCompany.placeId)}`
    : "/claim"

  // A signed-in visitor arriving with company data in hand has already
  // chosen; send them on to the funnel rather than showing the pitch
  // again. Fires once — the ref guards against the effect re-running
  // when auth state settles.
  useEffect(() => {
    if (user && preloadedCompany && !autoOpenedRef.current) {
      autoOpenedRef.current = true
      router.push(claimHref)
    }
  }, [user, preloadedCompany, router, claimHref])

  const professionalBenefits = getProfessionalBenefits(t)
  const professionalSteps = getProfessionalSteps(t)
  const professionalFAQ = getProfessionalFAQ(t)

  const handleCTA = useCallback(() => {
    router.push(claimHref)
  }, [router, claimHref])

  const ctaLabel = preloadedCompany
    ? t("cta_claim_button", { company: preloadedCompany.name })
    : null

  return (
    <>
      <Header />

      <HeroSection
        audience="professionals"
        title={t("hero_title")}
        body={t("hero_body")}
      >
        {preloadedCompany ? (
          /* Oude mail-links (inviteEmail-flow) blijven op de modal tot
             de laatste verstuurde mails uitgewerkt zijn. */
          <button
            type="button"
            onClick={handleCTA}
            className="landing-cta"
          >
            {ctaLabel}
          </button>
        ) : (
          /* Fase 3: de platform-instap is /claim — zelfde knop en copy
             als op /businesses/architects. */
          <Link href="/claim" className="landing-cta">
            {t("cta_claim")}
          </Link>
        )}
      </HeroSection>

      {recentProfessionals.length > 0 && (
        <ProfessionalCarousel professionals={recentProfessionals} />
      )}

      <BenefitsGrid benefits={professionalBenefits} />
      <HowItWorks steps={professionalSteps} heading={tBusiness("how_it_works")} />

      {/* Pricing on the landing itself — this page is where invited
          contributors arrive (inviteEmail flow), so the founding price
          must be visible before they're asked to sign up. Explicit white
          background so it never inherits a section tint. */}
      <section style={{ paddingTop: 60, background: "#ffffff" }}>
        <PricingSection embedded />
      </section>

      <FAQSection items={professionalFAQ} paddingTop={60} heading={tBusiness("faq_heading")} />

      {/* Closing ask — after the FAQ has handled objections. */}
      <PricingContributorCta showLandingLink={false} />

      <Footer />
    </>
  )
}
