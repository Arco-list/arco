"use client"

import type React from "react"
import { useMemo } from "react"
import type { LucideIcon } from "lucide-react"
import { Grid3x3, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FeaturePhotoSelectorModal } from "@/components/feature-photo-selector-modal"
import { SUBTYPE_ICON_MAP } from "@/components/filter-icon-map"
import {
  ADDITIONAL_FEATURE_ID,
  BUILDING_FEATURE_ID,
  OVERLAY_CLASSES,
  type FeatureOption,
  type UseProjectPhotoTourResult,
} from "@/hooks/use-project-photo-tour"
import { resolveFeatureIcon } from "@/lib/icons/project-features"
import { resolveProjectDetailsIcon } from "@/lib/project-details"
import { FeatureSelectionGrid } from "@/components/feature-selection-grid"

const getSubtypeIconForSlug = (slug?: string | null): LucideIcon | null => {
  if (!slug) {
    return null
  }

  const key = slug.trim().toLowerCase()
  const IconComponent = SUBTYPE_ICON_MAP[key]
  return IconComponent ? (IconComponent as LucideIcon) : null
}

const resolveIconForFeatureOption = (feature?: FeatureOption | null): LucideIcon => {
  if (!feature) {
    return Grid3x3
  }

  const subtypeIcon = getSubtypeIconForSlug(feature.slug)
  if (subtypeIcon) {
    return subtypeIcon
  }

  if (feature.iconKey) {
    const iconFromKey = resolveProjectDetailsIcon(feature.iconKey)
    if (iconFromKey) {
      return iconFromKey
    }
  }

  return resolveFeatureIcon(feature.slug)
}

type PhotoTourManagerProps = {
  photoTour: UseProjectPhotoTourResult
  showHeader?: boolean
  title?: string
  subtitle?: string
  clearTempFeatureSelection?: () => void
}

export function PhotoTourManager({
  photoTour,
  showHeader = true,
  title = "Photo tour",
  subtitle = "Add photos for every feature. Only features with photos will appear on the published page.",
  clearTempFeatureSelection
}: PhotoTourManagerProps) {
  const {
    uploadedPhotos,
    orderedFeatureOptions,
    selectedFeatures,
    displayFeatureIds,
    showAddMenu,
    setShowAddMenu,
    showAddFeatureModal,
    setShowAddFeatureModal,
    showPhotoSelector,
    openPhotoSelector,
    cancelPhotoSelection,
    saveSelectedPhotos,
    tempSelectedFeatures,
    toggleTempFeature,
    saveNewFeatures,
    deleteFeature,
    tempSelectedPhotos,
    toggleTempPhoto,
    tempCoverPhoto,
    tempFeatureTagline,
    tempFeatureHighlight,
    setTempCoverPhoto,
    setTempFeatureTagline,
    setTempFeatureHighlight,
    isUploading,
    isSavingFeatures,
    isSavingSelection,
    modalUploadErrors,
    getFeatureDisplay,
    getFeaturePhotoCount,
    getFeatureCoverPhoto,
    getSelectablePhotos,
    handleFileUpload,
    handleModalFileUpload,
    handleModalDrop,
    handleModalDragOver,
    handleModalDragLeave,
    deletePhoto,
    resetModalUploadErrors,
    modalDragOver,
  } = photoTour

  const selectablePhotos = useMemo(
    () => getSelectablePhotos(showPhotoSelector),
    [getSelectablePhotos, showPhotoSelector],
  )

  const currentFeatureDisplay = useMemo(
    () => (showPhotoSelector ? getFeatureDisplay(showPhotoSelector) : null),
    [getFeatureDisplay, showPhotoSelector],
  )

  const handleClearTempFeatureSelection = () => {
    if (clearTempFeatureSelection) {
      clearTempFeatureSelection()
    } else {
      // Default implementation if not provided
      tempSelectedFeatures.slice().forEach((featureId) => toggleTempFeature(featureId))
    }
  }

  return (
    <div className="text-left">
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <div className="hidden md:block">
            <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-text-secondary">{subtitle}</p>
          </div>

          <div className="relative md:ml-auto ml-auto">
            <button
              onClick={() => setShowAddMenu((state) => !state)}
              className="bg-gray-900 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-800 transition-colors"
              aria-haspopup="menu"
              aria-expanded={showAddMenu}
            >
              <span className="text-xl font-light">+</span>
            </button>

            {showAddMenu && (
              <div className="absolute top-12 right-0 bg-white rounded-lg shadow-lg border border-border py-2 z-10 min-w-[160px]">
                <label className="block cursor-pointer">
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png"
                    className="hidden"
                    disabled={isUploading}
                    onChange={(event) => {
                      void handleFileUpload(event.target.files)
                      event.target.value = ""
                      setShowAddMenu(false)
                    }}
                  />
                  <span
                    className={`w-full text-left px-4 py-2 text-sm transition-colors block ${
                      isUploading ? "text-muted-foreground cursor-not-allowed" : "text-foreground hover:bg-surface"
                    }`}
                  >
                    {isUploading ? "Uploading…" : "Add photos"}
                  </span>
                </label>
                <button
                  onClick={() => {
                    setShowAddFeatureModal(true)
                    setShowAddMenu(false)
                  }}
                  disabled={isSavingFeatures}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    isSavingFeatures ? "text-muted-foreground cursor-not-allowed" : "text-foreground hover:bg-surface"
                  }`}
                >
                  {isSavingFeatures ? "Saving…" : "Add feature"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {displayFeatureIds.map((featureId) => {
          const featureDisplay = getFeatureDisplay(featureId)
          const FeatureIcon = featureDisplay.icon
          const photoCount = getFeaturePhotoCount(featureId)
          const coverPhoto = getFeatureCoverPhoto(featureId)

          return (
            <div key={featureId} className="bg-white rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => openPhotoSelector(featureId)}
                className="w-full text-left hover:bg-surface transition-colors"
              >
                <div className="aspect-square bg-surface relative">
                  {coverPhoto ? (
                    <img
                      src={coverPhoto || "/placeholder.svg"}
                      alt={featureDisplay.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <ImageIcon className="w-12 h-12 text-muted-foreground mb-4" />
                      <span className="bg-white border border-border text-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-surface transition-colors">
                        Select photos
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <FeatureIcon className="w-4 h-4" />
                    <p className="text-sm">{featureDisplay.name}</p>
                  </div>
                  <p className="text-sm">{photoCount > 0 ? `${photoCount} photo${photoCount === 1 ? "" : "s"}` : "Add photos"}</p>
                </div>
              </button>
            </div>
          )
        })}
      </div>

      {/* Add Feature Modal */}
      {showAddFeatureModal && (
        <div className={OVERLAY_CLASSES}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-foreground">Add feature</h2>
                <button
                  onClick={() => {
                    setShowAddFeatureModal(false)
                    handleClearTempFeatureSelection()
                  }}
                  className="text-muted-foreground hover:text-text-secondary text-2xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <FeatureSelectionGrid
                  features={orderedFeatureOptions}
                  selectedFeatures={selectedFeatures}
                  tempSelectedFeatures={tempSelectedFeatures}
                  projectTypeCategoryId={null}
                  isLoading={false}
                  isSaving={isSavingFeatures}
                  onToggle={toggleTempFeature}
                  resolveIcon={resolveIconForFeatureOption}
                />
              </div>

              <div className="flex gap-4 justify-end">
                <Button
                  onClick={() => {
                    setShowAddFeatureModal(false)
                    handleClearTempFeatureSelection()
                  }}
                  variant="tertiary"
                  size="tertiary"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => void saveNewFeatures()}
                  disabled={tempSelectedFeatures.length === 0 || isSavingFeatures}
                  variant="secondary"
                  size="lg"
                >
                  {isSavingFeatures ? "Adding..." : "Add selected"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <FeaturePhotoSelectorModal
        isOpen={Boolean(showPhotoSelector)}
        featureId={showPhotoSelector}
        featureDisplay={currentFeatureDisplay}
        selectablePhotos={selectablePhotos}
        selectedPhotoIds={tempSelectedPhotos}
        coverPhotoId={tempCoverPhoto}
        uploadedPhotosCount={uploadedPhotos.length}
        modalUploadErrors={modalUploadErrors}
        isSaving={isSavingSelection}
        isUploading={isUploading}
        modalDragOver={modalDragOver}
        onTogglePhoto={toggleTempPhoto}
        onSetCoverPhoto={setTempCoverPhoto}
        onDeletePhoto={deletePhoto}
        onSave={() => void saveSelectedPhotos()}
        onCancel={cancelPhotoSelection}
        onClose={cancelPhotoSelection}
        onDeleteFeature={
          showPhotoSelector ? () => void deleteFeature(showPhotoSelector) : undefined
        }
        canDeleteFeature={Boolean(
          showPhotoSelector && ![BUILDING_FEATURE_ID, ADDITIONAL_FEATURE_ID].includes(showPhotoSelector),
        )}
        onModalDrop={handleModalDrop}
        onModalDragOver={handleModalDragOver}
        onModalDragLeave={handleModalDragLeave}
        onModalFileUpload={handleModalFileUpload}
        onDismissErrors={resetModalUploadErrors}
        taglineValue={tempFeatureTagline}
        onTaglineChange={setTempFeatureTagline}
        highlightValue={tempFeatureHighlight}
        onHighlightChange={setTempFeatureHighlight}
        saveDisabled={false}
        saveLabel={
          tempSelectedPhotos.length > 0 ? `Save Selection (${tempSelectedPhotos.length})` : "Save selection"
        }
      />
    </div>
  )
}
