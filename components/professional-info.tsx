"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Share, Bookmark, Star } from "lucide-react"
import { ReportModal } from "./report-modal"
import { ShareModal } from "./share-modal"

export function ProfessionalInfo({ professionalData }: { professionalData: any }) {
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="text-sm text-gray-500">Professionals &gt; Amsterdam &gt; Architecture &gt; Architect</div>

          {/* Action buttons - moved to same row as breadcrumbs */}
          <div className="flex gap-2">
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

      {/* Professional title and description */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-black">{professionalData.name}</h1>
        <h2 className="text-xl text-gray-600">{professionalData.title}</h2>

        {/* Rating */}
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-medium ml-1">{professionalData.rating}</span>
          </div>
          <span className="text-sm text-gray-500">({professionalData.reviewCount} reviews)</span>
        </div>
      </div>

      <div className="border-t border-b border-gray-200 py-6">
        <h3 className="text-xl font-semibold text-black mb-6">Meet the professional</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Services</h4>
              <p className="text-gray-600">Architect, Interior design</p>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">Languages</h4>
              <p className="text-gray-600">Dutch, English, French</p>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">Address</h4>
              <p className="text-gray-600">Amsterdam, Netherlands</p>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Certificates</h4>
              <p className="text-gray-600">RIBA Chartered Architect, BNA Registered</p>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">Joined</h4>
              <p className="text-gray-600">2022</p>
            </div>
          </div>
        </div>
      </div>

      <ReportModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} listingType="professional" />
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title={professionalData.name}
        subtitle={professionalData.title}
        imageUrl="/placeholder.svg?height=64&width=64"
        shareUrl={typeof window !== "undefined" ? window.location.href : ""}
      />
    </div>
  )
}
