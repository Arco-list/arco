"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import Image from "next/image"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Share,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react"
import { ShareModal } from "./share-modal"
import { useProfessionalGalleryData } from "@/contexts/professional-gallery-modal-context"
import { useSavedProfessionals } from "@/contexts/saved-professionals-context"
import { sanitizeImageUrl, IMAGE_SIZES } from "@/lib/image-security"

interface ProfessionalGalleryModalProps {
  isOpen: boolean
  onClose: () => void
  selectedGroupId?: string
}

export function ProfessionalGalleryModal({
  isOpen,
  onClose,
  selectedGroupId,
}: ProfessionalGalleryModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [isZoomed, setIsZoomed] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const groupRefs = useRef(new Map<string, HTMLDivElement>())

  const { professionalName, companyId, coverImageUrl, shareUrl, groups } = useProfessionalGalleryData()
  const { savedProfessionalIds, mutatingProfessionalIds, saveProfessional, removeProfessional } =
    useSavedProfessionals()

  const isSaved = companyId ? savedProfessionalIds.has(companyId) : false
  const isMutating = companyId ? mutatingProfessionalIds.has(companyId) : false

  // Transform groups to match the modal's expected format
  const imageGroups = useMemo(
    () =>
      groups.map((group) => ({
        id: group.id,
        category: group.title,
        description: group.description,
        images: group.photos.map((photo) => ({
          src: photo.url,
          alt: photo.alt,
          isPrimary: photo.isCover,
        })),
      })),
    [groups],
  )

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
    for (let i = 0; i < groupIndex; i += 1) {
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

  const toggleZoom = useCallback(() => {
    setIsZoomed((prev) => !prev)
  }, [])

  useEffect(() => {
    setIsZoomed(false)
  }, [isLightboxOpen, currentImageIndex])

  useEffect(() => {
    if (!isOpen || !selectedGroupId) {
      return
    }

    const targetGroupIndex = imageGroups.findIndex((group) => group.id === selectedGroupId)
    if (targetGroupIndex === -1 || imageGroups[targetGroupIndex]?.images.length === 0) {
      return
    }

    let globalIndex = 0
    for (let i = 0; i < targetGroupIndex; i += 1) {
      globalIndex += imageGroups[i].images.length
    }
    setCurrentImageIndex(globalIndex)

    let cancelled = false
    let animationFrameId: number | null = null
    const attemptScroll = () => {
      if (cancelled) {
        return
      }
      const targetRef = groupRefs.current.get(selectedGroupId)
      if (targetRef) {
        targetRef.scrollIntoView({ behavior: "smooth", block: "start" })
        return
      }
      animationFrameId = requestAnimationFrame(attemptScroll)
    }

    animationFrameId = requestAnimationFrame(attemptScroll)

    return () => {
      cancelled = true
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [imageGroups, isOpen, selectedGroupId])

  const handleSave = () => {
    if (!companyId) return
    if (isSaved) {
      void removeProfessional(companyId)
    } else {
      void saveProfessional({
        id: companyId,
        companyId: companyId,
        name: professionalName,
        slug: shareUrl?.split("/").pop() || "",
        profession: "",
        location: "",
        rating: 0,
        reviewCount: 0,
        image: coverImageUrl || "",
        specialties: [],
        isVerified: false,
        domain: null,
        professionalId: "",
      })
    }
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
        } else if (e.key === " ") {
          e.preventDefault()
          toggleZoom()
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, isLightboxOpen, nextImage, onClose, prevImage, toggleZoom])

  return (
    <>
      {/* Main Modal - Overview */}
      <Dialog open={isOpen && !isLightboxOpen} onOpenChange={onClose}>
        <DialogContent
          showCloseButton={false}
          className="!max-w-none !w-screen !h-screen p-0 bg-white border-none overflow-hidden !m-0 !translate-x-0 !translate-y-0 !top-0 !left-0 !rounded-none"
        >
          <DialogTitle className="sr-only">{`${professionalName} Gallery`}</DialogTitle>
          <div className="flex flex-col w-full h-screen">
            {/* Header */}
            <div className="flex items-center justify-between p-3 md:p-4 border-b border-border flex-shrink-0">
              <Button variant="tertiary" size="tertiary" onClick={onClose}>
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>

              <div className="flex gap-2">
                <Button variant="tertiary" size="tertiary" onClick={() => setIsShareModalOpen(true)}>
                  <Share className="w-4 h-4 md:mr-2" />
                  <span className="hidden md:inline">Share</span>
                </Button>
                <Button
                  variant="tertiary"
                  size="tertiary"
                  className={isSaved ? "!bg-primary !text-white hover:!bg-primary-hover" : ""}
                  onClick={handleSave}
                  disabled={!companyId || isMutating}
                  aria-pressed={isSaved}
                >
                  <Bookmark className="w-4 h-4 md:mr-2" fill={isSaved ? "currentColor" : "none"} />
                  <span className="hidden md:inline">{isSaved ? "Saved" : "Save"}</span>
                </Button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              <div className="px-4 md:px-6 py-4 md:py-6">
                <div className="max-w-[1800px] mx-auto space-y-8">
                  {imageGroups.map((group, groupIndex) => (
                    <div
                      key={group.id}
                      ref={(node) => {
                        if (!node) {
                          groupRefs.current.delete(group.id)
                          return
                        }
                        groupRefs.current.set(group.id, node)
                      }}
                      className="space-y-4"
                    >
                      {/* Category Header */}
                      <div className="space-y-1">
                        <h2 className="heading-4 font-semibold text-foreground">{group.category}</h2>
                        {group.description && <p className="text-text-secondary body-small">{group.description}</p>}
                      </div>

                      {/* Images - Grid Layout */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {group.images.map((image, imageIndex) => (
                          <div
                            key={imageIndex}
                            className="cursor-pointer w-full"
                            onClick={() => handleImageClick(groupIndex, imageIndex)}
                          >
                            <Image
                              src={sanitizeImageUrl(image.src, "/placeholder.svg")}
                              alt={image.alt}
                              width={IMAGE_SIZES.gallery.width}
                              height={IMAGE_SIZES.gallery.height}
                              className="w-full h-auto object-cover rounded-lg hover:opacity-95 transition-opacity aspect-square"
                            />
                          </div>
                        ))}
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
        <DialogContent
          showCloseButton={false}
          className="!max-w-none !w-screen !h-screen p-0 bg-black border-none overflow-hidden !m-0 !translate-x-0 !translate-y-0 !top-0 !left-0 !rounded-none"
        >
          <DialogTitle className="sr-only">{`${professionalName} Gallery lightbox`}</DialogTitle>
          <div className="relative w-full h-screen flex flex-col">
            {/* Lightbox Header */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 md:p-6 bg-gradient-to-b from-black/90 to-transparent">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={() => setIsLightboxOpen(false)}
                aria-label="Close lightbox"
              >
                <X className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Close</span>
              </Button>

              <div className="absolute left-1/2 -translate-x-1/2 text-white font-medium">
                {currentImageIndex + 1}/{allImages.length}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/10 hover:text-white border-none bg-transparent"
                  onClick={() => setIsShareModalOpen(true)}
                  aria-label="Share professional"
                >
                  <Share className="w-4 h-4 md:mr-2" />
                  <span className="hidden md:inline">Share</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={
                    isSaved
                      ? "text-white bg-white/20 hover:bg-white/30 border-none"
                      : "text-white hover:bg-white/10 border-none bg-transparent"
                  }
                  onClick={handleSave}
                  disabled={!companyId || isMutating}
                  aria-pressed={isSaved}
                  aria-label={isSaved ? "Remove from saved" : "Save professional"}
                >
                  <Bookmark className="w-4 h-4 md:mr-2" fill={isSaved ? "currentColor" : "none"} />
                  <span className="hidden md:inline">{isSaved ? "Saved" : "Save"}</span>
                </Button>
              </div>
            </div>

            {/* Image Display */}
            <div className="absolute inset-0 flex items-center justify-center px-4 md:px-12">
              <div className="relative w-full h-full flex items-center justify-center">
                <Image
                  src={sanitizeImageUrl(allImages[currentImageIndex]?.src, "/placeholder.svg")}
                  alt={allImages[currentImageIndex]?.alt || "Professional photo"}
                  width={1200}
                  height={900}
                  className={`max-w-full max-h-[80vh] object-contain transition-transform duration-300 ease-out ${
                    isZoomed ? "cursor-zoom-out" : "cursor-zoom-in"
                  }`}
                  style={{
                    transform: isZoomed ? "scale(1.2)" : "scale(1)",
                    transformOrigin: "center",
                  }}
                  onClick={toggleZoom}
                  role="img"
                  aria-label={`${allImages[currentImageIndex]?.alt || "Professional photo"} - ${currentImageIndex + 1} of ${allImages.length}`}
                />
              </div>
            </div>

            {/* Navigation Arrows */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={prevImage}
              disabled={allImages.length <= 1}
              aria-label="Previous image"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={nextImage}
              disabled={allImages.length <= 1}
              aria-label="Next image"
            >
              <ChevronRight className="w-6 h-6" />
            </Button>

            {/* Category Label */}
            <div
              className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full body-small backdrop-blur-sm"
              role="status"
              aria-live="polite"
            >
              {allImages[currentImageIndex]?.category}
            </div>
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
    </>
  )
}
