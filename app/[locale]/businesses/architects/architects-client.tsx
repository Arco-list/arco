"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { trackPageView } from "@/lib/tracking"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import {
  HeroSection,
  LinkInputRow,
  BenefitsGrid,
  HowItWorks,
  FAQSection,
} from "@/components/landing"
import { ProjectCarousel, type ProjectCard } from "@/components/landing/project-carousel"
import { ImportFlowOrchestrator } from "@/components/import-flow-orchestrator"
import { useAuth } from "@/contexts/auth-context"
import { useLoginModal } from "@/contexts/login-modal-context"
import { useCreateCompanyModal } from "@/contexts/create-company-modal-context"
import { getArchitectBenefits, getArchitectSteps, getArchitectFAQ } from "./data"
import type { PreloadedCompany } from "@/app/businesses/actions"

interface ArchitectsClientProps {
  projects: ProjectCard[]
  preloadedCompany?: PreloadedCompany | null
  inviteEmail?: string | null
}

export function ArchitectsClient({ projects, preloadedCompany, inviteEmail }: ArchitectsClientProps) {
  const searchParams = useSearchParams()
  const [pendingImportUrl, setPendingImportUrl] = useState<string | null>(null)
  const { user } = useAuth()
  const { openLoginModal } = useLoginModal()
  const { openCreateCompanyModal } = useCreateCompanyModal()
  const autoOpenedRef = useRef(false)

  // Track prospect landing visit from ref param
  useEffect(() => {
    trackPageView("/businesses/architects")
    const ref = searchParams.get("ref")
    if (ref) {
      fetch(`/api/prospect-track?ref=${encodeURIComponent(ref)}`).catch(() => {})
    }
  }, [searchParams])
  const t = useTranslations("business.architects")
  const tBusiness = useTranslations("business")

  const architectBenefits = getArchitectBenefits(t)
  const architectSteps = getArchitectSteps(t)
  const architectFAQ = getArchitectFAQ(t)

  // Auto-open claim modal when user is logged in and we have preloaded company data
  useEffect(() => {
    if (user && preloadedCompany && !autoOpenedRef.current) {
      autoOpenedRef.current = true
      openCreateCompanyModal(preloadedCompany)
    }
  }, [user, preloadedCompany, openCreateCompanyModal])

  // Resume flow if redirected back with ?url= param (e.g. after login)
  useEffect(() => {
    const urlParam = searchParams.get("url")
    if (urlParam && !pendingImportUrl) {
      setPendingImportUrl(urlParam)
    }
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = useCallback((url: string) => {
    setPendingImportUrl(url)
  }, [])

  const selfUrl = inviteEmail
    ? `/businesses/architects?inviteEmail=${encodeURIComponent(inviteEmail)}`
    : "/businesses/architects"

  const handleClaim = useCallback(() => {
    if (!user) {
      openLoginModal(selfUrl)
      return
    }
    openCreateCompanyModal(preloadedCompany ?? undefined)
  }, [user, openLoginModal, openCreateCompanyModal, preloadedCompany, selfUrl])

  return (
    <>
      <Header />

      <HeroSection
        audience="architects"
        title={t("hero_title")}
        body={t("hero_body")}
      >
        {preloadedCompany ? (
          <button
            type="button"
            onClick={handleClaim}
            className="landing-cta"
          >
            Claim {preloadedCompany.name}
          </button>
        ) : (
          <LinkInputRow
            placeholder={t("cta_placeholder")}
            buttonLabel={t("cta_button")}
            onSubmit={handleSubmit}
          />
        )}
      </HeroSection>

      <ProjectCarousel projects={projects} />

      <BenefitsGrid benefits={architectBenefits} />
      <HowItWorks steps={architectSteps} heading={tBusiness("how_it_works")} />
      <FAQSection items={architectFAQ} heading={tBusiness("faq_heading")} />

      <Footer />

      <ImportFlowOrchestrator
        pendingUrl={pendingImportUrl}
        onReset={() => setPendingImportUrl(null)}
      />
    </>
  )
}
