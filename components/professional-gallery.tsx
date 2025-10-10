"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, ArrowLeft, Share, Heart } from "lucide-react"

import type { ProfessionalGalleryImage } from "@/lib/professionals/types"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const PLACEHOLDER_IMAGE = {
  src: "/placeholder.svg",
  alt: "Professional gallery placeholder",
}

type ProfessionalGalleryProps = {
  professionalName: string
  images: ProfessionalGalleryImage[]
}

export function ProfessionalGallery({ professionalName, images }: ProfessionalGalleryProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)

  const galleryImages = useMemo(() => {
    if (images.length === 0) {
      return [
        {
          src: PLACEHOLDER_IMAGE.src,
          alt: `Placeholder image for ${professionalName}`,
        },
      ]
    }

    return images.map((image, index) => ({
      src: image.url || PLACEHOLDER_IMAGE.src,
      alt: image.altText || `Photo ${index + 1} of ${professionalName}`,
    }))
  }, [images, professionalName])

  const displayImages = useMemo(() => {
    const desiredCount = 5
    const slice = galleryImages.slice(0, desiredCount)

    if (slice.length < desiredCount) {
      return [
        ...slice,
        ...Array.from({ length: desiredCount - slice.length }, () => PLACEHOLDER_IMAGE),
      ]
    }

    return slice
  }, [galleryImages])

  const totalImages = galleryImages.length
  const galleryIsInteractive = totalImages > 0

  const openModal = (index = 0) => {
    setCurrentPhotoIndex(index)
    setIsModalOpen(true)
  }

  const nextPhoto = () => {
    setCurrentPhotoIndex((previous) => (previous + 1) % totalImages)
  }

  const prevPhoto = () => {
    setCurrentPhotoIndex((previous) => (previous - 1 + totalImages) % totalImages)
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:items-stretch">
        <button
          type="button"
          onClick={() => openModal(0)}
          className={cn(
            "group relative overflow-hidden rounded-xl bg-gray-100 transition-transform",
            "aspect-[4/3] md:aspect-auto md:min-h-[420px] md:h-full",
            galleryIsInteractive ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black" : "cursor-default",
          )}
          disabled={!galleryIsInteractive}
        >
          <img
            src={displayImages[0]?.src || PLACEHOLDER_IMAGE.src}
            alt={displayImages[0]?.alt || PLACEHOLDER_IMAGE.alt}
            className={cn(
              "h-full w-full object-cover transition-transform duration-300 ease-out",
              galleryIsInteractive && "group-hover:scale-105",
            )}
          />
        </button>

        <div className="grid grid-cols-2 gap-4 md:h-full md:min-h-[420px] md:grid-rows-[repeat(2,minmax(0,1fr))]">
          {displayImages.slice(1, 5).map((image, index) => {
            const resolvedImage = image ?? PLACEHOLDER_IMAGE

            return (
              <button
                key={`professional-gallery-tile-${index}`}
                type="button"
                onClick={() => openModal(index + 1)}
                className={cn(
                  "group relative overflow-hidden rounded-xl bg-gray-100",
                  "aspect-square md:aspect-auto md:h-full",
                  galleryIsInteractive
                    ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                    : "cursor-default",
                )}
                disabled={!galleryIsInteractive}
              >
                <img
                  src={resolvedImage.src}
                  alt={resolvedImage.alt}
                  className={cn(
                    "h-full w-full object-cover transition-transform duration-300 ease-out",
                    galleryIsInteractive && "group-hover:scale-105",
                  )}
                />
              </button>
            )
          })}
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          showCloseButton={false}
          className="!max-w-none !w-screen !h-screen p-0 bg-black border-none overflow-hidden !m-0 !translate-x-0 !translate-y-0 !top-0 !left-0 !rounded-none"
        >
          <div className="relative flex h-full w-full flex-col">
            <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/90 to-transparent p-4 md:p-6">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10"
                onClick={() => setIsModalOpen(false)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              <div className="text-white font-medium">
                {totalImages > 0 ? `${currentPhotoIndex + 1}/${totalImages}` : ""}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                  <Share className="mr-2 h-4 w-4" />
                  Share
                </Button>
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                  <Heart className="mr-2 h-4 w-4" />
                  Save
                </Button>
              </div>
            </div>

            <div className="flex flex-1 items-center justify-center p-8 md:p-16">
              <img
                src={galleryImages[currentPhotoIndex]?.src || PLACEHOLDER_IMAGE.src}
                alt={galleryImages[currentPhotoIndex]?.alt || PLACEHOLDER_IMAGE.alt}
                className="max-h-full max-w-full object-contain"
              />
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10"
              onClick={prevPhoto}
              disabled={totalImages <= 1}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10"
              onClick={nextPhoto}
              disabled={totalImages <= 1}
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
