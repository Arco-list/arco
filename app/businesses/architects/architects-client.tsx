"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
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
import { architectBenefits, architectSteps, architectFAQ } from "./data"

interface ArchitectsClientProps {
  projects: ProjectCard[]
}

export function ArchitectsClient({ projects }: ArchitectsClientProps) {
  const searchParams = useSearchParams()
  const [pendingImportUrl, setPendingImportUrl] = useState<string | null>(null)

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
        title="Publish your work. Credit your team. Set the standard."
        body="Arco is a curated architecture platform where projects come first and recognition is earned through built work — not promotion."
      >
        <LinkInputRow
          placeholder="Paste a project link from your website"
          buttonLabel="Generate Project →"
          onSubmit={handleSubmit}
        />
      </HeroSection>

      <ProjectCarousel projects={projects} />

      <BenefitsGrid benefits={architectBenefits} />
      <HowItWorks steps={architectSteps} />
      <FAQSection items={architectFAQ} />

      <Footer />

      <ImportFlowOrchestrator
        pendingUrl={pendingImportUrl}
        onReset={() => setPendingImportUrl(null)}
      />
    </>
  )
}
