"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, ArrowLeft, Share, Bookmark } from "lucide-react"

import type { ProfessionalGalleryImage } from "@/lib/professionals/types"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { GalleryGrid } from "@/components/gallery-grid"
import { ShareModal } from "./share-modal"
import { useSavedProfessionals } from "@/contexts/saved-professionals-context"

const PLACEHOLDER_IMAGE = {
  src: "/placeholder.svg",
  alt: "Professional gallery placeholder",
}

type ProfessionalGalleryProps = {
  professionalName: string
  images: ProfessionalGalleryImage[]
  companyId?: string
  coverImageUrl?: string | null
  shareUrl?: string
}

export function ProfessionalGallery({ professionalName, images, companyId, coverImageUrl, shareUrl }: ProfessionalGalleryProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)

  const { savedProfessionalIds, mutatingProfessionalIds, saveProfessional, removeProfessional } = useSavedProfessionals()

  const isSaved = companyId ? savedProfessionalIds.has(companyId) : false
  const isMutating = companyId ? mutatingProfessionalIds.has(companyId) : false

  const galleryImages = useMemo(() => {
    if (images.length === 0) {
      return []
    }

    return images
      .map((image, index) => ({ image, index }))
      .sort((first, second) => {
        const coverDifference = Number(second.image.isCover ?? false) - Number(first.image.isCover ?? false)
        if (coverDifference !== 0) {
          return coverDifference
        }
        return first.index - second.index
      })
      .map((entry, index) => ({
        src: entry.image.url || PLACEHOLDER_IMAGE.src,
        alt: entry.image.altText || `Photo ${index + 1} of ${professionalName}`,
      }))
  }, [images, professionalName])

  const totalImages = galleryImages.length
  const galleryIsInteractive = totalImages > 0

  const openModal = (index = 0) => {
    if (!galleryIsInteractive) {
      return
    }

    const boundedIndex = Math.min(Math.max(index, 0), totalImages - 1)
    setCurrentPhotoIndex(boundedIndex)
    setIsModalOpen(true)
  }

  const nextPhoto = () => {
    setCurrentPhotoIndex((previous) => (previous + 1) % totalImages)
  }

  const prevPhoto = () => {
    setCurrentPhotoIndex((previous) => (previous - 1 + totalImages) % totalImages)
  }

  const modalImage = galleryImages[currentPhotoIndex] ?? PLACEHOLDER_IMAGE

  return (
    <div className="space-y-4">
      <GalleryGrid images={galleryImages} interactive={galleryIsInteractive} onOpen={openModal} />

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          showCloseButton={false}
          className="!max-w-none !w-screen !h-screen p-0 bg-black border-none overflow-hidden !m-0 !translate-x-0 !translate-y-0 !top-0 !left-0 !rounded-none"
        >
          <div className="relative flex h-full w-full flex-col">
            <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-3 md:p-4 bg-gradient-to-b from-black/90 to-transparent">
              <Button
                variant="tertiary"
                size="tertiary"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close gallery"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>

              <div className="absolute left-1/2 -translate-x-1/2 text-white font-medium">
                {totalImages > 0 ? `${currentPhotoIndex + 1}/${totalImages}` : ""}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/10 hover:text-white border-none bg-transparent"
                  onClick={() => setIsShareModalOpen(true)}
                >
                  <Share className="w-4 h-4 mr-2" />
                  Share
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={isSaved ? "text-white bg-white/20 hover:bg-white/30 border-none" : "text-white hover:bg-white/10 border-none bg-transparent"}
                  onClick={() => {
                    if (!companyId) return
                    if (isSaved) {
                      void removeProfessional(companyId)
                    } else {
                      void saveProfessional({
                        id: companyId,
                        companyId: companyId,
                        name: professionalName,
                        slug: shareUrl?.split('/').pop() || '',
                        profession: '',
                        location: '',
                        rating: 0,
                        reviewCount: 0,
                        image: coverImageUrl || '',
                        specialties: [],
                        isVerified: false,
                        domain: null,
                        professionalId: ''
                      })
                    }
                  }}
                  disabled={!companyId || isMutating}
                  aria-pressed={isSaved}
                >
                  <Bookmark className="w-4 h-4 mr-2" fill={isSaved ? "currentColor" : "none"} />
                  {isSaved ? "Saved" : "Save"}
                </Button>
              </div>
            </div>

            <div className="flex flex-1 items-center justify-center px-4 pb-12 pt-24 md:px-12 md:pt-28 md:pb-20">
              <img 
                src={modalImage.src} 
                alt={modalImage.alt} 
                className="mx-auto block max-h-[calc(100vh-9rem)] max-w-full object-contain" 
                role="img"
                aria-label={`${modalImage.alt} - ${currentPhotoIndex + 1} of ${totalImages}`}
              />
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={prevPhoto}
              disabled={totalImages <= 1}
              aria-label="Previous image"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={nextPhoto}
              disabled={totalImages <= 1}
              aria-label="Next image"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title={professionalName}
        subtitle=""
        imageUrl={coverImageUrl ?? "/placeholder.svg?height=64&width=64"}
        shareUrl={typeof window !== "undefined" ? window.location.href : shareUrl ?? ""}
      />
    </div>
  )
}
