"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"
import Script from "next/script"
import {
  ChevronRight,
  ImageIcon,
  Users,
  FileText,
  MapPin,
  Trash2,
  Plus,
  MoreHorizontal,
  MailPlus,
  Pencil,
  Loader2,
  AlertCircle,
} from "lucide-react"
import { toast } from "sonner"
import { useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import ListingStatusModal, {
  type ListingStatusModalOption,
} from "@/components/listing-status-modal"
import { DashboardHeader } from "@/components/dashboard-header"
import { Footer } from "@/components/footer"
import { ProjectBasicsFields } from "@/components/project-details/project-basics-fields"
import { ProjectFeaturesFields } from "@/components/project-details/project-features-fields"
import { ProjectMetricsFields } from "@/components/project-details/project-metrics-fields"
import { ProjectNarrativeFields } from "@/components/project-details/project-narrative-fields"
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

type ProjectBudgetLevel = Enums<"project_budget_level">
type ProjectStatus = Enums<"project_status">
type ProjectLocationUpdate = Pick<
  TablesUpdate<"projects">,
  "address_formatted" | "address_city" | "address_region" | "latitude" | "longitude" | "share_exact_location" | "location"
>

const BLOCKED_EMAIL_DOMAINS = ["gmail.com", "hotmail.com", "yahoo.com", "outlook.com", "icloud.com"]
const EMAIL_REGEX = /^(?:[a-zA-Z0-9_'^&+-])+(?:\.(?:[a-zA-Z0-9_'^&+-])+)*@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/

const LISTING_STATUS_VALUES = ["published", "completed", "archived"] as const
type ListingStatusValue = (typeof LISTING_STATUS_VALUES)[number]
const ACTIVE_STATUS_VALUES: ReadonlyArray<ListingStatusValue> = ["published", "completed"]

const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "In progress",
  in_progress: "In review",
  published: "Live on page",
  completed: "Listed",
  archived: "Unlisted",
}

const PROJECT_STATUS_DOT_CLASS: Record<ProjectStatus, string> = {
  draft: "bg-amber-500",
  in_progress: "bg-blue-500",
  published: "bg-emerald-500",
  completed: "bg-teal-500",
  archived: "bg-slate-400",
}

const isListingStatusValue = (status: ProjectStatus | string): status is ListingStatusValue =>
  LISTING_STATUS_VALUES.includes(status as ListingStatusValue)

const LISTING_STATUS_MODAL_OPTIONS: ReadonlyArray<ListingStatusModalOption<ListingStatusValue>> = [
  {
    value: "published",
    label: "Live on page",
    description: "Appears on your company page",
    colorClass: "bg-emerald-500",
  },
  {
    value: "completed",
    label: "Listed",
    description: "Visible on the project page and searchable on Discover",
    colorClass: "bg-teal-500",
    requiresPlus: true,
  },
  {
    value: "archived",
    label: "Unlisted",
    description: "Hidden from the project page and your company page",
    colorClass: "bg-slate-400",
  },
]

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
      className: "bg-gray-100 text-gray-800",
    }
  }

  switch (invite.status) {
    case "invited":
      return { label: "Invite sent", className: "bg-amber-100 text-amber-800" }
    case "listed":
    case "live_on_page":
      return { label: "Listed", className: "bg-green-100 text-green-800" }
    case "unlisted":
      return { label: "Unlisted", className: "bg-gray-200 text-gray-700" }
    case "removed":
    case "rejected":
      return { label: invite.status === "removed" ? "Removed" : "Rejected", className: "bg-red-100 text-red-800" }
    default:
      return { label: invite.status.replace(/_/g, " "), className: "bg-gray-100 text-gray-800" }
  }
}

const sanitizeString = (value?: string | null) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

const extractCityAndRegion = (
  components: Array<{ long_name: string; short_name: string; types: string[] }> = [],
) => {
  let city = ""
  let region = ""

  for (const component of components) {
    if (!city && (component.types.includes("locality") || component.types.includes("postal_town"))) {
      city = component.long_name
    }

    if (
      !region &&
      (component.types.includes("administrative_area_level_1") ||
        component.types.includes("administrative_area_level_2"))
    ) {
      region = component.long_name
    }
  }

  return { city, region }
}

const buildLocationUpdate = (state: ProjectDetailsFormState): ProjectLocationUpdate => {
  const address = sanitizeString(state.address)
  const city = sanitizeString(state.city)
  const region = sanitizeString(state.region)
  const parts = [city, region].filter((value): value is string => Boolean(value))

  return {
    address_formatted: address,
    address_city: city,
    address_region: region,
    latitude: state.latitude,
    longitude: state.longitude,
    share_exact_location: state.shareExactLocation,
    location: parts.length ? parts.join(", ") : address,
  }
}

export default function ListingEditorPage() {
  const params = useParams()
  const [activeSection, setActiveSection] = useState("photo-tour")
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [currentStatusValue, setCurrentStatusValue] = useState<ListingStatusValue | "">("")
  const [selectedStatus, setSelectedStatus] = useState<ListingStatusValue | "">("")
  const [projectSlug, setProjectSlug] = useState<string | null>(null)
  const [projectStatus, setProjectStatus] = useState<ProjectStatus | null>(null)


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
    setTempCoverPhoto,
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
    }
  }, [
    detailsForm.city,
    detailsForm.projectStyle,
    detailsForm.projectTitle,
    detailsForm.region,
    getFeatureCoverPhoto,
    uploadedPhotos,
  ])

  const isPendingAdminReview = projectStatus === "in_progress"
  const limitReachedForNewActivation = false
  const canSaveStatus = Boolean(selectedStatus) && !isPendingAdminReview

  const currentFeatureDisplay = useMemo(
    () => (showPhotoSelector ? getFeatureDisplay(showPhotoSelector) : null),
    [getFeatureDisplay, showPhotoSelector],
  )

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
        setProjectStatus((project.status as ProjectStatus | null) ?? null)
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
      })

      mapInstanceRef.current = map

      const marker = new window.google.maps.Marker({
        map,
        position: startPosition,
        draggable: true,
      })

      markerRef.current = marker
      geocoderRef.current = new window.google.maps.Geocoder()

      marker.addListener("dragend", () => {
        const position = marker.getPosition()
        if (!position) {
          return
        }

        const lat = position.lat()
        const lng = position.lng()

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
            const { city, region } = extractCityAndRegion(primary.address_components ?? [])

            setDetailsForm((prev) => ({
              ...prev,
              address: formattedAddress,
              latitude: lat,
              longitude: lng,
              city,
              region,
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
        marker.setPosition(startPosition)
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
        const { city, region } = extractCityAndRegion(place.address_components ?? [])

        setDetailsForm((prev) => ({
          ...prev,
          address: formattedAddress,
          latitude: lat,
          longitude: lng,
          city,
          region,
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
          markerRef.current.setPosition({ lat, lng })
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
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [isInviteMutating, setIsInviteMutating] = useState(false)

  const sidebarItems = [
    { id: "photo-tour", name: "Photo tour", icon: ImageIcon },
    { id: "professionals", name: "Professionals", icon: Users },
    { id: "details", name: "Details", icon: FileText },
    { id: "location", name: "Location", icon: MapPin },
  ]

  const statusOptions = LISTING_STATUS_MODAL_OPTIONS
  const companyPlan: "basic" | "plus" = "basic"

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
    return "bg-gray-400"
  }, [currentStatusValue, projectStatus, statusOptionByValue])

  const loadProfessionalServiceOptions = useCallback(async () => {
    const { data: childRows, error: childError } = await supabase
      .from("categories")
      .select("id, name, parent_id, sort_order")
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
        return
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
  }, [applyProfessionalSectionData, fetchProfessionalSectionData, hasProjectAccess, projectId])

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
    setInviteDialogOpen(open)
    if (!open) {
      setInviteServiceId(null)
      setInviteEmail("")
      setEditingInviteId(null)
      setInviteError(null)
    }
  }

  const openInviteModal = (serviceId: string, invite?: ProfessionalInviteSummary) => {
    if (!invite) {
      const existingInvites = professionalInvites[serviceId] ?? []
      if (existingInvites.length > 0) {
        setInviteError("Only one professional can be invited per service. Remove the existing invite to add another.")
        return
      }
    }

    setInviteServiceId(serviceId)
    setInviteEmail(invite?.email ?? "")
    setEditingInviteId(invite?.id ?? null)
    setInviteError(null)
    setInviteDialogOpen(true)
  }

  const handleInviteSubmit = async () => {
    if (!projectId || !inviteServiceId || isInviteMutating) {
      return
    }

    if (!isUuid(inviteServiceId)) {
      setInviteError("Please select a professional service from the Arco catalog to send invites.")
      return
    }

    const trimmedEmail = inviteEmail.trim()

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setInviteError("Please enter a valid company email address.")
      return
    }

    const domain = getDomain(trimmedEmail)
    if (domain && BLOCKED_EMAIL_DOMAINS.includes(domain)) {
      setInviteError("Please use a company email address (personal domains are not allowed).")
      return
    }

    if (!editingInviteId) {
      const existingInvites = professionalInvites[inviteServiceId] ?? []
      if (existingInvites.length > 0) {
        setInviteError("Only one professional can be invited per service. Remove the existing invite to add another.")
        return
      }
    }

    setInviteError(null)
    setIsInviteMutating(true)

    try {
      if (editingInviteId) {
        const { error, data } = await supabase
          .from("project_professionals")
          .update({ invited_email: trimmedEmail })
          .eq("id", editingInviteId)
          .select(
            "id, invited_email, invited_service_category_id, status, is_project_owner, invited_at, responded_at, professional_id",
          )
          .maybeSingle()

        if (error || !data) {
          throw error ?? new Error("Invite could not be updated.")
        }
      } else {
        const { error, data } = await supabase
          .from("project_professionals")
          .insert({
            project_id: projectId,
            invited_email: trimmedEmail,
            invited_service_category_id: inviteServiceId,
            status: "invited",
          })
          .select(
            "id, invited_email, invited_service_category_id, status, is_project_owner, invited_at, responded_at, professional_id",
          )
          .maybeSingle()

        if (error || !data) {
          throw error ?? new Error("Invite could not be saved.")
        }
      }

      await refreshProfessionalSection()
      handleInviteDialogChange(false)
    } catch (error) {
      setInviteError(
        error instanceof Error ? error.message : "We couldn't send that invite. Please try again.",
      )
    } finally {
      setIsInviteMutating(false)
    }
  }

  const handleDeleteInvite = async (invite: ProfessionalInviteSummary) => {
    if (isInviteMutating) {
      return
    }

    if (invite.isOwner) {
      setInviteError("You cannot remove the listing owner from this project.")
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
        <div className="rounded-md border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          You need access to this project to manage its photo tour.
        </div>
      )
    }

    if (!projectId) {
      return (
        <div className="py-16 text-center text-sm text-gray-500">
          Select a project to manage its photo tour.
        </div>
      )
    }

    if (isLoadingProject) {
      return <div className="py-16 text-center text-sm text-gray-500">Loading project photos…</div>
    }

    if (photoProjectLoadError) {
      return (
        <div className="rounded-md border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {photoProjectLoadError}
        </div>
      )
    }

    const photosRemaining = Math.max(0, MIN_PHOTOS_REQUIRED - uploadedPhotos.length)
    const progressLabel =
      photosRemaining > 0
        ? `${photosRemaining} more photo${photosRemaining === 1 ? "" : "s"} needed`
        : "Minimum met — add more to showcase your project"

    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Photo tour</h2>
            <p className="text-sm text-gray-500">
              Add photos for every feature. Only features with photos appear on the published page.
            </p>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowAddMenu((state) => !state)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-white transition-colors hover:bg-gray-800"
              aria-haspopup="menu"
              aria-expanded={showAddMenu}
            >
              <span className="text-xl font-light">+</span>
            </button>

            {showAddMenu && (
              <div className="absolute top-12 right-0 z-10 min-w-[160px] rounded-lg border border-gray-200 bg-white py-2 shadow-lg">
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
                    className={`block px-4 py-2 text-sm transition-colors ${
                      isUploading ? "cursor-not-allowed text-gray-400" : "text-gray-700 hover:bg-gray-50"
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
                  className={`block w-full px-4 py-2 text-left text-sm transition-colors ${
                    isSavingFeatures ? "cursor-not-allowed text-gray-400" : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {isSavingFeatures ? "Saving…" : "Add feature"}
                </button>
              </div>
            )}
          </div>
        </div>

        <section className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Photo categories</h3>
              <p className="text-sm text-gray-500">Choose a category to add or manage photos.</p>
            </div>
          </div>

          {featureMutationError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {featureMutationError}
            </div>
          )}

          {featureError && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {featureError}
            </div>
          )}

          {isLoadingFeatures ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-32 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {displayFeatureIds.map((featureId) => {
                const featureDisplay = getFeatureDisplay(featureId)
                const FeatureIcon = featureDisplay.icon
                const photoCount = getFeaturePhotoCount(featureId)
                const coverPhoto = getFeatureCoverPhoto(featureId)

                return (
                  <div key={featureId} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                    <button
                      onClick={() => openPhotoSelector(featureId)}
                      className="w-full text-left transition-colors hover:bg-gray-50"
                    >
                      <div className="relative aspect-square bg-gray-100">
                        {coverPhoto ? (
                          <img
                            src={coverPhoto || "/placeholder.svg"}
                            alt={featureDisplay.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center">
                            <ImageIcon className="mb-4 h-12 w-12 text-gray-400" />
                            <span className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors">
                              Select photos
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="p-4">
                        <div className="mb-1 flex items-center gap-2">
                          <FeatureIcon className="h-4 w-4 text-gray-600" />
                          <h3 className="font-medium text-gray-900">{featureDisplay.name}</h3>
                        </div>
                        <p className="text-sm text-gray-500">
                          {photoCount > 0 ? `${photoCount} photo${photoCount === 1 ? "" : "s"}` : "Add photos"}
                        </p>
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">All photos</h3>
              <p className="text-sm text-gray-500">
                {uploadedPhotos.length} uploaded · {progressLabel}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div
              className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                dragOver ? "border-gray-400 bg-gray-50" : "border-gray-300"
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <ImageIcon className="mx-auto mb-3 h-8 w-8 text-gray-400" />
              <p className="font-medium text-gray-900">Drag and drop</p>
              <p className="mb-4 text-sm text-gray-500">or browse for photos</p>
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
                  className={`rounded-md px-6 py-2 text-sm font-medium text-white transition-colors ${
                    isUploading ? "cursor-not-allowed bg-gray-600" : "bg-gray-900 hover:bg-gray-800"
                  }`}
                >
                  {isUploading ? "Uploading…" : "Browse"}
                </span>
              </label>
              {uploadErrors.length > 0 && (
                <ul className="mt-4 space-y-1 text-left text-sm text-red-600">
                  {uploadErrors.map((error, index) => (
                    <li key={`${error}-${index}`}>{error}</li>
                  ))}
                </ul>
              )}
            </div>

            {uploadedPhotos.map((photo) => (
              <div
                key={photo.id}
                className="group relative"
                draggable
                onDragStart={(event) => handlePhotoDragStart(event, photo.id)}
                onDragOver={handlePhotoDragOver}
                onDrop={(event) => handlePhotoDropOnCard(event, photo.id)}
                onDragEnd={handlePhotoDragEnd}
              >
                <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
                  <img src={photo.url || "/placeholder.svg"} alt="Project photo" className="h-full w-full object-cover" />
                </div>

                {photo.isCover && (
                  <div className="absolute left-2 top-2 rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white">
                    Cover photo
                  </div>
                )}

                <div className="absolute right-2 top-2">
                  <button
                    onClick={() => setOpenMenuId(openMenuId === photo.id ? null : photo.id)}
                    className="rounded-full bg-white p-1 shadow-md transition-colors hover:bg-gray-50"
                  >
                    <MoreHorizontal className="h-4 w-4 text-gray-600" />
                  </button>

                  {openMenuId === photo.id && (
                    <div className="absolute right-0 top-8 min-w-[160px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                      <button
                        onClick={() => setCoverPhoto(photo.id)}
                        className="block w-full px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        Set as cover photo
                      </button>
                      <button
                        onClick={() => deletePhoto(photo.id)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {showAddFeatureModal && (
          <div className={OVERLAY_CLASSES}>
            <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white">
              <div className="flex items-center justify-between border-b border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900">Add feature</h2>
                <button
                  onClick={() => {
                    setShowAddFeatureModal(false)
                    setTempSelectedFeatures([])
                  }}
                  className="text-2xl leading-none text-gray-400 transition-colors hover:text-gray-600"
                >
                  ×
                </button>
              </div>

              <div className="p-6">
                {isLoadingFeatures ? (
                  <div className="mb-6 grid grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="h-24 rounded-lg border-2 border-dashed border-gray-200 animate-pulse" />
                    ))}
                  </div>
                ) : orderedFeatureOptions.length === 0 ? (
                  <div className="mb-6 rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                    No feature taxonomy available yet. Try again later.
                  </div>
                ) : (
                  <div className="mb-6 grid grid-cols-3 gap-4">
                    {orderedFeatureOptions.map((feature) => {
                      const display = getFeatureDisplay(feature.id)
                      const IconComponent = display.icon
                      const isSelected = tempSelectedFeatures.includes(feature.id)
                      const isAlreadyAdded = selectedFeatures.includes(feature.id)

                      return (
                        <button
                          key={feature.id}
                          onClick={() => !isAlreadyAdded && toggleTempFeature(feature.id)}
                          disabled={isAlreadyAdded || isSavingFeatures}
                          className={`rounded-lg border-2 p-4 text-left transition-all ${
                            isAlreadyAdded
                              ? "cursor-not-allowed border-gray-200 bg-gray-100 opacity-50"
                              : isSelected
                                ? "border-gray-900 bg-gray-50"
                                : "border-gray-200 bg-white hover:border-gray-300"
                          }`}
                        >
                          <IconComponent className="mb-2 h-6 w-6 text-gray-700" />
                          <p className="text-sm font-medium text-gray-900">{display.name}</p>
                        </button>
                      )
                    })}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowAddFeatureModal(false)
                      setTempSelectedFeatures([])
                    }}
                    className="flex-1 rounded-md border border-gray-300 px-6 py-3 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void saveNewFeatures()}
                    disabled={tempSelectedFeatures.length === 0 || isSavingFeatures}
                    className="flex-1 rounded-md bg-gray-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingFeatures ? "Adding…" : "Add selected"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showPhotoSelector && (
          <div className={OVERLAY_CLASSES}>
            <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-lg bg-white">
              <div className="flex items-center justify-between border-b border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Select photos for {currentFeatureDisplay?.name ?? "feature"}
                </h2>
                <div className="flex items-center gap-3">
                  {![
                    BUILDING_FEATURE_ID,
                    ADDITIONAL_FEATURE_ID,
                  ].includes(showPhotoSelector) && (
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
                            This will remove {currentFeatureDisplay?.name ?? "this feature"} and unassign its photos from
                            the project. You can add it again later if needed.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-700"
                            onClick={() => void deleteFeature(showPhotoSelector)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </ConfirmationDialogContent>
                    </AlertDialog>
                  )}
                  <button onClick={cancelPhotoSelection} className="text-2xl leading-none text-gray-400 hover:text-gray-600">
                    ×
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div
                  className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                    modalDragOver ? "border-gray-400 bg-gray-50" : "border-gray-300"
                  }`}
                  onDrop={handleModalDrop}
                  onDragOver={handleModalDragOver}
                  onDragLeave={handleModalDragLeave}
                >
                  <ImageIcon className="mx-auto mb-3 h-8 w-8 text-gray-400" />
                  <p className="font-medium text-gray-900">Upload new photos</p>
                  <p className="mb-4 text-sm text-gray-500">Drag and drop or browse for photos</p>
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
                      className={`rounded-md px-4 py-2 text-sm font-medium text-white transition-colors ${
                        isUploading ? "cursor-not-allowed bg-gray-600" : "bg-gray-900 hover:bg-gray-800"
                      }`}
                    >
                      {isUploading ? "Uploading…" : "Browse Files"}
                    </span>
                  </label>
                </div>

                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Select from existing photos</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      {tempCoverPhoto && <span className="font-medium text-blue-600">Cover photo selected</span>}
                      <span>{tempSelectedPhotos.length} selected</span>
                    </div>
                  </div>

                  {selectablePhotos.length === 0 ? (
                    <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
                      {uploadedPhotos.length === 0
                        ? "Upload photos to get started"
                        : "All photos are assigned. Upload more to add to this feature."}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
                      {selectablePhotos.map((photo) => {
                        const isSelected = tempSelectedPhotos.includes(photo.id)
                        const isCoverPhoto = tempCoverPhoto === photo.id

                        return (
                          <div key={photo.id} className="relative">
                            <button
                              onClick={() => toggleTempPhoto(photo.id)}
                              className={`relative block aspect-square w-full overflow-hidden rounded-lg border-2 transition-all ${
                                isSelected
                                  ? "border-gray-900 ring-2 ring-gray-900 ring-offset-2"
                                  : "border-gray-200 hover:border-gray-300"
                              }`}
                            >
                              <img
                                src={photo.url || "/placeholder.svg"}
                                alt="Project photo"
                                className="h-full w-full object-cover"
                              />
                              {isSelected && (
                                <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-sm font-medium text-white shadow">
                                  ✓
                                </div>
                              )}
                              {isCoverPhoto && (
                                <div className="absolute left-2 top-2 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white">
                                  Cover
                                </div>
                              )}
                            </button>

                            {isSelected && !isCoverPhoto && (
                              <button
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setTempCoverPhoto(photo.id)
                                }}
                                className="absolute left-2 right-2 bottom-2 rounded py-1 px-2 text-xs font-medium transition-colors border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                              >
                                Set as cover
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

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
                          onClick={() => resetModalUploadErrors()}
                          className="inline-flex items-center font-medium text-red-700 transition-colors hover:text-red-800"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={cancelPhotoSelection}
                    className="flex-1 rounded-md border border-gray-300 px-6 py-3 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void saveSelectedPhotos()}
                    disabled={isSavingSelection || tempSelectedPhotos.length === 0}
                    className="flex-1 rounded-md bg-gray-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingSelection ? "Saving…" : "Save selection"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Location section render function
  const renderLocationSection = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl text-gray-900 font-medium">Location</h2>
        <p className="text-gray-500 mt-1">Where is the project located?</p>
      </div>

      <div className="space-y-8">
        {/* Map Container */}
        <div className="relative">
          {googleMapsApiKey ? (
            <>
              <Script
                src={`https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places`}
                strategy="lazyOnload"
                onLoad={() => {
                  if (window.google?.maps) {
                    setIsMapsApiLoaded(true)
                    setMapsError(null)
                  } else {
                    setMapsError("Google Maps failed to initialize. Refresh the page to try again.")
                  }
                }}
                onError={() => setMapsError("We couldn't load Google Maps. Check your connection and try again.")}
              />
              <div className="relative w-full h-96 bg-gray-100 rounded-lg overflow-hidden">
                <div ref={mapContainerRef} className="h-full w-full" />
                <div className="pointer-events-none absolute top-4 left-0 right-0 z-10 flex justify-center px-4">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={addressInputValue}
                    onChange={(event) => handleLocationInputChange("address", event.target.value)}
                    placeholder="Search for your address"
                    className="pointer-events-auto w-full max-w-xl px-4 py-3 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent hover:border-gray-400 transition-colors"
                  />
                </div>
                {!isMapsApiLoaded && !mapsError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60 text-gray-700">
                    Loading map...
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                Add your Google Maps API key to `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to enable address autocomplete and map
                selection.
              </div>
              <input
                type="text"
                value={addressInputValue}
                onChange={(event) => handleLocationInputChange("address", event.target.value)}
                placeholder="Enter your project address"
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent hover:border-gray-400 transition-colors"
              />
            </div>
          )}
          <p className="text-sm text-gray-500 mt-2">
            Search for your project location or drag the pin on the map to fine-tune it
          </p>
          {mapsError && <p className="text-sm text-red-600 mt-2">{mapsError}</p>}
          {detailsErrors.address && <p className="text-sm text-red-600 mt-2">{detailsErrors.address}</p>}
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-900">Selected address</p>
            <p className="mt-1 text-sm text-gray-700">
              {detailsForm.address
                ? detailsForm.address
                : "Start typing in the search box or drag the map pin to capture the address."}
            </p>
          </div>
        </div>

        {/* Share exact location toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <h3 className="text-base font-medium text-gray-900 mb-1">Share the exact location of the project</h3>
            <p className="text-sm text-gray-500">Allow others to see the precise location of your project</p>
          </div>
          <button
            type="button"
            onClick={() => handleLocationToggleChange("shareExactLocation", !detailsForm.shareExactLocation)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 ${
              detailsForm.shareExactLocation ? "bg-gray-900" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                detailsForm.shareExactLocation ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => void handleSaveLocation()} disabled={locationSaving}>
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
        parentName: null,
        parentSortOrder: null,
        sortOrder: null,
      }
    })

    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-medium text-gray-900">Professionals</h2>
            <p className="mt-1 text-gray-500">Manage the professional services linked to this project.</p>
          </div>
          <button
            type="button"
            onClick={openServiceModal}
            aria-label="Manage professional services"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-white transition-colors hover:bg-gray-800"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        {professionalsError && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {professionalsError}
          </div>
        )}

        {inviteError && !inviteDialogOpen && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{inviteError}</div>
        )}

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Professional services</h3>
              <p className="text-sm text-gray-500">
                Choose which professional services contributed to this project to invite collaborators.
              </p>
            </div>
            <button
              type="button"
              onClick={openServiceModal}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <Plus className="h-4 w-4" />
              Manage services
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {selectedServices.length > 0 ? (
              selectedServices.map((service) => (
                <span key={service.id} className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
                  {service.name}
                </span>
              ))
            ) : (
              <span className="text-sm text-gray-600">No professional services selected yet.</span>
            )}
          </div>
        </div>

        {professionalsLoading ? (
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading professionals…
          </div>
        ) : (
          <div className="space-y-6">
            {projectOwnerInvite && (
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Listing owner</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900">
                      {projectOwnerInvite.companyName ?? projectOwnerInvite.email}
                    </p>
                    {projectOwnerInvite.primaryService && (
                      <p className="text-sm text-gray-600">{projectOwnerInvite.primaryService}</p>
                    )}
                  </div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">
                    Listing owner
                  </span>
                </div>
              </div>
            )}

            {selectedServices.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600">
                Add a professional service to invite collaborators to this project.
              </div>
            ) : (
              selectedServices.map((service) => {
                const invites = professionalInvites[service.id] ?? []
                return (
                  <div key={service.id} className="rounded-lg border border-gray-200 bg-white p-6">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">
                          {service.parentName ?? "Professional service"}
                        </p>
                        <h3 className="text-lg font-semibold text-gray-900">{service.name}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {invites.length === 0 && (
                          <button
                            type="button"
                            onClick={() => openInviteModal(service.id)}
                            disabled={isInviteMutating}
                            className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <MailPlus className="h-4 w-4" />
                            Invite
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveService(service.id)}
                          disabled={isUpdatingServices}
                          className="rounded-md border border-gray-300 p-2 text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {invites.length === 0 ? (
                      <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                        No professionals invited yet for this service.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {invites.map((invite) => {
                          const statusMeta = getInviteStatusMeta(invite)
                          return (
                            <div
                              key={invite.id}
                              className="flex items-center justify-between rounded-md border border-gray-200 p-4"
                            >
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {invite.companyName ?? invite.email}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {invite.companyName ? invite.email : "Invite pending"}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-medium ${statusMeta.className}`}
                                >
                                  {statusMeta.label}
                                </span>
                                {!invite.isOwner && (
                                  <>
                                    {invite.status === "invited" && (
                                      <button
                                        type="button"
                                        onClick={() => openInviteModal(service.id, invite)}
                                        disabled={isInviteMutating}
                                        className="rounded-md border border-gray-300 p-2 text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteInvite(invite)}
                                      disabled={isInviteMutating}
                                      className="rounded-md border border-gray-300 p-2 text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <DashboardHeader />

      <div className="flex-1 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex">
            {/* Sidebar */}
            <div className="w-64 bg-white border-r border-gray-200 p-6">
              <div className="space-y-6">
                {/* Status Selector */}
                <div>
                  <button
                    onClick={() => setShowStatusModal(true)}
                    className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${statusIndicatorClass}`} />
                        <span className="font-medium text-gray-900">{currentStatusLabel}</span>
                      </div>
                      <p className="text-sm text-red-500 mt-1">List your project</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                {/* Preview listing */}
                <div>
                  <Button variant="outline" className="w-full" onClick={handlePreviewListing}>
                    Preview listing
                  </Button>
                </div>

                {/* Navigation Items */}
                <div className="space-y-2">
                  {sidebarItems.map((item) => {
                    const IconComponent = item.icon
                    const isActive = activeSection === item.id

                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                          isActive ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        }`}
                      >
                        <IconComponent className="w-5 h-5" />
                        <span className="font-medium">{item.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-8">
              {activeSection === "photo-tour" && renderPhotoTourSection()}
              {activeSection === "professionals" && renderProfessionalsSection()}
              {activeSection === "details" && (
                <div className="space-y-8">
                  {detailsFeedback && (
                    <div
                      className={`rounded-md border p-4 text-sm ${
                        detailsFeedback.type === "success"
                          ? "border-green-200 bg-green-50 text-green-700"
                          : "border-red-200 bg-red-50 text-red-700"
                      }`}
                    >
                      {detailsFeedback.message}
                    </div>
                  )}

                  {detailsLoadError && !detailsLoading ? (
                    <div className="rounded-md border border-red-200 bg-red-50 p-6 text-sm text-red-700">
                      {detailsLoadError}
                    </div>
                  ) : detailsLoading ? (
                    <div className="py-12 text-center text-gray-500">Loading project details…</div>
                  ) : (
                    <div className="space-y-12">
                      <section className="space-y-6">
                        <div>
                          <h2 className="text-2xl font-semibold text-gray-900">Project basics</h2>
                          <p className="text-sm text-gray-500">
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
                          <h2 className="text-2xl font-semibold text-gray-900">Features</h2>
                          <p className="text-sm text-gray-500">
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
                          <h2 className="text-2xl font-semibold text-gray-900">Project metrics</h2>
                          <p className="text-sm text-gray-500">
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
                          <h2 className="text-2xl font-semibold text-gray-900">Storytelling</h2>
                          <p className="text-sm text-gray-500">
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

                      <div className="flex flex-col gap-4 border-t border-gray-200 pt-6 md:flex-row md:items-center md:justify-between">
                        <span className="text-sm text-gray-500">{detailsLastSavedLabel}</span>
                        <Button onClick={() => void handleSaveDetails()} disabled={detailsSaving} className="md:w-auto">
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
      </div>

      <Footer />

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

      <Dialog open={isServiceModalOpen} onOpenChange={handleServiceModalOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Select professional services</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto">
            {professionalServices.length === 0 ? (
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                Professional services are not available right now. Please try again later.
              </div>
            ) : (
              professionalServices.map((service) => {
                const isSelected = serviceSelectionDraft.includes(service.id)
                const parentLabel = service.parentName ?? "Professional service"
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => toggleServiceInDraft(service.id)}
                    className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
                      isSelected ? "border-gray-900 bg-gray-50" : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <span className="block text-xs uppercase tracking-wide text-gray-500">{parentLabel}</span>
                    <span className="mt-2 block text-base font-medium text-gray-900">{service.name}</span>
                  </button>
                )
              })
            )}
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => handleServiceModalOpenChange(false)}
              className="flex-1"
              disabled={isUpdatingServices}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleSaveServiceSelection()} disabled={isUpdatingServices} className="flex-1">
              {isUpdatingServices ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteDialogOpen} onOpenChange={handleInviteDialogChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingInviteId ? "Edit invite" : "Invite a professional"}</DialogTitle>
          </DialogHeader>
          {inviteError && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{inviteError}</div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="invite-email" className="mb-2 block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                disabled={isInviteMutating}
                placeholder="company@example.com"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => handleInviteDialogChange(false)}
              className="flex-1"
              disabled={isInviteMutating}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleInviteSubmit()} disabled={isInviteMutating} className="flex-1">
              {isInviteMutating ? "Sending…" : editingInviteId ? "Update invite" : "Send invite"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
