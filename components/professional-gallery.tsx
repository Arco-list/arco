"use client"

import { useMemo } from "react"
import { GalleryGrid } from "@/components/gallery-grid"
import { useProfessionalGalleryModal, useProfessionalGalleryData } from "@/contexts/professional-gallery-modal-context"

export function ProfessionalGallery() {
  const { openModal } = useProfessionalGalleryModal()
  const { groups } = useProfessionalGalleryData()

  // Flatten all images for the gallery grid display
  const galleryImages = useMemo(() => {
    return groups.flatMap((group) =>
      group.photos.map((photo) => ({
        src: photo.url,
        alt: photo.alt,
      }))
    )
  }, [groups])

  const hasImages = galleryImages.length > 0

  return (
    <div className="space-y-4">
      <GalleryGrid
        images={galleryImages}
        interactive={hasImages}
        onOpen={() => openModal()}
        showOverlay={true}
      />
    </div>
  )
}
