"use client"

import type React from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { useEffect, useMemo, useRef, useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Bed,
  Bath,
  Car,
  Grid3x3,
  Home,
  ImageIcon,
  Layers,
  MoreHorizontal,
  Sofa,
  Trash2,
  TreePine,
  Utensils,
  Waves,
} from "lucide-react"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import type { Tables } from "@/lib/supabase/types"

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

type FeatureCategoryRecord = Tables<"categories"> & {
  project_category_attributes: Tables<"project_category_attributes"> | null
}

type FeatureOption = {
  id: string
  name: string
  slug?: string | null
  iconKey?: string | null
  sortOrder?: number | null
}

type UploadedPhoto = {
  id: string
  url: string
  isCover: boolean
  storagePath: string | null
}

type ProjectFeatureRow = Tables<"project_features">
type ProjectPhotoRow = Tables<"project_photos">

const isUuid = (value?: string | null): value is string =>
  !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

const MIN_PHOTOS_REQUIRED = 5
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
const MIN_IMAGE_WIDTH = 1200
const BUILDING_FEATURE_ID = "building-default"
const ADDITIONAL_FEATURE_ID = "additional-photos"
const OVERLAY_CLASSES = "modal-overlay fixed inset-0 flex items-center justify-center z-50 p-4"

// Security: Allowlist of safe image extensions
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png"])
const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
}

const FEATURE_ICON_MAP: Record<string, LucideIcon> = {
  attic: Home,
  balcony: Home,
  basement: Layers,
  bathroom: Bath,
  bedroom: Bed,
  dining_room: Utensils,
  garage: Car,
  garden: TreePine,
  kitchen: Utensils,
  living_room: Sofa,
  office: Home,
  pool: Waves,
  terrace: Layers,
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

const resolveFeatureIcon = (slug?: string | null) => {
  if (!slug) {
    return Grid3x3
  }

  const key = slug.replace(/-/g, "_")
  return FEATURE_ICON_MAP[key] ?? Grid3x3
}

export default function PhotoTourPage() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), [])
  const searchParams = useSearchParams()
  const projectIdFromParams = searchParams.get("projectId")
  const [currentStep, setCurrentStep] = useState(1)
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([])
  const [dragOver, setDragOver] = useState(false)
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
  const [modalDragOver, setModalDragOver] = useState(false)
  const [featureOptions, setFeatureOptions] = useState<FeatureOption[]>(FALLBACK_FEATURES)
  const [isLoadingFeatures, setIsLoadingFeatures] = useState(false)
  const [featureError, setFeatureError] = useState<string | null>(null)
  const [uploadErrors, setUploadErrors] = useState<string[]>([])
  const [modalUploadErrors, setModalUploadErrors] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [isLoadingProject, setIsLoadingProject] = useState(false)
  const [projectLoadError, setProjectLoadError] = useState<string | null>(null)
  const [featureIdMap, setFeatureIdMap] = useState<Record<string, string>>({})
  const [featureMetadata, setFeatureMetadata] = useState<
    Record<string, { featureId: string; orderIndex: number; categoryId: string | null }>
  >({})
  const [isSavingFeatures, setIsSavingFeatures] = useState(false)
  const [isSavingSelection, setIsSavingSelection] = useState(false)
  const [featureMutationError, setFeatureMutationError] = useState<string | null>(null)
  const router = useRouter()
  const draggedPhotoIdRef = useRef<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadProjectContext = async () => {
      if (!projectIdFromParams) {
        router.replace("/new-project/details")
        return
      }

      setIsLoadingProject(true)
      setProjectLoadError(null)

      if (isMounted) {
        setProjectId(projectIdFromParams)
      }

      const { data: authData, error: authError } = await supabase.auth.getUser()

      if (authError || !authData?.user) {
        if (isMounted) {
          setProjectLoadError("You need to be signed in to continue.")
          setIsLoadingProject(false)
        }
        router.replace("/new-project/details")
        return
      }

      try {
        const [featureResponse, photoResponse] = await Promise.all([
          supabase
            .from("project_features")
            .select("id, name, category_id, cover_photo_id, is_building_default, order_index")
            .eq("project_id", projectIdFromParams)
            .order("order_index", { ascending: true, nullsFirst: false }),
          supabase
            .from("project_photos")
            .select("id, url, is_primary, order_index, feature_id, storage_path")
            .eq("project_id", projectIdFromParams)
            .order("order_index", { ascending: true, nullsFirst: false }),
        ])

        if (featureResponse.error) {
          throw featureResponse.error
        }
        if (photoResponse.error) {
          throw photoResponse.error
        }

        let featureRows: ProjectFeatureRow[] = featureResponse.data ?? []

        // Ensure Building feature exists
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
              project_id: projectIdFromParams,
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

        // Ensure Additional photos feature exists
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
              project_id: projectIdFromParams,
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

          // Fallback for custom features without category mapping
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

        if (isMounted) {
          setProjectId(projectIdFromParams)
          setFeatureIdMap(idMap)
          setFeatureMetadata(metadata)
          setSelectedFeatures([BUILDING_FEATURE_ID, ...Array.from(taxonomySelection)])
          setUploadedPhotos(normaliseCoverFlag(nextUploadedPhotos))
          setFeaturePhotos(nextFeaturePhotos)
          setFeatureCoverPhotos(nextFeatureCoverPhotos)
        }
      } catch (error) {
        console.error("Failed to load project context", error)
        if (isMounted) {
          setProjectLoadError(
            error instanceof Error ? error.message : "We couldn't load your project photos. Please try again.",
          )
        }
      } finally {
        if (isMounted) {
          setIsLoadingProject(false)
        }
      }
    }

    void loadProjectContext()

    return () => {
      isMounted = false
    }
  }, [projectIdFromParams, router, supabase])

  useEffect(() => {
    let isMounted = true

    const loadFeatureOptions = async () => {
      setIsLoadingFeatures(true)
      setFeatureError(null)

      const { data, error } = await supabase
        .from("categories")
        .select(
          "id,name,slug,sort_order,project_category_attributes(is_building_feature)"
        )
        .eq("is_active", true)
        .eq("project_category_attributes.is_building_feature", true)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true })

      if (!isMounted) {
        return
      }

      if (error) {
        setFeatureError("We could not load features from Supabase. Using fallback list for now.")
        setFeatureOptions(FALLBACK_FEATURES)
        setIsLoadingFeatures(false)
        return
      }

      const records = (data ?? []) as FeatureCategoryRecord[]
      const filtered = records.filter(
        (record) => record.project_category_attributes?.is_building_feature,
      )

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
          const orderDiff = (a.sortOrder ?? Number.MAX_SAFE_INTEGER) -
            (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
          return orderDiff !== 0 ? orderDiff : a.name.localeCompare(b.name)
        })

      setFeatureOptions(mapped)
      setIsLoadingFeatures(false)
    }

    void loadFeatureOptions()

    return () => {
      isMounted = false
    }
  }, [supabase])

  const normaliseCoverFlag = (photos: UploadedPhoto[]) => {
    if (photos.length === 0) {
      return photos
    }

    const existingCover = photos.find((photo) => photo.isCover)
    const coverId = existingCover?.id ?? photos[0].id

    return photos.map((photo) => ({
      ...photo,
      isCover: photo.id === coverId,
    }))
  }

  const generateUploadId = (): string => {
    // Primary: Use crypto.randomUUID() (secure, standard)
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID()
    }

    // Secondary: Use crypto.getRandomValues() (secure fallback)
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      // RFC 4122 v4 UUID with cryptographically secure random values
      const bytes = new Uint8Array(16)
      crypto.getRandomValues(bytes)

      // Set version (4) and variant bits
      bytes[6] = (bytes[6] & 0x0f) | 0x40 // Version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80 // Variant 10

      // Convert to UUID string format
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    }

    // Tertiary: Fail gracefully with error
    throw new Error(
      "Secure UUID generation not available. Please use a modern browser (Chrome 92+, Firefox 95+, Safari 15.4+, Edge 92+).",
    )
  }

  const readFileAsDataURL = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result)
        } else {
          reject(new Error("Unable to read file"))
        }
      }
      reader.onerror = () => reject(new Error("Unable to read file"))
      reader.readAsDataURL(file)
    })

  const getImageDimensions = (dataUrl: string): Promise<{ width: number; height: number }> =>
    new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve({ width: img.width, height: img.height })
      img.onerror = () => reject(new Error("Unable to read image dimensions"))
      img.src = dataUrl
    })

  const processFiles = async (
    files: FileList | File[],
    options: { addToModalSelection?: boolean } = {},
  ) => {
    const fileArray = Array.from(files ?? [])
    if (fileArray.length === 0) {
      return
    }

    if (!projectId) {
      const message = "We couldn't determine which project to update. Please reload the page."
      if (options.addToModalSelection) {
        setModalUploadErrors([message])
      } else {
        setUploadErrors([message])
      }
      return
    }

    if (projectLoadError) {
      const message = "Please resolve the project loading issue before uploading new photos."
      if (options.addToModalSelection) {
        setModalUploadErrors([message])
      } else {
        appendUploadError(message)
      }
      return
    }

    if (isUploading) {
      const message = "Please wait for the current uploads to finish."
      if (options.addToModalSelection) {
        setModalUploadErrors([message])
      } else {
        appendUploadError(message)
      }
      return
    }

    const allowedMimeTypes = new Set(["image/jpeg", "image/png"]) // Enforce JPG/PNG only
    const errors: string[] = []
    const uploaded: UploadedPhoto[] = []
    const modalPhotoIds: string[] = []
    const buildingFeatureId = featureIdMap[BUILDING_FEATURE_ID] ?? null
    const currentCount = uploadedPhotos.length

    setIsUploading(true)

    for (const [index, file] of fileArray.entries()) {
      if (!allowedMimeTypes.has(file.type)) {
        errors.push(`${file.name}: Only JPG and PNG files are supported.`)
        continue
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        errors.push(`${file.name}: File exceeds the 10 MB limit.`)
        continue
      }

      try {
        const dataUrl = await readFileAsDataURL(file)
        const { width, height } = await getImageDimensions(dataUrl)
        if (width < MIN_IMAGE_WIDTH) {
          errors.push(`${file.name}: Image must be at least ${MIN_IMAGE_WIDTH}px wide.`)
          continue
        }

        // Security: Validate extension against allowlist and use MIME type as source of truth
        const fileExtension = file.name.split(".").pop()?.toLowerCase() ?? ""
        const extension = ALLOWED_EXTENSIONS.has(fileExtension)
          ? fileExtension
          : MIME_TO_EXTENSION[file.type] ?? "jpg"

        const photoId = generateUploadId()
        const storagePath = `${projectId}/${photoId}.${extension}`

        const { error: uploadError } = await supabase.storage
          .from("project-photos")
          .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type,
            metadata: {
              project_id: projectId,
            },
          })

        if (uploadError) {
          errors.push(`${file.name}: ${uploadError.message}`)
          continue
        }

        const { data: publicUrlData } = supabase.storage.from("project-photos").getPublicUrl(storagePath)
        const publicUrl = publicUrlData.publicUrl

        const orderIndex = currentCount + uploaded.length
        const shouldBePrimary = !uploadedPhotos.some((photo) => photo.isCover) && uploaded.length === 0

        const { data: insertedPhoto, error: insertError } = await supabase
          .from("project_photos")
          .insert({
            id: photoId,
            project_id: projectId,
            url: publicUrl,
            storage_path: storagePath,
            order_index: orderIndex,
            feature_id: buildingFeatureId,
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
        const buildingPhotos = next[BUILDING_FEATURE_ID] ? [...next[BUILDING_FEATURE_ID]] : []
        buildingPhotos.push(...uploaded.map((photo) => photo.id))
        next[BUILDING_FEATURE_ID] = buildingPhotos
        return next
      })

      if (!featureCoverPhotos[BUILDING_FEATURE_ID]) {
        setFeatureCoverPhotos((prev) => ({
          ...prev,
          [BUILDING_FEATURE_ID]: uploaded[0].id,
        }))
      }

      if (options.addToModalSelection) {
        setTempSelectedPhotos((prev) => [...new Set([...prev, ...modalPhotoIds])])
        setTempCoverPhoto((prev) => (prev || modalPhotoIds[0] || ""))
      }
    }

    if (options.addToModalSelection) {
      setModalUploadErrors(errors)
    } else {
      setUploadErrors(errors)
    }

    setIsUploading(false)
  }

  const appendUploadError = (message: string) => {
    setUploadErrors((prev) => (prev.includes(message) ? prev : [...prev, message]))
  }

  const addFeatures = async (featureIds: string[]): Promise<boolean> => {
    if (!projectId || featureIds.length === 0) {
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
            project_id: projectId,
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
  }

  const removeFeatureById = async (featureId: string): Promise<boolean> => {
    if (featureId === BUILDING_FEATURE_ID || featureId === ADDITIONAL_FEATURE_ID) {
      return false
    }

    const dbId = featureIdMap[featureId]
    if (!projectId || !dbId) {
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

        if (fallbackKey) {
          const existing = new Set(next[fallbackKey] ?? [])
          photosToMove.forEach((photoId) => existing.add(photoId))
          next[fallbackKey] = Array.from(existing)
        }

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
        if (fallbackKey && photosToMove.length && !next[fallbackKey]) {
          next[fallbackKey] = photosToMove[0]
        }
        return next
      })

      setFeatureIdMap((prev) => {
        const next = { ...prev }
        delete next[featureId]
        return next
      })

      setFeatureMetadata((prev) => {
        const next = { ...prev }
        delete next[featureId]
        return next
      })
    } catch (error) {
      console.error("Failed to remove feature", error)
      setFeatureMutationError(
        error instanceof Error ? error.message : "We couldn't remove that feature. Please try again.",
      )
      success = false
    } finally {
      setIsSavingFeatures(false)
    }

    return success
  }

  const persistPhotoOrder = async (ordered: UploadedPhoto[], previous: UploadedPhoto[]) => {
    if (!projectId) {
      return
    }

    const updates = ordered.map((photo, index) => ({ id: photo.id, order_index: index }))
    const results = await Promise.all(
      updates.map((update) => supabase.from("project_photos").update({ order_index: update.order_index }).eq("id", update.id)),
    )

    const failure = results.find((result) => result.error)

    if (failure?.error) {
      console.error("Failed to update photo order", failure.error)
      appendUploadError("We couldn't reorder your photos. Please try again.")
      setUploadedPhotos(previous)
    }
  }

  const reorderPhotos = (sourceId: string, targetId: string) => {
    setUploadedPhotos((prev) => {
      if (sourceId === targetId) {
        return prev
      }

      const sourceIndex = prev.findIndex((photo) => photo.id === sourceId)
      const targetIndex = prev.findIndex((photo) => photo.id === targetId)
      if (sourceIndex === -1 || targetIndex === -1) {
        return prev
      }

      const previous = [...prev]
      const reordered = [...prev]
      const [moved] = reordered.splice(sourceIndex, 1)
      reordered.splice(targetIndex, 0, moved)
      const normalized = normaliseCoverFlag(reordered)
      void persistPhotoOrder(normalized, previous)
      return normalized
    })
  }

  const getFeatureDisplay = (featureId: string) => {
    if (featureId === BUILDING_FEATURE_ID) {
      return { id: featureId, name: "Building", icon: Home }
    }

    if (featureId === ADDITIONAL_FEATURE_ID) {
      return { id: featureId, name: "Additional photos", icon: Grid3x3 }
    }

    const feature = featureOptions.find((item) => item.id === featureId)
    if (feature) {
      return {
        id: feature.id,
        name: feature.name,
        icon: resolveFeatureIcon(feature.slug),
      }
    }

    const fallback = FALLBACK_FEATURES.find((item) => item.id === featureId)
    if (fallback) {
      return {
        id: fallback.id,
        name: fallback.name,
        icon: resolveFeatureIcon(fallback.slug),
      }
    }

    return { id: featureId, name: "Feature", icon: Grid3x3 }
  }

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) {
      return
    }

    await processFiles(files)
  }

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(false)
    await processFiles(event.dataTransfer.files)
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(false)
  }

  const handlePhotoDragStart = (event: React.DragEvent<HTMLDivElement>, photoId: string) => {
    draggedPhotoIdRef.current = photoId
    event.dataTransfer.effectAllowed = "move"
  }

  const handlePhotoDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }

  const handlePhotoDropOnCard = (event: React.DragEvent<HTMLDivElement>, targetId: string) => {
    event.preventDefault()
    const sourceId = draggedPhotoIdRef.current
    if (sourceId) {
      reorderPhotos(sourceId, targetId)
    }
    draggedPhotoIdRef.current = null
  }

  const handlePhotoDragEnd = () => {
    draggedPhotoIdRef.current = null
  }

  const handleNext = () => {
    if (isBusy) {
      return
    }

    if (currentStep < 4) {
      setCurrentStep(currentStep + 1)
    } else if (currentStep === 4) {
      const nextUrl = projectId
        ? `/new-project/professionals?projectId=${projectId}`
        : "/new-project/professionals"
      router.push(nextUrl)
    }
  }

  const handleBack = () => {
    if (isBusy) {
      return
    }

    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const setCoverPhoto = (id: string) => {
    void updateCoverPhoto(id)
  }

  const updateCoverPhoto = async (id: string) => {
    if (!projectId) {
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
      appendUploadError("We couldn't update the cover photo. Please try again.")
      setUploadedPhotos(previous)
    }
  }

  const deletePhoto = (id: string) => {
    void handleDeletePhoto(id)
  }

  const handleDeletePhoto = async (id: string) => {
    if (!projectId) {
      return
    }

    const photoToRemove = uploadedPhotos.find((photo) => photo.id === id)
    if (!photoToRemove) {
      return
    }

    const previousPhotos = uploadedPhotos
    const previousFeaturePhotos = featurePhotos
    const previousFeatureCovers = featureCoverPhotos
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
      Object.entries(next).forEach(([featureId, photoId]) => {
        if (photoId === id) {
          delete next[featureId]
        }
      })
      return next
    })

    setOpenMenuId(null)

    const { error } = await supabase.from("project_photos").delete().eq("id", id)
    if (error) {
      console.error("Failed to delete photo", error)
      appendUploadError("We couldn't delete that photo. Please try again.")
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
  }

  const toggleFeature = (featureId: string) => {
    if (featureId === BUILDING_FEATURE_ID) {
      return
    }

    if (selectedFeatures.includes(featureId)) {
      void removeFeatureById(featureId)
      return
    }

    void addFeatures([featureId])
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

  const orderedFeatureOptions = useMemo(() => {
    return [...featureOptions].sort((a, b) => {
      const orderDiff = (a.sortOrder ?? Number.MAX_SAFE_INTEGER) -
        (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
      return orderDiff !== 0 ? orderDiff : a.name.localeCompare(b.name)
    })
  }, [featureOptions])

  const renderStep3 = () => {
    const userSelectedFeatureIds = selectedFeatures.filter((id) => id !== BUILDING_FEATURE_ID)

    return (
      <div className="text-left">
        <h1 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">Tell us what your project has to offer</h1>

        <p className="text-gray-500 text-base mb-6">
          Building and Additional photos groups are included automatically. Select the spaces that best describe your
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {orderedFeatureOptions.map((feature) => {
              const IconComponent = resolveFeatureIcon(feature.slug)
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

  const displayFeatureIds = useMemo(() => {
    const uniqueUserFeatures = Array.from(
      new Set(selectedFeatures.filter((id) => id !== BUILDING_FEATURE_ID)),
    )
    return [BUILDING_FEATURE_ID, ...uniqueUserFeatures, ADDITIONAL_FEATURE_ID]
  }, [selectedFeatures])

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
                    setTempSelectedFeatures([])
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
                  const IconComponent = resolveFeatureIcon(feature.slug)
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
                    setTempSelectedFeatures([])
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

      {/* Photo Selector Modal */}
      {showPhotoSelector && (
        <div className={OVERLAY_CLASSES}>
          <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Select photos for {showPhotoSelector ? getFeatureDisplay(showPhotoSelector).name : "feature"}
                </h2>
                <div className="flex items-center gap-3">
                  {showPhotoSelector &&
                    ![BUILDING_FEATURE_ID, ADDITIONAL_FEATURE_ID].includes(showPhotoSelector) && (
                      <button
                        onClick={() => deleteFeature(showPhotoSelector)}
                        className="text-red-600 hover:text-red-700 font-medium transition-colors flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete feature
                      </button>
                    )}
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
                      accept="image/jpeg,image/png"
                      className="hidden"
                      disabled={isUploading}
                      onChange={(event) => {
                        void handleModalFileUpload(event.target.files)
                        event.target.value = ""
                      }}
                    />
                    <span
                      className={`bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        isUploading ? "opacity-60 cursor-not-allowed" : "hover:bg-gray-800 cursor-pointer"
                      }`}
                    >
                      {isUploading ? "Uploading…" : "Browse Files"}
                    </span>
                  </label>
                  {modalUploadErrors.length > 0 && (
                    <ul className="mt-4 text-left text-sm text-red-600 space-y-1">
                      {modalUploadErrors.map((error, index) => (
                        <li key={`${error}-${index}`}>{error}</li>
                      ))}
                    </ul>
                  )}
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
                  onClick={() => void saveSelectedPhotos()}
                  disabled={tempSelectedPhotos.length === 0 || isSavingSelection}
                  className="flex-1 bg-gray-900 text-white py-3 px-6 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingSelection
                    ? "Saving..."
                    : `Save Selection (${tempSelectedPhotos.length})`}
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

  const saveNewFeatures = async () => {
    if (tempSelectedFeatures.length === 0) {
      setShowAddFeatureModal(false)
      return
    }

    const success = await addFeatures(tempSelectedFeatures)
    if (success) {
      setShowAddFeatureModal(false)
      setTempSelectedFeatures([])
    }
  }

  const handleModalFileUpload = async (files: FileList | null) => {
    if (!files) {
      return
    }

    await processFiles(files, { addToModalSelection: true })
  }

  const handleModalDrop = async (event: React.DragEvent) => {
    event.preventDefault()
    setModalDragOver(false)
    await processFiles(event.dataTransfer.files, { addToModalSelection: true })
  }

  const handleModalDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    setModalDragOver(true)
  }

  const handleModalDragLeave = (event: React.DragEvent) => {
    event.preventDefault()
    setModalDragOver(false)
  }

  const togglePhotoSelection = (photoId: string) => {
    setTempSelectedPhotos((prev) => {
      if (prev.includes(photoId)) {
        const next = prev.filter((id) => id !== photoId)
        setTempCoverPhoto((currentCover) => (currentCover === photoId ? next[0] ?? "" : currentCover))
        return next
      }

      return [...prev, photoId]
    })
  }

  const openPhotoSelector = (featureId: string) => {
    setShowPhotoSelector(featureId)
    const photoIds = featurePhotos[featureId] || []
    setTempSelectedPhotos(photoIds)
    const coverCandidate = featureCoverPhotos[featureId] || photoIds[0] || ""
    setTempCoverPhoto(coverCandidate)
  }

  const saveSelectedPhotos = async () => {
    if (!showPhotoSelector || !projectId) {
      return
    }

    const featureKey = showPhotoSelector
    const featureDbId = featureIdMap[featureKey]

    if (!featureDbId) {
      setModalUploadErrors(["We couldn't save these photos because the feature is missing."])
      return
    }

    const fallbackKey = featureIdMap[ADDITIONAL_FEATURE_ID] ? ADDITIONAL_FEATURE_ID : BUILDING_FEATURE_ID
    const fallbackDbId = featureIdMap[fallbackKey] ?? null

    const previousPhotos = featurePhotos[featureKey] ?? []
    const removed = previousPhotos.filter((id) => !tempSelectedPhotos.includes(id))
    const added = tempSelectedPhotos
    const nextCoverCandidate = tempCoverPhoto && tempSelectedPhotos.includes(tempCoverPhoto)
      ? tempCoverPhoto
      : tempSelectedPhotos[0] ?? null

    setIsSavingSelection(true)
    setModalUploadErrors([])

    try {
      // Use transactional RPC for atomic photo assignment
      const { data, error } = await supabase.rpc("assign_feature_photos", {
        p_project_id: projectId,
        p_feature_id: featureDbId,
        p_add_photo_ids: added.length > 0 ? added : null,
        p_remove_photo_ids: removed.length > 0 ? removed : null,
        p_fallback_feature_id: fallbackDbId,
        p_cover_photo_id: nextCoverCandidate,
      })

      if (error) {
        throw error
      }

      // Log successful transaction result
      if (data) {
        console.log("Photo assignment completed:", data)
      }

      setFeaturePhotos((prev) => {
        const next = { ...prev }
        const selectionSet = new Set(tempSelectedPhotos)

        if (next[BUILDING_FEATURE_ID]) {
          next[BUILDING_FEATURE_ID] = next[BUILDING_FEATURE_ID].filter(
            (photoId) => !selectionSet.has(photoId),
          )
        }
        if (next[ADDITIONAL_FEATURE_ID]) {
          next[ADDITIONAL_FEATURE_ID] = next[ADDITIONAL_FEATURE_ID].filter(
            (photoId) => !selectionSet.has(photoId),
          )
        }

        next[featureKey] = [...tempSelectedPhotos]

        if (fallbackKey) {
          const fallbackSet = new Set(next[fallbackKey] ?? [])
          removed.forEach((photoId) => fallbackSet.add(photoId))
          next[fallbackKey] = Array.from(fallbackSet)
        }

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
        if (nextCoverCandidate) {
          next[featureKey] = nextCoverCandidate
        } else {
          delete next[featureKey]
        }

        if (fallbackKey && removed.length && !next[fallbackKey]) {
          next[fallbackKey] = removed[0]
        }

        return next
      })

      setShowPhotoSelector(null)
      setTempSelectedPhotos([])
      setTempCoverPhoto("")
      setModalUploadErrors([])
    } catch (error) {
      console.error("Failed to save feature photos", error)
      setModalUploadErrors([
        error instanceof Error ? error.message : "We couldn't save these photos. Please try again.",
      ])
    } finally {
      setIsSavingSelection(false)
    }
  }

  const cancelPhotoSelection = () => {
    setShowPhotoSelector(null)
    setTempSelectedPhotos([])
    setTempCoverPhoto("")
    setModalUploadErrors([])
  }

  const deleteFeature = (featureId: string) => {
    if (featureId === BUILDING_FEATURE_ID || featureId === ADDITIONAL_FEATURE_ID) {
      setShowPhotoSelector(null)
      return
    }

    void (async () => {
      const success = await removeFeatureById(featureId)
      if (success) {
        setShowPhotoSelector(null)
      }
    })()
  }

  const needsMorePhotos = uploadedPhotos.length < MIN_PHOTOS_REQUIRED
  const isBusy = isUploading || isSavingFeatures || isSavingSelection || isLoadingProject
  const isNextDisabled = ((currentStep === 2 || currentStep === 4) && needsMorePhotos) || isBusy

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

        {projectLoadError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {projectLoadError}
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
              className="h-6"
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
