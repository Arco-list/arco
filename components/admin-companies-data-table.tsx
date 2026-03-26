"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  MoreHorizontal,
} from "lucide-react"
import { toast } from "sonner"
import { sanitizeImageUrl, IMAGE_SIZES } from "@/lib/image-security"

import {
  updateCompanyDetailsAction,
  updateCompanyStatusAction,
  updateCompanyPlanTierAction,
  updateCompanyPlanExpirationAction,
  updateCompanyFeaturedAction,
  updateCompanyAutoApproveAction,
  updateProfessionalFeaturedAction,
  adminDeleteCompanyAction,
  generateCompanyLoginLinkAction,
  updateCompanyDomainVerifiedAction,
} from "@/app/admin/professionals/actions"
import { updateProjectProfessionalStatusAction } from "@/app/admin/projects/actions"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Database } from "@/lib/supabase/types"

type CompanyStatus = Database["public"]["Enums"]["company_status"]
type PlanTier = Database["public"]["Enums"]["company_plan_tier"]

const PROJECT_STATUS_DOT: Record<string, string> = {
  draft: "bg-[#a1a1a0]",
  in_progress: "bg-amber-500",
  published: "bg-emerald-500",
  completed: "bg-emerald-500",
  archived: "bg-[#a1a1a0]",
  rejected: "bg-red-500",
}

const CONTRIBUTOR_STATUS_CONFIG: Record<string, { label: string; dotColor: string }> = {
  invited: { label: "Invited", dotColor: "bg-amber-500" },
  unlisted: { label: "Unlisted", dotColor: "bg-[#a1a1a0]" },
  listed: { label: "Listed", dotColor: "bg-emerald-500" },
  live_on_page: { label: "Featured", dotColor: "bg-teal-500" },
  rejected: { label: "Declined", dotColor: "bg-red-500" },
  removed: { label: "Removed", dotColor: "bg-red-500" },
}

export type AdminLinkedProject = {
  id: string
  ppId: string
  title: string
  slug: string | null
  projectStatus: string
  inviteStatus: string
  isProjectOwner: boolean
}

export type AdminCompanyRow = {
  id: string
  type: "company" | "invite"
  name: string
  slug: string | null
  services: string[]
  domain: string | null
  status: CompanyStatus | "invited"
  ownerName: string | null
  ownerEmail: string | null
  ownerAvatarUrl: string | null
  projectsAccepted: number
  projectsPending: number
  projects: AdminLinkedProject[]
  createdAt: string | null
  logoUrl: string | null
  isVerified: boolean
  isFeatured: boolean
  planTier: PlanTier
  planExpiresAt: string | null
  contactEmail: string | null
  website: string | null
  servicesOffered: string[]
  primaryServiceId: string | null
  city: string | null
  country: string | null
  hasPublishedProjects: boolean
  canPublishProjects: boolean
  autoApproveProjects: boolean
}

type ServiceOption = {
  id: string
  name: string
}

type Props = {
  data: AdminCompanyRow[]
  serviceOptions: ServiceOption[]
}

type PendingStatusAction = {
  company: AdminCompanyRow
  nextStatus: CompanyStatus
}

type StatusChangeState = {
  company: AdminCompanyRow
  selectedStatus: CompanyStatus
}

type EditFormState = {
  name: string
  slug: string
  logoUrl: string
  website: string
  email: string
  services: string[]
  primaryServiceId: string
  isFeatured: boolean
  autoApproveProjects: boolean
  status: CompanyStatus
  planTier: PlanTier
  planExpiresAt: string
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

const STATUS_DOT: Record<string, string> = {
  draft: "bg-blue-400",
  listed: "bg-emerald-500",
  unlisted: "bg-[#a1a1a0]",
  deactivated: "bg-rose-500",
  invited: "bg-amber-500",
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  listed: "Listed",
  unlisted: "Unlisted",
  deactivated: "Deactivated",
  invited: "Invited",
}

const COMPANY_STATUS_OPTIONS: { value: CompanyStatus; label: string; description: string; dotColor: string }[] = [
  { value: "draft", label: "Draft", description: "Setup not yet completed", dotColor: "bg-blue-400" },
  { value: "unlisted", label: "Unlisted", description: "Hidden from public directories", dotColor: "bg-[#a1a1a0]" },
  { value: "listed", label: "Listed", description: "Public and visible to homeowners", dotColor: "bg-emerald-500" },
  { value: "deactivated", label: "Deactivated", description: "Suspended and hidden", dotColor: "bg-rose-500" },
]

const planLabels: Record<PlanTier, string> = {
  basic: "Basic",
  plus: "Plus",
}

function ensureHttp(url: string | null): string | null {
  if (!url) return null
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url
  }
  return `https://${url}`
}

export function AdminCompaniesDataTable({ data, serviceOptions }: Props) {
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  })

  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | CompanyStatus | "invited">("all")

  const [pendingAction, setPendingAction] = useState<PendingStatusAction | null>(null)
  const [statusChange, setStatusChange] = useState<StatusChangeState | null>(null)
  const [editingCompany, setEditingCompany] = useState<AdminCompanyRow | null>(null)
  const [editForm, setEditForm] = useState<EditFormState | null>(null)
  const [deleteCompany, setDeleteCompany] = useState<AdminCompanyRow | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [domainVerifyCompany, setDomainVerifyCompany] = useState<AdminCompanyRow | null>(null)
  const [isPending, startTransition] = useTransition()

  // Load professionals when editing a company
  useEffect(() => {
    if (!editingCompany || editingCompany.type !== "company") {
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
          slug: editingCompany.slug ?? "",
          logoUrl: editingCompany.logoUrl ?? "",
          website: editingCompany.website ?? "",
          email: editingCompany.contactEmail ?? "",
          services: editingCompany.servicesOffered ?? [],
          primaryServiceId: editingCompany.primaryServiceId ?? "",
          isFeatured: editingCompany.isFeatured,
          autoApproveProjects: editingCompany.autoApproveProjects,
          status: editingCompany.status === "invited" ? "unlisted" : editingCompany.status,
          planTier: editingCompany.planTier,
          planExpiresAt: editingCompany.planExpiresAt ?? "",
          professionals: professionals ?? [],
        })
      }
    }

    loadCompanyProfessionals()
    return () => { cancelled = true }
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
      isFeatured: checked,
    })
    if (!result.success) {
      toast.error(result.error)
      return
    }
    setEditForm((prev) => (prev ? { ...prev, isFeatured: checked } : prev))
    toast.success(`Company ${checked ? "featured" : "unfeatured"} successfully`)
  }

  const toggleAutoApproveProjects = async (companyId: string, checked: boolean) => {
    const result = await updateCompanyAutoApproveAction({
      companyId,
      autoApproveProjects: checked,
    })
    if (!result.success) {
      toast.error(result.error)
      return
    }
    router.refresh()
    toast.success(`Auto-approve ${checked ? "enabled" : "disabled"}`)
  }

  const toggleProfessionalFeatured = async (professionalId: string, checked: boolean) => {
    const result = await updateProfessionalFeaturedAction({ professionalId, isFeatured: checked })
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
    toast.success(`Professional ${checked ? "featured" : "unfeatured"} successfully`)
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

  const confirmStatusChangeDialog = () => {
    if (!statusChange) return
    startTransition(async () => {
      try {
        const result = await updateCompanyStatusAction({
          companyId: statusChange.company.id,
          status: statusChange.selectedStatus,
        })
        if (!result.success) {
          toast.error(result.error ?? "Failed to update company status")
          return
        }
        toast.success(`${statusChange.company.name} status updated to ${STATUS_LABEL[statusChange.selectedStatus]}`)
        router.refresh()
      } catch (error) {
        console.error("Failed to update company status", error)
        toast.error("Failed to update company status")
      } finally {
        setStatusChange(null)
      }
    })
  }

  const handleDelete = () => {
    if (!deleteCompany) return
    startTransition(async () => {
      try {
        const result = await adminDeleteCompanyAction({ companyId: deleteCompany.id })
        if (!result.success) {
          toast.error("Delete failed", { description: result.error })
          return
        }
        toast.success("Company deleted", { description: `${deleteCompany.name} has been permanently removed.` })
        setDeleteCompany(null)
        router.refresh()
      } catch {
        toast.error("Unexpected error while deleting company.")
      }
    })
  }

  const handleEditSubmit = () => {
    if (!editingCompany || !editForm) return
    startTransition(async () => {
      try {
        const detailsResult = await updateCompanyDetailsAction({
          companyId: editingCompany.id,
          name: editForm.name.trim(),
          slug: editForm.slug.trim() || null,
          logoUrl: editForm.logoUrl.trim() || null,
          website: editForm.website.trim() || null,
          contactEmail: editForm.email.trim() || null,
          services: editForm.services,
          primaryServiceId: editForm.primaryServiceId || null,
        })
        if (!detailsResult.success) {
          toast.error(detailsResult.error ?? "Failed to update company")
          return
        }
        if (editForm.status !== editingCompany.status && editingCompany.status !== "invited") {
          const statusResult = await updateCompanyStatusAction({
            companyId: editingCompany.id,
            status: editForm.status,
          })
          if (!statusResult.success) {
            toast.error(statusResult.error ?? "Failed to update company status")
            return
          }
        }
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
        if (editForm.planExpiresAt !== editingCompany.planExpiresAt) {
          const planExpirationResult = await updateCompanyPlanExpirationAction({
            companyId: editingCompany.id,
            planExpiresAt: editForm.planExpiresAt || null,
          })
          if (!planExpirationResult.success) {
            toast.error(planExpirationResult.error ?? "Failed to update plan expiration")
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

  const columns = useMemo<ColumnDef<AdminCompanyRow>[]>(() => {
    return [
      {
        accessorKey: "name",
        header: "Company",
        cell: ({ row }) => {
          const company = row.original
          const initials = company.name
            .split(" ")
            .filter(Boolean)
            .map((token) => token[0]?.toUpperCase())
            .slice(0, 2)
            .join("")

          const firstService = company.services[0] ?? null
          const extraCount = company.services.length - 1

          return (
            <div className="flex items-center gap-3">
              {company.logoUrl ? (
                <img
                  src={company.logoUrl}
                  alt={company.name}
                  className="h-8 w-8 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f5f5f4] text-xs font-medium text-[#6b6b68]">
                  {initials}
                </div>
              )}
              <div className="flex flex-col min-w-0">
                {company.slug && company.type === "company" ? (
                  <Link
                    href={`/professionals/${company.slug}`}
                    className="text-sm font-medium text-[#1c1c1a] hover:text-[#016D75] transition-colors truncate"
                  >
                    {company.name}
                  </Link>
                ) : (
                  <span className="text-sm font-medium text-[#1c1c1a] truncate">{company.name}</span>
                )}
                {firstService && (
                  <span className="text-xs text-[#a1a1a0] truncate">
                    {firstService}
                    {extraCount > 0 && (
                      <span className="ml-1 inline-flex items-center justify-center rounded-[3px] bg-[#f5f5f4] px-1 py-0.5 text-[10px] font-medium text-[#6b6b68]">
                        +{extraCount}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
          )
        },
        filterFn: (row, columnId, filterValue) => {
          if (!filterValue) return true
          const lowered = (filterValue as string).toLowerCase()
          const haystack = [
            row.original.name,
            row.original.domain ?? "",
            row.original.ownerEmail ?? "",
            ...row.original.services,
          ]
            .join(" ")
            .toLowerCase()
          return haystack.includes(lowered)
        },
      },
      {
        accessorKey: "domain",
        header: "Domain",
        cell: ({ row }) => {
          const company = row.original
          const domain = company.domain
          const verified = company.isVerified
          if (!domain) return <span className="text-xs text-[#a1a1a0]">—</span>
          return (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs text-[#6b6b68] hover:opacity-70 transition-opacity cursor-pointer"
              onClick={(e) => { e.stopPropagation(); setDomainVerifyCompany(company) }}
            >
              {domain}
              {verified ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-emerald-500 shrink-0">
                  <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[#a1a1a0] shrink-0">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              )}
            </button>
          )
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        sortingFn: (rowA, rowB) => {
          const order: Record<string, number> = { listed: 0, unlisted: 1, draft: 2, invited: 3, deactivated: 4 }
          return (order[rowA.original.status] ?? 4) - (order[rowB.original.status] ?? 4)
        },
        cell: ({ row }) => {
          const company = row.original
          const status = company.status
          return (
            <button
              type="button"
              className="flex items-center gap-1.5 hover:opacity-70 transition-opacity cursor-pointer"
              onClick={(e) => {
                e.stopPropagation()
                setStatusChange({ company, selectedStatus: (status === "invited" ? "unlisted" : status) as CompanyStatus })
              }}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status] ?? "bg-gray-400")} />
              <span className="text-xs font-medium text-[#1c1c1a]">{STATUS_LABEL[status] ?? status}</span>
            </button>
          )
        },
        filterFn: (row, columnId, filterValue) => {
          if (!filterValue || filterValue === "all") return true
          return row.original.status === filterValue
        },
      },
      {
        id: "owner",
        header: "Owner",
        cell: ({ row }) => {
          const company = row.original
          if (!company.ownerName && !company.ownerEmail) {
            return <span className="text-xs text-[#a1a1a0]">—</span>
          }
          const initials = (company.ownerName ?? "")
            .split(" ")
            .filter(Boolean)
            .map((t) => t[0]?.toUpperCase())
            .slice(0, 2)
            .join("") || (company.ownerEmail?.charAt(0).toUpperCase() ?? "?")

          return (
            <div className="flex items-center gap-3">
              {company.ownerAvatarUrl ? (
                <img
                  src={company.ownerAvatarUrl}
                  alt={company.ownerName ?? "Owner"}
                  className="h-8 w-8 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f5f5f4] text-xs font-medium text-[#6b6b68]">
                  {initials}
                </div>
              )}
              <div className="flex flex-col min-w-0">
                {company.ownerName && (
                  <span className="text-xs font-medium text-[#1c1c1a] truncate">{company.ownerName}</span>
                )}
                {company.ownerEmail && (
                  <span className="text-[11px] text-[#a1a1a0] truncate">{company.ownerEmail}</span>
                )}
              </div>
            </div>
          )
        },
      },
      {
        id: "projects",
        header: "Projects",
        accessorFn: (row) => row.projectsAccepted + row.projectsPending,
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const totalA = rowA.original.projectsAccepted + rowA.original.projectsPending
          const totalB = rowB.original.projectsAccepted + rowB.original.projectsPending
          return totalA - totalB
        },
        cell: ({ row }) => {
          const { projects: rawProjects } = row.original
          if (!rawProjects.length) {
            return <span className="text-xs text-[#a1a1a0]">—</span>
          }
          // Owner projects first
          const projects = [...rawProjects].sort((a, b) => Number(b.isProjectOwner) - Number(a.isProjectOwner))
          const visible = projects.slice(0, 1)
          const overflow = projects.length - 1
          const renderProjectMenu = (project: AdminLinkedProject) => {
            const projDot = PROJECT_STATUS_DOT[project.projectStatus] ?? "bg-[#a1a1a0]"
            const contribConfig = CONTRIBUTOR_STATUS_CONFIG[project.inviteStatus]
            const companyId = row.original.id
            return (
              <DropdownMenu key={project.id}>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="flex items-center gap-1 hover:text-[#016D75] transition-colors cursor-pointer text-left">
                    <span className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", projDot)} />
                    <span className="text-xs text-[#1c1c1a] truncate max-w-[150px]">{project.title}</span>
                    {contribConfig && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-[#f5f5f4] px-1.5 py-0.5 text-[10px] font-medium text-[#6b6b68] shrink-0">
                        <span className={cn("inline-block h-1 w-1 rounded-full", contribConfig.dotColor)} />
                        {contribConfig.label}
                      </span>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[180px]">
                  <DropdownMenuItem asChild>
                    <a href={`/projects/${project.slug || project.id}${project.projectStatus !== "published" ? "?preview=1" : ""}`} target="_blank" rel="noopener noreferrer" className="text-xs cursor-pointer">
                      View project
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href={`/dashboard/edit/${project.id}`} target="_blank" rel="noopener noreferrer" className="text-xs cursor-pointer">
                      Edit project
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[10px] font-medium text-[#a1a1a0] uppercase tracking-wider">Project status</DropdownMenuLabel>
                  {(["invited", "listed", "live_on_page", "unlisted", "rejected", "removed"] as const).map((status) => {
                    const config = CONTRIBUTOR_STATUS_CONFIG[status]
                    if (!config || project.inviteStatus === status) return null
                    return (
                      <DropdownMenuItem
                        key={status}
                        className="text-xs cursor-pointer flex items-center gap-1.5"
                        onClick={async () => {
                          const result = await updateProjectProfessionalStatusAction({
                            projectId: project.id,
                            companyId,
                            newStatus: status,
                          })
                          if (result.success) {
                            toast.success(`Status updated to ${config.label}`)
                            router.refresh()
                          } else {
                            toast.error(result.error ?? "Failed to update status")
                          }
                        }}
                      >
                        <span className={cn("inline-block h-1.5 w-1.5 rounded-full", config.dotColor)} />
                        {config.label}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )
          }

          return (
            <div className="flex flex-col gap-0.5">
              {visible.map(renderProjectMenu)}
              {overflow > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="text-[11px] text-[#a1a1a0] hover:text-[#016D75] transition-colors text-left cursor-pointer w-fit"
                    >
                      +{overflow} more
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[200px]">
                    {projects.slice(1).map((project) => {
                      const pDot = PROJECT_STATUS_DOT[project.projectStatus] ?? "bg-[#a1a1a0]"
                      const cConfig = CONTRIBUTOR_STATUS_CONFIG[project.inviteStatus]
                      const companyId = row.original.id
                      return (
                        <DropdownMenuSub key={project.id}>
                          <DropdownMenuSubTrigger className="flex items-center gap-1 text-xs">
                            <span className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", pDot)} />
                            <span className="truncate">{project.title}</span>
                            {cConfig && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-[#f5f5f4] px-1.5 py-0.5 text-[10px] font-medium text-[#6b6b68] shrink-0">
                                <span className={cn("inline-block h-1 w-1 rounded-full", cConfig.dotColor)} />
                                {cConfig.label}
                              </span>
                            )}
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="min-w-[180px]">
                            <DropdownMenuItem asChild>
                              <a href={`/projects/${project.slug || project.id}${project.projectStatus !== "published" ? "?preview=1" : ""}`} target="_blank" rel="noopener noreferrer" className="text-xs cursor-pointer">
                                View project
                              </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a href={`/dashboard/edit/${project.id}`} target="_blank" rel="noopener noreferrer" className="text-xs cursor-pointer">
                                Edit project
                              </a>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[10px] font-medium text-[#a1a1a0] uppercase tracking-wider">Project status</DropdownMenuLabel>
                            {(["invited", "listed", "live_on_page", "unlisted", "rejected", "removed"] as const).map((status) => {
                              const config = CONTRIBUTOR_STATUS_CONFIG[status]
                              if (!config || project.inviteStatus === status) return null
                              return (
                                <DropdownMenuItem
                                  key={status}
                                  className="text-xs cursor-pointer flex items-center gap-1.5"
                                  onClick={async () => {
                                    const result = await updateProjectProfessionalStatusAction({
                                      projectId: project.id,
                                      companyId,
                                      newStatus: status,
                                    })
                                    if (result.success) {
                                      toast.success(`Status updated to ${config.label}`)
                                      router.refresh()
                                    } else {
                                      toast.error(result.error ?? "Failed to update status")
                                    }
                                  }}
                                >
                                  <span className={cn("inline-block h-1.5 w-1.5 rounded-full", config.dotColor)} />
                                  {config.label}
                                </DropdownMenuItem>
                              )
                            })}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )
        },
      },
      {
        id: "autoApprove",
        header: "Auto-approve",
        cell: ({ row }) => {
          const company = row.original
          if (company.type === "invite") return null
          return (
            <Checkbox
              checked={company.autoApproveProjects}
              onCheckedChange={(checked) => toggleAutoApproveProjects(company.id, checked === true)}
            />
          )
        },
      },
      {
        id: "created",
        header: "Created",
        accessorFn: (row) => row.createdAt,
        enableSorting: true,
        cell: ({ row }) => {
          const date = row.original.createdAt
          if (!date) return <span className="text-xs text-[#a1a1a0]">—</span>
          return <span className="text-xs text-[#6b6b68] whitespace-nowrap">{format(new Date(date), "dd MMM yyyy")}</span>
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const company = row.original
          if (company.type === "invite") return null

          const publicUrl = company.slug ? `/professionals/${company.slug}` : null
          const isDeactivated = company.status === "deactivated"

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-7 w-7 items-center justify-center rounded-[3px] text-[#a1a1a0] hover:bg-[#f5f5f4] hover:text-[#1c1c1a] transition-colors">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {publicUrl && (
                  <DropdownMenuItem asChild>
                    <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                      View company
                    </a>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={async () => {
                    const result = await generateCompanyLoginLinkAction({ companyId: company.id })
                    if (result.success && result.loginUrl) {
                      window.open(result.loginUrl, "_blank", "noopener,noreferrer")
                    } else {
                      toast.error(result.error ?? "Failed to generate login link")
                    }
                  }}
                >
                  Log in as company
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={`/dashboard/company?company_id=${company.id}`} target="_blank" rel="noopener noreferrer">
                    Edit company
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setStatusChange({ company, selectedStatus: (company.status === "invited" ? "unlisted" : company.status) as CompanyStatus })}
                  disabled={isPending}
                >
                  Update status
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onClick={() => { setDeleteCompany(company); setDeleteConfirmText("") }}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
        enableSorting: false,
        enableHiding: false,
      },
    ]
  }, [isPending])

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      pagination,
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
  })

  const totalCompanies = data.filter((r) => r.type === "company").length
  const totalInvites = data.filter((r) => r.type === "invite").length

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h3 className="arco-section-title">Companies</h3>
        <p className="text-xs text-[#a1a1a0] mt-0.5">
          {totalCompanies} {totalCompanies === 1 ? "company" : "companies"}
          {totalInvites > 0 && ` · ${totalInvites} unclaimed ${totalInvites === 1 ? "invite" : "invites"}`}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 items-center">
          <input
            type="text"
            placeholder="Search by company, domain, or owner…"
            className="w-full max-w-sm px-3 py-2 text-sm border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#1c1c1a] transition-colors placeholder:text-[#a1a1a0]"
            value={searchTerm}
            onChange={(event) => {
              const value = event.target.value
              setSearchTerm(value)
              table.getColumn("name")?.setFilterValue(value)
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              const next = value as typeof statusFilter
              setStatusFilter(next)
              table.getColumn("status")?.setFilterValue(next === "all" ? undefined : next)
            }}
          >
            <SelectTrigger className="w-[140px] h-9 text-xs border-[#e5e5e4] rounded-[3px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="listed">Listed</SelectItem>
              <SelectItem value="unlisted">Unlisted</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="deactivated">Deactivated</SelectItem>
              <SelectItem value="invited">Invited</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="border border-[#e5e5e4] overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 1100 }}>
          <thead>
            <tr className="border-b border-[#e5e5e4]">
              {table.getHeaderGroups().map((headerGroup) =>
                headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      className="h-10 px-4 text-left align-middle text-xs font-medium text-[#6b6b68]"
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          className="inline-flex items-center gap-1 hover:text-[#1c1c1a] transition-colors select-none"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  )
                })
              )}
            </tr>
          </thead>
          <tbody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-[#e5e5e4] last:border-0 hover:bg-[#FAFAF9] transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="h-24 text-center text-sm text-[#a1a1a0]">
                  No companies found. Adjust your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-[#a1a1a0]">
        <span>
          {table.getFilteredRowModel().rows.length} {table.getFilteredRowModel().rows.length === 1 ? "result" : "results"}
        </span>
        <div className="flex items-center gap-3">
          <span>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
          </span>
          <div className="flex items-center gap-1">
            <button
              className="h-7 w-7 flex items-center justify-center border border-[#e5e5e4] rounded-[3px] text-[#6b6b68] hover:bg-[#f5f5f4] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              ‹
            </button>
            <button
              className="h-7 w-7 flex items-center justify-center border border-[#e5e5e4] rounded-[3px] text-[#6b6b68] hover:bg-[#f5f5f4] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* Domain Verification Modal */}
      {domainVerifyCompany && (
        <div className="popup-overlay" onClick={() => setDomainVerifyCompany(null)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Domain verification</h3>
              <button type="button" className="popup-close" onClick={() => setDomainVerifyCompany(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <p style={{ fontSize: 13, fontWeight: 300, color: "var(--arco-light)", margin: "0 0 16px" }}>
              {domainVerifyCompany.isVerified
                ? <>The domain <strong>{domainVerifyCompany.domain}</strong> for <strong>{domainVerifyCompany.name}</strong> is currently verified.</>
                : <>The domain <strong>{domainVerifyCompany.domain}</strong> for <strong>{domainVerifyCompany.name}</strong> is not verified.</>
              }
            </p>
            <div className="popup-actions">
              <button type="button" className="btn-tertiary" onClick={() => setDomainVerifyCompany(null)} disabled={isPending} style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await updateCompanyDomainVerifiedAction({
                      companyId: domainVerifyCompany.id,
                      isVerified: !domainVerifyCompany.isVerified,
                    })
                    if (result.success) {
                      toast.success(domainVerifyCompany.isVerified ? "Domain verification removed" : "Domain verified")
                      setDomainVerifyCompany(null)
                      router.refresh()
                    } else {
                      toast.error(result.error ?? "Failed to update verification")
                    }
                  })
                }}
                style={{ flex: 1 }}
              >
                {isPending ? "Updating…" : domainVerifyCompany.isVerified ? "Remove verification" : "Verify domain"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation — popup-card design */}
      {deleteCompany && (
        <div className="popup-overlay" onClick={() => { if (!isPending) { setDeleteCompany(null); setDeleteConfirmText("") } }}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Delete company</h3>
              <button
                type="button"
                className="popup-close"
                onClick={() => { if (!isPending) { setDeleteCompany(null); setDeleteConfirmText("") } }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="px-4 pb-3">
              <p className="text-sm font-medium text-[#1c1c1a] mb-0.5">{deleteCompany.name}</p>

              <div className="popup-banner popup-banner--warn">
                <AlertTriangle className="popup-banner-icon" />
                <div>
                  <p>This will permanently delete <strong>{deleteCompany.name}</strong> and all associated data (photos, reviews, project links, team members). This action cannot be undone.</p>
                </div>
              </div>

              <div className="pt-1">
                <label className="text-xs text-[#6b6b68] mb-1 block">
                  Type <span className="font-medium text-[#1c1c1a]">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-3 py-2 text-sm border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#1c1c1a] transition-colors placeholder:text-[#a1a1a0]"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="popup-actions">
              <button
                type="button"
                className="btn-tertiary"
                onClick={() => { setDeleteCompany(null); setDeleteConfirmText("") }}
                disabled={isPending}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleDelete}
                disabled={isPending || deleteConfirmText !== "DELETE"}
                style={{ flex: 1, backgroundColor: deleteConfirmText === "DELETE" ? "#dc2626" : undefined, borderColor: deleteConfirmText === "DELETE" ? "#dc2626" : undefined, color: deleteConfirmText === "DELETE" ? "#fff" : undefined }}
              >
                {isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Change Dialog */}
      {statusChange && (
        <div className="popup-overlay" onClick={() => setStatusChange(null)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Update status</h3>
              <button type="button" className="popup-close" onClick={() => setStatusChange(null)} aria-label="Close">
                ✕
              </button>
            </div>

            <div className="status-modal-options">
              {COMPANY_STATUS_OPTIONS.map((option) => {
                const isSelected = statusChange.selectedStatus === option.value
                const needsPublishedProject = option.value === "listed" && !statusChange.company.hasPublishedProjects
                const isDisabled = needsPublishedProject
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`status-modal-option${isSelected ? " selected" : ""}`}
                    disabled={isDisabled}
                    onClick={() => setStatusChange((prev) => prev ? { ...prev, selectedStatus: option.value } : null)}
                  >
                    <span className={`status-modal-dot ${option.dotColor}`} />
                    <div className="status-modal-option-text">
                      <span className="status-modal-option-label">{option.label}</span>
                      <span className="status-modal-option-desc">{option.description}</span>
                      {needsPublishedProject && (
                        <span className="status-modal-limit" style={{ color: "#92400e" }}>
                          {statusChange.company.canPublishProjects
                            ? "Publish your first project to list this company page"
                            : "Get invited to a published project to list this company page"}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="popup-actions">
              <button type="button" className="btn-tertiary" onClick={() => setStatusChange(null)} disabled={isPending} style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={confirmStatusChangeDialog}
                disabled={isPending || statusChange.selectedStatus === (statusChange.company.status === "invited" ? "unlisted" : statusChange.company.status)}
                style={{ flex: 1 }}
              >
                {isPending ? "Updating…" : "Update status"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
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
                <Label className="heading-6">Featured on homepage</Label>
                <p className="body-small text-muted-foreground">
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
                  <SelectItem value="draft">
                    <div className="flex flex-col">
                      <span className="font-medium">Draft</span>
                      <span className="text-xs text-muted-foreground">Setup not yet completed</span>
                    </div>
                  </SelectItem>
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
              <Label htmlFor="plan-expires-at">Plan expiration</Label>
              <Input
                id="plan-expires-at"
                type="datetime-local"
                value={editForm?.planExpiresAt ? new Date(editForm.planExpiresAt).toISOString().slice(0, 16) : ""}
                onChange={(event) =>
                  setEditForm((prev) => (prev ? { ...prev, planExpiresAt: event.target.value ? new Date(event.target.value).toISOString() : "" } : prev))
                }
              />
              {editForm?.planExpiresAt && (
                <p className="text-xs text-muted-foreground">
                  {new Date(editForm.planExpiresAt) > new Date()
                    ? `Expires in ${Math.ceil((new Date(editForm.planExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days`
                    : `Expired ${Math.ceil((Date.now() - new Date(editForm.planExpiresAt).getTime()) / (1000 * 60 * 60 * 24))} days ago`
                  }
                </p>
              )}
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
            <div className="space-y-2">
              <Label htmlFor="company-slug">URL slug</Label>
              <Input
                id="company-slug"
                placeholder="company-slug"
                value={editForm?.slug ?? ""}
                onChange={(event) =>
                  setEditForm((prev) => (prev ? { ...prev, slug: event.target.value } : prev))
                }
              />
              <p className="text-xs text-muted-foreground">
                Used in URL: /professionals/{editForm?.slug || "slug"}
              </p>
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
                    <Image
                      src={sanitizeImageUrl(editForm.logoUrl)}
                      alt="Company logo preview"
                      width={IMAGE_SIZES.thumbnail.width}
                      height={IMAGE_SIZES.thumbnail.height}
                      className="h-full w-full object-contain"
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
              <div className="space-y-2 lg:col-span-1">
                <Label htmlFor="primary-service">Primary service</Label>
                <Select
                  value={editForm?.primaryServiceId ?? ""}
                  onValueChange={(value) =>
                    setEditForm((prev) => (prev ? { ...prev, primaryServiceId: value } : prev))
                  }
                >
                  <SelectTrigger id="primary-service">
                    <SelectValue placeholder="Select primary service" />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceOptions.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label>Other services</Label>
                <p className="text-xs text-muted-foreground">Select additional services this company offers.</p>
                <div className="max-h-56 overflow-y-auto rounded-md border p-3">
                  {serviceOptions.length === 0 ? (
                    <p className="body-small text-muted-foreground">No services available.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {serviceOptions.map((service) => {
                        const checked = editForm?.services.includes(service.id) ?? false
                        const disabled = service.id === editForm?.primaryServiceId
                        return (
                          <label
                            key={service.id}
                            className={cn(
                              "flex items-center gap-2 rounded-md border px-3 py-2 body-small",
                              disabled ? "opacity-50 cursor-not-allowed" : "",
                              checked ? "border-primary bg-primary/5" : "border-border hover:border-primary"
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              disabled={disabled}
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
                    <div className="p-4 text-center body-small text-muted-foreground">
                      No professionals found for this company.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {editForm?.professionals?.map((professional) => {
                        const name = `${professional.first_name || ""} ${professional.last_name || ""}`.trim() || "Unnamed Professional"
                        const role = professional.title || professional.primary_specialty || "Professional"

                        return (
                          <div key={professional.id} className="flex items-center gap-3 p-3 hover:bg-muted/50">
                            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border bg-muted/40">
                              {professional.avatar_url ? (
                                <Image
                                  src={sanitizeImageUrl(professional.avatar_url)}
                                  alt={name}
                                  width={IMAGE_SIZES.avatar.width}
                                  height={IMAGE_SIZES.avatar.height}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="text-xs font-medium text-muted-foreground">
                                  {name.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="body-small font-medium truncate">{name}</p>
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
            <button
              className="arco-nav-text px-[18px] py-[7px] rounded-[3px] border border-[#e5e5e4] hover:bg-[#f5f5f4] transition-colors"
              onClick={() => setEditingCompany(null)}
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              className="arco-nav-text px-[18px] py-[7px] rounded-[3px] btn-scrolled disabled:opacity-50"
              onClick={handleEditSubmit}
              disabled={isPending || !editForm?.name.trim()}
            >
              Save changes
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
