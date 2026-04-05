"use client"

import type React from "react"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  ChevronLeft,
  ChevronRight,
  Grid3x3,
  ImageIcon,
  Users,
  FileText,
  MapPin,
  Trash2,
  Plus,
  MoreHorizontal,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Menu,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import { Button } from "@/components/ui/button"
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
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_DOT_CLASS,
} from "@/lib/project-status-config"
import {
  type ContributorStatus,
  CONTRIBUTOR_STATUS_LABELS,
  CONTRIBUTOR_STATUS_DOT_CLASS,
  OWNER_STATUS_OPTIONS,
} from "@/lib/contributor-status-config"
import { setProjectStatusAction } from "@/app/admin/projects/actions"
import { useLocale } from "next-intl"
import { regenerateDescription, saveProjectTranslatedField } from "@/app/new-project/import/actions"
import { getProjectTranslation } from "@/lib/project-translations"
import { syncCompanyListedStatus } from "@/app/admin/projects/actions"
import { Header } from "@/components/header"
import { EditSubNav } from "@/components/project/edit-sub-nav"
import { Footer } from "@/components/footer"
import { ProjectBasicsFields } from "@/components/project-details/project-basics-fields"
import { ProjectFeaturesFields } from "@/components/project-details/project-features-fields"
import { ProjectMetricsFields } from "@/components/project-details/project-metrics-fields"
import { ProjectNarrativeFields } from "@/components/project-details/project-narrative-fields"
import { ProfessionalServiceCard } from "@/components/project-professional-service-card"
import { FeaturePhotoSelectorModal } from "@/components/feature-photo-selector-modal"
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
  resolveProjectDetailsIcon,
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
  type FeatureOption,
  type UploadedPhoto,
} from "@/hooks/use-project-photo-tour"
import { resolveFeatureIcon } from "@/lib/icons/project-features"
import { SUBTYPE_ICON_MAP } from "@/components/filter-icon-map"
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
import { createUnlistedCompanyAction, confirmLinkExistingCompanyAction, sendInviteEmailAction, getCompanyOwnerEmailAction } from "@/app/dashboard/edit/actions"
import { enrichCompanyAction } from "@/app/dashboard/edit/enrich-company-actions"
import { isAdminUser } from "@/lib/auth-utils"
import { trackProjectPublished, trackProfessionalInvited } from "@/lib/tracking"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { MailPlus, Pencil, RotateCw, XCircle } from "lucide-react"

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

/** Resize an input to fit its value (or placeholder) exactly */
const autoSizeInput = (el: HTMLInputElement) => {
  const text = el.value || el.placeholder || ""
  const span = document.createElement("span")
  span.style.cssText = "position:absolute;visibility:hidden;white-space:pre;font:inherit"
  el.parentElement?.appendChild(span)
  span.textContent = text
  el.style.width = `${span.offsetWidth + 1}px`
  span.remove()
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
  serviceIds: string[]
  email: string
  status: ProjectProfessionalRow["status"]
  isOwner: boolean
  invitedAt: string
  respondedAt: string | null
  professionalId: string | null
  companyId: string | null
  companyName: string | null
  companyLogo: string | null
  primaryService: string | null
  projectsCount: number
  isListedCompany: boolean
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

const SCOPE_OPTIONS = ["New Build", "Renovation", "Interior Design"]

const getSubtypeIconForSlug = (slug?: string | null) => {
  if (!slug) return null
  const key = slug.trim().toLowerCase()
  const Icon = SUBTYPE_ICON_MAP[key]
  return Icon ?? null
}

const resolveIconForFeatureOption = (feature?: FeatureOption | null) => {
  if (!feature) return Grid3x3
  const subtypeIcon = getSubtypeIconForSlug(feature.slug)
  if (subtypeIcon) return subtypeIcon
  if (feature.iconKey) {
    const icon = resolveProjectDetailsIcon(feature.iconKey)
    if (icon) return icon
  }
  return resolveFeatureIcon(feature.slug)
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
      return { label: "Unlisted", className: "bg-gray-100 text-gray-500" }
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

/* ────────────────────────────────────────────────────────────────
   EditableTitle — isolated from parent re-renders so the browser's
   native contentEditable behaviour (cursor, selection, double-click)
   is never interrupted by React reconciliation.
   ──────────────────────────────────────────────────────────────── */
const EditableTitle = memo(function EditableTitle({
  initialValue,
  onSave,
}: {
  initialValue: string
  onSave: (value: string) => void
}) {
  const ecRef = useRef<HTMLDivElement>(null)
  const elRef = useRef<HTMLHeadingElement>(null)
  const savedValueRef = useRef(initialValue)

  // Set initial content once the DOM is ready
  useEffect(() => {
    if (elRef.current && initialValue && !elRef.current.textContent) {
      elRef.current.textContent = initialValue
      savedValueRef.current = initialValue
    }
  }, [initialValue])

  return (
    <div
      ref={ecRef}
      className="ec"
      style={{ display: "inline-block", width: "100%", marginBottom: 24 }}
    >
      <span className="ec-badge">
        <span className="ec-ico">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ display: "inline-block", flexShrink: 0 }}>
            <path d="M11.5 1.5l3 3L5 14H2v-3z" />
          </svg>
        </span>
        <span className="ec-txt">Edit</span>
      </span>
      <h1
        ref={elRef}
        className="arco-page-title"
        contentEditable
        suppressContentEditableWarning
        onFocus={() => ecRef.current?.classList.add("on")}
        onBlur={() => {
          ecRef.current?.classList.remove("on")
          const val = elRef.current?.textContent?.trim() ?? ""
          if (val && val !== savedValueRef.current) {
            savedValueRef.current = val
            onSave(val)
          }
        }}
        style={{ cursor: "text", outline: "none" }}
        data-placeholder="Project title"
      />
    </div>
  )
})

const REJECTION_REASONS = [
  "Not a residential project",
  "Insufficient photos",
  "Low quality images",
  "Missing project details",
  "Duplicate project",
  "Inappropriate content",
  "Not architecture or interior design",
]

export default function ListingEditorPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const locale = useLocale()
  const importToastFiredRef = useRef(false)
  const [activeSection, setActiveSection] = useState("location")
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [currentStatusValue, setCurrentStatusValue] = useState<ContributorStatus | "">("")
  const [selectedStatus, setSelectedStatus] = useState<ContributorStatus | "">("")
  const [projectSlug, setProjectSlug] = useState<string | null>(null)
  const [projectStatus, setProjectStatus] = useState<ProjectStatus | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [showEditConfirmModal, setShowEditConfirmModal] = useState(false)

  // ── Admin review mode ──────────────────────────────────────────────────────
  const isAdminReview = searchParams.get("review") === "1"
  const [isAdmin, setIsAdmin] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [selectedRejectionReasons, setSelectedRejectionReasons] = useState<string[]>([])
  const [isRejecting, setIsRejecting] = useState(false)
  const [reviewQueue, setReviewQueue] = useState<string[]>([])

  // ── Delete project ─────────────────────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeletingProject, setIsDeletingProject] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")

  // ── New state for redesigned layout ───────────────────────────────────────
  // activeEditField state removed — title/desc .ec "on" class is now managed
  // imperatively via refs to avoid re-renders that disrupt cursor/selection.
  const [editSaveStatus, setEditSaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [activeEditFeature, setActiveEditFeature] = useState<string | null>(null)
  const [photoMoveMenuId, setPhotoMoveMenuId] = useState<string | null>(null)
  const [photoDeleteConfirmId, setPhotoDeleteConfirmId] = useState<string | null>(null)
  const photoDragItemRef = useRef<string | null>(null)
  const photoDragOverRef = useRef<string | null>(null)
  const uploadToastIdRef = useRef<string | number | null>(null)
  const uploadFileCountRef = useRef(0)
  const prevIsUploadingRef = useRef(false)
  const [showCoverPicker, setShowCoverPicker] = useState(false)
  const [editingSpecBar, setEditingSpecBar] = useState<string | null>(null)
  const [specScope, setSpecScope] = useState("")

  // City lookup state (specs bar location)
  const [cityQuery, setCityQuery] = useState("")
  const [cityResults, setCityResults] = useState<Array<{ placeId: string; mainText: string; secondaryText: string }>>([])
  const [isCitySearching, setIsCitySearching] = useState(false)
  const citySearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cityServiceRef = useRef<any>(null)
  const descEditRef = useRef<HTMLParagraphElement>(null)
  const descEcRef = useRef<HTMLDivElement>(null)
  const editSaveTimerRef = useRef<ReturnType<typeof setTimeout>>()


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
  const [isSubmittingForReview, setIsSubmittingForReview] = useState(false)
  const [generatingDesc, setGeneratingDesc] = useState(false)
  const [descCharCount, setDescCharCount] = useState(() => (detailsForm.projectDescription ?? "").length)
  const [descEditing, setDescEditing] = useState(false)
  const autoGenerateDescTriggered = useRef(false)
  const [showSubmitReviewPopup, setShowSubmitReviewPopup] = useState(false)
  const [highlightMissingFields, setHighlightMissingFields] = useState(false)

  const {
    uploadedPhotos,
    featurePhotos,
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
    movePhotoToSpace,
    tempSelectedPhotos,
    setTempSelectedPhotos,
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
    reorderFeaturePhotos,
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
    () => OWNER_STATUS_OPTIONS.find((option) => option.value === selectedStatus),
    [selectedStatus],
  )
  const canSaveStatus = Boolean(selectedStatusOption) && !isPendingAdminReview

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


  // Load the owner's project_professionals status for the status modal
  useEffect(() => {
    if (!projectId || !userId) return
    let cancelled = false
    const loadOwnerPPStatus = async () => {
      const { data } = await supabase
        .from("project_professionals")
        .select("status")
        .eq("project_id", projectId)
        .eq("is_project_owner", true)
        .maybeSingle()
      if (!cancelled && data?.status) {
        const ppStatus = data.status as ContributorStatus
        setCurrentStatusValue(ppStatus)
        setSelectedStatus(ppStatus)
      }
    }
    void loadOwnerPPStatus()
    return () => { cancelled = true }
  }, [projectId, userId, supabase])

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

  // ── Admin review: check admin status and load review queue ─────────────────
  useEffect(() => {
    if (!isAdminReview || !userId) return
    let cancelled = false
    const loadAdminReviewData = async () => {
      // Check admin
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_types")
        .eq("id", userId)
        .maybeSingle()
      const types = (profile as any)?.user_types as string[] | null
      if (!cancelled) setIsAdmin(Array.isArray(types) && types.includes("admin"))

      // Load review queue (all in_progress projects)
      const { data: reviewProjects } = await supabase
        .from("projects")
        .select("id")
        .eq("status", "in_progress")
        .order("created_at", { ascending: true })
      if (!cancelled && reviewProjects) {
        setReviewQueue(reviewProjects.map((p) => p.id))
      }
    }
    void loadAdminReviewData()
    return () => { cancelled = true }
  }, [isAdminReview, userId, supabase])

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
          "id, client_id, title, description, translations, project_type, project_type_category_id, building_type, project_size, budget_level, project_year, building_year, style_preferences, address_formatted, address_city, address_region, latitude, longitude, share_exact_location, updated_at, status, slug",
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

      // Check access: admin, project owner (client_id),
      // or their company is linked as project owner via project_professionals
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("user_types")
        .eq("id", userId)
        .maybeSingle()

      let hasAccess = isAdminUser(userProfile?.user_types) || project.client_id === userId
      if (!hasAccess) {
        // Check if user's company owns this project
        const { data: proData } = await supabase
          .from("professionals")
          .select("company_id")
          .eq("user_id", userId)
          .maybeSingle()
        if (proData?.company_id) {
          const { data: ppData } = await supabase
            .from("project_professionals")
            .select("id")
            .eq("project_id", projectId)
            .eq("company_id", proData.company_id)
            .eq("is_project_owner", true)
            .maybeSingle()
          if (ppData) hasAccess = true
        }
      }
      if (!hasAccess) {
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
        projectTitle: getProjectTranslation(project, "title", locale) || project.title || "",
        projectDescription: getProjectTranslation(project, "description", locale) || project.description || "",
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
        setSpecScope(project.project_type ?? "")
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

  // Show a one-time welcome toast when arriving from the URL import flow
  useEffect(() => {
    if (importToastFiredRef.current) return
    if (searchParams?.get("from") !== "import") return
    importToastFiredRef.current = true
    toast.success("Project imported!", {
      description: "We pre-filled what we could from your website. Add photos and complete the remaining fields before publishing.",
      duration: 8000,
    })
  }, [searchParams])

  // Track photo upload completion
  useEffect(() => {
    if (prevIsUploadingRef.current && !isUploading && uploadToastIdRef.current != null) {
      const toastId = uploadToastIdRef.current
      if (uploadErrors.length > 0) {
        toast.error(`${uploadErrors.length} ${uploadErrors.length === 1 ? "photo" : "photos"} failed`, {
          id: toastId,
          description: uploadErrors[0],
        })
      } else {
        const count = uploadFileCountRef.current
        toast.success(`${count} ${count === 1 ? "photo" : "photos"} uploaded`, { id: toastId })
      }
      uploadToastIdRef.current = null
      uploadFileCountRef.current = 0
    }
    prevIsUploadingRef.current = isUploading
  }, [isUploading, uploadErrors])

  // Keep activeSection as "location" for map initialization in the new layout
  useEffect(() => {
    setActiveSection("location")
  }, [])

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

  const handleGenerateProjectDescription = useCallback(async () => {
    if (!projectId || generatingDesc) return
    setGeneratingDesc(true)
    try {
      const result = await regenerateDescription(projectId)
      if ("description" in result && result.description) {
        setDetailsForm((prev) => ({ ...prev, projectDescription: result.description }))
        if (descEditRef.current) {
          descEditRef.current.textContent = result.description
        }
        setDescCharCount(result.description.length)
        toast.success("Description generated")
      } else if ("error" in result) {
        toast.error(result.error)
      }
    } catch {
      toast.error("Failed to generate description")
    } finally {
      setGeneratingDesc(false)
    }
  }, [projectId, generatingDesc])

  // Auto-generate description on load for projects without a description
  useEffect(() => {
    if (!projectId || autoGenerateDescTriggered.current || generatingDesc) return
    if (detailsForm.projectDescription) return
    if (detailsLoading) return
    autoGenerateDescTriggered.current = true
    handleGenerateProjectDescription()
  }, [projectId, detailsForm.projectDescription, detailsLoading]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Inline card editing state
  const [editingInviteField, setEditingInviteField] = useState<{ inviteId: string; field: "service" | "company" | "email" } | null>(null)
  const [companySearchQuery, setCompanySearchQuery] = useState("")
  const [companySearchResults, setCompanySearchResults] = useState<{ id: string; name: string; city: string | null; logo_url: string | null; email: string | null; owner_id: string | null; domain: string | null }[]>([])
  const [isSearchingCompanies, setIsSearchingCompanies] = useState(false)
  const companySearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [ownerCompanyServices, setOwnerCompanyServices] = useState<{ id: string; name: string; parentName?: string | null }[]>([])
  // Map of companyId → services for invited Arco companies (non-owner)
  const [inviteCompanyServices, setInviteCompanyServices] = useState<Record<string, { id: string; name: string; parentName?: string | null }[]>>({})
  const [confirmDeleteInviteId, setConfirmDeleteInviteId] = useState<string | null>(null)
  const [draftCard, setDraftCard] = useState<{ serviceIds: string[]; serviceName: string; companyName: string; companyLogo: string | null; email: string; companyId?: string | null } | null>(null)

  // 3-tier company lookup state
  type GooglePlaceResult = { placeId: string; name: string; city: string | null }
  const [googleResults, setGoogleResults] = useState<GooglePlaceResult[]>([])
  const [pendingTier23, setPendingTier23] = useState<{
    inviteId: string // card id or "__draft__"
    companyName: string
    googlePlaceId: string | null
    city: string | null
    prefillEmail: string | null
    // Enriched fields from Google Place Details
    website: string | null
    domain: string | null
    phone: string | null
    fullAddress: string | null
    country: string | null
    stateRegion: string | null
    editorialSummary: string | null
    googleTypes: string[] | null
  } | null>(null)
  const [dupWarning, setDupWarning] = useState<{
    existingId: string
    existingName: string
    existingLogo: string | null
    existingProjectCount: number
    pendingInviteId: string
    pendingInput: { name: string; email: string; city?: string | null; googlePlaceId?: string | null }
    matchType: "domain" | "name"
  } | null>(null)
  const googleAutocompleteService = useRef<any>(null)
  const companySearchActive = useRef(false) // true after user types, false on initial focus
  const selectAllOnMount = useRef(false)

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

  const handleShowSubmitReview = () => {
    if (!projectId || isSubmittingForReview) return
    setHighlightMissingFields(false)
    setShowSubmitReviewPopup(true)
  }

  const handleSubmitForReview = async () => {
    if (!projectId || isSubmittingForReview) return

    try {
      if (!userId) {
        toast.error("User not authenticated")
        return
      }

      setIsSubmittingForReview(true)
      setShowSubmitReviewPopup(false)

      // Check if the project's owning company has auto-approve enabled
      let autoApprove = false
      const { data: ppData } = await supabase
        .from("project_professionals")
        .select("company_id")
        .eq("project_id", projectId)
        .eq("is_project_owner", true)
        .maybeSingle()

      if (ppData?.company_id) {
        const { data: companyData } = await supabase
          .from("companies")
          .select("auto_approve_projects")
          .eq("id", ppData.company_id)
          .maybeSingle()
        autoApprove = Boolean((companyData as any)?.auto_approve_projects)
      }

      const newStatus = autoApprove ? "published" : "in_progress"

      const { error } = await supabase
        .from("projects")
        .update({ status: newStatus, ...(autoApprove ? { is_featured: true } : {}) })
        .eq("id", projectId)

      if (error) {
        toast.error("Failed to submit for review")
        console.error("Error submitting for review:", error)
      } else {
        // Update project_professionals status
        const ppStatus = autoApprove ? "live_on_page" : "listed"
        await supabase
          .from("project_professionals")
          .update({ status: ppStatus })
          .eq("project_id", projectId)
          .eq("is_project_owner", true)

        setProjectStatus(newStatus)
        if (autoApprove) {
          setCurrentStatusValue("live_on_page")
          setSelectedStatus("live_on_page")
        }
        setIsEditMode(false)
        setShowStatusModal(false)
        if (autoApprove && projectId) {
          trackProjectPublished(projectId, detailsForm.projectTitle || "Untitled project")
        }
        toast.success(autoApprove ? "Project published!" : "Submitted for review!")
      }
    } catch (err) {
      toast.error("Failed to submit for review")
      console.error("Error submitting for review:", err)
    } finally {
      setIsSubmittingForReview(false)
    }
  }

  const statusOptions = OWNER_STATUS_OPTIONS

  const statusOptionByValue = useMemo(
    () => new Map(statusOptions.map((option) => [option.value, option])),
    [statusOptions],
  )

  // For draft/in_progress/rejected, show project-level status; otherwise show PP status
  const useProjectLevelStatus = projectStatus && ["draft", "in_progress", "rejected"].includes(projectStatus)

  const currentStatusLabel = useMemo(() => {
    if (useProjectLevelStatus && projectStatus) {
      return PROJECT_STATUS_LABELS[projectStatus]
    }
    if (currentStatusValue && statusOptionByValue.has(currentStatusValue)) {
      return statusOptionByValue.get(currentStatusValue)!.label
    }
    if (currentStatusValue) {
      return CONTRIBUTOR_STATUS_LABELS[currentStatusValue] ?? currentStatusValue
    }
    if (projectStatus) {
      return PROJECT_STATUS_LABELS[projectStatus]
    }
    return "Set status"
  }, [currentStatusValue, projectStatus, statusOptionByValue, useProjectLevelStatus])

  const statusIndicatorClass = useMemo(() => {
    if (useProjectLevelStatus && projectStatus) {
      return PROJECT_STATUS_DOT_CLASS[projectStatus]
    }
    if (currentStatusValue && statusOptionByValue.has(currentStatusValue)) {
      return statusOptionByValue.get(currentStatusValue)!.colorClass
    }
    if (currentStatusValue) {
      return CONTRIBUTOR_STATUS_DOT_CLASS[currentStatusValue] ?? "bg-muted-foreground"
    }
    if (projectStatus) {
      return PROJECT_STATUS_DOT_CLASS[projectStatus]
    }
    return "bg-muted-foreground"
  }, [currentStatusValue, projectStatus, statusOptionByValue, useProjectLevelStatus])

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
        "id, invited_email, invited_service_category_ids, status, is_project_owner, invited_at, responded_at, professional_id, company_id",
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
        .select("id, company_id, company_name, company_logo, primary_specialty")
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

    // Collect all company IDs across all invites
    const allCompanyIds = Array.from(
      new Set(
        (inviteRows ?? [])
          .map(row => (row as any).company_id ?? (row.professional_id ? professionalMap.get(row.professional_id)?.company_id : null))
          .filter((id): id is string => Boolean(id)),
      ),
    )

    // Fetch company info for invites that have company_id but no professional_id
    const companyOnlyIds = allCompanyIds.filter(id =>
      (inviteRows ?? []).some(row => (row as any).company_id === id && !row.professional_id)
    )
    let companyMap = new Map<string, { name: string; logo_url: string | null }>()
    if (companyOnlyIds.length) {
      const { data: companies } = await supabase
        .from("companies")
        .select("id, name, logo_url")
        .in("id", companyOnlyIds)
      if (companies) {
        companyMap = new Map(companies.map(c => [c.id, { name: c.name, logo_url: c.logo_url }]))
      }
    }

    // Fetch project counts and company status for all companies
    let companyProjectCounts = new Map<string, number>()
    let companyStatusMap = new Map<string, string>()
    if (allCompanyIds.length) {
      const [{ data: projectCounts }, { data: companyStatuses }] = await Promise.all([
        supabase
          .from("project_professionals")
          .select("company_id, project_id, projects!inner(status)")
          .in("company_id", allCompanyIds)
          .eq("projects.status" as any, "published"),
        supabase
          .from("companies")
          .select("id, status")
          .in("id", allCompanyIds),
      ])
      // Count unique published projects per company
      const countSets = new Map<string, Set<string>>()
      projectCounts?.forEach((row: any) => {
        if (row.company_id && row.project_id) {
          if (!countSets.has(row.company_id)) countSets.set(row.company_id, new Set())
          countSets.get(row.company_id)!.add(row.project_id)
        }
      })
      countSets.forEach((projects, companyId) => companyProjectCounts.set(companyId, projects.size))
      companyStatuses?.forEach(c => companyStatusMap.set(c.id, c.status))
    }

    const invitesByService: Record<string, ProfessionalInviteSummary[]> = {}
    let ownerInvite: ProfessionalInviteSummary | null = null

    ;(inviteRows ?? []).forEach((row) => {
      const professionalData = row.professional_id ? professionalMap.get(row.professional_id) : null
      const companyId = (row as any).company_id ?? professionalData?.company_id ?? null
      const companyDirect = companyId && !professionalData ? companyMap.get(companyId) : null
      const isListed = row.professional_id ? true : (companyId ? companyStatusMap.get(companyId) === "listed" : false)
      const serviceIds = (row.invited_service_category_ids as string[] | null) ?? []
      const summary: ProfessionalInviteSummary = {
        id: row.id,
        serviceIds,
        email: row.invited_email,
        status: row.status,
        isOwner: row.is_project_owner,
        invitedAt: row.invited_at,
        respondedAt: row.responded_at,
        professionalId: row.professional_id,
        companyId,
        companyName: professionalData?.company_name ?? companyDirect?.name ?? null,
        companyLogo: professionalData?.company_logo ?? companyDirect?.logo_url ?? null,
        primaryService: professionalData?.primary_specialty ?? null,
        projectsCount: companyId ? (companyProjectCounts.get(companyId) ?? 0) : 0,
        isListedCompany: isListed,
      }

      if (summary.isOwner) {
        ownerInvite = summary
      }

      // Fan out: add invite to each service bucket it belongs to
      if (serviceIds.length > 0) {
        for (const sid of serviceIds) {
          if (!invitesByService[sid]) invitesByService[sid] = []
          invitesByService[sid].push(summary)
        }
      } else {
        if (!invitesByService["__unassigned__"]) invitesByService["__unassigned__"] = []
        invitesByService["__unassigned__"].push(summary)
      }
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

  // Fetch owner company's selected services for the owner card service dropdown
  useEffect(() => {
    if (!projectOwnerInvite?.companyId) { setOwnerCompanyServices([]); return }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from("companies")
        .select("services_offered")
        .eq("id", projectOwnerInvite.companyId!)
        .maybeSingle()
      if (cancelled || !data?.services_offered?.length) return
      const { data: cats } = await supabase
        .from("categories")
        .select("id, name, parent_id")
        .in("id", data.services_offered)
      if (cancelled || !cats) return
      // Resolve parent names for grouping
      const parentIds = [...new Set(cats.map(c => c.parent_id).filter(Boolean))] as string[]
      const parentMap = new Map<string, string>()
      if (parentIds.length > 0) {
        const { data: parents } = await supabase.from("categories").select("id, name").in("id", parentIds)
        if (parents) parents.forEach(p => parentMap.set(p.id, p.name))
      }
      if (!cancelled) {
        setOwnerCompanyServices(cats.map(c => ({ id: c.id, name: c.name, parentName: c.parent_id ? parentMap.get(c.parent_id) ?? null : null })))
      }
    })()
    return () => { cancelled = true }
  }, [projectOwnerInvite?.companyId, supabase])

  // Fetch services for an Arco company and cache in inviteCompanyServices
  const loadCompanyServices = useCallback(async (companyId: string) => {
    const { data } = await supabase
      .from("companies")
      .select("services_offered")
      .eq("id", companyId)
      .maybeSingle()
    if (!data?.services_offered?.length) return
    const { data: cats } = await supabase
      .from("categories")
      .select("id, name, parent_id")
      .in("id", data.services_offered)
    if (!cats) return
    // Resolve parent names for grouping
    const parentIds = [...new Set(cats.map(c => c.parent_id).filter(Boolean))] as string[]
    const parentMap = new Map<string, string>()
    if (parentIds.length > 0) {
      const { data: parents } = await supabase.from("categories").select("id, name").in("id", parentIds)
      if (parents) parents.forEach(p => parentMap.set(p.id, p.name))
    }
    setInviteCompanyServices(prev => ({
      ...prev,
      [companyId]: cats.map(c => ({ id: c.id, name: c.name, parentName: c.parent_id ? parentMap.get(c.parent_id) ?? null : null })),
    }))
  }, [supabase])

  // Load services for all companies on non-owner invite cards
  useEffect(() => {
    const allInvites = Object.values(professionalInvites).flat()
    if (allInvites.length === 0) return
    const companyIds = allInvites
      .filter(inv => !inv.isOwner && inv.companyId)
      .map(inv => inv.companyId!)
    const unique = [...new Set(companyIds)]
    for (const cid of unique) {
      if (!inviteCompanyServices[cid]) {
        void loadCompanyServices(cid)
      }
    }
  }, [professionalInvites, loadCompanyServices]) // eslint-disable-line react-hooks/exhaustive-deps

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
      // Remove the service selection
      const { error } = await supabase
        .from("project_professional_services")
        .delete()
        .eq("project_id", projectId)
        .eq("service_category_id", serviceId)

      if (error) {
        throw error
      }

      // For each invite that has this service, remove it from their array
      const affectedInvites = professionalInvites[serviceId] ?? []
      for (const inv of affectedInvites) {
        const newServiceIds = inv.serviceIds.filter(sid => sid !== serviceId)
        if (newServiceIds.length === 0) {
          // No services left — delete the row entirely
          await supabase.from("project_professionals").delete().eq("id", inv.id)
        } else {
          await supabase.from("project_professionals").update({ invited_service_category_ids: newServiceIds } as any).eq("id", inv.id)
        }
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

  // Helper: check if a company/email is already credited on this project (including owner)
  // Send invite email with 5-second undo window (only for published projects)
  const sendInviteWithUndo = (email: string, companyName?: string) => {
    const isPublished = projectStatus === "published" || projectStatus === "completed"
    if (!isPublished || !projectId) {
      toast.success("Professional added", { description: "Invite will be sent when the project is published." })
      return
    }
    if (projectId) {
      trackProfessionalInvited(projectId, email)
    }
    const inviterName = projectOwnerInvite?.companyName ?? "The project owner"
    const projectTitle = detailsForm.projectTitle || "Untitled project"
    let cancelled = false
    const timer = setTimeout(() => {
      if (!cancelled) {
        sendInviteEmailAction({ email, projectId, inviterName, projectTitle }).catch(() => {})
      }
    }, 5000)
    toast.success(`Invite will be sent to ${companyName || email}`, {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => { cancelled = true; clearTimeout(timer); toast.info("Invite cancelled") },
      },
    })
  }

  const findExistingInviteByCompany = (companyId?: string | null, email?: string | null): ProfessionalInviteSummary | undefined => {
    const allInvites = Object.values(professionalInvites).flat()
    // Also check the owner
    if (projectOwnerInvite) allInvites.push(projectOwnerInvite)
    // Deduplicate by id
    const seen = new Set<string>()
    return allInvites.find(inv => {
      if (seen.has(inv.id)) return false
      seen.add(inv.id)
      return (companyId && inv.companyId === companyId) || (email && inv.email === email)
    })
  }

  const handleProfessionalDirectSelect = async (professional: ProfessionalOption, serviceId: string) => {
    if (!projectId || isInviteMutating) {
      return
    }

    // Check if this company already has a row on this project (including owner)
    const existingInvite = findExistingInviteByCompany(professional.company_id, professional.email)
    if (existingInvite) {
      if (existingInvite.isOwner) {
        setInviteError("This company is the project owner and is already credited on this project.")
        return
      }
      // Add service to existing row
      if (existingInvite.serviceIds.includes(serviceId)) {
        setInviteError("This company is already credited for this service.")
        return
      }
      setIsInviteMutating(true)
      try {
        const newServiceIds = [...existingInvite.serviceIds, serviceId]
        const { error } = await supabase
          .from("project_professionals")
          .update({ invited_service_category_ids: newServiceIds } as any)
          .eq("id", existingInvite.id)
        if (error) throw error
        await refreshProfessionalSection()
      } catch (error) {
        setInviteError(error instanceof Error ? error.message : "We couldn't add this service. Please try again.")
      } finally {
        setIsInviteMutating(false)
      }
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
        invited_service_category_ids: [serviceId],
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
          .select("id, invited_email, invited_service_category_ids, status, invited_at, responded_at")
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
          invited_service_category_ids: [inviteServiceId],
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

  // ── Inline card field editing ─────────────────────────────────────────────
  const saveInviteService = async (inviteId: string, newServiceId: string, oldServiceId?: string) => {
    try {
      // Find the current invite to get its serviceIds
      const currentInvite = Object.values(professionalInvites).flat().find(inv => inv.id === inviteId)
      let newServiceIds: string[]
      if (oldServiceId && currentInvite) {
        // Replace old service with new one in the array
        newServiceIds = currentInvite.serviceIds.map(sid => sid === oldServiceId ? newServiceId : sid)
      } else {
        // Fallback: set to single new service
        newServiceIds = [newServiceId]
      }
      const { error } = await supabase
        .from("project_professionals")
        .update({ invited_service_category_ids: newServiceIds } as any)
        .eq("id", inviteId)
      if (error) throw error
      await refreshProfessionalSection()
    } catch {
      toast.error("Failed to update service")
    }
    setEditingInviteField(null)
  }

  const saveInviteEmail = async (inviteId: string, newEmail: string) => {
    const trimmed = newEmail.trim()
    if (!trimmed) { setEditingInviteField(null); return }
    if (!EMAIL_REGEX.test(trimmed)) { toast.error("Please enter a valid email address"); return }
    const domain = getDomain(trimmed)
    if (domain && BLOCKED_EMAIL_DOMAINS.includes(domain)) { toast.error("Please use a company email address"); return }
    try {
      const updateData: Record<string, unknown> = { invited_email: trimmed }
      const { data: foundPro } = await findProfessionalByEmailAction(trimmed)
      if (foundPro) {
        updateData.professional_id = foundPro.id
        updateData.company_id = foundPro.company_id
      }
      const { error } = await supabase.from("project_professionals").update(updateData).eq("id", inviteId)
      if (error) throw error
      await refreshProfessionalSection()
    } catch {
      toast.error("Failed to update email")
    }
    setEditingInviteField(null)
  }

  const saveInviteCompany = async (inviteId: string, companyId: string | null, companyEmail?: string | null) => {
    // Check if this company is already on the project (including owner)
    if (companyId) {
      const existing = findExistingInviteByCompany(companyId, companyEmail)
      if (existing && existing.id !== inviteId) {
        toast.error(existing.isOwner
          ? "This company is the project owner and is already credited on this project."
          : "This company is already credited on this project.")
        setEditingInviteField(null)
        setCompanySearchQuery("")
        setCompanySearchResults([])
        setGoogleResults([])
        return
      }
    }
    try {
      const updateData: Record<string, unknown> = { company_id: companyId }
      if (companyId && companyEmail) {
        updateData.invited_email = companyEmail
      }
      // Pre-fill primary service from company profile
      if (companyId) {
        const { data: companyRow } = await supabase
          .from("companies")
          .select("primary_service_id, services_offered")
          .eq("id", companyId)
          .maybeSingle()
        if (companyRow?.primary_service_id) {
          updateData.invited_service_category_ids = [companyRow.primary_service_id]
        }
        // Cache company's services for the dropdown
        if (companyRow?.services_offered?.length) {
          const { data: cats } = await supabase
            .from("categories")
            .select("id, name")
            .in("id", companyRow.services_offered)
          if (cats) {
            setInviteCompanyServices(prev => ({ ...prev, [companyId]: cats }))
          }
        }
      }
      const { error } = await supabase
        .from("project_professionals")
        .update(updateData)
        .eq("id", inviteId)
      if (error) throw error
      await refreshProfessionalSection()
    } catch {
      toast.error("Failed to update company")
    }
    setEditingInviteField(null)
    setCompanySearchQuery("")
    setCompanySearchResults([])
    setGoogleResults([])
  }

  // Handle selecting a Google or manual company (tier 2/3)
  const handleSelectTier23Company = async (inviteId: string, name: string, googlePlaceId: string | null, city: string | null) => {
    setPendingTier23({ inviteId, companyName: name, googlePlaceId, city, prefillEmail: null, website: null, domain: null, phone: null, fullAddress: null, country: null, stateRegion: null, editorialSummary: null, googleTypes: null })
    setEditingInviteField({ inviteId, field: "email" })
    setCompanySearchQuery("")
    setCompanySearchResults([])
    setGoogleResults([])

    // For Google Places results, fetch full details for enrichment
    if (googlePlaceId) {
      try {
        const g = (window as any).google
        if (g?.maps) {
          const placesLib = await g.maps.importLibrary("places")
          if (placesLib?.PlacesService) {
            const div = document.createElement("div")
            const service = new placesLib.PlacesService(div)
            service.getDetails(
              { placeId: googlePlaceId, fields: ["website", "formatted_address", "address_components", "international_phone_number", "formatted_phone_number", "editorial_summary", "types"] },
              (place: any, status: string) => {
                if (status === "OK" && place) {
                  const website = place.website ?? null
                  let hostname: string | null = null
                  if (website) {
                    try {
                      hostname = new URL(website).hostname.replace(/^www\./, "")
                      if (["facebook.com", "instagram.com", "linkedin.com", "pinterest.com"].includes(hostname)) {
                        hostname = null
                      }
                    } catch { /* invalid URL */ }
                  }

                  const components = place.address_components ?? []
                  const placeCountry = components.find((c: any) => c.types?.includes("country"))?.long_name ?? null
                  const placeState = components.find((c: any) => c.types?.includes("administrative_area_level_1"))?.long_name ?? null

                  setPendingTier23(prev =>
                    prev && prev.googlePlaceId === googlePlaceId
                      ? {
                          ...prev,
                          prefillEmail: hostname ? `@${hostname}` : prev.prefillEmail,
                          website,
                          domain: hostname,
                          phone: place.international_phone_number ?? place.formatted_phone_number ?? null,
                          fullAddress: place.formatted_address ?? null,
                          country: placeCountry,
                          stateRegion: placeState,
                          editorialSummary: place.editorial_summary?.text ?? null,
                          googleTypes: place.types ?? null,
                        }
                      : prev
                  )
                }
              }
            )
          }
        }
      } catch { /* Google API not available */ }
    }
  }

  // Save a tier 2/3 company after email is provided
  const saveTier23Company = async (inviteId: string, email: string) => {
    const trimmed = email.trim()
    if (!trimmed) return
    if (!EMAIL_REGEX.test(trimmed)) { toast.error("Please enter a valid email address"); return }
    const domain = getDomain(trimmed)
    if (domain && BLOCKED_EMAIL_DOMAINS.includes(domain)) { toast.error("Please use a company email address"); return }
    if (!projectId || !pendingTier23) return

    // Check if company is already on the project (draft card may have companyId from Arco search)
    const checkCompanyId = draftCard?.companyId ?? null
    if (checkCompanyId) {
      const existing = findExistingInviteByCompany(checkCompanyId, trimmed)
      if (existing) {
        toast.error(existing.isOwner
          ? "This company is the project owner and is already credited on this project."
          : "This company is already credited on this project.")
        setDraftCard(null)
        setPendingTier23(null)
        setEditingInviteField(null)
        return
      }
    }

    const inviterName = projectOwnerInvite?.companyName ?? "The project owner"
    const projectTitle = detailsForm.projectTitle || "Untitled project"

    if (!userId) { toast.error("Not authenticated"); return }

    try {
      const result = await createUnlistedCompanyAction({
        name: pendingTier23.companyName,
        email: trimmed,
        city: pendingTier23.city,
        googlePlaceId: pendingTier23.googlePlaceId,
        projectId,
        inviterName,
        projectTitle,
        creatorUserId: userId,
        website: pendingTier23.website,
        domain: pendingTier23.domain,
        phone: pendingTier23.phone,
        address: pendingTier23.fullAddress,
        country: pendingTier23.country,
        stateRegion: pendingTier23.stateRegion,
      })

      if ("duplicate" in result) {
        if (result.matchType === "domain") {
          // Domain match (invited company) — auto-link without popup
          try {
            if (inviteId === "__draft__") {
              const insertData: Record<string, unknown> = {
                project_id: projectId,
                invited_email: trimmed,
                invited_service_category_ids: draftCard?.serviceIds ?? [],
                company_id: result.existingCompanyId,
              }
              const { data: foundPro } = await findProfessionalByEmailAction(trimmed)
              if (foundPro) insertData.professional_id = foundPro.id
              await supabase.from("project_professionals").insert(insertData)
              setDraftCard(null)
            } else {
              await confirmLinkExistingCompanyAction({
                companyId: result.existingCompanyId,
                inviteId,
                projectId,
                email: trimmed,
                inviterName,
                projectTitle,
              })
            }
            await refreshProfessionalSection()
            toast.success("Professional added")
          } catch {
            toast.error("Failed to add professional")
          }
          setPendingTier23(null)
          setEditingInviteField(null)
          return
        }
        setDupWarning({
          existingId: result.existingCompanyId,
          existingName: result.existingCompanyName,
          existingLogo: result.existingCompanyLogo ?? null,
          existingProjectCount: result.existingCompanyProjectCount ?? 0,
          pendingInviteId: inviteId,
          pendingInput: { name: pendingTier23.companyName, email: trimmed, city: pendingTier23.city, googlePlaceId: pendingTier23.googlePlaceId },
          matchType: result.matchType,
        })
        return
      }

      if ("error" in result) {
        console.error("createUnlistedCompanyAction returned error:", result.error)
        toast.error(result.error)
        // Keep pendingTier23 so user can retry
        setEditingInviteField({ inviteId, field: "email" })
        return
      }

      // Fire-and-forget enrichment (logo + AI description)
      if (pendingTier23.domain) {
        enrichCompanyAction({
          companyId: result.companyId,
          companyName: pendingTier23.companyName,
          website: pendingTier23.website,
          domain: pendingTier23.domain,
          editorialSummary: pendingTier23.editorialSummary,
          googleTypes: pendingTier23.googleTypes,
          city: pendingTier23.city,
          country: pendingTier23.country,
        }).catch(err => console.error("Company enrichment failed:", err))
      }

      // Link company to invite
      if (inviteId === "__draft__") {
        // For draft card: insert new project_professionals row
        const insertData: Record<string, unknown> = {
          project_id: projectId,
          invited_email: trimmed,
          invited_service_category_ids: draftCard?.serviceIds ?? [],
          company_id: result.companyId,
        }
        const { data: foundPro } = await findProfessionalByEmailAction(trimmed)
        if (foundPro) {
          insertData.professional_id = foundPro.id
        }
        const { error } = await supabase.from("project_professionals").insert(insertData)
        if (error) throw error
        setDraftCard(null)
        await refreshProfessionalSection()
        if (!result.emailSent) {
          const isPublished = projectStatus === "published" || projectStatus === "completed"
          toast.success("Professional added", { description: !isPublished ? "Invite will be sent when the project is published." : undefined })
        } else {
          sendInviteWithUndo(trimmed, pendingTier23?.companyName)
        }
      } else {
        // For existing card: update company_id and email
        await saveInviteCompany(inviteId, result.companyId, trimmed)
        if (!result.emailSent) {
          toast.success("Company linked")
        } else {
          sendInviteWithUndo(trimmed, pendingTier23?.companyName)
        }
      }
      setPendingTier23(null)
      setEditingInviteField(null)
    } catch (err) {
      console.error("saveTier23Company error:", err)
      toast.error("Failed to add professional")
      // Keep pendingTier23 and re-open email field so user can retry
      setEditingInviteField({ inviteId, field: "email" })
    }
  }

  // Handle dedup warning actions
  const handleDupLinkExisting = async () => {
    if (!dupWarning || !projectId) return
    // Final check: is this company already on the project?
    const existing = findExistingInviteByCompany(dupWarning.existingId)
    if (existing) {
      toast.error(existing.isOwner
        ? "This company is the project owner and is already credited on this project."
        : "This company is already credited on this project.")
      setDupWarning(null)
      return
    }
    const inviterName = projectOwnerInvite?.companyName ?? "The project owner"
    const projectTitle = detailsForm.projectTitle || "Untitled project"

    if (dupWarning.pendingInviteId === "__draft__") {
      // For draft card, insert row with existing company
      try {
        const updateData: Record<string, unknown> = {
          project_id: projectId,
          invited_email: dupWarning.pendingInput.email,
          invited_service_category_ids: draftCard?.serviceIds ?? [],
          company_id: dupWarning.existingId,
        }
        const { data: foundPro } = await findProfessionalByEmailAction(dupWarning.pendingInput.email)
        if (foundPro) {
          updateData.professional_id = foundPro.id
        }
        const { error } = await supabase.from("project_professionals").insert(updateData)
        if (error) throw error
        setDraftCard(null)
        await refreshProfessionalSection()
        toast.success("Professional added")
      } catch {
        toast.error("Failed to add professional")
      }
    } else {
      const res = await confirmLinkExistingCompanyAction({
        companyId: dupWarning.existingId,
        inviteId: dupWarning.pendingInviteId,
        projectId,
        email: dupWarning.pendingInput.email,
        inviterName,
        projectTitle,
      })
      if (res.success) {
        await refreshProfessionalSection()
        toast.success("Company linked")
      } else {
        toast.error(res.error || "Failed to link company")
      }
    }
    setDupWarning(null)
    setPendingTier23(null)
    setEditingInviteField(null)
  }

  const handleDupForceCreate = async () => {
    if (!dupWarning || !projectId || !userId) return
    const inviterName = projectOwnerInvite?.companyName ?? "The project owner"
    const projectTitle = detailsForm.projectTitle || "Untitled project"

    const result = await createUnlistedCompanyAction({
      name: dupWarning.pendingInput.name,
      email: dupWarning.pendingInput.email,
      city: dupWarning.pendingInput.city,
      googlePlaceId: dupWarning.pendingInput.googlePlaceId,
      projectId,
      inviterName,
      projectTitle,
      creatorUserId: userId,
      skipDedup: true,
    })

    if ("error" in result) {
      toast.error(result.error)
    } else if ("success" in result) {
      if (dupWarning.pendingInviteId === "__draft__") {
        try {
          const updateData: Record<string, unknown> = {
            project_id: projectId,
            invited_email: dupWarning.pendingInput.email,
            invited_service_category_ids: draftCard?.serviceIds ?? [],
            company_id: result.companyId,
          }
          const { error } = await supabase.from("project_professionals").insert(updateData)
          if (error) throw error
          setDraftCard(null)
          await refreshProfessionalSection()
          if (result.emailSent) {
            sendInviteWithUndo(dupWarning.pendingInput.email, dupWarning.pendingInput.name)
          } else {
            const isPublished = projectStatus === "published" || projectStatus === "completed"
            toast.success("Professional added", { description: !isPublished ? "Invite will be sent when the project is published." : undefined })
          }
        } catch {
          toast.error("Failed to add professional")
        }
      } else {
        await saveInviteCompany(dupWarning.pendingInviteId, result.companyId, dupWarning.pendingInput.email)
        toast.success(result.emailSent ? "Invite email sent" : "Company linked")
      }
    }
    setDupWarning(null)
    setPendingTier23(null)
    setEditingInviteField(null)
  }

  const searchCompanies = (query: string) => {
    setCompanySearchQuery(query)
    if (companySearchTimer.current) clearTimeout(companySearchTimer.current)
    if (query.trim().length < 2) { setCompanySearchResults([]); setGoogleResults([]); return }
    companySearchTimer.current = setTimeout(async () => {
      setIsSearchingCompanies(true)
      try {
        // Parallel: DB + Google Places
        const dbPromise = supabase
          .from("companies")
          .select("id, name, city, logo_url, email, owner_id, domain")
          .ilike("name", `%${query.trim()}%`)
          .in("status", ["listed", "unlisted", "draft"])
          .limit(6)

        const googlePromise = (async (): Promise<GooglePlaceResult[]> => {
          try {
            const g = (window as any).google
            if (!g?.maps) return []

            // With loading=async, places lib must be loaded via importLibrary
            if (!googleAutocompleteService.current) {
              const placesLib = await g.maps.importLibrary("places")
              if (!placesLib?.AutocompleteService) return []
              googleAutocompleteService.current = new placesLib.AutocompleteService()
            }

            const response = await new Promise<any>((resolve) => {
              googleAutocompleteService.current.getPlacePredictions(
                { input: query.trim(), types: ["establishment"], componentRestrictions: { country: "nl" } },
                (predictions: any, status: string) => {
                  if (status === "OK" && predictions) {
                    resolve(predictions)
                  } else {
                    resolve([])
                  }
                }
              )
            })
            return response.slice(0, 5).map((p: any) => ({
              placeId: p.place_id,
              name: p.structured_formatting?.main_text ?? p.description ?? "",
              city: (() => {
                const parts = (p.structured_formatting?.secondary_text ?? "").split(",").map((s: string) => s.trim())
                // secondary_text is typically "Street, City, Country" — pick the part before the last (country)
                return parts.length >= 2 ? parts[parts.length - 2] : parts[0] || null
              })(),
            }))
          } catch (e) {
            console.warn("Google Places search failed:", e)
            return []
          }
        })()

        const [dbResult, googleData] = await Promise.all([dbPromise, googlePromise])
        const dbData = dbResult.data ?? []
        setCompanySearchResults(dbData)

        // Deduplicate: remove Google results that match a DB result by name
        const dbNames = new Set(dbData.map(c => c.name.toLowerCase()))
        setGoogleResults(googleData.filter(g => !dbNames.has(g.name.toLowerCase())))
      } catch {
        setCompanySearchResults([])
        setGoogleResults([])
      }
      setIsSearchingCompanies(false)
    }, 300)
  }

  const saveDraftCard = async (email: string) => {
    const trimmed = email.trim()
    if (!trimmed) return
    if (!EMAIL_REGEX.test(trimmed)) { toast.error("Please enter a valid email address"); return }
    const domain = getDomain(trimmed)
    if (domain && BLOCKED_EMAIL_DOMAINS.includes(domain)) { toast.error("Please use a company email address"); return }
    if (!projectId) return
    try {
      const updateData: Record<string, unknown> = {
        project_id: projectId,
        invited_email: trimmed,
        invited_service_category_ids: draftCard?.serviceIds ?? [],
      }
      const { data: foundPro } = await findProfessionalByEmailAction(trimmed)
      if (foundPro) {
        updateData.professional_id = foundPro.id
        updateData.company_id = foundPro.company_id
      }
      const { error } = await supabase.from("project_professionals").insert(updateData)
      if (error) throw error
      setDraftCard(null)
      await refreshProfessionalSection()
      toast.success("Professional added")
    } catch {
      toast.error("Failed to add professional")
    }
  }

  // Save draft card with a DB company (tier 1) — uses company email automatically
  const saveDraftCardWithCompany = async (companyId: string, companyEmail: string | null, isClaimedCompany?: boolean) => {
    if (!projectId) return

    // Check if this company is already on the project (including owner)
    const existing = findExistingInviteByCompany(companyId, companyEmail)
    if (existing) {
      toast.error(existing.isOwner
        ? "This company is the project owner and is already credited on this project."
        : "This company is already credited on this project.")
      setDraftCard(null)
      setEditingInviteField(null)
      setCompanySearchQuery("")
      setCompanySearchResults([])
      setGoogleResults([])
      return
    }

    if (!companyEmail && !isClaimedCompany) {
      // No email on file — fall back to asking for email via tier 2/3 flow
      const companyName = companySearchResults.find(c => c.id === companyId)?.name ?? ""
      handleSelectTier23Company("__draft__", companyName, null, null)
      setDraftCard(d => d ? { ...d, companyName, companyId } : d)
      void loadCompanyServices(companyId)
      return
    }

    try {
      // Fetch company's primary service, services, and owner email from DB
      const { data: companyRow } = await supabase
        .from("companies")
        .select("primary_service_id, services_offered, email, owner_id")
        .eq("id", companyId)
        .maybeSingle()

      // Resolve email: provided email > company email > owner's auth email
      let resolvedEmail = companyEmail || companyRow?.email || ""
      if (!resolvedEmail && companyRow?.owner_id) {
        const { email: ownerEmail } = await getCompanyOwnerEmailAction(companyId)
        resolvedEmail = ownerEmail || ""
      }

      const serviceIds = draftCard?.serviceIds?.length ? draftCard.serviceIds
        : companyRow?.primary_service_id ? [companyRow.primary_service_id]
        : []

      // If resolved email already exists on this project (e.g. owner owns both project and company),
      // use a unique placeholder to avoid the unique constraint on (project_id, invited_email)
      let finalEmail = resolvedEmail || "pending@arcolist.com"
      const allInvites = Object.values(professionalInvites).flat()
      if (projectOwnerInvite) allInvites.push(projectOwnerInvite)
      if (allInvites.some(inv => inv.email?.toLowerCase() === finalEmail.toLowerCase())) {
        finalEmail = `${companyId.slice(0, 8)}@arcolist.com`
      }
      const inviterName = projectOwnerInvite?.companyName ?? "The project owner"
      const projectTitle = detailsForm.projectTitle || "Untitled project"

      // Use confirmLinkExistingCompanyAction which has service role access
      // First create a placeholder row, then link the company
      const { error: insertError } = await supabase.from("project_professionals").insert({
        project_id: projectId,
        company_id: companyId,
        invited_email: finalEmail,
        invited_service_category_ids: serviceIds,
      })

      // If RLS blocks the insert, fall back to server action
      if (insertError) {
        console.error("Direct insert failed, trying server action:", insertError.message)
        const result = await createUnlistedCompanyAction({
          name: companySearchResults.find(c => c.id === companyId)?.name ?? "Company",
          email: finalEmail,
          projectId,
          inviterName,
          projectTitle,
          creatorUserId: userId ?? "",
          skipDedup: true,
        })
        if ("error" in result) throw new Error(result.error)
      }
      setDraftCard(null)

      // Cache company's services for the dropdown
      if (companyRow?.services_offered?.length) {
        void loadCompanyServices(companyId)
      }

      const inviteEmail = resolvedEmail && resolvedEmail !== "pending@arcolist.com" ? resolvedEmail : null

      await refreshProfessionalSection()

      if (inviteEmail) {
        const companyName = companySearchResults.find(c => c.id === companyId)?.name
        sendInviteWithUndo(inviteEmail, companyName ?? undefined)
      } else {
        toast.success("Professional added")
      }
    } catch (err) {
      console.error("saveDraftCardWithCompany error:", err)
      toast.error("Failed to add professional")
    }
    setEditingInviteField(null)
    setCompanySearchQuery("")
    setCompanySearchResults([])
    setGoogleResults([])
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

  const handleStatusSave = async () => {
    if (!selectedStatus || isPendingAdminReview || !projectId) {
      handleCloseStatusModal()
      return
    }

    await supabase
      .from("project_professionals")
      .update({ status: selectedStatus })
      .eq("project_id", projectId)
      .eq("is_project_owner", true)

    // Sync company listed status
    if (projectOwnerInvite?.companyId) {
      await syncCompanyListedStatus(projectOwnerInvite.companyId)
    }

    setCurrentStatusValue(selectedStatus)
    handleCloseStatusModal()
  }

  // ── Admin review handlers ────────────────────────────────────────────────

  const navigateToNextReview = useCallback(() => {
    const currentIndex = reviewQueue.indexOf(projectId ?? "")
    const remaining = reviewQueue.filter((id) => id !== projectId)
    if (remaining.length > 0) {
      const nextIndex = Math.min(currentIndex, remaining.length - 1)
      router.push(`/dashboard/edit/${remaining[nextIndex]}?review=1`)
    } else {
      toast.success("All projects reviewed!")
      router.push("/admin/projects")
    }
  }, [reviewQueue, projectId, router])

  const handleAdminApprove = useCallback(async () => {
    if (!projectId || isApproving) return
    setIsApproving(true)
    try {
      const result = await setProjectStatusAction({ projectId, status: "published" })
      if (result && "error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Failed to approve project")
        return
      }
      trackProjectPublished(projectId, detailsForm.projectTitle || "Untitled project")
      toast.success("Project approved")
      navigateToNextReview()
    } catch {
      toast.error("Failed to approve project")
    } finally {
      setIsApproving(false)
    }
  }, [projectId, isApproving, navigateToNextReview])

  const handleAdminReject = useCallback(async () => {
    if (!projectId || isRejecting || (selectedRejectionReasons.length === 0 && !rejectionReason.trim())) return
    setIsRejecting(true)
    try {
      const combinedReason = [
        ...selectedRejectionReasons,
        ...(rejectionReason.trim() ? [rejectionReason.trim()] : []),
      ].join(". ")
      const result = await setProjectStatusAction({ projectId, status: "rejected", rejectionReason: combinedReason })
      if (result && "error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Failed to reject project")
        return
      }
      toast.success("Project rejected")
      setShowRejectModal(false)
      setRejectionReason("")
      setSelectedRejectionReasons([])
      navigateToNextReview()
    } catch {
      toast.error("Failed to reject project")
    } finally {
      setIsRejecting(false)
    }
  }, [projectId, isRejecting, rejectionReason, selectedRejectionReasons, navigateToNextReview])

  const handleDeleteProject = useCallback(async () => {
    if (!projectId || !userId || isDeletingProject) return
    setIsDeletingProject(true)
    try {
      const { error } = await supabase.from("projects").delete().eq("id", projectId).eq("client_id", userId)
      if (error) throw error
      toast.success("Project deleted")
      router.push("/dashboard/listings")
    } catch {
      toast.error("Failed to delete project")
    } finally {
      setIsDeletingProject(false)
    }
  }, [projectId, userId, isDeletingProject, supabase, router])

  // ── New handlers for redesigned layout ───────────────────────────────────

  const flashEditSaved = useCallback(() => {
    setEditSaveStatus("saved")
    if (editSaveTimerRef.current) clearTimeout(editSaveTimerRef.current)
    editSaveTimerRef.current = setTimeout(() => setEditSaveStatus("idle"), 2000)
  }, [])

  const saveFieldDirect = useCallback(async (patch: Record<string, unknown>) => {
    if (!projectId || !userId) return
    setEditSaveStatus("saving")
    await supabase.from("projects").update(patch).eq("id", projectId)
    flashEditSaved()
  }, [projectId, userId, supabase, flashEditSaved])

  const handleTitleSave = useCallback((val: string) => {
    setDetailsForm(prev => ({ ...prev, projectTitle: val }))
    void saveFieldDirect({ title: val })
    if (projectId) void saveProjectTranslatedField(projectId, "title", val, locale)
  }, [saveFieldDirect, projectId, locale])

  const handleDescEditFocus = () => {
    descEcRef.current?.classList.add("on")
    setDescEditing(true)
  }

  const handleDescEditBlur = () => {
    descEcRef.current?.classList.remove("on")
    setDescEditing(false)
    const val = (descEditRef.current?.textContent?.trim() ?? "").slice(0, 750)
    if (val !== descriptionPlainText) {
      setDetailsForm(prev => ({ ...prev, projectDescription: val }))
      void saveFieldDirect({ description: val || null })
      if (projectId) void saveProjectTranslatedField(projectId, "description", val, locale)
    }
  }

  const saveSpecBarField = (field: string, value: string) => {
    setEditingSpecBar(null)
    void saveFieldDirect({ [field]: value || null })
  }

  // City search for specs bar location
  const searchCity = useCallback((query: string) => {
    setCityQuery(query)
    if (citySearchTimer.current) clearTimeout(citySearchTimer.current)
    if (query.trim().length < 2) { setCityResults([]); return }

    citySearchTimer.current = setTimeout(async () => {
      setIsCitySearching(true)
      try {
        const g = (window as any).google
        if (!g?.maps) { setIsCitySearching(false); return }

        if (!cityServiceRef.current) {
          const placesLib = await g.maps.importLibrary("places")
          if (!placesLib?.AutocompleteService) { setIsCitySearching(false); return }
          cityServiceRef.current = new placesLib.AutocompleteService()
        }

        const predictions = await new Promise<any>((resolve) => {
          cityServiceRef.current.getPlacePredictions(
            { input: query.trim(), types: ["(cities)"], componentRestrictions: { country: "nl" } },
            (preds: any, status: string) => { resolve(status === "OK" && preds ? preds : []) },
          )
        })

        setCityResults(predictions.slice(0, 5).map((p: any) => ({
          placeId: p.place_id,
          mainText: p.structured_formatting?.main_text ?? "",
          secondaryText: p.structured_formatting?.secondary_text ?? "",
        })))
      } catch { setCityResults([]) }
      setIsCitySearching(false)
    }, 300)
  }, [])

  const handleSelectCity = useCallback((mainText: string) => {
    const city = mainText
    setDetailsForm(prev => ({ ...prev, city }))
    setCityQuery("")
    setCityResults([])
    setEditingSpecBar(null)
    void saveFieldDirect({ location: city, address_city: city })
  }, [saveFieldDirect])

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

    // Collect all photo IDs that belong to a real space
    const taggedPhotoIds = new Set(
      displayFeatureIds.flatMap(fid => featurePhotos[fid] ?? [])
    )
    const untaggedPhotos = uploadedPhotos.filter(p => !taggedPhotoIds.has(p.id))
    const untaggedCount = untaggedPhotos.length

    // When showing "All", sort photos by space order (exterior first) then untagged last
    const allPhotosSorted = (() => {
      const ordered: UploadedPhoto[] = []
      const used = new Set<string>()
      for (const fid of displayFeatureIds) {
        for (const pid of featurePhotos[fid] ?? []) {
          if (!used.has(pid)) {
            const photo = uploadedPhotos.find(p => p.id === pid)
            if (photo) { ordered.push(photo); used.add(pid) }
          }
        }
      }
      // Append untagged photos at the end
      for (const p of uploadedPhotos) {
        if (!used.has(p.id)) { ordered.push(p); used.add(p.id) }
      }
      return ordered
    })()

    const filteredPhotos = activeEditFeature === "__untagged__"
      ? untaggedPhotos
      : activeEditFeature
        ? (featurePhotos[activeEditFeature] ?? [])
            .map(pid => uploadedPhotos.find(p => p.id === pid))
            .filter((p): p is UploadedPhoto => p != null)
        : allPhotosSorted

    return (
      <>
        {/* Room / feature tabs */}
        <div className="category-tags" style={{ marginBottom: 24, flexWrap: "wrap" }}>
          <button
            className={`category-tag${activeEditFeature === null ? " active" : ""}`}
            onClick={() => setActiveEditFeature(null)}
          >
            All{uploadedPhotos.length > 0 ? ` · ${uploadedPhotos.length}` : ""}
          </button>
          {displayFeatureIds.map(featureId => {
            const fd = getFeatureDisplay(featureId)
            const count = getFeaturePhotoCount(featureId)
            return (
              <button
                key={featureId}
                className={`category-tag${activeEditFeature === featureId ? " active" : ""}`}
                onClick={() => setActiveEditFeature(featureId)}
              >
                {fd.name}{count > 0 ? ` · ${count}` : ""}
              </button>
            )
          })}
          {untaggedCount > 0 && (
            <button
              className={`category-tag category-tag--untagged${activeEditFeature === "__untagged__" ? " active" : ""}`}
              onClick={() => setActiveEditFeature("__untagged__")}
            >
              Untagged · {untaggedCount}
            </button>
          )}
        </div>

        {/* Photo grid */}
        <div className="photo-edit-grid">
          {/* Add photo tile — first */}
          <label className="photo-add-tile">
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png"
              className="hidden"
              disabled={isUploading}
              onChange={e => {
                const files = e.target.files
                if (files && files.length > 0) {
                  uploadFileCountRef.current = files.length
                  uploadToastIdRef.current = toast.loading(`Uploading ${files.length} ${files.length === 1 ? "photo" : "photos"}…`)
                  void handleFileUpload(files)
                }
                e.target.value = ""
              }}
            />
            <Plus size={18} style={{ color: "#c0c0be", marginBottom: 4 }} />
            <span style={{ fontSize: 12, color: "#b8b8b6", letterSpacing: ".03em" }}>
              {isUploading ? "Uploading…" : "Add photos"}
            </span>
          </label>
          {filteredPhotos.map((photo, photoIndex) => {
            // Find which space this photo belongs to (excluding building/additional)
            const photoSpace = orderedFeatureOptions.find(opt => (featurePhotos[opt.id] ?? []).includes(photo.id))
            const roomLabel = photoSpace?.name ?? "No space"
            const isRoomView = activeEditFeature && activeEditFeature !== "__untagged__"
            const isSpaceCover = isRoomView && photoIndex === 0
            const canMoveLeft = isRoomView && photoIndex > 0
            const canMoveRight = isRoomView && photoIndex < filteredPhotos.length - 1

            const handleMove = (direction: "left" | "right") => {
              if (!activeEditFeature) return
              const currentIds = featurePhotos[activeEditFeature] ?? []
              const idx = currentIds.indexOf(photo.id)
              if (idx === -1) return
              const targetIdx = direction === "left" ? idx - 1 : idx + 1
              if (targetIdx < 0 || targetIdx >= currentIds.length) return
              const reordered = [...currentIds]
              ;[reordered[idx], reordered[targetIdx]] = [reordered[targetIdx], reordered[idx]]
              void reorderFeaturePhotos(activeEditFeature, reordered)
            }

            return (
              <div key={photo.id} className="photo-edit-thumb">
                <img src={photo.url} alt="" />
                {isSpaceCover && (
                  <div style={{ position: "absolute", left: 6, top: 6, background: "#016D75", color: "white", fontSize: 9, fontWeight: 600, padding: "2px 6px", borderRadius: 3, textTransform: "uppercase", letterSpacing: "0.04em", zIndex: 2 }}>
                    Cover
                  </div>
                )}

                {/* Reorder arrows — visible on hover when room is selected */}
                {isRoomView && (
                  <div className="photo-reorder-arrows">
                    {canMoveLeft && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleMove("left") }}
                        className="photo-reorder-btn"
                        title="Move left (closer to cover)"
                      >
                        <ChevronLeft size={14} />
                      </button>
                    )}
                    {canMoveRight && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleMove("right") }}
                        className="photo-reorder-btn"
                        title="Move right"
                      >
                        <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                )}

                {/* Delete icon — top right */}
                <button
                  className="photo-del-btn"
                  onClick={() => setPhotoDeleteConfirmId(photo.id)}
                  title="Delete photo"
                >
                  <Trash2 size={13} />
                </button>

                {/* Delete confirmation overlay */}
                {photoDeleteConfirmId === photo.id && (
                  <div className="photo-del-confirm">
                    <p>Delete this photo?</p>
                    <div className="photo-del-confirm-btns">
                      <button
                        className="photo-del-yes"
                        onClick={() => { deletePhoto(photo.id); setPhotoDeleteConfirmId(null) }}
                      >
                        Delete
                      </button>
                      <button
                        className="photo-del-no"
                        onClick={() => setPhotoDeleteConfirmId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Space label — bottom */}
                <div className="photo-room-bar">
                  <button
                    className="photo-room-trigger"
                    onClick={() => setPhotoMoveMenuId(photo.id)}
                  >
                    {roomLabel}
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 6l4 4 4-4" />
                    </svg>
                  </button>
                </div>

                {/* Space picker overlay */}
                {photoMoveMenuId === photo.id && (
                  <div className="photo-space-overlay" onClick={() => setPhotoMoveMenuId(null)}>
                    <div className="photo-space-pills" onClick={(e) => e.stopPropagation()}>
                      {orderedFeatureOptions.map(opt => {
                        const isAssigned = (featurePhotos[opt.id] ?? []).includes(photo.id)
                        return (
                          <button
                            key={opt.id}
                            className={`photo-space-pill${isAssigned ? " active" : ""}`}
                            onClick={() => {
                              setPhotoMoveMenuId(null)
                              if (!isAssigned) {
                                void movePhotoToSpace(photo.id, opt.id)
                              }
                            }}
                          >
                            {opt.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Empty state */}
        {filteredPhotos.length === 0 && !isUploading && (
          <p style={{ fontSize: 13, color: "#b0b0ae", marginTop: 16 }}>
            {activeEditFeature ? "No photos in this room yet." : "Upload your first photo to get started."}
          </p>
        )}

      </>
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
                    onResendInvite={async (invite) => {
                      const result = await sendInviteEmailAction({
                        email: invite.email,
                        projectId: projectId!,
                        inviterName: "Project owner",
                        projectTitle: detailsForm.projectTitle || "Project",
                      })
                      if (result.success) {
                        toast.success(`Invite resent to ${invite.email}`)
                      } else {
                        toast.error("Failed to resend invite")
                      }
                    }}
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
      onReorderPhotos={(reorderedIds) => {
        setTempSelectedPhotos(reorderedIds)
        if (reorderedIds[0]) setTempCoverPhoto(reorderedIds[0])
      }}
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

  // ── Derived values for the new layout ──────────────────────────────────────
  const coverPhotoUrl =
    uploadedPhotos.find(p => p.isCover)?.url ??
    getFeatureCoverPhoto(BUILDING_FEATURE_ID) ??
    getFeatureCoverPhoto(ADDITIONAL_FEATURE_ID) ??
    uploadedPhotos[0]?.url ??
    null

  const locationDisplayValue =
    detailsForm.city ||
    detailsForm.address ||
    ""

  const buildingTypeLabel =
    sortedBuildingTypeOptions.find(o => o.value === detailsForm.buildingType)?.label ||
    detailsForm.buildingType ||
    ""

  // Combined project type label: prefer category subtype, fall back to building type
  const projectTypeLabel = (() => {
    if (detailsForm.projectType) {
      // Check child types across all categories
      for (const catId of Object.keys(projectTypeOptionsByCategory)) {
        const match = projectTypeOptionsByCategory[catId]?.find(o => o.value === detailsForm.projectType)
        if (match) return match.label
      }
      // Check parent categories
      const catMatch = categoryOptions.find(o => o.value === detailsForm.projectType)
      if (catMatch) return catMatch.label
    }
    return buildingTypeLabel
  })()

  const styleLabel =
    sortedProjectStyleOptions.find(o => o.value === detailsForm.projectStyle)?.label ||
    ""

  const flatInvites = useMemo(() => {
    const serviceMap = new Map(professionalServices.map(s => [s.id, s]))
    const serviceOrder = new Map(professionalServices.map((s, i) => [s.id, i]))
    const formatServiceName = (ids: string[], fallback?: string | null) => {
      const sorted = ids.slice().sort((a, b) => (serviceOrder.get(a) ?? 999) - (serviceOrder.get(b) ?? 999))
      const names = sorted.map(sid => serviceMap.get(sid)?.name).filter(Boolean) as string[]
      if (names.length === 0) return fallback ?? "Select service"
      if (names.length === 1) return names[0]
      return `${names[0]} +${names.length - 1}`
    }
    // Deduplicate by invite id (since same invite fans out to multiple service buckets)
    const seen = new Set<string>()
    const nonOwner: (ProfessionalInviteSummary & { serviceName: string })[] = []
    for (const invites of Object.values(professionalInvites)) {
      for (const inv of invites) {
        if (inv.isOwner || seen.has(inv.id)) continue
        seen.add(inv.id)
        nonOwner.push({
          ...inv,
          serviceName: formatServiceName(inv.serviceIds),
        })
      }
    }
    // Sort non-owner by service order (primary service of each invite)
    nonOwner.sort((a, b) => {
      const aOrder = Math.min(...a.serviceIds.map(id => serviceOrder.get(id) ?? 999))
      const bOrder = Math.min(...b.serviceIds.map(id => serviceOrder.get(id) ?? 999))
      return aOrder - bOrder
    })
    // Owner card always first
    if (projectOwnerInvite) {
      return [{ ...projectOwnerInvite, serviceName: formatServiceName(projectOwnerInvite.serviceIds, projectOwnerInvite.primaryService) }, ...nonOwner]
    }
    return nonOwner
  }, [professionalInvites, professionalServices, projectOwnerInvite])

  return (
    <div className="min-h-screen bg-white">
      <style>{`
        .ec { position: relative; cursor: pointer; }
        .ec::before { content: ''; position: absolute; inset: -10px -14px; border: 1px solid transparent; border-radius: 5px; transition: border-color .18s; pointer-events: none; z-index: 0; }
        .ec:hover::before { border-color: #1c1c1a; }
        .ec.on::before  { border-color: #016D75; }
        .ec.on          { cursor: default; }
        .ec [contenteditable] { cursor: text; outline: none; }
        .ec [contenteditable]:empty::before { content: attr(data-placeholder); color: #c8c8c6; pointer-events: none; }
        .ec-badge { position: absolute; top: -19px; left: -8px; display: flex; align-items: center; gap: 4px; background: #fff; padding: 0 4px; pointer-events: none; z-index: 1; }
        .ec-ico { display: flex; align-items: center; color: #c8c8c6; transition: color .18s; }
        .ec-txt { font-size: 10px; font-weight: 400; letter-spacing: .04em; text-transform: uppercase; color: #c8c8c6; white-space: nowrap; transition: color .15s; }
        .ec:hover .ec-ico, .ec:hover .ec-txt { color: #1c1c1a; }
        .ec.on    .ec-ico, .ec.on    .ec-txt { color: #016D75; }
        .spec-item-edit { padding: 0; text-align: center; position: relative; cursor: pointer; transition: background .15s; z-index: 2; }
        .spec-item-edit::before { content: ''; position: absolute; inset: -32px -6px; border: 1px solid transparent; border-radius: 5px; pointer-events: none; transition: border-color .18s; background: white; z-index: -1; }
        .spec-item-edit:hover::before   { border-color: #1c1c1a; }
        .spec-item-edit.editing::before { border-color: #016D75; }
        .spec-item-edit .ec-badge { top: -40px; left: 50%; transform: translateX(-50%); padding: 0 6px; background: #fff; z-index: 2; }
        @media (max-width: 768px) {
          .edit-specs-bar { grid-template-columns: repeat(2, 1fr) !important; gap: 84px 16px !important; padding: 36px 0 !important; }
          .spec-item-edit::before { inset: -36px -8px; }
          .spec-item-edit .ec-badge { top: -44px; }
          .credits-grid { grid-template-columns: repeat(2, 1fr); }
          .edit-details-header { padding-left: 24px !important; padding-right: 24px !important; padding-top: 48px !important; padding-bottom: 48px !important; }
          .setup-nav-cta { font-size: 12px !important; padding: 6px 12px !important; white-space: nowrap; }
        }
        .spec-item-edit:hover   .ec-ico, .spec-item-edit:hover   .ec-txt { color: #1c1c1a; }
        .spec-item-edit.editing { z-index: 10; }
        .spec-item-edit.editing .ec-ico, .spec-item-edit.editing .ec-txt { color: #016D75; }
        .spec-item-edit.editing .spec-eyebrow { color: #016D75; }
        .dd-panel { position: absolute; left: 50%; transform: translateX(-50%); background: #fff; border: 1px solid #e8e8e6; border-radius: 7px; box-shadow: 0 12px 40px rgba(0,0,0,.12); overflow: hidden; overflow-y: auto; min-width: 180px; z-index: 20; top: calc(100% + 4px); }
        .dd-row { display: flex; align-items: center; justify-content: space-between; padding: 9px 14px; cursor: pointer; transition: background .1s; font-size: 13px; font-weight: 300; color: #1c1c1a; }
        .dd-row:hover { background: #f5f5f3; }
        .dd-row.sel   { font-weight: 500; }
        .dd-check     { color: #016D75; font-size: 11px; }
        .dd-group-label { padding: 8px 14px 4px; font-size: 11px; font-weight: 500; color: #a1a1a0; text-transform: uppercase; letter-spacing: .04em; }
        .spec-inp { width: 100%; text-align: center; font-size: 15px; font-weight: 500; color: #1c1c1a; background: transparent; border: none; border-bottom: 1px solid rgba(1,109,117,.3); outline: none; padding: 0 0 2px; font-family: inherit; }
        .spec-inp-inline { width: 100%; text-align: center; font-size: 15px; font-weight: 400; color: #1c1c1a; background: transparent; border: none; border-bottom: 1px solid transparent; outline: none; padding: 0 0 2px; font-family: inherit; cursor: pointer; line-height: 1.3; -moz-appearance: textfield; }
        .spec-inp-inline::-webkit-outer-spin-button, .spec-inp-inline::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .spec-inp-inline::placeholder { color: #b0b0ae; }
        .spec-inp-inline:read-only { pointer-events: none; }
        .spec-item-edit.editing .spec-inp-inline { border-bottom-color: rgba(1,109,117,.3); cursor: text; pointer-events: auto; }
        [contenteditable]:focus { outline: none; }
        [contenteditable]:empty:before { content: attr(data-placeholder); color: #b0b0ae; pointer-events: none; }
        .hero-add-photo-cta:hover { opacity: 0.8 !important; }
        .hero-cover-btn { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 2; display: inline-flex; align-items: center; gap: 7px; font-family: var(--font-sans); font-size: 13px; font-weight: 400; color: #fff; background: rgba(0,0,0,.45); border: 1px solid rgba(255,255,255,.25); border-radius: 100px; padding: 8px 18px; cursor: pointer; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); transition: background .15s, border-color .15s; }
        .hero-cover-btn:hover { background: rgba(0,0,0,.6); border-color: rgba(255,255,255,.4); }

        /* ── Professionals grid ── */
        .credit-card-edit { position: relative; text-align: center; display: block; cursor: pointer; }
        .credit-card-edit::before { content: ''; position: absolute; inset: -10px -14px; border: 1px solid transparent; border-radius: 5px; transition: border-color .18s; pointer-events: none; z-index: 0; }
        .credit-card-edit:hover::before { border-color: #1c1c1a; }
        .credit-card-edit .ec-badge { top: -19px; left: -8px; padding: 0 4px; background: #fff; z-index: 1; }
        .credit-card-edit:hover .ec-ico, .credit-card-edit:hover .ec-txt { color: #1c1c1a; }
        .card-del { position: absolute; top: -6px; right: -10px; width: 30px; height: 30px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; cursor: pointer; background: rgba(0,0,0,.45); color: #fff; border: 1px solid rgba(255,255,255,.2); opacity: 0; transition: opacity .15s, background .12s; z-index: 2; }
        .credit-card-edit:hover .card-del { opacity: 1; }
        .card-del:hover { background: rgba(210,40,40,.75) !important; border-color: transparent !important; }
        .add-pro-tile { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; align-self: stretch; min-height: 188px; }
        .add-pro-tile::before { content: ''; position: absolute; inset: -10px -14px; border: 1px dashed #c8c8c6; border-radius: 5px; transition: border-color .18s, background .18s; pointer-events: none; }
        .add-pro-tile:hover::before { border-color: #016D75; background: rgba(1,109,117,.03); }
        .add-pro-tile:hover .add-pro-icon { color: #016D75; }
        .add-pro-tile:hover .add-pro-label { color: #016D75; }
        .card-del-confirm { position: absolute; inset: -10px -14px; background: rgba(0,0,0,.7); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; z-index: 10; border-radius: 5px; }
        .card-del-confirm p { color: #fff; font-size: 13px; font-weight: 500; margin: 0; }
        .editable-hint { border-bottom: 1px dashed #d4d4d2; transition: border-color .15s; cursor: pointer; }
        .editable-hint:hover { border-color: #1c1c1a; }
        .card-field-inp { width: 100%; text-align: center; background: transparent; border: none; border-bottom: 1px dashed #d4d4d2; outline: none; padding: 0; margin: 0; font-family: var(--font-sans); }
        .email-prefix-inp { text-align: right; background: transparent; border: none; border-bottom: 1px dashed #016D75; outline: none; padding: 0; margin: 0; font: inherit; }
        .company-search-menu { position: absolute; left: 50%; transform: translateX(-50%); top: calc(100% + 6px); background: #fff; border: 1px solid #e8e8e6; border-radius: var(--radius-sm); box-shadow: 0 8px 28px rgba(0,0,0,.14); min-width: 280px; padding: 4px 0; z-index: 30; max-height: 240px; overflow-y: auto; }
        .company-search-row { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 7px 13px; font-size: 12.5px; font-weight: 300; color: #1c1c1a; cursor: pointer; gap: 8px; transition: background .1s; background: none; border: none; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .company-search-row:hover { background: #f5f5f3; }
        .company-search-row.sel { font-weight: 500; }
        .service-menu { position: absolute; left: 50%; transform: translateX(-50%); top: calc(100% + 6px); background: #fff; border: 1px solid #e8e8e6; border-radius: var(--radius-sm); box-shadow: 0 8px 28px rgba(0,0,0,.14); min-width: 220px; padding: 4px 0; z-index: 30; max-height: 300px; overflow-y: auto; }
        .service-group-label { padding: 8px 13px 4px; font-size: 10px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: #a1a1a0; pointer-events: none; }
        .service-row { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 6px 13px 6px 20px; font-size: 12.5px; font-weight: 300; color: #1c1c1a; cursor: pointer; gap: 8px; transition: background .1s; background: none; border: none; text-align: left; }
        .service-row:hover { background: #f5f5f3; }
        .service-row.sel { font-weight: 500; }
        .service-row.disabled { opacity: 0.35; cursor: not-allowed; }
        .service-row.disabled:hover { background: none; }
        .company-search-add { display: flex; align-items: center; gap: 7px; width: 100%; padding: 7px 13px; font-size: 12.5px; font-weight: 400; color: #016D75; cursor: pointer; background: none; border: none; text-align: left; transition: background .1s; }
        .company-search-add:hover { background: #f0fafa; }
        .tier-badge { font-size: 9px; font-weight: 600; letter-spacing: .04em; padding: 1px 5px; border-radius: 3px; text-transform: uppercase; flex-shrink: 0; }
        .tier-badge.arco { background: rgba(1,109,117,.1); color: #016D75; }
        .tier-badge.google { background: rgba(66,133,244,.1); color: #4285F4; }
        .company-search-divider { height: 1px; background: #e8e8e6; margin: 4px 0; }

        /* ── Tier badges ── */

        /* ── Photo edit grid ── */
        .photo-edit-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
        @media (max-width: 768px) {
          .photo-edit-grid { grid-template-columns: repeat(3, 1fr); gap: 6px; }
        }
        .photo-edit-thumb { position: relative; aspect-ratio: 4/3; overflow: hidden; background: #f0f0ee; }
        .photo-edit-thumb img { display: block; width: 100%; height: 100%; object-fit: cover; }

        /* Delete button — top right */
        .photo-del-btn { position: absolute; top: 8px; right: 8px; width: 30px; height: 30px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.45); color: #fff; border: 1px solid rgba(255,255,255,.2); cursor: pointer; opacity: 0; transition: opacity .15s, background .12s; z-index: 2; }
        .photo-edit-thumb:hover .photo-del-btn { opacity: 1; }
        .photo-del-btn:hover { background: rgba(210,40,40,.75) !important; border-color: transparent !important; }

        /* Reorder arrows — bottom center, visible on hover */
        .photo-reorder-arrows { position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); display: flex; gap: 4px; opacity: 0; transition: opacity .15s; z-index: 3; }
        .photo-edit-thumb:hover .photo-reorder-arrows { opacity: 1; }
        .photo-reorder-btn { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.55); color: #fff; border: 1px solid rgba(255,255,255,.25); cursor: pointer; transition: background .12s; }
        .photo-reorder-btn:hover { background: rgba(0,0,0,.75); }

        /* Delete confirmation overlay */
        .photo-del-confirm { position: absolute; inset: 0; background: rgba(0,0,0,.7); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; z-index: 10; }
        .photo-del-confirm p { color: #fff; font-size: 13px; font-weight: 500; margin: 0; }
        .photo-del-confirm-btns { display: flex; gap: 8px; }
        .photo-del-yes { padding: 6px 18px; background: #d42828; color: #fff; border-radius: var(--radius-sm); font-size: 12px; font-weight: 500; border: none; cursor: pointer; transition: background .12s; }
        .photo-del-yes:hover { background: #b91c1c; }
        .photo-del-no { padding: 6px 18px; background: rgba(255,255,255,.15); color: #fff; border-radius: var(--radius-sm); font-size: 12px; border: 1px solid rgba(255,255,255,.3); cursor: pointer; transition: background .12s; }
        .photo-del-no:hover { background: rgba(255,255,255,.25); }

        /* Room bar — bottom gradient */
        .photo-room-bar { position: absolute; bottom: 0; left: 0; right: 0; padding: 28px 10px 10px; background: linear-gradient(to top, rgba(0,0,0,.58) 0%, transparent 100%); opacity: 0; transition: opacity .16s; pointer-events: none; z-index: 2; }
        .photo-edit-thumb:hover .photo-room-bar { opacity: 1; pointer-events: auto; }
        .photo-room-trigger { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; color: rgba(255,255,255,.92); background: none; border: none; cursor: pointer; padding: 2px 4px; border-radius: 3px; white-space: nowrap; transition: background .12s; }
        .photo-room-trigger:hover { background: rgba(255,255,255,.14); }
        /* Space picker overlay */
        .photo-space-overlay { position: absolute; inset: 0; background: rgba(0,0,0,.72); display: flex; align-items: center; justify-content: center; z-index: 10; cursor: pointer; }
        .photo-space-pills { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; padding: 16px; max-width: 90%; }
        .photo-space-pill { padding: 5px 13px; font-size: 12px; font-weight: 400; color: rgba(255,255,255,.88); background: rgba(255,255,255,.13); border: 1px solid rgba(255,255,255,.22); border-radius: 100px; cursor: pointer; transition: all .12s; white-space: nowrap; }
        .photo-space-pill:hover { background: rgba(255,255,255,.22); border-color: rgba(255,255,255,.4); color: #fff; }
        .photo-space-pill.active { background: #fff; color: #1c1c1a; border-color: #fff; }

        .photo-add-tile { display: flex; flex-direction: column; align-items: center; justify-content: center; aspect-ratio: 4/3; border: 1px dashed #d4d4d2; cursor: pointer; transition: border-color .15s, background .15s; }
        .photo-add-tile:hover { border-color: #016D75; background: rgba(1,109,117,.03); }

        /* City lookup dropdown */
        .ccm-dropdown { border: 1px solid #e8e8e6; border-radius: 3px; box-shadow: 0 8px 28px rgba(0,0,0,.14); max-height: 280px; overflow-y: auto; padding: 4px 0; background: #fff; }
        .ccm-row { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 9px 14px; font-size: 13px; font-weight: 300; color: #1c1c1a; cursor: pointer; gap: 8px; transition: background .1s; background: none; border: none; text-align: left; }
        .ccm-row:hover { background: #f5f5f3; }
      `}</style>

      <Header navLinks={[{ href: "/dashboard/listings", label: "Listings" }, { href: "/dashboard/company", label: "Company" }, { href: "/dashboard/team", label: "Team" }, { href: "/dashboard/pricing", label: "Plans" }]} />

      <div>

        {/* ── Hero ──────────────────────────────────────────────── */}
        <section style={{
          position: "relative", width: "100%", height: "82vh", minHeight: 560,
          overflow: "hidden", background: "#111",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {coverPhotoUrl ? (
            <>
              <img
                src={coverPhotoUrl}
                alt="Cover photo"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
              />
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.18)" }} />
              {/* Change cover button */}
              <button
                onClick={() => setShowCoverPicker(true)}
                className="hero-cover-btn"
              >
                <ImageIcon size={14} />
                Change cover
              </button>

            </>
          ) : null}
        </section>

        {/* ── Cover photo picker popup ──────────────────────────── */}
        {showCoverPicker && (
          <div className="popup-overlay" onClick={() => setShowCoverPicker(false)}>
            <div className="popup-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
              <div className="popup-header">
                <h3 className="arco-section-title">Select cover photo</h3>
                <button type="button" className="popup-close" onClick={() => setShowCoverPicker(false)} aria-label="Close">✕</button>
              </div>
              <p className="arco-body-text" style={{ marginBottom: 20 }}>
                Choose which image to display as the project cover.
              </p>
              <div style={{ overflowY: "auto", maxHeight: "60vh" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {uploadedPhotos.map(photo => {
                    const isCurrent = photo.url === coverPhotoUrl
                    return (
                      <button
                        key={photo.id}
                        onClick={() => { setCoverPhoto(photo.id); setShowCoverPicker(false) }}
                        style={{ position: "relative", aspectRatio: "4/3", overflow: "hidden", borderRadius: 6, border: isCurrent ? "2px solid #016D75" : "2px solid transparent", cursor: "pointer", background: "#f0f0ee", padding: 0, transition: "border-color .15s" }}
                      >
                        <img src={photo.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        {isCurrent && (
                          <span style={{ position: "absolute", top: 6, right: 6, background: "#016D75", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 8l4 4 8-8" /></svg>
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Sub-nav ────────────────────────────────────────────── */}
        <EditSubNav
          statusIndicatorClass={statusIndicatorClass}
          currentStatusLabel={currentStatusLabel}
          editSaveStatus={editSaveStatus}
          detailsSaving={detailsSaving}
          locationSaving={locationSaving}
          onStatusClick={() => setShowStatusModal(true)}
          projectSlug={projectSlug}
          projectStatus={projectStatus}
          onSubmitForReview={handleShowSubmitReview}
          isSubmitting={isSubmittingForReview}
          isAdminReview={isAdminReview && isAdmin}
          onApprove={handleAdminApprove}
          onReject={() => setShowRejectModal(true)}
          isApproving={isApproving}
        />

        {/* ── Project header (editable title + description) ─────── */}
        <section
          id="details"
          className="edit-details-header"
          style={{ maxWidth: 800, margin: "0 auto", padding: "80px 24px 72px", textAlign: "center" }}
        >
          {/* Title */}
          <EditableTitle
            initialValue={detailsForm.projectTitle}
            onSave={handleTitleSave}
          />

          {/* Architect attribution */}
          {projectOwnerInvite?.companyName && (
            <p className="architect-attribution" style={{ textAlign: "center", marginBottom: 24 }}>
              by{' '}<span style={{ color: "var(--arco-black)", textDecoration: "none", borderBottom: "1px solid var(--arco-rule)", cursor: "default" }}>{projectOwnerInvite.companyName}</span>
            </p>
          )}

          {/* Description */}
          <div
            ref={descEcRef}
            className="ec"
            style={{ display: "block" }}
            data-submit-highlight={highlightMissingFields && !descriptionPlainText?.trim() ? "true" : undefined}
          >
            <span className="ec-badge">
              <span className="ec-ico">
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ display: "inline-block", flexShrink: 0 }}>
                  <path d="M11.5 1.5l3 3L5 14H2v-3z" />
                </svg>
              </span>
              <span className="ec-txt">Edit</span>
            </span>
            <p
              ref={descEditRef}
              className="arco-body-text"
              contentEditable
              suppressContentEditableWarning
              onFocus={handleDescEditFocus}
              onBlur={handleDescEditBlur}
              onInput={() => {
                setDescCharCount((descEditRef.current?.textContent?.trim() ?? "").length)
              }}
              style={{ cursor: "text", minHeight: "1.7em", textAlign: "center", outline: "none" }}
              data-placeholder="Add a project description…"
            >
              {descriptionPlainText || ""}
            </p>
            <div className="flex items-center justify-center" style={{ position: "relative" }}>
              <button
                type="button"
                className="ec-generate-link"
                onClick={(e) => { e.stopPropagation(); handleGenerateProjectDescription() }}
                disabled={generatingDesc}
              >
                {generatingDesc ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                      <path d="M21 12a9 9 0 11-6.219-8.56" />
                    </svg>
                    Generating…
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.937 15.5A2 2 0 008.5 14.063l-6.135-1.582a.5.5 0 010-.962L8.5 9.936A2 2 0 009.937 8.5l1.582-6.135a.5.5 0 01.963 0L14.063 8.5A2 2 0 0015.5 9.937l6.135 1.582a.5.5 0 010 .963L15.5 14.063a2 2 0 00-1.437 1.437l-1.582 6.135a.5.5 0 01-.963 0z" />
                    </svg>
                    {descriptionPlainText ? "Regenerate" : "Generate with AI"}
                  </>
                )}
              </button>
              {descEditing && (
                <span className={`text-[11px] absolute right-0 ${descCharCount > 750 ? "text-red-500" : "text-[#a1a1a0]"}`}>
                  {descCharCount} / 750
                </span>
              )}
            </div>
          </div>
        </section>

        {/* ── Specs bar ──────────────────────────────────────────── */}
        <div className="wrap">
          <div className="edit-specs-bar" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 32, padding: "32px 0", borderTop: "1px solid #e8e8e6", borderBottom: "1px solid #e8e8e6" }}>

          {/* Location */}
          <div
            className={`spec-item-edit${editingSpecBar === "location" ? " editing" : ""}`}
            data-submit-highlight={highlightMissingFields && !detailsForm.city?.trim() ? "true" : undefined}
            onClick={() => editingSpecBar !== "location" && setEditingSpecBar("location")}
          >
            <span className="ec-badge">
              <span className="ec-ico"><svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11.5 1.5l3 3L5 14H2v-3z" /></svg></span>
              <span className="ec-txt">Edit</span>
            </span>
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>Location</span>
            {editingSpecBar === "location" ? (
              <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
                <input
                  autoFocus
                  className="spec-inp"
                  value={cityQuery}
                  onChange={e => searchCity(e.target.value)}
                  placeholder="Search city…"
                  onKeyDown={e => {
                    if (e.key === "Escape") { setCityQuery(""); setCityResults([]); setEditingSpecBar(null) }
                  }}
                  onBlur={() => {
                    // Delay to allow dropdown onMouseDown to fire first
                    setTimeout(() => { setCityQuery(""); setCityResults([]); setEditingSpecBar(prev => prev === "location" ? null : prev) }, 150)
                  }}
                />
                {cityQuery.trim().length >= 2 && (
                  <div className="ccm-dropdown" style={{ position: "absolute", left: 0, right: 0, top: "100%", marginTop: 4, zIndex: 20 }}>
                    {cityResults.map(r => (
                      <button
                        key={r.placeId}
                        type="button"
                        className="ccm-row"
                        onMouseDown={e => { e.preventDefault(); handleSelectCity(r.mainText) }}
                      >
                        <span className="truncate">
                          <span style={{ fontWeight: 400 }}>{r.mainText}</span>
                          {r.secondaryText && <span style={{ color: "#a1a1a0", marginLeft: 4 }}>{r.secondaryText}</span>}
                        </span>
                      </button>
                    ))}
                    {isCitySearching && (
                      <div className="ccm-row" style={{ color: "#a1a1a0", cursor: "default" }}>Searching…</div>
                    )}
                    {!isCitySearching && cityResults.length === 0 && (
                      <div className="ccm-row" style={{ color: "#a1a1a0", cursor: "default" }}>No results found</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="arco-card-title" style={{ color: locationDisplayValue ? undefined : "#b0b0ae" }}>
                {locationDisplayValue || "Add location"}
              </div>
            )}
          </div>

          {/* Year */}
          <div
            className={`spec-item-edit${editingSpecBar === "year" ? " editing" : ""}`}
            onClick={() => editingSpecBar !== "year" && setEditingSpecBar("year")}
          >
            <span className="ec-badge">
              <span className="ec-ico"><svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11.5 1.5l3 3L5 14H2v-3z" /></svg></span>
              <span className="ec-txt">Edit</span>
            </span>
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>Year</span>
            <input
              type="number"
              className="spec-inp-inline"
              value={detailsForm.yearBuilt ?? ""}
              readOnly={editingSpecBar !== "year"}
              autoFocus={editingSpecBar === "year"}
              placeholder="Add year"
              min={1800}
              max={new Date().getFullYear()}
              onChange={e => setDetailsForm(prev => ({ ...prev, yearBuilt: e.target.value }))}
              onBlur={e => {
                const v = e.target.value.trim()
                const parsed = parseInt(v, 10)
                const valid = !isNaN(parsed) && parsed >= 1800 && parsed <= new Date().getFullYear()
                setDetailsForm(prev => ({ ...prev, yearBuilt: v }))
                saveSpecBarField("project_year", valid ? String(parsed) : "")
              }}
              onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur() }}
              onClick={e => { if (editingSpecBar === "year") e.stopPropagation() }}
            />
          </div>

          {/* Project Type */}
          <div
            className={`spec-item-edit${editingSpecBar === "type" ? " editing" : ""}`}
            data-submit-highlight={highlightMissingFields && !(detailsForm.category || detailsForm.projectType) ? "true" : undefined}
            style={{ position: "relative" }}
            onClick={() => editingSpecBar !== "type" && setEditingSpecBar("type")}
          >
            <span className="ec-badge">
              <span className="ec-ico"><svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11.5 1.5l3 3L5 14H2v-3z" /></svg></span>
              <span className="ec-txt">Edit</span>
            </span>
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>Type</span>
            <div className="arco-card-title" style={{ color: projectTypeLabel ? undefined : "#b0b0ae" }}>
              {projectTypeLabel || "Select type"}
            </div>
            {editingSpecBar === "type" && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={e => { e.stopPropagation(); setEditingSpecBar(null) }} />
                <div className="dd-panel" style={{ maxHeight: 320, overflowY: "auto" }}>
                  {categoryOptions.map(cat => {
                    const subtypes = projectTypeOptionsByCategory[cat.value] ?? []
                    return (
                      <div key={cat.value}>
                        {subtypes.length > 0 ? (
                          <>
                            <div className="dd-group-label">{cat.label}</div>
                            {subtypes.map(opt => (
                              <div
                                key={opt.value}
                                className={`dd-row${opt.value === detailsForm.projectType ? " sel" : ""}`}
                                onClick={e => {
                                  e.stopPropagation()
                                  setDetailsForm(prev => ({ ...prev, projectType: opt.value, category: cat.value }))
                                  setEditingSpecBar(null)
                                  void saveFieldDirect({ project_type_category_id: opt.value })
                                }}
                              >
                                <span>{opt.label}</span>
                                {opt.value === detailsForm.projectType && <span className="dd-check">✓</span>}
                              </div>
                            ))}
                          </>
                        ) : (
                          <div
                            className={`dd-row${cat.value === detailsForm.projectType ? " sel" : ""}`}
                            onClick={e => {
                              e.stopPropagation()
                              setDetailsForm(prev => ({ ...prev, projectType: cat.value, category: cat.value }))
                              setEditingSpecBar(null)
                              void saveFieldDirect({ project_type_category_id: cat.value })
                            }}
                          >
                            <span>{cat.label}</span>
                            {cat.value === detailsForm.projectType && <span className="dd-check">✓</span>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* Scope */}
          <div
            className={`spec-item-edit${editingSpecBar === "scope" ? " editing" : ""}`}
            data-submit-highlight={highlightMissingFields && !specScope ? "true" : undefined}
            style={{ position: "relative" }}
            onClick={() => editingSpecBar !== "scope" && setEditingSpecBar("scope")}
          >
            <span className="ec-badge">
              <span className="ec-ico"><svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11.5 1.5l3 3L5 14H2v-3z" /></svg></span>
              <span className="ec-txt">Edit</span>
            </span>
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>Scope</span>
            <div className="arco-card-title" style={{ color: specScope ? undefined : "#b0b0ae" }}>
              {specScope || "Select scope"}
            </div>
            {editingSpecBar === "scope" && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={e => { e.stopPropagation(); setEditingSpecBar(null) }} />
                <div className="dd-panel">
                  {SCOPE_OPTIONS.map(opt => (
                    <div
                      key={opt}
                      className={`dd-row${opt === specScope ? " sel" : ""}`}
                      onClick={e => { e.stopPropagation(); setSpecScope(opt); saveSpecBarField("project_type", opt) }}
                    >
                      <span>{opt}</span>
                      {opt === specScope && <span className="dd-check">✓</span>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Style */}
          <div
            className={`spec-item-edit${editingSpecBar === "style" ? " editing" : ""}`}
            data-submit-highlight={highlightMissingFields && !detailsForm.projectStyle ? "true" : undefined}
            style={{ position: "relative" }}
            onClick={() => editingSpecBar !== "style" && setEditingSpecBar("style")}
          >
            <span className="ec-badge">
              <span className="ec-ico"><svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11.5 1.5l3 3L5 14H2v-3z" /></svg></span>
              <span className="ec-txt">Edit</span>
            </span>
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>Style</span>
            <div className="arco-card-title" style={{ color: styleLabel ? undefined : "#b0b0ae" }}>
              {styleLabel || "Select style"}
            </div>
            {editingSpecBar === "style" && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={e => { e.stopPropagation(); setEditingSpecBar(null) }} />
                <div className="dd-panel">
                  {sortedProjectStyleOptions.map(opt => (
                    <div
                      key={opt.value}
                      className={`dd-row${opt.value === detailsForm.projectStyle ? " sel" : ""}`}
                      onClick={e => { e.stopPropagation(); setDetailsForm(prev => ({ ...prev, projectStyle: opt.value })); setEditingSpecBar(null); void saveFieldDirect({ style_preferences: opt.value ? [opt.value] : null }) }}
                    >
                      <span>{opt.label}</span>
                      {opt.value === detailsForm.projectStyle && <span className="dd-check">✓</span>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          </div>
        </div>

        {/* ── Photos ────────────────────────────────────────────────── */}
        <section id="photos" className="wrap" style={{ paddingTop: 72, paddingBottom: 0 }}>
          <div style={{ marginBottom: 28 }}>
            <h2 className="arco-section-title">Photo tour</h2>
            <p className="arco-body-text" style={{ marginTop: 6 }}>Add photos to showcase your project and organise them by space.</p>
          </div>
          {renderPhotoTourSection()}
        </section>

        {/* ── Professionals ─────────────────────────────────────────── */}
        <section id="professionals" className="wrap" style={{ paddingTop: 72, paddingBottom: 120 }}>
          <div style={{ marginBottom: 40 }}>
            <h2 className="arco-section-title">Credited professionals</h2>
            <p className="arco-body-text" style={{ marginTop: 6, maxWidth: 600 }}>
              The trusted team behind this project. Click any field to edit.
            </p>
          </div>

          {professionalsError && (
            <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e", borderRadius: 4, padding: "10px 14px", marginBottom: 20, fontSize: 13 }}>
              {professionalsError}
            </div>
          )}

          <div className="credits-grid">
            {flatInvites.map(inv => {
              const initials = inv.companyName
                ? (inv.companyName.split(" ").filter(Boolean).length >= 2
                    ? inv.companyName.split(" ").filter(Boolean).slice(0, 2).map((w: string) => w[0]).join("")
                    : inv.companyName.substring(0, 2))
                : inv.serviceName.substring(0, 2)
              const isEditingService = editingInviteField?.inviteId === inv.id && editingInviteField.field === "service"
              const isEditingCompany = editingInviteField?.inviteId === inv.id && editingInviteField.field === "company"
              const isEditingEmail   = editingInviteField?.inviteId === inv.id && editingInviteField.field === "email"
              const isConfirmingDelete = confirmDeleteInviteId === inv.id
              // Owner card: service dropdown uses company's services; non-owner uses all project services
              // Owner → owner company services; Arco company with services → that company's services; otherwise → all
              const serviceDropdownOptions = inv.isOwner
                ? ownerCompanyServices
                : (inv.companyId && inviteCompanyServices[inv.companyId]?.length)
                  ? inviteCompanyServices[inv.companyId]
                  : professionalServices
              return (
                <div
                  key={inv.id}
                  className="credit-card-edit"
                  style={{ overflow: isConfirmingDelete ? "visible" : undefined }}
                  onClick={!inv.isOwner && inv.status === "invited" && !inv.isListedCompany && !isEditingCompany && !isEditingService && !isEditingEmail
                    ? () => setEditingInviteField({ inviteId: inv.id, field: "email" })
                    : undefined}
                >
                  <span className="ec-badge">
                    <span className="ec-ico"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5Z"/></svg></span>
                    <span className="ec-txt">Edit</span>
                  </span>
                  {/* Delete button — only for non-owner cards */}
                  {!inv.isOwner && (
                    <button
                      className="card-del"
                      onClick={e => { e.stopPropagation(); setConfirmDeleteInviteId(inv.id) }}
                      aria-label="Remove"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}

                  {/* Delete confirmation overlay */}
                  {isConfirmingDelete && (
                    <div className="card-del-confirm">
                      <p>Delete?</p>
                      <div className="photo-del-confirm-btns">
                        <button className="photo-del-yes" onClick={e => { e.stopPropagation(); setConfirmDeleteInviteId(null); void handleDeleteInvite(inv) }}>Yes</button>
                        <button className="photo-del-no" onClick={e => { e.stopPropagation(); setConfirmDeleteInviteId(null) }}>No</button>
                      </div>
                    </div>
                  )}

                  {/* Service type — clickable dropdown */}
                  <div style={{ position: "relative", marginBottom: 16 }}>
                    <span
                      className="arco-eyebrow editable-hint"
                      style={{ display: "inline", cursor: "pointer", paddingBottom: 1, color: inv.serviceIds.length > 0 ? undefined : "#016D75" }}
                      onClick={e => { e.stopPropagation(); setEditingInviteField({ inviteId: inv.id, field: "service" }) }}
                    >
                      {inv.serviceName}
                    </span>
                    {isEditingService && (() => {
                      const groups: { label: string; items: typeof serviceDropdownOptions }[] = []
                      const seen = new Set<string>()
                      for (const s of serviceDropdownOptions) {
                        const label = (s as any).parentName ?? "Other"
                        if (!seen.has(label)) { seen.add(label); groups.push({ label, items: [] }) }
                        groups.find(g => g.label === label)!.items.push(s)
                      }
                      return (
                        <>
                          <div style={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={() => setEditingInviteField(null)} />
                          <div className="service-menu">
                            {groups.map((g, gi) => (
                              <div key={g.label}>
                                {gi > 0 && <div className="company-search-divider" />}
                                <div className="service-group-label">{g.label}</div>
                                {g.items.map(s => {
                                  const isSelected = inv.serviceIds.includes(s.id)
                                  const atMax = !isSelected && inv.serviceIds.length >= 3
                                  return (
                                  <button
                                    key={s.id}
                                    className={`service-row${isSelected ? " sel" : ""}${atMax ? " disabled" : ""}`}
                                    disabled={atMax}
                                    onClick={e => {
                                      e.stopPropagation()
                                      if (isSelected) {
                                        // Remove service from array
                                        const newIds = inv.serviceIds.filter(sid => sid !== s.id)
                                        if (newIds.length === 0) {
                                          toast.error("At least one service is required")
                                          return
                                        }
                                        void supabase.from("project_professionals").update({ invited_service_category_ids: newIds } as any).eq("id", inv.id).then(() => refreshProfessionalSection())
                                      } else {
                                        if (inv.serviceIds.length >= 3) {
                                          toast.error("Maximum 3 services per professional")
                                          return
                                        }
                                        void supabase.from("project_professionals").update({ invited_service_category_ids: [...inv.serviceIds, s.id] } as any).eq("id", inv.id).then(() => refreshProfessionalSection())
                                      }
                                      setEditingInviteField(null)
                                    }}
                                  >
                                    <span>{s.name}</span>
                                    {isSelected && (
                                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="#016D75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 8l4 4 8-8" /></svg>
                                    )}
                                  </button>
                                  )
                                })}
                              </div>
                            ))}
                          </div>
                        </>
                      )
                    })()}
                  </div>

                  {/* Icon */}
                  <div className="credit-icon">
                    {inv.companyLogo ? (
                      <img src={inv.companyLogo} alt={inv.companyName ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                    ) : (
                      <span className="credit-icon-initials">{initials}</span>
                    )}
                  </div>

                  {/* Company name — non-editable for owner, search input for others */}
                  <div style={{ position: "relative", width: "100%", marginBottom: 6 }}>
                    <h3
                      className="arco-h4"
                      style={{ cursor: inv.isOwner ? undefined : "text", color: !inv.isOwner && !inv.companyName && !isEditingCompany ? "#b0b0ae" : undefined }}
                      onClick={inv.isOwner ? undefined : (e => {
                        e.stopPropagation()
                        if (!isEditingCompany) {
                          companySearchActive.current = false
                          selectAllOnMount.current = false
                          setCompanySearchQuery(inv.companyName ?? "")
                          setCompanySearchResults([])
                          setGoogleResults([])
                          setEditingInviteField({ inviteId: inv.id, field: "company" })
                        }
                      })}
                      onDoubleClick={inv.isOwner ? undefined : (e => {
                        e.stopPropagation()
                        if (!isEditingCompany) {
                          companySearchActive.current = false
                          selectAllOnMount.current = true
                          setCompanySearchQuery(inv.companyName ?? "")
                          setCompanySearchResults([])
                          setGoogleResults([])
                          setEditingInviteField({ inviteId: inv.id, field: "company" })
                        }
                      })}
                    >
                      {inv.isOwner ? (
                        inv.companyName || "Your company"
                      ) : isEditingCompany ? (
                        <>
                          <div style={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={e => { e.stopPropagation(); setEditingInviteField(null); setCompanySearchQuery(""); setCompanySearchResults([]); setGoogleResults([]); companySearchActive.current = false }} />
                          <input
                            ref={el => {
                              if (el && selectAllOnMount.current) {
                                selectAllOnMount.current = false
                                requestAnimationFrame(() => el.select())
                              }
                            }}
                            autoFocus
                            className="card-field-inp"
                            style={{ fontSize: "inherit", fontWeight: "inherit", lineHeight: "inherit" }}
                            value={companySearchQuery}
                            onChange={e => { companySearchActive.current = true; searchCompanies(e.target.value) }}
                            placeholder="Search company…"
                            onClick={e => e.stopPropagation()}
                          />
                          {companySearchActive.current && (companySearchResults.length > 0 || googleResults.length > 0 || companySearchQuery.trim().length >= 2) && (
                            <div className="company-search-menu">
                              {companySearchResults.map(c => (
                                <button
                                  key={c.id}
                                  className={`company-search-row${c.id === inv.companyId ? " sel" : ""}`}
                                  onClick={e => {
                                    e.stopPropagation()
                                    if (c.owner_id || inv.email) {
                                      // Claimed company or card already has email — just link, no email prompt
                                      void saveInviteCompany(inv.id, c.id, c.email || inv.email)
                                    } else {
                                      // Unclaimed company + no email on card — show email field with domain prefill
                                      const domain = c.domain?.replace(/^https?:\/\//i, "").replace(/^www\./, "").split("/")[0] ?? null
                                      setPendingTier23({
                                        inviteId: inv.id,
                                        companyName: c.name,
                                        googlePlaceId: null,
                                        city: c.city,
                                        prefillEmail: domain ? `@${domain}` : null,
                                        website: null,
                                        domain,
                                        phone: null,
                                        fullAddress: null,
                                        country: null,
                                        stateRegion: null,
                                        editorialSummary: null,
                                        googleTypes: null,
                                      })
                                      // Link the company immediately
                                      void saveInviteCompany(inv.id, c.id, null)
                                      // Then show email field
                                      setEditingInviteField({ inviteId: inv.id, field: "email" })
                                      setCompanySearchQuery("")
                                      setCompanySearchResults([])
                                      setGoogleResults([])
                                    }
                                  }}
                                >
                                  <span>{c.name}{c.city ? ` · ${c.city}` : ""}</span>
                                  <span className="tier-badge arco">{c.owner_id ? "On Arco" : "Invited"}</span>
                                </button>
                              ))}
                              {googleResults.length > 0 && companySearchResults.length > 0 && <div className="company-search-divider" />}
                              {googleResults.map(g => (
                                <button
                                  key={g.placeId}
                                  className="company-search-row"
                                  onClick={e => { e.stopPropagation(); handleSelectTier23Company(inv.id, g.name, g.placeId, g.city) }}
                                >
                                  <span>{g.name}{g.city ? ` · ${g.city}` : ""}</span>
                                  <span className="tier-badge google">Google</span>
                                </button>
                              ))}
                              {companySearchQuery.trim().length >= 2 && !isSearchingCompanies && !companySearchResults.some(c => c.name.toLowerCase() === companySearchQuery.trim().toLowerCase()) && (
                                <>
                                  {(companySearchResults.length > 0 || googleResults.length > 0) && <div className="company-search-divider" />}
                                  <div
                                    className="company-search-add"
                                    style={{ cursor: "default", opacity: 0.5 }}
                                    onClick={e => { e.stopPropagation(); toast.info("Manual company creation is not available. Select a company from the search results.") }}
                                  >
                                    <Plus size={12} />
                                    <span>Add &ldquo;{companySearchQuery.trim()}&rdquo;</span>
                                  </div>
                                </>
                              )}
                              {isSearchingCompanies && (
                                <div className="company-search-row" style={{ color: "#a1a1a0", cursor: "default" }}>Searching…</div>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="editable-hint">{inv.companyName || "Company name"}</span>
                      )}
                    </h3>
                  </div>

                  {/* Subtitle: status label or email input for pending invites */}
                  {pendingTier23?.inviteId === inv.id ? (
                    <p
                      className="arco-card-subtitle"
                      style={{ marginBottom: 0, cursor: "pointer", color: "#016D75" }}
                      onClick={e => { e.stopPropagation(); setEditingInviteField({ inviteId: inv.id, field: "email" }) }}
                    >
                      {isEditingEmail ? (
                        pendingTier23.domain ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 0 }}>
                            <input
                              autoFocus
                              className="email-prefix-inp"
                              ref={el => { if (el) autoSizeInput(el) }}
                              defaultValue=""
                              onChange={e => autoSizeInput(e.target)}
                              onBlur={e => {
                                const name = e.target.value.trim()
                                if (name) void saveTier23Company(inv.id, `${name}@${pendingTier23.domain}`)
                              }}
                              onKeyDown={e => {
                                if (e.key === "Enter") {
                                  const name = (e.target as HTMLInputElement).value.trim()
                                  if (name) void saveTier23Company(inv.id, `${name}@${pendingTier23.domain}`)
                                }
                                if (e.key === "Escape") { setEditingInviteField(null); setPendingTier23(null) }
                              }}
                              placeholder="name"
                              onClick={e => e.stopPropagation()}
                            />
                            <span style={{ color: "var(--arco-mid-grey)" }}>@{pendingTier23.domain}</span>
                          </span>
                        ) : (
                          <input
                            autoFocus
                            className="card-field-inp"
                            style={{ fontSize: "inherit", fontWeight: "inherit", lineHeight: "inherit", color: "inherit" }}
                            defaultValue=""
                            onBlur={e => void saveTier23Company(inv.id, e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") void saveTier23Company(inv.id, (e.target as HTMLInputElement).value)
                              if (e.key === "Escape") { setEditingInviteField(null); setPendingTier23(null) }
                            }}
                            placeholder="Enter email to send invite…"
                            onClick={e => e.stopPropagation()}
                          />
                        )
                      ) : (
                        <span className="editable-hint">{pendingTier23.domain ? `name@${pendingTier23.domain}` : "Enter email to send invite…"}</span>
                      )}
                    </p>
                  ) : isEditingEmail && !inv.isOwner && inv.status === "invited" && !inv.isListedCompany ? (
                    <p
                      className="arco-card-subtitle"
                      style={{ marginBottom: 0, color: "#016D75" }}
                    >
                      {(() => {
                        const emailParts = inv.email?.split("@") ?? []
                        const emailDomain = emailParts.length === 2 ? emailParts[1] : null
                        const emailPrefix = emailParts.length === 2 ? emailParts[0] : inv.email ?? ""
                        return emailDomain ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 0 }}>
                            <input
                              autoFocus
                              className="email-prefix-inp"
                              ref={el => { if (el) autoSizeInput(el) }}
                              defaultValue={emailPrefix}
                              onChange={e => autoSizeInput(e.target)}
                              onBlur={async e => {
                                const name = e.target.value.trim()
                                if (name && name !== emailPrefix) {
                                  const newEmail = `${name}@${emailDomain}`
                                  try {
                                    await supabase.from("project_professionals").update({ invited_email: newEmail }).eq("id", inv.id)
                                    await refreshProfessionalSection()
                                    toast.success("Email updated")
                                  } catch { toast.error("Failed to update email") }
                                }
                                setEditingInviteField(null)
                              }}
                              onKeyDown={async e => {
                                if (e.key === "Enter") {
                                  const name = (e.target as HTMLInputElement).value.trim()
                                  if (name && name !== emailPrefix) {
                                    const newEmail = `${name}@${emailDomain}`
                                    try {
                                      await supabase.from("project_professionals").update({ invited_email: newEmail }).eq("id", inv.id)
                                      await refreshProfessionalSection()
                                      toast.success("Email updated")
                                    } catch { toast.error("Failed to update email") }
                                  }
                                  setEditingInviteField(null)
                                }
                                if (e.key === "Escape") setEditingInviteField(null)
                              }}
                              placeholder="name"
                              onClick={e => e.stopPropagation()}
                            />
                            <span style={{ color: "var(--arco-mid-grey)" }}>@{emailDomain}</span>
                          </span>
                        ) : (
                          <input
                            autoFocus
                            className="card-field-inp"
                            style={{ fontSize: "inherit", fontWeight: "inherit", lineHeight: "inherit", color: "inherit" }}
                            defaultValue={inv.email ?? ""}
                            onBlur={async e => {
                              const newEmail = e.target.value.trim()
                              if (newEmail && newEmail !== inv.email) {
                                try {
                                  await supabase.from("project_professionals").update({ invited_email: newEmail }).eq("id", inv.id)
                                  await refreshProfessionalSection()
                                  toast.success("Email updated")
                                } catch { toast.error("Failed to update email") }
                              }
                              setEditingInviteField(null)
                            }}
                            onKeyDown={async e => {
                              if (e.key === "Enter") {
                                const newEmail = (e.target as HTMLInputElement).value.trim()
                                if (newEmail && newEmail !== inv.email) {
                                  try {
                                    await supabase.from("project_professionals").update({ invited_email: newEmail }).eq("id", inv.id)
                                    await refreshProfessionalSection()
                                    toast.success("Email updated")
                                  } catch { toast.error("Failed to update email") }
                                }
                                setEditingInviteField(null)
                              }
                              if (e.key === "Escape") setEditingInviteField(null)
                            }}
                            placeholder="Enter email…"
                            onClick={e => e.stopPropagation()}
                          />
                        )
                      })()}
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center justify-center gap-1.5" style={{ marginTop: 4 }}>
                        <span className="status-pill">
                          {(() => {
                            const isPublished = projectStatus === "published" || projectStatus === "completed"
                            const isPending = inv.status === "invited" && !isPublished
                            const dotClass = inv.isOwner ? "owner" : isPending ? "pending" : inv.status === "live_on_page" ? "featured" : inv.status
                            const label = inv.isOwner ? "Owner" : isPending ? "Pending" : inv.status === "live_on_page" ? "Featured" : inv.status === "listed" ? "Listed" : inv.status === "invited" ? "Invited" : inv.status === "unlisted" ? "Unlisted" : inv.status.replace(/_/g, " ")
                            return <><span className={`status-pill-dot status-pill-dot--${dotClass}`} />{label}</>
                          })()}
                        </span>
                        {inv.status === "invited" && !inv.isOwner && (
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation()
                              const result = await sendInviteEmailAction({
                                email: inv.email,
                                projectId: projectId!,
                                inviterName: "Project owner",
                                projectTitle: detailsForm.projectTitle || "Project",
                              })
                              if (result.success) {
                                toast.success(`Invite resent to ${inv.email}`)
                              } else {
                                toast.error("Failed to resend invite")
                              }
                            }}
                            className="group/resend inline-flex items-center gap-1 rounded-full px-1.5 py-1 text-[#016D75] transition-all hover:bg-[#016D75]/8"
                            aria-label="Resend invite"
                          >
                            <RotateCw className="h-3 w-3 shrink-0" />
                            <span className="max-w-0 overflow-hidden whitespace-nowrap text-[11px] font-medium opacity-0 transition-all duration-200 group-hover/resend:max-w-[80px] group-hover/resend:opacity-100">Resend</span>
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}

            {/* Draft card — new professional being added */}
            {draftCard && (
              <div className="credit-card-edit">
                <span className="ec-badge">
                  <span className="ec-ico"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5Z"/></svg></span>
                  <span className="ec-txt">Edit</span>
                </span>
                <button
                  className="card-del"
                  onClick={() => { setDraftCard(null); setPendingTier23(null); setEditingInviteField(null) }}
                  aria-label="Remove"
                >
                  <Trash2 size={13} />
                </button>

                {/* Service — dropdown */}
                <div style={{ position: "relative", marginBottom: 16 }}>
                  <span
                    className="arco-eyebrow editable-hint"
                    style={{ display: "inline", cursor: "pointer", paddingBottom: 1, color: draftCard.serviceIds.length > 0 ? undefined : "#016D75" }}
                    onClick={e => { e.stopPropagation(); setEditingInviteField({ inviteId: "__draft__", field: "service" }) }}
                  >
                    {draftCard.serviceName || "Select service"}
                  </span>
                  {editingInviteField?.inviteId === "__draft__" && editingInviteField.field === "service" && (() => {
                    // Use company-specific services if the draft has an Arco company
                    const draftCompanyServices = draftCard.companyId && inviteCompanyServices[draftCard.companyId]?.length
                      ? inviteCompanyServices[draftCard.companyId]
                      : null
                    const serviceOptions = draftCompanyServices ?? professionalServices
                    const groups: { label: string; items: typeof serviceOptions }[] = []
                    const seen = new Set<string>()
                    for (const s of serviceOptions) {
                      const label = (s as any).parentName ?? "Other"
                      if (!seen.has(label)) { seen.add(label); groups.push({ label, items: [] }) }
                      groups.find(g => g.label === label)!.items.push(s)
                    }
                    return (
                      <>
                        <div style={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={() => setEditingInviteField(null)} />
                        <div className="service-menu">
                          {groups.map((g, gi) => (
                            <div key={g.label}>
                              {gi > 0 && <div className="company-search-divider" />}
                              <div className="service-group-label">{g.label}</div>
                              {g.items.map(s => {
                                const isSelected = draftCard.serviceIds.includes(s.id)
                                const atMax = !isSelected && draftCard.serviceIds.length >= 3
                                return (
                                <button
                                  key={s.id}
                                  className={`service-row${isSelected ? " sel" : ""}${atMax ? " disabled" : ""}`}
                                  disabled={atMax}
                                  onClick={e => {
                                    e.stopPropagation()
                                    setDraftCard(d => {
                                      if (!d) return d
                                      if (!isSelected && d.serviceIds.length >= 3) {
                                        toast.error("Maximum 3 services per professional")
                                        return d
                                      }
                                      const newIds = isSelected ? d.serviceIds.filter(sid => sid !== s.id) : [...d.serviceIds, s.id]
                                      const serviceOrderMap = new Map(serviceOptions.map((ps, i) => [ps.id, i]))
                                      const sorted = newIds.slice().sort((a, b) => (serviceOrderMap.get(a) ?? 999) - (serviceOrderMap.get(b) ?? 999))
                                      const names = sorted.map(sid => serviceOptions.find(ps => ps.id === sid)?.name).filter(Boolean) as string[]
                                      const displayName = names.length <= 1 ? (names[0] ?? "Select service") : `${names[0]} +${names.length - 1}`
                                      return { ...d, serviceIds: newIds, serviceName: displayName }
                                    })
                                    setEditingInviteField(null)
                                  }}
                                >
                                  <span>{s.name}</span>
                                  {isSelected && (
                                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="#016D75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 8l4 4 8-8" /></svg>
                                  )}
                                </button>
                                )
                              })}
                            </div>
                          ))}
                        </div>
                      </>
                    )
                  })()}
                </div>

                {/* Icon */}
                <div className="credit-icon">
                  {draftCard.companyLogo ? (
                    <img src={draftCard.companyLogo} alt={draftCard.companyName} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                  ) : (
                    <span className="credit-icon-initials" style={{ color: draftCard.companyName ? undefined : "#d4d4d2" }}>
                      {draftCard.companyName
                        ? draftCard.companyName.split(" ").filter(Boolean).slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()
                        : "?"}
                    </span>
                  )}
                </div>

                {/* Company name — search */}
                <div style={{ position: "relative", width: "100%", marginBottom: 6 }}>
                  <h3
                    className="arco-h4"
                    style={{ cursor: "text", color: draftCard.companyName && !(editingInviteField?.inviteId === "__draft__" && editingInviteField.field === "company") ? undefined : "#b0b0ae" }}
                    onClick={e => {
                      e.stopPropagation()
                      if (!(editingInviteField?.inviteId === "__draft__" && editingInviteField.field === "company")) {
                        companySearchActive.current = false
                        selectAllOnMount.current = false
                        setCompanySearchQuery(draftCard.companyName)
                        setCompanySearchResults([])
                        setGoogleResults([])
                        setEditingInviteField({ inviteId: "__draft__", field: "company" })
                      }
                    }}
                    onDoubleClick={e => {
                      e.stopPropagation()
                      companySearchActive.current = false
                      selectAllOnMount.current = true
                      setCompanySearchQuery(draftCard.companyName)
                      setCompanySearchResults([])
                      setGoogleResults([])
                      setEditingInviteField({ inviteId: "__draft__", field: "company" })
                    }}
                  >
                    {editingInviteField?.inviteId === "__draft__" && editingInviteField.field === "company" ? (
                      <>
                        <div style={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={e => { e.stopPropagation(); setEditingInviteField(null); setCompanySearchQuery(""); setCompanySearchResults([]); setGoogleResults([]); companySearchActive.current = false }} />
                        <input
                          ref={el => {
                            if (el && selectAllOnMount.current) {
                              selectAllOnMount.current = false
                              requestAnimationFrame(() => el.select())
                            }
                          }}
                          autoFocus
                          className="card-field-inp"
                          style={{ fontSize: "inherit", fontWeight: "inherit", lineHeight: "inherit" }}
                          value={companySearchQuery}
                          onChange={e => { companySearchActive.current = true; searchCompanies(e.target.value) }}
                          placeholder="Search company…"
                          onClick={e => e.stopPropagation()}
                        />
                        {companySearchActive.current && (companySearchResults.length > 0 || googleResults.length > 0 || companySearchQuery.trim().length >= 2) && (
                          <div className="company-search-menu">
                            {companySearchResults.map(c => (
                              <button
                                key={c.id}
                                className="company-search-row"
                                onClick={e => { e.stopPropagation(); void saveDraftCardWithCompany(c.id, c.email, !!c.owner_id) }}
                              >
                                <span>{c.name}{c.city ? ` · ${c.city}` : ""}</span>
                                <span className="tier-badge arco">{c.owner_id ? "On Arco" : "Invited"}</span>
                              </button>
                            ))}
                            {googleResults.length > 0 && companySearchResults.length > 0 && <div className="company-search-divider" />}
                            {googleResults.map(g => (
                              <button
                                key={g.placeId}
                                className="company-search-row"
                                onClick={e => { e.stopPropagation(); setDraftCard(d => d ? { ...d, companyName: g.name } : d); handleSelectTier23Company("__draft__", g.name, g.placeId, g.city) }}
                              >
                                <span>{g.name}{g.city ? ` · ${g.city}` : ""}</span>
                                <span className="tier-badge google">Google</span>
                              </button>
                            ))}
                            {companySearchQuery.trim().length >= 2 && !isSearchingCompanies && !companySearchResults.some(c => c.name.toLowerCase() === companySearchQuery.trim().toLowerCase()) && (
                              <>
                                {(companySearchResults.length > 0 || googleResults.length > 0) && <div className="company-search-divider" />}
                                <div
                                  className="company-search-add"
                                  style={{ cursor: "default", opacity: 0.5 }}
                                  onClick={e => { e.stopPropagation(); toast.info("Manual company creation is not available. Select a company from the search results.") }}
                                >
                                  <Plus size={12} />
                                  <span>Add &ldquo;{companySearchQuery.trim()}&rdquo;</span>
                                </div>
                              </>
                            )}
                            {isSearchingCompanies && (
                              <div className="company-search-row" style={{ color: "#a1a1a0", cursor: "default" }}>Searching…</div>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="editable-hint">{draftCard.companyName || "Company name"}</span>
                    )}
                  </h3>
                </div>

                {/* Email — only shown for tier 2/3 (Places / manual) companies */}
                {pendingTier23?.inviteId === "__draft__" && (
                  <p
                    className="arco-card-subtitle"
                    style={{ marginBottom: 0, cursor: "pointer", color: "#016D75" }}
                    onClick={e => { e.stopPropagation(); setEditingInviteField({ inviteId: "__draft__", field: "email" }) }}
                  >
                    {editingInviteField?.inviteId === "__draft__" && editingInviteField.field === "email" ? (
                      pendingTier23.domain ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 0 }}>
                          <input
                            autoFocus
                            className="email-prefix-inp"
                            ref={el => { if (el) autoSizeInput(el) }}
                            defaultValue=""
                            onChange={e => autoSizeInput(e.target)}
                            onBlur={e => {
                              const name = e.target.value.trim()
                              if (name) void saveTier23Company("__draft__", `${name}@${pendingTier23.domain}`)
                            }}
                            onKeyDown={e => {
                              if (e.key === "Enter") {
                                const name = (e.target as HTMLInputElement).value.trim()
                                if (name) void saveTier23Company("__draft__", `${name}@${pendingTier23.domain}`)
                              }
                              if (e.key === "Escape") { setEditingInviteField(null); setPendingTier23(null) }
                            }}
                            placeholder="name"
                            onClick={e => e.stopPropagation()}
                          />
                          <span style={{ color: "var(--arco-mid-grey)" }}>@{pendingTier23.domain}</span>
                        </span>
                      ) : (
                        <input
                          autoFocus
                          className="card-field-inp"
                          style={{ fontSize: "inherit", fontWeight: "inherit", lineHeight: "inherit", color: "inherit" }}
                          defaultValue=""
                          onBlur={e => void saveTier23Company("__draft__", e.target.value.trim())}
                          onKeyDown={e => {
                            if (e.key === "Enter") void saveTier23Company("__draft__", (e.target as HTMLInputElement).value.trim())
                            if (e.key === "Escape") { setEditingInviteField(null); setPendingTier23(null) }
                          }}
                          placeholder="Enter email to send invite…"
                          onClick={e => e.stopPropagation()}
                        />
                      )
                    ) : (
                      <span className="editable-hint">{pendingTier23.domain ? `name@${pendingTier23.domain}` : "Enter email to send invite…"}</span>
                    )}
                  </p>
                )}
              </div>
            )}

            {/* Add Professional card */}
            <div
              className="add-pro-tile"
              onClick={() => { if (!draftCard) setDraftCard({ serviceIds: [], serviceName: "", companyName: "", companyLogo: null, email: "" }) }}
              style={draftCard ? { opacity: 0.4, cursor: "default" } : undefined}
            >
              <Plus size={18} className="add-pro-icon" style={{ color: "#a1a1a0", marginBottom: 4, transition: "color .18s" }} />
              <span className="add-pro-label" style={{ fontSize: 12, color: "#a1a1a0", letterSpacing: ".03em", fontWeight: 400, transition: "color .18s" }}>Add professional</span>
            </div>
          </div>

          {/* Dedup warning dialog */}
          {dupWarning && (
            <div className="popup-overlay" onClick={() => setDupWarning(null)}>
              <div className="popup-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                <div className="popup-header">
                  <h3 className="arco-section-title">Company found on Arco</h3>
                  <button type="button" className="popup-close" onClick={() => setDupWarning(null)} aria-label="Close">✕</button>
                </div>
                <p className="arco-body-text" style={{ marginBottom: 16 }}>
                  This company is already on Arco. Link them to credit their work on this project.
                </p>

                {/* Company preview */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "var(--arco-off-white)", borderRadius: 6, marginBottom: 20 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--arco-surface)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                    {dupWarning.existingLogo ? (
                      <img src={dupWarning.existingLogo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span style={{ fontSize: 14, fontWeight: 300, color: "var(--arco-mid)" }}>
                        {dupWarning.existingName.split(" ").filter(Boolean).length >= 2
                          ? dupWarning.existingName.split(" ")[0][0] + dupWarning.existingName.split(" ")[1][0]
                          : dupWarning.existingName.substring(0, 2)}
                      </span>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--arco-black)" }}>{dupWarning.existingName}</div>
                    <div style={{ fontSize: 12, color: "var(--arco-mid-grey)" }}>
                      {dupWarning.existingProjectCount} {dupWarning.existingProjectCount === 1 ? "project" : "projects"}
                    </div>
                  </div>
                </div>

                <div className="popup-actions">
                  <button className="btn-tertiary" onClick={() => setDupWarning(null)} style={{ flex: 1 }}>
                    Cancel
                  </button>
                  <button className="btn-primary" onClick={() => void handleDupLinkExisting()} style={{ flex: 1 }}>
                    Link company
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

      </div>

      {/* ── Delete project ─────────────────────────────────────── */}
      {!isAdminReview && (
        <section className="wrap" style={{ padding: "0 60px 60px" }}>
          <hr style={{ border: "none", borderTop: "1px solid var(--arco-rule)", margin: "0 0 24px" }} />
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 13, fontWeight: 300, padding: 0,
              color: "#dc2626", background: "none",
              border: "none", cursor: "pointer",
            }}
          >
            <Trash2 size={14} />
            Delete project
          </button>
        </section>
      )}

      <Footer maxWidth="max-w-7xl" />

      {/* ── Modals ──────────────────────────────────────────────────── */}
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
        isDraft={projectStatus === "draft"}
        onSubmitForReview={handleSubmitForReview}
        isSubmittingForReview={isSubmittingForReview}
        limitReachedForNewActivation={limitReachedForNewActivation}
      />

      {featurePhotoSelectorModal}

      {/* Select services popup */}
      {isServiceModalOpen && (
        <div className="popup-overlay" onClick={() => handleServiceModalOpenChange(false)}>
          <div
            className="popup-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 640, maxHeight: "80vh", display: "flex", flexDirection: "column", padding: 0 }}
          >
            {/* Header — grey background */}
            <div
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "20px 28px",
                background: "var(--arco-off-white)", borderRadius: "12px 12px 0 0", flexShrink: 0,
              }}
            >
              <h3 className="arco-section-title" style={{ margin: 0 }}>Select professional services</h3>
              <button type="button" className="popup-close" onClick={() => handleServiceModalOpenChange(false)} aria-label="Close">
                ✕
              </button>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 28px 28px" }}>
              {professionalServices.length === 0 ? (
                <p className="arco-body-text" style={{ color: "var(--arco-mid-grey)" }}>
                  Professional services are not available right now. Please try again later.
                </p>
              ) : (
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
                  {professionalServices.map((service) => {
                    const isSelected = serviceSelectionDraft.includes(service.id)
                    const IconComponent = resolveProfessionalServiceIcon(service.slug, service.parentName)
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => toggleServiceInDraft(service.id)}
                        aria-pressed={isSelected}
                        style={{
                          display: "flex", flexDirection: "column", padding: 14, borderRadius: 8,
                          border: isSelected ? "2px solid var(--arco-black)" : "2px solid var(--arco-light-grey)",
                          background: isSelected ? "var(--arco-off-white)" : "#fff",
                          textAlign: "left", cursor: "pointer", transition: "border-color 0.15s",
                        }}
                      >
                        <IconComponent aria-hidden style={{ width: 22, height: 22, marginBottom: 10 }} />
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{service.name}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Sticky footer */}
            <div
              style={{
                display: "flex", gap: 10, justifyContent: "flex-end",
                padding: "16px 28px", borderTop: "1px solid var(--arco-rule)",
                background: "var(--arco-off-white)", borderRadius: "0 0 12px 12px", flexShrink: 0,
              }}
            >
              <button type="button" className="btn-tertiary" onClick={() => handleServiceModalOpenChange(false)} disabled={isUpdatingServices} style={{ fontSize: 14, padding: "10px 20px" }}>
                Cancel
              </button>
              <button type="button" className="btn-secondary" onClick={() => void handleSaveServiceSelection()} disabled={isUpdatingServices} style={{ fontSize: 14, padding: "10px 20px" }}>
                {isUpdatingServices ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite professional popup */}
      {inviteDialogOpen && (
        <div className="popup-overlay" onClick={() => handleInviteDialogChange(false)}>
          <div
            className="popup-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 440, display: "flex", flexDirection: "column", padding: 0 }}
          >
            {/* Header — grey background */}
            <div
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "20px 28px",
                background: "var(--arco-off-white)", borderRadius: "12px 12px 0 0", flexShrink: 0,
              }}
            >
              <h3 className="arco-section-title" style={{ margin: 0 }}>{editingInviteId ? "Update invite" : "Invite professional"}</h3>
              <button type="button" className="popup-close" onClick={() => handleInviteDialogChange(false)} aria-label="Close">
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "12px 28px 28px" }}>
              {inviteServiceId && (
                <p className="arco-body-text" style={{ color: "var(--arco-mid-grey)", marginBottom: 16 }}>
                  Service: {professionalServices.find(s => s.id === inviteServiceId)?.name}
                </p>
              )}

              {inviteError && (
                <div style={{ marginBottom: 16, padding: 12, borderRadius: 6, background: "#fef2f2", border: "1px solid #fecaca", fontSize: 13, color: "#b91c1c" }}>
                  {inviteError}
                </div>
              )}

              <div>
                <label htmlFor="invite-email" style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--arco-black)" }}>
                  Company email address
                </label>
                <input
                  id="invite-email"
                  type="email"
                  className="form-input"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  disabled={isInviteMutating}
                  placeholder="name@company.com"
                  style={{ marginBottom: 0 }}
                />
                <p className="arco-body-text" style={{ color: "var(--arco-mid-grey)", marginTop: 8, fontSize: 13 }}>
                  No invites are sent until the project is approved by Arco.
                </p>
              </div>
            </div>

            {/* Sticky footer */}
            <div
              style={{
                display: "flex", gap: 10, justifyContent: "flex-end",
                padding: "16px 28px", borderTop: "1px solid var(--arco-rule)",
                background: "var(--arco-off-white)", borderRadius: "0 0 12px 12px", flexShrink: 0,
              }}
            >
              <button type="button" className="btn-tertiary" onClick={() => handleInviteDialogChange(false)} disabled={isInviteMutating} style={{ fontSize: 14, padding: "10px 20px" }}>
                Cancel
              </button>
              <button type="button" className="btn-secondary" onClick={() => void handleInviteSubmit()} disabled={isInviteMutating} style={{ fontSize: 14, padding: "10px 20px" }}>
                {isInviteMutating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add to project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Submit for review popup ──────────────────────────── */}
      {showSubmitReviewPopup && (() => {
        const title = detailsForm.projectTitle?.trim()
        const desc = descriptionPlainText?.trim()
        const location = detailsForm.city?.trim()
        const type = detailsForm.category || detailsForm.projectType
        const scope = specScope
        const style = detailsForm.projectStyle
        const photoCount = uploadedPhotos.length
        const taggedPhotoIds = new Set<string>()
        for (const photoIds of Object.values(featurePhotos)) {
          for (const pid of photoIds) taggedPhotoIds.add(pid)
        }
        const taggedCount = taggedPhotoIds.size
        const profCount = flatInvites.length

        const required = [
          { label: "Project name", ok: Boolean(title) },
          { label: "Description", ok: Boolean(desc) },
          { label: "Location", ok: Boolean(location) },
          { label: "Type", ok: Boolean(type) },
          { label: "Scope", ok: Boolean(scope) },
          { label: "Style", ok: Boolean(style) },
          { label: "Minimum 5 photos", ok: photoCount >= 5 },
        ]
        const allRequiredMet = required.every(r => r.ok)

        const recommendations = [
          { label: "Add 20+ photos for a complete project showcase", ok: photoCount >= 20 },
          { label: "Tag photos to spaces for a guided photo tour", ok: photoCount > 0 && taggedCount === photoCount },
          { label: "Credit 5+ professionals to increase project visibility", ok: profCount >= 5 },
        ]

        return (
          <div className="popup-overlay" onClick={() => setShowSubmitReviewPopup(false)}>
            <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
              <div className="popup-header">
                <h3 className="arco-section-title">Submit for review</h3>
                <button type="button" className="popup-close" onClick={() => setShowSubmitReviewPopup(false)} aria-label="Close">✕</button>
              </div>

              {/* Required fields */}
              <p style={{ fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--arco-mid-grey)", marginBottom: 12 }}>Required</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
                {required.map(r => (
                  <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 300, color: r.ok ? "var(--arco-mid-grey)" : "#dc2626" }}>
                    {r.ok ? (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#016D75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 8l4 4 8-8" /></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"><circle cx="8" cy="8" r="6" /></svg>
                    )}
                    {r.label}
                  </div>
                ))}
              </div>

              {/* Recommendations */}
              <p style={{ fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--arco-mid-grey)", marginBottom: 12 }}>Recommended</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
                {recommendations.map(r => (
                  <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 300, color: r.ok ? "var(--arco-mid-grey)" : "var(--arco-mid-grey)" }}>
                    {r.ok ? (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#016D75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 8l4 4 8-8" /></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#d4d4d2" strokeWidth="2" strokeLinecap="round"><circle cx="8" cy="8" r="6" /></svg>
                    )}
                    {r.label}
                  </div>
                ))}
              </div>

              {/* Info note */}
              {profCount > 0 && (
                <p style={{ fontSize: 12, fontWeight: 300, color: "var(--arco-mid-grey)", marginBottom: 20, lineHeight: 1.5 }}>
                  Credited professionals will be invited to Arco once your project is approved and listed.
                </p>
              )}

              {/* Actions */}
              <div className="popup-actions">
                <button className="btn-tertiary" onClick={() => { setShowSubmitReviewPopup(false); if (!allRequiredMet) setHighlightMissingFields(true) }} style={{ flex: 1 }}>
                  Back to editing
                </button>
                <button
                  className="btn-primary"
                  disabled={!allRequiredMet || isSubmittingForReview}
                  onClick={handleSubmitForReview}
                  style={{ flex: 1 }}
                >
                  {isSubmittingForReview ? "Submitting…" : "Submit"}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Admin rejection modal ─────────────────────────────── */}
      {showRejectModal && (
        <div className="popup-overlay" onClick={() => { if (!isRejecting) { setShowRejectModal(false); setRejectionReason(""); setSelectedRejectionReasons([]) } }}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Reject project</h3>
              <button
                type="button"
                className="popup-close"
                onClick={() => { setShowRejectModal(false); setRejectionReason(""); setSelectedRejectionReasons([]) }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: 13, fontWeight: 300, color: "var(--arco-light)", margin: "0 0 16px" }}>
              Select one or more reasons for rejecting this project.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {REJECTION_REASONS.map((reason) => {
                const isSelected = selectedRejectionReasons.includes(reason)
                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setSelectedRejectionReasons((prev) =>
                      isSelected ? prev.filter((r) => r !== reason) : [...prev, reason]
                    )}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 14px", borderRadius: 3, cursor: "pointer",
                      fontSize: 13, fontWeight: 400, textAlign: "left",
                      background: isSelected ? "var(--arco-surface)" : "#fff",
                      border: isSelected ? "1px solid #1c1c1a" : "1px solid #e5e5e4",
                      color: "#1c1c1a", transition: "border-color .15s, background .15s",
                    }}
                  >
                    <span style={{
                      width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                      border: isSelected ? "none" : "1.5px solid #d4d4d2",
                      background: isSelected ? "#1c1c1a" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                          <path d="M3 8l4 4 6-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    {reason}
                  </button>
                )
              })}

              {/* Other — with free text */}
              <div>
                <button
                  type="button"
                  onClick={() => {
                    if (rejectionReason) {
                      setRejectionReason("")
                    } else {
                      setRejectionReason(" ")
                    }
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    padding: "10px 14px", borderRadius: rejectionReason ? "3px 3px 0 0" : 3, cursor: "pointer",
                    fontSize: 13, fontWeight: 400, textAlign: "left",
                    background: rejectionReason ? "var(--arco-surface)" : "#fff",
                    border: rejectionReason ? "1px solid #1c1c1a" : "1px solid #e5e5e4",
                    borderBottom: rejectionReason ? "none" : undefined,
                    color: "#1c1c1a", transition: "border-color .15s, background .15s",
                  }}
                >
                  <span style={{
                    width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                    border: rejectionReason ? "none" : "1.5px solid #d4d4d2",
                    background: rejectionReason ? "#1c1c1a" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {rejectionReason && (
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8l4 4 6-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  Other
                </button>
                {rejectionReason !== "" && (
                  <textarea
                    className="w-full px-3 py-2 text-sm outline-none transition-colors resize-none"
                    style={{
                      border: "1px solid #1c1c1a", borderTop: "none",
                      borderRadius: "0 0 3px 3px", background: "var(--arco-surface)",
                    }}
                    rows={2}
                    placeholder="Describe the reason…"
                    value={rejectionReason.trim() === "" ? "" : rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    autoFocus
                  />
                )}
              </div>
            </div>
            <div className="popup-actions">
              <button
                type="button"
                className="btn-tertiary"
                onClick={() => { setShowRejectModal(false); setRejectionReason(""); setSelectedRejectionReasons([]) }}
                disabled={isRejecting}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void handleAdminReject()}
                disabled={isRejecting || (selectedRejectionReasons.length === 0 && !rejectionReason.trim())}
                style={{ flex: 1 }}
              >
                {isRejecting ? "Rejecting…" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete project confirmation ───────────────────────── */}
      {showDeleteConfirm && (
        <div className="popup-overlay" onClick={() => { if (!isDeletingProject) { setShowDeleteConfirm(false); setDeleteConfirmText("") } }}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Delete project</h3>
              <button type="button" className="popup-close" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText("") }} aria-label="Close">
                ✕
              </button>
            </div>
            <p style={{ fontSize: 13, fontWeight: 300, color: "var(--arco-light)", margin: "0 0 16px" }}>
              Permanently delete this project and all associated data. This action cannot be undone.
            </p>

            <div className="popup-banner popup-banner--danger">
              <AlertTriangle className="popup-banner-icon" />
              <span>This project will be permanently deleted. This cannot be undone.</span>
            </div>

            <div className="popup-banner popup-banner--warn">
              <AlertTriangle className="popup-banner-icon" />
              <span>This project will disappear from the portfolio of all credited professionals.</span>
            </div>

            <p className="body-small text-text-secondary mb-3">
              Type <strong>DELETE</strong> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3 py-2 text-sm border border-border rounded-[3px] mb-4 focus:outline-none focus:border-foreground"
            />

            <div className="popup-actions">
              <button
                type="button"
                className="btn-tertiary"
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText("") }}
                disabled={isDeletingProject}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmText !== "DELETE" || isDeletingProject}
                onClick={() => void handleDeleteProject()}
                className={`flex-1 font-normal py-3 px-4 border-none rounded-[3px] cursor-pointer transition-opacity ${
                  deleteConfirmText === "DELETE"
                    ? "bg-red-600 text-white"
                    : "bg-surface text-text-secondary"
                } ${isDeletingProject ? "opacity-60" : ""}`}
                style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: 15 }}
              >
                {isDeletingProject ? "Deleting…" : "Delete project"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
