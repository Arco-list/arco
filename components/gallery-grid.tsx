"use client"

import { useMemo, type KeyboardEvent } from "react"
import { Button } from "@/components/ui/button"
import { MoreHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"

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
    <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:items-stretch md:h-[480px] lg:h-[560px]">
      <div
        role={galleryIsInteractive ? "button" : undefined}
        tabIndex={galleryIsInteractive ? 0 : undefined}
        onClick={galleryIsInteractive ? () => handleOpen(0) : undefined}
        onKeyDown={galleryIsInteractive ? (event) => handleKeyActivate(event, 0) : undefined}
        className={cn(
          "group relative overflow-hidden rounded-xl bg-gray-100 transition-transform",
          "aspect-[4/3] md:aspect-auto md:h-full md:min-h-0 lg:min-h-0",
          galleryIsInteractive
            ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
            : "cursor-default",
        )}
        aria-label={galleryIsInteractive ? `View photo 1 of ${totalImages}` : undefined}
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

      <div className="grid grid-cols-2 gap-4 md:grid-rows-2">
        {displayImages.slice(1, 5).map((image, index) => {
          const resolvedImage = image ?? PLACEHOLDER_IMAGE

          return (
            <div
              key={`gallery-tile-${index}`}
              role={galleryIsInteractive ? "button" : undefined}
              tabIndex={galleryIsInteractive ? 0 : undefined}
              onClick={galleryIsInteractive ? () => handleOpen(index + 1) : undefined}
              onKeyDown={galleryIsInteractive ? (event) => handleKeyActivate(event, index + 1) : undefined}
              className={cn(
                "group relative overflow-hidden rounded-xl bg-gray-100",
                "aspect-square",
                galleryIsInteractive
                  ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                  : "cursor-default",
              )}
              aria-label={
                galleryIsInteractive ? `View photo ${Math.min(index + 2, totalImages)} of ${totalImages}` : undefined
              }
            >
              <img
                src={resolvedImage.src}
                alt={resolvedImage.alt}
                className={cn(
                  "h-full w-full object-cover transition-transform duration-300 ease-out",
                  galleryIsInteractive && "group-hover:scale-105",
                )}
              />

              {showOverlay && index === 3 && galleryIsInteractive && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="bg-black text-white hover:bg-gray-800"
                    onClick={() => handleOpen(index + 1)}
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
  )
}
