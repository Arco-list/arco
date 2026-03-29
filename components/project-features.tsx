"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
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
  const t = useTranslations("project_detail")
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
      <h2 className="heading-3 font-bold text-black">{t("features")}</h2>

      {featuredList.length > 0 && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {featuredList.map((feature) => {
            const IconComponent = selectIconForFeature(feature, feature.groupId)
            return (
              <button
                key={feature.id}
                type="button"
                onClick={() => handleFeatureClick(feature)}
                className="flex items-center gap-2 body-small text-foreground px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary transition-colors text-left"
              >
                <IconComponent className="h-4 w-4 flex-shrink-0" />
                <span>{feature.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {hasMoreFeatures && (
        <Button variant="quaternary" size="quaternary" onClick={() => setShowModal(true)}>
          {t("show_all_features")}
        </Button>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader className="pb-4">
            <DialogTitle className="heading-5 font-semibold">{t("features")}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {featureGroups.map((group) => (
              <div key={group.id}>
                <h3 className="mb-3 body-small font-medium text-foreground">{group.name}</h3>
                <div className="flex flex-wrap gap-2">
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
                        className="flex items-center gap-2 body-small text-foreground px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary transition-colors"
                      >
                        <IconComponent className="h-4 w-4 flex-shrink-0" />
                        <span>{feature.label}</span>
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
