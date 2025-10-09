"use client"

import { useMemo, useState } from "react"
import type { LucideIcon } from "lucide-react"
import { Grid3x3, Layers, MapPin } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useProjectGalleryModal } from "@/contexts/project-gallery-modal-context"
import { useProjectPreview } from "@/contexts/project-preview-context"
import type { PreviewFeatureItem } from "@/contexts/project-preview-context"
import { DEFAULT_FEATURE_ICON, resolveFeatureIcon } from "@/lib/icons/project-features"

const FEATURE_PREVIEW_LIMIT = 6

const GROUP_FALLBACK_ICONS: Record<string, LucideIcon> = {
  location_features: MapPin,
  material_features: Layers,
  project_features: Grid3x3,
}

type FeatureWithGroup = PreviewFeatureItem & { groupId: string }

const selectIconForFeature = (feature: PreviewFeatureItem, groupId: string): LucideIcon => {
  const resolved = resolveFeatureIcon(feature.icon)
  if (resolved !== DEFAULT_FEATURE_ICON) {
    return resolved
  }

  return GROUP_FALLBACK_ICONS[groupId] ?? DEFAULT_FEATURE_ICON
}

export function ProjectFeatures() {
  const [showModal, setShowModal] = useState(false)
  const { featureGroups } = useProjectPreview()
  const { openModal } = useProjectGalleryModal()

  const featuresWithGroup = useMemo<FeatureWithGroup[]>(
    () =>
      featureGroups.flatMap((group) =>
        group.items.map((item) => ({
          ...item,
          groupId: group.id,
        })),
      ),
    [featureGroups],
  )

  const featuredList = useMemo(
    () => featuresWithGroup.slice(0, FEATURE_PREVIEW_LIMIT),
    [featuresWithGroup],
  )
  const hasMoreFeatures = featuresWithGroup.length > featuredList.length

  const handleFeatureClick = (feature: FeatureWithGroup) => {
    if (feature.modalGroupId) {
      openModal({ groupId: feature.modalGroupId })
      return
    }
    openModal()
  }

  if (featuresWithGroup.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-black">Features</h2>

      {featuredList.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {featuredList.map((feature) => {
            const IconComponent = selectIconForFeature(feature, feature.groupId)
            return (
              <button
                key={feature.id}
                type="button"
                onClick={() => handleFeatureClick(feature)}
                className="flex items-center gap-3 rounded-lg border border-transparent bg-white p-3 text-left shadow-sm transition duration-150 ease-in-out hover:border-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                  <IconComponent className="h-4 w-4 text-gray-600" />
                </span>
                <span className="text-sm font-medium text-gray-900">{feature.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {hasMoreFeatures && (
        <Button variant="outline" size="sm" onClick={() => setShowModal(true)}>
          Show all features
        </Button>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-lg font-semibold">Features</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {featureGroups.map((group) => (
              <div key={group.id}>
                <h3 className="mb-3 text-sm font-medium text-gray-900">{group.name}</h3>
                <div className="space-y-3">
                  {group.items.map((feature) => {
                    const modalFeature: FeatureWithGroup = { ...feature, groupId: group.id }
                    const IconComponent = selectIconForFeature(feature, group.id)
                    return (
                      <button
                        key={feature.id}
                        type="button"
                        onClick={() => {
                          handleFeatureClick(modalFeature)
                          setShowModal(false)
                        }}
                        className="flex w-full items-center gap-3 rounded-md border border-transparent bg-white p-3 text-left transition duration-150 ease-in-out hover:border-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100">
                          <IconComponent className="h-4 w-4 text-gray-600" />
                        </span>
                        <span className="text-sm text-gray-900 underline">{feature.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
