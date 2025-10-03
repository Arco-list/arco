"use client"

import { useEffect, useMemo, useRef, useState, useTransition, type ChangeEvent, type DragEvent } from "react"
import Image from "next/image"
import Link from "next/link"

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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Camera, ChevronRight, ImageIcon, MoreHorizontal, Trash2, User } from "lucide-react"
import { toast } from "sonner"

const languageOptions = ["Dutch", "English", "German", "French", "Spanish"] as const
const certificateOptions = ["BNA", "LEED", "Passive House", "WELL"] as const

const navItems = [
  { id: "profile", label: "Profile", icon: User },
  { id: "photos", label: "Photos", icon: Camera },
] as const

const statusOptions: ReadonlyArray<{ value: ListingStatus; title: string; description: string }> = [
  {
    value: "listed",
    title: "Listed",
    description: "Your company page is public and visible to homeowners and on project profiles.",
  },
  {
    value: "unlisted",
    title: "Unlisted",
    description: "Hide your company page from search while keeping data ready to reactivate at any time.",
  },
]

const statusDescriptionMap: Record<CompanyStatus, string> = {
  listed: "Your company page is live for homeowners.",
  unlisted: "Your page is hidden but remains ready to publish.",
  deactivated: "Reactivate to restore your company page and listings.",
}

const statusIndicatorMap: Record<CompanyStatus, string> = {
  listed: "bg-emerald-500",
  unlisted: "bg-gray-400",
  deactivated: "bg-gray-400",
}

const sectionCardClass = "rounded-xl border border-gray-200 bg-white p-6"

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
  socialLinks: Array<Database["public"]["Tables"]["company_social_links"]["Row"]>
  photos: Array<Database["public"]["Tables"]["company_photos"]["Row"]>
  services: Array<{ id: string; name: string; slug: string | null }>
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

export function CompanySettingsShell({ company, socialLinks, photos, services }: CompanySettingsShellProps) {
  const [activeSection, setActiveSection] = useState<"profile" | "photos">("profile")
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [draggedPhotoId, setDraggedPhotoId] = useState<string | null>(null)

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

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Company settings</h1>
          <p className="mt-1 text-sm text-gray-600">Manage your public profile, status, and contact information.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Badge variant="secondary">{planBadgeText}</Badge>
          {domainDisplay ? <span className="text-sm text-gray-500">Domain: {domainDisplay}</span> : null}
        </div>
      </header>

      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="lg:w-64 lg:flex-shrink-0 lg:border-r lg:border-gray-200 lg:pr-6">
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
              <button
                type="button"
                className="w-full rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-gray-300 hover:shadow"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", statusIndicator)} />
                      <span className="font-medium text-gray-900">{statusLabel}</span>
                    </div>
                    <p className="mt-2 text-sm text-gray-500">{statusDescription}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Company visibility</DialogTitle>
                <DialogDescription>Select how your company page appears to homeowners.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {statusOptions.map((option) => {
                  const isActive = selectedStatus === option.value
                  return (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => setSelectedStatus(option.value)}
                      className={cn(
                        "w-full rounded-lg border px-4 py-3 text-left transition",
                        isActive ? "border-gray-900 bg-gray-900/5" : "border-gray-200 hover:border-gray-300",
                        statusPending && "pointer-events-none opacity-60"
                      )}
                      disabled={statusPending}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-gray-900">{option.title}</p>
                          <p className="text-sm text-gray-600">{option.description}</p>
                        </div>
                        <span
                          className={cn(
                            "h-4 w-4 rounded-full border",
                            isActive ? "border-gray-900 bg-gray-900" : "border-gray-300"
                          )}
                        />
                      </div>
                    </button>
                  )
                })}
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="ghost" onClick={() => setStatusDialogOpen(false)} disabled={statusPending}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() =>
                    performStatusUpdate(selectedStatus as CompanyStatus, {
                      onSuccess: () => setStatusDialogOpen(false),
                      message: selectedStatus === "listed" ? "Company listed" : "Company hidden from homeowners",
                    })
                  }
                  disabled={!isStatusDirty || statusPending}
                >
                  {statusPending ? "Updating..." : "Save status"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="hidden lg:mt-8 lg:block">
            <nav className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = activeSection === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSection(item.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition",
                      isActive ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                )
              })}
            </nav>
          </div>
        </aside>

        <section className="flex-1 space-y-8">
          <div className="lg:hidden">
            <div className="grid grid-cols-2 gap-3">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = activeSection === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveSection(item.id)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
                      isActive ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white hover:border-gray-300"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>

          {showUpgradeBanner && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Upgrade to unlock your company page</h3>
                  <p className="text-sm text-gray-600">Upgrade to be discoverable by homeowners and feature your projects.</p>
                </div>
                <Button asChild className="bg-red-500 text-white hover:bg-red-600">
                  <Link href="/dashboard/pricing">View plans</Link>
                </Button>
              </div>
            </div>
          )}

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
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-900 text-2xl font-semibold text-white">
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
                      variant="outline"
                      size="sm"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={logoPending}
                    >
                      {logoPending ? "Uploading..." : "Change logo"}
                    </Button>
                    <p className="text-xs text-gray-500">JPG, PNG or SVG. Up to 5MB.</p>
                  </div>
                </div>
              </div>

              <div className={sectionCardClass}>
                <div className="flex flex-col gap-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Company information</h2>
                    <p className="text-sm text-gray-600">Update how your business appears on your public company page.</p>
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
                      className="bg-gray-900 text-white hover:bg-gray-800"
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
                    <h2 className="text-lg font-semibold text-gray-900">Contact information</h2>
                    <p className="text-sm text-gray-600">Displayed on your public page so homeowners can reach you.</p>
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
                      <p className="text-xs text-gray-500">Used for verification and login restrictions.</p>
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
                      className="bg-gray-900 text-white hover:bg-gray-800"
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
                    <h2 className="text-lg font-semibold text-gray-900">Services & features</h2>
                    <p className="text-sm text-gray-600">Highlight what you specialise in so we can match you to relevant projects.</p>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="primary-service">Primary service</Label>
                      <select
                        id="primary-service"
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
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
                      <p className="text-xs text-gray-500">Select additional services that apply to your company.</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {services.map((service) => {
                          const checked = profileState.servicesOffered.includes(service.id)
                          const disabled = service.id === profileState.primaryServiceId
                          return (
                            <label
                              key={service.id}
                              className={cn(
                                "flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm",
                                disabled ? "opacity-60" : "hover:border-gray-300"
                              )}
                            >
                              <Checkbox
                                checked={checked}
                                disabled={disabled}
                                onCheckedChange={(checkedState) =>
                                  toggleServiceSelection(service.id, checkedState === true)
                                }
                              />
                              <span className="text-gray-700">{service.name}</span>
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
                              className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm hover:border-gray-300"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(checkedState) =>
                                  toggleCertificateSelection(certificate, checkedState === true)
                                }
                              />
                              <span className="text-gray-700">{certificate}</span>
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
                              className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm hover:border-gray-300"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(checkedState) =>
                                  toggleLanguageSelection(language, checkedState === true)
                                }
                              />
                              <span className="text-gray-700">{language}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      className="bg-gray-900 text-white hover:bg-gray-800"
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
                    <h2 className="text-lg font-semibold text-gray-900">Account status</h2>
                    <p className="text-sm text-gray-600">Control whether your company page is visible to homeowners.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    {isCompanyActive ? (
                      <Button
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => performStatusUpdate("deactivated", { message: "Company deactivated" })}
                        disabled={statusPending}
                      >
                        {statusPending ? "Processing..." : "Deactivate company"}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
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
                <h2 className="text-xl font-semibold text-gray-900">Company photos</h2>
                <p className="text-sm text-gray-600">
                  Showcase up to five photos on your company page. Drag to reorder; the first photo appears as the cover.
                </p>
              </header>

              <div className={sectionCardClass}>
                <input
                  ref={photoInputRef}
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/svg+xml"
                  className="hidden"
                  onChange={handlePhotoInputChange}
                />
                <div
                  className={cn(
                    "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-10 text-center transition",
                    dragOver && "border-gray-400",
                    (!canUploadMorePhotos || photoPending) && "cursor-not-allowed opacity-60"
                  )}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  aria-disabled={photoPending || !canUploadMorePhotos}
                >
                  <ImageIcon className="h-10 w-10 text-gray-400" />
                  <div className="text-sm font-medium text-gray-900">Drag and drop</div>
                  <div className="text-sm text-gray-500">JPG, PNG or SVG. Up to 5MB each.</div>
                  <div className="text-xs text-gray-500">
                    {photoSlotsRemaining > 0
                      ? `${photoSlotsRemaining} photo slot${photoSlotsRemaining > 1 ? "s" : ""} remaining.`
                      : "Maximum of 5 photos reached."}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={photoPending || !canUploadMorePhotos}
                  >
                    {photoPending ? "Uploading..." : "Browse files"}
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {companyPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className={cn(
                      "relative transition",
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
                    <div className="overflow-hidden rounded-lg bg-gray-100">
                      <Image
                        src={photo.url}
                        alt={photo.alt_text ?? company.name}
                        width={400}
                        height={400}
                        className="h-56 w-full object-cover"
                      />
                    </div>
                    {photo.is_cover && (
                      <span className="absolute left-3 top-3 rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white">
                        Cover photo
                      </span>
                    )}
                    <div className="absolute right-3 top-3">
                      <button
                        type="button"
                        onClick={() => handlePhotoMenu(photo.id)}
                        className="rounded-full bg-white p-1 shadow hover:bg-gray-50"
                        disabled={photoPending}
                      >
                        <MoreHorizontal className="h-4 w-4 text-gray-600" />
                      </button>
                      {openMenuId === photo.id && (
                        <div className="absolute right-0 top-8 z-10 min-w-[160px] rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
                          <button
                            type="button"
                            className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-gray-50"
                            onClick={() => setCoverPhoto(photo.id)}
                            disabled={coverPhotoId === photo.id || photoPending}
                          >
                            Set as cover photo
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-50"
                            onClick={() => deletePhoto(photo.id)}
                            disabled={photoPending}
                          >
                            <Trash2 className="h-3 w-3" />
                            Remove photo
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {companyPhotos.length === 0 && (
                  <div className="rounded-lg border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                    No photos added yet.
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
