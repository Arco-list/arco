"use client"

import { useEffect, useId, useState } from "react"
import { AlertCircle, ImageIcon, MoreHorizontal, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent as ConfirmationDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { OVERLAY_CLASSES, type FeatureDisplay, type UploadedPhoto } from "@/hooks/use-project-photo-tour"

type FeaturePhotoSelectorModalProps = {
  isOpen: boolean
  featureId: string | null
  featureDisplay: FeatureDisplay | null
  selectablePhotos: UploadedPhoto[]
  selectedPhotoIds: string[]
  coverPhotoId: string
  uploadedPhotosCount: number
  modalUploadErrors: string[]
  isSaving: boolean
  isUploading: boolean
  modalDragOver: boolean
  onTogglePhoto: (photoId: string) => void
  onSetCoverPhoto: (photoId: string) => void
  onDeletePhoto?: (photoId: string) => void
  onSave: () => void | Promise<void>
  onCancel: () => void
  onClose: () => void
  onDeleteFeature?: () => void
  canDeleteFeature?: boolean
  onModalDrop: (event: React.DragEvent<HTMLDivElement>) => void
  onModalDragOver: (event: React.DragEvent<HTMLDivElement>) => void
  onModalDragLeave: (event: React.DragEvent<HTMLDivElement>) => void
  onModalFileUpload: (files: FileList | null) => void | Promise<void>
  onDismissErrors: () => void
  taglineValue?: string
  onTaglineChange?: (value: string) => void
  highlightValue?: boolean
  onHighlightChange?: (value: boolean) => void
  saveDisabled?: boolean
  overlayClassName?: string
  saveLabel?: string
  cancelLabel?: string
}

export function FeaturePhotoSelectorModal({
  isOpen,
  featureId,
  featureDisplay,
  selectablePhotos,
  selectedPhotoIds,
  coverPhotoId,
  uploadedPhotosCount,
  modalUploadErrors,
  isSaving,
  isUploading,
  modalDragOver,
  onTogglePhoto,
  onSetCoverPhoto,
  onDeletePhoto,
  onSave,
  onCancel,
  onClose,
  onDeleteFeature,
  canDeleteFeature = false,
  onModalDrop,
  onModalDragOver,
  onModalDragLeave,
  onModalFileUpload,
  onDismissErrors,
  taglineValue,
  onTaglineChange,
  highlightValue,
  onHighlightChange,
  saveDisabled = false,
  overlayClassName = OVERLAY_CLASSES,
  saveLabel = "Save selection",
  cancelLabel = "Cancel",
}: FeaturePhotoSelectorModalProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const taglineInputId = useId()
  const highlightToggleId = useId()

  useEffect(() => {
    setOpenMenuId(null)
  }, [featureId, isOpen])

  if (!isOpen || !featureId) {
    return null
  }

  const featureName = featureDisplay?.name ?? "feature"
  const selectedCount = selectedPhotoIds.length
  const coverSelected = Boolean(coverPhotoId && selectedPhotoIds.includes(coverPhotoId))

  return (
    <div className={overlayClassName}>
      <div className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-lg bg-white overflow-hidden">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-white p-6 flex-shrink-0">
          <h2 className="text-xl font-semibold text-foreground">Select photos for {featureName}</h2>
          <div className="flex items-center gap-3">
            {canDeleteFeature && onDeleteFeature && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="flex items-center gap-2 text-sm font-medium text-red-600 transition-colors hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                    Delete feature
                  </button>
                </AlertDialogTrigger>
                <ConfirmationDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove this feature?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove {featureName} and unassign its photos from the project. You can add it again later
                      if needed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-700"
                      onClick={() => {
                        onDeleteFeature()
                      }}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </ConfirmationDialogContent>
              </AlertDialog>
            )}
            <button onClick={onClose} className="text-2xl leading-none text-muted-foreground hover:text-text-secondary">
              ×
            </button>
          </div>
        </div>

        <div className="space-y-6 p-6 pb-8 overflow-y-auto overflow-x-hidden flex-1">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Select from existing photos</h3>
              <div className="flex items-center gap-4 text-sm text-text-secondary">
                {coverSelected && <span className="font-medium text-blue-600">Cover photo selected</span>}
                <span>{selectedCount} selected</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              <div
                className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                  modalDragOver ? "border-border bg-surface" : "border-border"
                }`}
                onDrop={onModalDrop}
                onDragOver={onModalDragOver}
                onDragLeave={onModalDragLeave}
              >
                <ImageIcon className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="font-medium text-foreground">Upload new photos</p>
                <p className="mb-4 text-sm text-text-secondary">Drag and drop or browse for photos</p>
                <label className="inline-block">
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png"
                    className="hidden"
                    disabled={isUploading}
                    onChange={(event) => {
                      void onModalFileUpload(event.target.files)
                      event.target.value = ""
                    }}
                  />
                  <Button
                    asChild
                    variant="secondary"
                    size="lg"
                    disabled={isUploading}
                  >
                    <span>
                      {isUploading ? "Uploading…" : "Browse Files"}
                    </span>
                  </Button>
                </label>
                {modalUploadErrors.length > 0 && (
                  <ul className="mt-4 space-y-1 text-left text-sm text-red-600">
                    {modalUploadErrors.map((error, index) => (
                      <li key={`${error}-${index}`}>{error}</li>
                    ))}
                  </ul>
                )}
              </div>

              {selectablePhotos.map((photo) => {
                const isSelected = selectedPhotoIds.includes(photo.id)
                const isCoverPhoto = coverPhotoId === photo.id

                return (
                  <div key={photo.id} className="relative">
                    <button
                      onClick={() => {
                        setOpenMenuId(null)
                        onTogglePhoto(photo.id)
                      }}
                      className={`relative block aspect-square w-full overflow-hidden rounded-lg border-2 transition-all ${
                        isSelected
                          ? "border-foreground ring-2 ring-gray-900 ring-offset-2"
                          : "border-border hover:border-border"
                      }`}
                    >
                      <img src={photo.url || "/placeholder.svg"} alt="Project photo" className="h-full w-full object-cover" />
                      {isSelected && (
                        <div className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-sm font-medium text-white shadow">
                          ✓
                        </div>
                      )}
                      {isCoverPhoto && (
                        <div className="absolute left-2 top-2 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white">
                          Cover
                        </div>
                      )}
                    </button>

                    {(onDeletePhoto || isSelected) && (
                      <div className="absolute right-2 top-2">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === photo.id ? null : photo.id)}
                          className="rounded-full bg-white p-1 shadow-md transition-colors hover:bg-surface"
                        >
                          <MoreHorizontal className="h-4 w-4 text-text-secondary" />
                        </button>

                        {openMenuId === photo.id && (
                          <div className="absolute right-0 top-8 min-w-[160px] rounded-lg border border-border bg-white py-1 shadow-lg">
                            <button
                              onClick={() => {
                                if (isSelected && !isCoverPhoto) {
                                  onSetCoverPhoto(photo.id)
                                  setOpenMenuId(null)
                                }
                              }}
                              disabled={!isSelected || isCoverPhoto}
                              className={`block w-full px-3 py-2 text-left text-sm transition-colors ${
                                !isSelected || isCoverPhoto
                                  ? "cursor-not-allowed text-muted-foreground"
                                  : "text-foreground hover:bg-surface"
                              }`}
                            >
                              Set as cover
                            </button>
                            {onDeletePhoto && (
                              <button
                                onClick={() => {
                                  setOpenMenuId(null)
                                  if (isSelected) {
                                    onTogglePhoto(photo.id)
                                  }
                                  onDeletePhoto(photo.id)
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
                              >
                                <Trash2 className="h-3 w-3" />
                                Delete photo
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {selectablePhotos.length === 0 && (
              <div className="mt-4 rounded-lg border border-dashed border-border bg-surface p-4 text-sm text-text-secondary">
                {uploadedPhotosCount === 0
                  ? "Upload photos to get started"
                  : "All photos are assigned. Upload more to add to this feature."}
              </div>
            )}
          </div>

          {(onTaglineChange || onHighlightChange) && (
            <div className="space-y-4">
              {onTaglineChange && (
                <div>
                  <label htmlFor={taglineInputId} className="block text-sm font-medium text-foreground">
                    Feature tagline
                  </label>
                  <Input
                    id={taglineInputId}
                    value={taglineValue ?? ""}
                    onChange={(event) => onTaglineChange(event.target.value)}
                    placeholder="Add a short tagline"
                    maxLength={200}
                    className="mt-2"
                  />
                  <p className="mt-1 text-xs text-text-secondary">
                    Displayed below the feature title in the Highlights section on the project page.
                  </p>
                </div>
              )}

              {onHighlightChange && (
                <label
                  htmlFor={highlightToggleId}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3"
                >
                  <div className="mr-4">
                    <p className="text-sm font-medium text-foreground">Highlight this feature</p>
                    <p className="text-xs text-text-secondary">
                      Toggle to feature this category in the Highlights section on the project page.
                    </p>
                  </div>
                  <Switch
                    id={highlightToggleId}
                    checked={Boolean(highlightValue)}
                    onCheckedChange={onHighlightChange}
                  />
                </label>
              )}
            </div>
          )}

          {modalUploadErrors.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
                <div className="space-y-2">
                  <ul className="space-y-1">
                    {modalUploadErrors.map((error, index) => (
                      <li key={`${error}-${index}`}>{error}</li>
                    ))}
                  </ul>
                  <button
                    onClick={onDismissErrors}
                    className="inline-flex items-center font-medium text-red-700 transition-colors hover:text-red-800"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border bg-white p-6 pt-4 flex-shrink-0">
          <div className="flex gap-4 justify-end">
            <Button
              onClick={onCancel}
              variant="tertiary"
              size="tertiary"
            >
              {cancelLabel}
            </Button>
            <Button
              onClick={() => void onSave()}
              disabled={isSaving || saveDisabled}
              variant="secondary"
              size="lg"
            >
              {isSaving ? "Saving…" : saveLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export type { FeaturePhotoSelectorModalProps }
