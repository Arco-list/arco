"use client"

import { useState } from "react"
import { useProjectPreview } from "@/contexts/project-preview-context"
import { ReportModal } from "./report-modal"

export function ProjectDetails() {
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const { metaDetails } = useProjectPreview()

  if (metaDetails.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-black">About the project</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metaDetails.map((detail) => (
          <div key={detail.label} className="space-y-1">
            <p className="text-sm text-text-secondary">{detail.label}</p>
            <p className="text-sm font-medium text-foreground">{detail.value}</p>
          </div>
        ))}
      </div>

      <button
        className="text-sm text-text-secondary hover:text-foreground underline mt-4"
        onClick={() => setIsReportModalOpen(true)}
      >
        Report this listing
      </button>

      <ReportModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} listingType="project" />
    </div>
  )
}
