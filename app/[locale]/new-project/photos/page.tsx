"use client"

import type React from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { useEffect, useMemo, useState } from "react"
import type { LucideIcon } from "lucide-react"
import { Grid3x3, Home, ImageIcon, MoreHorizontal, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SUBTYPE_ICON_MAP } from "@/components/filter-icon-map"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import type { Tables } from "@/lib/supabase/types"
import {
  ADDITIONAL_FEATURE_ID,
  BUILDING_FEATURE_ID,
  MIN_PHOTOS_REQUIRED,
  type FeatureOption,
  useProjectPhotoTour,
} from "@/hooks/use-project-photo-tour"
import { resolveFeatureIcon } from "@/lib/icons/project-features"
import { resolveProjectDetailsIcon } from "@/lib/project-details"
import { SegmentedProgressBar } from "@/components/new-project/segmented-progress-bar"
import { PhotoTourManager } from "@/components/photo-tour-manager"
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

export default function PhotoTourPage() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), [])
  const searchParams = useSearchParams()
  const projectIdFromParams = searchParams.get("projectId")
  const stepFromUrl = searchParams.get("step")
  const initialStep = stepFromUrl ? parseInt(stepFromUrl, 10) : 1
  const [currentStep, setCurrentStep] = useState(initialStep >= 1 && initialStep <= 4 ? initialStep : 1)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const router = useRouter()

  const photoTourHook = useProjectPhotoTour({ supabase, projectId })

  const {
    projectId: resolvedProjectId,
    uploadedPhotos,
    featureOptions,
    orderedFeatureOptions,
    selectedFeatures,
    displayFeatureIds,
    dragOver,
    modalDragOver,
    openMenuId,
    showAddMenu,
    showPhotoSelector,
    showAddFeatureModal,
    tempSelectedFeatures,
    tempSelectedPhotos,
    tempCoverPhoto,
    tempFeatureTagline,
    tempFeatureHighlight,
    setTempCoverPhoto,
    setTempFeatureTagline,
    setTempFeatureHighlight,
    isUploading,
    isLoadingFeatures,
    isLoadingProject,
    isSavingFeatures,
    isSavingSelection,
    uploadErrors,
    modalUploadErrors,
    featureError,
    featureMutationError,
    projectLoadError,
    getFeatureDisplay,
    getFeaturePhotoCount,
    getFeatureCoverPhoto,
    getSelectablePhotos,
    getProjectTypeCategoryId,
    refreshProjectContext,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileUpload,
    handleModalFileUpload,
    handleModalDrop,
    handleModalDragOver,
    handleModalDragLeave,
    setShowAddMenu,
    openPhotoSelector,
    cancelPhotoSelection,
    saveSelectedPhotos,
    toggleTempPhoto,
    toggleTempFeature,
    saveNewFeatures,
    deleteFeature,
    toggleFeature,
    handlePhotoDragStart,
    handlePhotoDragOver,
    handlePhotoDropOnCard,
    handlePhotoDragEnd,
    setCoverPhoto,
    deletePhoto,
    setOpenMenuId,
    setShowAddFeatureModal,
    resetModalUploadErrors,
  } = photoTourHook

  useEffect(() => {
    let isMounted = true

    const ensureProjectContext = async () => {
      if (!projectIdFromParams) {
        router.replace("/new-project/details")
        return
      }

      const { data: authData, error } = await supabase.auth.getUser()

      if (!isMounted) {
        return
      }

      if (error || !authData?.user) {
        setAuthError("You need to be signed in to continue.")
        router.replace("/new-project/details")
        return
      }

      setAuthError(null)
      setProjectId(projectIdFromParams)
    }

    void ensureProjectContext()

    return () => {
      isMounted = false
    }
  }, [projectIdFromParams, router, supabase])

  const renderStep1 = () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-left max-w-2xl">
        <div className="mb-8">
          <ImageIcon className="w-10 h-10 text-foreground mb-6" />
        </div>

        <h1 className="heading-3 mb-6">Create a photo tour</h1>

        <p className="body-large text-text-secondary leading-relaxed">
          Define the building features of the project and add photos for every feature. We will help you out
        </p>
      </div>
    </div>
  )

  const renderStep2 = () => {
    const photosRemaining = Math.max(0, MIN_PHOTOS_REQUIRED - uploadedPhotos.length)
    const progressLabel =
      photosRemaining > 0
        ? `${photosRemaining} more photo${photosRemaining === 1 ? "" : "s"} needed`
        : "Minimum met — add more to showcase your project"

    return (
      <div className="text-left">
        <h1 className="heading-3 mb-4">Add photos of your project</h1>

        <p className="body-regular text-text-secondary mb-2">
          Upload at least {MIN_PHOTOS_REQUIRED} high-quality JPG or PNG images (1200px+). Drag to reorder once
          uploaded.
        </p>
        <p className="body-small font-medium text-foreground mb-8">
          {uploadedPhotos.length} uploaded · {progressLabel}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver ? "border-border bg-surface" : "border-border"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
            <p className="body-regular text-foreground font-medium mb-1">Drag and drop</p>
            <p className="body-small text-text-secondary mb-4">or browse for photos</p>
            <label className="inline-block">
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png"
                className="hidden"
                disabled={isUploading}
                onChange={(event) => {
                  void handleFileUpload(event.target.files)
                  event.target.value = ""
                }}
              />
              <span
                className={`body-small bg-secondary text-white px-6 py-2 rounded-md font-medium transition-colors ${
                  isUploading ? "opacity-60 cursor-not-allowed" : "hover:bg-secondary-hover cursor-pointer"
                }`}
              >
                {isUploading ? "Uploading..." : "Browse"}
              </span>
            </label>
            {uploadErrors.length > 0 && (
              <ul className="mt-4 text-left body-small text-red-600 space-y-1">
                {uploadErrors.map((error, index) => (
                  <li key={`${error}-${index}`}>{error}</li>
                ))}
              </ul>
            )}
          </div>

          {uploadedPhotos.map((photo) => (
            <div
              key={photo.id}
              className="relative group"
              draggable
              onDragStart={(event) => handlePhotoDragStart(event, photo.id)}
              onDragOver={handlePhotoDragOver}
              onDrop={(event) => handlePhotoDropOnCard(event, photo.id)}
              onDragEnd={handlePhotoDragEnd}
            >
              <div className="aspect-square rounded-lg overflow-hidden bg-surface">
                <img
                  src={photo.url || "/placeholder.svg"}
                  alt="Uploaded project photo"
                  className="w-full h-full object-cover"
                />
              </div>

              {photo.isCover && (
                <div className="absolute top-2 left-2 bg-secondary text-white px-2 py-1 rounded body-small font-medium">
                  Cover photo
                </div>
              )}

              <div className="absolute top-2 right-2">
                <button
                  onClick={() => setOpenMenuId(openMenuId === photo.id ? null : photo.id)}
                  className="bg-white rounded-full p-1 shadow-md hover:bg-surface transition-colors"
                >
                  <MoreHorizontal className="w-4 h-4 text-text-secondary" />
                </button>

                {openMenuId === photo.id && (
                  <div className="absolute top-8 right-0 bg-white rounded-lg shadow-lg border border-border py-1 z-10 min-w-[160px]">
                    <button
                      onClick={() => setCoverPhoto(photo.id)}
                      className="w-full text-left px-3 py-2 body-small text-foreground hover:bg-surface transition-colors"
                    >
                      Set as cover photo
                    </button>
                    <button
                      onClick={() => deletePhoto(photo.id)}
                      className="w-full text-left px-3 py-2 body-small text-red-600 hover:bg-surface transition-colors flex items-center gap-2"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderStep3 = () => {
    return (
      <div className="text-left">
        <h1 className="heading-3 mb-4">Tell us what your project has to offer</h1>

        <p className="body-regular text-text-secondary mb-6">
          Select the spaces that best describe your project — you can adjust these later.
        </p>

        <FeatureSelectionGrid
          features={orderedFeatureOptions}
          selectedFeatures={selectedFeatures}
          tempSelectedFeatures={tempSelectedFeatures}
          projectTypeCategoryId={null}
          isLoading={isLoadingFeatures}
          isSaving={isSavingFeatures}
          onToggle={toggleTempFeature}
          resolveIcon={resolveIconForFeatureOption}
          errorMessage={featureError}
        />

        {tempSelectedFeatures.length > 0 && (
          <div className="mt-6">
            <button
              onClick={() => void saveNewFeatures()}
              disabled={isSavingFeatures}
              className="body-small w-full bg-secondary text-white py-3 px-6 rounded-md font-medium hover:bg-secondary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSavingFeatures ? "Saving..." : `Save selected (${tempSelectedFeatures.length})`}
            </button>
          </div>
        )}
      </div>
    )
  }

  const renderStep4 = () => (
    <PhotoTourManager
      photoTour={photoTourHook}
      showHeader={true}
      title="Photo tour"
      clearTempFeatureSelection={clearTempFeatureSelection}
    />
  )

  const needsMorePhotos = uploadedPhotos.length < MIN_PHOTOS_REQUIRED
  const isBusy = isUploading || isSavingFeatures || isSavingSelection || isLoadingProject
  const isNextDisabled = ((currentStep === 2 || currentStep === 4) && needsMorePhotos) || isBusy
  const blockingError = authError ?? projectLoadError
  const clearTempFeatureSelection = () => {
    if (tempSelectedFeatures.length === 0) {
      return
    }
    tempSelectedFeatures.slice().forEach((featureId) => toggleTempFeature(featureId))
  }

  const handleNext = async () => {
    if (isBusy) {
      return
    }

    if (currentStep < 4) {
      // Save temp features before moving from step 3 to step 4
      if (currentStep === 3 && tempSelectedFeatures.length > 0) {
        const success = await saveNewFeatures()
        if (!success) {
          return // Don't navigate if save failed
        }
      }
      setCurrentStep((step) => step + 1)
      return
    }

    if (currentStep === 4) {
      const nextProjectId = resolvedProjectId ?? projectId ?? projectIdFromParams
      const nextUrl = nextProjectId ? `/new-project/professionals?projectId=${nextProjectId}` : "/new-project/professionals"
      router.push(nextUrl)
    }
  }

  const handleBack = () => {
    if (isBusy) {
      return
    }

    // Clear temp selections when going back
    if (tempSelectedFeatures.length > 0) {
      tempSelectedFeatures.slice().forEach((featureId) => toggleTempFeature(featureId))
    }

    if (currentStep > 1) {
      setCurrentStep((step) => step - 1)
    } else if (projectId) {
      // Navigate back to last step (step 5) of details page when on step 1
      router.push(`/new-project/details?projectId=${projectId}&step=5`)
    }
  }

  const handleSaveAndExit = () => {
    if (isBusy) {
      return
    }

    router.push("/dashboard/listings")
  }

  return (
    <div className="min-h-screen bg-white">
      <PhotoTourHeader onSaveAndExit={handleSaveAndExit} isDisabled={isBusy} />
      <main className="container mx-auto px-4 py-16 max-w-4xl pb-32">
        <div className="mb-12">
          <SegmentedProgressBar currentGlobalStep={5 + currentStep} />
        </div>

        {blockingError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 body-small text-red-700">
            {blockingError}
          </div>
        )}

        {featureMutationError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 body-small text-red-700">
            {featureMutationError}
          </div>
        )}

        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border p-4 shadow-lg">
        <div className="container mx-auto max-w-4xl">
          <div className="flex gap-4 justify-center">
            <Button
              onClick={handleBack}
              disabled={isBusy}
              variant="tertiary"
              size="tertiary"
            >
              Back
            </Button>
            <Button
              onClick={handleNext}
              disabled={isNextDisabled}
              variant="secondary"
              size="lg"
            >
              {currentStep === 4 ? "Complete" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PhotoTourHeader({
  onSaveAndExit,
  isDisabled,
}: {
  onSaveAndExit: () => void
  isDisabled: boolean
}) {
  return (
    <header className="bg-white border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex-shrink-0">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg"
              alt="Arco"
              className="h-4"
            />
          </div>

          <div className="flex items-center space-x-4">
            <a
              href="/help-center"
              target="_blank"
              rel="noopener noreferrer"
              className="body-small text-foreground px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary"
            >
              Questions?
            </a>

            <button
              onClick={onSaveAndExit}
              disabled={isDisabled}
              className="body-small bg-[#F2F2F2] text-[#222222] hover:bg-[#EBEBEB] font-medium px-[18px] py-3 rounded-full disabled:bg-transparent disabled:border disabled:border-[#EBEBEB] disabled:text-[#EBEBEB]"
            >
              {isDisabled ? "Saving..." : "Save and Exit"}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
