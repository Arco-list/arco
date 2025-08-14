"use client"

import type React from "react"
import { useRouter } from "next/navigation"

import { useState } from "react"
import { ImageIcon, MoreHorizontal, Trash2, Bed, Bath, Car, TreePine, Utensils, Sofa, Home, Waves } from "lucide-react"

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

export default function PhotoTourPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [uploadedPhotos, setUploadedPhotos] = useState<Array<{ id: string; url: string; isCover: boolean }>>([])
  const [dragOver, setDragOver] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])
  const [featurePhotos, setFeaturePhotos] = useState<Record<string, string[]>>({})
  const [featureCoverPhotos, setFeatureCoverPhotos] = useState<Record<string, string>>({})
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showPhotoSelector, setShowPhotoSelector] = useState<string | null>(null)
  const [showAddFeatureModal, setShowAddFeatureModal] = useState(false)
  const [tempSelectedFeatures, setTempSelectedFeatures] = useState<string[]>([])
  const [tempSelectedPhotos, setTempSelectedPhotos] = useState<string[]>([])
  const [tempCoverPhoto, setTempCoverPhoto] = useState<string>("")
  const [modalDragOver, setModalDragOver] = useState(false)
  const router = useRouter()

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1)
    } else if (currentStep === 4) {
      router.push("/add-professionals")
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return

    Array.from(files).forEach((file, index) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const newPhoto = {
            id: Math.random().toString(36).substr(2, 9),
            url: e.target?.result as string,
            isCover: uploadedPhotos.length === 0 && index === 0,
          }
          setUploadedPhotos((prev) => [...prev, newPhoto])
        }
        reader.readAsDataURL(file)
      }
    })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFileUpload(e.dataTransfer.files)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const setCoverPhoto = (id: string) => {
    setUploadedPhotos((prev) =>
      prev.map((photo) => ({
        ...photo,
        isCover: photo.id === id,
      })),
    )
    setOpenMenuId(null)
  }

  const deletePhoto = (id: string) => {
    setUploadedPhotos((prev) => {
      const filtered = prev.filter((photo) => photo.id !== id)
      if (filtered.length > 0 && !filtered.some((photo) => photo.isCover)) {
        filtered[0].isCover = true
      }
      return filtered
    })
    setOpenMenuId(null)
  }

  const toggleFeature = (featureId: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(featureId) ? prev.filter((id) => id !== featureId) : [...prev, featureId],
    )
  }

  const assignPhotosToFeature = (featureId: string, photoIds: string[]) => {
    setFeaturePhotos((prev) => ({
      ...prev,
      [featureId]: photoIds,
    }))
    setShowPhotoSelector(null)
  }

  const getFeaturePhotoCount = (featureId: string) => {
    return featurePhotos[featureId]?.length || 0
  }

  const getFeatureCoverPhoto = (featureId: string) => {
    const coverPhotoId = featureCoverPhotos[featureId]
    if (coverPhotoId) {
      const photo = uploadedPhotos.find((p) => p.id === coverPhotoId)
      return photo?.url || null
    }

    const photoIds = featurePhotos[featureId]
    if (!photoIds || photoIds.length === 0) return null
    const photo = uploadedPhotos.find((p) => p.id === photoIds[0])
    return photo?.url || null
  }

  const features = [
    { id: "bedroom", name: "Bedroom", icon: Bed },
    { id: "bathroom", name: "Bathroom", icon: Bath },
    { id: "garage", name: "Garage", icon: Car },
    { id: "garden", name: "Garden", icon: TreePine },
    { id: "kitchen", name: "Kitchen", icon: Utensils },
    { id: "living-room", name: "Living Room", icon: Sofa },
    { id: "office", name: "Office", icon: Home },
    { id: "pool", name: "Pool", icon: Waves },
    { id: "balcony", name: "Balcony", icon: Home },
    { id: "basement", name: "Basement", icon: Home },
    { id: "attic", name: "Attic", icon: Home },
    { id: "terrace", name: "Terrace", icon: Home },
  ]

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

  const renderStep2 = () => (
    <div className="text-left">
      <h1 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">Add photos of your project</h1>

      <p className="text-gray-500 text-base mb-8">
        You will need 5 photos to get started. You can add more photos and make changes later.
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
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
            <span className="bg-gray-900 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors cursor-pointer">
              Browse
            </span>
          </label>
        </div>

        {uploadedPhotos.map((photo) => (
          <div key={photo.id} className="relative group">
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
                <div className="absolute top-8 right-0 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[140px]">
                  <button
                    onClick={() => setCoverPhoto(photo.id)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Set cover photo
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

  const renderStep3 = () => (
    <div className="text-left">
      <h1 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">Tell us what your project has to offer</h1>

      <p className="text-gray-500 text-base mb-8">You can add more features after you published your project</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {features.map((feature) => {
          const IconComponent = feature.icon
          const isSelected = selectedFeatures.includes(feature.id)

          return (
            <button
              key={feature.id}
              onClick={() => toggleFeature(feature.id)}
              className={`p-6 rounded-lg border-2 transition-all text-left ${
                isSelected ? "border-gray-900 bg-gray-50" : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <IconComponent className="w-6 h-6 text-gray-700 mb-3" />
              <p className="font-medium text-gray-900">{feature.name}</p>
            </button>
          )
        })}
      </div>
    </div>
  )

  const renderStep4 = () => (
    <div className="text-left">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-gray-900 leading-tight">Photo tour</h1>

        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="bg-gray-900 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-800 transition-colors"
          >
            <span className="text-xl font-light">+</span>
          </button>

          {showAddMenu && (
            <div className="absolute top-12 right-0 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-10 min-w-[140px]">
              <label className="block">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />
                <span className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer block">
                  Add photos
                </span>
              </label>
              <button
                onClick={() => setShowAddFeatureModal(!showAddFeatureModal)}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Add feature
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="text-gray-500 text-base mb-8">
        Add photos for every feature. Only features with photos will be published.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {selectedFeatures.map((featureId) => {
          const feature = features.find((f) => f.id === featureId)
          if (!feature) return null

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
                      alt={feature.name}
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
                  <h3 className="font-medium text-gray-900 mb-1">{feature.name}</h3>
                  <p className="text-sm text-gray-500">{photoCount > 0 ? `${photoCount} photos` : "Add photos"}</p>
                </div>
              </button>
            </div>
          )
        })}
      </div>

      {/* Add Feature Modal */}
      {showAddFeatureModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Add feature</h2>
                <button
                  onClick={() => setShowAddFeatureModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-3 gap-4 mb-6">
                {features.map((feature) => {
                  const IconComponent = feature.icon
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
                  onClick={() => setShowAddFeatureModal(false)}
                  className="flex-1 bg-white text-gray-900 py-3 px-6 rounded-md text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveNewFeatures}
                  disabled={tempSelectedFeatures.length === 0}
                  className="flex-1 bg-gray-900 text-white py-3 px-6 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Selector Modal */}
      {showPhotoSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Select photos for {features.find((f) => f.id === showPhotoSelector)?.name}
                </h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => deleteFeature(showPhotoSelector!)}
                    className="text-red-600 hover:text-red-700 font-medium transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete feature
                  </button>
                  <button onClick={cancelPhotoSelection} className="text-gray-400 hover:text-gray-600 text-2xl">
                    ×
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* File Upload Section */}
              <div className="mb-6">
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    modalDragOver ? "border-gray-400 bg-gray-50" : "border-gray-300"
                  }`}
                  onDrop={handleModalDrop}
                  onDragOver={handleModalDragOver}
                  onDragLeave={handleModalDragLeave}
                >
                  <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-900 font-medium mb-1">Upload new photos</p>
                  <p className="text-gray-500 text-sm mb-4">Drag and drop or browse for photos</p>
                  <label className="inline-block">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleModalFileUpload(e.target.files)}
                    />
                    <span className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors cursor-pointer">
                      Browse Files
                    </span>
                  </label>
                </div>
              </div>

              {/* Photo Selection Grid */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Select from existing photos</h3>
                  <div className="flex items-center gap-4">
                    {tempCoverPhoto && <p className="text-sm text-blue-600 font-medium">Cover photo selected</p>}
                    <p className="text-sm text-gray-500">{tempSelectedPhotos.length} selected</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {uploadedPhotos.map((photo) => {
                    const isSelected = tempSelectedPhotos.includes(photo.id)
                    const isCoverPhoto = tempCoverPhoto === photo.id

                    return (
                      <div key={photo.id} className="relative">
                        <button
                          onClick={() => togglePhotoSelection(photo.id)}
                          className={`aspect-square rounded-lg overflow-hidden border-2 transition-all relative w-full ${
                            isSelected
                              ? "border-gray-900 ring-2 ring-gray-900 ring-offset-2"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <img
                            src={photo.url || "/placeholder.svg"}
                            alt="Project photo"
                            className="w-full h-full object-cover"
                          />
                          {isSelected && (
                            <div className="absolute top-2 right-2">
                              <div className="bg-gray-900 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium shadow-lg">
                                ✓
                              </div>
                            </div>
                          )}
                          {isCoverPhoto && (
                            <div className="absolute top-2 left-2 bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium">
                              Cover
                            </div>
                          )}
                        </button>

                        {isSelected && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setTempCoverPhoto(isCoverPhoto ? "" : photo.id)
                            }}
                            className={`absolute bottom-2 left-2 right-2 text-xs py-1 px-2 rounded font-medium transition-colors ${
                              isCoverPhoto
                                ? "bg-blue-600 text-white"
                                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            {isCoverPhoto ? "Cover photo" : "Set as cover"}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={cancelPhotoSelection}
                  className="flex-1 bg-white text-gray-900 py-3 px-6 rounded-md text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveSelectedPhotos}
                  className="flex-1 bg-gray-900 text-white py-3 px-6 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  Save Selection ({tempSelectedPhotos.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const toggleTempFeature = (featureId: string) => {
    setTempSelectedFeatures((prev) =>
      prev.includes(featureId) ? prev.filter((id) => id !== featureId) : [...prev, featureId],
    )
  }

  const saveNewFeatures = () => {
    setSelectedFeatures((prev) => [...new Set([...prev, ...tempSelectedFeatures])])
    setShowAddFeatureModal(false)
    setTempSelectedFeatures([])
  }

  const handleModalFileUpload = (files: FileList | null) => {
    if (!files) return

    Array.from(files).forEach((file, index) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const newPhoto = {
            id: Math.random().toString(36).substr(2, 9),
            url: e.target?.result as string,
            isCover: uploadedPhotos.length === 0 && index === 0,
          }
          setUploadedPhotos((prev) => [...prev, newPhoto])
          setTempSelectedPhotos((prev) => [...prev, newPhoto.id])
        }
        reader.readAsDataURL(file)
      }
    })
  }

  const handleModalDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setModalDragOver(false)
    handleModalFileUpload(e.dataTransfer.files)
  }

  const handleModalDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setModalDragOver(true)
  }

  const handleModalDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setModalDragOver(false)
  }

  const togglePhotoSelection = (photoId: string) => {
    setTempSelectedPhotos((prev) => (prev.includes(photoId) ? prev.filter((id) => id !== photoId) : [...prev, photoId]))
  }

  const openPhotoSelector = (featureId: string) => {
    setShowPhotoSelector(featureId)
    setTempSelectedPhotos(featurePhotos[featureId] || [])
    setTempCoverPhoto(featureCoverPhotos[featureId] || "")
  }

  const saveSelectedPhotos = () => {
    if (showPhotoSelector) {
      setFeaturePhotos((prev) => ({
        ...prev,
        [showPhotoSelector]: tempSelectedPhotos,
      }))
      if (tempCoverPhoto) {
        setFeatureCoverPhotos((prev) => ({
          ...prev,
          [showPhotoSelector]: tempCoverPhoto,
        }))
      }
    }
    setShowPhotoSelector(null)
    setTempSelectedPhotos([])
    setTempCoverPhoto("")
  }

  const cancelPhotoSelection = () => {
    setShowPhotoSelector(null)
    setTempSelectedPhotos([])
    setTempCoverPhoto("")
  }

  const deleteFeature = (featureId: string) => {
    setSelectedFeatures((prev) => prev.filter((id) => id !== featureId))
    setFeaturePhotos((prev) => {
      const newFeaturePhotos = { ...prev }
      delete newFeaturePhotos[featureId]
      return newFeaturePhotos
    })
    setFeatureCoverPhotos((prev) => {
      const newCoverPhotos = { ...prev }
      delete newCoverPhotos[featureId]
      return newCoverPhotos
    })
    setShowPhotoSelector(null)
  }

  return (
    <div className="min-h-screen bg-white">
      <PhotoTourHeader />
      <main className="container mx-auto px-4 py-16 max-w-4xl pb-32">
        <div className="mb-12">
          <ProgressIndicator currentStep={currentStep} totalSteps={4} />
        </div>

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
              disabled={currentStep === 1}
              className="flex-1 bg-white text-gray-900 py-3 px-6 rounded-md text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>
            <button
              onClick={handleNext}
              disabled={
                (currentStep === 2 && uploadedPhotos.length < 5) ||
                (currentStep === 3 && selectedFeatures.length === 0) ||
                (currentStep === 4 && !selectedFeatures.some((featureId) => getFeaturePhotoCount(featureId) > 0))
              }
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

function PhotoTourHeader() {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex-shrink-0">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg"
              alt="Arco"
              className="h-6"
            />
          </div>

          <div className="flex items-center space-x-4">
            <a
              href="/help-center"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-700 hover:text-gray-900 font-medium transition-colors"
            >
              Questions?
            </a>

            <button className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium transition-colors">
              Save and Exit
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
