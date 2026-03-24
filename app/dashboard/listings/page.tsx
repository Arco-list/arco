"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import Link from "next/link"
import { MoreHorizontal, Check, AlertTriangle, Info, X } from "lucide-react"
import { useEffect, useMemo, useState, useCallback, useRef } from "react"
import { ImportProjectModal } from "@/components/import-project-modal"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useRouter } from "next/navigation"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import type { Database } from "@/lib/supabase/types"
import { DashboardListingsFilter, type FilterState } from "@/components/dashboard-listings-filter"
import { toast } from "sonner"
import { useTableRLSValidation } from "@/hooks/useRLSValidation"
import { useCompanyEntitlements } from "@/hooks/use-company-entitlements"
import {
  ListingStatusModal,
  type ListingStatusModalProject,
} from "@/components/listing-status-modal"
import {
  type ProjectStatus,
  type ListingStatusValue,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_CHIP_CLASS,
  PROJECT_STATUS_DOT_CLASS,
  LISTING_STATUS_VALUES,
  ACTIVE_STATUS_VALUES,
  BASIC_ACTIVE_LIMIT,
  isListingStatusValue,
  LISTING_STATUS_OPTIONS,
} from "@/lib/project-status-config"
import {
  type ContributorStatus,
  CONTRIBUTOR_STATUS_LABELS,
  CONTRIBUTOR_STATUS_CHIP_CLASS,
  CONTRIBUTOR_STATUS_DOT_CLASS,
  CONTRIBUTOR_STATUS_OPTIONS,
  OWNER_STATUS_OPTIONS,
} from "@/lib/contributor-status-config"
import { syncCompanyListedStatus } from "@/app/admin/projects/actions"
import { updateCoverPhotoAction } from "@/app/dashboard/company/actions"

type ProjectPhotoRow = Pick<
  Database["public"]["Tables"]["project_photos"]["Row"],
  "id" | "url" | "is_primary" | "order_index"
>

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"] & {
  project_photos: ProjectPhotoRow[] | null
  project_professionals: {
    is_project_owner: boolean
  }[] | null
  project_professional_id?: string
  project_professional_status?: string
  invited_service_category_ids?: string[] | null
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
  status: ProjectStatus | ContributorStatus
  statusLabel: string
  statusChipClass: string
  statusDotClass: string
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
  hasMetadataError?: boolean
  projectProfessionalId?: string
  projectProfessionalStatus?: string
  invitedServiceCategory?: string | null
  rejectionReason?: string | null
  rawProjectStatus?: string
}

const isUuid = (value?: string | null): value is string =>
  !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

const CURRENT_YEAR = new Date().getFullYear()
const MIN_YEAR = 2000

export default function DashboardListingsPage() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), [])

  // SECURITY: Validate RLS policies are enforced
  const { isSecure: isRLSSecure, loading: rlsLoading } = useTableRLSValidation("projects", {
    enabled: false, // Disabled: professionals see company-associated projects (not their own client_id), which triggers false positives
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
  const [contributorStatusModalOpen, setContributorStatusModalOpen] = useState(false)
  const [selectedContributorStatus, setSelectedContributorStatus] = useState<ContributorStatus | "">("")
  const [importModalOpen, setImportModalOpen] = useState(false)
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
  const { planTier, isPlus, canPublishProjects, error: entitlementsError } = useCompanyEntitlements()
  const companyPlan: "basic" | "plus" = planTier ?? "basic"
  const [userId, setUserId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [professionalId, setProfessionalId] = useState<string | null>(null)
  // Track in-flight requests to prevent race conditions
  const abortControllerRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)
  const [retryTrigger, setRetryTrigger] = useState(0)

  // Close dropdown on click outside
  useEffect(() => {
    if (!openDropdown) return
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest(".dropdown-menu")) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [openDropdown])

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

      // Get professional record and company for this user
      const { data: professionalData, error: professionalError } = await supabase
        .from("professionals")
        .select("id, company_id")
        .eq("user_id", authData.user.id)
        .maybeSingle()

      let resolvedCompanyId = professionalData?.company_id ?? null
      setCompanyId(resolvedCompanyId)
      setProfessionalId(professionalData?.id ?? null)

      // Fallback: if no professional record, check team membership
      if (!professionalData?.id || professionalError) {
        const { data: membership } = await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", authData.user.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle()

        if (membership?.company_id) {
          resolvedCompanyId = membership.company_id
          setCompanyId(resolvedCompanyId)
        } else {
          if (isActive && !abortController.signal.aborted) {
            setLoadError("No professional profile found. Please complete your profile setup.")
            setProjects([])
            setIsLoading(false)
          }
          return
        }
      }

      // Fetch ALL projects for this COMPANY (not just this professional)
      const { data, error } = await supabase
        .from("project_professionals")
        .select(`
          id,
          project_id,
          status,
          is_project_owner,
          invited_service_category_ids,
          professional_id,
          cover_photo_id,
          projects!inner(
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
            updated_at,
            project_year,
            rejection_reason,
            client_id,
            project_type_category:categories!projects_project_type_category_id_fkey(name, slug),
            project_photos(id, url, is_primary, order_index)
          )
        `)
        .eq("company_id", resolvedCompanyId!)
        .neq("status", "rejected")
        .order("created_at", { ascending: false })

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

      // Transform project_professionals data into project rows, deduplicating by project_id
      // (a company can have multiple project_professionals rows for the same project)
      const projectMap = new Map<string, (typeof data)[number]>()
      for (const pp of data ?? []) {
        const existing = projectMap.get(pp.project_id)
        if (!existing || (pp.is_project_owner && !existing.is_project_owner)) {
          projectMap.set(pp.project_id, pp)
        }
      }
      const projectRows = Array.from(projectMap.values()).map(pp => ({
        ...pp.projects,
        project_professionals: [{ is_project_owner: pp.is_project_owner }],
        project_professional_id: pp.id,
        project_professional_status: pp.status,
        invited_service_category_ids: (pp.invited_service_category_ids as string[] | null) ?? [],
        contributor_cover_photo_id: pp.cover_photo_id as string | null,
      })) as (ProjectRow & {
        project_type_category: { name: string | null } | null
        invited_service_category_ids?: string[] | null
        contributor_cover_photo_id: string | null
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
        // Determine role based on is_project_owner flag from project_professionals
        const isProjectOwner = project.project_professionals?.some((pp) => pp.is_project_owner) ?? false
        const role: "owner" | "contributor" = isProjectOwner ? "owner" : "contributor"

        // Show project_professionals status for both owners and contributors
        // For draft/in_progress/rejected projects, show the project-level status instead
        let statusKey: ProjectStatus | ContributorStatus
        let statusLabel: string
        let statusChipClass: string
        let statusDotClass: string

        const projectStatus = project.status as ProjectStatus
        const ppStatus = project.project_professional_status as ContributorStatus | undefined

        if (["draft", "in_progress", "rejected"].includes(projectStatus)) {
          statusKey = projectStatus
          statusLabel = PROJECT_STATUS_LABELS[projectStatus] ?? projectStatus
          statusChipClass = PROJECT_STATUS_CHIP_CLASS[projectStatus] ?? "bg-surface text-text-secondary"
          statusDotClass = PROJECT_STATUS_DOT_CLASS[projectStatus] ?? "bg-muted-foreground"
        } else if (ppStatus) {
          statusKey = ppStatus
          statusLabel = CONTRIBUTOR_STATUS_LABELS[ppStatus] ?? ppStatus
          statusChipClass = CONTRIBUTOR_STATUS_CHIP_CLASS[ppStatus] ?? "bg-surface text-text-secondary"
          statusDotClass = CONTRIBUTOR_STATUS_DOT_CLASS[ppStatus] ?? "bg-muted-foreground"
        } else {
          statusKey = projectStatus
          statusLabel = PROJECT_STATUS_LABELS[projectStatus] ?? projectStatus
          statusChipClass = PROJECT_STATUS_CHIP_CLASS[projectStatus] ?? "bg-surface text-text-secondary"
          statusDotClass = PROJECT_STATUS_DOT_CLASS[projectStatus] ?? "bg-muted-foreground"
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

        // For contributors, prefer their custom cover_photo_id; for owners, use is_primary
        const contributorCoverPhotoId = project.contributor_cover_photo_id
        const contributorCoverPhoto = contributorCoverPhotoId
          ? normalizedPhotos.find((photo) => photo.id === contributorCoverPhotoId)
          : null
        const primaryPhoto = contributorCoverPhoto ?? normalizedPhotos.find((photo) => photo.isPrimary) ?? normalizedPhotos[0] ?? null
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

        const locationLabel = project.address_city || null
        const subtitle = [projectTypeLabel, locationLabel].filter(Boolean).join(" · ")

        return {
          id: project.id,
          title: project.title,
          status: statusKey,
          statusLabel,
          statusChipClass,
          statusDotClass,
          slug: project.slug ?? null,
          subtitle,
          styleLabel: styleLabel || null,
          locationLabel: locationLabel,
          coverImageUrl,
          coverPhotoId,
          photos: normalizedPhotos,
          createdAt: project.created_at ?? new Date().toISOString(),
          role,
          projectType: projectTypeLabel,
          projectYear: project.project_year,
          hasMetadataError: hasStyleError,
          projectProfessionalId: project.project_professional_id,
          projectProfessionalStatus: project.project_professional_status,
          invitedServiceCategory: null, // TODO: resolve category names from invited_service_category_ids if needed
          rejectionReason: project.rejection_reason ?? null,
          rawProjectStatus: projectStatus,
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
    // All statuses open the modal — draft shows "submit for review" option
    setSelectedProject(project)
    setSelectedContributorStatus((project.projectProfessionalStatus as ContributorStatus) || "listed")
    setContributorStatusModalOpen(true)
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

    const statusOption = LISTING_STATUS_OPTIONS.find((option) => option.value === selectedStatus)
    if (!statusOption) {
      toast.error("Select a valid status before saving.")
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

      const newStatusLabel = PROJECT_STATUS_LABELS[selectedStatus as ProjectStatus]
      const newStatusChipClass = PROJECT_STATUS_CHIP_CLASS[selectedStatus as ProjectStatus]
      const newStatusDotClass = PROJECT_STATUS_DOT_CLASS[selectedStatus as ProjectStatus]

      setProjects((prev) =>
        prev.map((project) => {
          if (project.id !== selectedProject.id) {
            return project
          }

          return {
            ...project,
            status: selectedStatus,
            statusLabel: newStatusLabel,
            statusChipClass: newStatusChipClass,
            statusDotClass: newStatusDotClass,
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
      const result = await updateCoverPhotoAction({
        projectId: selectedProject.id,
        photoId: selectedCoverPhoto,
        role: selectedProject.role,
        projectProfessionalId: selectedProject.projectProfessionalId,
      })
      if (!result.success) throw new Error(result.error)

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
      router.refresh()
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

  const handleConfirmDelete = async () => {
    if (!pendingDeleteProject) {
      return
    }

    setIsSavingStatus(true)

    try {
      // Delete the project (RLS will ensure user can only delete their own projects)
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", pendingDeleteProject.id)
        .eq("client_id", userId)

      if (error) {
        throw error
      }

      // Remove from local state
      setProjects((prev) => prev.filter((p) => p.id !== pendingDeleteProject.id))

      // Clear selected project if it was the deleted one
      setSelectedProject((prev) => (prev?.id === pendingDeleteProject.id ? null : prev))

      toast.success("Listing deleted successfully")
      setPendingDeleteProject(null)
    } catch (error) {
      console.error("Failed to delete project", error)
      toast.error("Failed to delete listing. Please try again.")
    } finally {
      setIsSavingStatus(false)
    }
  }

  const getProjectUrl = (project: ListingProject) => {
    if (!project.slug) return null
    const needsPreview = project.status === "draft" || project.status === "in_progress"
    return `/projects/${project.slug}${needsPreview ? "?preview=1" : ""}`
  }

  const handleCardClick = (project: ListingProject) => {
    if (project.role === "owner") {
      router.push(`/dashboard/edit/${project.id}`)
    } else {
      const url = getProjectUrl(project)
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer")
      }
    }
  }

  const handleEditListing = (project: ListingProject) => {
    setOpenDropdown(null)
    router.push(`/dashboard/edit/${project.id}`)
  }

  const handlePreviewListing = (project: ListingProject) => {
    setOpenDropdown(null)

    const url = getProjectUrl(project)
    if (!url) {
      toast.error("Preview unavailable", {
        description: "This listing does not have a public link yet.",
      })
      return
    }

    window.open(url, "_blank", "noopener,noreferrer")
  }

  const handleUpdateContributorStatus = (project: ListingProject) => {
    setSelectedProject(project)
    setSelectedContributorStatus((project.projectProfessionalStatus as ContributorStatus) || "invited")
    setContributorStatusModalOpen(true)
    setOpenDropdown(null)
  }

  const handleSaveContributorStatus = async () => {
    if (!selectedProject?.projectProfessionalId || !selectedContributorStatus) {
      return
    }

    setIsSavingStatus(true)

    try {
      const { error } = await supabase
        .from("project_professionals")
        .update({
          status: selectedContributorStatus,
          responded_at: new Date().toISOString()
        })
        .eq("id", selectedProject.projectProfessionalId)

      if (error) {
        throw error
      }

      // Update local state with new contributor status and derived display fields
      const newStatusLabel = CONTRIBUTOR_STATUS_LABELS[selectedContributorStatus as ContributorStatus]
      const newStatusChipClass = CONTRIBUTOR_STATUS_CHIP_CLASS[selectedContributorStatus as ContributorStatus]
      const newStatusDotClass = CONTRIBUTOR_STATUS_DOT_CLASS[selectedContributorStatus as ContributorStatus]

      setProjects((prev) =>
        prev.map((p) =>
          p.id === selectedProject.id
            ? {
                ...p,
                projectProfessionalStatus: selectedContributorStatus,
                status: selectedContributorStatus as ContributorStatus,
                statusLabel: newStatusLabel,
                statusChipClass: newStatusChipClass,
                statusDotClass: newStatusDotClass,
              }
            : p
        )
      )

      // Sync company listed status
      if (companyId) await syncCompanyListedStatus(companyId)
      toast.success("Listing status updated")
      setContributorStatusModalOpen(false)
      setSelectedProject(null)
    } catch (error) {
      console.error("Failed to update status", error)
      toast.error("Failed to update listing status. Please try again.")
    } finally {
      setIsSavingStatus(false)
    }
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

    // Sort by status priority: action-required first, then active, then inactive
    const statusOrder: Record<string, number> = {
      draft: 0,
      in_progress: 1,
      invited: 2,
      rejected: 3,
      live_on_page: 4,
      listed: 5,
      unlisted: 6,
      archived: 7,
    }
    result = [...result].sort((a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99))

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

  const limitReachedForNewActivation = false

  const isPendingAdminReview = selectedProject?.status === "in_progress"

  const statusModalProject: ListingStatusModalProject | null = selectedProject
    ? {
        title: selectedProject.title,
        descriptor: selectedProjectDescriptor,
        coverImageUrl: selectedProject.coverImageUrl,
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

  const selectedStatusOption = LISTING_STATUS_OPTIONS.find((option) => option.value === selectedStatus)

  const isValidStatusSelection =
    !isPendingAdminReview && Boolean(selectedStatusOption)

  const displayedProjects = filteredProjects
  const hasProjects = projects.length > 0

  return (
    <div className="min-h-screen bg-white flex flex-col" style={{ paddingTop: 60 }}>
      <Header navLinks={[{ href: "/dashboard/listings", label: "Listings" }, { href: "/dashboard/company", label: "Company" }]} />

      {/* Page title — matches /projects layout */}
      <div className="discover-page-title">
        <div className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 className="arco-section-title">My projects</h2>
          {canPublishProjects && hasProjects && (
            <button onClick={() => setImportModalOpen(true)} className="btn-primary" style={{ fontSize: 14, padding: "10px 20px" }}>
              Publish your project
            </button>
          )}
        </div>
      </div>

      <main style={{ flex: 1 }}>
        <div className="discover-results">
          <div className="wrap">

            {/* Banners */}
            {entitlementsError && (
              <div style={{ marginBottom: 20, padding: "10px 14px", borderRadius: 6, border: "1px solid #fde68a", background: "#fffbeb", fontSize: 13, color: "#92400e" }}>
                {entitlementsError}
              </div>
            )}
            {!rlsLoading && !isRLSSecure && (
              <div style={{ marginBottom: 20, padding: "12px 14px", borderRadius: 6, border: "1px solid #fca5a5", background: "#fef2f2", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <AlertTriangle style={{ width: 16, height: 16, color: "#dc2626", flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "#7f1d1d", marginBottom: 2 }}>Security Warning</p>
                  <p style={{ fontSize: 13, color: "#b91c1c" }}>Row-Level Security validation failed. Contact your administrator immediately.</p>
                </div>
              </div>
            )}
            {metadataError && (
              <div style={{ marginBottom: 20, padding: "12px 14px", borderRadius: 6, border: "1px solid #fde68a", background: "#fffbeb", display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flex: 1 }}>
                  <AlertTriangle style={{ width: 16, height: 16, color: "#d97706", flexShrink: 0, marginTop: 2 }} />
                  <p style={{ fontSize: 13, color: "#92400e" }}>{metadataError}</p>
                </div>
                <button
                  onClick={handleRetryMetadata}
                  disabled={isRetrying}
                  style={{ fontSize: 13, color: "#78350f", background: "none", border: "1px solid #fcd34d", borderRadius: 4, padding: "4px 10px", cursor: "pointer", flexShrink: 0 }}
                >
                  {isRetrying ? "Retrying…" : "Retry"}
                </button>
              </div>
            )}
            {loadError && (
              <div style={{ marginBottom: 20, padding: "12px 14px", borderRadius: 6, border: "1px solid #fca5a5", background: "#fef2f2", fontSize: 13, color: "#dc2626" }}>
                {loadError}
              </div>
            )}

            {/* Result count */}
            {!isLoading && hasProjects && (
              <div className="discover-results-meta">
                <p className="discover-results-count">
                  <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>
                    {displayedProjects.length.toLocaleString()}
                  </strong>{" "}
                  {displayedProjects.length === 1 ? "project" : "projects"}
                </p>
              </div>
            )}

            {/* Loading skeleton */}
            {isLoading ? (
              <div className="discover-grid">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div style={{ aspectRatio: "4/3", background: "var(--surface)", borderRadius: 4, marginBottom: 12 }} />
                    <div style={{ height: 15, background: "var(--surface)", borderRadius: 3, width: "70%", marginBottom: 6 }} />
                    <div style={{ height: 13, background: "var(--surface)", borderRadius: 3, width: "50%" }} />
                  </div>
                ))}
              </div>
            ) : hasProjects ? (
              <div className="discover-grid">
                {displayedProjects.map((project, index) => {
                  const cardKey = `${project.id}-${index}`
                  return (
                    <div
                      key={cardKey}
                      className="discover-card"
                      style={{ position: "relative", cursor: "pointer" }}
                      onClick={(e) => {
                        if (!(e.target as Element).closest(".dropdown-menu")) {
                          handleCardClick(project)
                        }
                      }}
                    >
                      {/* Image — 4:3 matching /projects */}
                      <div
                        className="discover-card-image-wrap"
                        style={{ position: "relative" }}
                        onMouseEnter={(e) => {
                          const overlay = e.currentTarget.querySelector<HTMLElement>(".listing-card-hover-overlay")
                          const pill = e.currentTarget.querySelector<HTMLElement>(".listing-card-hover-pill")
                          if (overlay) overlay.style.background = "rgba(0,0,0,.35)"
                          if (pill) pill.style.opacity = "1"
                        }}
                        onMouseLeave={(e) => {
                          const overlay = e.currentTarget.querySelector<HTMLElement>(".listing-card-hover-overlay")
                          const pill = e.currentTarget.querySelector<HTMLElement>(".listing-card-hover-pill")
                          if (overlay) overlay.style.background = "transparent"
                          if (pill) pill.style.opacity = "0"
                        }}
                      >
                        <div className="discover-card-image-layer">
                          <img src={project.coverImageUrl} alt={project.title} />
                        </div>

                        {/* Accept button for invited contributors — on image only */}
                        {project.role === "contributor" && project.status === "invited" && (
                          <button
                            style={{
                              position: "absolute", inset: 0, zIndex: 2,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              background: "transparent", border: "none", cursor: "pointer",
                              transition: "background .2s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "rgba(0,0,0,.35)"
                              const pill = e.currentTarget.querySelector<HTMLElement>("[data-accept-pill]")
                              if (pill) { pill.style.opacity = "1"; pill.style.background = "rgba(0,0,0,.6)"; pill.style.borderColor = "rgba(255,255,255,.4)" }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent"
                              const pill = e.currentTarget.querySelector<HTMLElement>("[data-accept-pill]")
                              if (pill) { pill.style.opacity = "0.7"; pill.style.background = "rgba(0,0,0,.45)"; pill.style.borderColor = "rgba(255,255,255,.25)" }
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleUpdateContributorStatus(project)
                            }}
                          >
                            <span
                              data-accept-pill=""
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 7,
                                fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 400,
                                color: "#fff", background: "rgba(0,0,0,.45)",
                                border: "1px solid rgba(255,255,255,.25)", borderRadius: 100,
                                padding: "8px 18px",
                                backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                                opacity: 0.7, transition: "opacity .2s, background .2s, border-color .2s",
                              }}
                            >
                              <Check size={14} />
                              Accept
                            </span>
                          </button>
                        )}

                        {/* Hover action pill — Edit project (owner) / View project (contributor) */}
                        {!(project.role === "contributor" && project.status === "invited") && (
                          <div
                            style={{
                              position: "absolute", inset: 0, zIndex: 1,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              background: "transparent", transition: "background .2s",
                              pointerEvents: "none",
                            }}
                            className="listing-card-hover-overlay"
                          >
                            <span
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 7,
                                fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 400,
                                color: "#fff", background: "rgba(0,0,0,.6)",
                                border: "1px solid rgba(255,255,255,.25)", borderRadius: 100,
                                padding: "8px 18px",
                                backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                                opacity: 0, transition: "opacity .2s",
                              }}
                              className="listing-card-hover-pill"
                            >
                              {project.role === "owner" ? "Edit project" : "View project"}
                            </span>
                          </div>
                        )}

                        {/* Owner pill — bottom-left of image */}
                        {project.role === "owner" && (
                          <span
                            style={{
                              position: "absolute", bottom: 10, left: 10, zIndex: 2,
                              display: "inline-flex", alignItems: "center",
                              fontSize: 11, fontWeight: 500, color: "#fff",
                              background: "rgba(0,0,0,.45)", borderRadius: 100,
                              padding: "4px 10px", letterSpacing: ".02em",
                              backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                            }}
                          >
                            Owner
                          </span>
                        )}
                      </div>

                      {/* Status pill — overlaid on image, always clickable */}
                      <div style={{ position: "absolute", top: 12, left: 12, zIndex: 2, display: "flex", gap: 6 }}>
                        <button
                          className="filter-pill flex items-center gap-1.5"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (project.role === "owner") {
                              handleUpdateStatus(project)
                            } else {
                              handleUpdateContributorStatus(project)
                            }
                          }}
                        >
                          <span className={`inline-block w-[7px] h-[7px] rounded-full shrink-0 ${project.statusDotClass}`} />
                          <span className="text-xs font-medium">{project.statusLabel}</span>
                        </button>
                      </div>

                      {/* Dropdown — top-right, aligned with filter-pill / filter-dropdown CSS */}
                      <div
                        className="dropdown-menu"
                        style={{ position: "absolute", top: 12, right: 12, zIndex: 2 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="filter-pill"
                          onClick={() => setOpenDropdown(openDropdown === cardKey ? null : cardKey)}
                          data-open={openDropdown === cardKey ? "true" : undefined}
                          aria-label="Project options"
                          style={{ padding: "6px 8px", gap: 0 }}
                        >
                          <MoreHorizontal style={{ width: 16, height: 16 }} />
                        </button>
                        <div
                          className="filter-dropdown"
                          data-open={openDropdown === cardKey ? "true" : undefined}
                          data-align="right"
                          style={{ minWidth: 180, top: "calc(100% + 6px)" }}
                        >
                          {project.role === "owner" ? (
                            <>
                              {([
                                { label: "Edit listing", action: () => handleEditListing(project) },
                                { label: "Update status", action: () => handleUpdateStatus(project) },
                                { label: "Change cover", action: () => handleEditCoverImage(project) },
                                ...(getProjectUrl(project) ? [{ label: "View project", action: () => { setOpenDropdown(null); window.open(getProjectUrl(project)!, "_blank", "noopener,noreferrer") } }] : []),
                              ] as const).map(({ label, action }) => (
                                <div
                                  key={label}
                                  className="filter-dropdown-option"
                                  onClick={action}
                                  role="menuitem"
                                >
                                  <span className="filter-dropdown-label">{label}</span>
                                </div>
                              ))}
                            </>
                          ) : (
                            <>
                              {([
                                { label: "Update status", action: () => handleUpdateContributorStatus(project) },
                                { label: "Change cover", action: () => handleEditCoverImage(project) },
                                ...(getProjectUrl(project) ? [{ label: "View project", action: () => { setOpenDropdown(null); window.open(getProjectUrl(project)!, "_blank", "noopener,noreferrer") } }] : []),
                              ] as const).map(({ label, action }) => (
                                <div
                                  key={label}
                                  className="filter-dropdown-option"
                                  onClick={action}
                                  role="menuitem"
                                >
                                  <span className="filter-dropdown-label">{label}</span>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Card text — same as /projects */}
                      <h3 className="discover-card-title">{project.title}</h3>
                      {project.status === "rejected" && project.rejectionReason ? (
                        <p className="discover-card-sub" style={{ color: "#dc2626" }}>
                          {project.rejectionReason}
                        </p>
                      ) : (
                        <>
                          <p className="discover-card-sub">{project.subtitle}</p>
                          {project.invitedServiceCategory && project.role === "contributor" && (
                            <p className="discover-card-sub" style={{ color: "var(--primary)" }}>
                              {project.invitedServiceCategory}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ border: "1px dashed var(--border)", borderRadius: 8, padding: "80px 24px", textAlign: "center" }}>
                {canPublishProjects ? (
                  <>
                    <p className="arco-eyebrow" style={{ marginBottom: 16 }}>Get started</p>
                    <h2 className="arco-section-title" style={{ marginBottom: 12 }}>Publish your first project</h2>
                    <p className="arco-body-text" style={{ marginBottom: 32, maxWidth: 360, margin: "0 auto 32px" }}>
                      Import a project from your website — we'll read the title, photos, and details automatically.
                    </p>
                    <button onClick={() => setImportModalOpen(true)} className="btn-primary">
                      Publish your project
                    </button>
                  </>
                ) : (
                  <>
                    <p className="arco-eyebrow" style={{ marginBottom: 16 }}>No projects yet</p>
                    <h2 className="arco-section-title" style={{ marginBottom: 12 }}>Get invited to a project</h2>
                    <p className="arco-body-text" style={{ maxWidth: 400, margin: "0 auto" }}>
                      When a homeowner or project owner adds your company to their project, it will appear here.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {pendingDeleteProject && (
        <div className="popup-overlay" onClick={handleCancelDelete}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Delete listing</h3>
              <button type="button" className="popup-close" onClick={handleCancelDelete} aria-label="Close">
                ✕
              </button>
            </div>

            <p className="arco-body-text" style={{ marginBottom: 24 }}>
              This will permanently remove <strong>{pendingDeleteProject.title}</strong> from your dashboard. You can always create the listing again later.
            </p>

            <div className="popup-actions">
              <button
                type="button"
                className="btn-tertiary"
                onClick={handleCancelDelete}
                disabled={isSavingStatus}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleConfirmDelete}
                disabled={isSavingStatus}
                style={{ flex: 1 }}
              >
                {isSavingStatus ? "Deleting..." : "Delete listing"}
              </button>
            </div>
          </div>
        </div>
      )}

      {coverPhotoModalOpen && selectedProject && (
        <div className="popup-overlay" onClick={closeCoverPhotoModal}>
          <div className="popup-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Change cover</h3>
              <button type="button" className="popup-close" onClick={closeCoverPhotoModal} aria-label="Close">✕</button>
            </div>
            <p className="arco-body-text" style={{ marginBottom: 20 }}>
              {selectedProject.role === "contributor"
                ? "Choose an image that best represents your service on this project."
                : "This photo will be displayed with the project on your company portfolio."}
            </p>

            {/* Scrollable photo grid */}
            <div style={{ overflowY: "auto", maxHeight: "60vh" }}>
              {selectedProject.photos.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {selectedProject.photos.map((photo) => {
                    const isSelected = selectedCoverPhoto === photo.id
                    const isCurrentCover = photo.isPrimary

                    return (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => setSelectedCoverPhoto(photo.id)}
                        style={{
                          position: "relative",
                          aspectRatio: "4/3",
                          overflow: "hidden",
                          borderRadius: 6,
                          border: isSelected ? "2px solid #016D75" : "2px solid transparent",
                          cursor: "pointer",
                          background: "#f0f0ee",
                          padding: 0,
                          transition: "border-color .15s",
                        }}
                      >
                        <img src={photo.url} alt={selectedProject.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        {isCurrentCover && (
                          <span style={{ position: "absolute", bottom: 6, left: 6, borderRadius: 24, background: "rgba(255,255,255,0.9)", padding: "3px 8px", fontSize: 11, fontWeight: 500, color: "var(--arco-black)" }}>
                            Current
                          </span>
                        )}
                        {isSelected && (
                          <span style={{ position: "absolute", top: 6, right: 6, background: "#016D75", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 8l4 4 8-8" /></svg>
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div style={{ border: "1px dashed var(--arco-rule)", borderRadius: 4, padding: "40px 24px", textAlign: "center", fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--text-disabled)" }}>
                  Upload project photos in the listing editor to choose a cover image.
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button className="btn-tertiary" onClick={closeCoverPhotoModal} style={{ flex: 1 }}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSaveCoverPhoto} disabled={isSavingCoverPhoto || !selectedCoverPhoto} style={{ flex: 1 }}>
                {isSavingCoverPhoto ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ListingStatusModal
        open={contributorStatusModalOpen}
        onClose={() => {
          setContributorStatusModalOpen(false)
          setSelectedProject(null)
        }}
        onSave={handleSaveContributorStatus}
        project={
          selectedProject
            ? {
                title: selectedProject.title,
                descriptor: selectedProject.invitedServiceCategory || "Service",
                coverImageUrl: selectedProject.coverImageUrl || "/placeholder.jpg",
              }
            : null
        }
        companyPlan={companyPlan}
        selectedStatus={selectedContributorStatus}
        onStatusChange={setSelectedContributorStatus}
        statusOptions={selectedProject?.role === "owner" ? OWNER_STATUS_OPTIONS : CONTRIBUTOR_STATUS_OPTIONS}
        saveDisabled={!selectedContributorStatus || selectedContributorStatus === "invited"}
        isPendingAdminReview={selectedProject?.rawProjectStatus === "in_progress"}
        isRejected={selectedProject?.rawProjectStatus === "rejected"}
        rejectionReason={selectedProject?.rejectionReason}
        isDraft={selectedProject?.rawProjectStatus === "draft"}
        onSubmitForReview={selectedProject?.role === "owner" && selectedProject?.rawProjectStatus === "draft" ? () => {
          setContributorStatusModalOpen(false)
          router.push(`/dashboard/edit/${selectedProject.id}`)
        } : undefined}
        role={selectedProject?.role ?? "contributor"}
      />

      <ImportProjectModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        userId={userId}
        companyId={companyId}
        professionalId={professionalId}
      />

      <Footer maxWidth="max-w-7xl" />

      <DashboardListingsFilter
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApply={handleApplyFilters}
        currentFilters={filters}
      />
    </div>
  )
}
