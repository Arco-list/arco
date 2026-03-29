"use client"

import { useState, useRef, useCallback } from "react"
import { Upload, X, ImageIcon } from "lucide-react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ImageUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploadComplete: (imageUrl: string) => void
  title?: string
  description?: string
  bucketName?: string
  maxSizeMB?: number
}

export function ImageUploadDialog({
  open,
  onOpenChange,
  onUploadComplete,
  title,
  description,
  bucketName = "category-images",
  maxSizeMB = 2,
}: ImageUploadDialogProps) {
  const t = useTranslations("dashboard")
  const resolvedTitle = title ?? t("image_upload_title")
  const resolvedDescription = description ?? t("image_upload_description")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((file: File) => {
    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!validTypes.includes(file.type)) {
      toast.error(t("image_upload_invalid_type"))
      return
    }

    // Validate file size
    const maxSize = maxSizeMB * 1024 * 1024
    if (file.size > maxSize) {
      toast.error(t("image_upload_too_large", { size: maxSizeMB }))
      return
    }

    setSelectedFile(file)

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string)
    }
    reader.readAsDataURL(file)
  }, [maxSizeMB])

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(false)

    const file = event.dataTransfer.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error(t("image_upload_select_file"))
      return
    }

    setIsUploading(true)

    try {
      const supabase = getBrowserSupabaseClient()

      // Generate unique filename
      const timestamp = Date.now()
      const randomString = Math.random().toString(36).substring(2, 15)
      const fileExtension = selectedFile.name.split('.').pop()
      const fileName = `${timestamp}-${randomString}.${fileExtension}`

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, selectedFile, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        console.error("Upload error:", error)
        toast.error(t("image_upload_failed"))
        return
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(data.path)

      const imageUrl = publicUrlData.publicUrl

      toast.success(t("image_upload_success"))
      onUploadComplete(imageUrl)

      // Reset state
      handleRemoveFile()
      onOpenChange(false)
    } catch (error) {
      console.error("Upload error:", error)
      toast.error(t("image_upload_unexpected"))
    } finally {
      setIsUploading(false)
    }
  }

  const handleCancel = () => {
    handleRemoveFile()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{resolvedTitle}</DialogTitle>
          <DialogDescription>{resolvedDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!selectedFile ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
              <p className="mb-2 text-sm font-medium">
                {t("image_upload_drag")}
              </p>
              <p className="mb-4 text-xs text-muted-foreground">
                {t("image_upload_browse")}
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                {t("image_upload_choose")}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <p className="mt-4 text-xs text-muted-foreground">
                {t("image_upload_max_size", { size: maxSizeMB })}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-lg border bg-muted">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="h-64 w-full object-contain"
                  />
                ) : (
                  <div className="flex h-64 items-center justify-center">
                    <ImageIcon className="h-16 w-16 text-muted-foreground" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="absolute right-2 top-2 rounded-full bg-background p-1 shadow-md hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="quaternary"
            size="quaternary"
            onClick={handleCancel}
            disabled={isUploading}
          >
            {t("image_upload_cancel")}
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
          >
            {isUploading ? t("image_upload_uploading") : t("image_upload_upload")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
