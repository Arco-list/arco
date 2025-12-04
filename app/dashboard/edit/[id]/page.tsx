"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Users,
  FileText,
  MapPin,
  Trash2,
  Plus,
  MoreHorizontal,
  Loader2,
  AlertCircle,
  Menu,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { resolveProfessionalServiceIcon } from "@/lib/icons/professional-services"
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
import ListingStatusModal from "@/components/listing-status-modal"
import {
  type ProjectStatus,
  type ListingStatusValue,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_DOT_CLASS,
  LISTING_STATUS_VALUES,
  ACTIVE_STATUS_VALUES,
  isListingStatusValue,
  LISTING_STATUS_OPTIONS,
} from "@/lib/project-status-config"
import { DashboardHeader } from "@/components/dashboard-header"
import { Footer } from "@/components/footer"
import { ProjectBasicsFields } from "@/components/project-details/project-basics-fields"
import { ProjectFeaturesFields } from "@/components/project-details/project-features-fields"
import { ProjectMetricsFields } from "@/components/project-details/project-metrics-fields"
import { ProjectNarrativeFields } from "@/components/project-details/project-narrative-fields"
import { ProfessionalServiceCard } from "@/components/project-professional-service-card"
import { FeaturePhotoSelectorModal } from "@/components/feature-photo-selector-modal"
import { PhotoTourManager } from "@/components/photo-tour-manager"
import {
  DEFAULT_LOCATION_ICONS,
  DEFAULT_MATERIAL_ICONS,
  generateYearErrorMessages,
  getPlainTextFromHtml,
  getWordCountFromHtml,
  mapFeatureOptionsToIconItems,
  MAX_TITLE_LENGTH,
  MIN_DESCRIPTION_LENGTH,
  type ProjectDetailsDescriptionCommand,
  type ProjectDetailsFormState,
  type ProjectDetailsSelectField,
  type ProjectDetailsTextField,
  sortByOrderThenLabel,
} from "@/lib/project-details"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import type { Enums, Tables, TablesUpdate } from "@/lib/supabase/types"
import { useProjectTaxonomyOptions } from "@/hooks/use-project-taxonomy-options"
import {
  ADDITIONAL_FEATURE_ID,
  BUILDING_FEATURE_ID,
  MIN_PHOTOS_REQUIRED,
  OVERLAY_CLASSES,
  useProjectPhotoTour,
} from "@/hooks/use-project-photo-tour"
import { useCompanyEntitlements } from "@/hooks/use-company-entitlements"
import {
  createInvite,
  type ProfessionalOption,
  type InviteData,
} from "@/lib/new-project/invite-professionals"
import { 
  findProfessionalByEmailAction, 
  getUserEmailAction,
  getAvailableProfessionalsAction 
} from "@/app/new-project/actions"
import { isAdminUser } from "@/lib/auth-utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { MailPlus, Pencil, XCircle } from "lucide-react"

type ProjectBudgetLevel = Enums<"project_budget_level">
type ProjectStatus = Enums<"project_status">
type ProjectLocationUpdate = Pick<
  TablesUpdate<"projects">,
  "address_formatted" | "address_city" | "address_region" | "latitude" | "longitude" | "share_exact_location" | "location"
>

const BLOCKED_EMAIL_DOMAINS = ["gmail.com", "hotmail.com", "yahoo.com", "outlook.com", "icloud.com"]
const EMAIL_REGEX = /^(?:[a-zA-Z0-9_'^&+-])+(?:\.(?:[a-zA-Z0-9_'^&+-])+)*@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/


const getDomain = (email: string) => {
  const parts = email.split("@").map((part) => part.trim().toLowerCase())
  return parts.length === 2 ? parts[1] : ""
}

type CategoriesRow = Tables<"categories">
type ProjectProfessionalRow = Tables<"project_professionals">
type ProfessionalSummaryRow = Tables<"mv_professional_summary">
type ProjectCategoryAttributeRow = Tables<"project_category_attributes">

type ProfessionalServiceOption = {
  id: string
  name: string
  slug: string | null
  parentName: string | null
  parentSortOrder: number | null
  sortOrder: number | null
}

type ProfessionalInviteSummary = {
  id: string
  serviceId: string | null
  email: string
  status: ProjectProfessionalRow["status"]
  isOwner: boolean
  invitedAt: string
  respondedAt: string | null
  professionalId: string | null
  companyName: string | null
  primaryService: string | null
}

type ProfessionalSectionData = {
  services: ProfessionalServiceOption[]
  selectedIds: string[]
  invitesByService: Record<string, ProfessionalInviteSummary[]>
  ownerInvite: ProfessionalInviteSummary | null
  serviceLoadError: string | null
}

declare global {
  interface Window {
    google: any
  }
}

const DEFAULT_MAP_CENTER = {
  lat: 52.3727598,
  lng: 4.8936041,
}
const DEFAULT_MAP_ZOOM = 12

const EMPTY_DETAILS_FORM: ProjectDetailsFormState = {
  category: "",
  projectType: "",
  buildingType: "",
  projectStyle: "",
  locationFeatures: [],
  materialFeatures: [],
  size: "",
  budget: "",
  yearBuilt: "",
  buildingYear: "",
  projectTitle: "",
  projectDescription: "",
  address: "",
  latitude: null,
  longitude: null,
  city: "",
  region: "",
  shareExactLocation: false,
}

const isUuid = (value?: string | null): value is string =>
  Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))

const getInviteStatusMeta = (invite: ProfessionalInviteSummary) => {
  if (invite.isOwner) {
    return {
      label: "Listing owner",
      className: "bg-surface text-foreground",
    }
  }

  switch (invite.status) {
    case "invited":
      return { label: "Invite pending", className: "bg-amber-100 text-amber-800" }
    case "listed":
      return { label: "Listed", className: "bg-green-100 text-green-800" }
    case "live_on_page":
      return { label: "Active", className: "bg-green-100 text-green-800" }
    case "unlisted":
      return { label: "Unlisted", className: "bg-surface text-foreground" }
    case "removed":
      return { label: "Removed", className: "bg-red-100 text-red-800" }
    case "rejected":
      return { label: "Opted out", className: "bg-red-100 text-red-800" }
    default:
      return { label: invite.status.replace(/_/g, " "), className: "bg-surface text-foreground" }
  }
}

const sanitizeString = (value?: string | null) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

const extractCity = (
  components: Array<{ long_name: string; short_name: string; types: string[] }> = [],
) => {
  for (const component of components) {
    if (component.types.includes("locality") || component.types.includes("postal_town")) {
      return component.long_name
    }
  }
  return ""
}

const buildLocationUpdate = (state: ProjectDetailsFormState): ProjectLocationUpdate => {
  const address = sanitizeString(state.address)
  const city = sanitizeString(state.city)
  const region = sanitizeString(state.region)

  return {
    address_formatted: address,
    address_city: city,
    address_region: region,
    latitude: state.latitude,
    longitude: state.longitude,
    share_exact_location: state.shareExactLocation,
    location: city,
  }
}

export default function ListingEditorPage() {
  const params = useParams()
  const router = useRouter()
  const [activeSection, setActiveSection] = useState("preview")
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [currentStatusValue, setCurrentStatusValue] = useState<ListingStatusValue | "">("")
  const [selectedStatus, setSelectedStatus] = useState<ListingStatusValue | "">("")
  const [projectSlug, setProjectSlug] = useState<string | null>(null)
  const [projectStatus, setProjectStatus] = useState<ProjectStatus | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [showEditConfirmModal, setShowEditConfirmModal] = useState(false)


  // Location state variables
  const [locationData, setLocationData] = useState({
    address: "",
    shareExactLocation: false,
  })
  const [addressInputValue, setAddressInputValue] = useState("")
  const [isMapsApiLoaded, setIsMapsApiLoaded] = useState(false)
  const [mapsError, setMapsError] = useState<string | null>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const autocompleteRef = useRef<any>(null)
  const geocoderRef = useRef<any>(null)
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  const supabase = useMemo(() => getBrowserSupabaseClient(), [])
  const { planTier, isPlus, error: entitlementsError } = useCompanyEntitlements()
  const companyPlan: "basic" | "plus" = planTier ?? "basic"
  const rawProjectId = params?.id
  const projectId = useMemo(
    () => (Array.isArray(rawProjectId) ? rawProjectId[0] : (rawProjectId as string | undefined) ?? null),
    [rawProjectId],
  )

  const {
    categoryOptions,
    projectTypeOptionsByCategory,
    isLoadingTaxonomy,
    taxonomyError,
    projectTaxonomyError,
    projectStyleOptions,
    buildingTypeOptions,
    sizeOptions,
    budgetOptions,
    locationFeatureOptions,
    materialFeatureOptions,
  } = useProjectTaxonomyOptions(supabase)

  const [detailsForm, setDetailsForm] = useState<ProjectDetailsFormState>({ ...EMPTY_DETAILS_FORM })
  const detailsFormRef = useRef<ProjectDetailsFormState>(EMPTY_DETAILS_FORM)
  const [detailsErrors, setDetailsErrors] = useState<Record<string, string>>({})
  const [detailsLoading, setDetailsLoading] = useState(true)
  const [detailsLoadError, setDetailsLoadError] = useState<string | null>(null)
  const [detailsSaving, setDetailsSaving] = useState(false)
  const [detailsFeedback, setDetailsFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [detailsOpenDropdown, setDetailsOpenDropdown] = useState<ProjectDetailsSelectField | null>(null)
  const [detailsLastSavedAt, setDetailsLastSavedAt] = useState<Date | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [hasProjectAccess, setHasProjectAccess] = useState(false)
  const [locationSaving, setLocationSaving] = useState(false)

  const {
    uploadedPhotos,
    orderedFeatureOptions,
    selectedFeatures,
    displayFeatureIds,
    dragOver,
    modalDragOver,
    openMenuId,
    setOpenMenuId,
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
    isLoadingProject,
    isLoadingFeatures,
    uploadErrors,
    modalUploadErrors,
    featureError,
    featureMutationError,
    projectLoadError: photoProjectLoadError,
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
    setCoverPhoto,
    deletePhoto,
    handlePhotoDragStart,
    handlePhotoDragOver,
    handlePhotoDropOnCard,
    handlePhotoDragEnd,
    resetModalUploadErrors,
  } = useProjectPhotoTour({ supabase, projectId: hasProjectAccess ? projectId : null })

  const photoTourHook = useProjectPhotoTour({ supabase, projectId: hasProjectAccess ? projectId : null })

  const statusModalProject = useMemo(() => {
    const coverPhotoUrl =
      getFeatureCoverPhoto(BUILDING_FEATURE_ID) ??
      getFeatureCoverPhoto(ADDITIONAL_FEATURE_ID) ??
      uploadedPhotos[0]?.url ??
      "/placeholder.svg"

    const descriptorParts = [detailsForm.projectStyle, detailsForm.city, detailsForm.region]
      .filter((value): value is string => Boolean(value && value.trim().length > 0))
      .map((value) => value.trim())

    return {
      title: detailsForm.projectTitle?.trim() || "Untitled project",
      descriptor: descriptorParts.join(" • ") || "Add project details",
      coverImageUrl: coverPhotoUrl,
      planBadgeLabel: isPlus ? "Plus plan" : "Basic plan",
    }
  }, [
    detailsForm.city,
    detailsForm.projectStyle,
    detailsForm.projectTitle,
    detailsForm.region,
    getFeatureCoverPhoto,
    isPlus,
    uploadedPhotos,
  ])

  const isPendingAdminReview = projectStatus === "in_progress"
  const limitReachedForNewActivation = false
  const selectedStatusOption = useMemo(
    () => LISTING_STATUS_OPTIONS.find((option) => option.value === selectedStatus),
    [selectedStatus],
  )
  const requiresPlusForSelection = selectedStatusOption?.requiresPlus === true && !isPlus
  const canSaveStatus = Boolean(selectedStatusOption) && !isPendingAdminReview && !requiresPlusForSelection

  const currentFeatureDisplay = useMemo(
    () => (showPhotoSelector ? getFeatureDisplay(showPhotoSelector) : null),
    [getFeatureDisplay, showPhotoSelector],
  )

  const modalTaglineInputId = showPhotoSelector ? `feature-tagline-${showPhotoSelector}` : "feature-tagline"
  const modalHighlightToggleId = showPhotoSelector ? `feature-highlight-${showPhotoSelector}` : "feature-highlight"

  const selectablePhotos = useMemo(
    () => getSelectablePhotos(showPhotoSelector),
    [getSelectablePhotos, showPhotoSelector],
  )


  useEffect(() => {
    if (!projectStatus) {
      return
    }

    if (isListingStatusValue(projectStatus)) {
      setCurrentStatusValue(projectStatus)
      setSelectedStatus(projectStatus)
    } else {
      setCurrentStatusValue("")
      setSelectedStatus("")
    }
  }, [projectStatus])

  useEffect(() => {
    if (showStatusModal) {
      setSelectedStatus(currentStatusValue || "")
    }
  }, [currentStatusValue, showStatusModal])

  useEffect(() => {
    detailsFormRef.current = detailsForm
  }, [detailsForm])

  useEffect(() => {
    setAddressInputValue(detailsForm.address ?? "")
  }, [detailsForm.address])

  useEffect(() => {
    const MAX_RETRIES = 50 // 5 seconds total (50 * 100ms)
    let retryCount = 0
    let timeoutId: NodeJS.Timeout | null = null
    let cancelled = false

    const checkMapsLoaded = () => {
      if (cancelled) return // Early exit if component unmounted

      if (window.google?.maps?.marker?.AdvancedMarkerElement) {
        setIsMapsApiLoaded(true)
        setMapsError(null)
        return
      }

      retryCount++

      if (retryCount >= MAX_RETRIES) {
        setMapsError(
          "Google Maps failed to load. Please check your internet connection and refresh the page."
        )
        return
      }

      timeoutId = setTimeout(checkMapsLoaded, 100)
    }

    checkMapsLoaded()

    // Cleanup function to prevent memory leaks and setState on unmounted component
    return () => {
      cancelled = true
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (cancelled) {
        return
      }

      if (error) {
        setDetailsFeedback({ type: "error", message: error.message })
        return
      }

      setUserId(data.user?.id ?? null)
    }

    void loadUser()

    return () => {
      cancelled = true
    }
  }, [supabase])

  useEffect(() => {
    setHasProjectAccess(false)
    setProjectSlug(null)
    setProjectStatus(null)

    if (!projectId) {
      setDetailsLoading(false)
      setDetailsLoadError("Project not found.")
      return
    }

    if (!userId) {
      return
    }

    let cancelled = false

    const hydrateDetails = async () => {
      setDetailsLoading(true)
      setDetailsFeedback(null)
      setDetailsLoadError(null)

      const { data: project, error } = await supabase
        .from("projects")
        .select(
          "id, client_id, title, description, project_type, project_type_category_id, building_type, project_size, budget_level, project_year, building_year, style_preferences, address_formatted, address_city, address_region, latitude, longitude, share_exact_location, updated_at, status, slug",
        )
        .eq("id", projectId)
        .maybeSingle()

      if (cancelled) {
        return
      }

      if (error || !project) {
        setDetailsLoadError(error?.message ?? "We couldn't load this project.")
        setDetailsLoading(false)
        return
      }

      if (project.client_id !== userId) {
        setDetailsLoadError("You do not have access to edit this project.")
        setDetailsLoading(false)
        return
      }
      setHasProjectAccess(true)

      const [{ data: categoryRows }, { data: selectionRows }] = await Promise.all([
        supabase
          .from("project_categories")
          .select("category_id, is_primary")
          .eq("project_id", project.id),
        supabase
          .from("project_taxonomy_selections")
          .select("taxonomy_option_id")
          .eq("project_id", project.id),
      ])

      const taxonomyIds = (selectionRows ?? []).map((row) => row.taxonomy_option_id)
      let locationSelections: string[] = []
      let materialSelections: string[] = []

      if (taxonomyIds.length) {
        const { data: taxonomyRows } = await supabase
          .from("project_taxonomy_options")
          .select("id, taxonomy_type")
          .in("id", taxonomyIds)

        locationSelections = (taxonomyRows ?? [])
          .filter((row) => row.taxonomy_type === "location_feature")
          .map((row) => row.id)
        materialSelections = (taxonomyRows ?? [])
          .filter((row) => row.taxonomy_type === "material_feature")
          .map((row) => row.id)
      }

      const primaryCategoryId = categoryRows?.find((row) => row.is_primary)?.category_id ?? ""
      const parentCategoryId = categoryRows?.find((row) => !row.is_primary)?.category_id ?? ""
      const projectTypeValue = project.project_type_category_id || project.project_type || ""

      const hydratedState: ProjectDetailsFormState = {
        category: parentCategoryId || projectTypeValue,
        projectType: primaryCategoryId || projectTypeValue,
        buildingType: project.building_type ?? "",
        projectStyle: project.style_preferences?.[0] ?? "",
        locationFeatures: locationSelections,
        materialFeatures: materialSelections,
        size: project.project_size ?? "",
        budget: (project.budget_level as ProjectBudgetLevel | null) ?? "",
        yearBuilt: project.project_year ? String(project.project_year) : "",
        buildingYear: project.building_year ? String(project.building_year) : "",
        projectTitle: project.title ?? "",
        projectDescription: project.description ?? "",
        address: project.address_formatted ?? "",
        latitude: project.latitude ?? null,
        longitude: project.longitude ?? null,
        city: project.address_city ?? "",
        region: project.address_region ?? "",
        shareExactLocation: project.share_exact_location ?? false,
      }

      if (!cancelled) {
        setProjectSlug(project.slug ?? null)
        const status = (project.status as ProjectStatus | null) ?? null
        setProjectStatus(status)
        setDetailsForm(hydratedState)
        setLocationData({
          address: project.address_formatted ?? "",
          shareExactLocation: project.share_exact_location ?? false,
        })
        setDetailsLastSavedAt(project.updated_at ? new Date(project.updated_at) : null)
        setDetailsLoading(false)
        setDetailsLoadError(null)
      }
    }

    void hydrateDetails()

    return () => {
      cancelled = true
    }
  }, [projectId, supabase, userId])

  // Set edit mode based on project status
  // Only projects that have been submitted (in_progress or higher) should be editable here
  // Projects in draft status should use /app/new-project/ instead
  useEffect(() => {
    if (!projectStatus) return

    // For projects that were submitted and came back for editing
    if (projectStatus === "in_progress") {
      setIsEditMode(true)
      setActiveSection("photo-tour")
    } else if (["published", "completed", "archived"].includes(projectStatus)) {
      setIsEditMode(false)
      setActiveSection("preview")
    }
  }, [projectStatus])

  useEffect(() => {
    if (activeSection !== "location") {
      return
    }

    if (!googleMapsApiKey) {
      return
    }

    if (!isMapsApiLoaded) {
      return
    }

    if (typeof window === "undefined" || !window.google?.maps || !mapContainerRef.current) {
      setMapsError("Google Maps failed to initialize. Refresh the page to try again.")
      return
    }

    setMapsError(null)

    const startPosition =
      detailsForm.latitude !== null && detailsForm.longitude !== null
        ? { lat: detailsForm.latitude, lng: detailsForm.longitude }
        : DEFAULT_MAP_CENTER

    if (!mapInstanceRef.current) {
      const map = new window.google.maps.Map(mapContainerRef.current, {
        center: startPosition,
        zoom: detailsForm.latitude !== null ? 15 : DEFAULT_MAP_ZOOM,
        mapTypeControl: true,
        fullscreenControl: false,
        streetViewControl: false,
        zoomControl: true,
        mapId: process.env.NEXT_PUBLIC_GOOGLE_MAP_ID, // Required for AdvancedMarkerElement
      })

      mapInstanceRef.current = map

      const marker = new window.google.maps.marker.AdvancedMarkerElement({
        map,
        position: startPosition,
        gmpDraggable: true,
      })

      markerRef.current = marker
      geocoderRef.current = new window.google.maps.Geocoder()

      marker.addListener("dragend", () => {
        const position = marker.position
        if (!position) {
          return
        }

        // Handle both LatLng and LatLngLiteral types
        const { lat, lng } = position instanceof google.maps.LatLng
          ? position.toJSON()
          : position

        setDetailsForm((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
        }))

        const geocoder = geocoderRef.current ?? new window.google.maps.Geocoder()
        geocoderRef.current = geocoder

        geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
          if (status === "OK" && results?.length) {
            const primary = results[0]
            const formattedAddress = primary.formatted_address ?? ""
            const city = extractCity(primary.address_components ?? [])

            setDetailsForm((prev) => ({
              ...prev,
              address: formattedAddress,
              latitude: lat,
              longitude: lng,
              city,
            }))
            setLocationData((prev) => ({
              ...prev,
              address: formattedAddress,
            }))
            setAddressInputValue(formattedAddress)
            setDetailsErrors((prev) => {
              if (!prev.address) {
                return prev
              }
              const next = { ...prev }
              delete next.address
              return next
            })
          }
        })
      })
    } else {
      const marker = markerRef.current
      if (marker) {
        marker.position = startPosition
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setCenter(startPosition)
        mapInstanceRef.current.setZoom(detailsForm.latitude !== null ? 15 : DEFAULT_MAP_ZOOM)
      }
    }

    if (!autocompleteRef.current && searchInputRef.current) {
      const autocomplete = new window.google.maps.places.Autocomplete(searchInputRef.current, {
        fields: ["formatted_address", "geometry", "address_components"],
        types: ["geocode"],
      })

      autocompleteRef.current = autocomplete

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace()
        if (!place || !place.geometry?.location) {
          return
        }

        const location = place.geometry.location
        const lat = location.lat()
        const lng = location.lng()

        const formattedAddress = place.formatted_address ?? ""
        const city = extractCity(place.address_components ?? [])

        setDetailsForm((prev) => ({
          ...prev,
          address: formattedAddress,
          latitude: lat,
          longitude: lng,
          city,
        }))
        setLocationData((prev) => ({
          ...prev,
          address: formattedAddress,
        }))
        setAddressInputValue(formattedAddress)
        setDetailsErrors((prev) => {
          if (!prev.address) {
            return prev
          }
          const next = { ...prev }
          delete next.address
          return next
        })

        if (markerRef.current) {
          markerRef.current.position = { lat, lng }
        }

        if (mapInstanceRef.current) {
          if (place.geometry.viewport) {
            mapInstanceRef.current.fitBounds(place.geometry.viewport)
          } else {
            mapInstanceRef.current.panTo({ lat, lng })
            mapInstanceRef.current.setZoom(15)
          }
        }
      })
    }
  }, [
    activeSection,
    detailsForm.latitude,
    detailsForm.longitude,
    googleMapsApiKey,
    isMapsApiLoaded,
    setDetailsErrors,
  ])

  useEffect(() => {
    if (activeSection === "location") {
      return
    }

    if (typeof window === "undefined" || !window.google?.maps) {
      mapInstanceRef.current = null
      markerRef.current = null
      autocompleteRef.current = null
      return
    }

    if (markerRef.current) {
      window.google.maps.event.clearInstanceListeners(markerRef.current)
    }
    if (autocompleteRef.current) {
      window.google.maps.event.clearInstanceListeners(autocompleteRef.current)
    }
    if (mapInstanceRef.current) {
      window.google.maps.event.clearInstanceListeners(mapInstanceRef.current)
    }

    markerRef.current = null
    autocompleteRef.current = null
    mapInstanceRef.current = null
  }, [activeSection])

  const projectTypeOptions = useMemo(() => {
    if (!detailsForm.category) {
      return []
    }
    const options = projectTypeOptionsByCategory[detailsForm.category] ?? []
    return [...options].sort(sortByOrderThenLabel)
  }, [detailsForm.category, projectTypeOptionsByCategory])

  const sortedProjectStyleOptions = useMemo(
    () => [...projectStyleOptions].sort(sortByOrderThenLabel),
    [projectStyleOptions],
  )
  const sortedBuildingTypeOptions = useMemo(
    () => [...buildingTypeOptions].sort(sortByOrderThenLabel),
    [buildingTypeOptions],
  )
  const sortedSizeOptions = useMemo(() => [...sizeOptions].sort(sortByOrderThenLabel), [sizeOptions])
  const sortedBudgetOptions = useMemo(() => [...budgetOptions].sort(sortByOrderThenLabel), [budgetOptions])

  const locationFeaturesData = useMemo(
    () => mapFeatureOptionsToIconItems(locationFeatureOptions, DEFAULT_LOCATION_ICONS),
    [locationFeatureOptions],
  )
  const materialFeaturesData = useMemo(
    () => mapFeatureOptionsToIconItems(materialFeatureOptions, DEFAULT_MATERIAL_ICONS),
    [materialFeatureOptions],
  )

  const yearFieldValidation = useMemo(
    () => generateYearErrorMessages(detailsForm, { treatEmptyAsError: false }),
    [detailsForm],
  )

  const descriptionPlainText = useMemo(() => getPlainTextFromHtml(detailsForm.projectDescription), [detailsForm.projectDescription])
  const descriptionPlainTextLength = descriptionPlainText.trim().length
  const descriptionWordCount = useMemo(() => getWordCountFromHtml(detailsForm.projectDescription), [detailsForm.projectDescription])

  const detailsLastSavedLabel = useMemo(() => {
    if (detailsSaving) {
      return "Saving..."
    }
    if (!detailsLastSavedAt) {
      return "Not saved yet"
    }
    return `Saved ${detailsLastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
  }, [detailsLastSavedAt, detailsSaving])

  const descriptionEditor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: {
          keepAttributes: false,
          keepMarks: true,
        },
        orderedList: {
          keepAttributes: false,
          keepMarks: true,
        },
      }),
      Underline,
    ],
    content: detailsForm.projectDescription || "",
    editorProps: {
      attributes: {
        spellCheck: "true",
      },
    },
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      const normalizedHtml = html === "<p></p>" ? "" : html

      setDetailsForm((prev) => {
        if (prev.projectDescription === normalizedHtml) {
          return prev
        }

        return {
          ...prev,
          projectDescription: normalizedHtml,
        }
      })

      const plainTextLength = editor.getText().trim().length

      if (plainTextLength === 0) {
        setDetailsErrors((prev) => ({ ...prev, projectDescription: "Add a project description." }))
      } else if (plainTextLength < MIN_DESCRIPTION_LENGTH) {
        setDetailsErrors((prev) => ({
          ...prev,
          projectDescription: `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters.`,
        }))
      } else {
        setDetailsErrors((prev) => {
          if (!prev.projectDescription) {
            return prev
          }
          const next = { ...prev }
          delete next.projectDescription
          return next
        })
      }
    },
  })

  useEffect(() => {
    if (!descriptionEditor) {
      return
    }

    const currentHtml = descriptionEditor.getHTML()
    const normalizedCurrent = currentHtml === "<p></p>" ? "" : currentHtml
    const desiredHtml = detailsForm.projectDescription || ""

    if (normalizedCurrent !== desiredHtml) {
      descriptionEditor.commands.setContent(desiredHtml === "" ? "<p></p>" : desiredHtml, false)
    }
  }, [descriptionEditor, detailsForm.projectDescription])

  const applyDescriptionFormatting = (command: ProjectDetailsDescriptionCommand) => {
    if (!descriptionEditor) {
      return
    }

    const chain = descriptionEditor.chain().focus()

    switch (command) {
      case "bold":
        chain.toggleBold()
        break
      case "italic":
        chain.toggleItalic()
        break
      case "underline":
        chain.toggleUnderline()
        break
      case "bulletList":
        chain.toggleBulletList()
        break
      case "orderedList":
        chain.toggleOrderedList()
        break
      default:
        break
    }

    chain.run()
  }

  const updateYearFieldErrors = (state: ProjectDetailsFormState, options?: { treatEmptyAsError?: boolean }) => {
    const { errors } = generateYearErrorMessages(state, options)

    setDetailsErrors((prev) => {
      const next = { ...prev }
      delete next.yearBuilt
      delete next.buildingYear

      return Object.keys(errors).length > 0 ? { ...next, ...errors } : next
    })
  }

  const setFieldError = (field: string, message: string) => {
    setDetailsErrors((prev) => {
      if (prev[field] === message) {
        return prev
      }
      return { ...prev, [field]: message }
    })
  }

  const clearFieldError = (field: string) => {
    setDetailsErrors((prev) => {
      if (!prev[field]) {
        return prev
      }

      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const handleDropdownSelect = (field: ProjectDetailsSelectField, value: string) => {
    setDetailsForm((prev) => {
      if (field === "category") {
        return {
          ...prev,
          category: value,
          projectType: "",
        }
      }

      return {
        ...prev,
        [field]: value,
      }
    })
    setDetailsOpenDropdown(null)
    clearFieldError(field)
  }

  const handleInputChange = (field: ProjectDetailsTextField, value: string) => {
    if (field === "yearBuilt" || field === "buildingYear") {
      setDetailsForm((prev) => {
        const next = {
          ...prev,
          [field]: value,
        }

        updateYearFieldErrors(next)
        return next
      })
    } else if (field === "address") {
      setAddressInputValue(value)
      setDetailsForm((prev) => ({
        ...prev,
        address: value,
        latitude: null,
        longitude: null,
        city: "",
        region: "",
      }))
      setLocationData((prev) => ({
        ...prev,
        address: value,
      }))
      clearFieldError(field)
    } else {
      setDetailsForm((prev) => ({
        ...prev,
        [field]: value,
      }))
      clearFieldError(field)
    }
  }

  const handleCheckboxChange = (field: "locationFeatures" | "materialFeatures", value: string) => {
    setDetailsForm((prev) => {
      const currentValues = prev[field]
      const newValues = currentValues.includes(value)
        ? currentValues.filter((entry) => entry !== value)
        : [...currentValues, value]

      if (newValues.length > 0) {
        clearFieldError(field)
      }

      return {
        ...prev,
        [field]: newValues,
      }
    })
  }

  const handleToggleChange = (value: boolean) => {
    setDetailsForm((prev) => ({
      ...prev,
      shareExactLocation: value,
    }))
    setLocationData((prev) => ({
      ...prev,
      shareExactLocation: value,
    }))
  }

  const handleSaveLocation = useCallback(async () => {
    if (!projectId || !userId || locationSaving) {
      return
    }

    const snapshot = detailsFormRef.current
    if (!snapshot) {
      return
    }

    const locationUpdate = buildLocationUpdate(snapshot)

    if (!locationUpdate.address_formatted) {
      toast.error("Enter the project address before saving.")
      return
    }

    setLocationSaving(true)

    try {
      const { error: updateError } = await supabase
        .from("projects")
        .update(locationUpdate)
        .eq("id", projectId)
        .eq("client_id", userId)
      if (updateError) {
        throw updateError
      }

      const nextAddress = locationUpdate.address_formatted ?? ""
      const nextCity = locationUpdate.address_city ?? ""
      const nextRegion = locationUpdate.address_region ?? ""

      setDetailsForm((prev) => ({
        ...prev,
        address: nextAddress,
        city: nextCity,
        region: nextRegion,
      }))
      setLocationData((prev) => ({
        ...prev,
        address: nextAddress,
      }))
      setDetailsLastSavedAt(new Date())
      toast.success("Location saved.")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update the project location."
      toast.error("Location not saved", { description: message })
    } finally {
      setLocationSaving(false)
    }
  }, [locationSaving, projectId, supabase, userId])

  const validateDetailsForm = useCallback(() => {
    const errors: Record<string, string> = {}

    if (!detailsForm.category) {
      errors.category = "Select a project category."
    }
    if (!detailsForm.projectType) {
      errors.projectType = "Select a project type."
    }
    if (!detailsForm.buildingType) {
      errors.buildingType = "Select a building type."
    }
    if (!detailsForm.projectStyle) {
      errors.projectStyle = "Select a project style."
    }
    if (detailsForm.locationFeatures.length === 0) {
      errors.locationFeatures = "Select at least one location feature."
    }
    if (detailsForm.materialFeatures.length === 0) {
      errors.materialFeatures = "Select at least one material feature."
    }
    if (!detailsForm.size) {
      errors.size = "Select the project size."
    }
    if (!detailsForm.budget) {
      errors.budget = "Select the project budget."
    }

    const yearErrors = generateYearErrorMessages(detailsForm, { treatEmptyAsError: true }).errors
    Object.assign(errors, yearErrors)

    const trimmedTitle = detailsForm.projectTitle.trim()
    if (!trimmedTitle) {
      errors.projectTitle = "Enter a project title."
    } else if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      errors.projectTitle = `Project title must be ${MAX_TITLE_LENGTH} characters or fewer.`
    }

    const descriptionText = descriptionPlainText.trim()
    if (!descriptionText) {
      errors.projectDescription = "Add a project description."
    } else if (descriptionText.length < MIN_DESCRIPTION_LENGTH) {
      errors.projectDescription = `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters.`
    }

    if (!detailsForm.address.trim()) {
      errors.address = "Enter the project address."
    }

    setDetailsErrors(errors)
    return Object.keys(errors).length === 0
  }, [descriptionPlainText, detailsForm])

  const handleSaveDetails = useCallback(async () => {
    if (!projectId || !userId || detailsSaving) {
      return
    }

    const snapshot = detailsFormRef.current
    if (!snapshot) {
      return
    }

    const isValid = validateDetailsForm()
    if (!isValid) {
      setDetailsFeedback({ type: "error", message: "Please resolve the highlighted fields." })
      return
    }

    const trimmedTitle = snapshot.projectTitle.trim()
    const { parsedYearBuilt, parsedBuildingYear } = generateYearErrorMessages(snapshot, {
      treatEmptyAsError: false,
    })

    const projectUpdatePayload: TablesUpdate<"projects"> = {
      title: trimmedTitle,
      description: snapshot.projectDescription || null,
      project_type: snapshot.projectType || null,
      project_type_category_id: isUuid(snapshot.projectType) ? snapshot.projectType : null,
      building_type: snapshot.buildingType || null,
      project_size: snapshot.size || null,
      budget_level: (snapshot.budget || null) as ProjectBudgetLevel | null,
      project_year: parsedYearBuilt,
      building_year: parsedBuildingYear,
      style_preferences: snapshot.projectStyle ? [snapshot.projectStyle] : null,
      ...buildLocationUpdate(snapshot),
    }

    setDetailsSaving(true)
    setDetailsFeedback(null)

    try {
      const { error: updateError } = await supabase
        .from("projects")
        .update(projectUpdatePayload)
        .eq("id", projectId)
        .eq("client_id", userId)
      if (updateError) {
        throw updateError
      }

      const categoryRows: { category_id: string; is_primary: boolean }[] = []
      if (snapshot.projectType && isUuid(snapshot.projectType)) {
        categoryRows.push({ category_id: snapshot.projectType, is_primary: true })
      }
      if (snapshot.category && isUuid(snapshot.category)) {
        categoryRows.push({ category_id: snapshot.category, is_primary: false })
      }

      const { error: deleteCategoriesError } = await supabase
        .from("project_categories")
        .delete()
        .eq("project_id", projectId)

      if (deleteCategoriesError) {
        throw deleteCategoriesError
      }

      if (categoryRows.length) {
        const insertPayload = categoryRows.map((row) => ({ ...row, project_id: projectId }))
        const { error: insertCategoriesError } = await supabase.from("project_categories").insert(insertPayload)
        if (insertCategoriesError) {
          throw insertCategoriesError
        }
      }

      const taxonomySelectionIds = Array.from(
        new Set(
          [
            ...snapshot.locationFeatures.filter((value) => isUuid(value)),
            ...snapshot.materialFeatures.filter((value) => isUuid(value)),
          ],
        ),
      )

      const { error: deleteSelectionsError } = await supabase
        .from("project_taxonomy_selections")
        .delete()
        .eq("project_id", projectId)

      if (deleteSelectionsError) {
        throw deleteSelectionsError
      }

      if (taxonomySelectionIds.length) {
        const selectionRows = taxonomySelectionIds.map((id) => ({
          project_id: projectId,
          taxonomy_option_id: id,
        }))

        const { error: insertSelectionsError } = await supabase
          .from("project_taxonomy_selections")
          .insert(selectionRows)

        if (insertSelectionsError) {
          throw insertSelectionsError
        }
      }

      setDetailsLastSavedAt(new Date())
      toast.success("Project details saved.")
      setDetailsFeedback(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong while saving."
      setDetailsFeedback({ type: "error", message })
    } finally {
      setDetailsSaving(false)
    }
  }, [detailsSaving, projectId, supabase, userId, validateDetailsForm])
  // Professionals state management
  const [professionalServices, setProfessionalServices] = useState<ProfessionalServiceOption[]>([])
  const [selectedProfessionalServiceIds, setSelectedProfessionalServiceIds] = useState<string[]>([])
  const [professionalInvites, setProfessionalInvites] = useState<Record<string, ProfessionalInviteSummary[]>>({})
  const [projectOwnerInvite, setProjectOwnerInvite] = useState<ProfessionalInviteSummary | null>(null)
  const [professionalsLoading, setProfessionalsLoading] = useState(true)
  const [professionalsError, setProfessionalsError] = useState<string | null>(null)
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false)
  const [serviceSelectionDraft, setServiceSelectionDraft] = useState<string[]>([])
  const [isUpdatingServices, setIsUpdatingServices] = useState(false)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteServiceId, setInviteServiceId] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState("")
  const [editingInviteId, setEditingInviteId] = useState<string | null>(null)
  
  // Professional discovery state for admin/professional users
  const [professionals, setProfessionals] = useState<ProfessionalOption[]>([])
  const [selectedProfessional, setSelectedProfessional] = useState<ProfessionalOption | null>(null)
  const [userTypes, setUserTypes] = useState<string[]>([])
  const [projectClientId, setProjectClientId] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [isInviteMutating, setIsInviteMutating] = useState(false)

  const editableSidebarItems = [
    { id: "photo-tour", name: "Photo tour", icon: ImageIcon },
    { id: "professionals", name: "Professionals", icon: Users },
    { id: "details", name: "Details", icon: FileText },
    { id: "location", name: "Location", icon: MapPin },
  ]

  const sidebarItems = isEditMode ? editableSidebarItems : []

  const getCurrentSectionTitle = () => {
    if (activeSection === "preview") return "Listing preview"
    const currentItem = editableSidebarItems.find(item => item.id === activeSection)
    return currentItem?.name || "Listing preview"
  }

  const handleEditListing = async () => {
    if (!projectId) return

    setIsEditMode(true)
    setActiveSection("photo-tour")
    setShowEditConfirmModal(false)

    try {
      if (!userId) {
        toast.error("User not authenticated")
        return
      }

      // Only change status to in_progress if it's a published/completed/archived listing
      // Never change back to draft - that's only for projects that haven't been submitted yet
      if (projectStatus && ["published", "completed", "archived"].includes(projectStatus)) {
        const { error } = await supabase
          .from("projects")
          .update({ status: "in_progress" })
          .eq("id", projectId)
          .eq("client_id", userId)

        if (error) {
          toast.error("Failed to update project status")
          console.error("Error updating project status:", error)
        } else {
          setProjectStatus("in_progress")
          toast.success("Editing enabled - Project moved to review")
        }
      } else {
        toast.success("Editing enabled")
      }
    } catch (err) {
      toast.error("Failed to enable editing")
      console.error("Error enabling edit mode:", err)
    }
  }

  const handleSubmitForReview = async () => {
    if (!projectId) return
    
    try {
      if (!userId) {
        toast.error("User not authenticated")
        return
      }

      const { error } = await supabase
        .from("projects")
        .update({ status: "in_progress" })
        .eq("id", projectId)
        .eq("client_id", userId)
      
      if (error) {
        toast.error("Failed to submit for review")
        console.error("Error submitting for review:", error)
      } else {
        setProjectStatus("in_progress")
        setIsEditMode(false)
        setActiveSection("preview")
        toast.success("Submitted for admin review")
      }
    } catch (err) {
      toast.error("Failed to submit for review")
      console.error("Error submitting for review:", err)
    }
  }

  const statusOptions = LISTING_STATUS_OPTIONS

  const statusOptionByValue = useMemo(
    () => new Map(statusOptions.map((option) => [option.value, option])),
    [statusOptions],
  )

  const currentStatusLabel = useMemo(() => {
    if (currentStatusValue && statusOptionByValue.has(currentStatusValue)) {
      return statusOptionByValue.get(currentStatusValue)!.label
    }
    if (projectStatus) {
      return PROJECT_STATUS_LABELS[projectStatus]
    }
    return "Set status"
  }, [currentStatusValue, projectStatus, statusOptionByValue])

  const statusIndicatorClass = useMemo(() => {
    if (currentStatusValue && statusOptionByValue.has(currentStatusValue)) {
      return statusOptionByValue.get(currentStatusValue)!.colorClass
    }
    if (projectStatus) {
      return PROJECT_STATUS_DOT_CLASS[projectStatus]
    }
    return "bg-muted-foreground"
  }, [currentStatusValue, projectStatus, statusOptionByValue])

  const loadProfessionalServiceOptions = useCallback(async () => {
    const { data: childRows, error: childError } = await supabase
      .from("categories")
      .select("id, name, slug, parent_id, sort_order")
      .eq("is_active", true)
      .not("parent_id", "is", null)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true })

    if (childError) {
      throw childError
    }

    const children: CategoriesRow[] = childRows ?? []
    if (children.length === 0) {
      return [] as ProfessionalServiceOption[]
    }

    const childIds = children.map((row) => row.id)
    const parentIds = Array.from(
      new Set(children.map((row) => row.parent_id).filter((value): value is string => Boolean(value))),
    )

    const [parentResult, attributeResult] = await Promise.all([
      parentIds.length
        ? supabase
            .from("categories")
            .select("id, name, sort_order")
            .in("id", parentIds)
        : Promise.resolve<{ data: CategoriesRow[]; error: null }>({ data: [], error: null }),
      childIds.length
        ? supabase
            .from("project_category_attributes")
            .select("category_id")
            .in("category_id", childIds)
        : Promise.resolve<{ data: ProjectCategoryAttributeRow[]; error: null }>({ data: [], error: null }),
    ])

    if (parentResult.error) {
      throw parentResult.error
    }

    if (attributeResult.error) {
      throw attributeResult.error
    }

    const parentMap = new Map<string, { name: string | null; sortOrder: number | null }>()
    ;(parentResult.data ?? []).forEach((row) => {
      parentMap.set(row.id, { name: row.name, sortOrder: row.sort_order ?? null })
    })

    const excludedIds = new Set((attributeResult.data ?? []).map((row) => row.category_id))

    return children
      .filter((row) => !excludedIds.has(row.id))
      .map<ProfessionalServiceOption>((row) => {
        const parentMeta = row.parent_id ? parentMap.get(row.parent_id) : null
        return {
          id: row.id,
          name: row.name,
          slug: row.slug ?? null,
          parentName: parentMeta?.name ?? null,
          parentSortOrder: parentMeta?.sortOrder ?? null,
          sortOrder: row.sort_order ?? null,
        }
      })
      .sort((a, b) => {
        const parentOrderA = a.parentSortOrder ?? 0
        const parentOrderB = b.parentSortOrder ?? 0
        if (parentOrderA !== parentOrderB) {
          return parentOrderA - parentOrderB
        }
        if (a.parentName && b.parentName && a.parentName !== b.parentName) {
          return a.parentName.localeCompare(b.parentName)
        }
        const orderA = a.sortOrder ?? 0
        const orderB = b.sortOrder ?? 0
        if (orderA !== orderB) {
          return orderA - orderB
        }
        return a.name.localeCompare(b.name)
      })
  }, [supabase])

  const fetchProfessionalSectionData = useCallback(async (): Promise<ProfessionalSectionData | null> => {
    if (!projectId || !hasProjectAccess) {
      return null
    }

    let serviceLoadError: string | null = null
    let serviceOptions: ProfessionalServiceOption[] = []

    try {
      serviceOptions = await loadProfessionalServiceOptions()
    } catch (error) {
      serviceLoadError =
        error instanceof Error ? error.message : "We couldn't load professional services. Please try again."
      serviceOptions = []
    }

    const { data: selectionRows, error: selectionError } = await supabase
      .from("project_professional_services")
      .select("service_category_id")
      .eq("project_id", projectId)

    if (selectionError) {
      throw selectionError
    }

    const selectedIds = (selectionRows ?? [])
      .map((row) => row.service_category_id)
      .filter((value): value is string => Boolean(value))

    const { data: inviteRows, error: invitesError } = await supabase
      .from("project_professionals")
      .select(
        "id, invited_email, invited_service_category_id, status, is_project_owner, invited_at, responded_at, professional_id",
      )
      .eq("project_id", projectId)
      .order("is_project_owner", { ascending: false })
      .order("invited_at", { ascending: true, nullsFirst: false })

    if (invitesError) {
      throw invitesError
    }

    const professionalIds = Array.from(
      new Set(
        (inviteRows ?? [])
          .map((row) => row.professional_id)
          .filter((value): value is string => Boolean(value)),
      ),
    )

    let professionalMap = new Map<string, ProfessionalSummaryRow>()
    if (professionalIds.length) {
      const { data: professionals, error: professionalError } = await supabase
        .from("mv_professional_summary")
        .select("id, company_name, primary_specialty")
        .in("id", professionalIds)

      if (professionalError) {
        throw professionalError
      }

      professionalMap = new Map(
        (professionals ?? [])
          .filter((row): row is ProfessionalSummaryRow & { id: string } => Boolean(row?.id))
          .map((row) => [row.id!, row]),
      )
    }

    const invitesByService: Record<string, ProfessionalInviteSummary[]> = {}
    let ownerInvite: ProfessionalInviteSummary | null = null

    ;(inviteRows ?? []).forEach((row) => {
      const professionalData = row.professional_id ? professionalMap.get(row.professional_id) : null
      const summary: ProfessionalInviteSummary = {
        id: row.id,
        serviceId: row.invited_service_category_id,
        email: row.invited_email,
        status: row.status,
        isOwner: row.is_project_owner,
        invitedAt: row.invited_at,
        respondedAt: row.responded_at,
        professionalId: row.professional_id,
        companyName: professionalData?.company_name ?? null,
        primaryService: professionalData?.primary_specialty ?? null,
      }

      if (summary.isOwner) {
        ownerInvite = summary
      }

      if (!summary.serviceId) {
        return
      }

      if (!invitesByService[summary.serviceId]) {
        invitesByService[summary.serviceId] = []
      }
      invitesByService[summary.serviceId].push(summary)
    })

    Object.values(invitesByService).forEach((list) => {
      list.sort((a, b) => new Date(a.invitedAt).getTime() - new Date(b.invitedAt).getTime())
    })

    const optionMap = new Map(serviceOptions.map((option) => [option.id, option]))
    const additionalOptions: ProfessionalServiceOption[] = []

    selectedIds.forEach((serviceId) => {
      if (!optionMap.has(serviceId)) {
        additionalOptions.push({
          id: serviceId,
          name: serviceId,
          slug: null,
          parentName: null,
          parentSortOrder: null,
          sortOrder: null,
        })
      }
    })

    const combinedServices = [...serviceOptions, ...additionalOptions]

    return {
      services: combinedServices,
      selectedIds,
      invitesByService,
      ownerInvite,
      serviceLoadError,
    }
  }, [hasProjectAccess, loadProfessionalServiceOptions, projectId, supabase])

  const applyProfessionalSectionData = useCallback((data: ProfessionalSectionData) => {
    setProfessionalServices(data.services)
    setSelectedProfessionalServiceIds(data.selectedIds)
    setProfessionalInvites(data.invitesByService)
    setProjectOwnerInvite(data.ownerInvite)
    if (data.serviceLoadError) {
      setProfessionalsError(data.serviceLoadError)
    } else {
      setProfessionalsError(null)
    }
  }, [])

  const refreshProfessionalSection = useCallback(async () => {
    const result = await fetchProfessionalSectionData()
    if (result) {
      applyProfessionalSectionData(result)
    }
    return result
  }, [applyProfessionalSectionData, fetchProfessionalSectionData])

  const loadAvailableProfessionals = useCallback(async (userTypes: string[], userId: string) => {
    const { data, error } = await getAvailableProfessionalsAction(userTypes, userId)
    
    if (error) {
      console.error("Failed to load available professionals:", error)
      return
    }

    if (data) {
      setProfessionals(data)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadProfessionals = async () => {
      if (!projectId || !hasProjectAccess) {
        setProfessionalServices([])
        setSelectedProfessionalServiceIds([])
        setProfessionalInvites({})
        setProjectOwnerInvite(null)
        setProfessionalsLoading(false)
        return
      }

      setProfessionalsLoading(true)
      setProfessionalsError(null)

      try {
        // Load user profile and available professionals
        const { data: authData } = await supabase.auth.getUser()
        if (authData?.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("user_types")
            .eq("id", authData.user.id)
            .maybeSingle()
          
          const userTypesArray = profile?.user_types || []
          setUserTypes(userTypesArray)
          
          // Load available professionals for dropdown
          await loadAvailableProfessionals(userTypesArray, authData.user.id)
          
          // Load project data to get client_id
          const { data: projectData } = await supabase
            .from("projects")
            .select("client_id")
            .eq("id", projectId)
            .maybeSingle()
          
          if (projectData) {
            setProjectClientId(projectData.client_id)
          }
        }
        
        const result = await fetchProfessionalSectionData()
        if (!cancelled && result) {
          applyProfessionalSectionData(result)
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : "We couldn't load professionals for this project."
          setProfessionalsError(message)
        }
      } finally {
        if (!cancelled) {
          setProfessionalsLoading(false)
        }
      }
    }

    void loadProfessionals()

    return () => {
      cancelled = true
    }
  }, [applyProfessionalSectionData, fetchProfessionalSectionData, hasProjectAccess, loadAvailableProfessionals, projectId, supabase])

  const openServiceModal = () => {
    setServiceSelectionDraft(selectedProfessionalServiceIds)
    setIsServiceModalOpen(true)
  }

  const handleServiceModalOpenChange = (open: boolean) => {
    setIsServiceModalOpen(open)
    if (open) {
      setServiceSelectionDraft(selectedProfessionalServiceIds)
    } else {
      setServiceSelectionDraft([])
    }
  }

  const toggleServiceInDraft = (serviceId: string) => {
    setServiceSelectionDraft((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId],
    )
  }

  const handleSaveServiceSelection = async () => {
    if (!projectId || isUpdatingServices) {
      return
    }

    const nextSelection = Array.from(new Set(serviceSelectionDraft))
    const added = nextSelection.filter((id) => !selectedProfessionalServiceIds.includes(id))
    const removed = selectedProfessionalServiceIds.filter((id) => !nextSelection.includes(id))

    if (added.length === 0 && removed.length === 0) {
      setIsServiceModalOpen(false)
      return
    }

    setIsUpdatingServices(true)
    setProfessionalsError(null)

    try {
      if (added.length) {
        const rows = added.map((serviceId) => ({
          project_id: projectId,
          service_category_id: serviceId,
        }))
        const { error: insertError } = await supabase.from("project_professional_services").insert(rows)
        if (insertError) {
          throw insertError
        }
      }

      if (removed.length) {
        const deleteQuery = supabase.from("project_professional_services").delete().eq("project_id", projectId)
        const { error: deleteError } =
          removed.length === 1
            ? await deleteQuery.eq("service_category_id", removed[0]!)
            : await deleteQuery.in("service_category_id", removed)
        if (deleteError) {
          throw deleteError
        }

        setProfessionalInvites((prev) => {
          const next = { ...prev }
          removed.forEach((serviceId) => {
            delete next[serviceId]
          })
          return next
        })
      }

      setSelectedProfessionalServiceIds(nextSelection)
      setIsServiceModalOpen(false)
      setServiceSelectionDraft([])
      await refreshProfessionalSection()
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We couldn't update your professional services. Please try again."
      setProfessionalsError(message)
  } finally {
    setIsUpdatingServices(false)
  }
}

  const handlePreviewListing = useCallback(() => {
    if (!projectSlug) {
      toast.error("Preview unavailable", {
        description: "This listing does not have a public link yet.",
      })
      return
    }

    const basePath = `/projects/${projectSlug}`
    const isInReview = projectStatus === "in_progress"
    const isDraft = projectStatus === "draft"
    const targetUrl = isInReview || isDraft ? `${basePath}?preview=1` : basePath

    window.open(targetUrl, "_blank", "noopener,noreferrer")
  }, [projectSlug, projectStatus])

  const handleRemoveService = async (serviceId: string) => {
    if (!projectId || isUpdatingServices) {
      return
    }

    setIsUpdatingServices(true)
    setProfessionalsError(null)

    try {
      const { error } = await supabase
        .from("project_professional_services")
        .delete()
        .eq("project_id", projectId)
        .eq("service_category_id", serviceId)

      if (error) {
        throw error
      }

      setSelectedProfessionalServiceIds((prev) => prev.filter((id) => id !== serviceId))
      setProfessionalInvites((prev) => {
        const next = { ...prev }
        delete next[serviceId]
        return next
      })
      await refreshProfessionalSection()
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "We couldn't remove that professional service. Please try again."
      setProfessionalsError(message)
    } finally {
      setIsUpdatingServices(false)
    }
  }

  const handleInviteDialogChange = (open: boolean) => {
    if (!open) {
      closeInviteModal()
    } else {
      setInviteDialogOpen(true)
    }
  }

  const openInviteModal = (serviceId: string, invite?: ProfessionalInviteSummary) => {
    if (!isUuid(serviceId)) {
      setInviteError("Please select a service from the Supabase taxonomy before sending invites.")
      return
    }

    if (!invite) {
      const existingInvites = professionalInvites[serviceId] ?? []
      if (existingInvites.length >= 1) {
        setInviteError("Only one professional can be invited per service. Remove the existing invite before adding another.")
        return
      }
    }

    setInviteServiceId(serviceId)
    setInviteEmail(invite?.email ?? "")
    setEditingInviteId(invite?.id ?? null)
    setInviteError(null)
    setInviteDialogOpen(true)
  }

  const closeInviteModal = () => {
    setInviteDialogOpen(false)
    setInviteServiceId(null)
    setInviteEmail("")
    setEditingInviteId(null)
    setInviteError(null)
    setSelectedProfessional(null)
  }

  const handleProfessionalDirectSelect = async (professional: ProfessionalOption, serviceId: string) => {
    if (!projectId || isInviteMutating) {
      return
    }

    const existingInvites = professionalInvites[serviceId] ?? []
    if (existingInvites.length >= 1) {
      setInviteError("Only one professional can be invited per service. Remove the existing invite before adding another.")
      return
    }

    setInviteError(null)
    setIsInviteMutating(true)

    try {
      const isProjectOwner = projectClientId === professional.user_id
      
      const inviteData: InviteData = {
        project_id: projectId,
        invited_service_category_id: serviceId,
        invited_email: professional.email,
        professional_id: professional.id,
        company_id: professional.company_id,
        is_project_owner: isProjectOwner,
      }

      const { data, error } = await createInvite(supabase, inviteData)

      if (error || !data) {
        throw error ?? new Error("Professional could not be added to project.")
      }

      await refreshProfessionalSection()
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "We couldn't add this professional. Please try again.")
    } finally {
      setIsInviteMutating(false)
    }
  }

  const handleInviteSubmit = async () => {
    if (!projectId || !inviteServiceId || isInviteMutating) {
      return
    }

    if (!editingInviteId) {
      const existingInvites = professionalInvites[inviteServiceId] ?? []
      if (existingInvites.length >= 1) {
        setInviteError("Only one professional can be invited per service. Remove the existing invite before adding another.")
        return
      }
    }

    const email = selectedProfessional ? selectedProfessional.email : inviteEmail.trim()
    
    if (!selectedProfessional) {
      if (!EMAIL_REGEX.test(email)) {
        setInviteError("Please enter a valid company email address.")
        return
      }

      const domain = getDomain(email)
      if (domain && BLOCKED_EMAIL_DOMAINS.includes(domain)) {
        setInviteError("Please use a company email address (personal domains are not allowed).")
        return
      }
    }

    setInviteError(null)
    setIsInviteMutating(true)

    try {
      if (editingInviteId) {
        const updateData: any = { invited_email: email }
        if (selectedProfessional) {
          updateData.professional_id = selectedProfessional.id
          updateData.company_id = selectedProfessional.company_id
        }

        const { data, error } = await supabase
          .from("project_professionals")
          .update(updateData)
          .eq("id", editingInviteId)
          .select("id, invited_email, invited_service_category_id, status, invited_at, responded_at")
          .maybeSingle()

        if (error || !data) {
          throw error ?? new Error("Invite could not be updated.")
        }
      } else {
        let professionalId = selectedProfessional?.id || null
        let companyId = selectedProfessional?.company_id || null
        let isProjectOwner = selectedProfessional && projectClientId === selectedProfessional.user_id
        
        if (!selectedProfessional) {
          const { data: foundProfessional } = await findProfessionalByEmailAction(email)
          if (foundProfessional) {
            professionalId = foundProfessional.id
            companyId = foundProfessional.company_id
            isProjectOwner = projectClientId === foundProfessional.user_id
          }
        }
        
        const inviteData: InviteData = {
          project_id: projectId,
          invited_service_category_id: inviteServiceId,
          invited_email: email,
          professional_id: professionalId,
          company_id: companyId,
          is_project_owner: isProjectOwner,
        }

        const { data, error } = await createInvite(supabase, inviteData)

        if (error || !data) {
          throw error ?? new Error("Invite could not be saved.")
        }
      }

      await refreshProfessionalSection()
      closeInviteModal()
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "We couldn't send that invite. Please try again.")
    } finally {
      setIsInviteMutating(false)
    }
  }

  const handleDeleteInvite = async (invite: ProfessionalInviteSummary) => {
    if (isInviteMutating) {
      return
    }

    setInviteError(null)
    setIsInviteMutating(true)

    try {
      const { error } = await supabase.from("project_professionals").delete().eq("id", invite.id)
      if (error) {
        throw error
      }
      await refreshProfessionalSection()
    } catch (error) {
      setInviteError(
        error instanceof Error ? error.message : "We couldn't update that invite. Please try again.",
      )
    } finally {
      setIsInviteMutating(false)
    }
  }

  const handleCloseStatusModal = useCallback(() => {
    setShowStatusModal(false)
    setSelectedStatus(currentStatusValue || "")
  }, [currentStatusValue])

  const handleStatusSave = () => {
    if (!selectedStatus || isPendingAdminReview) {
      handleCloseStatusModal()
      return
    }

    if (requiresPlusForSelection) {
      toast.error("Upgrade to Plus to make this listing discoverable.")
      return
    }

    setCurrentStatusValue(selectedStatus)
    handleCloseStatusModal()
  }

  // Location input change handler
  const handleLocationInputChange = (field: string, value: string | boolean) => {
    if (field === "address" && typeof value === "string") {
      handleInputChange("address", value)
    } else {
      setLocationData((prev) => ({
        ...prev,
        [field]: value,
      }))
    }
  }

  // Location toggle handler
  const handleLocationToggleChange = (field: string, value: boolean) => {
    if (field === "shareExactLocation") {
      handleToggleChange(value)
    } else {
      setLocationData((prev) => ({
        ...prev,
        [field]: value,
      }))
    }
  }

  const renderPhotoTourSection = () => {
    if (!hasProjectAccess) {
      return (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-6 body-small text-amber-800">
          You need access to this project to manage its photo tour.
        </div>
      )
    }

    if (!projectId) {
      return (
        <div className="py-16 text-center body-small text-text-secondary">
          Select a project to manage its photo tour.
        </div>
      )
    }

    if (isLoadingProject) {
      return <div className="py-16 text-center body-small text-text-secondary">Loading project photos…</div>
    }

    if (photoProjectLoadError) {
      return (
        <div className="rounded-md border border-red-200 bg-red-50 p-6 body-small text-red-700">
          {photoProjectLoadError}
        </div>
      )
    }

    return (
      <PhotoTourManager
        photoTour={photoTourHook}
        showHeader={true}
        title="Photo tour"
        subtitle="Add photos for every feature. Only features with photos appear on the published page."
      />
    )
  }

  const renderLocationSection = () => (
    <div className="space-y-6 pb-24 md:pb-0">
      <div className="hidden md:block">
        <h3 className="heading-4 text-foreground">Location</h3>
        <p className="body-regular text-text-secondary mt-1">Where is the project located?</p>
      </div>

      <div className="space-y-8">
        {/* Map Container */}
        <div className="relative">
          {googleMapsApiKey ? (
            <>
              <div className="relative w-full h-96 bg-surface rounded-lg overflow-hidden">
                <div ref={mapContainerRef} className="h-full w-full" />
                <div className="pointer-events-none absolute top-4 left-0 right-0 z-10 flex justify-center px-4">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={addressInputValue}
                    onChange={(event) => handleLocationInputChange("address", event.target.value)}
                    placeholder="Search for your address"
                    className="pointer-events-auto w-full max-w-xl px-4 py-3 bg-white border border-border rounded-md shadow-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent hover:border-border transition-colors"
                  />
                </div>
                {!isMapsApiLoaded && !mapsError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60 text-foreground">
                    Loading map...
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 body-small text-amber-800">
                Add your Google Maps API key to `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to enable address autocomplete and map
                selection.
              </div>
              <input
                type="text"
                value={addressInputValue}
                onChange={(event) => handleLocationInputChange("address", event.target.value)}
                placeholder="Enter your project address"
                className="w-full px-4 py-3 bg-white border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent hover:border-border transition-colors"
              />
            </div>
          )}
          <p className="body-small text-text-secondary mt-2">
            Search for your project location or drag the pin on the map to fine-tune it
          </p>
          {mapsError && <p className="body-small text-red-600 mt-2">{mapsError}</p>}
          {detailsErrors.address && <p className="body-small text-red-600 mt-2">{detailsErrors.address}</p>}
          <div className="mt-4 rounded-lg border border-border bg-surface p-4">
            <p className="body-small font-medium text-foreground">Selected address</p>
            <p className="mt-1 body-small text-foreground">
              {detailsForm.address
                ? detailsForm.address
                : "Start typing in the search box or drag the map pin to capture the address."}
            </p>
          </div>
        </div>

        {/* Share exact location toggle */}
        <div className="flex items-center justify-between p-4 bg-surface rounded-lg">
          <div>
            <h4 className="heading-5 text-foreground mb-1">Share the exact location of the project</h4>
            <p className="body-small text-text-secondary">Allow others to see the precise location of your project</p>
          </div>
          <button
            type="button"
            onClick={() => handleLocationToggleChange("shareExactLocation", !detailsForm.shareExactLocation)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 ${
              detailsForm.shareExactLocation ? "bg-secondary" : "bg-surface"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                detailsForm.shareExactLocation ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Save Button - Sticky on Mobile */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-border md:static md:border-0 md:p-0 md:flex md:justify-end z-10">
          <Button variant="secondary" size="sm" onClick={() => void handleSaveLocation()} disabled={locationSaving} className="w-full md:w-auto">
            {locationSaving ? "Saving…" : "Save location"}
          </Button>
        </div>
      </div>
    </div>
  )

  // Professionals section render function
  const renderProfessionalsSection = () => {
    const serviceMap = new Map(professionalServices.map((service) => [service.id, service]))
    const selectedServices = selectedProfessionalServiceIds.map((id) => {
      const option = serviceMap.get(id)
      if (option) {
        return option
      }
      return {
        id,
        name: id,
        slug: null,
        parentName: null,
        parentSortOrder: null,
        sortOrder: null,
      }
    })

    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="hidden md:block">
            <h3 className="heading-4 text-foreground">Professionals</h3>
            <p className="mt-1 body-regular text-text-secondary">Manage the professional services linked to this project.</p>
          </div>
          <button
            type="button"
            onClick={openServiceModal}
            aria-label="Manage professional services"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-white transition-colors hover:bg-secondary-hover ml-auto"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        {professionalsError && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 body-small text-amber-800">
            {professionalsError}
          </div>
        )}

        {inviteError && !inviteDialogOpen && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 body-small text-red-700">{inviteError}</div>
        )}

        {professionalsLoading ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-white p-6 body-small text-text-secondary">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading professionals…
          </div>
        ) : (
          <div className="space-y-6">
            {selectedServices.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-surface p-6 body-small text-text-secondary">
                Add a professional service to invite collaborators to this project.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {selectedServices.map((service) => (
                  <ProfessionalServiceCard
                    key={service.id}
                    service={service}
                    invites={professionalInvites[service.id] ?? []}
                    isBusy={isInviteMutating || isUpdatingServices}
                    onInvite={openInviteModal}
                    onDeleteInvite={handleDeleteInvite}
                    onRemoveService={handleRemoveService}
                    getInviteStatusMeta={getInviteStatusMeta}
                    canEditInvite={(invite) => !invite.isOwner && invite.status === "invited"}
                    canDeleteInvite={(invite) => !invite.isOwner}
                    professionals={professionals}
                    onProfessionalDirectSelect={handleProfessionalDirectSelect}
                    userTypes={userTypes}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const featurePhotoSelectorModal = (
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
      onDeleteFeature={showPhotoSelector ? () => void deleteFeature(showPhotoSelector) : undefined}
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
  )

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <DashboardHeader />

      <main className="flex-1 px-4 pt-20 pb-8 md:px-8">
        <div className="mx-auto max-w-7xl">
          {entitlementsError && (
            <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 body-small text-amber-800">
              {entitlementsError}
            </div>
          )}
          <div className="flex">
            {/* Sidebar - Hidden on mobile */}
            <div className="hidden md:block w-64 bg-white border-r border-border p-6 mr-8">
              <div className="space-y-6">
                {/* Status Selector */}
                <div>
                  <Button
                    variant="tertiary"
                    size="sm"
                    onClick={() => setShowStatusModal(true)}
                    className="w-full justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${statusIndicatorClass}`} />
                      <span>{currentStatusLabel}</span>
                    </div>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                {/* Edit/Submit buttons */}
                {!isEditMode ? (
                  <div>
                    <Button 
                      className="w-full bg-secondary text-white hover:bg-secondary-hover h-auto px-[18px] py-3" 
                      onClick={() => setShowEditConfirmModal(true)}
                    >
                      Edit listing
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Button 
                      className="w-full bg-secondary text-white hover:bg-secondary-hover h-auto px-[18px] py-3" 
                      onClick={handleSubmitForReview}
                    >
                      Submit for review
                    </Button>
                  </div>
                )}

                {/* Navigation Items */}
                <div className="space-y-2">
                  {sidebarItems.map((item) => {
                    const IconComponent = item.icon
                    const isActive = activeSection === item.id

                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
                        className={`body-small w-full flex items-center gap-3 px-[18px] py-3 rounded-full text-left transition-all font-medium ${
                          isActive ? "bg-quaternary text-quaternary-foreground" : "bg-transparent text-quaternary-foreground hover:bg-quaternary-hover"
                        }`}
                      >
                        <IconComponent className="w-5 h-5" />
                        <span>{item.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 md:pt-6">
              {/* Back Button - Mobile Only */}
              <div className="md:hidden mb-4">
                <Button variant="tertiary" size="sm" asChild className="w-20 min-w-[5rem] max-w-[5rem]">
                  <Link href="/dashboard/listings">
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </Link>
                </Button>
              </div>

              {/* Mobile Status Button */}
              <div className="md:hidden mb-8 max-w-64">
                <Button
                  variant="tertiary"
                  size="sm"
                  onClick={() => setShowStatusModal(true)}
                  className="w-full justify-between"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${statusIndicatorClass}`} />
                    <span>{currentStatusLabel}</span>
                  </div>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Mobile Navigation Header */}
              <div className="md:hidden mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="tertiary"
                    size="icon"
                    onClick={() => setIsMobileMenuOpen(true)}
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                  <h4 className="heading-5 text-foreground">{getCurrentSectionTitle()}</h4>
                </div>
                {!isEditMode && activeSection === "preview" && (
                  <Button 
                    className="bg-secondary text-white hover:bg-secondary-hover" 
                    onClick={() => setShowEditConfirmModal(true)}
                  >
                    Edit
                  </Button>
                )}
                {isEditMode && (
                  <Button className="bg-secondary text-white hover:bg-secondary-hover" onClick={handlePreviewListing}>
                    Preview
                  </Button>
                )}
              </div>
              {activeSection === "preview" && (
                <div className="flex items-center justify-center min-h-[60vh]">
                  <div className="text-center max-w-md">
                    <h3 className="heading-4 text-foreground mb-3">
                      Ready to edit your listing?
                    </h3>
                    <p className="body-regular text-text-secondary mb-8">
                      Click "Edit listing" in the sidebar to make changes to your project.
                    </p>
                  </div>
                </div>
              )}
              {activeSection === "photo-tour" && renderPhotoTourSection()}
              {activeSection === "professionals" && renderProfessionalsSection()}
              {activeSection === "details" && (
                <div className="space-y-8 pb-24 md:pb-0">
                  {detailsFeedback && (
                    <div
                      className={`body-small rounded-md border p-4 ${
                        detailsFeedback.type === "success"
                          ? "border-green-200 bg-green-50 text-green-700"
                          : "border-red-200 bg-red-50 text-red-700"
                      }`}
                    >
                      {detailsFeedback.message}
                    </div>
                  )}

                  {detailsLoadError && !detailsLoading ? (
                    <div className="rounded-md border border-red-200 bg-red-50 p-6 body-small text-red-700">
                      {detailsLoadError}
                    </div>
                  ) : detailsLoading ? (
                    <div className="py-12 text-center text-text-secondary">Loading project details…</div>
                  ) : (
                    <div className="space-y-12">
                      <section className="space-y-6">
                        <div>
                          <h3 className="heading-4 text-foreground">Project basics</h3>
                          <p className="body-small text-text-secondary">
                            Update the core classification of your project.
                          </p>
                        </div>
                        <ProjectBasicsFields
                          formData={detailsForm}
                          validationErrors={detailsErrors}
                          categoryOptions={categoryOptions}
                          projectTypeOptions={projectTypeOptions}
                          buildingTypeOptions={sortedBuildingTypeOptions}
                          projectStyleOptions={sortedProjectStyleOptions}
                          openDropdown={detailsOpenDropdown}
                          setOpenDropdown={setDetailsOpenDropdown}
                          onDropdownSelect={handleDropdownSelect}
                          isLoadingTaxonomy={isLoadingTaxonomy}
                          taxonomyError={taxonomyError}
                          projectTaxonomyError={projectTaxonomyError}
                        />
                      </section>

                      <section className="space-y-6">
                        <div>
                          <h3 className="heading-4 text-foreground">Features</h3>
                          <p className="body-small text-text-secondary">
                            Highlight the location and material characteristics that define this project.
                          </p>
                        </div>
                        <ProjectFeaturesFields
                          locationItems={locationFeaturesData}
                          materialItems={materialFeaturesData}
                          selectedLocationFeatures={detailsForm.locationFeatures}
                          selectedMaterialFeatures={detailsForm.materialFeatures}
                          onToggle={handleCheckboxChange}
                          validationErrors={detailsErrors}
                          projectTaxonomyError={projectTaxonomyError}
                        />
                      </section>

                      <section className="space-y-6">
                        <div>
                          <h3 className="heading-4 text-foreground">Project metrics</h3>
                          <p className="body-small text-text-secondary">
                            Capture scale, investment level, and timeline details.
                          </p>
                        </div>
                        <ProjectMetricsFields
                          formData={detailsForm}
                          validationErrors={detailsErrors}
                          sizeOptions={sortedSizeOptions}
                          budgetOptions={sortedBudgetOptions}
                          openDropdown={detailsOpenDropdown}
                          setOpenDropdown={setDetailsOpenDropdown}
                          onDropdownSelect={handleDropdownSelect}
                          onInputChange={handleInputChange}
                        />
                      </section>

                      <section className="space-y-6">
                        <div>
                          <h3 className="heading-4 text-foreground">Storytelling</h3>
                          <p className="body-small text-text-secondary">
                            Craft a narrative that helps prospects understand the scope and highlights.
                          </p>
                        </div>
                        <ProjectNarrativeFields
                          formData={detailsForm}
                          validationErrors={detailsErrors}
                          onInputChange={handleInputChange}
                          editor={descriptionEditor}
                          onCommand={applyDescriptionFormatting}
                          plainTextLength={descriptionPlainTextLength}
                          wordCount={descriptionWordCount}
                          minDescriptionLength={MIN_DESCRIPTION_LENGTH}
                          maxTitleLength={MAX_TITLE_LENGTH}
                        />
                      </section>

                      {/* Save Button - Sticky on Mobile */}
                      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-border md:static md:border-t md:pt-6 md:mt-6 md:flex md:justify-end z-10">
                        <Button variant="secondary" size="sm" onClick={() => void handleSaveDetails()} disabled={detailsSaving} className="w-full md:w-auto">
                          {detailsSaving ? "Saving…" : "Save details"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {activeSection === "location" && renderLocationSection()}
            </div>
          </div>
        </div>
      </main>

      <Footer maxWidth="max-w-7xl" />

      {/* Status Modal */}
      <ListingStatusModal
        open={showStatusModal}
        onClose={handleCloseStatusModal}
        onSave={handleStatusSave}
        project={statusModalProject}
        companyPlan={companyPlan}
        selectedStatus={selectedStatus}
        onStatusChange={(value) => setSelectedStatus(value)}
        statusOptions={statusOptions}
        saveDisabled={!canSaveStatus}
        isPendingAdminReview={isPendingAdminReview}
        limitReachedForNewActivation={limitReachedForNewActivation}
        activeStatusValues={ACTIVE_STATUS_VALUES}
      />

      <Dialog open={showEditConfirmModal} onOpenChange={setShowEditConfirmModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit this listing?</DialogTitle>
          </DialogHeader>
          <p className="body-small text-text-secondary">
            Making edits will require admin approval again. The listing will be moved to draft status and needs to be reviewed before it can be published.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="tertiary"
              onClick={() => setShowEditConfirmModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleEditListing}
            >
              Continue editing
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isServiceModalOpen} onOpenChange={handleServiceModalOpenChange}>
        <DialogContent className="max-w-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Select professional services</DialogTitle>
          </DialogHeader>
          {professionalServices.length === 0 ? (
            <div className="rounded-md border border-border bg-surface p-4 body-small text-text-secondary">
              Professional services are not available right now. Please try again later.
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {professionalServices.map((service) => {
                  const isSelected = serviceSelectionDraft.includes(service.id)
                  const IconComponent = resolveProfessionalServiceIcon(service.slug, service.parentName)
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => toggleServiceInDraft(service.id)}
                      aria-pressed={isSelected}
                      className={`flex h-full flex-col rounded-lg border-2 p-4 text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-900/40 ${
                        isSelected ? "border-foreground bg-surface" : "border-border bg-white hover:border-border"
                      }`}
                    >
                      <IconComponent
                        aria-hidden
                        className={`mb-3 h-6 w-6 ${isSelected ? "text-foreground" : "text-foreground"}`}
                      />
                      <span className="mt-2 body-small font-medium text-foreground">{service.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-4 justify-end">
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => handleServiceModalOpenChange(false)}
              disabled={isUpdatingServices}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleSaveServiceSelection()}
              disabled={isUpdatingServices}
            >
              {isUpdatingServices ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteDialogOpen} onOpenChange={handleInviteDialogChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingInviteId ? "Update invite" : "Invite professional"}</DialogTitle>
            {inviteServiceId && (
              <p className="mt-1 body-small text-text-secondary">
                Service: {professionalServices.find(s => s.id === inviteServiceId)?.name}
              </p>
            )}
          </DialogHeader>
          {inviteError && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 body-small text-red-700">{inviteError}</div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="invite-email" className="mb-2 block body-small font-medium text-foreground">
                Company email address
              </label>
              <input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                disabled={isInviteMutating}
                placeholder="name@company.com"
                className={`body-small w-full rounded-md border px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900/40 ${
                  inviteError ? 'border-red-300' : 'border-border'
                } disabled:cursor-not-allowed disabled:opacity-50`}
              />
              {inviteError && (
                <p className="mt-2 body-small text-red-600">
                  {inviteError}
                </p>
              )}
              <p className="mt-2 body-small text-text-secondary">
                No invites are sent until the project is approved by Arco.
              </p>
            </div>
          </div>
          <div className="flex gap-3 pt-4 justify-end">
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => handleInviteDialogChange(false)}
              disabled={isInviteMutating}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleInviteSubmit()}
              disabled={isInviteMutating}
            >
              {isInviteMutating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add to project
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile Navigation Drawer */}
      <Dialog open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <DialogContent className="max-w-sm">
          <div className="space-y-4">
            {/* Navigation Items */}
            <div className="space-y-2">
              {sidebarItems.map((item) => {
                const IconComponent = item.icon
                const isActive = activeSection === item.id

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveSection(item.id)
                      setIsMobileMenuOpen(false)
                    }}
                    className={`body-small w-full flex items-center gap-3 px-[18px] py-3 rounded-full text-left transition-all font-medium ${
                      isActive ? "bg-quaternary text-quaternary-foreground" : "bg-transparent text-quaternary-foreground hover:bg-quaternary-hover"
                    }`}
                  >
                    <IconComponent className="w-5 h-5" />
                    <span>{item.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
