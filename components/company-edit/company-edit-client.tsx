"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { toast } from "sonner"
import { AlertTriangle, ImageIcon, MoreHorizontal, ExternalLink } from "lucide-react"
import { ImportProjectModal } from "@/components/import-project-modal"

import {
  updateCompanyProfileAction,
  updateCompanyContactAction,
  updateCompanyServicesAction,
  updateCompanySpecsAction,
  changeCompanyStatusAction,
  uploadCompanyLogoAction,
  setCompanyHeroPhotoAction,
  clearCompanyHeroPhotoAction,
  generateCompanyDescriptionAction,
  saveCompanyTranslatedField,
  checkCompanyDeletionAction,
  deleteCompanyAction,
  completeCompanySetupAction,
  updateCoverPhotoAction,
} from "@/app/dashboard/company/actions"
import { syncCompanyListedStatus } from "@/app/admin/projects/actions"
import { getCompanyTranslation } from "@/lib/company-translations"
import type { Database } from "@/lib/supabase/types"
import { useAuth } from "@/contexts/auth-context"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { CompanyEditSubNav } from "@/components/company-edit/company-edit-sub-nav"
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_DOT_CLASS,
  type ProjectStatus,
  type ListingStatusValue,
  isListingStatusValue,
  LISTING_STATUS_OPTIONS,
  ACTIVE_STATUS_VALUES,
} from "@/lib/project-status-config"
import {
  type ContributorStatus,
  CONTRIBUTOR_STATUS_LABELS,
  CONTRIBUTOR_STATUS_DOT_CLASS,
  CONTRIBUTOR_STATUS_OPTIONS,
  OWNER_STATUS_OPTIONS,
} from "@/lib/contributor-status-config"
import { ListingStatusModal } from "@/components/listing-status-modal"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import { sendDomainVerificationAction, verifyDomainCodeAction } from "@/app/create-company/actions"
import { SocialIconsRow } from "@/components/company-edit/social-icons-row"

// ── Types ──

type CompanyRow = Database["public"]["Tables"]["companies"]["Row"]
type CompanyStatus = CompanyRow["status"]
type ListingStatus = Extract<CompanyStatus, "listed" | "unlisted">
type SocialLinkRow = Pick<Database["public"]["Tables"]["company_social_links"]["Row"], "id" | "platform" | "url">
type Platform = "facebook" | "instagram" | "linkedin" | "pinterest"

interface SocialFormState {
  facebook: string
  instagram: string
  linkedin: string
  pinterest: string
}

interface CompanyProjectPhoto {
  id: string
  url: string
  isPrimary: boolean
}

interface CompanyProject {
  id: string
  slug: string | null
  title: string
  location: string | null
  status: string
  statusLabel: string
  statusDotClass: string
  subtitle: string
  isOwner: boolean
  coverImage: string | null
  coverPhotoId: string | null
  photos: CompanyProjectPhoto[]
  projectProfessionalId?: string
  projectProfessionalStatus?: string
  rejectionReason?: string | null
  rawProjectStatus?: string
}

interface ServiceCategory {
  name: string
  slug: string
  services: Array<{ id: string; name: string; slug: string | null }>
}

interface PendingProject {
  id: string
  title: string
  ppId: string
  ppStatus: string
}

export interface CompanyEditClientProps {
  company: CompanyRow
  socialLinks: SocialLinkRow[]
  services: Array<{ id: string; name: string; slug: string | null }>
  serviceCategories: ServiceCategory[]
  professionalId: string | null
  projects: CompanyProject[]
  heroPhotoUrl: string | null
  heroPhotoProjectId: string | null
  isSetupMode?: boolean
  pendingProjects?: PendingProject[]
  canPublishProjects?: boolean
  showImportedBanner?: boolean
  importedProjectId?: string | null
  adminCompanyId?: string
}

// ── Constants ──

const languageOptions = ["Dutch", "English", "German", "French", "Spanish"] as const
const certificateOptions = ["BNA", "LEED", "Passive House", "WELL"] as const

const STATUS_INDICATOR: Record<CompanyStatus, string> = {
  listed: "bg-emerald-500",
  unlisted: "bg-muted-foreground",
  deactivated: "bg-muted-foreground",
}

const STATUS_LABELS: Record<CompanyStatus, string> = {
  listed: "Listed",
  unlisted: "Unlisted",
  deactivated: "Deactivated",
}

// ── Pencil icon (reused from project edit) ──

const EditBadge = () => (
  <span className="ec-badge">
    <span className="ec-ico">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5Z" />
      </svg>
    </span>
    <span className="ec-txt">Edit</span>
  </span>
)

// ── Component ──

export function CompanyEditClient({ company, socialLinks, services, serviceCategories, professionalId, projects, heroPhotoUrl: initialHeroUrl, heroPhotoProjectId: initialHeroProjectId, isSetupMode = false, pendingProjects = [], canPublishProjects = false, showImportedBanner = false, importedProjectId = null, adminCompanyId }: CompanyEditClientProps) {
  const router = useRouter()
  const { user } = useAuth()
  const isOwner = user?.id === company.owner_id
  const t = useTranslations("company_edit")
  const locale = useLocale()

  // Admin override: set the active company cookie so server actions can access it
  useEffect(() => {
    if (adminCompanyId) {
      import("@/app/dashboard/company/actions").then(({ switchCompanyAction }) => {
        switchCompanyAction(adminCompanyId)
      })
    }
  }, [adminCompanyId])

  // ── Profile state ──
  const [name, setName] = useState(company.name)
  const [description, setDescription] = useState(() => getCompanyTranslation(company as any, "description", locale))
  const [email, setEmail] = useState(company.email ?? "")
  const [phone, setPhone] = useState(company.phone ?? "")
  const [address, setAddress] = useState(company.address ?? "")
  const [city, setCity] = useState(company.city ?? "")
  const [country, setCountry] = useState(company.country ?? "Netherlands")
  const [domain, setDomain] = useState(company.domain ?? (company.website ? company.website.replace(/^https?:\/\//i, "") : ""))
  const serviceIds = useMemo(() => new Set(services.map((s) => s.id)), [services])
  const [servicesOffered, setServicesOffered] = useState<string[]>(() => {
    // Filter out stale IDs that no longer exist in categories, ensure primary is first
    const offered = (company.services_offered ?? []).filter((id) => serviceIds.has(id))
    const primary = company.primary_service_id
    if (primary && serviceIds.has(primary) && !offered.includes(primary)) {
      return [primary, ...offered]
    }
    if (primary && offered.includes(primary)) {
      return [primary, ...offered.filter((id) => id !== primary)]
    }
    return offered
  })
  const [languages, setLanguages] = useState<string[]>(company.languages ?? [])
  const [certificates, setCertificates] = useState<string[]>(company.certificates ?? [])

  // ── Specs state ──
  const [foundedYear, setFoundedYear] = useState<number | null>(company.founded_year ?? null)
  const [teamSizeMin, setTeamSizeMin] = useState<number | null>(company.team_size_min ?? null)
  const [teamSizeMax, setTeamSizeMax] = useState<number | null>(company.team_size_max ?? null)

  // ── Social state ──
  const initialSocial = useMemo<SocialFormState>(() => {
    const s: SocialFormState = { facebook: "", instagram: "", linkedin: "", pinterest: "" }
    socialLinks.forEach((link) => {
      if (link.platform in s) s[link.platform as Platform] = link.url
    })
    return s
  }, [socialLinks])
  const [socialForm, setSocialForm] = useState<SocialFormState>(initialSocial)

  // ── Logo state ──
  const [logoUrl, setLogoUrl] = useState<string | null>(company.logo_url ?? null)
  const logoInputRef = useRef<HTMLInputElement | null>(null)

  // ── Status state ──
  const [companyStatus, setCompanyStatus] = useState<CompanyStatus>(company.status)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [projectDropdown, setProjectDropdown] = useState<string | null>(null)
  const [importModalOpen, setImportModalOpen] = useState(false)

  // ── Project card modal state ──
  const supabaseClient = useMemo(() => getBrowserSupabaseClient(), [])
  const [companyProjects, setCompanyProjects] = useState(projects)
  const [projectStatusModalOpen, setProjectStatusModalOpen] = useState(false)
  const [contributorStatusModalOpen, setContributorStatusModalOpen] = useState(false)
  const [coverPhotoModalOpen, setCoverPhotoModalOpen] = useState(false)
  const [selectedCardProject, setSelectedCardProject] = useState<CompanyProject | null>(null)
  const [selectedProjectStatus, setSelectedProjectStatus] = useState<ListingStatusValue | "">("")
  const [selectedContributorStatus, setSelectedContributorStatus] = useState<ContributorStatus | "">("")
  const [selectedCoverPhoto, setSelectedCoverPhoto] = useState<string | null>(null)
  const [isSavingProjectStatus, setIsSavingProjectStatus] = useState(false)
  const [isSavingCoverPhoto, setIsSavingCoverPhoto] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<ListingStatus>(
    company.status === "deactivated" ? "unlisted" : (company.status as ListingStatus)
  )

  // ── Domain verification state ──
  const [domainVerifyOpen, setDomainVerifyOpen] = useState(false)
  const [pendingDomain, setPendingDomain] = useState("")
  const [verifyEmail, setVerifyEmail] = useState("")
  const [verifyCode, setVerifyCode] = useState("")
  const [verifyCodeSent, setVerifyCodeSent] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)

  // ── Delete state ──
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [isCheckingDeletion, setIsCheckingDeletion] = useState(false)
  const [isDeletingCompany, setIsDeletingCompany] = useState(false)
  const [deletionCheck, setDeletionCheck] = useState<{
    canDelete: boolean
    companyName: string
    warnings: string[]
    blockers: string[]
  } | null>(null)

  // ── Hero photo state ──
  const [heroUrl, setHeroUrl] = useState<string | null>(initialHeroUrl)
  const [heroProjectId, setHeroProjectId] = useState<string | null>(initialHeroProjectId)
  const [pickerProject, setPickerProject] = useState<CompanyProject | null>(null)

  // ── Search preview state ──
  const [searchPreviewOpen, setSearchPreviewOpen] = useState(false)
  const [coverPickerOpen, setCoverPickerOpen] = useState(false)
  const [coverPickerStep, setCoverPickerStep] = useState<"project" | "photo">("project")
  const [coverPickerProject, setCoverPickerProject] = useState<CompanyProject | null>(null)

  // ── AI description state ──
  const [generatingDesc, setGeneratingDesc] = useState(false)
  const [descCharCount, setDescCharCount] = useState(() => (description ?? "").replace(/<[^>]*>/g, "").trim().length)
  const descRef = useRef<HTMLParagraphElement>(null)
  const autoGenerateTriggered = useRef(false)

  // Sync company listed status on load (corrects stale status)
  useEffect(() => {
    syncCompanyListedStatus(company.id).then(() => {
      // Refresh the page status if it changed
      supabaseClient.from("companies").select("status").eq("id", company.id).maybeSingle().then(({ data }) => {
        if (data?.status && data.status !== companyStatus) {
          setCompanyStatus(data.status as CompanyStatus)
          setSelectedStatus(data.status as CompanyStatus)
        }
      })
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-generate description on load for new companies without a description
  useEffect(() => {
    if (description || !company.domain || autoGenerateTriggered.current) return
    autoGenerateTriggered.current = true
    setGeneratingDesc(true)
    generateCompanyDescriptionAction(company.id).then((result) => {
      if (result.success && result.description) {
        setDescription(result.description)
        if (descRef.current) descRef.current.textContent = result.description
      }
      setGeneratingDesc(false)
    }).catch(() => setGeneratingDesc(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Inline edit state ──
  const [activeEditField, setActiveEditField] = useState<string | null>(null)
  const [editingSpecBar, setEditingSpecBar] = useState<string | null>(null)
  const [editSaveStatus, setEditSaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  const editSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)


  // ── Service popup state ──
  const [servicePopupOpen, setServicePopupOpen] = useState(false)
  const [serviceSearch, setServiceSearch] = useState("")
  const dragItemRef = useRef<number | null>(null)
  const servicesSnapshotRef = useRef<string[]>([])
  const dragOverRef = useRef<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  // ── Setup mode state ──
  const [setupBannerDismissed, setSetupBannerDismissed] = useState(false)
  const [importedBannerDismissed, setImportedBannerDismissed] = useState(false)
  const [goLiveListCompany, setGoLiveListCompany] = useState(true)
  const [goLiveListProjects, setGoLiveListProjects] = useState(true)
  const [isCompletingSetup, setIsCompletingSetup] = useState(false)
  const [publishPopupOpen, setPublishPopupOpen] = useState(false)
  const [importFirstProjectOpen, setImportFirstProjectOpen] = useState(false)
  const [highlightMissing, setHighlightMissing] = useState(false)

  const setupComplete = useMemo(() => ({
    name: !!name?.trim(),
    services: servicesOffered.length > 0,
    description: !!description?.trim(),
    location: !!city?.trim(),
    domain: !!domain?.trim(),
  }), [name, servicesOffered, description, city, domain])
  const allRequiredComplete = Object.values(setupComplete).every(Boolean)

  // Clear highlight when all fields are complete
  useEffect(() => {
    if (allRequiredComplete && highlightMissing) setHighlightMissing(false)
  }, [allRequiredComplete, highlightMissing])

  const handleCompleteSetup = useCallback(() => {
    if (!allRequiredComplete) {
      setHighlightMissing(true)
      setSetupBannerDismissed(false)
      return
    }

    if (importedProjectId) {
      // Came from /businesses/architects with a project → go straight to project edit
      completeCompanySetupAction({ listCompany: false, listProjectIds: [] }).then((result) => {
        if (result.success) {
          router.push(`/dashboard/edit/${importedProjectId}`)
        } else {
          toast.error(result.error ?? t("something_wrong"))
        }
      })
      return
    }

    // Show the appropriate popup
    setPublishPopupOpen(true)
  }, [allRequiredComplete, importedProjectId, router])

  // ── Project card handlers ──
  const userId = user?.id ?? null
  const companyPlan = (company.plan_tier ?? "basic") as "basic" | "plus"

  const handleProjectUpdateStatus = useCallback((project: CompanyProject) => {
    setProjectDropdown(null)
    setSelectedCardProject(project)
    // All statuses open the modal — draft shows submit for review option
    setSelectedContributorStatus((project.projectProfessionalStatus as ContributorStatus) || "listed")
    setContributorStatusModalOpen(true)
  }, [])

  const handleSaveProjectStatus = useCallback(async () => {
    if (!selectedCardProject || !selectedProjectStatus || !userId) return
    if (selectedProjectStatus === selectedCardProject.status) {
      setProjectStatusModalOpen(false)
      setSelectedCardProject(null)
      return
    }
    setIsSavingProjectStatus(true)
    try {
      const { error } = await supabaseClient.from("projects").update({ status: selectedProjectStatus }).eq("id", selectedCardProject.id).eq("client_id", userId)
      if (error) throw error
      setCompanyProjects(prev => prev.map(p => p.id === selectedCardProject.id ? {
        ...p,
        status: selectedProjectStatus,
        statusLabel: PROJECT_STATUS_LABELS[selectedProjectStatus as ProjectStatus],
        statusDotClass: PROJECT_STATUS_DOT_CLASS[selectedProjectStatus as ProjectStatus],
      } : p))
      toast.success(t("listing_updated"))
      setProjectStatusModalOpen(false)
      setSelectedCardProject(null)
    } catch {
      toast.error("Failed to update status. Please try again.")
    } finally {
      setIsSavingProjectStatus(false)
    }
  }, [selectedCardProject, selectedProjectStatus, userId, supabaseClient])

  const handleSaveContributorStatus = useCallback(async () => {
    if (!selectedCardProject?.projectProfessionalId || !selectedContributorStatus) return
    setIsSavingProjectStatus(true)
    try {
      const { error } = await supabaseClient.from("project_professionals").update({ status: selectedContributorStatus, responded_at: new Date().toISOString() }).eq("id", selectedCardProject.projectProfessionalId)
      if (error) throw error
      setCompanyProjects(prev => prev.map(p => p.id === selectedCardProject.id ? {
        ...p,
        projectProfessionalStatus: selectedContributorStatus,
        status: selectedContributorStatus,
        statusLabel: CONTRIBUTOR_STATUS_LABELS[selectedContributorStatus],
        statusDotClass: CONTRIBUTOR_STATUS_DOT_CLASS[selectedContributorStatus],
      } : p))
      // Sync company listed status
      await syncCompanyListedStatus(company.id)
      toast.success(t("listing_updated"))
      setContributorStatusModalOpen(false)
      setSelectedCardProject(null)
    } catch {
      toast.error("Failed to update status. Please try again.")
    } finally {
      setIsSavingProjectStatus(false)
    }
  }, [selectedCardProject, selectedContributorStatus, supabaseClient])

  const handleProjectChangeCover = useCallback((project: CompanyProject) => {
    setProjectDropdown(null)
    setSelectedCardProject(project)
    setSelectedCoverPhoto(project.coverPhotoId ?? project.photos[0]?.id ?? null)
    setCoverPhotoModalOpen(true)
  }, [])

  const handleSaveCoverPhoto = useCallback(async () => {
    if (!selectedCardProject || !selectedCoverPhoto) return
    setIsSavingCoverPhoto(true)
    try {
      const result = await updateCoverPhotoAction({
        projectId: selectedCardProject.id,
        photoId: selectedCoverPhoto,
        role: selectedCardProject.isOwner ? "owner" : "contributor",
        projectProfessionalId: selectedCardProject.projectProfessionalId ?? undefined,
      })
      if (!result.success) throw new Error(result.error)
      setCompanyProjects(prev => prev.map(p => {
        if (p.id !== selectedCardProject.id) return p
        const newCover = p.photos.find(ph => ph.id === selectedCoverPhoto)
        return { ...p, coverPhotoId: selectedCoverPhoto, coverImage: newCover?.url ?? p.coverImage, photos: p.photos.map(ph => ({ ...ph, isPrimary: ph.id === selectedCoverPhoto })) }
      }))
      toast.success(t("cover_updated"))
      setCoverPhotoModalOpen(false)
      setSelectedCardProject(null)
      router.refresh()
    } catch {
      toast.error("Failed to update cover photo. Please try again.")
    } finally {
      setIsSavingCoverPhoto(false)
    }
  }, [selectedCardProject, selectedCoverPhoto, router])

  const handleProjectCardClick = useCallback((project: CompanyProject) => {
    if (project.isOwner) {
      router.push(`/dashboard/edit/${project.id}`)
    } else if (project.slug) {
      window.open(`/projects/${project.slug}`, "_blank", "noopener,noreferrer")
    }
  }, [router])

  // ── Transitions ──
  const [, startTransition] = useTransition()

  // ── Google Maps ──

  // ── Address lookup state (styled dropdown) ──
  const [addressQuery, setAddressQuery] = useState("")
  const [addressResults, setAddressResults] = useState<Array<{ placeId: string; description: string; mainText: string; secondaryText: string }>>([])
  const [isAddressSearching, setIsAddressSearching] = useState(false)
  const addressSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const addressServiceRef = useRef<any>(null)

  // ── City lookup state (specs bar location) ──
  const [cityQuery, setCityQuery] = useState("")
  const [cityResults, setCityResults] = useState<Array<{ placeId: string; mainText: string; secondaryText: string }>>([])
  const [isCitySearching, setIsCitySearching] = useState(false)
  const citySearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cityServiceRef = useRef<any>(null)

  // ── Click-outside to dismiss active edit sections ──
  useEffect(() => {
    if (!activeEditField && !editingSpecBar) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (activeEditField && !target.closest(".contact-row-item.on, .ec.on, .ccm-dropdown")) {
        setActiveEditField(null)
        setAddressQuery("")
        setAddressResults([])
      }
      if (editingSpecBar && !target.closest(".spec-item-edit.editing, .dd-panel")) {
        setEditingSpecBar(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [activeEditField, editingSpecBar])

  // ── Derived ──

  // servicesOffered is ordered — first item is the primary service
  const orderedServiceNames = servicesOffered
    .map((id) => services.find((s) => s.id === id)?.name)
    .filter(Boolean) as string[]
  const servicesBadge = orderedServiceNames.length > 0
    ? orderedServiceNames.length <= 3
      ? orderedServiceNames.join(" · ")
      : `${orderedServiceNames.slice(0, 3).join(" · ")} · +${orderedServiceNames.length - 3} more`
    : t("add_services")
  const statusLabelMap: Record<string, string> = { listed: t("status_listed"), unlisted: t("status_unlisted"), deactivated: t("status_deactivated") }
  const statusLabel = statusLabelMap[companyStatus] ?? t("status_unlisted")
  const statusIndicator = STATUS_INDICATOR[companyStatus]

  // A company needs at least one visible published project to be listed
  const hasPublishedProjects = companyProjects.some((p) => {
    const ppStatus = p.projectProfessionalStatus
    const isPublished = p.rawProjectStatus === "published" || p.rawProjectStatus === "completed"
    return isPublished && (ppStatus === "listed" || ppStatus === "live_on_page")
  })

  // Has projects that are invited/listed/featured on published projects (eligible to go live)
  const hasListableProjects = companyProjects.some((p) => {
    const ppStatus = p.projectProfessionalStatus
    const isPublished = p.rawProjectStatus === "published" || p.rawProjectStatus === "completed"
    return isPublished && (ppStatus === "invited" || ppStatus === "listed" || ppStatus === "live_on_page")
  })

  // ── Helpers ──

  const flashSaved = useCallback(() => {
    setEditSaveStatus("saved")
    if (editSaveTimerRef.current) clearTimeout(editSaveTimerRef.current)
    editSaveTimerRef.current = setTimeout(() => setEditSaveStatus("idle"), 2000)
  }, [])

  const getInitials = (n: string) => {
    const words = n.split(" ")
    if (words.length >= 2) return words[0][0] + words[1][0]
    return words[0].substring(0, 2)
  }

  // ── Google Maps init ──

  // ── Address lookup (styled dropdown, same pattern as create-company modal) ──

  const searchAddress = useCallback((query: string) => {
    setAddressQuery(query)
    if (addressSearchTimer.current) clearTimeout(addressSearchTimer.current)
    if (query.trim().length < 2) { setAddressResults([]); return }

    addressSearchTimer.current = setTimeout(async () => {
      setIsAddressSearching(true)
      try {
        const g = (window as any).google
        if (!g?.maps) { setIsAddressSearching(false); return }

        if (!addressServiceRef.current) {
          const placesLib = await g.maps.importLibrary("places")
          if (!placesLib?.AutocompleteService) { setIsAddressSearching(false); return }
          addressServiceRef.current = new placesLib.AutocompleteService()
        }

        const predictions = await new Promise<any>((resolve) => {
          addressServiceRef.current.getPlacePredictions(
            { input: query.trim(), types: ["address"] },
            (preds: any, status: string) => { resolve(status === "OK" && preds ? preds : []) },
          )
        })

        setAddressResults(predictions.slice(0, 5).map((p: any) => ({
          placeId: p.place_id,
          description: p.description ?? "",
          mainText: p.structured_formatting?.main_text ?? "",
          secondaryText: p.structured_formatting?.secondary_text ?? "",
        })))
      } catch { setAddressResults([]) }
      setIsAddressSearching(false)
    }, 300)
  }, [])

  // ── Save handlers ──

  const saveProfile = useCallback(async (overrides?: { name?: string; description?: string }) => {
    const n = overrides?.name ?? name
    const d = overrides?.description ?? description
    setEditSaveStatus("saving")
    startTransition(async () => {
      const result = await updateCompanyProfileAction({ name: n, description: d || null })
      if (!result.success) {
        toast.error(result.error ?? t("save_error"))
        setEditSaveStatus("idle")
        return
      }
      flashSaved()
    })
  }, [name, description, flashSaved])

  const saveSpecs = useCallback(async (overrides?: Record<string, unknown>) => {
    setEditSaveStatus("saving")
    startTransition(async () => {
      const result = await updateCompanySpecsAction({
        foundedYear: (overrides?.foundedYear !== undefined ? overrides.foundedYear : foundedYear) as number | null,
        teamSizeMin: (overrides?.teamSizeMin !== undefined ? overrides.teamSizeMin : teamSizeMin) as number | null,
        teamSizeMax: (overrides?.teamSizeMax !== undefined ? overrides.teamSizeMax : teamSizeMax) as number | null,
        city: (overrides?.city !== undefined ? overrides.city : city) as string | null,
        country: (overrides?.country !== undefined ? overrides.country : country) as string | null,
        address: (overrides?.address !== undefined ? overrides.address : address) as string | null,
      })
      if (!result.success) {
        toast.error(result.error ?? t("specs_error"))
        setEditSaveStatus("idle")
        return
      }
      flashSaved()
    })
  }, [foundedYear, teamSizeMin, teamSizeMax, city, country, address, flashSaved])

  const saveContact = useCallback(async (overrides?: Record<string, string>) => {
    setEditSaveStatus("saving")
    startTransition(async () => {
      const result = await updateCompanyContactAction({
        domain: overrides?.domain ?? domain,
        email: overrides?.email ?? email,
        phone: overrides?.phone ?? phone,
        address: overrides?.address ?? address,
        city: overrides?.city ?? city,
        country: overrides?.country ?? country,
        ...socialForm,
      })
      if (!result.success) {
        toast.error(result.error ?? t("contact_error"))
        setEditSaveStatus("idle")
        return
      }
      flashSaved()
    })
  }, [domain, email, phone, address, city, country, socialForm, flashSaved])

  const handleSelectAddress = useCallback(async (placeId: string) => {
    try {
      const g = (window as any).google
      if (!g?.maps) return

      const placesLib = await g.maps.importLibrary("places")
      const div = document.createElement("div")
      const service = new placesLib.PlacesService(div)

      const place = await new Promise<any>((resolve, reject) => {
        service.getDetails(
          { placeId, fields: ["formatted_address", "address_components"] },
          (p: any, status: string) => { status === "OK" && p ? resolve(p) : reject(new Error("Failed")) },
        )
      })

      let newCity = ""
      let newCountry = ""
      let street = ""
      let streetNumber = ""
      for (const comp of place.address_components ?? []) {
        if (comp.types.includes("locality")) newCity = comp.long_name
        if (comp.types.includes("country")) newCountry = comp.long_name
        if (comp.types.includes("route")) street = comp.long_name
        if (comp.types.includes("street_number")) streetNumber = comp.long_name
      }

      const newAddress = [street, streetNumber].filter(Boolean).join(" ")
      setAddress(newAddress)
      if (newCity) setCity(newCity)
      if (newCountry) setCountry(newCountry)
      setActiveEditField(null)
      setAddressQuery("")
      setAddressResults([])
      saveContact({ address: newAddress, city: newCity || city, country: newCountry || country })
    } catch {
      toast.error(t("address_error"))
    }
  }, [city, country, saveContact])

  // City search for specs bar location (NL only)
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
    setCity(mainText)
    setCityQuery("")
    setCityResults([])
    setEditingSpecBar(null)
    saveSpecs({ city: mainText })
  }, [saveSpecs])

  const saveServices = useCallback(async (overrides?: { servicesOffered?: string[]; languages?: string[]; certificates?: string[] }) => {
    const sOffered = overrides?.servicesOffered ?? servicesOffered
    setEditSaveStatus("saving")
    startTransition(async () => {
      const result = await updateCompanyServicesAction({
        primaryServiceId: sOffered[0] || "",
        servicesOffered: sOffered,
        languages: overrides?.languages ?? languages,
        certificates: overrides?.certificates ?? certificates,
      })
      if (!result.success) {
        toast.error(result.error ?? t("services_error"))
        setEditSaveStatus("idle")
        return
      }
      flashSaved()
    })
  }, [servicesOffered, languages, certificates, flashSaved])

  const handleSocialSave = useCallback(async (platform: Platform, url: string) => {
    const newSocial = { ...socialForm, [platform]: url }
    setSocialForm(newSocial)
    setEditSaveStatus("saving")
    startTransition(async () => {
      const result = await updateCompanyContactAction({
        domain, email, phone, address, city, country,
        ...newSocial,
      })
      if (!result.success) {
        toast.error(result.error ?? t("social_error"))
        setEditSaveStatus("idle")
        return
      }
      flashSaved()
    })
  }, [domain, email, phone, address, city, country, socialForm, flashSaved])

  // ── Logo upload ──

  const handleLogoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append("file", file)
    setEditSaveStatus("saving")
    startTransition(async () => {
      const result = await uploadCompanyLogoAction(formData)
      if (!result.success) {
        toast.error(result.error ?? t("logo_error"))
        setEditSaveStatus("idle")
        return
      }
      if (result.url) setLogoUrl(result.url)
      flashSaved()
    })
    if (logoInputRef.current) logoInputRef.current.value = ""
  }, [flashSaved])

  // ── Status handler ──

  const handleStatusSave = useCallback(async () => {
    setStatusDialogOpen(false)
    setCompanyStatus(selectedStatus)
    startTransition(async () => {
      const result = await changeCompanyStatusAction({ status: selectedStatus })
      if (!result.success) {
        toast.error(result.error ?? t("status_error"))
        setCompanyStatus(company.status)
        return
      }
      toast.success(`Company ${selectedStatus === "listed" ? "listed" : "unlisted"}`)
    })
  }, [selectedStatus, company.status])

  // ── Hero photo handlers ──

  const handleSetHero = useCallback(async (project: CompanyProject, photoUrl: string) => {
    setHeroUrl(photoUrl)
    setHeroProjectId(project.id)
    setPickerProject(null)
    startTransition(async () => {
      const result = await setCompanyHeroPhotoAction({ projectId: project.id, photoUrl })
      if (!result.success) {
        toast.error(result.error ?? t("cover_set_error"))
        setHeroUrl(initialHeroUrl)
        setHeroProjectId(initialHeroProjectId)
      }
    })
  }, [initialHeroUrl, initialHeroProjectId])

  const handleClearHero = useCallback(async () => {
    setHeroUrl(null)
    setHeroProjectId(null)
    startTransition(async () => {
      const result = await clearCompanyHeroPhotoAction()
      if (!result.success) {
        toast.error(result.error ?? t("cover_clear_error"))
        setHeroUrl(initialHeroUrl)
        setHeroProjectId(initialHeroProjectId)
      }
    })
  }, [initialHeroUrl, initialHeroProjectId])

  const handleProjectCoverClick = useCallback((project: CompanyProject) => {
    if (project.photos.length === 1) {
      handleSetHero(project, project.photos[0].url)
    } else if (project.photos.length > 1) {
      setPickerProject(project)
    }
  }, [handleSetHero])

  // ── Cover picker handlers (search preview flow) ──

  const openCoverPicker = useCallback(() => {
    setSearchPreviewOpen(false)
    setCoverPickerStep("project")
    setCoverPickerProject(null)
    setCoverPickerOpen(true)
  }, [])

  const selectCoverProject = useCallback((project: CompanyProject) => {
    setCoverPickerProject(project)
    setCoverPickerStep("photo")
  }, [])

  const selectCoverPhoto = useCallback((project: CompanyProject, photoUrl: string) => {
    setCoverPickerOpen(false)
    setCoverPickerProject(null)
    handleSetHero(project, photoUrl)
  }, [handleSetHero])

  const clearCoverFromPreview = useCallback(() => {
    handleClearHero()
  }, [handleClearHero])

  // ── Blur handlers for inline fields ──

  const handleNameBlur = useCallback((e: React.FocusEvent<HTMLHeadingElement>) => {
    const newName = (e.currentTarget.textContent ?? "").trim()
    setActiveEditField(null)
    if (newName && newName !== name) {
      setName(newName)
      saveProfile({ name: newName })
    }
  }, [name, saveProfile])

  const handleDescBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    const newDesc = (e.currentTarget.textContent ?? "").trim()
    setActiveEditField(null)
    if (newDesc !== description) {
      setDescription(newDesc)
      saveProfile({ description: newDesc })
      void saveCompanyTranslatedField(company.id, "description", newDesc, locale)
    }
  }, [description, saveProfile, company.id, locale])

  const handleGenerateDescription = useCallback(async () => {
    setGeneratingDesc(true)
    try {
      const result = await generateCompanyDescriptionAction(company.id)
      if (result.success && result.description) {
        setDescription(result.description)
        if (descRef.current) descRef.current.textContent = result.description
        setDescCharCount(result.description.length)
        toast.success(t("description_generated"))
      } else {
        toast.error(result.error ?? t("description_failed"))
      }
    } catch {
      toast.error(t("description_failed"))
    } finally {
      setGeneratingDesc(false)
    }
  }, [company.id])

  // ── Render ──

  return (
    <div className="min-h-screen bg-white">
      <style>{`
        .ec { position: relative; cursor: pointer; }
        .ec::before { content: ''; position: absolute; inset: -10px -14px; border: 1px solid transparent; border-radius: 5px; transition: border-color .18s; pointer-events: none; z-index: 0; }
        .ec:hover::before { border-color: #1c1c1a; }
        .ec.on::before  { border-color: #016D75; }
        .ec.on          { cursor: default; }
        .ec-badge { position: absolute; top: -19px; left: -8px; display: flex; align-items: center; gap: 4px; background: #fff; padding: 0 4px; pointer-events: none; z-index: 1; }
        .ec-ico { display: flex; align-items: center; color: #c8c8c6; transition: color .18s; }
        .ec-txt { font-size: 10px; font-weight: 400; letter-spacing: .04em; text-transform: uppercase; color: #c8c8c6; white-space: nowrap; transition: color .15s; }
        .ec:hover .ec-ico, .ec:hover .ec-txt { color: #1c1c1a; }
        .ec.on    .ec-ico, .ec.on    .ec-txt { color: #016D75; }
        /* .ec-generate-link moved to globals.css */
        [contenteditable]:focus { outline: none; }
        [contenteditable]:empty:before { content: attr(data-placeholder); color: #b0b0ae; pointer-events: none; }

        /* Spec bar editable */
        .spec-item-edit { padding: 0; text-align: center; position: relative; cursor: pointer; transition: background .15s; z-index: 2; }
        .spec-item-edit::before { content: ''; position: absolute; inset: -32px -6px; border: 1px solid transparent; border-radius: 5px; pointer-events: none; transition: border-color .18s; background: white; z-index: -1; }
        .spec-item-edit:hover::before { border-color: #1c1c1a; }
        .spec-item-edit.editing::before { border-color: #016D75; }
        .spec-item-edit.editing { z-index: 10; }
        .spec-item-edit .ec-badge { top: -40px; left: 50%; transform: translateX(-50%); padding: 0 6px; background: #fff; z-index: 2; }
        @media (max-width: 768px) {
          .edit-specs-bar { grid-template-columns: repeat(2, 1fr) !important; gap: 84px 16px !important; padding: 36px 0 !important; }
          .spec-item-edit::before { inset: -36px -8px; }
          .spec-item-edit .ec-badge { top: -44px; }
        }
        .spec-item-edit:hover .ec-ico, .spec-item-edit:hover .ec-txt { color: #1c1c1a; }
        .spec-item-edit.editing .ec-ico, .spec-item-edit.editing .ec-txt { color: #016D75; }
        .spec-item-edit.editing .spec-eyebrow { color: #016D75; }
        .spec-inp { width: 100%; text-align: center; font-size: 15px; font-weight: 500; color: #1c1c1a; background: transparent; border: none; border-bottom: 1px solid rgba(1,109,117,.3); outline: none; padding: 0 0 2px; font-family: inherit; }
        .spec-inp-inline { width: 100%; text-align: center; font-size: 15px; font-weight: 400; color: #1c1c1a; background: transparent; border: none; border-bottom: 1px solid transparent; outline: none; padding: 0 0 2px; font-family: inherit; cursor: pointer; line-height: 1.3; -moz-appearance: textfield; }
        .spec-inp-inline::-webkit-outer-spin-button, .spec-inp-inline::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .spec-inp-inline::placeholder { color: #b0b0ae; }
        .spec-inp-inline:read-only { pointer-events: none; }
        .spec-item-edit.editing .spec-inp-inline { border-bottom-color: rgba(1,109,117,.3); cursor: text; pointer-events: auto; }
        .spec-inp-wrap { display: flex; align-items: baseline; justify-content: center; }
        .spec-inp-wrap .spec-inp-inline { width: auto; min-width: 20px; max-width: 60px; text-align: center; }
        .spec-inp-suffix { font-size: 15px; font-weight: 400; color: #1c1c1a; line-height: 1.3; }
        .dd-panel { position: absolute; left: 50%; transform: translateX(-50%); background: #fff; border: 1px solid #e8e8e6; border-radius: 7px; box-shadow: 0 12px 40px rgba(0,0,0,.12); overflow: hidden; min-width: 180px; z-index: 20; top: calc(100% + 4px); }
        .dd-row { display: flex; align-items: center; justify-content: space-between; padding: 9px 14px; cursor: pointer; transition: background .1s; font-size: 13px; font-weight: 300; color: #1c1c1a; }
        .dd-row:hover { background: #f5f5f3; }
        .dd-row.sel   { font-weight: 500; }
        .dd-check     { color: #016D75; font-size: 11px; }

        /* Social icons */
        .social-icons-container { display: flex; flex-direction: column; align-items: flex-start; margin: 16px 0 0; }
        .social-icons-row { display: flex; gap: 8px; }
        .social-icon-btn { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: none; background: none; cursor: pointer; transition: all .15s; color: #1c1c1a; }
        .social-icon-btn:hover { opacity: 0.7; }
        .social-icon-btn.inactive { color: #d4d4d2; }
        .social-icon-btn.inactive:hover { color: #1c1c1a; }
        .social-icon-btn.editing { color: #016D75; }
        .social-edit-input-wrap { margin-top: 10px; width: 300px; }
        .social-edit-input { width: 100%; font-size: 13px; padding: 6px 10px; border: 1px solid #e8e8e6; border-radius: 5px; outline: none; font-family: inherit; transition: border-color .15s; }
        .social-edit-input:focus { border-color: #016D75; }

        /* Contact row layout */
        .contact-row { display: flex; gap: 40px; flex-wrap: wrap; }
        .contact-row-item { flex: 1; min-width: 160px; position: relative; cursor: pointer; padding: 14px; }
        .contact-row-item::before { content: ''; position: absolute; inset: 0; border: 1px solid transparent; border-radius: 5px; transition: border-color .18s; pointer-events: none; }
        .contact-row-item:hover::before { border-color: #1c1c1a; }
        .contact-row-item.on::before { border-color: #016D75; }
        .contact-row-item.on { cursor: default; }
        .contact-row-item .ec-badge { position: absolute; top: -8px; left: 6px; display: flex; align-items: center; gap: 4px; background: #fff; padding: 0 4px; pointer-events: none; z-index: 1; }
        .contact-row-item .ec-ico { display: flex; align-items: center; color: #c8c8c6; transition: color .18s; }
        .contact-row-item .ec-txt { font-size: 10px; font-weight: 400; letter-spacing: .04em; text-transform: uppercase; color: #c8c8c6; white-space: nowrap; transition: color .15s; }
        .contact-row-item:hover .ec-ico, .contact-row-item:hover .ec-txt { color: #1c1c1a; }
        .contact-row-item.on .ec-ico, .contact-row-item.on .ec-txt { color: #016D75; }
        .contact-row-value { font-size: 15px; font-weight: 400; color: #1c1c1a; margin: 8px 0 0; line-height: 1.4; }
        .contact-row-sub { font-size: 13px; color: #a1a1a0; margin: 4px 0 0; }
        .contact-row-placeholder { color: #b0b0ae; font-weight: 400; }
        .contact-edit-input { width: 100%; font-size: 15px; font-weight: 400; color: #1c1c1a; background: transparent; border: none; border-bottom: 1px solid rgba(1,109,117,.3); outline: none; padding: 0 0 2px; font-family: inherit; margin-top: 8px; }
        @media (max-width: 768px) { .contact-row { flex-direction: column; gap: 24px; } }

        /* Service popup */
        .service-popup-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 500; display: flex; align-items: center; justify-content: center; }
        .service-popup { background: #fff; border-radius: 12px; max-width: 560px; width: 90%; max-height: 80vh; display: flex; flex-direction: column; padding: 0; }
        .service-popup-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 28px; background: var(--arco-off-white); border-radius: 12px 12px 0 0; flex-shrink: 0; }
        .service-popup-body { flex: 1; overflow-y: auto; padding: 12px 28px 28px; }
        .service-popup-footer { display: flex; gap: 10px; justify-content: flex-end; padding: 16px 28px; border-top: 1px solid var(--arco-rule); background: var(--arco-off-white); border-radius: 0 0 12px 12px; flex-shrink: 0; }
        .sp-title { font-family: var(--font-serif); font-size: 18px; font-weight: 500; margin: 0; }
        .sp-categories { display: flex; flex-direction: column; gap: 20px; }
        .sp-category-group { display: flex; flex-direction: column; gap: 8px; }
        .sp-category-label { font-size: 12px; font-weight: 500; letter-spacing: .04em; text-transform: uppercase; color: #5c5c5a; }
        .service-popup-badge { cursor: pointer; transition: opacity .15s; }
        .service-popup-badge:hover { opacity: 0.7; }
        .sp-search { width: 100%; font-size: 14px; padding: 10px 14px; border: 1px solid var(--arco-rule); border-radius: 3px; outline: none; font-family: inherit; transition: border-color .15s; margin-bottom: 20px; background: white; color: var(--text-primary); }
        .sp-search:focus { border-color: var(--arco-black); }
        .sp-search::placeholder { color: #b0b0ae; }
        .sp-selected-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 24px; min-height: 44px; padding: 12px; background: #fafaf9; border-radius: 8px; border: 1px solid #e8e8e6; }
        .sp-selected-empty { font-size: 13px; color: #b0b0ae; text-align: center; padding: 8px 0; }
        .sp-selected-item { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: #fff; border: 1px solid #e8e8e6; border-radius: 6px; font-size: 13px; color: #1c1c1a; cursor: grab; transition: border-color .15s, box-shadow .15s; user-select: none; }
        .sp-selected-item:hover { border-color: #c8c8c6; }
        .sp-selected-item.dragging { opacity: 0.5; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
        .sp-selected-item.drag-over { border-color: #016D75; }
        .sp-grip { color: #c8c8c6; flex-shrink: 0; display: flex; }
        .sp-primary-badge { font-size: 10px; font-weight: 500; letter-spacing: .03em; text-transform: uppercase; color: #016D75; background: rgba(1,109,117,.08); padding: 2px 6px; border-radius: 3px; flex-shrink: 0; }
        .sp-item-name { flex: 1; }
        .sp-remove { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; border: none; background: none; cursor: pointer; color: #c8c8c6; border-radius: 4px; flex-shrink: 0; transition: color .15s, background .15s; }
        .sp-remove:hover { color: #e53e3e; background: rgba(229,62,62,.06); }
        .sp-available { display: flex; flex-wrap: wrap; gap: 8px; }
        .sp-pill { font-size: 13px; padding: 6px 14px; border-radius: 20px; border: 1px solid #e8e8e6; background: #fff; color: #5c5c5a; cursor: pointer; transition: all .15s; user-select: none; }
        .sp-pill:hover { border-color: #1c1c1a; color: #1c1c1a; }
        .sp-pill.selected { border-color: #016D75; background: rgba(1,109,117,.06); color: #016D75; }
        .sp-pill.disabled { opacity: 0.4; cursor: not-allowed; }

        /* Hero photo badge */
        .hero-badge { position: absolute; top: 8px; left: 8px; font-size: 10px; font-weight: 500; letter-spacing: .03em; text-transform: uppercase; color: #fff; background: #016D75; padding: 3px 10px; border-radius: 3px; z-index: 3; }

        /* Photo picker modal — base classes now in globals.css (popup-overlay, popup-card, etc.) */

        /* Address lookup dropdown */
        .ccm-dropdown { border: 1px solid #e8e8e6; border-radius: 3px; box-shadow: 0 8px 28px rgba(0,0,0,.14); max-height: 280px; overflow-y: auto; padding: 4px 0; background: #fff; }
        .ccm-row { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 9px 14px; font-size: 13px; font-weight: 300; color: #1c1c1a; cursor: pointer; gap: 8px; transition: background .1s; background: none; border: none; text-align: left; }
        .ccm-row:hover { background: #f5f5f3; }

        @keyframes spin { to { transform: rotate(360deg); } }

      `}</style>

      <Header navLinks={[
        { href: `/dashboard/listings?company_id=${company.id}`, label: "Listings" },
        { href: `/dashboard/company?company_id=${company.id}`, label: "Company" },
        { href: `/dashboard/team?company_id=${company.id}`, label: "Team" },
        { href: "/dashboard/inbox", label: "Messages" },
        { href: "/dashboard/pricing", label: "Plans" },
      ]} />

      <CompanyEditSubNav
        statusIndicatorClass={statusIndicator}
        currentStatusLabel={statusLabel}
        editSaveStatus={editSaveStatus}
        companySlug={company.slug}
        companyId={company.id}
        onStatusClick={() => setStatusDialogOpen(true)}
        onSearchPreviewClick={() => setSearchPreviewOpen(true)}
        isSetupMode={isSetupMode}
        onCompleteSetup={handleCompleteSetup}
      />

      {/* ════════════════════ SETUP POPUP (OVERLAY) ════════════════════ */}
      {isSetupMode && !setupBannerDismissed && !allRequiredComplete && (
        <div className="setup-popup-overlay">
          <div className="popup-card">
            <div className="popup-header">
              <h3 className="arco-section-title">
                {highlightMissing ? t("complete_page") : t("create_page")}
              </h3>
              <button
                className="popup-close"
                onClick={() => setSetupBannerDismissed(true)}
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
            <p className="arco-body-text" style={{ marginBottom: 20 }}>
              {highlightMissing
                ? "Complete the highlighted fields below to publish your company page."
                : "Showcase your best work and let clients discover you. Complete these details to build a stunning company page."}
            </p>
            <div className="setup-popup-checklist">
              {([
                ["name", t("company_name")],
                ["services", t("services")],
                ["description", t("description")],
                ["location", t("location")],
                ["domain", t("domain")],
              ] as const).map(([key, label]) => (
                <div key={key} className="setup-popup-checklist-item">
                  <span
                    className="setup-popup-checklist-icon"
                    data-done={setupComplete[key] ? "true" : undefined}
                    data-missing={highlightMissing && !setupComplete[key] ? "true" : undefined}
                  >
                    {setupComplete[key] ? "✓" : "○"}
                  </span>
                  <span
                    className="setup-popup-checklist-label"
                    data-done={setupComplete[key] ? "true" : undefined}
                    data-missing={highlightMissing && !setupComplete[key] ? "true" : undefined}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
            <button
              className="setup-popup-cta"
              onClick={() => {
                setSetupBannerDismissed(true)
                if (highlightMissing) {
                  const fieldMap: Record<string, string> = { name: "header", services: "header", description: "header", location: "office-location", domain: "contact" }
                  for (const [key, sectionId] of Object.entries(fieldMap)) {
                    if (!setupComplete[key as keyof typeof setupComplete]) {
                      const el = document.getElementById(sectionId)
                      if (el) window.scrollTo({ top: el.offsetTop - 130, behavior: "smooth" })
                      break
                    }
                  }
                }
              }}
            >
              {highlightMissing ? t("complete_fields") : t("get_started")}
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════ HEADER SECTION ════════════════════ */}
      <div className="wrap" style={{ marginTop: 120, marginBottom: 60 }} id="header">
        <section className="professional-header">
          {/* Logo */}
          <div
            className="company-icon"
            onClick={() => logoInputRef.current?.click()}
            style={{ display: "inline-block", cursor: "pointer" }}
          >
            {logoUrl ? (
              <Image src={logoUrl} alt={name} width={100} height={100} className="company-icon-image" unoptimized />
            ) : (
              <div className="company-icon-initials">{getInitials(name)}</div>
            )}
            <input ref={logoInputRef} type="file" hidden accept="image/jpeg,image/png,image/svg+xml" onChange={handleLogoUpload} />
          </div>

          <div id="header-anchor" />

          {/* Company Name */}
          <div className={`ec${activeEditField === "name" ? " on" : ""}`} data-setup-highlight={highlightMissing && !setupComplete.name ? "true" : undefined}>
            <EditBadge />
            <h1
              className="arco-page-title"
              contentEditable
              suppressContentEditableWarning
              onFocus={() => setActiveEditField("name")}
              onBlur={handleNameBlur}
              data-placeholder="Company name"
            >
              {name}
            </h1>
          </div>

          {/* Services badge — click to open service selection popup */}
          <p
            className="professional-badge service-popup-badge"
            onClick={() => { servicesSnapshotRef.current = [...servicesOffered]; setServicePopupOpen(true) }}
            data-setup-highlight={highlightMissing && !setupComplete.services ? "true" : undefined}
            style={orderedServiceNames.length === 0 ? { color: "var(--primary)" } : undefined}
          >
            {servicesBadge}
          </p>

          {/* Description */}
          <div className={`ec${activeEditField === "desc" ? " on" : ""}`} data-setup-highlight={highlightMissing && !setupComplete.description ? "true" : undefined}>
            <EditBadge />
            <p
              ref={descRef}
              className="arco-body-text"
              contentEditable
              suppressContentEditableWarning
              onFocus={() => setActiveEditField("desc")}
              onBlur={handleDescBlur}
              onInput={() => {
                setDescCharCount((descRef.current?.textContent?.trim() ?? "").length)
              }}
              data-placeholder={t("add_description")}
              style={{ minHeight: 40, margin: 0 }}
            >
              {description ? description.replace(/<[^>]*>/g, "").trim() : ""}
            </p>
            <div className="flex items-center justify-center" style={{ position: "relative" }}>
              <button
                type="button"
                className="ec-generate-link"
                onClick={(e) => { e.stopPropagation(); handleGenerateDescription() }}
                disabled={generatingDesc}
              >
                {generatingDesc ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                      <path d="M21 12a9 9 0 11-6.219-8.56" />
                    </svg>
                    {t("generating")}
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.937 15.5A2 2 0 008.5 14.063l-6.135-1.582a.5.5 0 010-.962L8.5 9.936A2 2 0 009.937 8.5l1.582-6.135a.5.5 0 01.963 0L14.063 8.5A2 2 0 0015.5 9.937l6.135 1.582a.5.5 0 010 .963L15.5 14.063a2 2 0 00-1.437 1.437l-1.582 6.135a.5.5 0 01-.963 0z" />
                    </svg>
                    {description ? t("regenerate") : t("generate_ai")}
                  </>
                )}
              </button>
              {activeEditField === "desc" && (
                <span className={`text-[11px] absolute right-0 ${descCharCount > 750 ? "text-red-500" : "text-[#a1a1a0]"}`}>
                  {descCharCount} / 750
                </span>
              )}
            </div>
          </div>
        </section>

        {/* ════════════════════ SPECS BAR ════════════════════ */}
        <div className="edit-specs-bar" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 32, padding: "32px 0", borderTop: "1px solid #e8e8e6", borderBottom: "1px solid #e8e8e6" }}>
          {/* Location — read-only, clicks scroll to Office Location */}
          <div
            className="spec-item-edit"
            style={{ position: "relative", cursor: "pointer" }}
            onClick={() => {
              const el = document.getElementById("office-location")
              if (el) {
                window.scrollTo({ top: el.offsetTop - 130, behavior: "smooth" })
                setActiveEditField("address")
              }
            }}
            data-setup-highlight={highlightMissing && !setupComplete.location ? "true" : undefined}
          >
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>{t("location")}</span>
            <span className="spec-inp-inline" style={{ display: "block" }}>
              {city ? `${city}, NL` : <span style={{ color: "var(--arco-light)" }}>{t("location")}</span>}
            </span>
          </div>

          {/* Established */}
          <div
            className={`spec-item-edit${editingSpecBar === "established" ? " editing" : ""}`}
            onClick={() => { if (editingSpecBar !== "established") setEditingSpecBar("established") }}
          >
            <EditBadge />
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>{t("established")}</span>
            <input
              type="number"
              className="spec-inp-inline"
              value={foundedYear ?? ""}
              readOnly={editingSpecBar !== "established"}
              autoFocus={editingSpecBar === "established"}
              placeholder={t("add_year")}
              min={1800}
              max={new Date().getFullYear()}
              onChange={(e) => {
                const val = e.target.value.trim()
                setFoundedYear(val ? parseInt(val, 10) : null)
              }}
              onBlur={(e) => {
                const val = e.target.value.trim()
                const year = val ? parseInt(val, 10) : null
                setFoundedYear(year)
                setEditingSpecBar(null)
                saveSpecs({ foundedYear: year })
              }}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
              onClick={(e) => { if (editingSpecBar === "established") e.stopPropagation() }}
            />
          </div>

          {/* Team Size */}
          <div
            className={`spec-item-edit${editingSpecBar === "teamSize" ? " editing" : ""}`}
            onClick={() => { if (editingSpecBar !== "teamSize") setEditingSpecBar("teamSize") }}
          >
            <EditBadge />
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>{t("team_size")}</span>
            {editingSpecBar === "teamSize" ? (
              <input
                type="number"
                className="spec-inp-inline"
                value={teamSizeMin ?? ""}
                autoFocus
                placeholder={t("add_size")}
                min={1}
                onChange={(e) => {
                  const val = e.target.value.trim()
                  setTeamSizeMin(val ? parseInt(val, 10) : null)
                }}
                onBlur={(e) => {
                  const val = e.target.value.trim()
                  const size = val ? parseInt(val, 10) : null
                  setTeamSizeMin(size)
                  setTeamSizeMax(size)
                  setEditingSpecBar(null)
                  saveSpecs({ teamSizeMin: size, teamSizeMax: size })
                }}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="spec-inp-inline" style={{ display: "block" }}>
                {teamSizeMin ? `${teamSizeMin}` : <span style={{ color: "#b0b0ae" }}>{t("add_size")}</span>}
              </span>
            )}
          </div>

          {/* Languages */}
          <div
            className={`spec-item-edit${editingSpecBar === "languages" ? " editing" : ""}`}
            style={{ position: "relative" }}
            onClick={() => { if (editingSpecBar !== "languages") setEditingSpecBar("languages") }}
          >
            <EditBadge />
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>{t("languages")}</span>
            <div className="arco-card-title" style={{ color: languages.length > 0 ? undefined : "#b0b0ae" }}>
              {languages.length > 0 ? languages.join(", ") : t("add_languages")}
            </div>
            {editingSpecBar === "languages" && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={e => { e.stopPropagation(); setEditingSpecBar(null); saveServices({ languages }) }} />
                <div className="dd-panel" style={{ maxHeight: 260, overflowY: "auto" }}>
                  {languageOptions.map(lang => (
                    <div
                      key={lang}
                      className={`dd-row${languages.includes(lang) ? " sel" : ""}`}
                      onClick={e => {
                        e.stopPropagation()
                        const updated = languages.includes(lang)
                          ? languages.filter(l => l !== lang)
                          : [...languages, lang]
                        setLanguages(updated)
                      }}
                    >
                      <span>{lang}</span>
                      {languages.includes(lang) && <span className="dd-check">✓</span>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Certificates */}
          <div
            className={`spec-item-edit${editingSpecBar === "certificates" ? " editing" : ""}`}
            style={{ position: "relative" }}
            onClick={() => { if (editingSpecBar !== "certificates") setEditingSpecBar("certificates") }}
          >
            <EditBadge />
            <span className="arco-eyebrow spec-eyebrow" style={{ display: "block", marginBottom: 8 }}>{t("certificates")}</span>
            <div className="arco-card-title" style={{ color: certificates.length > 0 ? undefined : "#b0b0ae" }}>
              {certificates.length > 0 ? certificates.join(", ") : t("add_certificates")}
            </div>
            {editingSpecBar === "certificates" && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 10 }} onClick={e => { e.stopPropagation(); setEditingSpecBar(null); saveServices({ certificates }) }} />
                <div className="dd-panel" style={{ maxHeight: 260, overflowY: "auto" }}>
                  {certificateOptions.map(cert => (
                    <div
                      key={cert}
                      className={`dd-row${certificates.includes(cert) ? " sel" : ""}`}
                      onClick={e => {
                        e.stopPropagation()
                        const updated = certificates.includes(cert)
                          ? certificates.filter(c => c !== cert)
                          : [...certificates, cert]
                        setCertificates(updated)
                      }}
                    >
                      <span>{cert}</span>
                      {certificates.includes(cert) && <span className="dd-check">✓</span>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ════════════════════ PROJECTS SECTION ════════════════════ */}
      <section id="projects" style={{ marginBottom: 60 }}>
        <div className="wrap">
          <div className="section-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 className="arco-section-title">{t("featured_projects")}</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {companyProjects.length > 3 && (
                <Link href="/dashboard/listings" className="text-[13px] font-light text-[#a1a1a0] hover:text-[#1c1c1a] transition-colors">
                  View all listings →
                </Link>
              )}
              {companyProjects.length > 0 && (
                <button
                  type="button"
                  className="btn-primary"
                  style={{ fontSize: 13, padding: "8px 18px" }}
                  onClick={() => setImportModalOpen(true)}
                >
                  {t("publish_your_project")}
                </button>
              )}
            </div>
          </div>
          {companyProjects.length > 0 ? (
            <div className="discover-grid">
              {[...companyProjects].sort((a, b) => {
                const order: Record<string, number> = { draft: 0, in_progress: 1, invited: 2, rejected: 3, live_on_page: 4, listed: 5, unlisted: 6, archived: 7 }
                return (order[a.status] ?? 99) - (order[b.status] ?? 99)
              }).slice(0, 3).map((project) => {
                const cardKey = project.id
                return (
                  <div
                    key={project.id}
                    className="discover-card"
                    style={{ position: "relative", cursor: "pointer" }}
                    onClick={(e) => {
                      if (!(e.target as Element).closest(".dropdown-menu")) {
                        handleProjectCardClick(project)
                      }
                    }}
                  >
                    {/* Image */}
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
                        {project.coverImage ? (
                          <img src={project.coverImage} alt={project.title} />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#c8c8c6", background: "var(--arco-surface)" }}>
                            <ImageIcon size={32} />
                          </div>
                        )}
                      </div>

                      {/* Hover action pill / Accept button for invited */}
                      {project.projectProfessionalStatus === "invited" ? (
                        <div
                          style={{
                            position: "absolute", inset: 0, zIndex: 1,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(0,0,0,.15)"
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
                            handleProjectUpdateStatus(project)
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
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 8l4 4 8-8" /></svg>
                            Accept
                          </span>
                        </div>
                      ) : (
                        <div
                          className="listing-card-hover-overlay"
                          style={{
                            position: "absolute", inset: 0, zIndex: 1,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: "transparent", transition: "background .2s",
                            pointerEvents: "none",
                          }}
                        >
                          <span
                            className="listing-card-hover-pill"
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 7,
                              fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 400,
                              color: "#fff", background: "rgba(0,0,0,.6)",
                              border: "1px solid rgba(255,255,255,.25)", borderRadius: 100,
                              padding: "8px 18px",
                              backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                              opacity: 0, transition: "opacity .2s",
                            }}
                          >
                            {project.isOwner ? t("edit_project") : t("view_project")}
                          </span>
                        </div>
                      )}

                      {/* Owner pill — bottom-left of image */}
                      {project.isOwner && (
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

                    {/* Status pill */}
                    <div style={{ position: "absolute", top: 12, left: 12, zIndex: 2 }}>
                      <button
                        className="filter-pill flex items-center gap-1.5"
                        onClick={(e) => { e.stopPropagation(); handleProjectUpdateStatus(project) }}
                      >
                        <span className={`inline-block w-[7px] h-[7px] rounded-full shrink-0 ${project.statusDotClass}`} />
                        <span className="text-xs font-medium">{project.statusLabel}</span>
                      </button>
                    </div>

                    {/* Options menu */}
                    <div
                      className="dropdown-menu"
                      style={{ position: "absolute", top: 12, right: 12, zIndex: 2 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="filter-pill"
                        onClick={() => setProjectDropdown(projectDropdown === cardKey ? null : cardKey)}
                        data-open={projectDropdown === cardKey ? "true" : undefined}
                        aria-label="Project options"
                        style={{ padding: "6px 8px", gap: 0 }}
                      >
                        <MoreHorizontal style={{ width: 16, height: 16 }} />
                      </button>
                      <div
                        className="filter-dropdown"
                        data-open={projectDropdown === cardKey ? "true" : undefined}
                        data-align="right"
                        style={{ minWidth: 180, top: "calc(100% + 6px)" }}
                      >
                        {project.isOwner && (
                          <div className="filter-dropdown-option" onClick={() => { setProjectDropdown(null); router.push(`/dashboard/edit/${project.id}`) }} role="menuitem">
                            <span className="filter-dropdown-label">Edit listing</span>
                          </div>
                        )}
                        <div className="filter-dropdown-option" onClick={() => handleProjectUpdateStatus(project)} role="menuitem">
                          <span className="filter-dropdown-label">Update status</span>
                        </div>
                        <div className="filter-dropdown-option" onClick={() => handleProjectChangeCover(project)} role="menuitem">
                          <span className="filter-dropdown-label">Change cover</span>
                        </div>
                        {project.slug && (
                          <div className="filter-dropdown-option" onClick={() => { setProjectDropdown(null); window.open(`/projects/${project.slug}`, "_blank", "noopener,noreferrer") }} role="menuitem">
                            <span className="filter-dropdown-label">View project</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card text */}
                    <h3 className="discover-card-title">{project.title}</h3>
                    {project.subtitle && <p className="discover-card-sub">{project.subtitle}</p>}
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ border: "1px dashed var(--border)", borderRadius: 8, padding: "80px 24px", textAlign: "center" }}>
              {canPublishProjects ? (
                <>
                  <p className="arco-eyebrow" style={{ marginBottom: 16 }}>{t("get_started")}</p>
                  <h2 className="arco-section-title" style={{ marginBottom: 12 }}>{t("publish_first_project")}</h2>
                  <p className="arco-body-text" style={{ marginBottom: 32, maxWidth: 360, margin: "0 auto 32px" }}>
                    {t("publish_first_project_description")}
                  </p>
                  <button onClick={() => setImportModalOpen(true)} className="btn-primary">
                    {t("publish_your_project")}
                  </button>
                </>
              ) : (
                <>
                  <p className="arco-eyebrow" style={{ marginBottom: 16 }}>{t("no_projects_yet")}</p>
                  <h2 className="arco-section-title" style={{ marginBottom: 12 }}>{t("get_invited_title")}</h2>
                  <p className="arco-body-text" style={{ maxWidth: 400, margin: "0 auto" }}>
                    {t("get_invited_description")}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ════════════════════ CONTACT SECTION ════════════════════ */}
      <section id="contact" className="contact-section" style={{ marginBottom: 60 }}>
        <div className="wrap">
          <div className="section-header">
            <h2 className="arco-section-title">Contact information</h2>
          </div>
          <div className="contact-row">
            {/* Office Location */}
            <div
              id="office-location"
              className={`contact-row-item${activeEditField === "address" ? " on" : ""}`}
              onClick={() => { if (activeEditField !== "address") setActiveEditField("address") }}
            >
              <EditBadge />
              <span className="arco-eyebrow">Office Location</span>
              {activeEditField === "address" ? (
                <div style={{ position: "relative" }}>
                  <input
                    autoFocus
                    className="contact-edit-input"
                    value={addressQuery}
                    onChange={(e) => searchAddress(e.target.value)}
                    placeholder="Search address..."
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setActiveEditField(null)
                        setAddressQuery("")
                        setAddressResults([])
                      }
                    }}
                  />
                  {addressQuery.trim().length >= 2 && (
                    <div className="ccm-dropdown" style={{ position: "absolute", left: 0, right: 0, top: "100%", marginTop: 4, zIndex: 20 }}>
                      {addressResults.map((r) => (
                        <button
                          key={r.placeId}
                          type="button"
                          className="ccm-row"
                          onMouseDown={(e) => { e.preventDefault(); handleSelectAddress(r.placeId) }}
                        >
                          <span className="truncate">
                            <span style={{ fontWeight: 400 }}>{r.mainText}</span>
                            {r.secondaryText && <span style={{ color: "#a1a1a0", marginLeft: 4 }}>{r.secondaryText}</span>}
                          </span>
                        </button>
                      ))}
                      {isAddressSearching && (
                        <div className="ccm-row" style={{ color: "#a1a1a0", cursor: "default" }}>Searching...</div>
                      )}
                      {!isAddressSearching && addressResults.length === 0 && (
                        <div className="ccm-row" style={{ color: "#a1a1a0", cursor: "default" }}>No results found</div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="contact-row-value">
                  {address || city ? [address?.split(",")[0]?.trim(), city].filter(Boolean).join(", ") : <span className="contact-row-placeholder">Add address</span>}
                </p>
              )}
            </div>

            {/* Website */}
            <div
              className={`contact-row-item${activeEditField === "website" ? " on" : ""}`}
              onClick={() => { if (activeEditField !== "website") setActiveEditField("website") }}
              data-setup-highlight={highlightMissing && !setupComplete.domain ? "true" : undefined}
            >
              <EditBadge />
              <span className="arco-eyebrow">Website</span>
              {activeEditField === "website" ? (
                <input
                  autoFocus
                  className="contact-edit-input"
                  defaultValue={domain}
                  placeholder="example.com"
                  onBlur={(e) => {
                    const val = e.target.value.trim().replace(/^https?:\/\//i, "")
                    if (val && val !== domain) {
                      setPendingDomain(val)
                      setVerifyEmail("")
                      setVerifyCode("")
                      setVerifyCodeSent(false)
                      setVerifyError(null)
                      setDomainVerifyOpen(true)
                    }
                    setActiveEditField(null)
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                />
              ) : (
                <p className="contact-row-value" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {domain ? (
                    <>
                      <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer" className="text-link-plain" onClick={(e) => e.stopPropagation()}>
                        {domain}
                      </a>
                      {company.is_verified && (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ color: "#10b981", flexShrink: 0 }}>
                          <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                      )}
                    </>
                  ) : (
                    <span className="contact-row-placeholder">Add website</span>
                  )}
                </p>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* ════════════════════ PUBLISH POPUP ════════════════════ */}
      {publishPopupOpen && (
        <div className="setup-popup-overlay" onClick={() => setPublishPopupOpen(false)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <h3 className="arco-section-title">
                {hasListableProjects ? t("list_company") : t("complete_company")}
              </h3>
              <button
                className="popup-close"
                onClick={() => setPublishPopupOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {!hasListableProjects && (
              <>
                <p className="arco-body-text" style={{ marginBottom: 20 }}>
                  Your company page is ready. To go live on Arco, you need to be credited on a published project. Ask an architect to invite you, or publish your own.
                </p>
              </>
            )}

            {hasListableProjects && (
              <>
                <p className="arco-body-text" style={{ marginBottom: 20 }}>
                  Your company and credited projects will be published on Arco. Invited projects will go live and your company page will be visible to homeowners.
                </p>

                {pendingProjects.length > 0 && (
                  <div className="publish-popup-options">
                    <label className="publish-popup-option">
                      <input
                        type="checkbox"
                        checked={goLiveListProjects}
                        onChange={(e) => setGoLiveListProjects(e.target.checked)}
                      />
                      <div>
                        <p className="publish-popup-option-title">
                          Publish credited projects ({pendingProjects.length})
                        </p>
                        <p className="publish-popup-option-desc">Your company will be shown on the project page</p>
                      </div>
                    </label>
                  </div>
                )}
              </>
            )}

            <button
              className="setup-popup-cta"
              disabled={isCompletingSetup}
              onClick={async () => {
                setIsCompletingSetup(true)
                const result = await completeCompanySetupAction({
                  listCompany: hasListableProjects,
                  listProjectIds: hasListableProjects && goLiveListProjects ? pendingProjects.map((p) => p.id) : [],
                })
                if (result.success) {
                  setPublishPopupOpen(false)
                  toast.success(hasListableProjects ? "Your company is now live!" : "Company page setup complete!")
                  router.push("/dashboard/company")
                } else {
                  toast.error(result.error ?? t("something_wrong"))
                  setIsCompletingSetup(false)
                }
              }}
              style={{ opacity: isCompletingSetup ? 0.5 : 1 }}
            >
              {isCompletingSetup
                ? (hasListableProjects ? t("listing_updated") + "…" : t("generating") )
                : (hasListableProjects ? t("list_company_btn") : t("complete_company_btn"))}
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════ IMPORT FIRST PROJECT POPUP ════════════════════ */}
      {importFirstProjectOpen && (
        <div className="setup-popup-overlay" onClick={() => setImportFirstProjectOpen(false)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Import your first project</h3>
              <button className="popup-close" onClick={() => setImportFirstProjectOpen(false)} aria-label="Close">✕</button>
            </div>
            <p className="arco-body-text" style={{ marginBottom: 20 }}>
              Add a project from your website to showcase your work on Arco.
            </p>
            <div className="popup-actions">
              <button
                className="btn-tertiary"
                onClick={() => {
                  setImportFirstProjectOpen(false)
                  router.push("/dashboard/listings")
                }}
                style={{ flex: 1 }}
              >
                Skip for now
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  setImportFirstProjectOpen(false)
                  router.push("/dashboard/listings")
                }}
                style={{ flex: 1 }}
              >
                Import project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════ DELETE COMPANY ════════════════════ */}
      {isOwner && (
        <section style={{ marginBottom: 60 }}>
          <div className="wrap">
            <hr style={{ border: "none", borderTop: "1px solid var(--arco-rule)", margin: "0 0 24px" }} />
            <button
              onClick={async () => {
                setDeleteDialogOpen(true)
                setDeleteConfirmText("")
                setIsCheckingDeletion(true)
                setDeletionCheck(null)
                const result = await checkCompanyDeletionAction()
                if (result.success) {
                  setDeletionCheck(result.data)
                }
                setIsCheckingDeletion(false)
              }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 13, fontWeight: 300, padding: 0,
                color: "#dc2626", background: "none",
                border: "none", cursor: "pointer",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14M10 11v6M14 11v6" />
              </svg>
              Delete company
            </button>
          </div>
        </section>
      )}

      {/* ════════════════════ SERVICE SELECTION POPUP ════════════════════ */}
      {servicePopupOpen && (
        <div className="service-popup-overlay" onClick={() => { setServicesOffered(servicesSnapshotRef.current); setServicePopupOpen(false); setServiceSearch("") }}>
          <div className="service-popup" onClick={(e) => e.stopPropagation()}>
            {/* Header — grey background */}
            <div className="service-popup-header">
              <h3 className="arco-section-title" style={{ margin: 0 }}>{t("services_title")}</h3>
              <button type="button" className="popup-close" onClick={() => { setServicesOffered(servicesSnapshotRef.current); setServicePopupOpen(false); setServiceSearch("") }} aria-label="Close">✕</button>
            </div>

            {/* Scrollable body */}
            <div className="service-popup-body">
            {/* Selected services — ordered, draggable, first = primary */}
            <label className="arco-eyebrow" style={{ display: "block", marginBottom: 8 }}>{t("services_your")}</label>
            <p style={{ fontSize: 12, color: "#9a9a98", margin: "0 0 10px" }}>{t("services_drag_hint")}</p>
            <div className="sp-selected-list">
              {servicesOffered.length === 0 && (
                <div className="sp-selected-empty">{t("services_empty")}</div>
              )}
              {servicesOffered.map((id, idx) => {
                const svc = services.find((s) => s.id === id)
                if (!svc) return null
                return (
                  <div
                    key={id}
                    className={`sp-selected-item${dragOverIdx === idx ? " drag-over" : ""}`}
                    draggable
                    onDragStart={() => { dragItemRef.current = idx }}
                    onDragOver={(e) => { e.preventDefault(); dragOverRef.current = idx; setDragOverIdx(idx) }}
                    onDragLeave={() => { if (dragOverRef.current === idx) setDragOverIdx(null) }}
                    onDrop={(e) => {
                      e.preventDefault()
                      setDragOverIdx(null)
                      const from = dragItemRef.current
                      if (from === null || from === idx) return
                      setServicesOffered((prev) => {
                        const next = [...prev]
                        const [moved] = next.splice(from, 1)
                        next.splice(idx, 0, moved)
                        return next
                      })
                      dragItemRef.current = null
                      dragOverRef.current = null
                    }}
                    onDragEnd={() => { setDragOverIdx(null); dragItemRef.current = null }}
                  >
                    <span className="sp-grip">
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="4" r="1.2"/><circle cx="11" cy="4" r="1.2"/><circle cx="5" cy="8" r="1.2"/><circle cx="11" cy="8" r="1.2"/><circle cx="5" cy="12" r="1.2"/><circle cx="11" cy="12" r="1.2"/></svg>
                    </span>
                    {idx === 0 && <span className="sp-primary-badge">{t("services_primary")}</span>}
                    <span className="sp-item-name">{svc.name}</span>
                    <button
                      className="sp-remove"
                      onClick={() => setServicesOffered((prev) => prev.filter((s) => s !== id))}
                      type="button"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Available services grouped by category */}
            <label className="arco-eyebrow" style={{ display: "block", marginBottom: 8 }}>{t("services_add")}</label>
            <input
              className="sp-search"
              placeholder={t("services_search")}
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
            />
            <div className="sp-categories">
              {serviceCategories.map((group) => {
                const filtered = serviceSearch
                  ? group.services.filter((s) => s.name.toLowerCase().includes(serviceSearch.toLowerCase()))
                  : group.services
                if (filtered.length === 0) return null
                const atMax = servicesOffered.length >= 12
                return (
                  <div key={group.slug} className="sp-category-group">
                    <span className="sp-category-label">{group.name}</span>
                    <div className="sp-available">
                      {filtered.map((s) => {
                        const isSelected = servicesOffered.includes(s.id)
                        return (
                          <button
                            key={s.id}
                            type="button"
                            className={`sp-pill${isSelected ? " selected" : ""}${!isSelected && atMax ? " disabled" : ""}`}
                            onClick={() => {
                              if (isSelected) {
                                setServicesOffered((prev) => prev.filter((id) => id !== s.id))
                              } else if (!atMax) {
                                setServicesOffered((prev) => [...prev, s.id])
                              }
                            }}
                          >
                            {isSelected ? "✓ " : ""}{s.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            </div>{/* end service-popup-body */}

            {/* Sticky footer */}
            <div className="service-popup-footer">
              <button
                type="button"
                className="btn-tertiary"
                onClick={() => { setServicesOffered(servicesSnapshotRef.current); setServicePopupOpen(false); setServiceSearch("") }}
                style={{ fontSize: 14, padding: "10px 20px" }}
              >
                {t("services_cancel")}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  if (servicesOffered.length === 0) {
                    toast.error(t("select_service"))
                    return
                  }
                  saveServices()
                  setServicePopupOpen(false)
                  setServiceSearch("")
                }}
                style={{ fontSize: 14, padding: "10px 20px" }}
              >
                {t("services_save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════ SEARCH PREVIEW MODAL ════════════════════ */}
      {searchPreviewOpen && (
        <div className="popup-overlay" onClick={() => setSearchPreviewOpen(false)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">{t("search_preview")}</h3>
              <button className="popup-close" onClick={() => setSearchPreviewOpen(false)}>
                ✕
              </button>
            </div>

            {/* Discover card preview */}
            <div style={{ borderRadius: 3, overflow: "hidden", marginBottom: 24 }}>
              <div style={{ width: "100%", aspectRatio: "4/3", position: "relative", background: "var(--arco-surface)" }}>
                {heroUrl ? (
                  <Image src={heroUrl} alt={name} fill style={{ objectFit: "cover" }} unoptimized />
                ) : projects[0]?.coverImage ? (
                  <Image src={projects[0].coverImage} alt={name} fill style={{ objectFit: "cover" }} unoptimized />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#c8c8c6" }}>
                    <ImageIcon size={40} />
                  </div>
                )}
              </div>
              <div style={{ padding: "12px 0 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {logoUrl ? (
                    <img src={logoUrl} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f5f5f3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 500, color: "#5c5c5a" }}>
                      {getInitials(name)}
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 400, lineHeight: 1.3, color: "#1c1c1a" }}>{name}</div>
                    <div style={{ fontSize: 13, fontWeight: 300, color: "#a1a1a0" }}>
                      {orderedServiceNames[0] ?? t("professional_services")}
                      {city && <> · {city}</>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="popup-actions">
              <button className="btn-tertiary" onClick={openCoverPicker} style={{ flex: 1 }}>
                Change cover photo
              </button>
              {heroUrl && (
                <button
                  className="btn-tertiary"
                  onClick={() => { clearCoverFromPreview(); }}
                  style={{ color: "#a1a1a0" }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════ COVER PICKER MODAL ════════════════════ */}
      {coverPickerOpen && (
        <div className="popup-overlay" onClick={() => setCoverPickerOpen(false)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <div className="popup-header" style={{ flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {coverPickerStep === "photo" && (
                  <button
                    className="popup-close"
                    onClick={() => { setCoverPickerStep("project"); setCoverPickerProject(null) }}
                    style={{ fontSize: 16, display: "flex" }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 12L6 8L10 4" />
                    </svg>
                  </button>
                )}
                <h3 className="arco-section-title">
                  {coverPickerStep === "project" ? "Select a project" : coverPickerProject?.title}
                </h3>
              </div>
              <button className="popup-close" onClick={() => setCoverPickerOpen(false)}>
                ✕
              </button>
            </div>

            {coverPickerStep === "project" && (
              <>
                <p style={{ fontSize: 13, fontWeight: 300, color: "#9a9a98", margin: "0 0 16px" }}>
                  Choose a project, then select a photo for your search listing.
                </p>
                <div style={{ overflow: "auto", flex: 1 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {projects.filter((p) => p.photos.length > 0).map((project) => (
                      <button
                        key={project.id}
                        onClick={() => selectCoverProject(project)}
                        style={{
                          display: "flex", alignItems: "center", gap: 12, padding: 10,
                          background: "none", border: "1px solid #e8e8e6", borderRadius: 5,
                          cursor: "pointer", textAlign: "left", transition: "border-color .15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#1c1c1a")}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e8e8e6")}
                      >
                        <div style={{ width: 56, height: 42, borderRadius: 3, overflow: "hidden", flexShrink: 0, position: "relative", background: "var(--arco-surface)" }}>
                          {project.coverImage ? (
                            <Image src={project.coverImage} alt={project.title} fill style={{ objectFit: "cover" }} unoptimized />
                          ) : (
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#c8c8c6" }}>
                              <ImageIcon size={16} />
                            </div>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 400, color: "#1c1c1a", lineHeight: 1.3 }}>{project.title}</div>
                          <div style={{ fontSize: 12, fontWeight: 300, color: "#a1a1a0" }}>
                            {project.photos.length} photo{project.photos.length !== 1 ? "s" : ""}
                            {heroProjectId === project.id && " · Current cover"}
                          </div>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#a1a1a0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 4L10 8L6 12" />
                        </svg>
                      </button>
                    ))}
                    {projects.filter((p) => p.photos.length > 0).length === 0 && (
                      <p style={{ fontSize: 13, color: "#a1a1a0", textAlign: "center", padding: 20 }}>
                        No projects with photos available.
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}

            {coverPickerStep === "photo" && coverPickerProject && (
              <>
                <p style={{ fontSize: 13, fontWeight: 300, color: "#9a9a98", margin: "0 0 16px" }}>
                  Select a photo for your search listing cover.
                </p>
                <div style={{ overflow: "auto", flex: 1 }}>
                  <div className="photo-picker-grid">
                    {coverPickerProject.photos.map((photo) => (
                      <div
                        key={photo.id}
                        className={`photo-picker-item${heroUrl === photo.url ? " active" : ""}`}
                        onClick={() => selectCoverPhoto(coverPickerProject, photo.url)}
                      >
                        <Image src={photo.url} alt="" fill style={{ objectFit: "cover" }} unoptimized />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════ STATUS DIALOG ════════════════════ */}
      {statusDialogOpen && (
        <div className="popup-overlay" onClick={() => setStatusDialogOpen(false)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Company visibility</h3>
              <button className="popup-close" onClick={() => setStatusDialogOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>

            {!hasPublishedProjects && (
              <div className="popup-banner popup-banner--info">
                <AlertTriangle className="popup-banner-icon" />
                <div>
                  <p style={{ fontWeight: 500 }}>No live projects</p>
                  <p>
                    {canPublishProjects
                      ? "Submit and publish at least one project to make your company visible on Arco."
                      : "Get credited on a published project to make your company visible on Arco."}
                  </p>
                </div>
              </div>
            )}

            <div className="status-modal-options">
              <button
                type="button"
                className={`status-modal-option${selectedStatus === "listed" ? " selected" : ""}`}
                disabled={!hasPublishedProjects}
                onClick={() => hasPublishedProjects && setSelectedStatus("listed")}
              >
                <span className="status-modal-dot bg-emerald-500" />
                <div className="status-modal-option-text">
                  <span className="status-modal-option-label">Listed</span>
                  <span className="status-modal-option-desc">Your company page is public and visible to homeowners.</span>
                </div>
              </button>

              <button
                type="button"
                className={`status-modal-option${selectedStatus === "unlisted" ? " selected" : ""}`}
                disabled={!hasPublishedProjects}
                onClick={() => hasPublishedProjects && setSelectedStatus("unlisted")}
              >
                <span className="status-modal-dot bg-muted-foreground" />
                <div className="status-modal-option-text">
                  <span className="status-modal-option-label">Unlisted</span>
                  <span className="status-modal-option-desc">Hide your company page from search while keeping data ready.</span>
                </div>
              </button>
            </div>

            <div className="popup-actions">
              <button className="btn-tertiary" onClick={() => setStatusDialogOpen(false)} style={{ flex: 1 }}>
                Cancel
              </button>
              <button className="btn-secondary" onClick={handleStatusSave} disabled={!hasPublishedProjects} style={{ flex: 1 }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════ DELETE DIALOG ════════════════════ */}
      {deleteDialogOpen && (
        <div className="popup-overlay" onClick={() => { setDeleteDialogOpen(false); setDeleteConfirmText("") }}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Delete company</h3>
              <button className="popup-close" onClick={() => { setDeleteDialogOpen(false); setDeleteConfirmText("") }} aria-label="Close">
                ✕
              </button>
            </div>
            <p style={{ fontSize: 13, fontWeight: 300, color: "var(--arco-light)", margin: "0 0 16px" }}>
              Permanently delete your company and all associated data. This action cannot be undone.
            </p>

            {isCheckingDeletion ? (
              <p className="body-small text-text-secondary">Checking…</p>
            ) : deletionCheck ? (
              <>
                <div className="popup-banner popup-banner--danger">
                  <AlertTriangle className="popup-banner-icon" />
                  <span>Your company will be permanently deleted. This cannot be undone.</span>
                </div>

                {deletionCheck.warnings.length > 0 && (
                  <div className="popup-banner popup-banner--warn">
                    <AlertTriangle className="popup-banner-icon" />
                    <ul className="m-0 p-0 list-none space-y-0.5">
                      {deletionCheck.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}

                {deletionCheck.blockers.length > 0 && (
                  <div className="popup-banner popup-banner--danger">
                    <AlertTriangle className="popup-banner-icon" />
                    <ul className="m-0 p-0 list-none space-y-0.5">
                      {deletionCheck.blockers.map((b, i) => <li key={i}>{b}</li>)}
                    </ul>
                  </div>
                )}

                {deletionCheck.canDelete && (
                  <>
                    <p className="body-small text-text-secondary mb-3">
                      {t("delete_confirm_text")} <strong>{deletionCheck.companyName}</strong>.
                    </p>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder={t("delete_confirm_placeholder")}
                      className="w-full px-3 py-2 text-sm border border-border rounded-[3px] mb-4 focus:outline-none focus:border-foreground"
                    />
                  </>
                )}

                <div className="popup-actions">
                  <button
                    className="btn-tertiary"
                    onClick={() => { setDeleteDialogOpen(false); setDeleteConfirmText("") }}
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!deletionCheck.canDelete || deleteConfirmText !== "DELETE" || isDeletingCompany}
                    onClick={async () => {
                      setIsDeletingCompany(true)
                      const result = await deleteCompanyAction({ confirmText: deleteConfirmText })
                      if (result.success) {
                        setDeleteDialogOpen(false)
                        router.push("/dashboard")
                      } else {
                        setIsDeletingCompany(false)
                        toast.error(result.error ?? t("delete_failed"))
                      }
                    }}
                    className={`flex-1 font-normal py-3 px-4 border-none rounded-[3px] cursor-pointer transition-opacity ${
                      deletionCheck.canDelete && deleteConfirmText === t("delete_confirm_placeholder")
                        ? "bg-red-600 text-white"
                        : "bg-surface text-text-secondary"
                    } ${isDeletingCompany ? "opacity-60" : ""}`}
                    style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: 15 }}
                  >
                    {isDeletingCompany ? t("deleting") : t("delete_company")}
                  </button>
                </div>
              </>
            ) : (
              <p className="body-small text-red-600">Failed to check deletion status.</p>
            )}
          </div>
        </div>
      )}

      <Footer />

      {/* ════════════════════ IMPORT PROJECT MODAL ════════════════════ */}
      <ImportProjectModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        userId={userId}
        companyId={company.id}
        professionalId={professionalId ?? null}
        adminCompanyId={adminCompanyId}
      />

      {/* ════════════════════ PROJECT STATUS MODAL ════════════════════ */}
      <ListingStatusModal
        open={contributorStatusModalOpen}
        onClose={() => { setContributorStatusModalOpen(false); setSelectedCardProject(null) }}
        onSave={handleSaveContributorStatus}
        project={selectedCardProject ? {
          title: selectedCardProject.title,
          descriptor: selectedCardProject.subtitle || t("project_label"),
          coverImageUrl: selectedCardProject.coverImage || "/placeholder.svg",
        } : null}
        companyPlan={companyPlan}
        selectedStatus={selectedContributorStatus}
        onStatusChange={setSelectedContributorStatus}
        statusOptions={selectedCardProject?.isOwner ? OWNER_STATUS_OPTIONS : CONTRIBUTOR_STATUS_OPTIONS}
        saveDisabled={!selectedContributorStatus || selectedContributorStatus === "invited"}
        isPendingAdminReview={selectedCardProject?.rawProjectStatus === "in_progress"}
        isRejected={selectedCardProject?.rawProjectStatus === "rejected"}
        rejectionReason={selectedCardProject?.rejectionReason}
        isDraft={selectedCardProject?.rawProjectStatus === "draft"}
        onSubmitForReview={selectedCardProject?.isOwner && selectedCardProject?.rawProjectStatus === "draft" ? () => {
          setContributorStatusModalOpen(false)
          router.push(`/dashboard/edit/${selectedCardProject.id}`)
        } : undefined}
        role={selectedCardProject?.isOwner ? "owner" : "contributor"}
      />

      {/* ════════════════════ COVER PHOTO MODAL ════════════════════ */}
      {coverPhotoModalOpen && selectedCardProject && (
        <div className="popup-overlay" onClick={() => { setCoverPhotoModalOpen(false); setSelectedCardProject(null) }}>
          <div className="popup-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Change cover</h3>
              <button type="button" className="popup-close" onClick={() => { setCoverPhotoModalOpen(false); setSelectedCardProject(null) }} aria-label="Close">✕</button>
            </div>
            <p className="arco-body-text" style={{ marginBottom: 20 }}>
              {selectedCardProject.isOwner
                ? "This photo will be displayed with the project on your company portfolio."
                : "Choose an image that best represents your service on this project."}
            </p>

            <div style={{ overflowY: "auto", maxHeight: "60vh" }}>
              {selectedCardProject.photos.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {selectedCardProject.photos.map((photo) => {
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
                        <img src={photo.url} alt={selectedCardProject.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
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

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button className="btn-tertiary" onClick={() => { setCoverPhotoModalOpen(false); setSelectedCardProject(null) }} style={{ flex: 1 }}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSaveCoverPhoto} disabled={isSavingCoverPhoto || !selectedCoverPhoto} style={{ flex: 1 }}>
                {isSavingCoverPhoto ? t("saving") : t("save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════ DOMAIN VERIFICATION POPUP ════════════════════ */}
      {domainVerifyOpen && (
        <div className="popup-overlay" onClick={() => setDomainVerifyOpen(false)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Verify domain</h3>
              <button className="popup-close" onClick={() => setDomainVerifyOpen(false)} aria-label="Close">✕</button>
            </div>
            <p style={{ fontSize: 13, fontWeight: 300, color: "var(--arco-light)", margin: "0 0 20px" }}>
              To update your domain to <strong>{pendingDomain}</strong>, verify ownership by entering a code sent to your company email.
            </p>

            {verifyError && (
              <div className="popup-banner popup-banner--danger">
                <AlertTriangle className="popup-banner-icon" />
                <span>{verifyError}</span>
              </div>
            )}

            {!verifyCodeSent ? (
              <>
                <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 400, color: "var(--arco-black)" }}>
                  Company email
                </label>
                <input
                  type="email"
                  autoFocus
                  value={verifyEmail}
                  onChange={(e) => setVerifyEmail(e.target.value)}
                  placeholder={`yourname@${pendingDomain}`}
                  className="w-full px-3 py-2 text-sm border border-border rounded-[3px] mb-4 focus:outline-none focus:border-foreground"
                  onKeyDown={(e) => { if (e.key === "Enter") document.getElementById("verify-send-btn")?.click() }}
                />
                <div className="popup-actions">
                  <button className="btn-tertiary" onClick={() => setDomainVerifyOpen(false)} style={{ flex: 1 }}>Cancel</button>
                  <button
                    id="verify-send-btn"
                    className="btn-primary"
                    disabled={isVerifying || !verifyEmail.includes("@")}
                    onClick={async () => {
                      setVerifyError(null)
                      setIsVerifying(true)
                      const result = await sendDomainVerificationAction({ domain: pendingDomain, email: verifyEmail, companyName: name })
                      if (result.success) {
                        setVerifyCodeSent(true)
                        toast.success(t("verify_code_sent"))
                      } else {
                        setVerifyError(result.error ?? "Failed to send code.")
                      }
                      setIsVerifying(false)
                    }}
                    style={{ flex: 1 }}
                  >
                    {isVerifying ? t("verify_sending") : t("verify_send_code")}
                  </button>
                </div>
              </>
            ) : (
              <>
                <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 400, color: "var(--arco-black)" }}>
                  Enter the 6-digit code sent to {verifyEmail}
                </label>
                <input
                  type="text"
                  autoFocus
                  inputMode="numeric"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-full px-3 py-2 text-sm border border-border rounded-[3px] mb-2 focus:outline-none focus:border-foreground tracking-widest text-center"
                  style={{ fontSize: 18, letterSpacing: "0.3em" }}
                  onKeyDown={(e) => { if (e.key === "Enter" && verifyCode.length === 6) document.getElementById("verify-code-btn")?.click() }}
                />
                <button
                  type="button"
                  onClick={async () => {
                    setVerifyError(null)
                    setIsVerifying(true)
                    const result = await sendDomainVerificationAction({ domain: pendingDomain, email: verifyEmail, companyName: name })
                    if (result.success) toast.success(t("verify_new_code"))
                    else setVerifyError(result.error ?? "Failed to resend.")
                    setIsVerifying(false)
                  }}
                  style={{ fontSize: 12, fontWeight: 300, color: "var(--arco-accent)", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 16 }}
                >
                  Resend code
                </button>
                <div className="popup-actions">
                  <button className="btn-tertiary" onClick={() => setDomainVerifyOpen(false)} style={{ flex: 1 }}>Cancel</button>
                  <button
                    id="verify-code-btn"
                    className="btn-primary"
                    disabled={isVerifying || verifyCode.length !== 6}
                    onClick={async () => {
                      setVerifyError(null)
                      setIsVerifying(true)
                      const result = await verifyDomainCodeAction({ domain: pendingDomain, code: verifyCode })
                      if (result.verified) {
                        setDomain(pendingDomain)
                        saveContact({ domain: pendingDomain })
                        setDomainVerifyOpen(false)
                        toast.success(t("verify_success"))
                      } else {
                        setVerifyError(result.error ?? "Invalid or expired code.")
                      }
                      setIsVerifying(false)
                    }}
                    style={{ flex: 1 }}
                  >
                    {isVerifying ? t("verify_verifying") : t("verify_btn")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
