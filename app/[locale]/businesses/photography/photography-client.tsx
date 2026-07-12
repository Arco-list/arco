"use client"

import { useTranslations } from "next-intl"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { HeroSection } from "@/components/landing"
import { ProfessionalCard } from "@/components/professional-card"
import { useSavedProfessionals } from "@/contexts/saved-professionals-context"
import type { ProfessionalCard as ProfessionalCardData } from "@/lib/professionals/types"

interface PhotographyClientProps {
  photographers: ProfessionalCardData[]
}

export function PhotographyClient({ photographers }: PhotographyClientProps) {
  const t = useTranslations("business.photography")

  // Same saved-companies context as /professionals — heart button
  // writes to saved_companies keyed by company_id, so photographers
  // land in the same Saved list once the RPC is extended (migration
  // 196 in this commit).
  const { savedProfessionalIds, saveProfessional, removeProfessional, mutatingProfessionalIds } =
    useSavedProfessionals()

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <HeroSection
        audience="architects"
        title={t("hero_title")}
        body={t("hero_body")}
        showToggle={false}
        eyebrow={t("eyebrow")}
      />

      <section className="discover-results" style={{ paddingTop: 96 }}>
        <div className="wrap">
          <h2 className="arco-section-title" style={{ marginBottom: 24 }}>
            {t("browse_heading")}
          </h2>
          {photographers.length === 0 ? (
            <p className="arco-body-text" style={{ textAlign: "center", padding: "48px 0", color: "#a1a1a0" }}>
              {t("empty_state")}
            </p>
          ) : (
            <div className="discover-grid">
              {photographers.map((photographer) => {
                const id = photographer.id ?? ""
                const isSaved = id ? savedProfessionalIds.has(id) : false
                const isMutating = id ? mutatingProfessionalIds.has(id) : false
                return (
                  <ProfessionalCard
                    key={photographer.id}
                    professional={photographer}
                    isSaved={isSaved}
                    isMutating={isMutating}
                    onToggleSave={(prof) => {
                      if (isSaved) removeProfessional(id)
                      else saveProfessional(prof)
                    }}
                  />
                )
              })}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  )
}
