"use client"

import { useMemo, type KeyboardEvent } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Expand } from "lucide-react"

import { cn } from "@/lib/utils"
import { sanitizeImageUrl, IMAGE_SIZES } from "@/lib/image-security"

type GalleryImage = {
  src: string
  alt: string
}

type GalleryGridProps = {
  images: GalleryImage[]
  interactive?: boolean
  onOpen?: (index: number) => void
  showOverlay?: boolean
}

const PLACEHOLDER_IMAGE = {
  src: "/placeholder.svg",
  alt: "Gallery placeholder image",
}

export function GalleryGrid({ images, interactive = true, onOpen, showOverlay = false }: GalleryGridProps) {
  const displayImages = useMemo(() => {
    const desiredCount = 5
    const slice = images.slice(0, desiredCount)

    if (slice.length < desiredCount) {
      return [
        ...slice,
        ...Array.from({ length: desiredCount - slice.length }, () => PLACEHOLDER_IMAGE),
      ]
    }

    return slice
  }, [images])

  const totalImages = images.length
  const galleryIsInteractive = interactive && totalImages > 0 && typeof onOpen === "function"

  const handleOpen = (index: number) => {
    if (!galleryIsInteractive) {
      return
    }

    onOpen(index)
  }

  const handleKeyActivate = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
    if (!galleryIsInteractive) {
      return
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      handleOpen(index)
    }
  }

  return (
    <div className="relative grid gap-2 h-[480px] max-h-[480px] min-h-0 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:h-[560px] lg:max-h-[560px]">
      <div
        role={galleryIsInteractive ? "button" : undefined}
        tabIndex={galleryIsInteractive ? 0 : undefined}
        onClick={galleryIsInteractive ? () => handleOpen(0) : undefined}
        onKeyDown={galleryIsInteractive ? (event) => handleKeyActivate(event, 0) : undefined}
        className={cn(
          "group relative overflow-hidden bg-surface transition-transform",
          "h-full max-h-full min-h-0",
          "rounded-xl md:rounded-l-xl md:rounded-r-none",
          galleryIsInteractive
            ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
            : "cursor-default",
        )}
        aria-label={galleryIsInteractive ? `View photo 1 of ${totalImages}` : undefined}
      >
        <Image
          src={sanitizeImageUrl(displayImages[0]?.src, PLACEHOLDER_IMAGE.src)}
          alt={displayImages[0]?.alt || PLACEHOLDER_IMAGE.alt}
          width={IMAGE_SIZES.gallery.width}
          height={IMAGE_SIZES.gallery.height}
          className={cn(
            "h-full max-h-full min-h-0 w-full object-cover transition-transform duration-300 ease-out",
            galleryIsInteractive && "group-hover:scale-105",
          )}
        />
      </div>

      <div className="hidden md:grid grid-cols-2 gap-2 md:grid-rows-2 h-full max-h-full min-h-0">
        {displayImages.slice(1, 5).map((image, index) => {
          const resolvedImage = image ?? PLACEHOLDER_IMAGE
          // Determine border radius based on position
          // index 0 = top-left (no radius)
          // index 1 = top-right (top-right radius)
          // index 2 = bottom-left (no radius)
          // index 3 = bottom-right (bottom-right radius)
          let roundedClass = ""
          if (index === 0) {
            // Top-left of grid - no radius
            roundedClass = ""
          } else if (index === 1) {
            // Top-right of grid - top-right radius
            roundedClass = "rounded-tr-xl"
          } else if (index === 2) {
            // Bottom-left of grid - no radius
            roundedClass = ""
          } else if (index === 3) {
            // Bottom-right of grid - bottom-right radius
            roundedClass = "rounded-br-xl"
          }

          return (
            <div
              key={`gallery-tile-${index}`}
              role={galleryIsInteractive ? "button" : undefined}
              tabIndex={galleryIsInteractive ? 0 : undefined}
              onClick={galleryIsInteractive ? () => handleOpen(index + 1) : undefined}
              onKeyDown={galleryIsInteractive ? (event) => handleKeyActivate(event, index + 1) : undefined}
              className={cn(
                "group relative overflow-hidden bg-surface",
                "h-full max-h-full min-h-0",
                roundedClass,
                galleryIsInteractive
                  ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                  : "cursor-default",
              )}
              aria-label={
                galleryIsInteractive ? `View photo ${Math.min(index + 2, totalImages)} of ${totalImages}` : undefined
              }
            >
              <Image
                src={sanitizeImageUrl(resolvedImage.src, PLACEHOLDER_IMAGE.src)}
                alt={resolvedImage.alt}
                width={IMAGE_SIZES.card.width}
                height={IMAGE_SIZES.card.height}
                className={cn(
                  "h-full max-h-full min-h-0 w-full object-cover transition-transform duration-300 ease-out",
                  galleryIsInteractive && "group-hover:scale-105",
                )}
              />
            </div>
          )
        })}
      </div>

      {/* Show all photos button - floating bottom right */}
      {showOverlay && galleryIsInteractive && (
        <div className="hidden md:block absolute bottom-4 right-4 z-10">
          <Button
            variant="tertiary"
            size="tertiary"
            onClick={() => handleOpen(0)}
          >
            <Expand className="w-4 h-4" />
            Show all photos
          </Button>
        </div>
      )}
    </div>
  )
}
