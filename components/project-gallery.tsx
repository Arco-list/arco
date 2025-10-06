"use client"

import { Button } from "@/components/ui/button"
import { MoreHorizontal } from "lucide-react"
import { useMemo, useState } from "react"
import { GroupedPicturesModal } from "@/components/grouped-pictures-modal"
import { useProjectPreview } from "@/contexts/project-preview-context"
import { cn } from "@/lib/utils"

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

  const galleryIsInteractive = imageGroups.length > 0

  return (
    <div className="space-y-4">
      {/* Main gallery grid */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:items-stretch">
        <div
          className={cn(
            "group relative overflow-hidden rounded-xl bg-gray-100 transition-transform",
            "aspect-[4/3] md:aspect-auto md:min-h-[420px] md:h-full",
            galleryIsInteractive ? "cursor-pointer" : "cursor-default",
          )}
          onClick={galleryIsInteractive ? openModal : undefined}
        >
          <img
            src={displayImages[0]?.src || PLACEHOLDER_IMAGE.src}
            alt={displayImages[0]?.alt || PLACEHOLDER_IMAGE.alt}
            className={cn(
              "h-full w-full object-cover transition-transform duration-300 ease-out",
              galleryIsInteractive && "group-hover:scale-105",
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 md:h-full md:min-h-[420px] md:grid-rows-[repeat(2,minmax(0,1fr))]">
          {displayImages.slice(1, 5).map((image, index) => {
            const resolvedImage = image ?? PLACEHOLDER_IMAGE

            return (
              <div
                key={`gallery-tile-${index}`}
                className={cn(
                  "group relative overflow-hidden rounded-xl bg-gray-100",
                  "aspect-square md:aspect-auto md:h-full",
                  galleryIsInteractive ? "cursor-pointer" : "cursor-default",
                )}
                onClick={galleryIsInteractive ? openModal : undefined}
              >
                <img
                  src={resolvedImage.src}
                  alt={resolvedImage.alt}
                  className={cn(
                    "h-full w-full object-cover transition-transform duration-300 ease-out",
                    galleryIsInteractive && "group-hover:scale-105",
                  )}
                />

                {index === 3 && galleryIsInteractive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="bg-black text-white hover:bg-gray-800"
                      onClick={openModal}
                    >
                      <MoreHorizontal className="mr-2 h-4 w-4" />
                      Show all photos
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
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
