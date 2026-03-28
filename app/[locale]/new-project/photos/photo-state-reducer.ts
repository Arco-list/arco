/**
 * Centralized state management for photo tour using useReducer pattern
 * Replaces 20+ useState hooks with single reducer for better performance and maintainability
 */

import type { LucideIcon } from "lucide-react"

export type UploadedPhoto = {
  id: string
  url: string
  isCover: boolean
  storagePath: string | null
}

export type FeatureOption = {
  id: string
  name: string
  slug?: string | null
  iconKey?: string | null
  sortOrder?: number | null
}

export type PhotoState = {
  // Step management
  currentStep: number

  // Photo management
  uploadedPhotos: UploadedPhoto[]

  // UI state
  dragOver: boolean
  modalDragOver: boolean
  openMenuId: string | null
  showAddMenu: boolean
  showPhotoSelector: string | null
  showAddFeatureModal: boolean

  // Feature management
  selectedFeatures: string[]
  featurePhotos: Record<string, string[]>
  featureCoverPhotos: Record<string, string>
  featureOptions: FeatureOption[]
  featureIdMap: Record<string, string>
  featureMetadata: Record<string, { featureId: string; orderIndex: number; categoryId: string | null }>

  // Temporary selection state (for modals)
  tempSelectedFeatures: string[]
  tempSelectedPhotos: string[]
  tempCoverPhoto: string

  // Loading states
  isUploading: boolean
  isLoadingFeatures: boolean
  isLoadingProject: boolean
  isSavingFeatures: boolean
  isSavingSelection: boolean

  // Error states
  uploadErrors: string[]
  modalUploadErrors: string[]
  featureError: string | null
  projectLoadError: string | null
  featureMutationError: string | null

  // Project context
  projectId: string | null
}

export type PhotoAction =
  // Step navigation
  | { type: "SET_STEP"; step: number }
  | { type: "NEXT_STEP" }
  | { type: "PREV_STEP" }

  // Photo operations
  | { type: "SET_UPLOADED_PHOTOS"; photos: UploadedPhoto[] }
  | { type: "ADD_UPLOADED_PHOTOS"; photos: UploadedPhoto[] }
  | { type: "REMOVE_PHOTO"; photoId: string }
  | { type: "SET_COVER_PHOTO"; photoId: string }
  | { type: "REORDER_PHOTOS"; sourceId: string; targetId: string }

  // UI state
  | { type: "SET_DRAG_OVER"; value: boolean }
  | { type: "SET_MODAL_DRAG_OVER"; value: boolean }
  | { type: "SET_OPEN_MENU_ID"; menuId: string | null }
  | { type: "TOGGLE_ADD_MENU" }
  | { type: "OPEN_PHOTO_SELECTOR"; featureId: string }
  | { type: "CLOSE_PHOTO_SELECTOR" }
  | { type: "OPEN_ADD_FEATURE_MODAL" }
  | { type: "CLOSE_ADD_FEATURE_MODAL" }

  // Feature operations
  | { type: "SET_SELECTED_FEATURES"; features: string[] }
  | { type: "ADD_FEATURES"; features: string[] }
  | { type: "REMOVE_FEATURE"; featureId: string }
  | { type: "SET_FEATURE_PHOTOS"; featureId: string; photoIds: string[] }
  | { type: "UPDATE_FEATURE_PHOTOS"; updates: Record<string, string[]> }
  | { type: "SET_FEATURE_COVER_PHOTO"; featureId: string; photoId: string }
  | { type: "REMOVE_FEATURE_COVER_PHOTO"; featureId: string }
  | { type: "UPDATE_FEATURE_COVER_PHOTOS"; updates: Record<string, string> }
  | { type: "SET_FEATURE_OPTIONS"; options: FeatureOption[] }
  | { type: "SET_FEATURE_ID_MAP"; map: Record<string, string> }
  | { type: "UPDATE_FEATURE_ID_MAP"; updates: Record<string, string> }
  | { type: "SET_FEATURE_METADATA"; metadata: Record<string, { featureId: string; orderIndex: number; categoryId: string | null }> }
  | { type: "UPDATE_FEATURE_METADATA"; updates: Record<string, { featureId: string; orderIndex: number; categoryId: string | null }> }

  // Temporary selection (modal state)
  | { type: "TOGGLE_TEMP_FEATURE"; featureId: string }
  | { type: "TOGGLE_TEMP_PHOTO"; photoId: string }
  | { type: "SET_TEMP_PHOTOS"; photoIds: string[] }
  | { type: "ADD_TEMP_PHOTOS"; photoIds: string[] }
  | { type: "SET_TEMP_COVER_PHOTO"; photoId: string }
  | { type: "RESET_TEMP_SELECTION" }

  // Loading states
  | { type: "SET_UPLOADING"; value: boolean }
  | { type: "SET_LOADING_FEATURES"; value: boolean }
  | { type: "SET_LOADING_PROJECT"; value: boolean }
  | { type: "SET_SAVING_FEATURES"; value: boolean }
  | { type: "SET_SAVING_SELECTION"; value: boolean }

  // Error management
  | { type: "SET_UPLOAD_ERRORS"; errors: string[] }
  | { type: "APPEND_UPLOAD_ERROR"; error: string }
  | { type: "SET_MODAL_UPLOAD_ERRORS"; errors: string[] }
  | { type: "SET_FEATURE_ERROR"; error: string | null }
  | { type: "SET_PROJECT_LOAD_ERROR"; error: string | null }
  | { type: "SET_FEATURE_MUTATION_ERROR"; error: string | null }

  // Project context
  | { type: "SET_PROJECT_ID"; projectId: string | null }

  // Batch updates for efficiency
  | { type: "BATCH_UPDATE"; updates: Partial<PhotoState> }
  | { type: "LOAD_PROJECT_SUCCESS"; payload: {
      projectId: string
      featureIdMap: Record<string, string>
      featureMetadata: Record<string, { featureId: string; orderIndex: number; categoryId: string | null }>
      selectedFeatures: string[]
      uploadedPhotos: UploadedPhoto[]
      featurePhotos: Record<string, string[]>
      featureCoverPhotos: Record<string, string>
    }}

const BUILDING_FEATURE_ID = "building-default"
const ADDITIONAL_FEATURE_ID = "additional-photos"

export const initialPhotoState: PhotoState = {
  currentStep: 1,
  uploadedPhotos: [],
  dragOver: false,
  modalDragOver: false,
  openMenuId: null,
  showAddMenu: false,
  showPhotoSelector: null,
  showAddFeatureModal: false,
  selectedFeatures: [BUILDING_FEATURE_ID],
  featurePhotos: {},
  featureCoverPhotos: {},
  featureOptions: [],
  featureIdMap: {},
  featureMetadata: {},
  tempSelectedFeatures: [],
  tempSelectedPhotos: [],
  tempCoverPhoto: "",
  isUploading: false,
  isLoadingFeatures: false,
  isLoadingProject: false,
  isSavingFeatures: false,
  isSavingSelection: false,
  uploadErrors: [],
  modalUploadErrors: [],
  featureError: null,
  projectLoadError: null,
  featureMutationError: null,
  projectId: null,
}

/**
 * Normalize cover flag - ensure exactly one photo is marked as cover
 */
const normalizeCoverFlag = (photos: UploadedPhoto[]): UploadedPhoto[] => {
  if (photos.length === 0) return photos

  const existingCover = photos.find((photo) => photo.isCover)
  const coverId = existingCover?.id ?? photos[0].id

  return photos.map((photo) => ({
    ...photo,
    isCover: photo.id === coverId,
  }))
}

export function photoReducer(state: PhotoState, action: PhotoAction): PhotoState {
  switch (action.type) {
    // Step navigation
    case "SET_STEP":
      return { ...state, currentStep: action.step }

    case "NEXT_STEP":
      return { ...state, currentStep: Math.min(state.currentStep + 1, 4) }

    case "PREV_STEP":
      return { ...state, currentStep: Math.max(state.currentStep - 1, 1) }

    // Photo operations
    case "SET_UPLOADED_PHOTOS":
      return { ...state, uploadedPhotos: normalizeCoverFlag(action.photos) }

    case "ADD_UPLOADED_PHOTOS":
      return {
        ...state,
        uploadedPhotos: normalizeCoverFlag([...state.uploadedPhotos, ...action.photos])
      }

    case "REMOVE_PHOTO": {
      const filtered = state.uploadedPhotos.filter(photo => photo.id !== action.photoId)
      return { ...state, uploadedPhotos: normalizeCoverFlag(filtered) }
    }

    case "SET_COVER_PHOTO":
      return {
        ...state,
        uploadedPhotos: normalizeCoverFlag(
          state.uploadedPhotos.map(photo => ({
            ...photo,
            isCover: photo.id === action.photoId,
          }))
        ),
      }

    case "REORDER_PHOTOS": {
      if (action.sourceId === action.targetId) return state

      const sourceIndex = state.uploadedPhotos.findIndex(p => p.id === action.sourceId)
      const targetIndex = state.uploadedPhotos.findIndex(p => p.id === action.targetId)

      if (sourceIndex === -1 || targetIndex === -1) return state

      const reordered = [...state.uploadedPhotos]
      const [moved] = reordered.splice(sourceIndex, 1)
      reordered.splice(targetIndex, 0, moved)

      return { ...state, uploadedPhotos: normalizeCoverFlag(reordered) }
    }

    // UI state
    case "SET_DRAG_OVER":
      return { ...state, dragOver: action.value }

    case "SET_MODAL_DRAG_OVER":
      return { ...state, modalDragOver: action.value }

    case "SET_OPEN_MENU_ID":
      return { ...state, openMenuId: action.menuId }

    case "TOGGLE_ADD_MENU":
      return { ...state, showAddMenu: !state.showAddMenu }

    case "OPEN_PHOTO_SELECTOR": {
      const photoIds = state.featurePhotos[action.featureId] || []
      const coverCandidate = state.featureCoverPhotos[action.featureId] || photoIds[0] || ""

      return {
        ...state,
        showPhotoSelector: action.featureId,
        tempSelectedPhotos: photoIds,
        tempCoverPhoto: coverCandidate,
        modalUploadErrors: [],
      }
    }

    case "CLOSE_PHOTO_SELECTOR":
      return {
        ...state,
        showPhotoSelector: null,
        tempSelectedPhotos: [],
        tempCoverPhoto: "",
        modalUploadErrors: [],
      }

    case "OPEN_ADD_FEATURE_MODAL":
      return { ...state, showAddFeatureModal: true, showAddMenu: false }

    case "CLOSE_ADD_FEATURE_MODAL":
      return { ...state, showAddFeatureModal: false, tempSelectedFeatures: [] }

    // Feature operations
    case "SET_SELECTED_FEATURES":
      return { ...state, selectedFeatures: action.features }

    case "ADD_FEATURES": {
      const newFeatures = [...new Set([...state.selectedFeatures, ...action.features])]
      return { ...state, selectedFeatures: newFeatures }
    }

    case "REMOVE_FEATURE": {
      const filtered = state.selectedFeatures.filter(id => id !== action.featureId)
      return { ...state, selectedFeatures: filtered }
    }

    case "SET_FEATURE_PHOTOS":
      return {
        ...state,
        featurePhotos: {
          ...state.featurePhotos,
          [action.featureId]: action.photoIds,
        },
      }

    case "UPDATE_FEATURE_PHOTOS":
      return {
        ...state,
        featurePhotos: { ...state.featurePhotos, ...action.updates },
      }

    case "SET_FEATURE_COVER_PHOTO":
      return {
        ...state,
        featureCoverPhotos: {
          ...state.featureCoverPhotos,
          [action.featureId]: action.photoId,
        },
      }

    case "REMOVE_FEATURE_COVER_PHOTO": {
      const { [action.featureId]: removed, ...rest } = state.featureCoverPhotos
      return { ...state, featureCoverPhotos: rest }
    }

    case "UPDATE_FEATURE_COVER_PHOTOS":
      return {
        ...state,
        featureCoverPhotos: { ...state.featureCoverPhotos, ...action.updates },
      }

    case "SET_FEATURE_OPTIONS":
      return { ...state, featureOptions: action.options }

    case "SET_FEATURE_ID_MAP":
      return { ...state, featureIdMap: action.map }

    case "UPDATE_FEATURE_ID_MAP":
      return {
        ...state,
        featureIdMap: { ...state.featureIdMap, ...action.updates },
      }

    case "SET_FEATURE_METADATA":
      return { ...state, featureMetadata: action.metadata }

    case "UPDATE_FEATURE_METADATA":
      return {
        ...state,
        featureMetadata: { ...state.featureMetadata, ...action.updates },
      }

    // Temporary selection
    case "TOGGLE_TEMP_FEATURE": {
      const isSelected = state.tempSelectedFeatures.includes(action.featureId)
      const updated = isSelected
        ? state.tempSelectedFeatures.filter(id => id !== action.featureId)
        : [...state.tempSelectedFeatures, action.featureId]

      return { ...state, tempSelectedFeatures: updated }
    }

    case "TOGGLE_TEMP_PHOTO": {
      const isSelected = state.tempSelectedPhotos.includes(action.photoId)

      if (isSelected) {
        const filtered = state.tempSelectedPhotos.filter(id => id !== action.photoId)
        const newCover = state.tempCoverPhoto === action.photoId
          ? (filtered[0] ?? "")
          : state.tempCoverPhoto

        return {
          ...state,
          tempSelectedPhotos: filtered,
          tempCoverPhoto: newCover,
        }
      }

      return {
        ...state,
        tempSelectedPhotos: [...state.tempSelectedPhotos, action.photoId],
      }
    }

    case "SET_TEMP_PHOTOS":
      return { ...state, tempSelectedPhotos: action.photoIds }

    case "ADD_TEMP_PHOTOS": {
      const combined = [...new Set([...state.tempSelectedPhotos, ...action.photoIds])]
      const newCover = state.tempCoverPhoto || action.photoIds[0] || ""

      return {
        ...state,
        tempSelectedPhotos: combined,
        tempCoverPhoto: newCover,
      }
    }

    case "SET_TEMP_COVER_PHOTO":
      return { ...state, tempCoverPhoto: action.photoId }

    case "RESET_TEMP_SELECTION":
      return {
        ...state,
        tempSelectedFeatures: [],
        tempSelectedPhotos: [],
        tempCoverPhoto: "",
      }

    // Loading states
    case "SET_UPLOADING":
      return { ...state, isUploading: action.value }

    case "SET_LOADING_FEATURES":
      return { ...state, isLoadingFeatures: action.value }

    case "SET_LOADING_PROJECT":
      return { ...state, isLoadingProject: action.value }

    case "SET_SAVING_FEATURES":
      return { ...state, isSavingFeatures: action.value }

    case "SET_SAVING_SELECTION":
      return { ...state, isSavingSelection: action.value }

    // Error management
    case "SET_UPLOAD_ERRORS":
      return { ...state, uploadErrors: action.errors }

    case "APPEND_UPLOAD_ERROR": {
      const exists = state.uploadErrors.includes(action.error)
      if (exists) return state

      return { ...state, uploadErrors: [...state.uploadErrors, action.error] }
    }

    case "SET_MODAL_UPLOAD_ERRORS":
      return { ...state, modalUploadErrors: action.errors }

    case "SET_FEATURE_ERROR":
      return { ...state, featureError: action.error }

    case "SET_PROJECT_LOAD_ERROR":
      return { ...state, projectLoadError: action.error }

    case "SET_FEATURE_MUTATION_ERROR":
      return { ...state, featureMutationError: action.error }

    // Project context
    case "SET_PROJECT_ID":
      return { ...state, projectId: action.projectId }

    // Batch updates
    case "BATCH_UPDATE":
      return { ...state, ...action.updates }

    case "LOAD_PROJECT_SUCCESS":
      return {
        ...state,
        projectId: action.payload.projectId,
        featureIdMap: action.payload.featureIdMap,
        featureMetadata: action.payload.featureMetadata,
        selectedFeatures: action.payload.selectedFeatures,
        uploadedPhotos: normalizeCoverFlag(action.payload.uploadedPhotos),
        featurePhotos: action.payload.featurePhotos,
        featureCoverPhotos: action.payload.featureCoverPhotos,
        isLoadingProject: false,
        projectLoadError: null,
      }

    default:
      return state
  }
}
