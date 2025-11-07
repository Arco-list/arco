"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { ProfessionalGalleryModal } from "@/components/professional-gallery-modal"

type ProfessionalGalleryImage = {
  id: string
  url: string
  alt: string
  isCover?: boolean
}

type ProfessionalGalleryGroup = {
  id: string
  title: string
  description?: string
  photos: ProfessionalGalleryImage[]
}

type OpenModalOptions = {
  groupId?: string
}

type ProfessionalGalleryModalContextValue = {
  openModal: (options?: OpenModalOptions) => void
}

type ProfessionalGalleryData = {
  professionalName: string
  companyId?: string
  coverImageUrl?: string | null
  shareUrl?: string
  groups: ProfessionalGalleryGroup[]
}

const ProfessionalGalleryModalContext = createContext<ProfessionalGalleryModalContextValue | null>(null)

const ProfessionalGalleryDataContext = createContext<ProfessionalGalleryData | null>(null)

export function ProfessionalGalleryModalProvider({
  children,
  professionalName,
  companyId,
  coverImageUrl,
  shareUrl,
  images,
}: {
  children: ReactNode
  professionalName: string
  companyId?: string
  coverImageUrl?: string | null
  shareUrl?: string
  images: ProfessionalGalleryImage[]
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)

  // For now, group all images into a single "Gallery" group
  // TODO: When we add categories to company_photos table, we can create proper grouping
  const imageGroups: ProfessionalGalleryGroup[] = useMemo(() => {
    if (images.length === 0) {
      return []
    }

    return [
      {
        id: "gallery",
        title: "Gallery",
        description: `${images.length} photo${images.length !== 1 ? 's' : ''}`,
        photos: images,
      },
    ]
  }, [images])

  const hasImages = imageGroups.length > 0

  const galleryData = useMemo<ProfessionalGalleryData>(
    () => ({
      professionalName,
      companyId,
      coverImageUrl,
      shareUrl,
      groups: imageGroups,
    }),
    [professionalName, companyId, coverImageUrl, shareUrl, imageGroups],
  )

  const openModal = useCallback(
    (options?: OpenModalOptions) => {
      if (!hasImages) {
        return
      }
      setSelectedGroupId(options?.groupId ?? null)
      setIsOpen(true)
    },
    [hasImages],
  )

  const closeModal = useCallback(() => {
    setIsOpen(false)
    setSelectedGroupId(null)
  }, [])

  const value = useMemo(
    () => ({
      openModal,
    }),
    [openModal],
  )

  return (
    <ProfessionalGalleryDataContext.Provider value={galleryData}>
      <ProfessionalGalleryModalContext.Provider value={value}>
        {children}
        <ProfessionalGalleryModal
          isOpen={isOpen}
          onClose={closeModal}
          selectedGroupId={selectedGroupId ?? undefined}
        />
      </ProfessionalGalleryModalContext.Provider>
    </ProfessionalGalleryDataContext.Provider>
  )
}

export function useProfessionalGalleryModal() {
  const context = useContext(ProfessionalGalleryModalContext)

  if (!context) {
    throw new Error("useProfessionalGalleryModal must be used within a ProfessionalGalleryModalProvider")
  }

  return context
}

export function useProfessionalGalleryData() {
  const context = useContext(ProfessionalGalleryDataContext)

  if (!context) {
    throw new Error("useProfessionalGalleryData must be used within a ProfessionalGalleryModalProvider")
  }

  return context
}
