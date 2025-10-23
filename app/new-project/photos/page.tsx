"use client"

import type React from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { useEffect, useMemo, useState } from "react"
import type { LucideIcon } from "lucide-react"
import { Grid3x3, Home, ImageIcon, MoreHorizontal, Trash2 } from "lucide-react"
import { FeaturePhotoSelectorModal } from "@/components/feature-photo-selector-modal"
import { SUBTYPE_ICON_MAP } from "@/components/filter-icon-map"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import type { Tables } from "@/lib/supabase/types"
import {
  ADDITIONAL_FEATURE_ID,
  BUILDING_FEATURE_ID,
  MIN_PHOTOS_REQUIRED,
  OVERLAY_CLASSES,
  type FeatureOption,
  useProjectPhotoTour,
} from "@/hooks/use-project-photo-tour"
import { resolveFeatureIcon } from "@/lib/icons/project-features"
import { resolveProjectDetailsIcon } from "@/lib/project-details"

function ProgressIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="w-full">
      {/* Step counter */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-900">
          Step {currentStep} of {totalSteps}
        </span>
        <span className="text-sm text-gray-500">{Math.round((currentStep / totalSteps) * 100)}% complete</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-gray-900 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        />
      </div>
    </div>
  )
}

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
  const [currentStep, setCurrentStep] = useState(1)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const router = useRouter()

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
  } = useProjectPhotoTour({ supabase, projectId })

  const selectablePhotos = useMemo(
    () => getSelectablePhotos(showPhotoSelector),
    [getSelectablePhotos, showPhotoSelector],
  )
  const currentFeatureDisplay = useMemo(
    () => (showPhotoSelector ? getFeatureDisplay(showPhotoSelector) : null),
    [getFeatureDisplay, showPhotoSelector],
  )

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
          <ImageIcon className="w-12 h-12 text-gray-900 mb-6" />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-6 leading-tight">Create a photo tour</h1>

        <p className="text-gray-600 text-lg leading-relaxed">
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
        <h1 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">Add photos of your project</h1>

        <p className="text-gray-500 text-base mb-2">
          Upload at least {MIN_PHOTOS_REQUIRED} high-quality JPG or PNG images (1200px+). Drag to reorder once
          uploaded.
        </p>
        <p className="text-sm font-medium text-gray-700 mb-8">
          {uploadedPhotos.length} uploaded · {progressLabel}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver ? "border-gray-400 bg-gray-50" : "border-gray-300"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-900 font-medium mb-1">Drag and drop</p>
            <p className="text-gray-500 text-sm mb-4">or browse for photos</p>
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
                className={`bg-gray-900 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                  isUploading ? "opacity-60 cursor-not-allowed" : "hover:bg-gray-800 cursor-pointer"
                }`}
              >
                {isUploading ? "Uploading..." : "Browse"}
              </span>
            </label>
            {uploadErrors.length > 0 && (
              <ul className="mt-4 text-left text-sm text-red-600 space-y-1">
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
              <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                <img
                  src={photo.url || "/placeholder.svg"}
                  alt="Uploaded project photo"
                  className="w-full h-full object-cover"
                />
              </div>

              {photo.isCover && (
                <div className="absolute top-2 left-2 bg-gray-900 text-white px-2 py-1 rounded text-xs font-medium">
                  Cover photo
                </div>
              )}

              <div className="absolute top-2 right-2">
                <button
                  onClick={() => setOpenMenuId(openMenuId === photo.id ? null : photo.id)}
                  className="bg-white rounded-full p-1 shadow-md hover:bg-gray-50 transition-colors"
                >
                  <MoreHorizontal className="w-4 h-4 text-gray-600" />
                </button>

                {openMenuId === photo.id && (
                  <div className="absolute top-8 right-0 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[160px]">
                    <button
                      onClick={() => setCoverPhoto(photo.id)}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Set as cover photo
                    </button>
                    <button
                      onClick={() => deletePhoto(photo.id)}
                      className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-gray-50 transition-colors flex items-center gap-2"
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
    const userSelectedFeatureIds = selectedFeatures.filter((id) => id !== BUILDING_FEATURE_ID)

    return (
      <div className="text-left">
        <h1 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">Tell us what your project has to offer</h1>

        <p className="text-gray-500 text-base mb-6">
          Select the spaces that best describe your
          project — you can adjust these later.
        </p>

        {featureError && <p className="text-sm text-amber-600 mb-4">{featureError}</p>}

        {isLoadingFeatures ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-28 rounded-lg border-2 border-dashed border-gray-200 animate-pulse" />
            ))}
          </div>
        ) : orderedFeatureOptions.length === 0 ? (
          <p className="text-sm text-gray-500">No feature taxonomy available yet. Use the fallback list from the PRD.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {orderedFeatureOptions.map((feature) => {
              const IconComponent = resolveIconForFeatureOption(feature)
              const isSelected = userSelectedFeatureIds.includes(feature.id)

              return (
                <button
                  key={feature.id}
                  onClick={() => toggleFeature(feature.id)}
                  disabled={isSavingFeatures}
                  className={`p-6 rounded-lg border-2 transition-all text-left ${
                    isSelected
                      ? "border-gray-900 bg-gray-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  } ${isSavingFeatures ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  <IconComponent className="w-6 h-6 text-gray-700 mb-3" />
                  <p className="font-medium text-gray-900">{feature.name}</p>
                </button>
              )
            })}
          </div>
        )}

        {userSelectedFeatureIds.length === 0 && !isLoadingFeatures && (
          <p className="mt-6 text-sm text-gray-500">
            Tip: pick a few rooms to help homeowners explore your project. You can always add more later.
          </p>
        )}
      </div>
    )
  }

  const renderStep4 = () => (
    <div className="text-left">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-gray-900 leading-tight">Photo tour</h1>

        <div className="relative">
          <button
            onClick={() => setShowAddMenu((state) => !state)}
            className="bg-gray-900 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-800 transition-colors"
            aria-haspopup="menu"
            aria-expanded={showAddMenu}
          >
            <span className="text-xl font-light">+</span>
          </button>

          {showAddMenu && (
            <div className="absolute top-12 right-0 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-10 min-w-[160px]">
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
                    isUploading ? "text-gray-400 cursor-not-allowed" : "text-gray-700 hover:bg-gray-50"
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
                  isSavingFeatures ? "text-gray-400 cursor-not-allowed" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {isSavingFeatures ? "Saving…" : "Add feature"}
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="text-gray-500 text-base mb-8">
        Add photos for every feature. Only features with photos will appear on the published page.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {displayFeatureIds.map((featureId) => {
          const featureDisplay = getFeatureDisplay(featureId)
          const FeatureIcon = featureDisplay.icon
          const photoCount = getFeaturePhotoCount(featureId)
          const coverPhoto = getFeatureCoverPhoto(featureId)

          return (
            <div key={featureId} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => openPhotoSelector(featureId)}
                className="w-full text-left hover:bg-gray-50 transition-colors"
              >
                <div className="aspect-square bg-gray-100 relative">
                  {coverPhoto ? (
                    <img
                      src={coverPhoto || "/placeholder.svg"}
                      alt={featureDisplay.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <ImageIcon className="w-12 h-12 text-gray-400 mb-4" />
                      <span className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors">
                        Select photos
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <FeatureIcon className="w-4 h-4 text-gray-600" />
                    <h3 className="font-medium text-gray-900">{featureDisplay.name}</h3>
                  </div>
                  <p className="text-sm text-gray-500">{photoCount > 0 ? `${photoCount} photo${photoCount === 1 ? "" : "s"}` : "Add photos"}</p>
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
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Add feature</h2>
                <button
                  onClick={() => {
                    setShowAddFeatureModal(false)
                    clearTempFeatureSelection()
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-3 gap-4 mb-6">
                {orderedFeatureOptions.map((feature) => {
                  const IconComponent = resolveIconForFeatureOption(feature)
                  const isSelected = tempSelectedFeatures.includes(feature.id)
                  const isAlreadyAdded = selectedFeatures.includes(feature.id)

                  return (
                    <button
                      key={feature.id}
                      onClick={() => !isAlreadyAdded && toggleTempFeature(feature.id)}
                      disabled={isAlreadyAdded}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        isAlreadyAdded
                          ? "border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed"
                          : isSelected
                            ? "border-gray-900 bg-gray-50"
                            : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <IconComponent className="w-6 h-6 text-gray-700 mb-2" />
                      <p className="font-medium text-gray-900 text-sm">{feature.name}</p>
                    </button>
                  )
                })}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAddFeatureModal(false)
                    clearTempFeatureSelection()
                  }}
                  className="flex-1 bg-white text-gray-900 py-3 px-6 rounded-md text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void saveNewFeatures()}
                  disabled={tempSelectedFeatures.length === 0 || isSavingFeatures}
                  className="flex-1 bg-gray-900 text-white py-3 px-6 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingFeatures ? "Adding..." : "Add selected"}
                </button>
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
        saveDisabled={tempSelectedPhotos.length === 0}
        saveLabel={
          tempSelectedPhotos.length > 0 ? `Save Selection (${tempSelectedPhotos.length})` : "Save selection"
        }
      />
    </div>
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

  const handleNext = () => {
    if (isBusy) {
      return
    }

    if (currentStep < 4) {
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

    if (currentStep > 1) {
      setCurrentStep((step) => step - 1)
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
          <ProgressIndicator currentStep={currentStep} totalSteps={4} />
        </div>

        {blockingError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {blockingError}
          </div>
        )}

        {featureMutationError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {featureMutationError}
          </div>
        )}

        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
        <div className="container mx-auto max-w-4xl">
          <div className="flex gap-4">
            <button
              onClick={handleBack}
              disabled={currentStep === 1 || isBusy}
              className="flex-1 bg-white text-gray-900 py-3 px-6 rounded-md text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>
            <button
              onClick={handleNext}
              disabled={isNextDisabled}
              className="flex-1 bg-gray-900 text-white py-3 px-6 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {currentStep === 4 ? "Complete" : "Next"}
            </button>
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
    <header className="bg-white border-b border-gray-200">
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
              className="text-sm text-gray-700 hover:text-gray-900 transition-colors"
            >
              Questions?
            </a>

            <button
              onClick={onSaveAndExit}
              disabled={isDisabled}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDisabled ? "Saving..." : "Save and Exit"}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
