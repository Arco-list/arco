"use client"

import { DashboardHeader } from "@/components/dashboard-header"
import { Footer } from "@/components/footer"
import Link from "next/link"
import { MoreHorizontal, Check, AlertTriangle, X } from "lucide-react"
import { useEffect, useMemo, useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import type { Database, Enums } from "@/lib/supabase/types"
import { DashboardListingsFilter, type FilterState } from "@/components/dashboard-listings-filter"
import { toast } from "sonner"
import { useTableRLSValidation } from "@/hooks/useRLSValidation"
import { useCompanyEntitlements } from "@/hooks/use-company-entitlements"
import {
  ListingStatusModal,
  type ListingStatusModalOption,
  type ListingStatusModalProject,
} from "@/components/listing-status-modal"

type ProjectStatus = Enums<"project_status">

type ProjectPhotoRow = Pick<
  Database["public"]["Tables"]["project_photos"]["Row"],
  "id" | "url" | "is_primary" | "order_index"
>

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"] & {
  project_photos: ProjectPhotoRow[] | null
  project_professionals: {
    is_project_owner: boolean
  }[] | null
}

type ListingProjectPhoto = {
  id: string
  url: string
  isPrimary: boolean
  orderIndex: number | null
}

type ListingProject = {
  id: string
  title: string
  status: ProjectStatus
  statusLabel: string
  statusChipClass: string
  slug: string | null
  subtitle: string
  styleLabel: string | null
  locationLabel: string | null
  coverImageUrl: string
  coverPhotoId: string | null
  photos: ListingProjectPhoto[]
  createdAt: string
  role: "owner" | "contributor"
  projectType: string
  projectYear: number | null
  hasMetadataError?: boolean // Track projects with failed metadata resolution
}

const isUuid = (value?: string | null): value is string =>
  !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

const STATUS_CONFIG: Record<
  ProjectStatus,
  {
    label: string
    chipClass: string
  }
> = {
  draft: { label: "In progress", chipClass: "bg-amber-100 text-amber-800" },
  in_progress: { label: "In review", chipClass: "bg-blue-100 text-blue-800" },
  published: { label: "Live on page", chipClass: "bg-green-100 text-green-800" },
  completed: { label: "Listed", chipClass: "bg-emerald-100 text-emerald-800" },
  archived: { label: "Unlisted", chipClass: "bg-slate-200 text-slate-700" },
}

const CURRENT_YEAR = new Date().getFullYear()
const MIN_YEAR = 2000
const LISTING_STATUS_VALUES = ["published", "completed", "archived"] as const
type ListingStatusValue = (typeof LISTING_STATUS_VALUES)[number]

const ACTIVE_STATUS_VALUES: ReadonlyArray<ListingStatusValue> = ["published", "completed"]
const BASIC_ACTIVE_LIMIT = 3

const isListingStatusValue = (status: ProjectStatus | string): status is ListingStatusValue =>
  LISTING_STATUS_VALUES.includes(status as ListingStatusValue)

export default function DashboardListingsPage() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), [])

  // SECURITY: Validate RLS policies are enforced
  const { isSecure: isRLSSecure, loading: rlsLoading } = useTableRLSValidation("projects", {
    enabled: process.env.NODE_ENV === "development", // Enable in dev, optional in prod
  })

  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [coverPhotoModalOpen, setCoverPhotoModalOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<ListingProject | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<ListingStatusValue | "">("")
  const [selectedCoverPhoto, setSelectedCoverPhoto] = useState<string | null>(null)
  const [isSavingCoverPhoto, setIsSavingCoverPhoto] = useState(false)
  const [isSavingStatus, setIsSavingStatus] = useState(false)
  const [pendingDeleteProject, setPendingDeleteProject] = useState<ListingProject | null>(null)
  const [projects, setProjects] = useState<ListingProject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [metadataError, setMetadataError] = useState<string | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)
  const [projectsWithErrors, setProjectsWithErrors] = useState<Set<string>>(new Set())
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    keyword: "",
    statuses: [],
    roles: [],
    yearFrom: MIN_YEAR,
    yearTo: CURRENT_YEAR,
  })
  // LRU-style cache with size limit to prevent unbounded memory growth
  const taxonomyCacheRef = useRef<{
    styles: Map<string, string>
    accessOrder: string[]
  }>({
    styles: new Map(),
    accessOrder: [],
  })
  const MAX_CACHE_SIZE = 100 // Reasonable limit for taxonomy options
  const router = useRouter()
  const { planTier, isPlus, error: entitlementsError } = useCompanyEntitlements()
  const companyPlan: "basic" | "plus" = planTier ?? "basic"
  const [userId, setUserId] = useState<string | null>(null)

  // Track in-flight requests to prevent race conditions
  const abortControllerRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)
  const [retryTrigger, setRetryTrigger] = useState(0)

  useEffect(() => {
    // RACE CONDITION FIX: Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new AbortController for this request
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    // Assign unique request ID for deduplication
    const currentRequestId = ++requestIdRef.current
    let isActive = true
    let metadataErrorShown = false

    const loadProjects = async () => {
      // Check if request was already aborted
      if (abortController.signal.aborted) {
        return
      }

      setIsLoading(true)
      setLoadError(null)

      const { data: authData, error: authError } = await supabase.auth.getUser()

      // RACE CONDITION CHECK: Ensure this request is still valid
      if (abortController.signal.aborted || !isActive) {
        return
      }

      if (!authData?.user || authError) {
        setUserId(null)
        if (isActive && !abortController.signal.aborted) {
          setLoadError(authError?.message ?? "You need to be signed in to view your projects.")
          setProjects([])
          setIsLoading(false)
        }
        return
      }

      setUserId(authData.user.id)

      // Single optimized query with JOINs to fetch projects with resolved labels
      const { data, error } = await supabase
        .from("projects")
        .select(
          `
          id,
          title,
          status,
          slug,
          project_type,
          project_type_category_id,
          style_preferences,
          address_city,
          address_region,
          created_at,
          project_year,
          client_id,
          project_type_category:categories!projects_project_type_category_id_fkey(name, slug),
          project_photos(id, url, is_primary, order_index),
          project_professionals(is_project_owner)
          `
        )
        .eq("client_id", authData.user.id)
        .order("updated_at", { ascending: false })

      // RACE CONDITION CHECK: After async operation
      if (abortController.signal.aborted || !isActive) {
        return
      }

      if (error) {
        if (isActive && !abortController.signal.aborted) {
          setLoadError(error.message)
          setProjects([])
          setIsLoading(false)
        }
        return
      }

      const projectRows = (data ?? []) as (ProjectRow & {
        project_type_category: { name: string | null } | null
      })[]

      // Collect style IDs that need resolution (styles can't be JOINed due to array column)
      const styleOptionIds = new Set<string>()
      projectRows.forEach((project) => {
        project.style_preferences?.forEach((value) => {
          if (isUuid(value)) {
            styleOptionIds.add(value)
          }
        })
      })

      const taxonomyCache = taxonomyCacheRef.current
      const missingStyleOptionIds = Array.from(styleOptionIds).filter(
        (id) => !taxonomyCache.styles.has(id),
      )

      let metadataLoadFailed = false
      const failedStyleIds = new Set<string>()

      // Only fetch styles (categories already JOINed)
      if (missingStyleOptionIds.length > 0) {
        // RACE CONDITION CHECK: Before metadata fetch
        if (abortController.signal.aborted || !isActive) {
          return
        }

        const { data: stylesData, error: stylesError } = await supabase
          .from("project_taxonomy_options")
          .select("id, name")
          .in("id", missingStyleOptionIds)

        // RACE CONDITION CHECK: After metadata fetch
        if (abortController.signal.aborted || !isActive) {
          return
        }

        if (stylesError) {
          metadataLoadFailed = true
          console.error("Failed to resolve style labels", { error: stylesError })
          // Track which style IDs failed to resolve
          missingStyleOptionIds.forEach((id) => failedStyleIds.add(id))
        } else {
          stylesData?.forEach((row) => {
            if (row.id && row.name) {
              // LRU cache eviction: remove oldest entry if cache is full
              if (taxonomyCache.styles.size >= MAX_CACHE_SIZE) {
                const oldestKey = taxonomyCache.accessOrder.shift()
                if (oldestKey) {
                  taxonomyCache.styles.delete(oldestKey)
                }
              }
              taxonomyCache.styles.set(row.id, row.name)
              taxonomyCache.accessOrder.push(row.id)
            }
          })
        }
      }

      // Persistent metadata error state (not dismissible via toast)
      // RACE CONDITION CHECK: Before showing toast
      if (metadataLoadFailed && isActive && !metadataErrorShown && !abortController.signal.aborted) {
        metadataErrorShown = true
        const errorMessage = "Some project details couldn't be loaded. This may affect how projects are displayed."
        setMetadataError(errorMessage)
        toast.error("Metadata loading failed", {
          description: "Some project details may be missing. Use the retry button to try again.",
          duration: 5000,
        })
      }

      const styleMap = taxonomyCache.styles

      const normalized: ListingProject[] = projectRows.map((project) => {
        const statusKey = project.status as ProjectStatus
        const statusConfig = STATUS_CONFIG[statusKey] ?? {
          label: statusKey,
          chipClass: "bg-slate-200 text-slate-700",
        }

        const rawPhotos = project.project_photos ?? []
        const normalizedPhotos: ListingProjectPhoto[] = rawPhotos
          .filter((photo): photo is ProjectPhotoRow & { id: string; url: string } => {
            return Boolean(photo && photo.id && photo.url)
          })
          .map((photo) => ({
            id: photo.id,
            url: photo.url,
            isPrimary: Boolean(photo.is_primary),
            orderIndex: photo.order_index,
          }))
          .sort((a, b) => {
            const aIndex = a.orderIndex ?? Number.MAX_SAFE_INTEGER
            const bIndex = b.orderIndex ?? Number.MAX_SAFE_INTEGER
            return aIndex - bIndex
          })

        const primaryPhoto = normalizedPhotos.find((photo) => photo.isPrimary) ?? normalizedPhotos[0] ?? null
        const coverImageUrl = primaryPhoto?.url ?? "/placeholder.svg"
        const coverPhotoId = primaryPhoto?.id ?? null

        const rawStyle = project.style_preferences?.[0] ?? null
        // Check if this project's style failed to resolve
        const hasStyleError = !!(rawStyle && isUuid(rawStyle) && failedStyleIds.has(rawStyle))
        const styleLabel = rawStyle
          ? isUuid(rawStyle)
            ? styleMap.get(rawStyle) ?? ""
            : rawStyle
          : ""

        // Prefer the relational category label when available, otherwise fall back to legacy text
        const projectTypeLabel = project.project_type_category?.name ??
          (project.project_type && !isUuid(project.project_type) ? project.project_type : "")

        const locationParts = [project.address_city, project.address_region].filter(Boolean).join(", ")
        const subtitlePieces = [styleLabel, projectTypeLabel].filter(Boolean)
        const styleType = subtitlePieces.join(" ")
        const subtitle = [styleType, locationParts ? `in ${locationParts}` : null]
          .filter(Boolean)
          .join(" ") || "Add more project details"

        // Determine role: owner if client_id matches, otherwise check project_professionals
        const isOwner = project.client_id === authData.user.id
        const isProjectOwner = project.project_professionals?.some((pp) => pp.is_project_owner) ?? false
        const role: "owner" | "contributor" = isOwner ? "owner" : isProjectOwner ? "owner" : "contributor"

        return {
          id: project.id,
          title: project.title,
          status: statusKey,
          statusLabel: statusConfig.label,
          statusChipClass: statusConfig.chipClass,
          slug: project.slug ?? null,
          subtitle,
          styleLabel: styleLabel || null,
          locationLabel: locationParts ? locationParts : null,
          coverImageUrl,
          coverPhotoId,
          photos: normalizedPhotos,
          createdAt: project.created_at ?? new Date().toISOString(),
          role,
          projectType: projectTypeLabel,
          projectYear: project.project_year,
          hasMetadataError: hasStyleError, // Flag projects with failed metadata resolution
        }
      })

      // RACE CONDITION CHECK: Final state update with request ID verification
      if (isActive && !abortController.signal.aborted && currentRequestId === requestIdRef.current) {
        // Track projects with metadata errors globally
        const errorProjectIds = normalized
          .filter((p) => p.hasMetadataError)
          .map((p) => p.id)
        setProjectsWithErrors(new Set(errorProjectIds))
        setProjects(normalized)
        setIsLoading(false)
      }
    }

    void loadProjects()

    // Cleanup function to abort request and mark as inactive
    return () => {
      isActive = false
      abortController.abort()
    }
  }, [supabase, retryTrigger])

  // Retry mechanism for failed metadata loads
  const handleRetryMetadata = useCallback(() => {
    setIsRetrying(true)
    setMetadataError(null)

    // Clear the taxonomy cache to force refetch
    taxonomyCacheRef.current = {
      styles: new Map(),
      accessOrder: [],
    }

    // Trigger useEffect to reload projects
    setRetryTrigger((prev) => prev + 1)

    // Reset retrying state after a delay
    setTimeout(() => {
      setIsRetrying(false)
    }, 1000)
  }, [])

  const handleUpdateStatus = (project: ListingProject) => {
    if (project.status === "draft") {
      router.push(`/new-project/details?projectId=${project.id}`)
      return
    }

    setSelectedProject(project)
    const initialStatus = isListingStatusValue(project.status) ? project.status : ""
    setSelectedStatus(initialStatus)
    setStatusModalOpen(true)
    setOpenDropdown(null)
  }

  const handleCloseStatusModal = useCallback(() => {
    setStatusModalOpen(false)
    setSelectedProject(null)
    setSelectedStatus("")
  }, [])

  const handleEditCoverImage = (project: ListingProject) => {
    const initialCoverPhotoId = project.coverPhotoId ?? project.photos[0]?.id ?? null
    setSelectedProject(project)
    setSelectedCoverPhoto(initialCoverPhotoId)
    setCoverPhotoModalOpen(true)
    setOpenDropdown(null)
  }

  const closeCoverPhotoModal = useCallback(() => {
    setCoverPhotoModalOpen(false)
    setSelectedProject(null)
    setSelectedCoverPhoto(null)
  }, [])

  const handleSaveStatus = async () => {
    if (!selectedProject || !selectedStatus) {
      handleCloseStatusModal()
      return
    }

    if (selectedStatus === selectedProject.status) {
      handleCloseStatusModal()
      return
    }

    const statusOption = statusOptions.find((option) => option.value === selectedStatus)
    if (!statusOption) {
      toast.error("Select a valid status before saving.")
      return
    }

    if (statusOption.requiresPlus && !isPlus) {
      toast.error("Upgrade to Plus to make this project discoverable.")
      return
    }

    if (!userId) {
      toast.error("We couldn't verify your account. Please refresh and try again.")
      return
    }

    setIsSavingStatus(true)

    try {
      const { error } = await supabase
        .from("projects")
        .update({ status: selectedStatus })
        .eq("id", selectedProject.id)
        .eq("client_id", userId)

      if (error) {
        throw error
      }

      const statusConfig = STATUS_CONFIG[selectedStatus as ProjectStatus]

      setProjects((prev) =>
        prev.map((project) => {
          if (project.id !== selectedProject.id) {
            return project
          }

          return {
            ...project,
            status: selectedStatus,
            statusLabel: statusConfig.label,
            statusChipClass: statusConfig.chipClass,
          }
        }),
      )

      toast.success("Listing status updated")
      handleCloseStatusModal()
    } catch (error) {
      console.error("Failed to update listing status", error)
      toast.error("We couldn't update the listing status. Please try again.")
    } finally {
      setIsSavingStatus(false)
    }
  }

  const handleSaveCoverPhoto = async () => {
    if (!selectedProject) {
      return
    }

    if (!selectedCoverPhoto) {
      toast.error("Select a cover photo to continue.", {
        duration: 4000,
      })
      return
    }

    setIsSavingCoverPhoto(true)

    try {
      const { error } = await supabase
        .from("project_photos")
        .update({ is_primary: true })
        .eq("id", selectedCoverPhoto)
        .eq("project_id", selectedProject.id)

      if (error) {
        throw error
      }

      setProjects((prev) =>
        prev.map((project) => {
          if (project.id !== selectedProject.id) {
            return project
          }

          const updatedPhotos = project.photos.map((photo) => ({
            ...photo,
            isPrimary: photo.id === selectedCoverPhoto,
          }))
          const newPrimary = updatedPhotos.find((photo) => photo.id === selectedCoverPhoto) ?? null

          return {
            ...project,
            photos: updatedPhotos,
            coverPhotoId: newPrimary?.id ?? null,
            coverImageUrl: newPrimary?.url ?? project.coverImageUrl,
          }
        }),
      )

      toast.success("Cover photo updated")
      closeCoverPhotoModal()
    } catch (error) {
      console.error("Failed to update cover photo", error)
      toast.error("We couldn't update the cover photo. Please try again.", {
        duration: 5000,
      })
    } finally {
      setIsSavingCoverPhoto(false)
    }
  }

  const handleDeleteListing = (project: ListingProject) => {
    setPendingDeleteProject(project)
    setStatusModalOpen(false)
    setOpenDropdown(null)
  }

  const handleCancelDelete = () => {
    setPendingDeleteProject(null)
  }

  const handleConfirmDelete = () => {
    if (!pendingDeleteProject) {
      return
    }

    console.log(`Deleting project ${pendingDeleteProject.id}`)
    setPendingDeleteProject(null)
    setSelectedProject((prev) => (prev?.id === pendingDeleteProject.id ? null : prev))
  }

  const handleEditListing = (project: ListingProject) => {
    setOpenDropdown(null)
    // If project is draft (in progress), redirect to new-project flow
    if (project.status === "draft") {
      router.push(`/new-project/details?projectId=${project.id}`)
    } else {
      router.push(`/dashboard/edit/${project.id}`)
    }
  }

  const handlePreviewListing = (project: ListingProject) => {
    setOpenDropdown(null)

    if (!project.slug) {
      toast.error("Preview unavailable", {
        description: "This listing does not have a public link yet.",
      })
      return
    }

    const basePath = `/projects/${project.slug}`
    const isInReview = project.status === "in_progress"
    const isLive = project.status === "published" || project.status === "completed"
    const targetUrl = isInReview ? `${basePath}?preview=1` : basePath

    if (isLive || isInReview) {
      window.open(targetUrl, "_blank", "noopener,noreferrer")
      return
    }

    router.push(targetUrl)
  }

  // Client-side filtering with debouncing
  const filteredProjects = useMemo(() => {
    let result = projects

    // Keyword filter (title and project type)
    if (filters.keyword.trim()) {
      const keyword = filters.keyword.toLowerCase()
      result = result.filter(
        (p) => p.title.toLowerCase().includes(keyword) || p.projectType.toLowerCase().includes(keyword)
      )
    }

    // Status filter
    if (filters.statuses.length > 0) {
      result = result.filter((p) => filters.statuses.includes(p.status))
    }

    // Role filter
    if (filters.roles.length > 0) {
      result = result.filter((p) => filters.roles.includes(p.role))
    }

    // Year range filter
    if (filters.yearFrom !== MIN_YEAR || filters.yearTo !== CURRENT_YEAR) {
      result = result.filter((p) => {
        if (!p.projectYear) return false
        return p.projectYear >= filters.yearFrom && p.projectYear <= filters.yearTo
      })
    }

    return result
  }, [projects, filters])

  const hasActiveFilters =
    filters.keyword !== "" ||
    filters.statuses.length > 0 ||
    filters.roles.length > 0 ||
    filters.yearFrom !== MIN_YEAR ||
    filters.yearTo !== CURRENT_YEAR

  const activeListingsCount = useMemo(
    () =>
      projects.filter(
        (project) => isListingStatusValue(project.status) && ACTIVE_STATUS_VALUES.includes(project.status),
      ).length,
    [projects],
  )

  const activeListingsExcludingSelected = useMemo(() => {
    if (!selectedProject) {
      return activeListingsCount
    }

    return projects.filter(
      (project) =>
        project.id !== selectedProject.id &&
        isListingStatusValue(project.status) &&
        ACTIVE_STATUS_VALUES.includes(project.status),
    ).length
  }, [activeListingsCount, projects, selectedProject])

  const selectedProjectDescriptor = useMemo(() => {
    if (!selectedProject) {
      return "Add project details"
    }

    const typeStyle = [selectedProject.styleLabel, selectedProject.projectType]
      .filter((value): value is string => Boolean(value))
      .join(" ")

    const location = selectedProject.locationLabel ? `in ${selectedProject.locationLabel}` : ""

    const detailLine = [typeStyle, location]
      .filter((value): value is string => Boolean(value && value.trim().length > 0))
      .join(" ")

    return detailLine || "Add project details"
  }, [selectedProject])

  const isSelectedProjectActive = selectedProject
    ? isListingStatusValue(selectedProject.status) && ACTIVE_STATUS_VALUES.includes(selectedProject.status)
    : false

  const limitReachedForNewActivation =
    !isPlus && activeListingsExcludingSelected >= BASIC_ACTIVE_LIMIT && !isSelectedProjectActive

  const isPendingAdminReview = selectedProject?.status === "in_progress"

  const statusModalProject: ListingStatusModalProject | null = selectedProject
    ? {
        title: selectedProject.title,
        descriptor: selectedProjectDescriptor,
        coverImageUrl: selectedProject.coverImageUrl,
        planBadgeLabel: isPlus ? "Plus plan" : "Basic plan",
      }
    : null

  const handleApplyFilters = useCallback((newFilters: FilterState) => {
    setFilters(newFilters)
  }, [])

  const handleRemoveFilter = useCallback((filterType: string, value?: string) => {
    setFilters((prev) => {
      if (filterType === "keyword") {
        return { ...prev, keyword: "" }
      }
      if (filterType === "status" && value) {
        return { ...prev, statuses: prev.statuses.filter((s) => s !== value) }
      }
      if (filterType === "role" && value) {
        return { ...prev, roles: prev.roles.filter((r) => r !== value) }
      }
      if (filterType === "year") {
        return { ...prev, yearFrom: MIN_YEAR, yearTo: CURRENT_YEAR }
      }
      return prev
    })
  }, [])

  const handleClearAllFilters = useCallback(() => {
    setFilters({
      keyword: "",
      statuses: [],
      roles: [],
      yearFrom: MIN_YEAR,
      yearTo: CURRENT_YEAR,
    })
  }, [])

  const statusOptions: ReadonlyArray<ListingStatusModalOption<ListingStatusValue>> = [
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
  const selectedStatusOption = statusOptions.find((option) => option.value === selectedStatus)
  const statusSelectionRequiresUpgrade = selectedStatusOption?.requiresPlus === true && !isPlus
  const statusSelectionHitsLimit =
    !isPlus && limitReachedForNewActivation && selectedStatusOption
      ? ACTIVE_STATUS_VALUES.includes(selectedStatusOption.value)
      : false

  const isValidStatusSelection =
    !isPendingAdminReview && Boolean(selectedStatusOption) && !statusSelectionRequiresUpgrade && !statusSelectionHitsLimit

  const displayedProjects = filteredProjects
  const hasProjects = projects.length > 0

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <DashboardHeader />

      <main className="flex-1 max-w-7xl mx-auto py-8 w-full px-4 md:px-6 lg:px-8 xl:px-12">
        {entitlementsError && (
          <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {entitlementsError}
          </div>
        )}
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-gray-900 font-medium text-xl">Your projects</h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage the listings you are creating and publishing on Arco.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="default"
                onClick={() => setIsFilterOpen(true)}
                className={hasActiveFilters ? "border-red-500 text-red-600 bg-red-50" : ""}
              >
                Filter
                {hasActiveFilters && (
                  <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-red-600 text-white rounded-full">
                    {filters.statuses.length + filters.roles.length + (filters.keyword ? 1 : 0) + (filters.yearFrom !== MIN_YEAR || filters.yearTo !== CURRENT_YEAR ? 1 : 0)}
                  </span>
                )}
              </Button>
              <Button asChild>
                <Link href="/new-project/details">Add project</Link>
              </Button>
            </div>
          </div>

          {/* Filter Chips */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2">
              {filters.keyword && (
                <button
                  onClick={() => handleRemoveFilter("keyword")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
                >
                  <span>&ldquo;{filters.keyword}&rdquo;</span>
                  <X className="h-3 w-3" />
                </button>
              )}
              {filters.statuses.map((status) => (
                <button
                  key={status}
                  onClick={() => handleRemoveFilter("status", status)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
                >
                  <span>{STATUS_CONFIG[status].label}</span>
                  <X className="h-3 w-3" />
                </button>
              ))}
              {filters.roles.map((role) => (
                <button
                  key={role}
                  onClick={() => handleRemoveFilter("role", role)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
                >
                  <span>{role === "owner" ? "Project owner" : "Contributor"}</span>
                  <X className="h-3 w-3" />
                </button>
              ))}
              {(filters.yearFrom !== MIN_YEAR || filters.yearTo !== CURRENT_YEAR) && (
                <button
                  onClick={() => handleRemoveFilter("year")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
                >
                  <span>
                    {filters.yearFrom}-{filters.yearTo}
                  </span>
                  <X className="h-3 w-3" />
                </button>
              )}
              <button
                onClick={handleClearAllFilters}
                className="text-sm text-gray-600 hover:text-gray-900 underline ml-2"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* SECURITY: RLS Validation Warning */}
        {!rlsLoading && !isRLSSecure && (
          <div className="mb-6 rounded-lg border border-red-600 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-900 mb-1">
                  Security Warning: RLS Policy Not Enforced
                </h3>
                <p className="text-sm text-red-700">
                  Row-Level Security validation failed for the projects table. This may allow
                  unauthorized access to project data. Contact your administrator immediately.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ERROR HANDLING: Metadata Loading Error Banner with Retry */}
        {metadataError && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-amber-900 mb-1">
                    Metadata Loading Error
                  </h3>
                  <p className="text-sm text-amber-700">
                    {metadataError}
                    {projectsWithErrors.size > 0 && (
                      <span className="block mt-1">
                        Affected projects: {projectsWithErrors.size}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetryMetadata}
                disabled={isRetrying}
                className="ml-4 border-amber-300 text-amber-900 hover:bg-amber-100"
              >
                {isRetrying ? "Retrying..." : "Retry"}
              </Button>
            </div>
          </div>
        )}

        {loadError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {loadError}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-64 rounded-lg bg-white shadow-sm animate-pulse overflow-hidden">
                <div className="h-40 bg-gray-200" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded" />
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : hasProjects ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedProjects.map((project) => (
            <div
              key={project.id}
              className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="relative">
                <img
                  src={project.coverImageUrl}
                  alt={project.title}
                  className="w-full h-48 object-cover"
                />
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${project.statusChipClass}`}>
                    {project.statusLabel}
                  </span>
                  {/* ERROR HANDLING: Visual indicator for projects with missing metadata */}
                  {project.hasMetadataError && (
                    <span
                      className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 flex items-center gap-1"
                      title="Some project details couldn't be loaded"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      <span>Incomplete</span>
                    </span>
                  )}
                </div>
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <span className="text-xs text-black bg-white px-2 py-1 rounded">Project owner</span>
                  <div className="relative">
                    <button
                      onClick={() => setOpenDropdown(openDropdown === project.id ? null : project.id)}
                      className="p-1 bg-white rounded-full shadow-sm hover:bg-gray-50"
                    >
                      <MoreHorizontal className="w-4 h-4 text-gray-600" />
                    </button>
                    {openDropdown === project.id && (
                      <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border py-2 w-40 z-10">
                        <button
                          onClick={() => handleUpdateStatus(project)}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Update status
                        </button>
                        <button
                          onClick={() => handleEditCoverImage(project)}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Edit cover image
                        </button>
                        <button
                          onClick={() => handleEditListing(project)}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Edit listing
                        </button>
                        <button
                          onClick={() => handlePreviewListing(project)}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Preview listing
                        </button>
                        <div className="border-t border-gray-100 my-1" />
                        <button
                          onClick={() => handleDeleteListing(project)}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          Delete listing
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-medium text-gray-900">{project.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{project.subtitle}</p>
                <p className="text-xs text-gray-400 mt-2">
                  Created on {new Date(project.createdAt).toLocaleDateString()}
                </p>
                {project.status === "in_progress" && (
                  <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
                    Awaiting Arco review. We&apos;ll email you as soon as the team approves this listing.
                  </div>
                )}
                {project.status === "draft" && (
                  <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    Continue the listing wizard to submit this project for review.
                  </div>
                )}
              </div>
            </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
            <h2 className="text-lg font-medium text-gray-900">Add your first project</h2>
            <p className="text-sm text-gray-500 mt-2">
              Kick off your first listing to showcase your work and connect with professionals.
            </p>
            <div className="mt-6">
              <Button asChild>
                <Link href="/new-project/details">Create a project</Link>
              </Button>
            </div>
          </div>
        )}
      </main>

      <ListingStatusModal
        open={statusModalOpen && Boolean(selectedProject)}
        onClose={handleCloseStatusModal}
        onSave={handleSaveStatus}
        project={statusModalProject}
        companyPlan={companyPlan}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        statusOptions={statusOptions}
        saveDisabled={isSavingStatus || !isValidStatusSelection}
        isPendingAdminReview={isPendingAdminReview}
        limitReachedForNewActivation={limitReachedForNewActivation}
        activeStatusValues={ACTIVE_STATUS_VALUES}
      />

      {pendingDeleteProject && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 border border-red-100 shadow-lg">
            <div className="flex items-start gap-3 mb-6">
              <div className="rounded-full bg-red-50 p-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Delete listing?</h2>
                <p className="mt-1 text-sm text-gray-600">
                  This will remove <span className="font-medium">{pendingDeleteProject.title}</span> from your dashboard. You can
                  always create the listing again later.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleCancelDelete} className="flex-1">
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleConfirmDelete} className="flex-1">
                Delete listing
              </Button>
            </div>
          </div>
        </div>
      )}

      {coverPhotoModalOpen && selectedProject && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Edit cover photo</h2>
              <button onClick={closeCoverPhotoModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-6">
              This photo will be displayed with the project on your company portfolio
            </p>

            {selectedProject.photos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                {selectedProject.photos.map((photo) => {
                  const isSelected = selectedCoverPhoto === photo.id
                  const isCurrentCover = photo.isPrimary

                  return (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setSelectedCoverPhoto(photo.id)}
                      className={`relative h-32 w-full overflow-hidden rounded-lg border transition focus:outline-none focus:ring-2 focus:ring-primary ${
                        isSelected ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-gray-200"
                      }`}
                    >
                      <img src={photo.url} alt={selectedProject.title} className="h-full w-full object-cover" />
                      {isCurrentCover && (
                        <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-1 text-xs font-medium text-gray-700">
                          Current cover
                        </span>
                      )}
                      {isSelected && (
                        <div className="absolute top-2 right-2 rounded-full bg-white p-1 shadow-sm">
                          <Check className="w-4 h-4 text-gray-900" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="mb-6 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
                Upload project photos in the listing editor to choose a cover image.
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={closeCoverPhotoModal}>
                Cancel
              </Button>
              <Button onClick={handleSaveCoverPhoto} disabled={isSavingCoverPhoto || !selectedCoverPhoto}>
                {isSavingCoverPhoto ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Footer />

      <DashboardListingsFilter
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApply={handleApplyFilters}
        currentFilters={filters}
      />
    </div>
  )
}
