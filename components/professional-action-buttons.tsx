"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Bookmark, Share } from "lucide-react"
import { useTranslations } from "next-intl"
import { ShareModal } from "./share-modal"
import { useSavedProfessionals } from "@/contexts/saved-professionals-context"
import type { ProfessionalCard } from "@/lib/professionals/types"

interface ProfessionalActionButtonsProps {
  professional: ProfessionalCard
  professionalTitle?: string | null
  coverImageUrl?: string | null
  shareUrl: string
}

export function ProfessionalActionButtons({
  professional,
  professionalTitle,
  coverImageUrl,
  shareUrl,
}: ProfessionalActionButtonsProps) {
  const t = useTranslations("professional_detail")
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const { savedProfessionalIds, mutatingProfessionalIds, saveProfessional, removeProfessional } =
    useSavedProfessionals()

  const isSaved = professional.companyId ? savedProfessionalIds.has(professional.companyId) : false
  const isMutating = professional.companyId ? mutatingProfessionalIds.has(professional.companyId) : false

  return (
    <>
      <div className="flex gap-2">
        <Button variant="tertiary" size="tertiary" onClick={() => setIsShareModalOpen(true)}>
          <Share className="w-4 h-4 md:mr-2" />
          <span className="hidden md:inline">{t("share")}</span>
        </Button>
        <Button
          variant="tertiary"
          size="tertiary"
          className={isSaved ? "!bg-primary !text-white hover:!bg-primary-hover" : ""}
          onClick={() => {
            if (!professional.companyId) return
            if (isSaved) {
              void removeProfessional(professional.companyId)
            } else {
              void saveProfessional(professional)
            }
          }}
          disabled={!professional.companyId || isMutating}
          aria-pressed={isSaved}
        >
          <Bookmark className="w-4 h-4 md:mr-2" fill={isSaved ? "currentColor" : "none"} />
          <span className="hidden md:inline">{isSaved ? t("saved") : t("save")}</span>
        </Button>
      </div>

      <ShareModal shareType="professional"
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title={professional.name}
        subtitle={professionalTitle ?? professional.profession ?? ""}
        imageUrl={coverImageUrl ?? professional.image ?? "/placeholder.svg?height=64&width=64"}
        shareUrl={typeof window !== "undefined" ? window.location.href : shareUrl ?? ""}
      />
    </>
  )
}
