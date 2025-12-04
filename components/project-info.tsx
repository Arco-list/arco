"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useProjectPreview } from "@/contexts/project-preview-context"

export function ProjectInfo() {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const { info, locationLabel } = useProjectPreview()
  
  const descriptionHtml = info.descriptionHtml || ""
  const descriptionPlain = info.descriptionPlain || ""
  const MAX_CHARS = 200
  const shouldTruncate = descriptionPlain.length > MAX_CHARS
  const displayDescriptionHtml = shouldTruncate && !isDescriptionExpanded 
    ? descriptionPlain.substring(0, MAX_CHARS) + "..."
    : descriptionHtml

  return (
    <div className="space-y-4">
      {/* Project title and description */}
      <div className="space-y-2">
        <h1 className="heading-2 md:heading-1 font-semibold text-foreground" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.5px', lineHeight: '1.2' }}>{info.title}</h1>
        {info.subtitle && <h2 className="body-large md:heading-5 font-semibold text-foreground" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.3px', lineHeight: '1.2' }}>{info.subtitle}</h2>}
        {info.sponsoredLabel && (
          <p className="body-small text-text-secondary">
            {info.sponsoredLabel}
          </p>
        )}

        {descriptionHtml && (
          <div 
            className="text-foreground leading-relaxed prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:pl-1"
            dangerouslySetInnerHTML={{ __html: displayDescriptionHtml }}
          />
        )}

        {shouldTruncate && (
          <Button 
            variant="link" 
            className="p-0 text-red-600 hover:text-red-700"
            onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
          >
            {isDescriptionExpanded ? "Show less" : "Show more"}
          </Button>
        )}
      </div>
    </div>
  )
}
