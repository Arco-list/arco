"use client"

import { useMemo } from "react"
import { useProjectPreview } from "@/contexts/project-preview-context"
import { useProjectGalleryModal } from "@/contexts/project-gallery-modal-context"
import { GalleryGrid } from "@/components/gallery-grid"

export function ProjectGallery() {
  const { hero } = useProjectPreview()
  const { openModal } = useProjectGalleryModal()

  const galleryImages = useMemo(() => {
    const all = [] as {
      src: string
      alt: string
      isPrimary?: boolean
    }[]

    if (hero.coverPhoto) {
      all.push({
        src: hero.coverPhoto.url,
        alt: hero.coverPhoto.alt,
        isPrimary: true,
      })
    }

    hero.secondaryPhotos.forEach((photo) => {
      all.push({
        src: photo.url,
        alt: photo.alt,
        isPrimary: photo.isPrimary,
      })
    })

    if (all.length === 0 && hero.groups.length > 0) {
      // Fallback to the first group if no hero photos are defined
      const firstGroup = hero.groups[0]
      firstGroup.photos.forEach((photo, index) => {
        all.push({
          src: photo.url,
          alt: photo.alt,
          isPrimary: index === 0 || photo.isPrimary,
        })
      })
    }

    return all
  }, [hero.coverPhoto, hero.groups, hero.secondaryPhotos])

  const galleryIsInteractive = hero.groups.some((group) => group.photos.length > 0)

  return (
    <div className="space-y-4">
      <GalleryGrid
        images={galleryImages}
        interactive={galleryIsInteractive}
        showOverlay
        onOpen={() => openModal()}
      />
    </div>
  )
}
