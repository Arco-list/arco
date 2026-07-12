"use client"

import { useCallback } from "react"
import { useTranslations } from "next-intl"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { HeroSection } from "@/components/landing"
import { ProfessionalCard } from "@/components/professional-card"
import type { ProfessionalCard as ProfessionalCardData } from "@/lib/professionals/types"

interface PhotographyClientProps {
  photographers: ProfessionalCardData[]
}

export function PhotographyClient({ photographers }: PhotographyClientProps) {
  const t = useTranslations("business.photography")

  // Save state isn't wired for Phase 1 — this landing is admin-only
  // preview surface, and the /professionals grid already carries the
  // authoritative saved-companies flow. Passing a no-op onToggleSave
  // keeps the card visually consistent with the public list.
  const noop = useCallback(() => {}, [])

  return (
    <>
      <Header />

      <HeroSection
        audience="architects"
        title={t("hero_title")}
        body={t("hero_body")}
        showToggle={false}
      />

      <section className="discover-results">
        <div className="wrap">
          {photographers.length === 0 ? (
            <p className="arco-body-text" style={{ textAlign: "center", padding: "48px 0", color: "#a1a1a0" }}>
              {t("empty_state")}
            </p>
          ) : (
            <div className="discover-grid">
              {photographers.map((photographer) => (
                <ProfessionalCard
                  key={photographer.id}
                  professional={photographer}
                  isSaved={false}
                  isMutating={false}
                  onToggleSave={noop}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </>
  )
}
