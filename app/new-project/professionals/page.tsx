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
import { toast } from "sonner"
import { resolveProfessionalServiceIcon } from "@/lib/icons/professional-services"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const TOTAL_STEPS = 4
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
  serviceCategoryId: string
  email: string
  status: ProjectProfessionalRow["status"]
  invitedAt: string
  respondedAt: string | null
}

const INVITE_STATUS_META: Partial<
  Record<ProjectProfessionalRow["status"], { label: string; className: string }>
> = {
  invited: { label: "Invite sent", className: "bg-amber-100 text-amber-800" },
  listed: { label: "Listed", className: "bg-green-100 text-green-800" },
  live_on_page: { label: "Listed", className: "bg-green-100 text-green-800" },
  unlisted: { label: "Unlisted", className: "bg-gray-200 text-gray-700" },
  removed: { label: "Removed", className: "bg-red-100 text-red-800" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800" },
} as const

const formatInviteStatusLabel = (status: ProjectProfessionalRow["status"]) =>
  status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")

const getInviteStatusMeta = (status: ProjectProfessionalRow["status"]) =>
  INVITE_STATUS_META[status] ?? { label: formatInviteStatusLabel(status), className: "bg-gray-100 text-gray-800" }

export default function ProfessionalsPage() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), [])
  const router = useRouter()
  const searchParams = useSearchParams()

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

      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select(
          "id, client_id, slug, title, description, project_type, project_type_category_id, building_type, project_size, budget_level, project_year, building_year, style_preferences, address_city, address_region, updated_at, created_at, status",
        )
        .eq("id", projectIdFromParams)
        .maybeSingle()

      if (projectError || !isProjectRow(projectData) || projectData.client_id !== authData.user.id) {
        if (!cancelled) {
          setProjectLoadError(
            projectError?.message ?? "We couldn't find that project. Please start from Project Details.",
          )
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

      await Promise.all([
        loadServiceOptions(),
        loadServiceSelections(projectData.id),
        loadInvites(projectData.id),
        loadPreviewData(projectData),
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

      const locationLabel = [project.address_city, project.address_region].filter(Boolean).join(", ")

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
        .select("id, invited_email, invited_service_category_id, status, invited_at, responded_at")
        .eq("project_id", projectId)
        .order("invited_at", { ascending: true, nullsFirst: false })

      if (error) {
        setMutationError(error.message)
        return
      }

      const grouped = (data ?? []).reduce<Record<string, InviteSummary[]>>((acc, row) => {
        const serviceId = row.invited_service_category_id
        if (!serviceId) {
          return acc
        }
        if (!acc[serviceId]) {
          acc[serviceId] = []
        }
        acc[serviceId].push({
          id: row.id,
          email: row.invited_email,
          serviceCategoryId: serviceId,
          status: row.status,
          invitedAt: row.invited_at,
          respondedAt: row.responded_at,
        })
        return acc
      }, {})

      setInvitesByService(grouped)
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
        router.push(`/new-project/photos?projectId=${projectId}`)
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
      router.push("/dashboard/listings")
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
        const { error } = await supabase
          .from("project_professional_services")
          .delete()
          .eq("project_id", projectId)
          .eq("service_category_id", serviceId)

        if (error) {
          throw error
        }

        setSelectedServiceIds((prev) => prev.filter((id) => id !== serviceId))
        setServiceRowLookup((prev) => {
          const next = { ...prev }
          delete next[serviceId]
          return next
        })
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
        const serviceInvites = prev[invite.serviceCategoryId] ?? []
        const filtered = serviceInvites.filter((row) => row.id !== invite.id)
        const next = { ...prev }
        if (filtered.length === 0) {
          delete next[invite.serviceCategoryId]
        } else {
          next[invite.serviceCategoryId] = filtered
        }
        return next
      })
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "We couldn't update that invite. Please try again.")
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

    setInviteError(null)
    setIsSavingInvite(true)

    try {
      if (editingInviteId) {
        const { data, error } = await supabase
          .from("project_professionals")
          .update({ invited_email: trimmedEmail })
          .eq("id", editingInviteId)
          .select("id, invited_email, invited_service_category_id, status, invited_at, responded_at")
          .maybeSingle()

        if (error || !data) {
          throw error ?? new Error("Invite could not be updated.")
        }

        setInvitesByService((prev) => {
          const serviceId = data.invited_service_category_id
          if (!serviceId) {
            return prev
          }
          const existing = prev[serviceId] ?? []
          const updated = existing.map((invite) =>
            invite.id === data.id
              ? {
                  id: data.id,
                  email: data.invited_email,
                  serviceCategoryId: serviceId,
                  status: data.status,
                  invitedAt: data.invited_at,
                  respondedAt: data.responded_at,
                }
              : invite,
          )

          return { ...prev, [serviceId]: updated }
        })
      } else {
        const { data, error } = await supabase
          .from("project_professionals")
          .insert({
            project_id: projectId,
            invited_email: trimmedEmail,
            invited_service_category_id: inviteServiceId,
            status: "invited",
          })
          .select("id, invited_email, invited_service_category_id, status, invited_at, responded_at")
          .maybeSingle()

        if (error || !data) {
          throw error ?? new Error("Invite could not be saved.")
        }

        setInvitesByService((prev) => {
          const serviceId = data.invited_service_category_id
          if (!serviceId) {
            return prev
          }
          const nextInvite = {
            id: data.id,
            email: data.invited_email,
            serviceCategoryId: serviceId,
            status: data.status,
            invitedAt: data.invited_at,
            respondedAt: data.responded_at,
          }

          return { ...prev, [serviceId]: [nextInvite] }
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
          <ProgressIndicator currentStep={currentStep} totalSteps={TOTAL_STEPS} />
        </div>

        {projectLoadError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {projectLoadError}
          </div>
        )}

        {serviceLoadError && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {serviceLoadError}
          </div>
        )}

        {mutationError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {mutationError}
          </div>
        )}

        {inviteError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {inviteError}
          </div>
        )}

        {currentStep === 1 && <IntroStep isLoading={isInitializing} />}
        {currentStep === 2 && (
          <ServiceSelectionStep
            services={serviceOptions}
            selectedServiceIds={selectedServiceIds}
            onToggleService={toggleService}
            isBusy={isBusy}
          />
        )}
        {currentStep === 3 && (
          <InviteStep
            services={serviceOptions}
            selectedServiceIds={selectedServiceIds}
            invitesByService={invitesByService}
            onInvite={openInviteModal}
            onRemoveService={removeService}
            onDeleteInvite={deleteInvite}
            isBusy={isBusy}
            goToServiceSelection={() => setCurrentStep(2)}
          />
        )}
        {currentStep === 4 && (
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
    <header className="border-b border-gray-200 bg-white">
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
              className="text-sm text-gray-700 transition-colors hover:text-gray-900"
            >
              Questions?
            </a>
            <button
              onClick={onSaveAndExit}
              disabled={isDisabled}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDisabled ? "Saving..." : "Save and Exit"}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

function ProgressIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-900">Step {currentStep} of {totalSteps}</span>
        <span className="text-sm text-gray-500">{Math.round((currentStep / totalSteps) * 100)}% complete</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200">
        <div
          className="h-2 rounded-full bg-gray-900 transition-all duration-300 ease-out"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        />
      </div>
    </div>
  )
}

function IntroStep({ isLoading }: { isLoading: boolean }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      {isLoading ? (
        <Loader2 className="h-12 w-12 animate-spin text-gray-400" />
      ) : (
        <div className="max-w-2xl text-left">
          <div className="mb-8">
            <MailPlus className="h-16 w-16 text-gray-900" />
          </div>
          <h1 className="mb-4 text-3xl font-bold text-gray-900">Share who helped you realise it</h1>
          <p className="text-lg text-gray-600">Add the professionals that contributed to your project and we&apos;ll invite them once you publish.</p>
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
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
        No professional services available yet. Try again later.
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-4 text-3xl font-bold text-gray-900">Tell us what professionals helped you realise it</h1>
        <p className="text-lg text-gray-600">You can add more services after you publish your project.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                isSelected ? "border-gray-900 bg-gray-50" : "border-gray-200 bg-white hover:border-gray-300"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <IconComponent
                aria-hidden
                className={`mb-3 h-6 w-6 ${isSelected ? "text-gray-900" : "text-gray-700"}`}
              />
              <span className="mt-2 text-sm font-medium text-gray-900">{service.name}</span>
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
  onInvite,
  onRemoveService,
  onDeleteInvite,
  isBusy,
  goToServiceSelection,
}: {
  services: ServiceOption[]
  selectedServiceIds: string[]
  invitesByService: Record<string, InviteSummary[]>
  onInvite: (serviceId: string, invite?: InviteSummary) => void
  onRemoveService: (serviceId: string) => void
  onDeleteInvite: (invite: InviteSummary) => void
  isBusy: boolean
  goToServiceSelection: () => void
}) {
  const selectedServices = services.filter((service) => selectedServiceIds.includes(service.id))

  if (selectedServices.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
        <div className="flex items-start gap-4">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          <div>
            <p className="font-medium text-gray-900">No professional services selected yet</p>
            <p className="mt-1 text-sm text-gray-600">Select one or more services first to invite your collaborators.</p>
            <button
              onClick={goToServiceSelection}
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
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
          <h1 className="mb-2 text-3xl font-bold text-gray-900">Invite professionals</h1>
          <p className="text-lg text-gray-600">We&apos;ll email them once your project is published.</p>
        </div>
        <button
          onClick={goToServiceSelection}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-white transition-colors hover:bg-gray-800"
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
              className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                    <IconComponent aria-hidden className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">{service.name}</h2>
                    {service.parentName && <p className="text-xs text-gray-500">{service.parentName}</p>}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
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
                    <button
                      type="button"
                      onClick={() => onInvite(service.id)}
                      disabled={isBusy}
                      className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-md border border-gray-200 px-3 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <MailPlus className="h-4 w-4" />
                      Invite professional
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col gap-3">
                    <div className="space-y-3">
                      {invites.map((invite) => {
                        const statusMeta = getInviteStatusMeta(invite.status)
                        return (
                          <div key={invite.id} className="rounded-xl border border-gray-200 p-3">
                            <p className="text-sm font-medium text-gray-900">{invite.email}</p>
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
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    aria-label={`Edit invite for ${invite.email}`}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => onDeleteInvite(invite)}
                                  disabled={isBusy}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                                  aria-label={`Remove invite for ${invite.email}`}
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )
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
        <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
        <div className="flex items-start gap-3 text-sm text-gray-600">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <div>
            <p className="font-medium text-gray-900">We need a bit more info</p>
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
        <h1 className="text-3xl font-bold text-gray-900">Yeah! It&apos;s time to preview</h1>
        <p className="text-lg text-gray-600">Review everything before you invite the Arco team to approve it.</p>
      </div>

      <div className="rounded-md border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-medium text-blue-900">Ready to submit for review</p>
        <p className="mt-1">
          When you click <span className="font-semibold">Submit for review</span>, the Arco team checks your listing before it
          goes live. You&apos;ll be notified once it&apos;s approved, and you can return here any time to make updates.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="relative h-72 w-full bg-gray-100">
          {project.coverPhotoUrl ? (
            <img
              src={project.coverPhotoUrl}
              alt={project.title || "Project cover"}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-400">
              <ShieldAlert className="h-12 w-12" />
            </div>
          )}
          <div className="absolute left-4 top-4 flex gap-2">
            <button
              onClick={onPreview}
              disabled={!hasPreview}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Show preview
            </button>
            {!hasPreview && (
              <div className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                Add a project title to generate a preview link.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6 p-6">
          <header className="space-y-2">
            <h2 className="text-2xl font-semibold text-gray-900">{project.title || "Untitled project"}</h2>
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
              {subtitleParts.length > 0 && <span>{subtitleParts.join(" • ")}</span>}
              {project.locationLabel && subtitleParts.length > 0 && <span className="text-gray-300">|</span>}
              {project.locationLabel && <span>{project.locationLabel}</span>}
            </div>
          </header>

          {project.description ? (
            <div className="space-y-2 text-sm text-gray-700">
              <p className="font-medium text-gray-900">Intro</p>
              <p className="line-clamp-4 leading-relaxed">
                {project.description.replace(/<[^>]+>/g, " ") || "Project description will appear here."}
              </p>
            </div>
          ) : null}

          {detailItems.length > 0 && (
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {detailItems.map((detail) => (
                <div key={detail.label} className="space-y-1 rounded-md border border-gray-100 bg-gray-50 p-3">
                  <dt className="text-xs uppercase tracking-wide text-gray-500">{detail.label}</dt>
                  <dd className="text-sm font-medium text-gray-900">{detail.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {services.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900">Professional services involved</p>
              <div className="flex flex-wrap gap-2">
                {services.map((service) => (
                  <span key={service} className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
                    {service}
                  </span>
                ))}
              </div>
            </div>
          )}

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
    <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white p-4 shadow-lg">
      <div className="container mx-auto max-w-4xl">
        <div className="flex gap-4">
          <button
            onClick={onBack}
            disabled={currentStep === 1}
            className="flex-1 rounded-md border border-gray-300 px-6 py-3 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={onNext}
            disabled={isNextDisabled}
            className="flex-1 rounded-md bg-gray-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {currentStep === totalSteps ? "Submit for review" : "Next"}
          </button>
        </div>
      </div>
    </div>
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
}: {
  service?: ServiceOption
  email: string
  onEmailChange: (value: string) => void
  onClose: () => void
  onSubmit: () => void
  isSubmitting: boolean
  isEditing: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {isEditing ? "Update invite" : "Invite professional"}
            </h3>
            {service ? (
              <p className="mt-1 text-sm text-gray-500">Service: {service.name}</p>
            ) : null}
          </div>
          <button onClick={onClose} className="rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="invite-email" className="mb-2 block text-sm font-medium text-gray-700">
              Company email address
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="name@company.com"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900/40"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEditing ? "Save changes" : "Send invite"}
          </button>
        </div>
      </div>
    </div>
  )
}
