"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useProjectPreview } from "@/contexts/project-preview-context"
import { ReportModal } from "./report-modal"

export function ProjectDetails() {
  const t = useTranslations("project_detail")
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const { metaDetails } = useProjectPreview()

  if (metaDetails.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <h2 className="heading-3 font-bold text-black">{t("about_the_project")}</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metaDetails.map((detail) => (
          <div key={detail.label} className="space-y-1">
            <p className="body-small text-text-secondary">{detail.label}</p>
            <p className="body-small font-medium text-foreground">{detail.value}</p>
          </div>
        ))}
      </div>

      <button
        className="body-small text-text-secondary hover:text-foreground underline mt-4"
        onClick={() => setIsReportModalOpen(true)}
      >
        {t("report_this_listing")}
      </button>

      <ReportModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} listingType="project" />
    </div>
  )
}
