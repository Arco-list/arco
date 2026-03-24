"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  Loader2,
  MailPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
  X,
  XCircle,
} from "lucide-react"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import { isProjectRow } from "@/lib/supabase/type-guards"
import type { Tables } from "@/lib/supabase/types"
import { isAdminUser } from "@/lib/auth-utils"
import { toast } from "sonner"
import { resolveProfessionalServiceIcon } from "@/lib/icons/professional-services"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { SegmentedProgressBar } from "@/components/new-project/segmented-progress-bar"
import { Button } from "@/components/ui/button"
import { useCompanyEntitlements } from "@/hooks/use-company-entitlements"

const TOTAL_STEPS_PUBLISHER = 4
const TOTAL_STEPS_NON_PUBLISHER = 2
const BLOCKED_EMAIL_DOMAINS = ["gmail.com", "hotmail.com", "yahoo.com", "outlook.com", "icloud.com"]

const FALLBACK_SERVICE_OPTIONS: ServiceOption[] = [
  { id: "architect", name: "Architect", slug: "design-planning-architecture", parentName: "Design & Planning" },
  { id: "interior-designer", name: "Interior designer", slug: "design-planning-interior-design", parentName: "Design & Planning" },
  { id: "general-contractor", name: "General contractor", slug: "construction-general-contractor", parentName: "Construction" },
  { id: "landscape-architect", name: "Garden design", slug: "outdoor-garden", parentName: "Outdoor" },
  { id: "hvac-specialist", name: "HVAC specialist", slug: "systems-domotica", parentName: "Systems" },
  { id: "roofer", name: "Roof", slug: "construction-roof", parentName: "Construction" },
]

const EMAIL_REGEX = /^(?:[a-zA-Z0-9_'^&amp;+-])+(?:\.(?:[a-zA-Z0-9_'^&amp;+-])+)*@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/

function getDomain(email: string) {
  const parts = email.split("@").map((part) => part.trim().toLowerCase())
  return parts.length === 2 ? parts[1] : ""
}

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

type CategoriesRow = Tables<"categories">
type ProjectProfessionalServiceRow = Tables<"project_professional_services">
type ProjectProfessionalRow = Tables<"project_professionals">
type ProjectCategoryAttributeRow = Tables<"project_category_attributes">
type ProjectRow = Tables<"projects">

type ProjectPreviewSummary = {
  title: string
  description: string | null
  styleLabel: string
  projectTypeLabel: string
  locationLabel: string
  coverPhotoUrl: string | null
  photoCount: number
  status: ProjectRow["status"]
  updatedAt: string | null
  buildingTypeLabel: string
  sizeLabel: string
}

type ServiceOption = {
  id: string
  name: string
  slug: string | null
  icon?: string | null
  parentName: string | null
  parentSortOrder?: number | null
  sortOrder?: number | null
}

type InviteSummary = {
  id: string
  serviceCategoryIds: string[]
  email: string
  status: ProjectProfessionalRow["status"]
  invitedAt: string
  respondedAt: string | null
  professional_id?: string | null
  company_id?: string | null
  is_project_owner?: boolean
}

const INVITE_STATUS_META: Partial<
  Record<ProjectProfessionalRow["status"], { label: string; className: string }>
> = {
  invited: { label: "Invited", className: "bg-blue-100 text-blue-800" },
  listed: { label: "Listed", className: "bg-green-100 text-green-800" },
  live_on_page: { label: "Featured", className: "bg-teal-100 text-teal-800" },
  unlisted: { label: "Unlisted", className: "bg-surface text-foreground" },
  removed: { label: "Removed", className: "bg-red-100 text-red-800" },
  rejected: { label: "Declined", className: "bg-red-100 text-red-800" },
} as const

const formatInviteStatusLabel = (status: ProjectProfessionalRow["status"]) =>
  status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")

const getInviteStatusMeta = (status: ProjectProfessionalRow["status"]) =>
  INVITE_STATUS_META[status] ?? { label: formatInviteStatusLabel(status), className: "bg-surface text-foreground" }

export default function ProfessionalsPage() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), [])
  const router = useRouter()
  const searchParams = useSearchParams()
  const { canPublishProjects } = useCompanyEntitlements()

  const TOTAL_STEPS = canPublishProjects ? TOTAL_STEPS_PUBLISHER : TOTAL_STEPS_NON_PUBLISHER

  const projectIdFromParams = searchParams.get("projectId")

  const [currentStep, setCurrentStep] = useState(1)
  const [isInitializing, setIsInitializing] = useState(true)
  const [projectLoadError, setProjectLoadError] = useState<string | null>(null)
  const [serviceLoadError, setServiceLoadError] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)

  const [projectId, setProjectId] = useState<string | null>(null)
  const [projectSlug, setProjectSlug] = useState<string | null>(null)
  const [projectTitle, setProjectTitle] = useState<string>("")
  const [projectSummary, setProjectSummary] = useState<ProjectPreviewSummary | null>(null)
  const [projectClientId, setProjectClientId] = useState<string | null>(null)

  const [serviceOptions, setServiceOptions] = useState<ServiceOption[]>(FALLBACK_SERVICE_OPTIONS)
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [invitesByService, setInvitesByService] = useState<Record<string, InviteSummary[]>>({})

  const [isMutating, setIsMutating] = useState(false)
  const [isSavingInvite, setIsSavingInvite] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteServiceId, setInviteServiceId] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState("")
  const [editingInviteId, setEditingInviteId] = useState<string | null>(null)

  // Professional discovery state for Phase 1C
  const [professionals, setProfessionals] = useState<ProfessionalOption[]>([])
  const [selectedProfessional, setSelectedProfessional] = useState<ProfessionalOption | null>(null)
  const [userTypes, setUserTypes] = useState<string[]>([])
  const [user, setUser] = useState<{ id: string } | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadContext = async () => {
      if (!projectIdFromParams) {
        router.replace("/new-project/details")
        return
      }

      setIsInitializing(true)
      setProjectLoadError(null)
      setServiceLoadError(null)
      setMutationError(null)

      const { data: authData, error: authError } = await supabase.auth.getUser()

      if (authError || !authData?.user) {
        if (!cancelled) {
          setProjectLoadError("You need to be signed in to continue.")
          setIsInitializing(false)
        }
        router.replace("/new-project/details")
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("user_types")
        .eq("id", authData.user.id)
        .maybeSingle()

      const userIsAdmin = isAdminUser(profile?.user_types)

      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select(
          "id, client_id, slug, title, description, project_type, project_type_category_id, building_type, project_size, budget_level, project_year, building_year, style_preferences, address_city, address_region, updated_at, created_at, status",
        )
        .eq("id", projectIdFromParams)
        .maybeSingle()

      if (projectError || !isProjectRow(projectData)) {
        if (!cancelled) {
          setProjectLoadError(
            projectError?.message ?? "We couldn't find that project. Please start from Project Details.",
          )
          setIsInitializing(false)
        }
        router.replace("/new-project/details")
        return
      }

      if (projectData.client_id !== authData.user.id && !userIsAdmin) {
        if (!cancelled) {
          setProjectLoadError("You don't have permission to edit this project.")
          setIsInitializing(false)
        }
        router.replace("/new-project/details")
        return
      }

      if (cancelled) {
        return
      }

      setProjectId(projectData.id)
      setProjectSlug(projectData.slug)
      setProjectTitle(projectData.title ?? "")
      setProjectClientId(projectData.client_id)

      // Load user profile and type information for professional discovery
      setUser({ id: authData.user.id })
      const userProfile = await loadUserProfile(authData.user.id)
      
      await Promise.all([
        loadServiceOptions(),
        loadServiceSelections(projectData.id),
        loadInvites(projectData.id),
        loadPreviewData(projectData),
        loadProfessionals(userProfile?.user_types || [], authData.user.id),
      ])

      if (!cancelled) {
        setIsInitializing(false)
      }
    }

    const loadServiceOptions = async () => {
      const { data: childRows, error: childError } = await supabase
        .from("categories")
        .select("id, name, slug, icon, sort_order, parent_id")
        .eq("is_active", true)
        .not("parent_id", "is", null)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true })

      if (childError || !childRows) {
        setServiceLoadError(childError?.message ?? "We couldn't load professional services.")
        setServiceOptions(FALLBACK_SERVICE_OPTIONS)
        return
      }

      const children: CategoriesRow[] = childRows ?? []

      if (children.length === 0) {
        setServiceOptions(FALLBACK_SERVICE_OPTIONS)
        return
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
        setServiceLoadError(parentResult.error.message)
      }

      if (attributeResult.error) {
        setServiceLoadError((prev) => prev ?? attributeResult.error!.message)
      }

      const parentMap = new Map<string, { name: string | null; sortOrder: number | null }>()
      ;(parentResult.data ?? []).forEach((row) => {
        parentMap.set(row.id, { name: row.name, sortOrder: row.sort_order })
      })

      const excludedIds = new Set((attributeResult.data ?? []).map((row) => row.category_id))

      const filtered = children.filter((row) => !excludedIds.has(row.id))

      if (filtered.length === 0) {
        setServiceOptions(FALLBACK_SERVICE_OPTIONS)
        return
      }

      const mapped = filtered
        .map<ServiceOption>((row) => {
          const parentMeta = row.parent_id ? parentMap.get(row.parent_id) : null
          return {
            id: row.id,
            name: row.name,
            slug: row.slug,
            icon: row.icon,
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

      setServiceOptions(mapped)
    }

    const loadServiceSelections = async (projectId: string) => {
      const { data, error } = await supabase
        .from("project_professional_services")
        .select("id, service_category_id")
        .eq("project_id", projectId)

      if (error) {
        setMutationError(error.message)
        return
      }

      const selections: ProjectProfessionalServiceRow[] = data ?? []
      setSelectedServiceIds(selections.map((row) => row.service_category_id))
    }

    const loadPreviewData = async (project: ProjectRow) => {
      const projectTypeCategoryId = project.project_type_category_id ?? (isUuid(project.project_type) ? project.project_type : null)

      const [photoResult, styleResult, typeResult, sizeResult, buildingTypeResult] = await Promise.all([
        supabase
          .from("project_photos")
          .select("id, url, is_primary, order_index")
          .eq("project_id", project.id)
          .order("is_primary", { ascending: false })
          .order("order_index", { ascending: true, nullsFirst: false }),
        project.style_preferences?.length && isUuid(project.style_preferences[0] ?? "")
          ? supabase
              .from("project_taxonomy_options")
              .select("id, name")
              .eq("id", project.style_preferences[0] ?? "")
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        projectTypeCategoryId
          ? supabase
              .from("categories")
              .select("id, name")
              .eq("id", projectTypeCategoryId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        project.project_size && isUuid(project.project_size)
          ? supabase
              .from("project_taxonomy_options")
              .select("id, name")
              .eq("id", project.project_size)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        project.building_type && isUuid(project.building_type)
          ? supabase
              .from("project_taxonomy_options")
              .select("id, name")
              .eq("id", project.building_type)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ])

      const photos = photoResult.data ?? []
      const coverPhoto =
        photos.find((photo) => Boolean(photo.is_primary)) ?? (photos.length > 0 ? photos[0] : null)

      const rawStyle = project.style_preferences?.[0] ?? ""
      const styleLabel =
        styleResult.data?.name ?? (rawStyle && !isUuid(rawStyle) ? rawStyle : "")

      const rawProjectType = project.project_type ?? ""
      const projectTypeLabel =
        typeResult.data?.name ?? (rawProjectType && !isUuid(rawProjectType) ? rawProjectType : "")

      const rawSize = project.project_size ?? ""
      const sizeLabel =
        sizeResult.data?.name ?? (rawSize && !isUuid(rawSize) ? rawSize : "")

      const rawBuildingType = project.building_type ?? ""
      const buildingTypeLabel =
        buildingTypeResult.data?.name ?? (rawBuildingType && !isUuid(rawBuildingType) ? rawBuildingType : "")

      const locationLabel = project.address_city || ""

      setProjectSummary({
        title: project.title ?? "",
        description: project.description,
        styleLabel,
        projectTypeLabel,
        locationLabel,
        coverPhotoUrl: coverPhoto?.url ?? null,
        photoCount: photos.length,
        status: project.status,
        updatedAt: project.updated_at ?? project.created_at,
        buildingTypeLabel,
        sizeLabel,
      })
    }

    const loadInvites = async (projectId: string) => {
      const { data, error } = await supabase
        .from("project_professionals")
        .select("id, invited_email, invited_service_category_ids, status, invited_at, responded_at, professional_id, company_id, is_project_owner")
        .eq("project_id", projectId)
        .order("invited_at", { ascending: true, nullsFirst: false })

      if (error) {
        setMutationError(error.message)
        return
      }

      // Fan out: one invite with multiple serviceIds appears in each service bucket
      const grouped: Record<string, InviteSummary[]> = {}
      for (const row of data ?? []) {
        const serviceIds = (row.invited_service_category_ids as string[] | null) ?? []
        const summary: InviteSummary = {
          id: row.id,
          email: row.invited_email,
          serviceCategoryIds: serviceIds,
          status: row.status,
          invitedAt: row.invited_at,
          respondedAt: row.responded_at,
          professional_id: row.professional_id,
          company_id: row.company_id,
          is_project_owner: row.is_project_owner,
        }
        if (serviceIds.length > 0) {
          for (const sid of serviceIds) {
            if (!grouped[sid]) grouped[sid] = []
            grouped[sid].push(summary)
          }
        }
      }

      setInvitesByService(grouped)
    }

    const loadUserProfile = async (userId: string) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_types")
        .eq("id", userId)
        .maybeSingle()

      if (error) {
        console.warn("Failed to load user profile:", error)
        return null
      }

      return data
    }

    const loadProfessionals = async (userTypes: string[], userId: string) => {
      setUserTypes(userTypes)
      
      console.log("Loading professionals for user:", userId, "with types:", userTypes)
      
      // Use server action for all user types - it handles auth.users access properly
      const { data, error } = await getAvailableProfessionalsAction(userTypes, userId)
      
      if (error) {
        console.error("Failed to load professionals:", error)
        console.error("Error details:", JSON.stringify(error, null, 2))
        return
      }

      if (data) {
        console.log("Loaded professionals:", data)
        setProfessionals(data)
      } else {
        console.log("No professionals data returned")
      }
    }

    loadContext()

    return () => {
      cancelled = true
    }
  }, [projectIdFromParams, router, supabase])

  const isBusy = isInitializing || isMutating || isSavingInvite

  const selectedServiceNames = useMemo<string[]>(() => {
    if (selectedServiceIds.length === 0) {
      return []
    }

    const mapped = selectedServiceIds
      .map((id) => serviceOptions.find((option) => option.id === id)?.name ?? null)
      .filter((value): value is string => Boolean(value))

    if (mapped.length > 0) {
      return mapped
    }

    return selectedServiceIds
  }, [selectedServiceIds, serviceOptions])

  const handleSaveAndExit = () => {
    router.push("/dashboard/listings")
  }

  const handleBack = () => {
    if (currentStep === 1) {
      if (projectId) {
        router.push(`/new-project/photos?projectId=${projectId}&step=4`)
      } else {
        router.push("/new-project/photos")
      }
      return
    }

    setCurrentStep((step) => Math.max(1, step - 1))
  }

  const handleNext = async () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((step) => Math.min(TOTAL_STEPS, step + 1))
      return
    }

    if (!projectId) {
      router.push("/dashboard/listings")
      return
    }

    setMutationError(null)
    setIsMutating(true)

    try {
      const { error } = await supabase
        .from("projects")
        .update({ status: "in_progress" })
        .eq("id", projectId)

      if (error) {
        throw error
      }

      toast.success("Listing submitted for review", {
        description: "The Arco team will review your project and notify you once it's approved.",
      })

      setIsMutating(false)

      // Redirect admin users to admin projects page, others to dashboard listings
      const redirectPath = isAdminUser(userTypes) ? "/admin/projects" : "/dashboard/listings"
      router.push(redirectPath)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "We couldn't submit your listing for review. Please try again."
      setMutationError(message)
      toast.error("Submission failed", { description: message })
      setIsMutating(false)
    }
  }

  const openInviteModal = (serviceId: string, invite?: InviteSummary) => {
    if (!isUuid(serviceId)) {
      setInviteError("Please select a service from the Supabase taxonomy before sending invites.")
      return
    }

    if (!invite) {
      const existingInvites = invitesByService[serviceId] ?? []
      if (existingInvites.length >= 1) {
        setInviteError("Only one professional can be invited per service. Remove the existing invite before adding another.")
        return
      }
    }

    setInviteServiceId(serviceId)
    setInviteEmail(invite?.email ?? "")
    setEditingInviteId(invite?.id ?? null)
    setInviteError(null)
    setInviteModalOpen(true)
  }

  const closeInviteModal = () => {
    setInviteModalOpen(false)
    setInviteServiceId(null)
    setInviteEmail("")
    setEditingInviteId(null)
    setInviteError(null)
    setSelectedProfessional(null)
  }

  const toggleService = async (serviceId: string) => {
    if (!projectId || isMutating) {
      return
    }

    if (!isUuid(serviceId)) {
      setMutationError(
        "Professional taxonomy is currently unavailable. Please try again once the services list loads.",
      )
      return
    }

    setMutationError(null)
    setIsMutating(true)

    const currentlySelected = selectedServiceIds.includes(serviceId)

    try {
      if (currentlySelected) {
        // Remove this service from all affected invites
        const affectedInvites = invitesByService[serviceId] ?? []
        for (const inv of affectedInvites) {
          const newServiceIds = inv.serviceCategoryIds.filter(sid => sid !== serviceId)
          if (newServiceIds.length === 0) {
            await supabase.from("project_professionals").delete().eq("id", inv.id)
          } else {
            await supabase.from("project_professionals").update({ invited_service_category_ids: newServiceIds } as any).eq("id", inv.id)
          }
        }

        // Delete the service selection
        const { error } = await supabase
          .from("project_professional_services")
          .delete()
          .eq("project_id", projectId)
          .eq("service_category_id", serviceId)

        if (error) {
          throw error
        }

        setSelectedServiceIds((prev) => prev.filter((id) => id !== serviceId))
        setInvitesByService((prev) => {
          if (!prev[serviceId]) {
            return prev
          }
          const next = { ...prev }
          delete next[serviceId]
          return next
        })
      } else {
        const { data, error } = await supabase
          .from("project_professional_services")
          .insert({ project_id: projectId, service_category_id: serviceId })
          .select("id, service_category_id")
          .single()

        if (error) {
          throw error
        }

        if (data) {
          setSelectedServiceIds((prev) => [...prev, data.service_category_id])
        }
      }
    } catch (error) {
      setMutationError(
        error instanceof Error ? error.message : "We couldn't update your professional services. Please try again.",
      )
    } finally {
      setIsMutating(false)
    }
  }

  const removeService = (serviceId: string) => {
    toggleService(serviceId)
  }

  const deleteInvite = async (invite: InviteSummary) => {
    if (isSavingInvite) {
      return
    }

    setInviteError(null)
    setIsSavingInvite(true)

    try {
      const { error } = await supabase.from("project_professionals").delete().eq("id", invite.id)
      if (error) {
        throw error
      }

      setInvitesByService((prev) => {
        const next = { ...prev }
        // Remove invite from all service buckets it appears in
        for (const sid of invite.serviceCategoryIds) {
          const serviceInvites = next[sid] ?? []
          const filtered = serviceInvites.filter((row) => row.id !== invite.id)
          if (filtered.length === 0) {
            delete next[sid]
          } else {
            next[sid] = filtered
          }
        }
        return next
      })
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "We couldn't update that invite. Please try again.")
    } finally {
      setIsSavingInvite(false)
    }
  }

  const handleProfessionalSelect = async (professional: ProfessionalOption, serviceId: string) => {
    if (!projectId || isSavingInvite) {
      return
    }

    const existingInvites = invitesByService[serviceId] ?? []
    if (existingInvites.length >= 1) {
      setInviteError("Only one professional can be invited per service. Remove the existing invite before adding another.")
      return
    }

    setInviteError(null)
    setIsSavingInvite(true)

    try {
      const isProjectOwner = projectClientId === professional.user_id
      
      // Professional.email is now always real - comes from getAvailableProfessionalsAction
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

      setInvitesByService((prev) => {
        const nextInvite: InviteSummary = {
          id: data.id,
          email: data.invited_email,
          serviceCategoryIds: [serviceId],
          status: data.status,
          invitedAt: data.invited_at,
          respondedAt: data.responded_at,
          professional_id: data.professional_id,
          company_id: data.company_id,
          is_project_owner: data.is_project_owner,
        }

        return { ...prev, [serviceId]: [nextInvite] }
      })
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "We couldn't add this professional. Please try again.")
    } finally {
      setIsSavingInvite(false)
    }
  }

  const handleInviteSubmit = async () => {
    if (!projectId || !inviteServiceId || isSavingInvite) {
      return
    }

    if (!editingInviteId) {
      const existingInvites = invitesByService[inviteServiceId] ?? []
      if (existingInvites.length >= 1) {
        setInviteError("Only one professional can be invited per service. Remove the existing invite before adding another.")
        return
      }
    }

    // Determine email and professional data
    const email = selectedProfessional ? selectedProfessional.email : inviteEmail.trim()
    
    // Validate email if not using professional selection
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
    setIsSavingInvite(true)

    try {
      if (editingInviteId) {
        // For editing, we'll keep the simpler update logic for now
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

        setInvitesByService((prev) => {
          const serviceIds = (data.invited_service_category_ids as string[] | null) ?? []
          if (serviceIds.length === 0) return prev
          const next = { ...prev }
          for (const sid of serviceIds) {
            const existing = next[sid] ?? []
            next[sid] = existing.map((invite) =>
              invite.id === data.id
                ? {
                    id: data.id,
                    email: data.invited_email,
                    serviceCategoryIds: serviceIds,
                    status: data.status,
                    invitedAt: data.invited_at,
                    respondedAt: data.responded_at,
                  }
                : invite,
            )
          }
          return next
        })
      } else {
        // Use new createInvite function for new invites
        let professionalId = selectedProfessional?.id || null
        let companyId = selectedProfessional?.company_id || null
        let isProjectOwner = selectedProfessional && projectClientId === selectedProfessional.user_id

        // If no professional selected (email-only invite), check if email belongs to existing professional
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

        setInvitesByService((prev) => {
          const nextInvite: InviteSummary = {
            id: data.id,
            email: data.invited_email,
            serviceCategoryIds: [inviteServiceId],
            status: data.status,
            invitedAt: data.invited_at,
            respondedAt: data.responded_at,
            professional_id: data.professional_id,
            company_id: data.company_id,
            is_project_owner: data.is_project_owner,
          }

          return { ...prev, [inviteServiceId]: [nextInvite] }
        })
      }

      closeInviteModal()
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "We couldn't send that invite. Please try again.")
    } finally {
      setIsSavingInvite(false)
    }
  }

  const handleOpenPreview = useCallback(() => {
    if (!projectSlug) {
      return
    }

    const url = `/projects/${projectSlug}?preview=1`
    window.open(url, "_blank")
  }, [projectSlug])

  const isNextDisabled = isBusy

  return (
    <div className="min-h-screen bg-white">
      <ProfessionalsHeader onSaveAndExit={handleSaveAndExit} isDisabled={isBusy} />

      <main className="container mx-auto max-w-4xl px-4 pb-32 pt-16">
        <div className="mb-10">
          <SegmentedProgressBar currentGlobalStep={9 + currentStep} />
        </div>

        {projectLoadError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 body-small text-red-700">
            {projectLoadError}
          </div>
        )}

        {serviceLoadError && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 body-small text-amber-800">
            {serviceLoadError}
          </div>
        )}

        {mutationError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 body-small text-red-700">
            {mutationError}
          </div>
        )}


        {currentStep === 1 && <IntroStep isLoading={isInitializing} />}
        {canPublishProjects && currentStep === 2 && (
          <ServiceSelectionStep
            services={serviceOptions}
            selectedServiceIds={selectedServiceIds}
            onToggleService={toggleService}
            isBusy={isBusy}
          />
        )}
        {canPublishProjects && currentStep === 3 && (
          <InviteStep
            services={serviceOptions}
            selectedServiceIds={selectedServiceIds}
            invitesByService={invitesByService}
            professionals={professionals}
            selectedProfessional={selectedProfessional}
            userTypes={userTypes}
            projectClientId={projectClientId}
            onInvite={openInviteModal}
            onRemoveService={removeService}
            onDeleteInvite={deleteInvite}
            onProfessionalSelect={setSelectedProfessional}
            onProfessionalDirectSelect={handleProfessionalSelect}
            isBusy={isBusy}
            goToServiceSelection={() => setCurrentStep(2)}
          />
        )}
        {currentStep === (canPublishProjects ? 4 : 2) && (
          <PreviewStep
            project={projectSummary}
            services={selectedServiceNames}
            onPreview={handleOpenPreview}
            hasPreview={Boolean(projectSlug)}
            isLoading={isInitializing}
          />
        )}
      </main>

      <FooterNavigation
        currentStep={currentStep}
        totalSteps={TOTAL_STEPS}
        onBack={handleBack}
        onNext={handleNext}
        isNextDisabled={isNextDisabled}
      />

      {inviteModalOpen && inviteServiceId && (
        <InviteModal
          service={serviceOptions.find((service) => service.id === inviteServiceId)}
          email={inviteEmail}
          onEmailChange={setInviteEmail}
          onClose={closeInviteModal}
          onSubmit={handleInviteSubmit}
          isSubmitting={isSavingInvite}
          isEditing={Boolean(editingInviteId)}
          error={inviteError}
        />
      )}
    </div>
  )
}

function ProfessionalsHeader({
  onSaveAndExit,
  isDisabled,
}: {
  onSaveAndExit: () => void
  isDisabled: boolean
}) {
  return (
    <header className="border-b border-border bg-white">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex-shrink-0">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Arco%20Logo%20Large%20%281%29-DDrzilvIhjI3lRfCVwKO1XpAs6LDc6.svg"
              alt="Arco"
              className="h-4"
            />
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/help-center"
              target="_blank"
              rel="noopener noreferrer"
              className="body-small text-foreground px-3 py-1.5 rounded-full hover:bg-surface hover:text-text-secondary"
            >
              Questions?
            </a>
            <button
              onClick={onSaveAndExit}
              disabled={isDisabled}
              className="rounded-full bg-[#F2F2F2] text-[#222222] hover:bg-[#EBEBEB] px-[18px] py-3 body-small font-medium leading-[1.2] tracking-[0] transition-colors disabled:cursor-not-allowed disabled:bg-transparent disabled:border disabled:border-[#EBEBEB] disabled:text-[#EBEBEB]"
            >
              {isDisabled ? "Saving..." : "Save and Exit"}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}


function IntroStep({ isLoading }: { isLoading: boolean }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      {isLoading ? (
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
      ) : (
        <div className="max-w-2xl text-left">
          <div className="mb-8">
            <MailPlus className="h-12 w-12 text-foreground" />
          </div>
          <h1 className="heading-3 mb-4">Share who helped you realise it</h1>
          <p className="text-lg text-text-secondary">Add the professionals that contributed to your project and we&apos;ll invite them once you publish.</p>
        </div>
      )}
    </div>
  )
}

function ServiceSelectionStep({
  services,
  selectedServiceIds,
  onToggleService,
  isBusy,
}: {
  services: ServiceOption[]
  selectedServiceIds: string[]
  onToggleService: (serviceId: string) => void
  isBusy: boolean
}) {
  if (services.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 body-small text-text-secondary">
        No professional services available yet. Try again later.
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="heading-3 mb-4">Tell us what professionals helped you realise it</h1>
        <p className="text-lg text-text-secondary">You can add more services after you publish your project.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => {
          const isSelected = selectedServiceIds.includes(service.id)
          const IconComponent = resolveProfessionalServiceIcon(service.slug, service.parentName)
          return (
            <button
              key={service.id}
              type="button"
              onClick={() => onToggleService(service.id)}
              disabled={isBusy}
              aria-pressed={isSelected}
              className={`flex h-full flex-col rounded-lg border-2 p-4 text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-900/40 ${
                isSelected ? "border-foreground bg-surface" : "border-border bg-white hover:border-border"
              } disabled:cursor-not-allowed disabled:opacity-60`}
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
  )
}

function InviteStep({
  services,
  selectedServiceIds,
  invitesByService,
  professionals,
  selectedProfessional,
  userTypes,
  projectClientId,
  onInvite,
  onRemoveService,
  onDeleteInvite,
  onProfessionalSelect,
  onProfessionalDirectSelect,
  isBusy,
  goToServiceSelection,
}: {
  services: ServiceOption[]
  selectedServiceIds: string[]
  invitesByService: Record<string, InviteSummary[]>
  professionals: ProfessionalOption[]
  selectedProfessional: ProfessionalOption | null
  userTypes: string[]
  projectClientId: string | null
  onInvite: (serviceId: string, invite?: InviteSummary) => void
  onRemoveService: (serviceId: string) => void
  onDeleteInvite: (invite: InviteSummary) => void
  onProfessionalSelect: (professional: ProfessionalOption | null) => void
  onProfessionalDirectSelect: (professional: ProfessionalOption, serviceId: string) => void
  isBusy: boolean
  goToServiceSelection: () => void
}) {
  const selectedServices = services.filter((service) => selectedServiceIds.includes(service.id))

  if (selectedServices.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="flex items-start gap-4">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          <div>
            <p className="font-medium text-foreground">No professional services selected yet</p>
            <p className="mt-1 body-small text-text-secondary">Select one or more services first to invite your collaborators.</p>
            <button
              onClick={goToServiceSelection}
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 body-small font-medium text-foreground transition-colors hover:bg-surface"
            >
              <Plus className="h-4 w-4" /> Add professional services
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="heading-3 mb-2">Invite professionals</h1>
          <p className="text-lg text-text-secondary">We&apos;ll email them once your project is published.</p>
        </div>
        <button
          onClick={goToServiceSelection}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-white transition-colors hover:bg-secondary-hover"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {selectedServices.map((service) => {
          const invites = invitesByService[service.id] ?? []
          const IconComponent = resolveProfessionalServiceIcon(service.slug, service.parentName)
          const hasInvite = invites.length > 0
          const editableInvite = invites.find((invite) => invite.status === "invited") ?? null
          const primaryActionIcon = hasInvite && editableInvite ? Pencil : MailPlus
          const primaryActionLabel =
            hasInvite && !editableInvite
              ? "Invite already added"
              : hasInvite
                ? "Edit invite"
                : "Invite professional"
          const primaryActionDisabled = isBusy || (hasInvite && !editableInvite)
          const handlePrimaryAction = () => {
            if (primaryActionDisabled) {
              return
            }
            if (hasInvite) {
              if (editableInvite) {
                onInvite(service.id, editableInvite)
              }
              return
            }
            onInvite(service.id)
          }
          return (
            <div
              key={service.id}
              className="flex h-full flex-col rounded-2xl border border-border bg-white p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-text-secondary">
                    <IconComponent aria-hidden className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="body-regular font-semibold text-foreground">{service.name}</h2>
                    {service.parentName && <p className="text-xs text-text-secondary">{service.parentName}</p>}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F2F2F2] text-[#222222] transition-colors hover:bg-[#EBEBEB] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-transparent disabled:border disabled:border-[#EBEBEB] disabled:text-[#EBEBEB]"
                      aria-label={`Manage actions for ${service.name}`}
                      disabled={isBusy}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onSelect={handlePrimaryAction} disabled={primaryActionDisabled}>
                      {primaryActionIcon === Pencil ? (
                        <Pencil className="h-4 w-4" />
                      ) : (
                        <MailPlus className="h-4 w-4" />
                      )}
                      {primaryActionLabel}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => onRemoveService(service.id)}
                      disabled={isBusy}
                      variant="destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove service
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-4 flex flex-1 flex-col">
                {invites.length === 0 ? (
                  <div className="flex flex-1 flex-col justify-end">
                    {userTypes.includes('admin') || userTypes.includes('professional') ? (
                      <div className="mt-auto flex w-full">
                        <button
                          type="button"
                          onClick={() => onInvite(service.id)}
                          disabled={isBusy}
                          className="flex-1 inline-flex items-center justify-center gap-2 rounded-l-full bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 body-small font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <MailPlus className="h-4 w-4" />
                          Invite professional
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              disabled={isBusy}
                              className="inline-flex items-center justify-center bg-secondary text-secondary-foreground hover:bg-secondary/80 px-2 py-2 transition-colors disabled:cursor-not-allowed disabled:opacity-60 rounded-r-full"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-64" align="end">
                            {professionals.length > 0 ? (
                              professionals.map((professional) => (
                                <DropdownMenuItem
                                  key={professional.id}
                                  onSelect={() => onProfessionalDirectSelect(professional, service.id)}
                                >
                                  <div className="font-medium">{professional.company.name}</div>
                                </DropdownMenuItem>
                              ))
                            ) : (
                              <DropdownMenuItem disabled>
                                <div className="body-small text-text-secondary">No professionals available</div>
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onInvite(service.id)}
                        disabled={isBusy}
                        className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 body-small font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <MailPlus className="h-4 w-4" />
                        Invite professional
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col justify-end gap-3">
                    <div className="space-y-3">
                      {invites.map((invite) => {
                        // Check if this invite has a professional_id (selected professional)
                        const selectedProf = invite.professional_id ? professionals.find(p => p.id === invite.professional_id) : null
                        
                        if (selectedProf) {
                          // Render selected professional card
                          let statusMeta = getInviteStatusMeta(invite.status)
                          
                          // Override status if this is the project owner
                          if (invite.is_project_owner) {
                            statusMeta = {
                              label: "Project owner",
                              className: "bg-blue-100 text-blue-800"
                            }
                          }

                          return (
                            <div key={invite.id} className="rounded-xl p-3">
                              <p className="body-small font-medium text-foreground">{selectedProf.company.name}</p>
                              <div className="mt-2 flex items-center justify-between gap-3">
                                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${statusMeta.className}`}>
                                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                  {statusMeta.label}
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => onDeleteInvite(invite)}
                                    disabled={isBusy}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#F2F2F2] text-[#222222] transition-colors hover:bg-[#EBEBEB] disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-transparent disabled:border disabled:border-[#EBEBEB] disabled:text-[#EBEBEB]"
                                    aria-label={`Remove ${selectedProf.company.name}`}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )
                        } else {
                          // Render email invite card
                          const statusMeta = getInviteStatusMeta(invite.status)
                          return (
                            <div key={invite.id} className="rounded-xl p-3">
                              <p className="body-small font-medium text-foreground">{invite.email}</p>
                              <div className="mt-2 flex items-center justify-between gap-3">
                                <span
                                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${statusMeta.className}`}
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                  {statusMeta.label}
                                </span>
                                <div className="flex items-center gap-2">
                                  {invite.status === "invited" && (
                                    <button
                                      type="button"
                                      onClick={() => onInvite(service.id, invite)}
                                      disabled={isBusy}
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#F2F2F2] text-[#222222] transition-colors hover:bg-[#EBEBEB] disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-transparent disabled:border disabled:border-[#EBEBEB] disabled:text-[#EBEBEB]"
                                      aria-label={`Edit invite for ${invite.email}`}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => onDeleteInvite(invite)}
                                    disabled={isBusy}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#F2F2F2] text-[#222222] transition-colors hover:bg-[#EBEBEB] disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-transparent disabled:border disabled:border-[#EBEBEB] disabled:text-[#EBEBEB]"
                                    aria-label={`Remove invite for ${invite.email}`}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )
                        }
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PreviewStep({
  project,
  services,
  onPreview,
  hasPreview,
  isLoading,
}: {
  project: ProjectPreviewSummary | null
  services: string[]
  onPreview: () => void
  hasPreview: boolean
  isLoading: boolean
}) {
  if (isLoading && !project) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="flex items-start gap-3 body-small text-text-secondary">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <div>
            <p className="font-medium text-foreground">We need a bit more info</p>
            <p className="mt-1">
              Save your project details first so we can build an accurate preview. Once the basics are filled in, your
              cover photo, summary, and project sections will appear here.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const subtitleParts = [project.styleLabel, project.projectTypeLabel].filter(Boolean)
  const detailItems = [
    { label: "Building type", value: project.buildingTypeLabel },
    { label: "Project size", value: project.sizeLabel },
    { label: "Photo count", value: project.photoCount ? `${project.photoCount}` : null },
    { label: "Status", value: project.status.replace("_", " ") },
  ].filter((item) => item.value)

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="heading-3">Yeah! It&apos;s time to showcase your work</h1>
        <p className="text-text-secondary">This is what homeowners will see when they explore your project.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left side - Actual project card preview */}
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-lg bg-surface">
            <img
              src={project.coverPhotoUrl || "/placeholder.svg"}
              alt={project.title || ""}
              className="aspect-square w-full object-cover"
            />
            <button
              onClick={onPreview}
              disabled={!hasPreview}
              className="absolute top-3 left-3 rounded-full bg-[#F2F2F2] text-[#222222] hover:bg-[#EBEBEB] px-[18px] py-3 body-small font-medium leading-[1.2] tracking-[0] transition-colors disabled:cursor-not-allowed disabled:bg-transparent disabled:border disabled:border-[#EBEBEB] disabled:text-[#EBEBEB]"
            >
              Show preview
            </button>
          </div>
          <div className="mt-3">
            <p className="body-small font-medium leading-[1.2] tracking-[0] text-foreground line-clamp-2">
              {subtitleParts.length > 0 && subtitleParts.join(" ")}
              {project.locationLabel && ` in ${project.locationLabel}`}
            </p>
          </div>
          {!hasPreview && (
            <div className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              Add a project title to generate a preview link.
            </div>
          )}
        </div>

        {/* Right side - What's next */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-foreground">What&apos;s next</h2>

          <div className="space-y-6">
            <div className="flex gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Your listing will be reviewed</h3>
                <p className="body-small text-text-secondary leading-relaxed">
                  Our team will review your listing before it goes live. Once approved, you&apos;ll receive a notification and you can return here to make updates anytime.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Bring your collaborators onboard</h3>
                <p className="body-small text-text-secondary leading-relaxed">
                  Each professional you invite will receive an email to join as a contributor. More collaborators mean more exposure, so get your invites accepted to maximize your reach.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FooterNavigation({
  currentStep,
  totalSteps,
  onBack,
  onNext,
  isNextDisabled,
}: {
  currentStep: number
  totalSteps: number
  onBack: () => void
  onNext: () => void
  isNextDisabled: boolean
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-white p-4 shadow-lg">
      <div className="container mx-auto max-w-4xl">
        <div className="flex gap-4 justify-center">
          <Button
            onClick={onBack}
            variant="tertiary"
            size="tertiary"
          >
            Back
          </Button>
          <Button
            onClick={onNext}
            disabled={isNextDisabled}
            variant="secondary"
            size="lg"
          >
            {currentStep === totalSteps ? "Submit for review" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function ProfessionalDropdown({ 
  professionals, 
  selectedProfessional, 
  onSelect 
}: {
  professionals: ProfessionalOption[]
  selectedProfessional: ProfessionalOption | null
  onSelect: (professional: ProfessionalOption | null) => void
}) {
  if (professionals.length === 0) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-full rounded-md border border-border px-3 py-2 text-left body-small focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900/40">
          {selectedProfessional ? selectedProfessional.company.name : "Choose professional..."}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-full">
        {professionals.map((professional) => (
          <DropdownMenuItem
            key={professional.id}
            onSelect={() => onSelect(professional)}
          >
            <div>
              <div className="font-medium">{professional.company.name}</div>
              <div className="body-small text-text-secondary">
                {professional.name} - {professional.title}
              </div>
              {(professional.company.city || professional.company.country) && (
                <div className="text-xs text-muted-foreground">
                  {[professional.company.city, professional.company.country].filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          </DropdownMenuItem>
        ))}
        {selectedProfessional && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onSelect(null)}>
              Clear selection
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function InviteModal({
  service,
  email,
  onEmailChange,
  onClose,
  onSubmit,
  isSubmitting,
  isEditing,
  error,
}: {
  service?: ServiceOption
  email: string
  onEmailChange: (value: string) => void
  onClose: () => void
  onSubmit: () => void
  isSubmitting: boolean
  isEditing: boolean
  error: string | null
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {isEditing ? "Update invite" : "Invite professional"}
            </h3>
            {service && (
              <p className="mt-1 body-small text-text-secondary">Service: {service.name}</p>
            )}
          </div>
          <button onClick={onClose} className="rounded-md p-2 text-text-secondary transition-colors hover:bg-surface">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="invite-email" className="mb-2 block body-small font-medium text-foreground">
              Company email address
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="name@company.com"
              className={`w-full rounded-md border px-3 py-2 body-small focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900/40 ${
                error ? 'border-red-300' : 'border-border'
              }`}
            />
            {error && (
              <p className="mt-2 body-small text-red-600">
                {error}
              </p>
            )}
            <p className="mt-2 body-small text-text-secondary">
              No invites are sent until the project is approved by Arco.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button
            onClick={onClose}
            variant="tertiary"
            size="sm"
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isSubmitting}
            variant="secondary"
            size="sm"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Add to project
          </Button>
        </div>
      </div>
    </div>
  )
}
