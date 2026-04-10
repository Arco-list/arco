"use client"

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { createPortal } from "react-dom"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { AdminAddCompanyModal } from "@/components/admin-add-company-modal"
import {
  ColumnDef,
  ColumnFiltersState,
  RowSelectionState,
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
  Star,
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
  adminDeleteInviteAction,
  generateCompanyLoginLinkAction,
  updateCompanyDomainVerifiedAction,
  changeCompanyOwnerAction,
  removeCompanyOwnerAction,
  updateCompanyEmailAction,
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

function ServiceDropdown({ services, extraCount }: { services: string[]; extraCount: number }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left })
    }
  }, [open])

  return (
    <span className="ml-1 inline-block">
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open) }}
        className="inline-flex items-center justify-center rounded-[3px] bg-[#f5f5f4] px-1 py-0.5 text-[10px] font-medium text-[#6b6b68] hover:bg-[#e5e5e4] transition-colors"
      >
        +{extraCount}
      </button>
      {open && createPortal(
        <div ref={dropRef} className="fixed z-[500] bg-white border border-[#e5e5e4] rounded-lg shadow-lg py-1.5 min-w-[160px]" style={{ top: pos.top, left: pos.left }}>
          {services.map((s, i) => (
            <span key={i} className="block px-3 py-1 text-xs text-[#1c1c1a]">{s}</span>
          ))}
        </div>,
        document.body
      )}
    </span>
  )
}

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

const CONTRIBUTOR_STATUS_KEYS = ["invited", "live_on_page", "listed", "unlisted", "rejected", "removed"] as const

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

type ProspectCandidate = {
  company: AdminCompanyRow
  eligible: boolean
  reasons: string[]
}

type ProspectConfirmState = {
  candidates: ProspectCandidate[]
}

function validateProspectEligibility(company: AdminCompanyRow): ProspectCandidate {
  const reasons: string[] = []
  if (company.ownerName) reasons.push("Company already claimed")
  if (!company.name?.trim()) reasons.push("Missing company name")
  if (!company.contactEmail?.trim()) reasons.push("Missing contact email")
  if (!company.logoUrl?.trim()) reasons.push("Missing logo")
  if (!company.city?.trim() && !company.country?.trim()) reasons.push("Missing location")
  if (company.projects.length === 0) reasons.push("No projects linked")
  return { company, eligible: reasons.length === 0, reasons }
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
  unclaimed: "bg-[#ea580c]",
  draft: "bg-[#2563eb]",
  listed: "bg-[#7c3aed]",
  unlisted: "bg-[#a1a1a0]",
  deactivated: "bg-[#dc2626]",
  invited: "bg-[#f59e0b]",
  prospected: "bg-[#f59e0b]",
}

const STATUS_LABEL: Record<string, string> = {
  unclaimed: "Unclaimed",
  draft: "Draft",
  listed: "Listed",
  unlisted: "Unlisted",
  deactivated: "Deactivated",
  invited: "Invited",
  prospected: "Prospected",
}

const COMPANY_STATUS_OPTIONS: { value: CompanyStatus; label: string; description: string; dotColor: string }[] = [
  { value: "listed", label: "Listed", description: "Public and visible to homeowners", dotColor: "bg-[#7c3aed]" },
  { value: "unlisted", label: "Unlisted", description: "Hidden from public directories", dotColor: "bg-[#a1a1a0]" },
  { value: "draft", label: "Draft", description: "Setup not yet completed", dotColor: "bg-[#2563eb]" },
  { value: "prospected" as any, label: "Prospected", description: "Contacted by platform, not yet claimed", dotColor: "bg-[#f59e0b]" },
  { value: "unclaimed" as any, label: "Unclaimed", description: "No owner — added by admin or orphaned after account deletion. Waiting to be claimed.", dotColor: "bg-[#ea580c]" },
  { value: "deactivated", label: "Deactivated", description: "Suspended and hidden", dotColor: "bg-[#dc2626]" },
]

const planLabels: Record<PlanTier, string> = {
  basic: "Basic",
  plus: "Plus",
}

function OwnerEmailCell({ company, onRefresh }: { company: AdminCompanyRow; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false)
  const email = company.ownerEmail || company.contactEmail || ""
  const [value, setValue] = useState(email)

  const handleSave = async () => {
    setEditing(false)
    const trimmed = value.trim().toLowerCase()
    if (trimmed === email) return
    const result = await updateCompanyEmailAction({ companyId: company.id, email: trimmed })
    if (result.success) {
      toast.success("Email updated")
      onRefresh()
    } else {
      toast.error(result.error ?? "Failed to update email")
      setValue(email)
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="email"
        className="arco-table-primary border-b border-[#016D75] bg-transparent outline-none w-[180px]"
        style={{ fontWeight: 400 }}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") { setValue(email); setEditing(false) } }}
        onClick={(e) => e.stopPropagation()}
      />
    )
  }

  return (
    <button
      type="button"
      className="arco-table-primary hover:opacity-70 transition-opacity cursor-pointer truncate"
      style={{ fontWeight: 400 }}
      onClick={(e) => { e.stopPropagation(); setEditing(true) }}
      title="Click to edit email"
    >
      {email || <span className="text-[#c4c4c2] italic">Add email...</span>}
    </button>
  )
}

function ensureHttp(url: string | null): string | null {
  if (!url) return null
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url
  }
  return `https://${url}`
}

function DomainCell({ company, onVerify, onRefresh }: { company: AdminCompanyRow; onVerify: () => void; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(company.domain ?? "")

  const handleSave = async () => {
    setEditing(false)
    const trimmed = value.trim().toLowerCase()
    if (trimmed === (company.domain ?? "")) return
    const supabase = getBrowserSupabaseClient()
    await supabase.from("companies").update({ domain: trimmed || null } as any).eq("id", company.id)
    toast.success("Domain updated")
    onRefresh()
  }

  if (editing) {
    return (
      <input
        autoFocus
        className="arco-table-primary border-b border-[#016D75] bg-transparent outline-none w-[120px]"
        style={{ fontWeight: 400 }}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") { setValue(company.domain ?? ""); setEditing(false) } }}
        onClick={(e) => e.stopPropagation()}
      />
    )
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        className="arco-table-primary hover:opacity-70 transition-opacity cursor-pointer"
        style={{ fontWeight: 400 }}
        onClick={(e) => { e.stopPropagation(); setEditing(true) }}
        title="Click to edit domain"
      >
        {company.domain || <span className="text-[#c4c4c2] italic">Add domain...</span>}
      </button>
      <button
        type="button"
        className="shrink-0 hover:opacity-70 transition-opacity cursor-pointer"
        onClick={(e) => { e.stopPropagation(); onVerify() }}
        title={company.isVerified ? "Verified" : "Click to verify"}
      >
        {company.isVerified ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-emerald-500">
            <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[#a1a1a0]">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        )}
      </button>
    </div>
  )
}

export function AdminCompaniesDataTable({ data, serviceOptions }: Props) {
  const router = useRouter()
  const [showAddModal, setShowAddModal] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([{ id: "created", desc: true }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  })

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)

  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | CompanyStatus | "invited" | "prospected">("all")

  const [removeOwnerCompany, setRemoveOwnerCompany] = useState<AdminCompanyRow | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingStatusAction | null>(null)
  const [statusChange, setStatusChange] = useState<StatusChangeState | null>(null)
  const [editingCompany, setEditingCompany] = useState<AdminCompanyRow | null>(null)
  const [editForm, setEditForm] = useState<EditFormState | null>(null)
  const [deleteCompany, setDeleteCompany] = useState<AdminCompanyRow | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [changeOwnerCompany, setChangeOwnerCompany] = useState<AdminCompanyRow | null>(null)
  const [changeOwnerEmail, setChangeOwnerEmail] = useState("")
  const [domainVerifyCompany, setDomainVerifyCompany] = useState<AdminCompanyRow | null>(null)
  const [prospectConfirm, setProspectConfirm] = useState<ProspectConfirmState | null>(null)
  const [showStatusGuide, setShowStatusGuide] = useState(false)
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
    if (statusChange.selectedStatus === ("prospected" as any)) {
      const candidate = validateProspectEligibility(statusChange.company)
      setProspectConfirm({ candidates: [candidate] })
      setStatusChange(null)
      return
    }
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

  const confirmProspect = () => {
    if (!prospectConfirm) return
    const eligible = prospectConfirm.candidates.filter((c) => c.eligible)
    if (eligible.length === 0) return
    startTransition(async () => {
      try {
        let success = 0
        for (const { company } of eligible) {
          const result = await updateCompanyStatusAction({ companyId: company.id, status: "prospected" as CompanyStatus })
          if (result.success) success++
        }
        if (success > 0) {
          toast.success(`${success} ${success === 1 ? "company" : "companies"} set to Prospected — prospect emails sent`)
          setRowSelection({})
          router.refresh()
        }
      } catch (error) {
        console.error("Failed to set prospected status", error)
        toast.error("Failed to update status")
      } finally {
        setProspectConfirm(null)
      }
    })
  }

  const handleDelete = () => {
    if (!deleteCompany) return
    startTransition(async () => {
      try {
        const isInvite = deleteCompany.id.startsWith("invite-")
        const result = isInvite
          ? await adminDeleteInviteAction({ email: deleteCompany.name })
          : await adminDeleteCompanyAction({ companyId: deleteCompany.id })
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
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
            className="h-3.5 w-3.5"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="h-3.5 w-3.5"
          />
        ),
        size: 32,
        enableSorting: false,
        enableHiding: false,
      },
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="shrink-0 transition-colors"
                title={company.isFeatured ? "Remove from homepage" : "Feature on homepage"}
                onClick={async (e) => {
                  e.stopPropagation()
                  const result = await updateCompanyFeaturedAction({ companyId: company.id, isFeatured: !company.isFeatured })
                  if (result.success) {
                    toast.success(company.isFeatured ? "Removed from homepage" : "Featured on homepage")
                    router.refresh()
                  } else {
                    toast.error(result.error ?? "Failed to update")
                  }
                }}
              >
                <Star
                  size={14}
                  className={company.isFeatured ? "fill-amber-400 text-amber-400" : "text-[#c4c4c2] hover:text-[#a1a1a0]"}
                />
              </button>
              {company.logoUrl ? (
                <div className="arco-table-avatar">
                  <img src={company.logoUrl} alt={company.name} />
                </div>
              ) : (
                <div className="arco-table-avatar" style={{ background: "#f5f5f4", color: "#6b6b68" }}>
                  {initials}
                </div>
              )}
              <div className="flex flex-col min-w-0">
                {company.slug && company.type === "company" ? (
                  <Link
                    href={`/professionals/${company.slug}`}
                    className="arco-table-primary arco-table-primary--wrap hover:text-[#016D75] transition-colors"
                  >
                    {company.name}
                  </Link>
                ) : (
                  <span className="arco-table-primary arco-table-primary--wrap">{company.name}</span>
                )}
                {(firstService || company.city) && (
                  <span className="arco-table-secondary" style={{ display: "flex", alignItems: "center", gap: 0 }}>
                    {firstService && <span className="truncate">{firstService}</span>}
                    {extraCount > 0 && (
                      <ServiceDropdown services={company.services} extraCount={extraCount} />
                    )}
                    {company.city && <span>{firstService ? " · " : ""}{company.city}</span>}
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
          return <DomainCell company={company} onVerify={() => setDomainVerifyCompany(company)} onRefresh={() => router.refresh()} />
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
              className="arco-table-status hover:opacity-70 transition-opacity cursor-pointer"
              onClick={(e) => {
                e.stopPropagation()
                setStatusChange({ company, selectedStatus: (status === "invited" ? "unlisted" : status === "prospected" ? "prospected" : status) as CompanyStatus })
              }}
            >
              <span className={cn("arco-table-status-dot", STATUS_DOT[status] ?? "bg-gray-400")} />
              <span style={{ fontWeight: 500 }}>{STATUS_LABEL[status] ?? status}</span>
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

          // Claimed company with owner — show avatar + name + email
          if (company.ownerName) {
            const initials = company.ownerName
              .split(" ")
              .filter(Boolean)
              .map((t) => t[0]?.toUpperCase())
              .slice(0, 2)
              .join("") || "?"

            return (
              <div className="flex items-center gap-3">
                {company.ownerAvatarUrl ? (
                  <div className="arco-table-avatar">
                    <img src={company.ownerAvatarUrl} alt={company.ownerName} />
                  </div>
                ) : (
                  <div className="arco-table-avatar" style={{ background: "#f5f5f4", color: "#6b6b68" }}>
                    {initials}
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="arco-table-primary">{company.ownerName}</span>
                  {company.ownerEmail && (
                    <span className="arco-table-secondary">{company.ownerEmail}</span>
                  )}
                </div>
              </div>
            )
          }

          // Not claimed — show editable email
          return <OwnerEmailCell company={company} onRefresh={() => router.refresh()} />
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
            return <span className="arco-table-secondary">—</span>
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
                  <button type="button" className="flex items-center gap-1.5 hover:text-[#016D75] transition-colors cursor-pointer text-left">
                    <span className="arco-table-status">
                      <span className={cn("arco-table-status-dot", projDot)} />
                      <span className="truncate max-w-[150px]">{project.title}</span>
                    </span>
                    {contribConfig && (
                      <span className="status-pill">
                        <span className={cn("status-pill-dot", contribConfig.dotColor)} />
                        {contribConfig.label}
                      </span>
                    )}
                    {project.isProjectOwner && (
                      <span className="status-pill">Owner</span>
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
                  {CONTRIBUTOR_STATUS_KEYS.map((status) => {
                    const config = CONTRIBUTOR_STATUS_CONFIG[status]
                    if (!config) return null
                    const isCurrent = project.inviteStatus === status
                    return (
                      <DropdownMenuItem
                        key={status}
                        className={cn("text-xs cursor-pointer flex items-center gap-1.5", isCurrent && "font-semibold bg-[#f5f5f4]")}
                        onClick={async () => {
                          if (isCurrent) return
                          const result = await updateProjectProfessionalStatusAction({
                            projectId: project.id,
                            companyId,
                            status,
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
                      className="arco-table-secondary hover:text-[#016D75] transition-colors text-left cursor-pointer w-fit"
                    style={{ marginTop: 0 }}
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
                          <DropdownMenuSubTrigger className="flex items-center gap-1.5 text-xs">
                            <span className={cn("arco-table-status-dot", pDot)} />
                            <span className="truncate">{project.title}</span>
                            {cConfig && (
                              <span className="status-pill">
                                <span className={cn("status-pill-dot", cConfig.dotColor)} />
                                {cConfig.label}
                              </span>
                            )}
                            {project.isProjectOwner && (
                              <span className="status-pill">Owner</span>
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
                            {CONTRIBUTOR_STATUS_KEYS.map((status) => {
                              const config = CONTRIBUTOR_STATUS_CONFIG[status]
                              if (!config) return null
                              const isCurrent = project.inviteStatus === status
                              return (
                                <DropdownMenuItem
                                  key={status}
                                  className={cn("text-xs cursor-pointer flex items-center gap-1.5", isCurrent && "font-semibold bg-[#f5f5f4]")}
                                  onClick={async () => {
                                    if (isCurrent) return
                                    const result = await updateProjectProfessionalStatusAction({
                                      projectId: project.id,
                                      companyId,
                                      status,
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
        header: "Publish",
        cell: ({ row }) => {
          const company = row.original
          if (company.type === "invite") return null

          const isOff = !company.canPublishProjects
          const isAuto = company.canPublishProjects && company.autoApproveProjects
          const isOn = company.canPublishProjects && !company.autoApproveProjects
          const bg = isOff ? "#d4d4d3" : isAuto ? "#016D75" : "#1c1c1a"
          const label = isOff ? "Off" : isAuto ? "Auto" : "On"
          const dotLeft = isOff || isOn ? 2 : "calc(100% - 16px)"

          return (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="relative inline-block shrink-0"
                style={{ width: 30, height: 16, borderRadius: 8, border: "none", cursor: isOff ? "default" : "pointer", background: bg, transition: "background .2s" }}
                onClick={isOff ? undefined : (e) => { e.stopPropagation(); toggleAutoApproveProjects(company.id, !company.autoApproveProjects) }}
              >
                <span style={{
                  position: "absolute", top: 2, left: isAuto ? 16 : 2,
                  width: 12, height: 12, borderRadius: 6, background: "#fff",
                  transition: "left .2s", boxShadow: "0 1px 2px rgba(0,0,0,.15)",
                }} />
              </button>
              <span style={{ fontSize: 10, fontWeight: 500, color: isOff ? "#c4c4c2" : "#6b6b68" }}>{label}</span>
            </div>
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
          if (!date) return <span className="arco-table-secondary">—</span>
          return <span className="arco-table-nowrap">{format(new Date(date), "dd MMM yyyy")}</span>
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
                <button className="arco-table-action" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
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
                      await navigator.clipboard.writeText(result.loginUrl)
                      toast.success("Login link copied — paste in an incognito window")
                    } else {
                      toast.error(result.error ?? "Failed to generate login link")
                    }
                  }}
                >
                  Copy login link
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
                <DropdownMenuItem
                  onClick={() => { setChangeOwnerCompany(company); setChangeOwnerEmail("") }}
                >
                  Change owner
                </DropdownMenuItem>
                {company.ownerName && (
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    onClick={() => setRemoveOwnerCompany(company)}
                  >
                    Remove owner
                  </DropdownMenuItem>
                )}
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
      rowSelection,
    },
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
  })

  const totalCompanies = data.filter((r) => r.status !== "invited").length
  const totalInvites = data.filter((r) => r.status === "invited").length
  const filteredRows = table.getFilteredRowModel().rows
  const filteredCompanies = filteredRows.filter((r) => r.original.status !== "invited").length
  const filteredInvites = filteredRows.filter((r) => r.original.status === "invited").length
  const isFiltered = columnFilters.length > 0 || table.getState().globalFilter

  // Status funnel: Added → Prospected → Draft → Listed → Unlisted, with
  // Deactivated as the off-path leak (analogous to Rejected on the projects
  // funnel). Invited is excluded — invited companies come in via project
  // credits, not the sales funnel, so mixing them in would muddy the
  // conversion math. Mirrors the visual pattern from /admin/projects.
  const companyStatusCounts: Record<string, number> = {}
  for (const c of data) {
    companyStatusCounts[c.status] = (companyStatusCounts[c.status] ?? 0) + 1
  }
  const COMPANY_FUNNEL: { status: CompanyStatus | "invited"; dotColor: string }[] = [
    { status: "unclaimed" as CompanyStatus, dotColor: "#ea580c" },
    { status: "prospected" as CompanyStatus, dotColor: "#f59e0b" },
    { status: "invited", dotColor: "#f59e0b" },
    { status: "draft", dotColor: "#2563eb" },
    { status: "listed", dotColor: "#7c3aed" },
    { status: "unlisted", dotColor: "#a1a1a0" },
    { status: "deactivated", dotColor: "#dc2626" },
  ]
  const companyCountAt = (status: string) => companyStatusCounts[status] ?? 0
  // Each cohort represents "everything currently in or past this stage on
  // the linear flow". Deactivated is a terminal leak so it doesn't
  // accumulate forward.
  const companyCohortFor = (status: string): number => {
    switch (status) {
      case "unclaimed":
        return companyCountAt("unclaimed") + companyCountAt("prospected") + companyCountAt("invited") + companyCountAt("draft") + companyCountAt("listed") + companyCountAt("unlisted")
      case "prospected":
        return companyCountAt("prospected") + companyCountAt("draft") + companyCountAt("listed") + companyCountAt("unlisted")
      case "invited":
        return companyCountAt("invited") + companyCountAt("listed") + companyCountAt("unlisted")
      case "draft":
        return companyCountAt("draft") + companyCountAt("listed") + companyCountAt("unlisted")
      case "listed":
        return companyCountAt("listed") + companyCountAt("unlisted")
      case "unlisted":
        return companyCountAt("unlisted")
      case "deactivated":
        return companyCountAt("deactivated")
      default:
        return 0
    }
  }
  const companyConversionRate = (from: number, to: number): string => {
    if (from === 0) return "0%"
    return `${Math.round((to / from) * 100)}%`
  }
  const companyStatusLabel = (status: string): string => {
    const opt = COMPANY_STATUS_OPTIONS.find((o) => o.value === status)
    return opt?.label ?? status
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="arco-section-title">Companies</h3>
        <p className="text-xs text-[#a1a1a0] mt-0.5">
          {isFiltered ? (
            <>
              {filteredCompanies} of {totalCompanies} {totalCompanies === 1 ? "company" : "companies"}
            </>
          ) : (
            <>
              {totalCompanies} {totalCompanies === 1 ? "company" : "companies"}
            </>
          )}
          {" · "}
          <button type="button" className="text-[#016D75] hover:underline cursor-pointer" onClick={() => setShowStatusGuide(true)}>
            Status guide
          </button>
        </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          style={{ fontSize: 14, padding: "10px 20px" }}
          onClick={() => setShowAddModal(true)}
        >
          Add company
        </button>
      </div>

      {/* Status Guide Popup */}
      {showStatusGuide && (
        <div className="popup-overlay" onClick={() => setShowStatusGuide(false)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Company statuses</h3>
              <button type="button" className="popup-close" onClick={() => setShowStatusGuide(false)} aria-label="Close">✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { dot: "bg-[#7c3aed]", label: "Listed", desc: "Claimed and visible to homeowners on the platform.", specs: "Owner assigned · Public profile · Discoverable" },
                { dot: "bg-[#a1a1a0]", label: "Unlisted", desc: "Claimed but hidden from public directories. Only accessible via direct link.", specs: "Owner assigned · Hidden from search" },
                { dot: "bg-[#2563eb]", label: "Draft", desc: "Company has been claimed. Owner is setting up their profile.", specs: "Owner assigned · Not visible · Setup in progress" },
                { dot: "bg-amber-500", label: "Invited", desc: "Credited by another professional on a project. Auto-created, not yet claimed.", specs: "No owner · Created from project invite" },
                { dot: "bg-[#f59e0b]", label: "Prospected", desc: "Added by admin and contacted via the sales funnel. Visible on the platform while unclaimed.", specs: "No owner · Visible · Sales emails sent · In sales funnel" },
                { dot: "bg-[#ea580c]", label: "Unclaimed", desc: "No owner. Either added by admin (awaiting outreach) or orphaned when the previous owner deleted their account. Can be claimed by the next verified domain holder.", specs: "No owner · Not visible · Waiting to be claimed" },
                { dot: "bg-[#dc2626]", label: "Deactivated", desc: "Suspended and hidden from the platform.", specs: "Hidden · No access" },
              ].map((s) => (
                <div key={s.label} style={{ display: "flex", gap: 12 }}>
                  <span className={`${s.dot} shrink-0`} style={{ width: 8, height: 8, borderRadius: "50%", marginTop: 5 }} />
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "#1c1c1a" }}>{s.label}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b6b68", lineHeight: 1.4 }}>{s.desc}</p>
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "#a1a1a0", lineHeight: 1.3 }}>{s.specs}</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, padding: "12px 16px", background: "#f5f5f4", borderRadius: 4, fontSize: 11, color: "#6b6b68", lineHeight: 1.5 }}>
              <strong>Flow:</strong> Unclaimed → Prospected (sales emails) → Draft (claimed) → Listed (live)
              <br />
              <strong>Constraints:</strong> Companies without an owner cannot be set to Listed or Unlisted. Claimed companies cannot be set to Invited, Prospected or Unclaimed.
            </div>
          </div>
        </div>
      )}

      <AdminAddCompanyModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />

      {/* Status funnel — same visual pattern as /admin/projects, plus a
          bypass line from Draft → Listed (survival rate, skipping the
          Deactivated leak). */}
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
        {(() => {
          const cols = COMPANY_FUNNEL.map((_, i) => i === 0 ? "auto" : "1fr auto").join(" ")
          const CARD_WIDTH = 132

          // Bypass rate: Prospected → Draft, skipping the Invited column
          // since Invited is a parallel entry point (credit path) rather
          // than a sequential stop in the sales funnel.
          const prospectedToDraft = companyConversionRate(
            companyCohortFor("prospected"),
            companyCohortFor("draft"),
          )

          // Grid columns (1-indexed, odd = card, even = connector):
          //   1 unclaimed · 3 prospected · 5 invited · 7 draft · 9 listed ·
          //   11 unlisted · 13 deactivated
          return (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: cols,
                gridTemplateRows: "auto auto auto",
                gap: 0,
                alignItems: "start",
              }}
            >
              {/* Bypass arc — Prospected → Draft (row 1), spans cols 3 → 8 */}
              <div
                style={{
                  gridRow: 1,
                  gridColumn: "3 / 8",
                  position: "relative",
                  height: 32,
                }}
              >
                <div style={{ position: "absolute", left: CARD_WIDTH / 2, right: CARD_WIDTH / 2, top: "50%", borderTop: "1px solid #d4d4d3" }} />
                <div style={{ position: "absolute", left: CARD_WIDTH / 2, top: "50%", bottom: 0, borderLeft: "1px solid #d4d4d3" }} />
                <div style={{ position: "absolute", right: CARD_WIDTH / 2, top: "50%", bottom: 0, borderLeft: "1px solid #d4d4d3" }} />
                {prospectedToDraft && (
                  <span
                    className="absolute text-[10px] font-medium text-[#6b6b68]"
                    style={{ top: 0, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", background: "#fff", padding: "0 6px" }}
                  >
                    {prospectedToDraft}
                  </span>
                )}
              </div>

              {/* Cards + inline connectors — row 3 */}
              {COMPANY_FUNNEL.map((stage, i) => {
                const count = companyCountAt(stage.status)
                const label = stage.status === "invited" ? "Invited" : companyStatusLabel(stage.status)

                // Inline connector rate before this card. Only shown for
                // the meaningful sequential hops: Unclaimed→Prospected,
                // Invited→Draft, and Draft→Listed. Prospected→Invited is
                // a parallel-entry hop (bypass arc above covers
                // Prospected→Draft); Listed→Unlisted and Unlisted→
                // Deactivated are leaks, not conversions.
                let rate = ""
                if (i > 0) {
                  const prev = COMPANY_FUNNEL[i - 1].status
                  const show =
                    (prev === "unclaimed" && stage.status === "prospected") ||
                    (prev === "invited" && stage.status === "draft") ||
                    (prev === "draft" && stage.status === "listed")
                  if (show) {
                    rate = companyConversionRate(companyCohortFor(prev), companyCohortFor(stage.status))
                  }
                }

                const isActive = statusFilter === stage.status
                return (
                  <Fragment key={stage.status}>
                    {i > 0 && (
                      <div
                        className="relative px-1 self-center"
                        style={{ gridRow: 3, minWidth: 32 }}
                      >
                        <div className="w-full border-t border-[#d4d4d3]" />
                        {rate && (
                          <span
                            className="absolute text-[10px] font-medium text-[#6b6b68]"
                            style={{ top: -16, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap" }}
                          >
                            {rate}
                          </span>
                        )}
                      </div>
                    )}
                    <div style={{ gridRow: 3 }} className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => {
                          const next = isActive ? "all" : (stage.status as any)
                          setStatusFilter(next)
                          table.getColumn("status")?.setFilterValue(next === "all" ? undefined : next)
                        }}
                        className={`rounded-[3px] border bg-white px-3 py-3 transition-colors hover:border-[#c4c4c2] ${isActive ? "border-[#c4c4c2] bg-[#fafaf9]" : "border-[#e5e5e4]"}`}
                        style={{ width: CARD_WIDTH }}
                      >
                        <div className="flex items-center gap-[6px] mb-1.5">
                          <span className="status-pill-dot shrink-0" style={{ background: stage.dotColor }} />
                          <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 400, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{label}</span>
                        </div>
                        <p className="arco-card-title text-left">{count}</p>
                      </button>
                    </div>
                  </Fragment>
                )
              })}
            </div>
          )
        })()}
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
            <SelectTrigger className="w-[160px] h-9 text-xs border-[#e5e5e4] rounded-[3px]">
              <SelectValue placeholder="All statuses">
                {statusFilter === "all" ? "All statuses" : (
                  <span className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[statusFilter]}`} />
                    {STATUS_LABEL[statusFilter]}
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {["listed", "unlisted", "draft", "invited", "prospected", "unclaimed", "deactivated"].map((s) => (
                <SelectItem key={s} value={s}>
                  <span className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[s]}`} />
                    {STATUS_LABEL[s]}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bulk actions */}
      {Object.keys(rowSelection).length > 0 && (() => {
        const selectedCount = Object.keys(rowSelection).length
        return (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-[#f5f5f4] rounded-[3px] border border-[#e5e5e4]">
            <span className="text-xs text-[#6b6b68]">{selectedCount} selected</span>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="text-xs px-2.5 py-1 rounded-[3px] border border-[#e5e5e4] bg-white hover:bg-[#f5f5f4] transition-colors" disabled={isBulkProcessing}>
                    Change status
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[160px]">
                  {(["listed", "unlisted", "draft", "prospected", "unclaimed", "deactivated"] as const).map((s) => (
                    <DropdownMenuItem
                      key={s}
                      className="text-xs cursor-pointer flex items-center gap-1.5"
                      onClick={async () => {
                        const selectedRows = table.getSelectedRowModel().rows.map(r => r.original)
                        if (s === "prospected") {
                          const candidates = selectedRows
                            .filter((c) => c.status !== "prospected")
                            .map(validateProspectEligibility)
                          if (candidates.length === 0) {
                            toast.info("All selected companies are already prospected")
                            return
                          }
                          setProspectConfirm({ candidates })
                          return
                        }
                        setIsBulkProcessing(true)
                        let success = 0
                        for (const company of selectedRows) {
                          if (company.status === s) continue
                          const result = await updateCompanyStatusAction({ companyId: company.id, status: s })
                          if (result.success) success++
                        }
                        if (success > 0) {
                          toast.success(`${success} ${success === 1 ? "company" : "companies"} updated to ${STATUS_LABEL[s]}`)
                          setRowSelection({})
                          router.refresh()
                        }
                        setIsBulkProcessing(false)
                      }}
                    >
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[s]}`} />
                      {STATUS_LABEL[s]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                className="text-xs px-2.5 py-1 rounded-[3px] border border-[#e5e5e4] bg-white hover:bg-[#f5f5f4] transition-colors"
                disabled={isBulkProcessing}
                onClick={async () => {
                  const selectedRows = table.getSelectedRowModel().rows.map(r => r.original)
                  setIsBulkProcessing(true)
                  let success = 0
                  for (const company of selectedRows) {
                    if (company.isFeatured || company.type === "invite") continue
                    const result = await updateCompanyFeaturedAction({ companyId: company.id, isFeatured: true })
                    if (result.success) success++
                  }
                  if (success > 0) {
                    toast.success(`${success} ${success === 1 ? "company" : "companies"} featured on homepage`)
                    setRowSelection({})
                    router.refresh()
                  }
                  setIsBulkProcessing(false)
                }}
              >
                Feature
              </button>
              <button
                className="text-xs px-2.5 py-1 rounded-[3px] border border-[#e5e5e4] bg-white hover:bg-[#f5f5f4] transition-colors"
                disabled={isBulkProcessing}
                onClick={async () => {
                  const selectedRows = table.getSelectedRowModel().rows.map(r => r.original)
                  setIsBulkProcessing(true)
                  let success = 0
                  for (const company of selectedRows) {
                    if (!company.isFeatured || company.type === "invite") continue
                    const result = await updateCompanyFeaturedAction({ companyId: company.id, isFeatured: false })
                    if (result.success) success++
                  }
                  if (success > 0) {
                    toast.success(`${success} ${success === 1 ? "company" : "companies"} unfeatured`)
                    setRowSelection({})
                    router.refresh()
                  }
                  setIsBulkProcessing(false)
                }}
              >
                Unfeature
              </button>
              <button
                className="text-xs px-2.5 py-1 rounded-[3px] border border-red-200 bg-white text-red-600 hover:bg-red-50 transition-colors"
                disabled={isBulkProcessing}
                onClick={() => setShowBulkDeleteConfirm(true)}
              >
                Delete
              </button>
            </div>
            {isBulkProcessing && <span className="text-xs text-[#a1a1a0]">Processing…</span>}
          </div>
        )
      })()}

      {/* Table */}
      <div className="arco-table-wrap">
        <table className="arco-table" style={{ minWidth: 1100 }}>
          <thead>
            <tr>
              {table.getHeaderGroups().map((headerGroup) =>
                headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      style={header.id === "select" ? { width: 32, paddingRight: 0 } : undefined}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          className="arco-table-sort"
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
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} style={cell.column.id === "select" ? { width: 32, paddingRight: 0 } : undefined}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} style={{ height: 96, textAlign: "center", color: "var(--text-disabled)" }}>
                  No companies found. Adjust your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="arco-table-pagination">
        <span className="arco-table-pagination-count">
          {table.getFilteredRowModel().rows.length} {table.getFilteredRowModel().rows.length === 1 ? "result" : "results"}
        </span>
        <div className="arco-table-pagination-nav">
          <span className="arco-table-pagination-info">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
          </span>
          <button
            className="arco-table-pagination-btn"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            ‹
          </button>
          <button
            className="arco-table-pagination-btn"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            ›
          </button>
        </div>
      </div>

      {/* Change Owner Modal */}
      {changeOwnerCompany && (
        <div className="popup-overlay" onClick={() => { if (!isPending) setChangeOwnerCompany(null) }}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Change owner</h3>
              <button type="button" className="popup-close" onClick={() => setChangeOwnerCompany(null)} aria-label="Close">✕</button>
            </div>
            <p className="arco-body-text" style={{ marginBottom: 8 }}>
              Transfer ownership of <strong>{changeOwnerCompany.name}</strong> to a different user.
            </p>
            {changeOwnerCompany.ownerEmail && (
              <p style={{ fontSize: 12, color: "var(--arco-mid-grey)", marginBottom: 16 }}>
                Current owner: {changeOwnerCompany.ownerName ?? ""} ({changeOwnerCompany.ownerEmail})
              </p>
            )}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--arco-black)" }}>
                New owner email
              </label>
              <input
                type="email"
                className="w-full px-3 py-2 text-sm border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#1c1c1a] transition-colors"
                value={changeOwnerEmail}
                onChange={e => setChangeOwnerEmail(e.target.value)}
                placeholder="email@company.com"
                autoFocus
              />
            </div>
            <div className="popup-actions">
              <button
                className="btn-tertiary"
                onClick={() => setChangeOwnerCompany(null)}
                disabled={isPending}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={isPending || !changeOwnerEmail.trim()}
                onClick={() => {
                  startTransition(async () => {
                    const result = await changeCompanyOwnerAction({
                      companyId: changeOwnerCompany.id,
                      newOwnerEmail: changeOwnerEmail.trim(),
                    })
                    if (result.success) {
                      toast.success(`Ownership transferred to ${changeOwnerEmail.trim()}`)
                      setChangeOwnerCompany(null)
                      router.refresh()
                    } else {
                      toast.error(result.error ?? "Failed to change owner", { duration: 8000 })
                    }
                  })
                }}
                style={{ flex: 1 }}
              >
                {isPending ? "Transferring…" : "Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Remove Owner Confirmation */}
      {removeOwnerCompany && (
        <div className="popup-overlay" onClick={() => { if (!isPending) setRemoveOwnerCompany(null) }}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Remove owner</h3>
              <button type="button" className="popup-close" onClick={() => setRemoveOwnerCompany(null)} aria-label="Close">✕</button>
            </div>

            <div style={{ fontSize: 14, color: "#44403c", lineHeight: 1.5, marginBottom: 20 }}>
              Remove <strong>{removeOwnerCompany.ownerName}</strong> as owner of <strong>{removeOwnerCompany.name}</strong>?
            </div>

            <div style={{ fontSize: 12, color: "#92400e", background: "#fffbeb", padding: "10px 14px", borderRadius: 4, lineHeight: 1.5, marginBottom: 20 }}>
              This will set the company status to <strong>Added</strong> and unpublish all owned projects.
            </div>

            <div className="popup-actions">
              <button type="button" className="btn-tertiary" onClick={() => setRemoveOwnerCompany(null)} disabled={isPending} style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={isPending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await removeCompanyOwnerAction({ companyId: removeOwnerCompany.id })
                    if (result.success) {
                      toast.success(`Owner removed from ${removeOwnerCompany.name}`)
                      setRemoveOwnerCompany(null)
                      router.refresh()
                    } else {
                      toast.error(result.error ?? "Failed to remove owner")
                    }
                  })
                }}
                style={{ flex: 1, backgroundColor: "#dc2626", borderColor: "#dc2626", color: "#fff" }}
              >
                {isPending ? "Removing…" : "Remove owner"}
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
                  <p>This will permanently delete <strong>{deleteCompany.name}</strong> and all associated data (photos, project links, team members). This action cannot be undone.</p>
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
                const isClaimed = !!statusChange.company.ownerName
                const needsPublishedProject = option.value === "listed" && !statusChange.company.hasPublishedProjects
                const needsUnclaimed = (option.value === ("prospected" as any) || option.value === ("unclaimed" as any) || option.value === ("invited" as any)) && isClaimed
                const needsClaimed = (option.value === "listed" || option.value === "unlisted") && !isClaimed
                const isDisabled = needsPublishedProject || needsUnclaimed || needsClaimed
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
                      {isDisabled ? (
                        <span className="status-modal-option-desc" style={{ color: "#92400e" }}>
                          {needsPublishedProject
                            ? (statusChange.company.canPublishProjects
                              ? "Publish your first project to list this company page"
                              : "Get invited to a published project to list this company page")
                            : needsUnclaimed
                              ? `Company already claimed by ${statusChange.company.ownerName}`
                              : needsClaimed
                                ? "Company must be claimed first — use Prospected to list unclaimed companies"
                                : option.description}
                        </span>
                      ) : (
                        <span className="status-modal-option-desc">{option.description}</span>
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
                {isPending ? "Updating…" : statusChange.selectedStatus === ("prospected" as any) ? "Continue" : "Update status"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prospect Confirmation Dialog */}
      {prospectConfirm && (() => {
        const eligible = prospectConfirm.candidates.filter((c) => c.eligible)
        const ineligible = prospectConfirm.candidates.filter((c) => !c.eligible)
        return (
          <div className="popup-overlay" onClick={() => setProspectConfirm(null)}>
            <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
              <div className="popup-header">
                <h3 className="arco-section-title">Set to Prospected</h3>
                <button type="button" className="popup-close" onClick={() => setProspectConfirm(null)} aria-label="Close">
                  ✕
                </button>
              </div>

              <div style={{ fontSize: 13, color: "#44403c", marginBottom: 16, lineHeight: 1.5 }}>
                Only companies with completed information and at least one project can be set to Prospected.
                A prospect email will be sent to each eligible company.
              </div>

              {eligible.length > 0 && (
                <div style={{ marginBottom: ineligible.length > 0 ? 16 : 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#166534", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", backgroundColor: "#22c55e" }} />
                    {eligible.length} {eligible.length === 1 ? "company" : "companies"} eligible
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {eligible.map(({ company }) => (
                      <div key={company.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 4, fontSize: 12 }}>
                        <span style={{ fontWeight: 500, color: "#1c1c1a" }}>{company.name}</span>
                        <span style={{ color: "#6b6b68" }}>{company.contactEmail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {ineligible.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#92400e", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", backgroundColor: "#f59e0b" }} />
                    {ineligible.length} {ineligible.length === 1 ? "company" : "companies"} not eligible
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {ineligible.map(({ company, reasons }) => (
                      <div key={company.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 4, fontSize: 12 }}>
                        <span style={{ fontWeight: 500, color: "#1c1c1a" }}>{company.name}</span>
                        <span style={{ color: "#92400e" }}>{reasons.join(" · ")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="popup-actions">
                <button type="button" className="btn-tertiary" onClick={() => setProspectConfirm(null)} disabled={isPending} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={confirmProspect}
                  disabled={isPending || eligible.length === 0}
                  style={{ flex: 1 }}
                >
                  {isPending ? "Sending…" : `Send ${eligible.length === 1 ? "email" : `${eligible.length} emails`} & update`}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

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

      {/* Bulk delete confirmation */}
      {showBulkDeleteConfirm && (() => {
        const selectedRows = table.getSelectedRowModel().rows.map(r => r.original)
        const count = selectedRows.length
        return (
          <div className="popup-overlay" onClick={() => { if (!isBulkProcessing) setShowBulkDeleteConfirm(false) }}>
            <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
              <div className="popup-header">
                <h3 className="arco-section-title">Delete {count} {count === 1 ? "company" : "companies"}</h3>
                <button type="button" className="popup-close" onClick={() => setShowBulkDeleteConfirm(false)} aria-label="Close" disabled={isBulkProcessing}>✕</button>
              </div>
              <div className="popup-banner popup-banner--warn">
                <AlertTriangle className="popup-banner-icon" />
                <div><p>This will permanently delete {count} {count === 1 ? "company" : "companies"} and all associated data. This action cannot be undone.</p></div>
              </div>
              <div style={{ maxHeight: 160, overflowY: "auto", margin: "12px 0" }}>
                {selectedRows.map((c) => (
                  <div key={c.id} className="flex items-center gap-1.5 py-1 text-xs text-[#6b6b68]">
                    <span className={`inline-block h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[c.status] ?? "bg-[#a1a1a0]"}`} />
                    {c.name}
                  </div>
                ))}
              </div>
              <div className="popup-actions">
                <button type="button" className="btn-tertiary" onClick={() => setShowBulkDeleteConfirm(false)} disabled={isBulkProcessing} style={{ flex: 1 }}>Cancel</button>
                <button
                  type="button" className="btn-secondary" disabled={isBulkProcessing} style={{ flex: 1, backgroundColor: "#dc2626", borderColor: "#dc2626", color: "#fff" }}
                  onClick={async () => {
                    setIsBulkProcessing(true)
                    let success = 0
                    for (const company of selectedRows) {
                      const isInvite = company.id.startsWith("invite-")
                      const result = isInvite
                        ? await adminDeleteInviteAction({ email: company.name })
                        : await adminDeleteCompanyAction({ companyId: company.id })
                      if (result.success) success++
                    }
                    if (success > 0) {
                      toast.success(`${success} ${success === 1 ? "company" : "companies"} deleted`)
                      setRowSelection({})
                      router.refresh()
                    }
                    setIsBulkProcessing(false)
                    setShowBulkDeleteConfirm(false)
                  }}
                >
                  {isBulkProcessing ? "Deleting…" : `Delete ${count} ${count === 1 ? "company" : "companies"}`}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

    </div>
  )
}
