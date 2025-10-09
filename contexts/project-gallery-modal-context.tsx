"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { GroupedPicturesModal } from "@/components/grouped-pictures-modal"
import { useProjectPreview } from "@/contexts/project-preview-context"

type OpenModalOptions = {
  groupId?: string
}

type ProjectGalleryModalContextValue = {
  openModal: (options?: OpenModalOptions) => void
}

const ProjectGalleryModalContext = createContext<ProjectGalleryModalContextValue | null>(null)

export function ProjectGalleryModalProvider({ children }: { children: React.ReactNode }) {
  const { hero } = useProjectPreview()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)

  const imageGroups = useMemo(
    () =>
      hero.groups.map((group) => ({
        id: group.id,
        category: group.title,
        description: group.description ?? undefined,
        images: group.photos.map((photo, index) => ({
          src: photo.url,
          alt: photo.alt,
          isPrimary: photo.isPrimary ?? index === 0,
        })),
      })),
    [hero.groups],
  )

  const hasImages = imageGroups.length > 0

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
    <ProjectGalleryModalContext.Provider value={value}>
      {children}
      <GroupedPicturesModal
        isOpen={isOpen}
        onClose={closeModal}
        imageGroups={imageGroups}
        selectedGroupId={selectedGroupId ?? undefined}
      />
    </ProjectGalleryModalContext.Provider>
  )
}

export function useProjectGalleryModal() {
  const context = useContext(ProjectGalleryModalContext)

  if (!context) {
    throw new Error("useProjectGalleryModal must be used within a ProjectGalleryModalProvider")
  }

  return context
}
