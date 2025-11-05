"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  IconBuildingSkyscraper,
  IconDotsVertical,
  IconLink,
  IconStar,
  IconUsers,
} from "@tabler/icons-react"
import { toast } from "sonner"

import {
  updateCompanyDetailsAction,
  updateCompanyStatusAction,
  updateCompanyPlanTierAction,
  updateCompanyFeaturedAction,
  updateProfessionalFeaturedAction,
} from "@/app/admin/professionals/actions"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import type { Database } from "@/lib/supabase/types"

export type AdminCompanyRow = {
  id: string
  name: string
  location: string | null
  city: string | null
  country: string | null
  planTier: Database["public"]["Enums"]["company_plan_tier"]
  status: Database["public"]["Enums"]["company_status"]
  isVerified: boolean
  isFeatured: boolean
  projectsLinked: number
  professionalCount: number
  averageRating: number | null
  totalReviews: number
  domain: string | null
  logoUrl: string | null
  website: string | null
  contactEmail: string | null
  servicesOffered: string[]
}

type Props = {
  companies: AdminCompanyRow[]
  serviceOptions: Array<{ id: string; name: string }>
}

type CompanyStatus = Database["public"]["Enums"]["company_status"]

type PlanTier = Database["public"]["Enums"]["company_plan_tier"]

type PendingStatusAction = {
  company: AdminCompanyRow
  nextStatus: CompanyStatus
}

type EditFormState = {
  name: string
  logoUrl: string
  website: string
  email: string
  services: string[]
  isFeatured: boolean
  status: CompanyStatus
  planTier: PlanTier
  professionals: CompanyProfessional[]
}

type CompanyProfessional = {
  id: string
  first_name: string | null
  last_name: string | null
  title: string | null
  primary_specialty: string | null
  is_featured: boolean
  avatar_url: string | null
}

const statusConfig: Record<CompanyStatus, { label: string; badgeTone: "default" | "outline" | "secondary" | "destructive" }> = {
  listed: { label: "Listed", badgeTone: "default" },
  unlisted: { label: "Unlisted", badgeTone: "secondary" },
  deactivated: { label: "Deactivated", badgeTone: "destructive" },
}

const planLabels: Record<PlanTier, string> = {
  basic: "Basic",
  plus: "Plus",
}

const PAGE_SIZE_OPTIONS = [10, 25, 50]

function ensureHttp(url: string | null): string | null {
  if (!url) return null
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url
  }
  return `https://${url}`
}

export function AdminProfessionalsCompaniesTable({ companies, serviceOptions }: Props) {
  const router = useRouter()

  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0])
  const [pendingAction, setPendingAction] = useState<PendingStatusAction | null>(null)
  const [editingCompany, setEditingCompany] = useState<AdminCompanyRow | null>(null)
  const [editForm, setEditForm] = useState<EditFormState | null>(null)
  const [isPending, startTransition] = useTransition()

  const filteredCompanies = useMemo(() => {
    if (!search.trim()) return companies
    const lowered = search.trim().toLowerCase()
    return companies.filter((company) => {
      const haystack = [
        company.name,
        company.location ?? "",
        company.city ?? "",
        company.country ?? "",
        company.contactEmail ?? "",
        company.website ?? "",
        planLabels[company.planTier],
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(lowered)
    })
  }, [companies, search])

  useEffect(() => {
    setPage(0)
  }, [search, pageSize, companies.length])

  const pageCount = Math.max(1, Math.ceil(filteredCompanies.length / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const pageItems = filteredCompanies.slice(currentPage * pageSize, currentPage * pageSize + pageSize)

  useEffect(() => {
    if (!editingCompany) {
      setEditForm(null)
      return
    }

    let cancelled = false
    const loadCompanyProfessionals = async () => {
      const supabase = getBrowserSupabaseClient()
      const { data: professionals } = await supabase
        .from("mv_professional_summary")
        .select("id, first_name, last_name, title, primary_specialty, is_featured, avatar_url")
        .eq("company_id", editingCompany.id)

      if (!cancelled) {
        setEditForm({
          name: editingCompany.name,
          logoUrl: editingCompany.logoUrl ?? "",
          website: editingCompany.website ?? "",
          email: editingCompany.contactEmail ?? "",
          services: editingCompany.servicesOffered ?? [],
          isFeatured: editingCompany.isFeatured,
          status: editingCompany.status,
          planTier: editingCompany.planTier,
          professionals: professionals ?? [],
        })
      }
    }

    loadCompanyProfessionals()
    
    return () => {
      cancelled = true
    }
  }, [editingCompany])

  const toggleService = (serviceId: string, checked: boolean) => {
    setEditForm((prev) => {
      if (!prev) return prev
      if (checked) {
        return { ...prev, services: Array.from(new Set([...prev.services, serviceId])) }
      }
      return { ...prev, services: prev.services.filter((id) => id !== serviceId) }
    })
  }

  const toggleCompanyFeatured = async (checked: boolean) => {
    if (!editingCompany) return

    const result = await updateCompanyFeaturedAction({
      companyId: editingCompany.id,
      isFeatured: checked
    })

    if (!result.success) {
      toast.error(result.error)
      return
    }

    setEditForm((prev) => {
      if (!prev) return prev
      return { ...prev, isFeatured: checked }
    })

    toast.success(`Company ${checked ? 'featured' : 'unfeatured'} successfully`)
  }

  const toggleProfessionalFeatured = async (professionalId: string, checked: boolean) => {
    const result = await updateProfessionalFeaturedAction({
      professionalId,
      isFeatured: checked
    })

    if (!result.success) {
      toast.error(result.error)
      return
    }

    setEditForm((prev) => {
      if (!prev) return prev
      const updatedProfessionals = prev.professionals.map((prof) =>
        prof.id === professionalId ? { ...prof, is_featured: checked } : prof
      )
      return { ...prev, professionals: updatedProfessionals }
    })

    toast.success(`Professional ${checked ? 'featured' : 'unfeatured'} successfully`)
  }

  const handleStatusChange = (nextStatus: CompanyStatus, company: AdminCompanyRow) => {
    setPendingAction({ company, nextStatus })
  }

  const confirmStatusChange = () => {
    if (!pendingAction) return

    startTransition(async () => {
      try {
        const result = await updateCompanyStatusAction({
          companyId: pendingAction.company.id,
          status: pendingAction.nextStatus,
        })

        if (!result.success) {
          toast.error(result.error ?? "Failed to update company status")
          return
        }

        toast.success(
          pendingAction.nextStatus === "deactivated"
            ? `${pendingAction.company.name} was deactivated`
            : `${pendingAction.company.name} is active again`
        )
        router.refresh()
      } catch (error) {
        console.error("Failed to update company status", error)
        toast.error("Failed to update company status")
      } finally {
        setPendingAction(null)
      }
    })
  }

  const handleEditSubmit = () => {
    if (!editingCompany || !editForm) return

    startTransition(async () => {
      try {
        // Update company details
        const detailsResult = await updateCompanyDetailsAction({
          companyId: editingCompany.id,
          name: editForm.name.trim(),
          logoUrl: editForm.logoUrl.trim() || null,
          website: editForm.website.trim() || null,
          contactEmail: editForm.email.trim() || null,
          services: editForm.services,
        })

        if (!detailsResult.success) {
          toast.error(detailsResult.error ?? "Failed to update company")
          return
        }

        // Update status if changed
        if (editForm.status !== editingCompany.status) {
          const statusResult = await updateCompanyStatusAction({
            companyId: editingCompany.id,
            status: editForm.status,
          })

          if (!statusResult.success) {
            toast.error(statusResult.error ?? "Failed to update company status")
            return
          }
        }

        // Update plan tier if changed
        if (editForm.planTier !== editingCompany.planTier) {
          const planTierResult = await updateCompanyPlanTierAction({
            companyId: editingCompany.id,
            planTier: editForm.planTier,
          })

          if (!planTierResult.success) {
            toast.error(planTierResult.error ?? "Failed to update plan tier")
            return
          }
        }

        toast.success(`${editingCompany.name} updated`)
        router.refresh()
      } catch (error) {
        console.error("Failed to update company", error)
        toast.error("Failed to update company")
      } finally {
        setEditingCompany(null)
      }
    })
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold leading-none tracking-tight">Companies</h2>
          <p className="text-sm text-muted-foreground">
            Manage professional company profiles surfaced across marketing pages.
          </p>
        </div>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by company or location"
          className="max-w-xs"
        />
      </div>
      <div className="flex-1 overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/60">
            <TableRow>
              <TableHead className="min-w-[220px]">Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Projects linked</TableHead>
              <TableHead>Professionals</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead className="w-[60px] text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                  No companies match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              pageItems.map((company) => {
                const status = statusConfig[company.status] ?? statusConfig.unlisted
                const ratingLabel =
                  typeof company.averageRating === "number"
                    ? `${company.averageRating.toFixed(2)}${
                        company.totalReviews > 0 ? ` · ${company.totalReviews} reviews` : ""
                      }`
                    : "—"

                const publicUrl = ensureHttp(company.domain)

                return (
                  <TableRow key={company.id}>
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 font-medium">
                          {company.name}
                          {company.isVerified ? (
                            <Badge variant="quaternary" size="quaternary" className="border-green-200 bg-green-50 text-green-700">
                              Verified
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <IconBuildingSkyscraper className="size-3.5" />
                            {company.location ? company.location : "Location not set"}
                          </span>
                          {publicUrl ? (
                            <span className="flex items-center gap-1">
                              <IconLink className="size-3.5" />
                              {company.domain}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.badgeTone}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="quaternary" size="quaternary" className="uppercase tracking-wide">
                        {planLabels[company.planTier]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm font-medium">
                        {company.projectsLinked}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <IconUsers className="size-3.5" />
                        {company.professionalCount}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <IconStar className="size-3.5 fill-yellow-400 text-yellow-400" />
                        {ratingLabel}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="data-[state=open]:bg-muted text-muted-foreground"
                            aria-label={`Company actions for ${company.name}`}
                          >
                            <IconDotsVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => setEditingCompany(company)}>
                            Edit…
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild disabled={!publicUrl}>
                            {publicUrl ? (
                              <a href={publicUrl} target="_blank" rel="noreferrer">
                                View public page
                              </a>
                            ) : (
                              <span className="text-muted-foreground">View public page</span>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {company.status === "deactivated" ? (
                            <DropdownMenuItem
                              onClick={() => handleStatusChange("listed", company)}
                              disabled={isPending}
                            >
                              Reactivate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleStatusChange("deactivated", company)}
                              disabled={isPending}
                            >
                              Deactivate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <div>
          Showing {pageItems.length} of {filteredCompanies.length} companies
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="companies-rows" className="text-sm font-medium text-foreground">
              Rows per page
            </Label>
            <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
              <SelectTrigger id="companies-rows" className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="quaternary" size="quaternary"
              className="h-8"
              onClick={() => setPage(0)}
              disabled={currentPage === 0}
            >
              First
            </Button>
            <Button
              variant="quaternary" size="quaternary"
              className="h-8"
              onClick={() => setPage((prev) => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
            >
              Prev
            </Button>
            <span className="px-2">
              Page {currentPage + 1} of {pageCount}
            </span>
            <Button
              variant="quaternary" size="quaternary"
              className="h-8"
              onClick={() => setPage((prev) => Math.min(pageCount - 1, prev + 1))}
              disabled={currentPage + 1 >= pageCount}
            >
              Next
            </Button>
            <Button
              variant="quaternary" size="quaternary"
              className="h-8"
              onClick={() => setPage(pageCount - 1)}
              disabled={currentPage + 1 >= pageCount}
            >
              Last
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={pendingAction !== null} onOpenChange={(open) => !open && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.nextStatus === "deactivated" ? "Deactivate company" : "Reactivate company"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.nextStatus === "deactivated"
                ? "This company will be hidden from public directories until it is reactivated."
                : "This company will become visible in directories again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange} disabled={isPending}>
              {pendingAction?.nextStatus === "deactivated" ? "Deactivate" : "Reactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(editingCompany)} onOpenChange={(open) => !open && setEditingCompany(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit company</DialogTitle>
            <DialogDescription>
              Update company metadata used across the professionals directory.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Featured on homepage</Label>
                <p className="text-sm text-muted-foreground">
                  Display this company in the featured professionals section
                </p>
              </div>
              <Checkbox
                checked={editForm?.isFeatured ?? false}
                onCheckedChange={(checked) => toggleCompanyFeatured(checked === true)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-status">Company status</Label>
              <Select
                value={editForm?.status ?? "unlisted"}
                onValueChange={(value) =>
                  setEditForm((prev) => prev ? { ...prev, status: value as CompanyStatus } : prev)
                }
              >
                <SelectTrigger id="company-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unlisted">
                    <div className="flex flex-col">
                      <span className="font-medium">Unlisted</span>
                      <span className="text-xs text-muted-foreground">Hidden from public directories</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="listed">
                    <div className="flex flex-col">
                      <span className="font-medium">Listed</span>
                      <span className="text-xs text-muted-foreground">Public and visible to homeowners</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="deactivated">
                    <div className="flex flex-col">
                      <span className="font-medium">Deactivated</span>
                      <span className="text-xs text-muted-foreground">Suspended and hidden</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-plan">Plan tier</Label>
              <Select
                value={editForm?.planTier ?? "basic"}
                onValueChange={(value) =>
                  setEditForm((prev) => prev ? { ...prev, planTier: value as PlanTier } : prev)
                }
              >
                <SelectTrigger id="company-plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">
                    <div className="flex flex-col">
                      <span className="font-medium">Basic</span>
                      <span className="text-xs text-muted-foreground">Standard features, not in directory</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="plus">
                    <div className="flex flex-col">
                      <span className="font-medium">Plus</span>
                      <span className="text-xs text-muted-foreground">Listed in professionals directory</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-name">Company name</Label>
              <Input
                id="company-name"
                value={editForm?.name ?? ""}
                onChange={(event) =>
                  setEditForm((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                }
              />
            </div>
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)] lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company-logo">Logo URL</Label>
                <Input
                  id="company-logo"
                  placeholder="https://..."
                  type="url"
                  value={editForm?.logoUrl ?? ""}
                  onChange={(event) =>
                    setEditForm((prev) => (prev ? { ...prev, logoUrl: event.target.value } : prev))
                  }
                />
                {editForm?.logoUrl ? (
                  <div className="mt-2 flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
                    <img
                      src={editForm.logoUrl}
                      alt="Company logo preview"
                      className="h-full w-full object-contain"
                      onError={(event) => {
                        event.currentTarget.style.display = "none"
                      }}
                    />
                  </div>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-website">Website</Label>
                <Input
                  id="company-website"
                  placeholder="https://example.com"
                  type="url"
                  value={editForm?.website ?? ""}
                  onChange={(event) =>
                    setEditForm((prev) => (prev ? { ...prev, website: event.target.value } : prev))
                  }
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="company-email">Contact email</Label>
                <Input
                  id="company-email"
                  type="email"
                  placeholder="team@example.com"
                  value={editForm?.email ?? ""}
                  onChange={(event) =>
                    setEditForm((prev) => (prev ? { ...prev, email: event.target.value } : prev))
                  }
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label>Services</Label>
                <p className="text-xs text-muted-foreground">Select the services this company offers.</p>
                <div className="max-h-56 overflow-y-auto rounded-md border p-3">
                  {serviceOptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No services available.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {serviceOptions.map((service) => {
                        const checked = editForm?.services.includes(service.id) ?? false
                        return (
                          <label
                            key={service.id}
                            className={cn(
                              "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                              checked ? "border-primary bg-primary/5" : "border-border hover:border-primary"
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) =>
                                toggleService(service.id, value === true)
                              }
                            />
                            <span className="line-clamp-1">{service.name}</span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label>Team Professionals</Label>
                <p className="text-xs text-muted-foreground">Manage which professionals from this company are featured on the homepage.</p>
                <div className="max-h-64 overflow-y-auto rounded-md border">
                  {editForm?.professionals?.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No professionals found for this company.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {editForm?.professionals?.map((professional) => {
                        const name = `${professional.first_name || ''} ${professional.last_name || ''}`.trim() || 'Unnamed Professional'
                        const role = professional.title || professional.primary_specialty || 'Professional'
                        
                        return (
                          <div key={professional.id} className="flex items-center gap-3 p-3 hover:bg-muted/50">
                            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border bg-muted/40">
                              {professional.avatar_url ? (
                                <img
                                  src={professional.avatar_url}
                                  alt={name}
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                  }}
                                />
                              ) : (
                                <span className="text-xs font-medium text-muted-foreground">
                                  {name.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{name}</p>
                              <p className="text-xs text-muted-foreground truncate">{role}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={professional.is_featured}
                                onCheckedChange={(checked) =>
                                  toggleProfessionalFeatured(professional.id, checked === true)
                                }
                              />
                              <Label className="text-xs text-muted-foreground">Featured</Label>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="quaternary" size="quaternary" onClick={() => setEditingCompany(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleEditSubmit} disabled={isPending || !editForm?.name.trim()}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
