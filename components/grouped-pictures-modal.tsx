"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Share, Bookmark, ChevronLeft, ChevronRight, X } from "lucide-react"
import { toast } from "sonner"

interface ImageGroup {
  category: string
  description?: string
  images: {
    src: string
    alt: string
    isPrimary?: boolean
  }[]
}

interface GroupedPicturesModalProps {
  isOpen: boolean
  onClose: () => void
  imageGroups: ImageGroup[]
  title?: string
}

export function GroupedPicturesModal({
  isOpen,
  onClose,
  imageGroups,
  title = "Project Gallery",
}: GroupedPicturesModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  // Flatten all images for lightbox navigation
  const allImages = useMemo(
    () =>
      imageGroups.flatMap((group) =>
        group.images.map((image) => ({
          ...image,
          category: group.category,
        })),
      ),
    [imageGroups],
  )
  const totalImages = allImages.length

  const handleImageClick = (groupIndex: number, imageIndex: number) => {
    // Calculate the global index for the clicked image
    let globalIndex = 0
    for (let i = 0; i < groupIndex; i++) {
      globalIndex += imageGroups[i].images.length
    }
    globalIndex += imageIndex

    setCurrentImageIndex(globalIndex)
    setIsLightboxOpen(true)
  }

  const nextImage = useCallback(() => {
    if (totalImages === 0) return
    setCurrentImageIndex((prev) => (prev + 1) % totalImages)
  }, [totalImages])

  const prevImage = useCallback(() => {
    if (totalImages === 0) return
    setCurrentImageIndex((prev) => (prev - 1 + totalImages) % totalImages)
  }, [totalImages])

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: `Check out this ${title}`,
          url: window.location.href,
        })
      } catch (err) {
        // User cancelled sharing
      }
    } else {
      // Fallback to copying link
      try {
        await navigator.clipboard.writeText(window.location.href)
        toast.success("Link copied to clipboard")
      } catch (err) {
        toast.error("Failed to share")
      }
    }
  }

  const handleSave = () => {
    setIsSaved(!isSaved)
    toast.success(isSaved ? "Removed from saved" : "Added to saved collection")
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      if (e.key === "Escape") {
        if (isLightboxOpen) {
          setIsLightboxOpen(false)
        } else {
          onClose()
        }
      } else if (isLightboxOpen) {
        if (e.key === "ArrowLeft") {
          prevImage()
        } else if (e.key === "ArrowRight") {
          nextImage()
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, isLightboxOpen, nextImage, onClose, prevImage])

  return (
    <>
      {/* Main Modal */}
      <Dialog open={isOpen && !isLightboxOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-none w-full h-full max-h-screen p-0 bg-white border-none overflow-hidden">
          <div className="flex flex-col h-full max-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-100 flex-shrink-0">
              <Button variant="ghost" size="sm" className="text-gray-700 hover:bg-gray-100" onClick={onClose}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="text-gray-700 hover:bg-gray-100" onClick={handleShare}>
                  <Share className="w-4 h-4 mr-2" />
                  Share
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`hover:bg-gray-100 ${isSaved ? "text-blue-600" : "text-gray-700"}`}
                  onClick={handleSave}
                >
                  <Bookmark className={`w-4 h-4 mr-2 ${isSaved ? "fill-current" : ""}`} />
                  Save
                </Button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              <div className="p-4 md:p-6">
                <div className="max-w-4xl mx-auto space-y-8">
                  {imageGroups.map((group, groupIndex) => (
                    <div key={group.category} className="space-y-4">
                      {/* Category Header */}
                      <div className="space-y-1">
                        <h2 className="text-xl font-semibold text-gray-900">{group.category}</h2>
                        {group.description && <p className="text-gray-600 text-sm">{group.description}</p>}
                      </div>

                      {/* Images Grid */}
                      <div className="space-y-4">
                        {/* Primary Image */}
                        {group.images.find((img) => img.isPrimary) && (
                          <div
                            className="cursor-pointer"
                            onClick={() =>
                              handleImageClick(
                                groupIndex,
                                group.images.findIndex((img) => img.isPrimary),
                              )
                            }
                          >
                            <img
                              src={group.images.find((img) => img.isPrimary)?.src || "/placeholder.svg"}
                              alt={group.images.find((img) => img.isPrimary)?.alt}
                              className="w-full h-64 md:h-80 object-cover rounded-lg hover:opacity-95 transition-opacity"
                            />
                          </div>
                        )}

                        {/* Secondary Images Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {group.images
                            .filter((img) => !img.isPrimary)
                            .map((image, imageIndex) => {
                              const actualIndex = group.images.findIndex((img) => img === image)
                              return (
                                <div
                                  key={imageIndex}
                                  className="cursor-pointer"
                                  onClick={() => handleImageClick(groupIndex, actualIndex)}
                                >
                                  <img
                                    src={image.src || "/placeholder.svg"}
                                    alt={image.alt}
                                    className="w-full h-32 md:h-40 object-cover rounded-lg hover:opacity-95 transition-opacity"
                                  />
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox Modal */}
      <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
        <DialogContent className="max-w-none w-full h-full max-h-screen p-0 bg-black border-none overflow-hidden">
          <div className="relative w-full h-full flex flex-col">
            {/* Lightbox Header */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 md:p-6 bg-gradient-to-b from-black/90 to-transparent">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10"
                onClick={() => setIsLightboxOpen(false)}
              >
                <X className="w-4 h-4 mr-2" />
                Close
              </Button>

              <div className="text-white font-medium">
                {currentImageIndex + 1}/{allImages.length}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={handleShare}>
                  <Share className="w-4 h-4 mr-2" />
                  Share
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`hover:bg-white/10 ${isSaved ? "text-blue-400" : "text-white"}`}
                  onClick={handleSave}
                >
                  <Bookmark className={`w-4 h-4 mr-2 ${isSaved ? "fill-current" : ""}`} />
                  Save
                </Button>
              </div>
            </div>

            {/* Image Display */}
            <div className="flex-1 flex items-center justify-center p-8 md:p-16">
              <img
                src={allImages[currentImageIndex]?.src || "/placeholder.svg"}
                alt={allImages[currentImageIndex]?.alt}
                className="max-w-full max-h-full object-contain"
              />
            </div>

            {/* Navigation Arrows */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10"
              onClick={prevImage}
              disabled={allImages.length <= 1}
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10"
              onClick={nextImage}
              disabled={allImages.length <= 1}
            >
              <ChevronRight className="w-6 h-6" />
            </Button>

            {/* Category Label */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
              {allImages[currentImageIndex]?.category}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
