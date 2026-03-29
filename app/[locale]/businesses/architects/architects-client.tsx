"use client"

import { useCallback, useEffect, useState } from "react"
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
import { getArchitectBenefits, getArchitectSteps, getArchitectFAQ } from "./data"

interface ArchitectsClientProps {
  projects: ProjectCard[]
}

export function ArchitectsClient({ projects }: ArchitectsClientProps) {
  const searchParams = useSearchParams()
  const [pendingImportUrl, setPendingImportUrl] = useState<string | null>(null)

  // Track prospect landing visit from ref param
  useEffect(() => {
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

  return (
    <>
      <Header />

      <HeroSection
        audience="architects"
        title={t("hero_title")}
        body={t("hero_body")}
      >
        <LinkInputRow
          placeholder={t("cta_placeholder")}
          buttonLabel={t("cta_button")}
          onSubmit={handleSubmit}
        />
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
