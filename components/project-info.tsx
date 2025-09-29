"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Heart, Share, Bookmark } from "lucide-react"
import { ReportModal } from "./report-modal"
import { ShareModal } from "./share-modal"

export function ProjectInfo() {
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="text-sm text-gray-500">Projects &gt; House &gt; Villa</div>

          {/* Action buttons - moved to same row as breadcrumbs */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Heart className="w-4 h-4 mr-2" />
              Like
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsShareModalOpen(true)}>
              <Share className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button variant="outline" size="sm">
              <Bookmark className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </div>

        <button
          className="text-sm text-gray-500 hover:text-gray-700 underline self-start sm:self-center"
          onClick={() => setIsReportModalOpen(true)}
        >
          Report this listing
        </button>
      </div>

      {/* Project title and description */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-black">Villa upgrade</h1>
        <h2 className="text-xl text-gray-600">Contemporary Villa in Nijmegen</h2>
        <p className="text-sm text-gray-500">Sponsored in 1999</p>

        <p className="text-gray-700 leading-relaxed">
          De omgeving van de villa is zeer dichtbij de uitgaansgebied, maar elementen is het eenvoudig te het een groot
          compleet tijdens het rustige, lichte bouwstijl en de vrijetijds activiteiten zijn voor de volledige in...
        </p>

        <Button variant="link" className="p-0 text-blue-600">
          Show more
        </Button>
      </div>

      <ReportModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} listingType="project" />
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title="Villa upgrade"
        subtitle="Contemporary Villa in Nijmegen"
        imageUrl="/placeholder.svg?height=64&width=64"
        shareUrl={typeof window !== "undefined" ? window.location.href : ""}
      />
    </div>
  )
}
