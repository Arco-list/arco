"use client"

import { useProjectPreview } from "@/contexts/project-preview-context"

export function ProjectDetails() {
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
            <p className="text-sm text-gray-500">{detail.label}</p>
            <p className="text-sm font-medium text-gray-900">{detail.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
