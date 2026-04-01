"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { LucideIcon } from "lucide-react"
import { Grid3x3, Home } from "lucide-react"

import type { Tables } from "@/lib/supabase/types"
import { resolveFeatureIcon } from "@/lib/icons/project-features"
import { isPhotoSelectableForFeature } from "@/lib/photo-filtering"
import { SPACES } from "@/lib/spaces"

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

type SpaceRecord = { id: string; name: string; slug: string; sort_order: number | null }

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

const FALLBACK_FEATURES: FeatureOption[] = SPACES.map((s) => ({
  id: s.slug,
  name: s.name,
  slug: s.slug,
  iconKey: s.iconKey,
}))

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
  tempFeatureTagline: string
  tempFeatureHighlight: boolean
  setTempCoverPhoto: (value: string | ((prev: string) => string)) => void
  setTempFeatureTagline: (value: string | ((prev: string) => string)) => void
  setTempFeatureHighlight: (value: boolean | ((prev: boolean) => boolean)) => void
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
  reorderFeaturePhotos: (featureId: string, reorderedPhotoIds: string[]) => Promise<void>
  deletePhoto: (photoId: string) => void
  setOpenMenuId: (menuId: string | null) => void
  setShowAddFeatureModal: (value: boolean) => void
  movePhotoToSpace: (photoId: string, spaceId: string) => Promise<void>
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
  const [tempFeatureTagline, setTempFeatureTagline] = useState<string>("")
  const [tempFeatureHighlight, setTempFeatureHighlight] = useState<boolean>(false)
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
    Record<
      string,
      {
        featureId: string
        orderIndex: number
        spaceId: string | null
        tagline: string | null
        isHighlighted: boolean
        name: string
      }
    >
  >({})
  const unresolvedAssignmentsRef = useRef<Map<string, string>>(new Map())
  const [isSavingFeatures, setIsSavingFeatures] = useState(false)
  const [isSavingSelection, setIsSavingSelection] = useState(false)
  const [featureMutationError, setFeatureMutationError] = useState<string | null>(null)

  const draggedPhotoIdRef = useRef<string | null>(null)
  const lastProjectIdRef = useRef<string | null>(null)

  const computeAdditionalPhotoIds = useCallback((photoMap: Record<string, string[]>, allPhotoIds: string[]) => {
    const assigned = new Set<string>()

    Object.entries(photoMap).forEach(([featureKey, photoIds]) => {
      if (featureKey === ADDITIONAL_FEATURE_ID) {
        return
      }

      photoIds.forEach((photoId) => assigned.add(photoId))
    })

    const uniqueIds = Array.from(new Set(allPhotoIds))
    return uniqueIds.filter((photoId) => !assigned.has(photoId))
  }, [])

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
      .from("spaces")
      .select("id,name,slug,sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true })

    if (error) {
      setFeatureError("We could not load spaces from Supabase. Using fallback list for now.")
      setFeatureOptions(FALLBACK_FEATURES)
      setIsLoadingFeatures(false)
      return
    }

    const records = (data ?? []) as SpaceRecord[]

    if (records.length === 0) {
      setFeatureOptions(FALLBACK_FEATURES)
      setIsLoadingFeatures(false)
      return
    }

    const mapped = records
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

      // Fetch project type category to use for default feature
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("project_type_category_id, categories:project_type_category_id(id, name)")
        .eq("id", projectIdValue)
        .single()

      if (projectError) {
        console.error("Error fetching project type category:", projectError)
        throw projectError
      }

      // Handle case where project might not have a type set yet (new projects)
      const projectTypeCategoryId = projectData?.project_type_category_id || null
      const projectTypeName = projectData?.categories?.name || "Building"

      let buildingFeature = featureRows.find((row) => row.is_building_default)

      // If building feature exists, check if it needs to be synced with current project type
      if (buildingFeature) {
        const needsSync =
          buildingFeature.category_id !== projectTypeCategoryId ||
          buildingFeature.name !== projectTypeName

        if (needsSync && projectTypeCategoryId) {
          // Check if another feature already has this category_id or name
          const categoryConflict = featureRows.find(
            (row) => row.id !== buildingFeature!.id && row.category_id === projectTypeCategoryId
          )
          const nameConflict = featureRows.find(
            (row) => row.id !== buildingFeature!.id && row.name === projectTypeName
          )

          // If there's a category conflict, delete the conflicting feature and merge its photos
          if (categoryConflict) {
            // Move photos from conflicting feature to building feature
            const { error: movePhotosError } = await supabase
              .from("project_photos")
              .update({ feature_id: buildingFeature.id })
              .eq("feature_id", categoryConflict.id)
              .eq("project_id", projectIdValue)

            if (movePhotosError) {
              console.warn("Failed to move photos from conflicting feature:", movePhotosError)
            }

            // Delete the conflicting feature
            const { error: deleteError } = await supabase
              .from("project_features")
              .delete()
              .eq("id", categoryConflict.id)

            if (deleteError) {
              console.warn("Failed to delete conflicting feature:", deleteError)
            } else {
              // Remove from featureRows
              featureRows = featureRows.filter((row) => row.id !== categoryConflict.id)
            }
          }

          // Only sync if there's no name conflict (or we just resolved the category conflict)
          const recheckNameConflict = featureRows.find(
            (row) => row.id !== buildingFeature!.id && row.name === projectTypeName
          )

          if (!recheckNameConflict) {
            const { error: syncError } = await supabase
              .from("project_features")
              .update({
                name: projectTypeName,
                category_id: projectTypeCategoryId
              })
              .eq("id", buildingFeature.id)

            if (syncError) {
              throw syncError
            }

            buildingFeature = {
              ...buildingFeature,
              name: projectTypeName,
              category_id: projectTypeCategoryId,
            }
            featureRows = featureRows.map((row) => (row.id === buildingFeature!.id ? buildingFeature! : row))
          }
        }
      } else {
        // No building feature exists, check for legacy "Building" feature
        const legacyBuilding = featureRows.find((row) => row.name === "Building")

        if (legacyBuilding) {
          // Check if another feature already has the project type name
          const nameConflict = featureRows.find(
            (row) => row.id !== legacyBuilding.id && row.name === projectTypeName
          )

          // Only rename to project type if no conflict, otherwise keep "Building"
          const featureName = nameConflict ? "Building" : projectTypeName

          const { error: upgradeError } = await supabase
            .from("project_features")
            .update({
              is_building_default: true,
              order_index: legacyBuilding.order_index ?? 0,
              name: featureName,
              category_id: nameConflict ? null : projectTypeCategoryId
            })
            .eq("id", legacyBuilding.id)

          if (upgradeError) {
            throw upgradeError
          }

          buildingFeature = {
            ...legacyBuilding,
            is_building_default: true,
            order_index: legacyBuilding.order_index ?? 0,
            name: featureName,
            category_id: nameConflict ? null : projectTypeCategoryId,
          }
          featureRows = featureRows.map((row) => (row.id === legacyBuilding.id ? buildingFeature! : row))
        } else {
          // Create new default feature based on project type
          // Check if another feature already has the project type name
          const nameConflict = featureRows.find((row) => row.name === projectTypeName)
          const featureName = nameConflict ? "Building" : projectTypeName

          const newId = generateUploadId()
          const timestamp = new Date().toISOString()
          const newBuilding: ProjectFeatureRow = {
            id: newId,
            project_id: projectIdValue,
            name: featureName,
            is_building_default: true,
            order_index: 0,
            created_at: timestamp,
            updated_at: timestamp,
            category_id: nameConflict ? null : projectTypeCategoryId,
            cover_photo_id: null,
            description: null,
            is_highlighted: false,
            tagline: null,
          }

          const { error: buildingError } = await supabase.from("project_features").insert(newBuilding)

          if (buildingError) {
            // If duplicate, try to fetch the existing one instead of failing
            if ("code" in buildingError && buildingError.code === "23505") {
              const { data: existingBuilding } = await supabase
                .from("project_features")
                .select("*")
                .eq("project_id", projectIdValue)
                .eq("is_building_default", true)
                .maybeSingle()

              if (existingBuilding) {
                buildingFeature = existingBuilding
                featureRows = [...featureRows, existingBuilding]
              } else {
                throw buildingError
              }
            } else {
              throw buildingError
            }
          } else {
            buildingFeature = newBuilding
            featureRows = [...featureRows, newBuilding]
          }
        }
      }

      const maxOrderIndex = featureRows.reduce((max, row) => Math.max(max, row.order_index ?? 0), 0)

      // Find all "Additional photos" features (there should only be one, but clean up duplicates)
      const additionalFeatures = featureRows.filter(
        (row) => !row.is_building_default && row.name === "Additional photos",
      )

      let additionalFeature: ProjectFeatureRow | undefined

      if (additionalFeatures.length > 1) {
        // Multiple "Additional photos" found - keep the first one with category_id = null, delete others
        const canonical = additionalFeatures.find((row) => !row.category_id) ?? additionalFeatures[0]
        const duplicates = additionalFeatures.filter((row) => row.id !== canonical.id)

        // Delete duplicate features
        if (duplicates.length > 0) {
          const duplicateIds = duplicates.map((d) => d.id)
          const { error: deleteError } = await supabase
            .from("project_features")
            .delete()
            .in("id", duplicateIds)

          if (deleteError) {
            console.warn("Failed to delete duplicate Additional photos features", deleteError)
          }

          // Remove duplicates from featureRows
          featureRows = featureRows.filter((row) => !duplicateIds.includes(row.id))
        }

        // Ensure canonical has correct properties
        if (canonical.category_id !== null) {
          const { error: updateError } = await supabase
            .from("project_features")
            .update({ category_id: null, order_index: canonical.order_index ?? maxOrderIndex + 1 })
            .eq("id", canonical.id)

          if (updateError) {
            throw updateError
          }

          additionalFeature = {
            ...canonical,
            category_id: null,
            order_index: canonical.order_index ?? maxOrderIndex + 1,
          }
          featureRows = featureRows.map((row) => (row.id === canonical.id ? additionalFeature! : row))
        } else {
          additionalFeature = canonical
        }
      } else if (additionalFeatures.length === 1) {
        const existing = additionalFeatures[0]

        // Ensure it has correct properties
        if (existing.category_id !== null) {
          const { error: upgradeAdditionalError } = await supabase
            .from("project_features")
            .update({ category_id: null, order_index: existing.order_index ?? maxOrderIndex + 1 })
            .eq("id", existing.id)

          if (upgradeAdditionalError) {
            throw upgradeAdditionalError
          }

          additionalFeature = {
            ...existing,
            category_id: null,
            order_index: existing.order_index ?? maxOrderIndex + 1,
          }
          featureRows = featureRows.map((row) => (row.id === existing.id ? additionalFeature! : row))
        } else {
          additionalFeature = existing
        }
      } else {
        // No "Additional photos" found - create one
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
          // If duplicate, try to fetch the existing one instead of failing
          if ("code" in additionalError && additionalError.code === "23505") {
            const { data: existingAdditional } = await supabase
              .from("project_features")
              .select("*")
              .eq("project_id", projectIdValue)
              .eq("name", "Additional photos")
              .maybeSingle()

            if (existingAdditional) {
              additionalFeature = existingAdditional
              featureRows = [...featureRows, existingAdditional]
            } else {
              throw additionalError
            }
          } else {
            throw additionalError
          }
        } else {
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
            .select("id, name, category_id, space_id, cover_photo_id, is_building_default, order_index, tagline, is_highlighted")
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
        const metadata: Record<
          string,
          {
            featureId: string
            orderIndex: number
            spaceId: string | null
            tagline: string | null
            isHighlighted: boolean
          }
        > = {}
        const taxonomySelection = new Set<string>()

        if (buildingFeature) {
          uiKeyByFeatureId.set(buildingFeature.id, BUILDING_FEATURE_ID)
          idMap[BUILDING_FEATURE_ID] = buildingFeature.id
          metadata[BUILDING_FEATURE_ID] = {
            featureId: buildingFeature.id,
            orderIndex: buildingFeature.order_index ?? 0,
            spaceId: buildingFeature.space_id,
            tagline: buildingFeature.tagline ?? null,
            isHighlighted: buildingFeature.is_highlighted ?? false,
            name: buildingFeature.name,
          }
        }

        if (additionalFeature) {
          uiKeyByFeatureId.set(additionalFeature.id, ADDITIONAL_FEATURE_ID)
          idMap[ADDITIONAL_FEATURE_ID] = additionalFeature.id
          metadata[ADDITIONAL_FEATURE_ID] = {
            featureId: additionalFeature.id,
            orderIndex: additionalFeature.order_index ?? 0,
            spaceId: additionalFeature.space_id,
            tagline: additionalFeature.tagline ?? null,
            isHighlighted: additionalFeature.is_highlighted ?? false,
            name: additionalFeature.name,
          }
        }

        featureRows.forEach((feature) => {
          // Skip building default (already handled above)
          if (feature.is_building_default) {
            return
          }

          // Skip "Additional photos" (already handled above as additionalFeature)
          if (feature.id === additionalFeature?.id) {
            return
          }

          // Use space_id for space features (preferred), fall back to category_id for legacy data
          const spaceKey = feature.space_id ?? feature.category_id
          if (spaceKey) {
            // Skip if this space is already mapped to the building feature
            if (buildingFeature?.space_id && buildingFeature.space_id === feature.space_id) {
              console.log(`Skipping duplicate feature "${feature.name}" - already mapped to building feature`)
              return
            }

            console.log(`Loading feature "${feature.name}" with space_id:`, feature.space_id)
            uiKeyByFeatureId.set(feature.id, spaceKey)
            idMap[spaceKey] = feature.id
            metadata[spaceKey] = {
              featureId: feature.id,
              orderIndex: feature.order_index ?? 0,
              spaceId: feature.space_id,
              tagline: feature.tagline ?? null,
              isHighlighted: feature.is_highlighted ?? false,
              name: feature.name,
            }
            taxonomySelection.add(spaceKey)
            return
          }

          // Features without space_id should be building or additional
          console.warn(`Feature "${feature.name}" (${feature.id}) has no space_id - using database ID as key`)
          uiKeyByFeatureId.set(feature.id, feature.id)
          idMap[feature.id] = feature.id
          metadata[feature.id] = {
            featureId: feature.id,
            orderIndex: feature.order_index ?? 0,
            spaceId: feature.space_id,
            tagline: feature.tagline ?? null,
            isHighlighted: feature.is_highlighted ?? false,
            name: feature.name,
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
          const featureKey = featureId ? uiKeyByFeatureId.get(featureId) ?? ADDITIONAL_FEATURE_ID : ADDITIONAL_FEATURE_ID
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

        if (!nextFeaturePhotos[ADDITIONAL_FEATURE_ID]) {
          nextFeaturePhotos[ADDITIONAL_FEATURE_ID] = []
        }

        if (!nextFeaturePhotos[BUILDING_FEATURE_ID]) {
          nextFeaturePhotos[BUILDING_FEATURE_ID] = []
        }

        // Build selectedFeatures array including the building feature's space if it has one
        const buildingSpaceId = buildingFeature?.space_id
        const allSelectedFeatures = [
          BUILDING_FEATURE_ID,
          ...(buildingSpaceId ? [buildingSpaceId] : []),
          ...Array.from(taxonomySelection)
        ]

        console.log("Final taxonomySelection:", Array.from(taxonomySelection))
        console.log("Building feature space_id:", buildingSpaceId)
        console.log("Setting selectedFeatures to:", allSelectedFeatures)

        // Recalculate Additional photos to only include truly unassigned photos
        const allPhotoIds = nextUploadedPhotos.map((photo) => photo.id)
        nextFeaturePhotos[ADDITIONAL_FEATURE_ID] = computeAdditionalPhotoIds(nextFeaturePhotos, allPhotoIds)

        // Clear cover photo if Additional photos is empty
        if (nextFeaturePhotos[ADDITIONAL_FEATURE_ID].length === 0) {
          delete nextFeatureCoverPhotos[ADDITIONAL_FEATURE_ID]
        }

        setResolvedProjectId(projectIdValue)
        setFeatureIdMap(idMap)
        setFeatureMetadata(metadata)
        setSelectedFeatures(allSelectedFeatures)
        setUploadedPhotos(normaliseCoverFlag(nextUploadedPhotos))
        setFeaturePhotos(nextFeaturePhotos)
        setFeatureCoverPhotos(nextFeatureCoverPhotos)
      } catch (error) {
        console.error("Failed to load project photo context", error)
        console.error("Error details:", {
          errorType: typeof error,
          isError: error instanceof Error,
          errorString: String(error),
          errorJSON: JSON.stringify(error),
        })
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
      const additionalFeatureId = featureIdMap[ADDITIONAL_FEATURE_ID] ?? null
      const defaultTargetFeature =
        options.selectorFeatureId || showPhotoSelector
          ? null
          : additionalFeatureId
            ? ADDITIONAL_FEATURE_ID
            : BUILDING_FEATURE_ID

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
            `${file.name}: Image width is ${dimensions.width}px (recommended: ${MIN_IMAGE_WIDTH}px+). This may appear pixelated.`,
          )
          // Don't continue - allow upload with warning
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
          const targetFeatureKey =
            options.selectorFeatureId ?? showPhotoSelector ?? defaultTargetFeature ?? BUILDING_FEATURE_ID
          const dbFeatureId =
            targetFeatureKey === BUILDING_FEATURE_ID
              ? buildingFeatureId
              : targetFeatureKey === ADDITIONAL_FEATURE_ID
                ? additionalFeatureId
              : targetFeatureKey
                ? featureIdMap[targetFeatureKey] ?? null
                : null

          const photoId = generateUploadId()

          const { data: insertedPhoto, error: insertError } = await supabase
            .from("project_photos")
            .insert({
              id: photoId,
              project_id: resolvedProjectId,
              url: publicUrl,
              storage_path: storagePath,
              order_index: orderIndex,
              feature_id: dbFeatureId,
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
          const targetFeatureKey =
            options.selectorFeatureId ?? showPhotoSelector ?? defaultTargetFeature ?? BUILDING_FEATURE_ID
          const existing = next[targetFeatureKey] ? [...next[targetFeatureKey]] : []
          existing.push(...uploaded.map((photo) => photo.id))
          next[targetFeatureKey] = Array.from(new Set(existing))

          if (!next[BUILDING_FEATURE_ID]) {
            next[BUILDING_FEATURE_ID] = []
          }
          if (!next[ADDITIONAL_FEATURE_ID]) {
            next[ADDITIONAL_FEATURE_ID] = []
          }

          if (targetFeatureKey !== BUILDING_FEATURE_ID) {
            next[BUILDING_FEATURE_ID] = (next[BUILDING_FEATURE_ID] ?? []).filter(
              (id) => !uploaded.some((photo) => photo.id === id),
            )
          }

          if (targetFeatureKey !== ADDITIONAL_FEATURE_ID) {
            next[ADDITIONAL_FEATURE_ID] = (next[ADDITIONAL_FEATURE_ID] ?? []).filter(
              (id) => !uploaded.some((photo) => photo.id === id),
            )
          }

          const updatedUploadedIds = Array.from(
            new Set([...uploadedPhotos.map((photo) => photo.id), ...uploaded.map((photo) => photo.id)]),
          )
          next[ADDITIONAL_FEATURE_ID] = computeAdditionalPhotoIds(next, updatedUploadedIds)

          return next
        })

        const targetFeatureKey =
          options.selectorFeatureId ?? showPhotoSelector ?? defaultTargetFeature ?? BUILDING_FEATURE_ID

        if (
          targetFeatureKey !== ADDITIONAL_FEATURE_ID &&
          !featureCoverPhotos[targetFeatureKey]
        ) {
          setFeatureCoverPhotos((prev) => ({
            ...prev,
            [targetFeatureKey]: uploaded[0].id,
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
      computeAdditionalPhotoIds,
      featureCoverPhotos,
      featureIdMap,
      generateUploadId,
      normaliseCoverFlag,
      resolvedProjectId,
      showPhotoSelector,
      supabase,
      uploadedPhotos,
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
        return { id: featureId, name: "Exterior", icon: Home }
      }
      if (featureId === ADDITIONAL_FEATURE_ID) {
        return { id: featureId, name: "Other", icon: Grid3x3 }
      }

      const option = featureOptions.find((item) => item.id === featureId)
      const fallback = FALLBACK_FEATURES.find((item) => item.id === featureId)

      // Check if we have metadata with a name (for features created from database)
      const metadataName = featureMetadata[featureId]?.name
      const name = option?.name ?? fallback?.name ?? metadataName ?? "Unknown Feature"
      const slug = option?.slug ?? fallback?.slug ?? null
      const icon = resolveFeatureIcon(slug)
      return { id: featureId, name, icon }
    },
    [featureOptions, featureMetadata],
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
        setFeatureMetadata((prev) => {
          const next = { ...prev }
          featureIds.forEach((id) => {
            if (!next[id]) {
              const option = featureOptions.find((item) => item.id === id)
              const fallback = FALLBACK_FEATURES.find((item) => item.id === id)
              const name = option?.name ?? fallback?.name ?? "Unknown"

              next[id] = {
                featureId: id,
                orderIndex: next[ADDITIONAL_FEATURE_ID]?.orderIndex ?? 0,
                spaceId: isUuid(id) ? id : null,
                tagline: null,
                isHighlighted: false,
                name,
              }
            }
          })
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
          const featureName = option?.name ?? fallback?.name ?? null

          // Skip features that don't have a valid name - they're invalid/deleted categories
          if (!featureName) {
            console.warn(`Skipping feature with invalid ID: ${featureKey}`)
            continue
          }

          const spaceId = isUuid(featureKey) ? featureKey : null

          const { data, error } = await supabase
            .from("project_features")
            .insert({
              project_id: resolvedProjectId,
              name: featureName,
              space_id: spaceId,
              order_index: nextOrder,
            })
            .select("id, space_id, order_index, tagline, is_highlighted, name")
            .single()

          if (error) {
            // Handle duplicate constraint violation - feature already exists
            if ("code" in error && error.code === "23505") {
              console.log(`Feature "${featureName}" already exists, fetching existing feature`)

              // Try to fetch the existing feature by space_id first (most accurate)
              let existingFeature = null
              if (spaceId) {
                const { data: existingData } = await supabase
                  .from("project_features")
                  .select("id, space_id, order_index, tagline, is_highlighted, name")
                  .eq("project_id", resolvedProjectId)
                  .eq("space_id", spaceId)
                  .limit(1)
                  .maybeSingle()

                existingFeature = existingData
              }

              // If not found by space_id, try by name
              if (!existingFeature) {
                const { data: existingData } = await supabase
                  .from("project_features")
                  .select("id, space_id, order_index, tagline, is_highlighted, name")
                  .eq("project_id", resolvedProjectId)
                  .eq("name", featureName)
                  .limit(1)
                  .maybeSingle()

                existingFeature = existingData
              }

              if (existingFeature) {
                // Use the existing feature
                idMapCopy[featureKey] = existingFeature.id
                metadataCopy[featureKey] = {
                  featureId: existingFeature.id,
                  orderIndex: existingFeature.order_index ?? nextOrder,
                  spaceId: existingFeature.space_id,
                  tagline: existingFeature.tagline ?? null,
                  isHighlighted: existingFeature.is_highlighted ?? false,
                  name: existingFeature.name,
                }
                nextOrder += 1
                continue
              }
            }

            throw error
          }

          if (!data) {
            throw new Error("Unable to create feature")
          }

          idMapCopy[featureKey] = data.id
          metadataCopy[featureKey] = {
            featureId: data.id,
            orderIndex: data.order_index ?? nextOrder,
            spaceId: data.space_id,
            tagline: data.tagline ?? null,
            isHighlighted: data.is_highlighted ?? false,
            name: featureName,
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
              spaceId: additionalMeta.spaceId,
              tagline: additionalMeta.tagline ?? null,
              isHighlighted: additionalMeta.isHighlighted ?? false,
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
        // Reassign photos sequentially to avoid trigger conflicts with ensure_single_primary_photo_trigger
        if (photosToMove.length) {
          for (const photoId of photosToMove) {
            const { error: reassignmentError } = await supabase
              .from("project_photos")
              .update({ feature_id: fallbackDbId })
              .eq("id", photoId)
              .eq("project_id", resolvedProjectId)

            if (reassignmentError) {
              throw reassignmentError
            }
          }
        }

        console.log(`Deleting feature from database - featureId: ${featureId}, dbId: ${dbId}`)
        const { data: deleteData, error: deleteError } = await supabase
          .from("project_features")
          .delete()
          .eq("id", dbId)
          .select()

        console.log("Delete response:", { data: deleteData, error: deleteError })

        if (deleteError) {
          console.error("Delete failed:", deleteError)
          throw deleteError
        }
        console.log(`Feature deleted successfully from database`)

        setSelectedFeatures((prev) => {
          const filtered = prev.filter((id) => id !== featureId)
          console.log(`Updated selectedFeatures from ${prev.length} to ${filtered.length} items`)
          return filtered
        })

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
        console.error("Failed to remove feature:", error instanceof Error ? error.message : JSON.stringify(error), error)
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
    async (featureId: string) => {
      if (featureId === BUILDING_FEATURE_ID) {
        return
      }

      if (selectedFeatures.includes(featureId)) {
        await removeFeatureById(featureId)
      } else {
        await addFeatures([featureId])
      }
    },
    [addFeatures, removeFeatureById, selectedFeatures],
  )

  const openPhotoSelector = useCallback(
    (featureId: string) => {
      setShowPhotoSelector(featureId)
      setTempSelectedPhotos(featurePhotos[featureId] ?? [])
      setTempCoverPhoto(featureCoverPhotos[featureId] ?? "")
      const metadata = featureMetadata[featureId]
      setTempFeatureTagline(metadata?.tagline ?? "")
      setTempFeatureHighlight(metadata?.isHighlighted ?? false)
      setModalUploadErrors([])
    },
    [featureCoverPhotos, featureMetadata, featurePhotos],
  )

  const cancelPhotoSelection = useCallback(() => {
    setShowPhotoSelector(null)
    setTempSelectedPhotos([])
    setTempCoverPhoto("")
    setTempFeatureTagline("")
    setTempFeatureHighlight(false)
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
          const buildingMetadata = featureMetadata[BUILDING_FEATURE_ID]
          return buildingMetadata?.name ?? "Building"
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

      const nextTaglineValue = tempFeatureTagline.trim()
      const nextTagline = nextTaglineValue.length > 0 ? nextTaglineValue : null
      const nextHighlighted = tempFeatureHighlight
      const currentMeta = featureMetadata[showPhotoSelector]
      const previousTagline = currentMeta?.tagline ?? null
      const previousHighlighted = currentMeta?.isHighlighted ?? false

      if (
        dbFeatureId &&
        (previousTagline !== nextTagline || previousHighlighted !== nextHighlighted)
      ) {
        const { error: featureUpdateError } = await supabase
          .from("project_features")
          .update({ tagline: nextTagline, is_highlighted: nextHighlighted })
          .eq("id", dbFeatureId)

        if (featureUpdateError) {
          throw featureUpdateError
        }
      }

      setFeatureMetadata((prev) => {
        const existing = prev[showPhotoSelector]
        if (!existing) {
          if (!dbFeatureId) {
            return prev
          }
          return {
            ...prev,
            [showPhotoSelector]: {
              featureId: dbFeatureId,
              orderIndex: 0,
              spaceId: null,
              tagline: nextTagline,
              isHighlighted: nextHighlighted,
            },
          }
        }

        if (existing.tagline === nextTagline && existing.isHighlighted === nextHighlighted) {
          return prev
        }

        return {
          ...prev,
          [showPhotoSelector]: {
            ...existing,
            tagline: nextTagline,
            isHighlighted: nextHighlighted,
          },
        }
      })

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

        const allPhotoIds = uploadedPhotos.map((photo) => photo.id)
        next[ADDITIONAL_FEATURE_ID] = computeAdditionalPhotoIds(next, allPhotoIds)

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
    computeAdditionalPhotoIds,
    featureIdMap,
    featureOptions,
    featurePhotos,
    featureMetadata,
    uploadedPhotos,
    resolvedProjectId,
    showPhotoSelector,
    supabase,
    tempCoverPhoto,
    tempFeatureHighlight,
    tempFeatureTagline,
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

  const saveNewFeatures = useCallback(async (): Promise<boolean> => {
    if (tempSelectedFeatures.length === 0) {
      setShowAddFeatureModal(false)
      return true
    }

    const success = await addFeatures(tempSelectedFeatures)
    if (success) {
      setTempSelectedFeatures([])
      setShowAddFeatureModal(false)
    }
    return success
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

  /** Move a single photo to a space. Creates the project_features row if needed, then assigns the photo. */
  const movePhotoToSpace = useCallback(
    async (photoId: string, spaceId: string) => {
      if (!resolvedProjectId) return

      // 1. Ensure the space's project_features row exists
      let dbFeatureId = featureIdMap[spaceId]
      if (!dbFeatureId) {
        const success = await addFeatures([spaceId])
        if (!success) return
        // After addFeatures, the featureIdMap is updated — but we need the latest value
        // Since addFeatures updates state asynchronously, read from the insert result directly
      }

      // Re-read dbFeatureId (may have been set by addFeatures)
      dbFeatureId = featureIdMap[spaceId]
      if (!dbFeatureId) {
        // addFeatures just ran but state hasn't updated yet — query the DB directly
        const { data: featureRow } = await supabase
          .from("project_features")
          .select("id")
          .eq("project_id", resolvedProjectId)
          .eq("space_id", spaceId)
          .limit(1)
          .maybeSingle()
        dbFeatureId = featureRow?.id ?? null
      }

      if (!dbFeatureId) {
        console.error("Could not find or create project_features row for space", spaceId)
        return
      }

      // 2. Remove photo from its current space (if any)
      const currentSpaceKey = Object.entries(featurePhotos).find(
        ([key, photoIds]) =>
          key !== BUILDING_FEATURE_ID &&
          key !== ADDITIONAL_FEATURE_ID &&
          photoIds.includes(photoId),
      )?.[0]

      if (currentSpaceKey) {
        const currentDbFeatureId = featureIdMap[currentSpaceKey]
        if (currentDbFeatureId && currentSpaceKey !== spaceId) {
          // Move photo to fallback first (unassign from current space)
          const fallbackDbId = featureIdMap[BUILDING_FEATURE_ID] ?? featureIdMap[ADDITIONAL_FEATURE_ID]
          if (fallbackDbId) {
            await supabase.rpc("assign_photos_to_feature", {
              p_project_id: resolvedProjectId,
              p_feature_id: fallbackDbId,
              p_photo_ids: [photoId],
            })
          }
        }
      }

      // 3. Assign photo to the target space
      const { error } = await supabase.rpc("assign_photos_to_feature", {
        p_project_id: resolvedProjectId,
        p_feature_id: dbFeatureId,
        p_photo_ids: [photoId],
      })

      if (error) {
        console.error("Failed to move photo to space:", error)
        return
      }

      // 4. Update local state
      setFeaturePhotos((prev) => {
        const next = { ...prev }
        // Remove from old space
        if (currentSpaceKey && currentSpaceKey !== spaceId) {
          next[currentSpaceKey] = (next[currentSpaceKey] ?? []).filter((id) => id !== photoId)
        }
        // Add to new space
        next[spaceId] = [...(next[spaceId] ?? []), photoId]
        return next
      })

      // Ensure the space is in selectedFeatures
      if (!selectedFeatures.includes(spaceId)) {
        setSelectedFeatures((prev) => [...new Set([...prev, spaceId])])
      }

      // Update featureIdMap if it wasn't set
      if (!featureIdMap[spaceId]) {
        setFeatureIdMap((prev) => ({ ...prev, [spaceId]: dbFeatureId! }))
      }
    },
    [resolvedProjectId, featureIdMap, featurePhotos, selectedFeatures, addFeatures, supabase],
  )

  const displayFeatureIds = useMemo(() => {
    // Only show spaces that actually have photos assigned, ordered by spaces table sort_order
    const spacesWithPhotos = new Set(
      Object.entries(featurePhotos)
        .filter(
          ([key, photoIds]) =>
            key !== BUILDING_FEATURE_ID &&
            key !== ADDITIONAL_FEATURE_ID &&
            photoIds.length > 0,
        )
        .map(([key]) => key),
    )
    // Use featureOptions order (sorted by sort_order from spaces table)
    return featureOptions
      .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
      .filter((opt) => spacesWithPhotos.has(opt.id))
      .map((opt) => opt.id)
  }, [featurePhotos, featureOptions])

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

      // Skip if there are no photos to update
      if (nextPhotos.length === 0) {
        return
      }

      // Update photos sequentially to avoid trigger conflicts with ensure_single_primary_photo_trigger
      try {
        for (let index = 0; index < nextPhotos.length; index++) {
          const photo = nextPhotos[index]
          const { error } = await supabase
            .from("project_photos")
            .update({ order_index: index })
            .eq("id", photo.id)
            .eq("project_id", resolvedProjectId)

          if (error) {
            throw error
          }
        }
      } catch (error) {
        console.error("Failed to persist photo order:", error instanceof Error ? error.message : JSON.stringify(error))
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

  // Reorder photos within a feature and set first as cover
  const reorderFeaturePhotos = useCallback(
    async (featureId: string, reorderedPhotoIds: string[]) => {
      setFeaturePhotos((prev) => ({ ...prev, [featureId]: reorderedPhotoIds }))

      // Update cover_photo_id to the first photo
      const dbFeatureId = featureIdMap[featureId]
      if (dbFeatureId && reorderedPhotoIds[0]) {
        await supabase
          .from("project_features")
          .update({ cover_photo_id: reorderedPhotoIds[0] })
          .eq("id", dbFeatureId)
      }
    },
    [featureIdMap, supabase],
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
        return isPhotoSelectableForFeature(assignedFeature, featureId)
      })
    },
    [photoAssignmentMap, uploadedPhotos],
  )

  const getProjectTypeCategoryId = useCallback(() => {
    return featureMetadata[BUILDING_FEATURE_ID]?.spaceId ?? null
  }, [featureMetadata])

  const refreshProjectContext = useCallback(() => {
    if (resolvedProjectId) {
      void loadProjectContext(resolvedProjectId)
    }
  }, [loadProjectContext, resolvedProjectId])

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
    tempFeatureTagline,
    tempFeatureHighlight,
    setTempCoverPhoto,
    setTempFeatureTagline,
    setTempFeatureHighlight,
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
    movePhotoToSpace,
    toggleFeature,
    handlePhotoDragStart,
    handlePhotoDragOver,
    handlePhotoDropOnCard,
    handlePhotoDragEnd,
    setCoverPhoto,
    reorderFeaturePhotos,
    deletePhoto,
    setOpenMenuId,
    setShowAddFeatureModal,
    appendUploadError,
    resetUploadErrors,
    resetModalUploadErrors,
  }
}
