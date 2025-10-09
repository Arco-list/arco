"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { LucideIcon } from "lucide-react"
import { Grid3x3, Home } from "lucide-react"

import type { Tables } from "@/lib/supabase/types"
import { resolveFeatureIcon } from "@/lib/icons/project-features"

export type FeatureOption = {
  id: string
  name: string
  slug?: string | null
  iconKey?: string | null
  sortOrder?: number | null
}

export type UploadedPhoto = {
  id: string
  url: string
  isCover: boolean
  storagePath: string | null
}

type FeatureCategoryRecord = Tables<"categories"> & {
  project_category_attributes: Tables<"project_category_attributes"> | null
}

type ProjectFeatureRow = Tables<"project_features">
type ProjectPhotoRow = Tables<"project_photos">

export const MIN_PHOTOS_REQUIRED = 5
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
const MIN_IMAGE_WIDTH = 1200
const MAX_FILES_PER_UPLOAD = 30
export const BUILDING_FEATURE_ID = "building-default"
export const ADDITIONAL_FEATURE_ID = "additional-photos"
export const OVERLAY_CLASSES = "modal-overlay fixed inset-0 flex items-center justify-center z-50 p-4"

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png"])
const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
}

const FALLBACK_FEATURES: FeatureOption[] = [
  { id: "bedroom", name: "Bedroom", slug: "bedroom" },
  { id: "bathroom", name: "Bathroom", slug: "bathroom" },
  { id: "kitchen", name: "Kitchen", slug: "kitchen" },
  { id: "living-room", name: "Living Room", slug: "living_room" },
  { id: "garden", name: "Garden", slug: "garden" },
  { id: "garage", name: "Garage", slug: "garage" },
  { id: "pool", name: "Pool", slug: "pool" },
  { id: "office", name: "Office", slug: "office" },
  { id: "balcony", name: "Balcony", slug: "balcony" },
  { id: "basement", name: "Basement", slug: "basement" },
  { id: "attic", name: "Attic", slug: "attic" },
  { id: "terrace", name: "Terrace", slug: "terrace" },
]

const isUuid = (value?: string | null): value is string =>
  !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

export type FeatureDisplay = {
  id: string
  name: string
  icon: LucideIcon
}

export type UseProjectPhotoTourResult = {
  projectId: string | null
  uploadedPhotos: UploadedPhoto[]
  featureOptions: FeatureOption[]
  orderedFeatureOptions: FeatureOption[]
  selectedFeatures: string[]
  featurePhotos: Record<string, string[]>
  featureCoverPhotos: Record<string, string>
  displayFeatureIds: string[]
  dragOver: boolean
  modalDragOver: boolean
  openMenuId: string | null
  showAddMenu: boolean
  showPhotoSelector: string | null
  showAddFeatureModal: boolean
  tempSelectedFeatures: string[]
  tempSelectedPhotos: string[]
  tempCoverPhoto: string
  setTempCoverPhoto: (value: string | ((prev: string) => string)) => void
  setTempSelectedPhotos: (value: string[] | ((prev: string[]) => string[])) => void
  isUploading: boolean
  isLoadingFeatures: boolean
  isLoadingProject: boolean
  isSavingFeatures: boolean
  isSavingSelection: boolean
  uploadErrors: string[]
  modalUploadErrors: string[]
  setUploadErrors: (value: string[] | ((prev: string[]) => string[])) => void
  setModalUploadErrors: (value: string[] | ((prev: string[]) => string[])) => void
  featureError: string | null
  featureMutationError: string | null
  projectLoadError: string | null
  getFeatureDisplay: (featureId: string) => FeatureDisplay
  getFeaturePhotoCount: (featureId: string) => number
  getFeatureCoverPhoto: (featureId: string) => string | null
  getSelectablePhotos: (featureId: string | null) => UploadedPhoto[]
  handleDragOver: (event: React.DragEvent) => void
  handleDragLeave: (event: React.DragEvent) => void
  handleDrop: (event: React.DragEvent) => void
  handleFileUpload: (files: FileList | null) => Promise<void>
  handleModalFileUpload: (files: FileList | null) => Promise<void>
  handleModalDrop: (event: React.DragEvent) => void
  handleModalDragOver: (event: React.DragEvent) => void
  handleModalDragLeave: (event: React.DragEvent) => void
  setShowAddMenu: (value: boolean | ((prev: boolean) => boolean)) => void
  openPhotoSelector: (featureId: string) => void
  cancelPhotoSelection: () => void
  saveSelectedPhotos: () => Promise<void>
  toggleTempPhoto: (photoId: string) => void
  toggleTempFeature: (featureId: string) => void
  saveNewFeatures: () => Promise<void>
  deleteFeature: (featureId: string) => Promise<void>
  toggleFeature: (featureId: string) => void
  handlePhotoDragStart: (event: React.DragEvent<HTMLDivElement>, photoId: string) => void
  handlePhotoDragOver: (event: React.DragEvent<HTMLDivElement>) => void
  handlePhotoDropOnCard: (event: React.DragEvent<HTMLDivElement>, targetId: string) => void
  handlePhotoDragEnd: () => void
  setCoverPhoto: (photoId: string) => void
  deletePhoto: (photoId: string) => void
  setOpenMenuId: (menuId: string | null) => void
  setShowAddFeatureModal: (value: boolean) => void
  appendUploadError: (message: string) => void
  resetUploadErrors: () => void
  resetModalUploadErrors: () => void
}

type UseProjectPhotoTourArgs = {
  supabase: SupabaseClient
  projectId: string | null
}

export function useProjectPhotoTour({ supabase, projectId }: UseProjectPhotoTourArgs): UseProjectPhotoTourResult {
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [modalDragOver, setModalDragOver] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([BUILDING_FEATURE_ID])
  const [featurePhotos, setFeaturePhotos] = useState<Record<string, string[]>>({})
  const [featureCoverPhotos, setFeatureCoverPhotos] = useState<Record<string, string>>({})
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showPhotoSelector, setShowPhotoSelector] = useState<string | null>(null)
  const [showAddFeatureModal, setShowAddFeatureModal] = useState(false)
  const [tempSelectedFeatures, setTempSelectedFeatures] = useState<string[]>([])
  const [tempSelectedPhotos, setTempSelectedPhotos] = useState<string[]>([])
  const [tempCoverPhoto, setTempCoverPhoto] = useState<string>("")
  const [featureOptions, setFeatureOptions] = useState<FeatureOption[]>(FALLBACK_FEATURES)
  const [isLoadingFeatures, setIsLoadingFeatures] = useState(false)
  const [featureError, setFeatureError] = useState<string | null>(null)
  const [uploadErrors, setUploadErrors] = useState<string[]>([])
  const [modalUploadErrors, setModalUploadErrors] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [resolvedProjectId, setResolvedProjectId] = useState<string | null>(null)
  const [isLoadingProject, setIsLoadingProject] = useState(false)
  const [projectLoadError, setProjectLoadError] = useState<string | null>(null)
  const [featureIdMap, setFeatureIdMap] = useState<Record<string, string>>({})
  const [featureMetadata, setFeatureMetadata] = useState<
    Record<string, { featureId: string; orderIndex: number; categoryId: string | null }>
  >({})
  const unresolvedAssignmentsRef = useRef<Map<string, string>>(new Map())
  const [isSavingFeatures, setIsSavingFeatures] = useState(false)
  const [isSavingSelection, setIsSavingSelection] = useState(false)
  const [featureMutationError, setFeatureMutationError] = useState<string | null>(null)

  const draggedPhotoIdRef = useRef<string | null>(null)
  const lastProjectIdRef = useRef<string | null>(null)

  const normaliseCoverFlag = useCallback((photos: UploadedPhoto[]) => {
    if (photos.length === 0) {
      return photos
    }

    const existingCover = photos.find((photo) => photo.isCover)
    const coverId = existingCover?.id ?? photos[0].id

    return photos.map((photo) => ({
      ...photo,
      isCover: photo.id === coverId,
    }))
  }, [])

  const generateUploadId = useCallback((): string => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID()
    }

    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16)
      crypto.getRandomValues(bytes)

      bytes[6] = (bytes[6] & 0x0f) | 0x40
      bytes[8] = (bytes[8] & 0x3f) | 0x80

      const hex = Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0"))
      return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`
    }

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
      const random = (Math.random() * 16) | 0
      const value = char === "x" ? random : (random & 0x3) | 0x8
      return value.toString(16)
    })
  }, [])

  const loadFeatureOptions = useCallback(async () => {
    setIsLoadingFeatures(true)
    setFeatureError(null)

    const { data, error } = await supabase
      .from("categories")
      .select("id,name,slug,sort_order,project_category_attributes(is_building_feature)")
      .eq("is_active", true)
      .eq("project_category_attributes.is_building_feature", true)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true })

    if (error) {
      setFeatureError("We could not load features from Supabase. Using fallback list for now.")
      setFeatureOptions(FALLBACK_FEATURES)
      setIsLoadingFeatures(false)
      return
    }

    const records = (data ?? []) as FeatureCategoryRecord[]
    const filtered = records.filter((record) => record.project_category_attributes?.is_building_feature)

    if (filtered.length === 0) {
      setFeatureOptions(FALLBACK_FEATURES)
      setIsLoadingFeatures(false)
      return
    }

    const mapped = filtered
      .map<FeatureOption>((record) => ({
        id: record.id,
        name: record.name,
        slug: record.slug,
        sortOrder: record.sort_order ?? undefined,
      }))
      .sort((a, b) => {
        const orderDiff = (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
        return orderDiff !== 0 ? orderDiff : a.name.localeCompare(b.name)
      })

    setFeatureOptions(mapped)
    setIsLoadingFeatures(false)
  }, [supabase])

  const ensureCoreFeatures = useCallback(
    async (projectFeatures: ProjectFeatureRow[], projectIdValue: string) => {
      let featureRows = [...projectFeatures]

      let buildingFeature = featureRows.find((row) => row.is_building_default)
      if (!buildingFeature) {
        const legacyBuilding = featureRows.find((row) => row.name === "Building")

        if (legacyBuilding) {
          const { error: upgradeError } = await supabase
            .from("project_features")
            .update({ is_building_default: true, order_index: legacyBuilding.order_index ?? 0 })
            .eq("id", legacyBuilding.id)

          if (upgradeError) {
            throw upgradeError
          }

          buildingFeature = {
            ...legacyBuilding,
            is_building_default: true,
            order_index: legacyBuilding.order_index ?? 0,
          }
          featureRows = featureRows.map((row) => (row.id === legacyBuilding.id ? buildingFeature! : row))
        } else {
          const newId = generateUploadId()
          const timestamp = new Date().toISOString()
          const newBuilding: ProjectFeatureRow = {
            id: newId,
            project_id: projectIdValue,
            name: "Building",
            is_building_default: true,
            order_index: 0,
            created_at: timestamp,
            updated_at: timestamp,
            category_id: null,
            cover_photo_id: null,
            description: null,
            is_highlighted: false,
            tagline: null,
          }

          const { error: buildingError } = await supabase.from("project_features").insert(newBuilding)

          if (buildingError) {
            throw buildingError
          }

          buildingFeature = newBuilding
          featureRows = [...featureRows, newBuilding]
        }
      }

      const maxOrderIndex = featureRows.reduce((max, row) => Math.max(max, row.order_index ?? 0), 0)

      let additionalFeature = featureRows.find(
        (row) => !row.is_building_default && !row.category_id && row.name === "Additional photos",
      )

      if (!additionalFeature) {
        const legacyAdditional = featureRows.find((row) => row.name === "Additional photos")

        if (legacyAdditional) {
          const { error: upgradeAdditionalError } = await supabase
            .from("project_features")
            .update({ category_id: null, order_index: legacyAdditional.order_index ?? maxOrderIndex + 1 })
            .eq("id", legacyAdditional.id)

          if (upgradeAdditionalError) {
            throw upgradeAdditionalError
          }

          additionalFeature = {
            ...legacyAdditional,
            category_id: null,
            order_index: legacyAdditional.order_index ?? maxOrderIndex + 1,
          }
          featureRows = featureRows.map((row) => (row.id === legacyAdditional.id ? additionalFeature! : row))
        } else {
          const newId = generateUploadId()
          const timestamp = new Date().toISOString()
          const newAdditional: ProjectFeatureRow = {
            id: newId,
            project_id: projectIdValue,
            name: "Additional photos",
            is_building_default: false,
            order_index: maxOrderIndex + 1,
            created_at: timestamp,
            updated_at: timestamp,
            category_id: null,
            cover_photo_id: null,
            description: null,
            is_highlighted: false,
            tagline: null,
          }

          const { error: additionalError } = await supabase.from("project_features").insert(newAdditional)

          if (additionalError) {
            throw additionalError
          }

          additionalFeature = newAdditional
          featureRows = [...featureRows, newAdditional]
        }
      }

      return { featureRows, buildingFeature, additionalFeature }
    },
    [generateUploadId, supabase],
  )

  const loadProjectContext = useCallback(
    async (projectIdValue: string) => {
      setIsLoadingProject(true)
      setProjectLoadError(null)

      try {
        const [featureResponse, photoResponse] = await Promise.all([
          supabase
            .from("project_features")
            .select("id, name, category_id, cover_photo_id, is_building_default, order_index")
            .eq("project_id", projectIdValue)
            .order("order_index", { ascending: true, nullsFirst: false }),
          supabase
            .from("project_photos")
            .select("id, url, is_primary, order_index, feature_id, storage_path")
            .eq("project_id", projectIdValue)
            .order("order_index", { ascending: true, nullsFirst: false }),
        ])

        if (featureResponse.error) {
          throw featureResponse.error
        }
        if (photoResponse.error) {
          throw photoResponse.error
        }

        const initialFeatures: ProjectFeatureRow[] = featureResponse.data ?? []

        const { featureRows, buildingFeature, additionalFeature } = await ensureCoreFeatures(
          initialFeatures,
          projectIdValue,
        )

        const uiKeyByFeatureId = new Map<string, string>()
        const idMap: Record<string, string> = {}
        const metadata: Record<string, { featureId: string; orderIndex: number; categoryId: string | null }> = {}
        const taxonomySelection = new Set<string>()

        if (buildingFeature) {
          uiKeyByFeatureId.set(buildingFeature.id, BUILDING_FEATURE_ID)
          idMap[BUILDING_FEATURE_ID] = buildingFeature.id
          metadata[BUILDING_FEATURE_ID] = {
            featureId: buildingFeature.id,
            orderIndex: buildingFeature.order_index ?? 0,
            categoryId: buildingFeature.category_id,
          }
        }

        if (additionalFeature) {
          uiKeyByFeatureId.set(additionalFeature.id, ADDITIONAL_FEATURE_ID)
          idMap[ADDITIONAL_FEATURE_ID] = additionalFeature.id
          metadata[ADDITIONAL_FEATURE_ID] = {
            featureId: additionalFeature.id,
            orderIndex: additionalFeature.order_index ?? 0,
            categoryId: additionalFeature.category_id,
          }
        }

        featureRows.forEach((feature) => {
          if (feature.is_building_default) {
            return
          }

          if (feature.category_id) {
            uiKeyByFeatureId.set(feature.id, feature.category_id)
            idMap[feature.category_id] = feature.id
            metadata[feature.category_id] = {
              featureId: feature.id,
              orderIndex: feature.order_index ?? 0,
              categoryId: feature.category_id,
            }
            taxonomySelection.add(feature.category_id)
            return
          }

          uiKeyByFeatureId.set(feature.id, feature.id)
          idMap[feature.id] = feature.id
          metadata[feature.id] = {
            featureId: feature.id,
            orderIndex: feature.order_index ?? 0,
            categoryId: feature.category_id,
          }
          taxonomySelection.add(feature.id)
        })

        const photoRows: ProjectPhotoRow[] = photoResponse.data ?? []
        const orderedPhotos = [...photoRows].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        const nextUploadedPhotos: UploadedPhoto[] = orderedPhotos.map((photo) => ({
          id: photo.id,
          url: photo.url,
          isCover: photo.is_primary ?? false,
          storagePath: photo.storage_path ?? null,
        }))

        const nextFeaturePhotos: Record<string, string[]> = {}
        const nextFeatureCoverPhotos: Record<string, string> = {}

        orderedPhotos.forEach((photo) => {
          const featureId = photo.feature_id
          const featureKey = featureId ? uiKeyByFeatureId.get(featureId) ?? ADDITIONAL_FEATURE_ID : BUILDING_FEATURE_ID
          if (!nextFeaturePhotos[featureKey]) {
            nextFeaturePhotos[featureKey] = []
          }
          nextFeaturePhotos[featureKey].push(photo.id)
        })

        featureRows.forEach((feature) => {
          const featureKey = uiKeyByFeatureId.get(feature.id)
          if (featureKey && feature.cover_photo_id) {
            nextFeatureCoverPhotos[featureKey] = feature.cover_photo_id
          }
        })

        if (!nextFeaturePhotos[BUILDING_FEATURE_ID]) {
          nextFeaturePhotos[BUILDING_FEATURE_ID] = []
        }

        if (!nextFeaturePhotos[ADDITIONAL_FEATURE_ID]) {
          nextFeaturePhotos[ADDITIONAL_FEATURE_ID] = []
        }

        setResolvedProjectId(projectIdValue)
        setFeatureIdMap(idMap)
        setFeatureMetadata(metadata)
        setSelectedFeatures([BUILDING_FEATURE_ID, ...Array.from(taxonomySelection)])
        setUploadedPhotos(normaliseCoverFlag(nextUploadedPhotos))
        setFeaturePhotos(nextFeaturePhotos)
        setFeatureCoverPhotos(nextFeatureCoverPhotos)
      } catch (error) {
        console.error("Failed to load project photo context", error)
        setProjectLoadError(
          error instanceof Error ? error.message : "We couldn't load your project photos. Please try again.",
        )
      } finally {
        setIsLoadingProject(false)
      }
    },
    [ensureCoreFeatures, normaliseCoverFlag, supabase],
  )

  useEffect(() => {
    void loadFeatureOptions()
  }, [loadFeatureOptions])

  useEffect(() => {
    if (!projectId || projectId === lastProjectIdRef.current) {
      return
    }

    lastProjectIdRef.current = projectId

    setResolvedProjectId(projectId)
    setSelectedFeatures([BUILDING_FEATURE_ID])
    setFeaturePhotos({})
    setFeatureCoverPhotos({})
    setFeatureIdMap({})
    setFeatureMetadata({})
    setUploadedPhotos([])
    setUploadErrors([])
    setModalUploadErrors([])
    setShowAddMenu(false)
    setShowPhotoSelector(null)
    setShowAddFeatureModal(false)
    setTempSelectedFeatures([])
    setTempSelectedPhotos([])
    setTempCoverPhoto("")
    setProjectLoadError(null)

    void loadProjectContext(projectId)
  }, [loadProjectContext, projectId])

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(false)
  }, [])

  const validateFile = useCallback((file: File) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `${file.name}: File is too large. Maximum size is 10MB.`
    }

    const extension = file.name.split(".").pop()?.toLowerCase()
    const mimeExtension = MIME_TO_EXTENSION[file.type]
    const normalizedExtension = mimeExtension ?? extension

    if (!normalizedExtension || !ALLOWED_EXTENSIONS.has(normalizedExtension)) {
      return `${file.name}: Unsupported file type. Please use JPG or PNG.`
    }

    return null
  }, [])

  const readImageDimensions = useCallback(async (file: File) => {
    const imageUrl = URL.createObjectURL(file)
    const image = new Image()

    const result = await new Promise<{ width: number; height: number } | null>((resolve, reject) => {
      image.onload = () => {
        resolve({ width: image.naturalWidth, height: image.naturalHeight })
        URL.revokeObjectURL(imageUrl)
      }
      image.onerror = () => {
        resolve(null)
        URL.revokeObjectURL(imageUrl)
      }
      image.src = imageUrl
    })

    return result
  }, [])

  const uploadFiles = useCallback(
    async (
      files: FileList | null,
      options: { addToModalSelection?: boolean; selectorFeatureId?: string | null } = {},
    ) => {
      if (!files || files.length === 0 || !resolvedProjectId) {
        return
      }

      if (files.length > MAX_FILES_PER_UPLOAD) {
        setUploadErrors([`You can upload up to ${MAX_FILES_PER_UPLOAD} photos at once.`])
        return
      }

      setIsUploading(true)

      const errors: string[] = []
      const uploaded: UploadedPhoto[] = []
      const modalPhotoIds: string[] = []

      const buildingFeatureId = featureIdMap[BUILDING_FEATURE_ID] ?? null

      for (const file of Array.from(files)) {
        const validationError = validateFile(file)
        if (validationError) {
          errors.push(validationError)
          continue
        }

        const dimensions = await readImageDimensions(file)
        if (!dimensions) {
          errors.push(`${file.name}: We couldn't read this image. Please try another file.`)
          continue
        }

        if (dimensions.width < MIN_IMAGE_WIDTH) {
          errors.push(
            `${file.name}: Image width must be at least ${MIN_IMAGE_WIDTH}px (current width: ${dimensions.width}px).`,
          )
          continue
        }

        const fileExtension = MIME_TO_EXTENSION[file.type] ?? file.name.split(".").pop()?.toLowerCase()
        const storagePath = `${resolvedProjectId}/${generateUploadId()}.${fileExtension}`

        try {
          const { data, error } = await supabase.storage.from("project-photos").upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
          })

          if (error) {
            errors.push(`${file.name}: ${error.message}`)
            continue
          }

          const {
            data: { publicUrl },
          } = supabase.storage.from("project-photos").getPublicUrl(data.path)

          const width = dimensions.width
          const height = dimensions.height

          const orderIndex = uploadedPhotos.length + uploaded.length
          const shouldBePrimary = uploadedPhotos.length + uploaded.length === 0
      const featureId = options.selectorFeatureId ?? showPhotoSelector ?? buildingFeatureId ?? null

          const photoId = generateUploadId()

          const { data: insertedPhoto, error: insertError } = await supabase
            .from("project_photos")
            .insert({
              id: photoId,
              project_id: resolvedProjectId,
              url: publicUrl,
              storage_path: storagePath,
              order_index: orderIndex,
              feature_id: featureId,
              is_primary: shouldBePrimary,
              width,
              height,
              file_size: file.size,
            })
            .select("id, url, is_primary, storage_path, feature_id")
            .single()

          if (insertError || !insertedPhoto) {
            errors.push(
              `${file.name}: ${insertError?.message ?? "We could not save this photo. Please try again."}`,
            )
            void supabase.storage.from("project-photos").remove([storagePath])
            continue
          }

          uploaded.push({
            id: insertedPhoto.id,
            url: insertedPhoto.url,
            isCover: insertedPhoto.is_primary ?? false,
            storagePath: insertedPhoto.storage_path ?? storagePath,
          })

          if (options.addToModalSelection) {
            modalPhotoIds.push(insertedPhoto.id)
          }
        } catch (error) {
          console.error(error)
          errors.push(`${file.name}: We could not process this image.`)
        }
      }

      if (uploaded.length > 0) {
        setUploadedPhotos((prev) => normaliseCoverFlag([...prev, ...uploaded]))

        setFeaturePhotos((prev) => {
          const next = { ...prev }
          const targetFeatureId = options.selectorFeatureId ?? showPhotoSelector ?? BUILDING_FEATURE_ID
          const existing = next[targetFeatureId] ? [...next[targetFeatureId]] : []
          existing.push(...uploaded.map((photo) => photo.id))
          next[targetFeatureId] = Array.from(new Set(existing))

          if (targetFeatureId !== BUILDING_FEATURE_ID) {
            const buildingPhotos = next[BUILDING_FEATURE_ID] ? [...next[BUILDING_FEATURE_ID]] : []
            const filtered = buildingPhotos.filter((id) => !uploaded.find((photo) => photo.id === id))
            next[BUILDING_FEATURE_ID] = filtered
          }

          return next
        })

        const targetFeatureId = options.selectorFeatureId ?? showPhotoSelector ?? BUILDING_FEATURE_ID

        if (!featureCoverPhotos[targetFeatureId]) {
          setFeatureCoverPhotos((prev) => ({
            ...prev,
            [targetFeatureId]: uploaded[0].id,
          }))
        }

        if (options.addToModalSelection) {
          setTempSelectedPhotos((prev) => [...new Set([...prev, ...modalPhotoIds])])
          setTempCoverPhoto((prev) => prev || modalPhotoIds[0] || "")
          const featureId = options.selectorFeatureId ?? showPhotoSelector
          if (featureId) {
            modalPhotoIds.forEach((photoId) => {
              unresolvedAssignmentsRef.current.set(photoId, featureId)
            })
          }
        }
      }

      if (options.addToModalSelection) {
        setModalUploadErrors(errors)
      } else {
        setUploadErrors(errors)
      }

      setIsUploading(false)
    },
    [
      featureCoverPhotos,
      featureIdMap,
      generateUploadId,
      normaliseCoverFlag,
      resolvedProjectId,
      showPhotoSelector,
      supabase,
      uploadedPhotos.length,
      validateFile,
      readImageDimensions,
    ],
  )

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      setDragOver(false)
      const files = event.dataTransfer.files
      void uploadFiles(files)
    },
    [uploadFiles],
  )

  const handleFileUpload = useCallback(
    async (files: FileList | null) => {
      await uploadFiles(files)
    },
    [uploadFiles],
  )

  const handleModalFileUpload = useCallback(
    async (files: FileList | null) => {
      await uploadFiles(files, { addToModalSelection: true, selectorFeatureId: showPhotoSelector })
    },
    [showPhotoSelector, uploadFiles],
  )

  const handleModalDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      setModalDragOver(false)
      const files = event.dataTransfer.files
      void uploadFiles(files, { addToModalSelection: true, selectorFeatureId: showPhotoSelector })
    },
    [showPhotoSelector, uploadFiles],
  )

  const handleModalDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setModalDragOver(true)
  }, [])

  const handleModalDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setModalDragOver(false)
  }, [])

  const photoAssignmentMap = useMemo(() => {
    const map = new Map<string, string>()
    Object.entries(featurePhotos).forEach(([featureId, photoIds]) => {
      photoIds.forEach((photoId) => {
        map.set(photoId, featureId)
      })
    })
    return map
  }, [featurePhotos])

  const getFeatureDisplay = useCallback(
    (featureId: string): FeatureDisplay => {
      if (featureId === BUILDING_FEATURE_ID) {
        return { id: featureId, name: "Building", icon: Home }
      }
      if (featureId === ADDITIONAL_FEATURE_ID) {
        return { id: featureId, name: "Additional photos", icon: Grid3x3 }
      }

      const option = featureOptions.find((item) => item.id === featureId)
      const fallback = FALLBACK_FEATURES.find((item) => item.id === featureId)
      const name = option?.name ?? fallback?.name ?? "Feature"
      const slug = option?.slug ?? fallback?.slug ?? null
      const icon = resolveFeatureIcon(slug)
      return { id: featureId, name, icon }
    },
    [featureOptions],
  )

  const addFeatures = useCallback(
    async (featureIds: string[]): Promise<boolean> => {
      if (!resolvedProjectId || featureIds.length === 0) {
        setSelectedFeatures((prev) => [...new Set([...prev, ...featureIds])])
        setFeaturePhotos((prev) => {
          const next = { ...prev }
          featureIds.forEach((id) => {
            if (!next[id]) {
              next[id] = []
            }
          })
          if (!next[BUILDING_FEATURE_ID]) {
            next[BUILDING_FEATURE_ID] = []
          }
          if (!next[ADDITIONAL_FEATURE_ID]) {
            next[ADDITIONAL_FEATURE_ID] = []
          }
          return next
        })
        return true
      }

      const newFeatureIds = featureIds.filter((id) => !featureIdMap[id])
      if (newFeatureIds.length === 0) {
        setSelectedFeatures((prev) => [...new Set([...prev, ...featureIds])])
        setFeaturePhotos((prev) => {
          const next = { ...prev }
          featureIds.forEach((id) => {
            if (!next[id]) {
              next[id] = []
            }
          })
          return next
        })
        return true
      }

      setIsSavingFeatures(true)
      setFeatureMutationError(null)

      const idMapCopy = { ...featureIdMap }
      const metadataCopy = { ...featureMetadata }

      const nonAdditionalOrders = Object.entries(metadataCopy)
        .filter(([key]) => key !== ADDITIONAL_FEATURE_ID)
        .map(([, meta]) => meta.orderIndex ?? 0)

      const additionalMeta = metadataCopy[ADDITIONAL_FEATURE_ID]
      const startingOrder = nonAdditionalOrders.length ? Math.max(...nonAdditionalOrders) + 1 : 1
      let nextOrder = additionalMeta ? Math.min(startingOrder, additionalMeta.orderIndex ?? startingOrder) : startingOrder

      let success = true

      try {
        for (const featureKey of newFeatureIds) {
          const option = featureOptions.find((item) => item.id === featureKey)
          const fallback = FALLBACK_FEATURES.find((item) => item.id === featureKey)
          const featureName = option?.name ?? fallback?.name ?? "Feature"
          const categoryId = isUuid(featureKey) ? featureKey : null

          const { data, error } = await supabase
            .from("project_features")
            .insert({
              project_id: resolvedProjectId,
              name: featureName,
              category_id: categoryId,
              order_index: nextOrder,
            })
            .select("id, category_id, order_index")
            .single()

          if (error || !data) {
            throw error ?? new Error("Unable to create feature")
          }

          idMapCopy[featureKey] = data.id
          metadataCopy[featureKey] = {
            featureId: data.id,
            orderIndex: data.order_index ?? nextOrder,
            categoryId: data.category_id,
          }
          nextOrder += 1
        }

        if (additionalMeta) {
          const desiredAdditionalOrder = Math.max(nextOrder, additionalMeta.orderIndex ?? nextOrder)
          if (desiredAdditionalOrder !== additionalMeta.orderIndex) {
            const { error: additionalOrderError } = await supabase
              .from("project_features")
              .update({ order_index: desiredAdditionalOrder })
              .eq("id", additionalMeta.featureId)

            if (additionalOrderError) {
              throw additionalOrderError
            }

            metadataCopy[ADDITIONAL_FEATURE_ID] = {
              featureId: additionalMeta.featureId,
              orderIndex: desiredAdditionalOrder,
              categoryId: additionalMeta.categoryId,
            }
          }
        }

        setFeatureIdMap(idMapCopy)
        setFeatureMetadata(metadataCopy)
        setSelectedFeatures((prev) => [...new Set([...prev, ...featureIds])])
        setFeaturePhotos((prev) => {
          const next = { ...prev }
          featureIds.forEach((id) => {
            if (!next[id]) {
              next[id] = []
            }
          })
          if (!next[BUILDING_FEATURE_ID]) {
            next[BUILDING_FEATURE_ID] = []
          }
          if (!next[ADDITIONAL_FEATURE_ID]) {
            next[ADDITIONAL_FEATURE_ID] = []
          }
          return next
        })
      } catch (error) {
        console.error("Failed to add features", error)
        success = false
        setFeatureMutationError(
          error instanceof Error ? error.message : "We couldn't add that feature. Please try again.",
        )
      } finally {
        setIsSavingFeatures(false)
      }

      return success
    },
    [featureIdMap, featureMetadata, featureOptions, resolvedProjectId, supabase],
  )

  const removeFeatureById = useCallback(
    async (featureId: string): Promise<boolean> => {
      if (featureId === BUILDING_FEATURE_ID || featureId === ADDITIONAL_FEATURE_ID) {
        return false
      }

      const dbId = featureIdMap[featureId]
      if (!resolvedProjectId || !dbId) {
        setSelectedFeatures((prev) => prev.filter((id) => id !== featureId))
        return true
      }

      setIsSavingFeatures(true)
      setFeatureMutationError(null)

      const fallbackKey = featureIdMap[ADDITIONAL_FEATURE_ID] ? ADDITIONAL_FEATURE_ID : BUILDING_FEATURE_ID
      const fallbackDbId = featureIdMap[fallbackKey] ?? null
      const photosToMove = featurePhotos[featureId] ?? []

      let success = true

      try {
        if (photosToMove.length) {
          const { error: reassignmentError } = await supabase
            .from("project_photos")
            .update({ feature_id: fallbackDbId })
            .in("id", photosToMove)

          if (reassignmentError) {
            throw reassignmentError
          }
        }

        const { error: deleteError } = await supabase.from("project_features").delete().eq("id", dbId)
        if (deleteError) {
          throw deleteError
        }

        setSelectedFeatures((prev) => prev.filter((id) => id !== featureId))

        setFeaturePhotos((prev) => {
          const next = { ...prev }
          delete next[featureId]
          if (!next[BUILDING_FEATURE_ID]) {
            next[BUILDING_FEATURE_ID] = []
          }
          if (!next[ADDITIONAL_FEATURE_ID]) {
            next[ADDITIONAL_FEATURE_ID] = []
          }
          return next
        })

        setFeatureCoverPhotos((prev) => {
          const next = { ...prev }
          delete next[featureId]
          return next
        })

        const metadataCopy = { ...featureMetadata }
        delete metadataCopy[featureId]
        setFeatureMetadata(metadataCopy)
      } catch (error) {
        console.error("Failed to remove feature", error)
        success = false
        setFeatureMutationError(
          error instanceof Error ? error.message : "We couldn't remove that feature. Please try again.",
        )
      } finally {
        setIsSavingFeatures(false)
      }

      return success
    },
    [featureIdMap, featureMetadata, featurePhotos, resolvedProjectId, supabase],
  )

  const toggleFeature = useCallback(
    (featureId: string) => {
      if (featureId === BUILDING_FEATURE_ID) {
        return
      }

      if (selectedFeatures.includes(featureId)) {
        void removeFeatureById(featureId)
        return
      }

      void addFeatures([featureId])
    },
    [addFeatures, removeFeatureById, selectedFeatures],
  )

  const openPhotoSelector = useCallback((featureId: string) => {
    setShowPhotoSelector(featureId)
    setTempSelectedPhotos(featurePhotos[featureId] ?? [])
    setTempCoverPhoto(featureCoverPhotos[featureId] ?? "")
    setModalUploadErrors([])
  }, [featureCoverPhotos, featurePhotos])

  const cancelPhotoSelection = useCallback(() => {
    setShowPhotoSelector(null)
    setTempSelectedPhotos([])
    setTempCoverPhoto("")
    setModalUploadErrors([])
    setModalDragOver(false)
  }, [])

  const persistPhotoAssignments = useCallback(async () => {
    if (!resolvedProjectId || !showPhotoSelector) {
      return
    }

    const dbFeatureId = featureIdMap[showPhotoSelector]
    const selectedIds = tempSelectedPhotos
    const existingAssignedIds = featurePhotos[showPhotoSelector] ?? []
    const idsToAssign = selectedIds.filter((id) => !existingAssignedIds.includes(id))
    const idsToUnassign = existingAssignedIds.filter((id) => !selectedIds.includes(id))

    const conflictingFeatures = new Set<string>()

    selectedIds.forEach((photoId) => {
      Object.entries(featurePhotos).forEach(([featureKey, photoIds]) => {
        if (
          featureKey === showPhotoSelector ||
          featureKey === BUILDING_FEATURE_ID ||
          featureKey === ADDITIONAL_FEATURE_ID
        ) {
          return
        }

        if (photoIds.includes(photoId)) {
          conflictingFeatures.add(featureKey)
        }
      })
    })

    if (conflictingFeatures.size > 0) {
      const conflictNames = Array.from(conflictingFeatures).map((featureId) => {
        if (featureId === BUILDING_FEATURE_ID) {
          return "Building"
        }
        if (featureId === ADDITIONAL_FEATURE_ID) {
          return "Additional photos"
        }
        const option = featureOptions.find((item) => item.id === featureId)
        const fallback = FALLBACK_FEATURES.find((item) => item.id === featureId)
        return option?.name ?? fallback?.name ?? featureId
      })

      const uniqueNames = conflictNames.filter(Boolean)
      const message = uniqueNames.length
        ? `Some photos are already assigned to: ${uniqueNames.join(", ")}. Remove them from those categories first.`
        : "Some photos are already assigned to another category. Remove them from that category first."

      setModalUploadErrors([message])
      return
    }

    const fallbackKey = featureIdMap[ADDITIONAL_FEATURE_ID] ? ADDITIONAL_FEATURE_ID : BUILDING_FEATURE_ID
    const fallbackDbId = featureIdMap[fallbackKey] ?? null

    setIsSavingSelection(true)

    try {
      if (dbFeatureId && fallbackDbId && idsToUnassign.length) {
        const { error: clearError } = await supabase.rpc("assign_photos_to_feature", {
          p_project_id: resolvedProjectId,
          p_feature_id: fallbackDbId,
          p_photo_ids: idsToUnassign,
        })

        if (clearError) {
          throw clearError
        }
      }

      if (dbFeatureId && idsToAssign.length) {
        const { error: assignError } = await supabase.rpc("assign_photos_to_feature", {
          p_project_id: resolvedProjectId,
          p_feature_id: dbFeatureId,
          p_photo_ids: idsToAssign,
        })

        if (assignError) {
          throw assignError
        }
      }

      const coverId = tempCoverPhoto || selectedIds[0] || null
      if (dbFeatureId) {
        const { error: coverError } = await supabase
          .from("project_features")
          .update({ cover_photo_id: coverId })
          .eq("id", dbFeatureId)

        if (coverError) {
          throw coverError
        }
      }

      setFeaturePhotos((prev) => {
        const next = { ...prev }
        next[showPhotoSelector] = selectedIds

        if (fallbackDbId && fallbackKey) {
          const fallbackList = new Set(next[fallbackKey] ?? [])
          idsToAssign.forEach((id) => fallbackList.delete(id))
          idsToUnassign.forEach((id) => fallbackList.add(id))
          next[fallbackKey] = Array.from(fallbackList)
        }

        if (!next[BUILDING_FEATURE_ID]) {
          next[BUILDING_FEATURE_ID] = []
        }
        if (!next[ADDITIONAL_FEATURE_ID]) {
          next[ADDITIONAL_FEATURE_ID] = []
        }

        return next
      })

      if (coverId) {
        setFeatureCoverPhotos((prev) => ({
          ...prev,
          [showPhotoSelector]: coverId,
        }))
      } else {
        setFeatureCoverPhotos((prev) => {
          const next = { ...prev }
          delete next[showPhotoSelector]
          return next
        })
      }

      cancelPhotoSelection()
    } catch (error) {
      console.error("Failed to update feature photos", error)
      setModalUploadErrors([
        error instanceof Error ? error.message : "We couldn't update the selected photos. Please try again.",
      ])
    } finally {
      setIsSavingSelection(false)
    }
  }, [
    cancelPhotoSelection,
    featureIdMap,
    featureOptions,
    featurePhotos,
    resolvedProjectId,
    showPhotoSelector,
    supabase,
    tempCoverPhoto,
    tempSelectedPhotos,
  ])

  const saveSelectedPhotos = useCallback(async () => {
    await persistPhotoAssignments()
  }, [persistPhotoAssignments])

  const toggleTempPhoto = useCallback((photoId: string) => {
    setTempSelectedPhotos((prev) => {
      const exists = prev.includes(photoId)
      if (exists) {
        const filtered = prev.filter((id) => id !== photoId)
        if (tempCoverPhoto === photoId) {
          setTempCoverPhoto(filtered[0] ?? "")
        }
        return filtered
      }
      return [...prev, photoId]
    })
  }, [tempCoverPhoto])

  const toggleTempFeature = useCallback((featureId: string) => {
    setTempSelectedFeatures((prev) =>
      prev.includes(featureId) ? prev.filter((id) => id !== featureId) : [...prev, featureId],
    )
  }, [])

  const saveNewFeatures = useCallback(async () => {
    if (tempSelectedFeatures.length === 0) {
      setShowAddFeatureModal(false)
      return
    }

    const success = await addFeatures(tempSelectedFeatures)
    if (success) {
      setTempSelectedFeatures([])
      setShowAddFeatureModal(false)
    }
  }, [addFeatures, tempSelectedFeatures])

  const deleteFeature = useCallback(
    async (featureId: string) => {
      const success = await removeFeatureById(featureId)
      if (success) {
        cancelPhotoSelection()
      }
    },
    [cancelPhotoSelection, removeFeatureById],
  )

  const displayFeatureIds = useMemo(() => {
    const uniqueUserFeatures = Array.from(new Set(selectedFeatures.filter((id) => id !== BUILDING_FEATURE_ID)))
    return [BUILDING_FEATURE_ID, ...uniqueUserFeatures, ADDITIONAL_FEATURE_ID]
  }, [selectedFeatures])

  const orderedFeatureOptions = useMemo(() => {
    return [...featureOptions].sort((a, b) => {
      const orderDiff = (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
      return orderDiff !== 0 ? orderDiff : a.name.localeCompare(b.name)
    })
  }, [featureOptions])

  const getFeaturePhotoCount = useCallback(
    (featureId: string) => {
      return featurePhotos[featureId]?.length || 0
    },
    [featurePhotos],
  )

  const getFeatureCoverPhoto = useCallback(
    (featureId: string) => {
      const coverPhotoId = featureCoverPhotos[featureId]
      if (coverPhotoId) {
        const photo = uploadedPhotos.find((p) => p.id === coverPhotoId)
        return photo?.url || null
      }

      const photoIds = featurePhotos[featureId]
      if (!photoIds || photoIds.length === 0) return null
      const photo = uploadedPhotos.find((p) => p.id === photoIds[0])
      return photo?.url || null
    },
    [featureCoverPhotos, featurePhotos, uploadedPhotos],
  )

  const persistPhotoOrder = useCallback(
    async (nextPhotos: UploadedPhoto[], previousPhotos: UploadedPhoto[]) => {
      if (!resolvedProjectId) {
        return
      }

      const updates = nextPhotos.map((photo, index) => ({
        id: photo.id,
        order_index: index,
        project_id: resolvedProjectId,
      }))

      const { error } = await supabase.from("project_photos").upsert(updates, { onConflict: "id" })
      if (error) {
        console.error("Failed to persist photo order", error)
        if (nextPhotos.length === previousPhotos.length) {
          setUploadedPhotos(previousPhotos)
        }
      }
    },
    [resolvedProjectId, supabase],
  )

  const reorderPhotos = useCallback(
    (sourceId: string, targetId: string) => {
      const sourceIndex = uploadedPhotos.findIndex((photo) => photo.id === sourceId)
      const targetIndex = uploadedPhotos.findIndex((photo) => photo.id === targetId)

      if (sourceIndex === -1 || targetIndex === -1) {
        return
      }

      const ordered = [...uploadedPhotos]
      const [moved] = ordered.splice(sourceIndex, 1)
      ordered.splice(targetIndex, 0, moved)

      setUploadedPhotos(ordered)
      void persistPhotoOrder(ordered, uploadedPhotos)
    },
    [persistPhotoOrder, uploadedPhotos],
  )

  const handlePhotoDragStart = useCallback((event: React.DragEvent<HTMLDivElement>, photoId: string) => {
    draggedPhotoIdRef.current = photoId
    event.dataTransfer.effectAllowed = "move"
  }, [])

  const handlePhotoDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }, [])

  const handlePhotoDropOnCard = useCallback(
    (event: React.DragEvent<HTMLDivElement>, targetId: string) => {
      event.preventDefault()
      const sourceId = draggedPhotoIdRef.current
      if (sourceId) {
        reorderPhotos(sourceId, targetId)
      }
      draggedPhotoIdRef.current = null
    },
    [reorderPhotos],
  )

  const handlePhotoDragEnd = useCallback(() => {
    draggedPhotoIdRef.current = null
  }, [])

  const setCoverPhoto = useCallback(
    (id: string) => {
      void (async () => {
        if (!resolvedProjectId) {
          return
        }

        const previous = uploadedPhotos
        setUploadedPhotos((prev) =>
          normaliseCoverFlag(
            prev.map((photo) => ({
              ...photo,
              isCover: photo.id === id,
            })),
          ),
        )
        setOpenMenuId(null)

        const { error } = await supabase.from("project_photos").update({ is_primary: true }).eq("id", id)

        if (error) {
          console.error("Failed to update cover photo", error)
          setUploadErrors((prev) => [...prev, "We couldn't update the cover photo. Please try again."])
          setUploadedPhotos(previous)
        }
      })()
    },
    [normaliseCoverFlag, resolvedProjectId, supabase, uploadedPhotos],
  )

  const deletePhoto = useCallback(
    (id: string) => {
      void (async () => {
        if (!resolvedProjectId) {
          return
        }

        const photoToRemove = uploadedPhotos.find((photo) => photo.id === id)
        if (!photoToRemove) {
          return
        }

        const previousPhotos = uploadedPhotos
        const previousFeaturePhotos = featurePhotos
        const previousFeatureCovers = featureCoverPhotos

        const featuresWithCoverUpdates = Object.entries(featureCoverPhotos).reduce<
          Array<{ featureKey: string; dbId: string | null; nextCoverId: string | null }>
        >((acc, [featureKey, photoId]) => {
          if (photoId === id) {
            const remaining = (featurePhotos[featureKey] ?? []).filter((photoId) => photoId !== id)
            acc.push({
              featureKey,
              dbId: featureIdMap[featureKey] ?? null,
              nextCoverId: remaining[0] ?? null,
            })
          }
          return acc
        }, [])

        const nextPhotos = normaliseCoverFlag(previousPhotos.filter((photo) => photo.id !== id))

        setUploadedPhotos(nextPhotos)

        setFeaturePhotos((prev) => {
          const next: Record<string, string[]> = {}
          Object.entries(prev).forEach(([featureId, photoIds]) => {
            const filtered = photoIds.filter((photoId) => photoId !== id)
            if (featureId === BUILDING_FEATURE_ID || featureId === ADDITIONAL_FEATURE_ID) {
              next[featureId] = filtered
            } else if (filtered.length > 0) {
              next[featureId] = filtered
            }
          })
          if (!next[BUILDING_FEATURE_ID]) {
            next[BUILDING_FEATURE_ID] = []
          }
          if (!next[ADDITIONAL_FEATURE_ID]) {
            next[ADDITIONAL_FEATURE_ID] = []
          }
          return next
        })

        setFeatureCoverPhotos((prev) => {
          const next = { ...prev }
          featuresWithCoverUpdates.forEach(({ featureKey, nextCoverId }) => {
            if (nextCoverId) {
              next[featureKey] = nextCoverId
            } else {
              delete next[featureKey]
            }
          })
          return next
        })

        setOpenMenuId(null)
        setTempSelectedPhotos((prev) => prev.filter((photoId) => photoId !== id))
        setTempCoverPhoto((prev) => (prev === id ? "" : prev))

        const coverUpdateResults = await Promise.all(
          featuresWithCoverUpdates
            .filter(({ dbId }) => Boolean(dbId))
            .map(async ({ dbId, nextCoverId }) => {
              const { error: coverUpdateError } = await supabase
                .from("project_features")
                .update({ cover_photo_id: nextCoverId })
                .eq("id", dbId)
              return coverUpdateError
            }),
        )

        const coverUpdateError = coverUpdateResults.find((result) => result)
        if (coverUpdateError) {
          console.error("Failed to update feature cover photo", coverUpdateError)
          setUploadErrors((prev) => [...prev, "We couldn't delete that photo. Please try again."])
          setUploadedPhotos(previousPhotos)
          setFeaturePhotos(previousFeaturePhotos)
          setFeatureCoverPhotos(previousFeatureCovers)
          return
        }

        const { error } = await supabase.from("project_photos").delete().eq("id", id)
        if (error) {
          console.error("Failed to delete photo", error)
          setUploadErrors((prev) => [...prev, "We couldn't delete that photo. Please try again."])
          setUploadedPhotos(previousPhotos)
          setFeaturePhotos(previousFeaturePhotos)
          setFeatureCoverPhotos(previousFeatureCovers)
          return
        }

        if (photoToRemove.storagePath) {
          const { error: storageError } = await supabase.storage
            .from("project-photos")
            .remove([photoToRemove.storagePath])
          if (storageError) {
            console.warn("Failed to remove photo from storage", storageError)
          }
        }

        void persistPhotoOrder(nextPhotos, previousPhotos)
      })()
    },
    [
      featureCoverPhotos,
      featureIdMap,
      featurePhotos,
      normaliseCoverFlag,
      persistPhotoOrder,
      resolvedProjectId,
      setTempCoverPhoto,
      setTempSelectedPhotos,
      supabase,
      uploadedPhotos,
    ],
  )

  const appendUploadError = useCallback((message: string) => {
    setUploadErrors((prev) => (prev.includes(message) ? prev : [...prev, message]))
  }, [])

  const resetUploadErrors = useCallback(() => {
    setUploadErrors([])
  }, [])

  const resetModalUploadErrors = useCallback(() => {
    setModalUploadErrors([])
  }, [])

  const getSelectablePhotos = useCallback(
    (featureId: string | null) => {
      if (!featureId) {
        return uploadedPhotos
      }

      return uploadedPhotos.filter((photo) => {
        const assignedFeature = photoAssignmentMap.get(photo.id)
        return !assignedFeature || assignedFeature === featureId
      })
    },
    [photoAssignmentMap, uploadedPhotos],
  )

  return {
    projectId: resolvedProjectId,
    uploadedPhotos,
    featureOptions,
    orderedFeatureOptions,
    selectedFeatures,
    featurePhotos,
    featureCoverPhotos,
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
    setTempCoverPhoto,
    setTempSelectedPhotos,
    isUploading,
    isLoadingFeatures,
    isLoadingProject,
    isSavingFeatures,
    isSavingSelection,
    uploadErrors,
    modalUploadErrors,
    setUploadErrors,
    setModalUploadErrors,
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
    appendUploadError,
    resetUploadErrors,
    resetModalUploadErrors,
  }
}
