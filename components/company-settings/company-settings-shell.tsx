"use client"

import { useEffect, useMemo, useRef, useState, useTransition, type ChangeEvent, type DragEvent } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"

import {
  changeCompanyStatusAction,
  deleteCompanyPhotoAction,
  reorderCompanyPhotosAction,
  updateCompanyContactAction,
  updateCompanyProfileAction,
  updateCompanyServicesAction,
  uploadCompanyLogoAction,
  uploadCompanyPhotoAction,
  setCompanyCoverPhotoAction,
} from "@/app/dashboard/company/actions"
import type { Database } from "@/lib/supabase/types"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Camera, ChevronLeft, ChevronRight, ImageIcon, Menu, MoreHorizontal, Trash2, User, X } from "lucide-react"
import { toast } from "sonner"

const languageOptions = ["Dutch", "English", "German", "French", "Spanish"] as const
const certificateOptions = ["BNA", "LEED", "Passive House", "WELL"] as const

const navItems = [
  { id: "profile", label: "Profile", icon: User },
  { id: "photos", label: "Photos", icon: Camera },
] as const

const statusOptions: ReadonlyArray<{ value: ListingStatus; title: string; description: string; colorClass: string }> = [
  {
    value: "listed",
    title: "Listed",
    description: "Your company page is public and visible to homeowners and on project profiles.",
    colorClass: "bg-emerald-500",
  },
  {
    value: "unlisted",
    title: "Unlisted",
    description: "Hide your company page from search while keeping data ready to reactivate at any time.",
    colorClass: "bg-muted-foreground",
  },
]

const statusDescriptionMap: Record<CompanyStatus, string> = {
  listed: "Your company page is live for homeowners.",
  unlisted: "Your page is hidden but remains ready to publish.",
  deactivated: "Reactivate to restore your company page and listings.",
}

const statusIndicatorMap: Record<CompanyStatus, string> = {
  listed: "bg-emerald-500",
  unlisted: "bg-muted-foreground",
  deactivated: "bg-muted-foreground",
}

const sectionCardClass = "rounded-xl border border-border bg-white p-6"

type CompanyStatus = Database["public"]["Tables"]["companies"]["Row"]["status"]
type ListingStatus = Extract<CompanyStatus, "listed" | "unlisted">

interface SocialFormState {
  facebook: string
  instagram: string
  linkedin: string
  pinterest: string
}

export interface CompanySettingsShellProps {
  company: Database["public"]["Tables"]["companies"]["Row"]
  socialLinks: Array<Pick<Database["public"]["Tables"]["company_social_links"]["Row"], "id" | "platform" | "url">>
  photos: Array<Pick<Database["public"]["Tables"]["company_photos"]["Row"], "id" | "url" | "alt_text" | "caption" | "is_cover" | "order_index">>
  services: Array<{ id: string; name: string; slug: string | null }>
  professionalId: string | null
}

const moveItem = <T,>(items: readonly T[], from: number, to: number): T[] => {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return [...items]
  }

  const result = [...items]
  const [item] = result.splice(from, 1)
  result.splice(to, 0, item)
  return result
}

export function CompanySettingsShell({ company, socialLinks, photos, services, professionalId }: CompanySettingsShellProps) {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState<"profile" | "photos">("profile")
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [draggedPhotoId, setDraggedPhotoId] = useState<string | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const [companyStatus, setCompanyStatus] = useState(company.status)
  const planTier = company.plan_tier
  const isUpgradeEligible = company.upgrade_eligible
  const [logoUrl, setLogoUrl] = useState<string | null>(company.logo_url ?? null)
  const logoInputRef = useRef<HTMLInputElement | null>(null)
  const photoInputRef = useRef<HTMLInputElement | null>(null)

  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<ListingStatus>(
    company.status === "deactivated" ? "unlisted" : (company.status as ListingStatus)
  )

  const [profileState, setProfileState] = useState({
    name: company.name,
    description: company.description ?? "",
    email: company.email ?? "",
    phone: company.phone ?? "",
    address: company.address ?? "",
    city: company.city ?? "",
    country: company.country ?? "Netherlands",
    domain:
      company.domain ?? (company.website ? company.website.replace(/^https?:\/\//i, "") : ""),
    primaryServiceId: company.primary_service_id ?? "",
    servicesOffered: company.services_offered ?? [],
    languages: company.languages ?? [],
    certificates: company.certificates ?? [],
  })

  const socialState = useMemo<SocialFormState>(() => {
    const initial: SocialFormState = {
      facebook: "",
      instagram: "",
      linkedin: "",
      pinterest: "",
    }

    socialLinks.forEach((link) => {
      if (link.platform in initial) {
        initial[link.platform as keyof SocialFormState] = link.url
      }
    })

    return initial
  }, [socialLinks])

  const [socialForm, setSocialForm] = useState<SocialFormState>(socialState)
  const [companyPhotos, setCompanyPhotos] = useState(() => [...photos].sort((a, b) => a.order_index - b.order_index))

  const [profilePending, startProfileTransition] = useTransition()
  const [contactPending, startContactTransition] = useTransition()
  const [servicesPending, startServicesTransition] = useTransition()
  const [statusPending, startStatusTransition] = useTransition()
  const [logoPending, startLogoTransition] = useTransition()
  const [photoPending, startPhotoTransition] = useTransition()

  useEffect(() => {
    setSelectedStatus(companyStatus === "deactivated" ? "unlisted" : (companyStatus as ListingStatus))
  }, [companyStatus])

  useEffect(() => {
    setCompanyPhotos([...photos].sort((a, b) => a.order_index - b.order_index))
  }, [photos])

  useEffect(() => {
    setLogoUrl(company.logo_url ?? null)
  }, [company.logo_url])

  const planTierLabel = planTier === "plus" ? "Plus" : "Basic"
  const planBadgeText = planTier === "plus" ? "Plus plan" : "Basic plan"
  const showUpgradeBanner = planTier === "basic" && isUpgradeEligible
  const isCompanyActive = companyStatus !== "deactivated"
  const currentListingStatus = companyStatus === "deactivated" ? "unlisted" : (companyStatus as ListingStatus)
  const isStatusDirty = selectedStatus !== currentListingStatus
  const statusLabel = companyStatus === "deactivated"
    ? "Deactivated"
    : statusOptions.find((option) => option.value === companyStatus)?.title ?? "Unlisted"
  const statusDescription = statusDescriptionMap[companyStatus] ?? ""
  const statusIndicator = statusIndicatorMap[companyStatus]
  const coverPhotoId = companyPhotos.find((photo) => photo.is_cover)?.id ?? null
  const domainDisplay = profileState.domain ? profileState.domain : null
  const photoSlotsRemaining = Math.max(0, 5 - companyPhotos.length)
  const canUploadMorePhotos = photoSlotsRemaining > 0

  const handlePhotoMenu = (photoId: string) => {
    setOpenMenuId((current) => (current === photoId ? null : photoId))
  }

  const setCoverPhoto = (photoId: string) => {
    const previous = companyPhotos.map((photo) => ({ ...photo }))

    setCompanyPhotos((prev) =>
      prev.map((photo) => ({
        ...photo,
        is_cover: photo.id === photoId,
      }))
    )
    setOpenMenuId(null)

    startPhotoTransition(async () => {
      const result = await setCompanyCoverPhotoAction({ photoId })
      if (!result.success) {
        toast.error(result.error ?? "Could not update cover photo")
        setCompanyPhotos(previous)
        return
      }

      toast.success("Cover photo updated")
    })
  }

  const deletePhoto = (photoId: string) => {
    setOpenMenuId(null)

    startPhotoTransition(async () => {
      const result = await deleteCompanyPhotoAction({ photoId })
      if (!result.success) {
        toast.error(result.error ?? "Could not delete photo")
        return
      }

      setCompanyPhotos((prev) => {
        const filtered = prev.filter((photo) => photo.id !== photoId)
        const normalized = filtered.map((photo, index) => ({
          ...photo,
          order_index: index,
          is_cover: result.nextCoverPhotoId ? photo.id === result.nextCoverPhotoId : photo.is_cover,
        }))

        if (!result.nextCoverPhotoId && normalized.length > 0 && !normalized.some((photo) => photo.is_cover)) {
          normalized[0] = { ...normalized[0], is_cover: true }
        }

        return normalized
      })

      toast.success("Photo removed")
    })
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (!canUploadMorePhotos || photoPending) return
    setDragOver(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragOver(false)
    if (!canUploadMorePhotos) {
      toast.error("You can upload up to 5 photos.")
      return
    }

    if (photoPending) {
      toast.error("Finish the current upload before adding more photos.")
      return
    }

    const files = event.dataTransfer.files
    if (!files || files.length === 0) return
    uploadPhotoFiles(files)
  }

  const handleLogoFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (logoInputRef.current) {
      logoInputRef.current.value = ""
    }

    startLogoTransition(() => {
      void (async () => {
        const formData = new FormData()
        formData.append("file", file)
        const result = await uploadCompanyLogoAction(formData)

        if (!result.success || !result.url) {
          toast.error(result.error ?? "Could not upload logo")
          return
        }

        setLogoUrl(result.url)
        toast.success("Logo updated")
      })()
    })
  }

  const handlePrimaryServiceChange = (value: string) => {
    setProfileState((prev) => ({
      ...prev,
      primaryServiceId: value,
      servicesOffered: prev.servicesOffered.filter((serviceId) => serviceId !== value),
    }))
  }

  const toggleServiceSelection = (serviceId: string, checked: boolean) => {
    setProfileState((prev) => {
      const withoutPrimary = prev.servicesOffered.filter((id) => id !== prev.primaryServiceId)
      const next = checked
        ? Array.from(new Set([...withoutPrimary, serviceId])).slice(0, 12)
        : withoutPrimary.filter((id) => id !== serviceId)

      return {
        ...prev,
        servicesOffered: next,
      }
    })
  }

  const toggleLanguageSelection = (language: string, checked: boolean) => {
    setProfileState((prev) => {
      const current = prev.languages ?? []
      const next = checked
        ? Array.from(new Set([...current, language])).slice(0, 10)
        : current.filter((value) => value !== language)

      return {
        ...prev,
        languages: next,
      }
    })
  }

  const toggleCertificateSelection = (certificate: string, checked: boolean) => {
    setProfileState((prev) => {
      const current = prev.certificates ?? []
      const next = checked
        ? Array.from(new Set([...current, certificate])).slice(0, 10)
        : current.filter((value) => value !== certificate)

      return {
        ...prev,
        certificates: next,
      }
    })
  }

  const uploadPhotoFiles = (files: FileList | File[]) => {
    if (photoPending) {
      toast.error("Finish the current upload before adding more photos.")
      return
    }

    const queue = Array.from(files).slice(0, photoSlotsRemaining)

    if (queue.length === 0) {
      toast.error("You already uploaded the maximum of 5 photos.")
      return
    }

    if (queue.length < files.length) {
      const skipped = files.length - queue.length
      toast.warning(
        `Only ${photoSlotsRemaining} photo slot${photoSlotsRemaining === 1 ? "" : "s"} available. ${
          skipped === 1 ? "One file" : `${skipped} files`
        } won’t be uploaded.`,
      )
    }

    startPhotoTransition(() => {
      void (async () => {
        for (const file of queue) {
          const formData = new FormData()
          formData.append("file", file)

          const result = await uploadCompanyPhotoAction(formData)

          if (!result.success || !result.photo) {
            if (result.error?.includes("5 photos")) {
              toast.error("You already uploaded the maximum of 5 photos.")
            } else {
              toast.error(result.error ?? "Could not upload photo")
            }
            break
          }

          setCompanyPhotos((prev) => {
            const updated = result.photo!.is_cover
              ? prev.map((photo) => ({ ...photo, is_cover: false }))
              : [...prev]

            updated.push(result.photo!)
            updated.sort((a, b) => a.order_index - b.order_index)
            return updated
          })

          toast.success("Photo uploaded")
        }
      })()
    })
  }

  const handlePhotoInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    if (!canUploadMorePhotos) {
      toast.error("You can upload up to 5 photos.")
      if (photoInputRef.current) {
        photoInputRef.current.value = ""
      }
      return
    }

    if (photoPending) {
      toast.error("Finish the current upload before adding more photos.")
      if (photoInputRef.current) {
        photoInputRef.current.value = ""
      }
      return
    }

    uploadPhotoFiles(files)

    // Clear input after reading files to allow re-selecting the same file
    if (photoInputRef.current) {
      photoInputRef.current.value = ""
    }
  }

  const handlePhotoDragStart = (event: DragEvent<HTMLDivElement>, photoId: string) => {
    if (photoPending) return
    event.dataTransfer.effectAllowed = "move"
    setDraggedPhotoId(photoId)
  }

  const handlePhotoDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }

  const handlePhotoDragEnd = () => {
    setDraggedPhotoId(null)
  }

  const handlePhotoDropOnCard = (targetPhotoId: string) => {
    if (!draggedPhotoId || draggedPhotoId === targetPhotoId || photoPending) {
      setDraggedPhotoId(null)
      return
    }

    const previous = companyPhotos.map((photo) => ({ ...photo }))
    const sourceIndex = previous.findIndex((photo) => photo.id === draggedPhotoId)
    const targetIndex = previous.findIndex((photo) => photo.id === targetPhotoId)

    if (sourceIndex === -1 || targetIndex === -1) {
      setDraggedPhotoId(null)
      return
    }

    const reordered = moveItem(previous, sourceIndex, targetIndex).map((photo, index) => ({
      ...photo,
      order_index: index,
    }))

    setCompanyPhotos(reordered)
    setDraggedPhotoId(null)

    startPhotoTransition(async () => {
      const result = await reorderCompanyPhotosAction({ photoIds: reordered.map((photo) => photo.id) })
      if (!result.success) {
        toast.error(result.error ?? "Could not reorder photos")
        setCompanyPhotos(previous)
        return
      }

      toast.success("Photo order updated")
    })
  }

  const handleSaveProfile = () => {
    startProfileTransition(async () => {
      const result = await updateCompanyProfileAction({
        name: profileState.name,
        description: profileState.description,
      })

      if (!result.success) {
        toast.error(result.error ?? "Could not update company information")
        return
      }

      toast.success("Company information updated")
    })
  }

  const handleSaveContact = () => {
    startContactTransition(async () => {
      const normalizedDomain = profileState.domain.trim().replace(/^https?:\/\//i, "").toLowerCase()
      const normalizeOptional = (value: string) => {
        const trimmed = value.trim()
        return trimmed.length > 0 ? trimmed : undefined
      }

      const result = await updateCompanyContactAction({
        domain: normalizedDomain,
        email: profileState.email,
        phone: profileState.phone,
        address: normalizeOptional(profileState.address ?? ""),
        city: normalizeOptional(profileState.city ?? ""),
        country: normalizeOptional(profileState.country ?? ""),
        ...socialForm,
      })

      if (!result.success) {
        toast.error(result.error ?? "Could not update contact details")
        return
      }

      toast.success("Contact details saved")
      setProfileState((prev) => ({
        ...prev,
        domain: normalizedDomain,
        email: prev.email.trim(),
        phone: prev.phone.trim(),
        address: normalizeOptional(prev.address ?? "") ?? "",
        city: normalizeOptional(prev.city ?? "") ?? "",
        country: normalizeOptional(prev.country ?? "") ?? "",
      }))
      setSocialForm((prev) => ({
        facebook: prev.facebook.trim(),
        instagram: prev.instagram.trim(),
        linkedin: prev.linkedin.trim(),
        pinterest: prev.pinterest.trim(),
      }))
    })
  }

  const handleSaveServices = () => {
    startServicesTransition(async () => {
      const uniqueServices = Array.from(
        new Set(profileState.servicesOffered.map((service) => service.trim()).filter(Boolean))
      ).slice(0, 12)
      const uniqueLanguages = Array.from(new Set(profileState.languages)).slice(0, 10)
      const uniqueCertificates = Array.from(new Set(profileState.certificates)).slice(0, 10)

      const result = await updateCompanyServicesAction({
        primaryServiceId: profileState.primaryServiceId,
        servicesOffered: uniqueServices,
        languages: uniqueLanguages,
        certificates: uniqueCertificates,
      })

      if (!result.success) {
        toast.error(result.error ?? "Could not update services")
        return
      }

      toast.success("Services updated")
      setProfileState((prev) => ({
        ...prev,
        servicesOffered: uniqueServices,
        languages: uniqueLanguages,
        certificates: uniqueCertificates,
      }))
    })
  }

  const performStatusUpdate = (nextStatus: CompanyStatus, options?: { onSuccess?: () => void; message?: string }) => {
    startStatusTransition(async () => {
      const result = await changeCompanyStatusAction({ status: nextStatus })

      if (!result.success) {
        toast.error(result.error ?? "Could not update company status")
        return
      }

      setCompanyStatus(nextStatus)
      options?.onSuccess?.()

      const fallbackMessage =
        nextStatus === "deactivated"
          ? "Company deactivated"
          : nextStatus === "listed"
            ? "Company listed"
            : "Company hidden from homeowners"

      toast.success(options?.message ?? fallbackMessage)
    })
  }

  const handlePreviewCompany = () => {
    const companySlug = company.slug || company.id
    const targetUrl = `/professionals/${companySlug}`
    window.open(targetUrl, "_blank", "noopener,noreferrer")
  }

  const getCurrentSectionTitle = () => {
    const item = navItems.find((item) => item.id === activeSection)
    return item?.label ?? "Company Settings"
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="hidden lg:block w-64 bg-white border-r border-border p-6 mr-8">
          <div className="space-y-6">
            <Dialog
              open={statusDialogOpen}
              onOpenChange={(open) => {
                setStatusDialogOpen(open)
                if (open) {
                  setSelectedStatus(companyStatus === "deactivated" ? "unlisted" : (companyStatus as ListingStatus))
                }
              }}
            >
              <DialogTrigger asChild>
                <Button
                  variant="tertiary"
                  className="w-full justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", statusIndicator)} />
                    <span>{statusLabel}</span>
                  </div>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-md border-none bg-transparent p-0 shadow-none">
              <div className="bg-white rounded-lg max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-6">
                  <h4 className="heading-5 text-foreground">Company visibility</h4>
                  <button
                    type="button"
                    onClick={() => setStatusDialogOpen(false)}
                    className="text-muted-foreground transition-colors hover:text-text-secondary"
                    aria-label="Close company visibility"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center gap-3 mb-6">
                  {logoUrl ? (
                    <Image
                      src={logoUrl}
                      alt={profileState.name}
                      width={64}
                      height={64}
                      className="w-16 h-16 rounded-lg object-cover bg-surface"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-secondary text-xl font-semibold text-white">
                      {profileState.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="space-y-1">
                    <h3 className="heading-6 text-foreground">{profileState.name}</h3>
                    <p className="body-small text-text-secondary">{statusDescription}</p>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  {statusOptions.map((option) => {
                    const isSelected = selectedStatus === option.value
                    const isDisabled = statusPending
                    return (
                      <label
                        key={option.value}
                        className={cn(
                          "block p-4 border rounded-lg transition-colors",
                          isSelected ? "border-foreground bg-surface" : "border-border hover:border-border",
                          isDisabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                        )}
                        aria-disabled={isDisabled}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="company-status"
                            value={option.value}
                            checked={isSelected}
                            onChange={() => {
                              if (!isDisabled) {
                                setSelectedStatus(option.value)
                              }
                            }}
                            disabled={isDisabled}
                            className="sr-only"
                          />
                          <div className="flex flex-1 flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className={cn("w-2 h-2 rounded-full", option.colorClass)} />
                              <span className="body-small font-medium text-foreground">{option.title}</span>
                            </div>
                            <p className="body-small text-text-secondary">{option.description}</p>
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="tertiary"
                    size="tertiary"
                    onClick={() => setStatusDialogOpen(false)}
                    disabled={statusPending}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      performStatusUpdate(selectedStatus as CompanyStatus, {
                        onSuccess: () => setStatusDialogOpen(false),
                        message: selectedStatus === "listed" ? "Company listed" : "Company hidden from homeowners",
                      })
                    }
                    disabled={!isStatusDirty || statusPending}
                    className="flex-1"
                  >
                    {statusPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Preview company */}
          <div>
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              onClick={handlePreviewCompany}
            >
              Preview company
            </Button>
          </div>

          {/* Navigation Items */}
          <div className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeSection === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-[18px] py-3 rounded-full text-left transition-all text-sm font-medium",
                    isActive ? "bg-quaternary text-quaternary-foreground" : "bg-transparent text-quaternary-foreground hover:bg-quaternary-hover"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
          </div>
        </aside>

        <section className="flex-1 space-y-8 lg:pt-6">
          {/* Mobile Status Button */}
          <div className="lg:hidden mb-6 max-w-64">
            <Dialog
              open={statusDialogOpen}
              onOpenChange={(open) => {
                setStatusDialogOpen(open)
                if (open) {
                  setSelectedStatus(companyStatus === "deactivated" ? "unlisted" : (companyStatus as ListingStatus))
                }
              }}
            >
              <DialogTrigger asChild>
                <Button
                  variant="tertiary"
                  className="w-full justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", statusIndicator)} />
                    <span>{statusLabel}</span>
                  </div>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>

          {/* Mobile Navigation Header */}
          <div className="lg:hidden mb-6 flex items-center justify-between">
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
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePreviewCompany}
            >
              Preview
            </Button>
          </div>

          {/* COMMENTED OUT: Upgrade banner (Issue 7)
          {showUpgradeBanner && (
              <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h4 className="font-semibold text-foreground">Upgrade to appear in homeowner searches</h4>
                    <p className="text-sm text-text-secondary">Become findable by thousands of homeowners</p>
                  </div>
                <Button asChild className="bg-red-500 text-white hover:bg-red-600">
                  <Link href="/dashboard/pricing">View plans</Link>
                </Button>
              </div>
            </div>
          )}
          */}

          {activeSection === "profile" ? (
            <div className="space-y-8">
              <div className={sectionCardClass}>
                <div className="flex flex-col items-center gap-4 text-center">
                  {logoUrl ? (
                    <Image
                      src={logoUrl}
                      alt={profileState.name}
                      width={96}
                      height={96}
                      className="h-24 w-24 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-secondary text-2xl font-semibold text-white">
                      {profileState.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col items-center gap-3">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      className="hidden"
                      onChange={handleLogoFileChange}
                    />
                    <Button
                      variant="quaternary" size="quaternary"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={logoPending}
                    >
                      {logoPending ? "Uploading..." : "Change logo"}
                    </Button>
                    <p className="text-xs text-text-secondary">JPG, PNG or SVG. Up to 5MB.</p>
                  </div>
                </div>
              </div>

              <div className={sectionCardClass}>
                <div className="flex flex-col gap-6">
                  <div>
                    <h4 className="heading-5 text-foreground">Company information</h4>
                    <p className="body-small text-text-secondary">Update how your business appears on your public company page.</p>
                  </div>
                  <div className="grid gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="company-name">Company name</Label>
                      <Input
                        id="company-name"
                        value={profileState.name}
                        onChange={(event) => setProfileState((prev) => ({ ...prev, name: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-description">Description</Label>
                      <Textarea
                        id="company-description"
                        rows={4}
                        value={profileState.description}
                        onChange={(event) => setProfileState((prev) => ({ ...prev, description: event.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={handleSaveProfile}
                      disabled={profilePending}
                    >
                      {profilePending ? "Saving..." : "Save company info"}
                    </Button>
                  </div>
                </div>
              </div>

              <div className={sectionCardClass}>
                <div className="flex flex-col gap-6">
                  <div>
                    <h4 className="heading-5 text-foreground">Contact information</h4>
                    <p className="body-small text-text-secondary">Displayed on your public page so homeowners can reach you.</p>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="company-domain">Company domain</Label>
                      <Input
                        id="company-domain"
                        placeholder="example.com"
                        value={profileState.domain}
                        onChange={(event) => setProfileState((prev) => ({ ...prev, domain: event.target.value }))}
                      />
                      <p className="text-xs text-text-secondary">Used for verification and login restrictions.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-email">Contact email</Label>
                      <Input
                        id="company-email"
                        placeholder="you@example.com"
                        value={profileState.email}
                        onChange={(event) => setProfileState((prev) => ({ ...prev, email: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-phone">Phone</Label>
                      <Input
                        id="company-phone"
                        placeholder="+31 20 123 4567"
                        value={profileState.phone}
                        onChange={(event) => setProfileState((prev) => ({ ...prev, phone: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-address">Address</Label>
                      <Input
                        id="company-address"
                        placeholder="Street, number"
                        value={profileState.address}
                        onChange={(event) => setProfileState((prev) => ({ ...prev, address: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-city">City</Label>
                      <Input
                        id="company-city"
                        value={profileState.city}
                        onChange={(event) => setProfileState((prev) => ({ ...prev, city: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-country">Country</Label>
                      <Input
                        id="company-country"
                        value={profileState.country}
                        onChange={(event) => setProfileState((prev) => ({ ...prev, country: event.target.value }))}
                      />
                    </div>
                  </div>
                  <Separator />
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="facebook-url">Facebook</Label>
                      <Input
                        id="facebook-url"
                        placeholder="https://facebook.com/yourcompany"
                        value={socialForm.facebook}
                        onChange={(event) => setSocialForm((prev) => ({ ...prev, facebook: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="instagram-url">Instagram</Label>
                      <Input
                        id="instagram-url"
                        placeholder="https://instagram.com/yourcompany"
                        value={socialForm.instagram}
                        onChange={(event) => setSocialForm((prev) => ({ ...prev, instagram: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="linkedin-url">LinkedIn</Label>
                      <Input
                        id="linkedin-url"
                        placeholder="https://linkedin.com/company/yourcompany"
                        value={socialForm.linkedin}
                        onChange={(event) => setSocialForm((prev) => ({ ...prev, linkedin: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pinterest-url">Pinterest</Label>
                      <Input
                        id="pinterest-url"
                        placeholder="https://pinterest.com/yourcompany"
                        value={socialForm.pinterest}
                        onChange={(event) => setSocialForm((prev) => ({ ...prev, pinterest: event.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={handleSaveContact}
                      disabled={contactPending}
                    >
                      {contactPending ? "Saving..." : "Save contact details"}
                    </Button>
                  </div>
                </div>
              </div>

              <div className={sectionCardClass}>
                <div className="flex flex-col gap-6">
                  <div>
                    <h4 className="heading-5 text-foreground">Services & features</h4>
                    <p className="body-small text-text-secondary">Highlight what you specialise in so we can match you to relevant projects.</p>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="primary-service">Primary service</Label>
                      <select
                        id="primary-service"
                        className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-border focus:outline-none"
                        value={profileState.primaryServiceId}
                        onChange={(event) => handlePrimaryServiceChange(event.target.value)}
                      >
                        <option value="">Select primary service</option>
                        {services.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Other services</Label>
                      <p className="text-xs text-text-secondary">Select additional services that apply to your company.</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {services.map((service) => {
                          const checked = profileState.servicesOffered.includes(service.id)
                          const disabled = service.id === profileState.primaryServiceId
                          return (
                            <label
                              key={service.id}
                              className={cn(
                                "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
                                disabled ? "opacity-60" : ""
                              )}
                            >
                              <Checkbox
                                checked={checked}
                                disabled={disabled}
                                onCheckedChange={(checkedState) =>
                                  toggleServiceSelection(service.id, checkedState === true)
                                }
                              />
                              <span className="text-foreground">{service.name}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Certificates</Label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {certificateOptions.map((certificate) => {
                          const checked = profileState.certificates?.includes(certificate) ?? false
                          return (
                            <label
                              key={certificate}
                              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(checkedState) =>
                                  toggleCertificateSelection(certificate, checkedState === true)
                                }
                              />
                              <span className="text-foreground">{certificate}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Languages</Label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {languageOptions.map((language) => {
                          const checked = profileState.languages?.includes(language) ?? false
                          return (
                            <label
                              key={language}
                              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(checkedState) =>
                                  toggleLanguageSelection(language, checkedState === true)
                                }
                              />
                              <span className="text-foreground">{language}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={handleSaveServices}
                      disabled={servicesPending}
                    >
                      {servicesPending ? "Saving..." : "Save services"}
                    </Button>
                  </div>
                </div>
              </div>


              <div className={sectionCardClass}>
                <div className="flex flex-col gap-6">
                  <div>
                    <h4 className="heading-5 text-foreground">Account status</h4>
                    <p className="body-small text-text-secondary">Control whether your company page is visible to homeowners.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    {isCompanyActive ? (
                      <Button
                        variant="quaternary" size="quaternary"
                        className="border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => performStatusUpdate("deactivated", { message: "Company deactivated" })}
                        disabled={statusPending}
                      >
                        {statusPending ? "Processing..." : "Deactivate company"}
                      </Button>
                    ) : (
                      <Button
                        variant="quaternary" size="quaternary"
                        className="border-green-200 text-green-600 hover:bg-green-50"
                        onClick={() => performStatusUpdate("unlisted", { message: "Company activated" })}
                        disabled={statusPending}
                      >
                        {statusPending ? "Processing..." : "Activate company"}
                      </Button>
                    )}
                    <Badge variant="secondary">Plan: {planTierLabel}</Badge>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <header>
                <h4 className="heading-5 text-foreground">Company photos</h4>
                <p className="body-small text-text-secondary">
                  Showcase up to five photos on your company page. Drag to reorder; the first photo appears as the cover.
                </p>
              </header>

              <div className="grid gap-4 md:grid-cols-3">
                {/* Upload card - first in grid */}
                <div
                  className={cn(
                    "aspect-square flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-surface p-8 text-center transition",
                    dragOver && "border-border",
                    (!canUploadMorePhotos || photoPending) && "cursor-not-allowed opacity-60"
                  )}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  aria-disabled={photoPending || !canUploadMorePhotos}
                >
                  <input
                    ref={photoInputRef}
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/svg+xml"
                    className="hidden"
                    onChange={handlePhotoInputChange}
                  />
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  <div className="body-small font-medium text-foreground">Drag and drop</div>
                  <div className="body-small text-text-secondary">or browse for photos</div>
                  <Button
                    variant="quaternary" size="quaternary"
                    className="mt-2"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={photoPending || !canUploadMorePhotos}
                  >
                    {photoPending ? "Uploading..." : "Browse"}
                  </Button>
                  <div className="text-xs text-text-secondary">
                    {photoSlotsRemaining > 0
                      ? `${photoSlotsRemaining} photo slot${photoSlotsRemaining > 1 ? "s" : ""} remaining.`
                      : "Maximum of 5 photos reached."}
                  </div>
                </div>

                {/* Existing photos */}
                {companyPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className={cn(
                      "relative group",
                      photoPending ? "cursor-not-allowed" : "cursor-move",
                      draggedPhotoId === photo.id && "opacity-60"
                    )}
                    draggable={!photoPending}
                    onDragStart={(event) => handlePhotoDragStart(event, photo.id)}
                    onDragOver={handlePhotoDragOver}
                    onDrop={(event) => {
                      event.preventDefault()
                      handlePhotoDropOnCard(photo.id)
                    }}
                    onDragEnd={handlePhotoDragEnd}
                  >
                    <div className="aspect-square rounded-lg overflow-hidden bg-surface">
                      <Image
                        src={photo.url}
                        alt={photo.alt_text ?? company.name}
                        width={400}
                        height={400}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {photo.is_cover && (
                      <div className="absolute top-2 left-2 bg-secondary text-white px-2 py-1 rounded text-xs font-medium">
                        Cover photo
                      </div>
                    )}

                    <div className="absolute top-2 right-2">
                      <button
                        type="button"
                        onClick={() => handlePhotoMenu(photo.id)}
                        className="bg-white rounded-full p-1 shadow-md hover:bg-surface transition-colors"
                        disabled={photoPending}
                      >
                        <MoreHorizontal className="h-4 w-4 text-text-secondary" />
                      </button>

                      {openMenuId === photo.id && (
                        <div className="absolute top-8 right-0 bg-white rounded-lg shadow-lg border border-border py-1 z-10 min-w-[160px]">
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2 body-small text-foreground hover:bg-surface transition-colors"
                            onClick={() => setCoverPhoto(photo.id)}
                            disabled={coverPhotoId === photo.id || photoPending}
                          >
                            Set as cover photo
                          </button>
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2 body-small text-red-600 hover:bg-surface transition-colors flex items-center gap-2"
                            onClick={() => deletePhoto(photo.id)}
                            disabled={photoPending}
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
            </div>
          )}
        </section>
      </div>

      {/* Mobile Navigation Drawer */}
      <Dialog open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <DialogContent className="max-w-sm">
          <div className="space-y-4">
            {/* Navigation Items */}
            <div className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = activeSection === item.id

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveSection(item.id)
                      setIsMobileMenuOpen(false)
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-[18px] py-3 rounded-full text-left transition-all text-sm font-medium",
                      isActive ? "bg-quaternary text-quaternary-foreground" : "bg-transparent text-quaternary-foreground hover:bg-quaternary-hover"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
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
