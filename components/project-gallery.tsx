"use client"

import { Button } from "@/components/ui/button"
import { MoreHorizontal } from "lucide-react"
import { useMemo, useState } from "react"
import { GroupedPicturesModal } from "@/components/grouped-pictures-modal"
import { useProjectPreview } from "@/contexts/project-preview-context"

const PLACEHOLDER_IMAGE = {
  src: "/placeholder.svg",
  alt: "Project photo placeholder",
}

export function ProjectGallery() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { hero } = useProjectPreview()

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

  const imageGroups = hero.groups.map((group) => ({
    category: group.title,
    description: group.description ?? undefined,
    images: group.photos.map((photo, index) => ({
      src: photo.url,
      alt: photo.alt,
      isPrimary: photo.isPrimary ?? index === 0,
    })),
  }))

  const openModal = () => {
    if (imageGroups.length === 0) {
      return
    }
    setIsModalOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* Main gallery grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[50vh] min-h-[400px]">
        {/* Large image */}
        <div className={`md:row-span-2 ${imageGroups.length ? "cursor-pointer" : ""}`} onClick={openModal}>
          <img
            src={displayImages[0]?.src || PLACEHOLDER_IMAGE.src}
            alt={displayImages[0]?.alt || PLACEHOLDER_IMAGE.alt}
            className="w-full h-full object-cover rounded-lg hover:opacity-90 transition-opacity"
          />
        </div>

        {/* Top right images */}
        <div className="grid grid-cols-2 gap-4 h-full">
          <div className={`${imageGroups.length ? "cursor-pointer" : ""}`} onClick={openModal}>
            <img
              src={displayImages[1]?.src || PLACEHOLDER_IMAGE.src}
              alt={displayImages[1]?.alt || PLACEHOLDER_IMAGE.alt}
              className="w-full h-full object-cover rounded-lg hover:opacity-90 transition-opacity"
            />
          </div>
          <div className={`${imageGroups.length ? "cursor-pointer" : ""}`} onClick={openModal}>
            <img
              src={displayImages[2]?.src || PLACEHOLDER_IMAGE.src}
              alt={displayImages[2]?.alt || PLACEHOLDER_IMAGE.alt}
              className="w-full h-full object-cover rounded-lg hover:opacity-90 transition-opacity"
            />
          </div>
        </div>

        {/* Bottom right images */}
        <div className="grid grid-cols-2 gap-4 h-full">
          <div className={`${imageGroups.length ? "cursor-pointer" : ""}`} onClick={openModal}>
            <img
              src={displayImages[3]?.src || PLACEHOLDER_IMAGE.src}
              alt={displayImages[3]?.alt || PLACEHOLDER_IMAGE.alt}
              className="w-full h-full object-cover rounded-lg hover:opacity-90 transition-opacity"
            />
          </div>
          <div className="relative">
            <div className={`${imageGroups.length ? "cursor-pointer" : ""}`} onClick={openModal}>
              <img
                src={displayImages[4]?.src || PLACEHOLDER_IMAGE.src}
                alt={displayImages[4]?.alt || PLACEHOLDER_IMAGE.alt}
                className="w-full h-full object-cover rounded-lg hover:opacity-90 transition-opacity"
              />
            </div>
            {imageGroups.length > 0 && (
              <div className="absolute inset-0 bg-white bg-opacity-80 rounded-lg flex items-center justify-center">
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-black text-white hover:bg-gray-800"
                  onClick={openModal}
                >
                  <MoreHorizontal className="w-4 h-4 mr-2" />
                  Show all photos
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <GroupedPicturesModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        imageGroups={imageGroups}
      />
    </div>
  )
}
