"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { IntroductionRequestModal } from "@/components/introduction-request-modal"

interface IntroductionButtonProps {
  companyId: string
  companyName: string
  companyLogoUrl: string | null
  companyInitials: string
  subtitle: string | null
}

export function IntroductionButton({
  companyId,
  companyName,
  companyLogoUrl,
  companyInitials,
  subtitle,
}: IntroductionButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const t = useTranslations("professional_detail")

  return (
    <>
      <button
        type="button"
        className="btn-contact"
        onClick={() => setIsOpen(true)}
      >
        {t("request_introduction")}
      </button>

      <IntroductionRequestModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        companyId={companyId}
        companyName={companyName}
        companyLogoUrl={companyLogoUrl}
        companyInitials={companyInitials}
        subtitle={subtitle}
      />
    </>
  )
}
