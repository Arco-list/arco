"use client"

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { createPortal } from "react-dom"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { AdminAddCompanyModal } from "@/components/admin-add-company-modal"
import { AdminAddClaimableCompanyModal } from "@/components/admin-add-claimable-company-modal"
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
  ArrowUpRight,
  Star,
} from "lucide-react"
import { toast } from "sonner"
import { AdminTabs } from "@/components/admin/admin-tabs"
import { sanitizeImageUrl, IMAGE_SIZES } from "@/lib/image-security"

import {
  updateCompanyStatusAction,
  updateCompanyFeaturedAction,
  updateCompanyAutoApproveAction,
  adminDeleteCompanyAction,
  adminDeleteInviteAction,
  generateCompanyLoginLinkAction,
  updateCompanyDomainVerifiedAction,
  changeCompanyOwnerAction,
  removeCompanyOwnerAction,
  updateCompanyEmailAction,
  updateCompanyContactRoleAction,
  removeCompanyContactAction,
  logOutboundForCompanyContactAction,
} from "@/app/admin/companies/actions"
import { deleteProjectAction, updateProjectProfessionalStatusAction } from "@/app/admin/projects/actions"
import { LogOutboundModal } from "@/app/admin/sales/log-outbound-modal"
import { ContactCard } from "@/components/contact-card/contact-card"
import { useContactParam } from "@/hooks/use-contact-param"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
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
type CompanySource = Database["public"]["Enums"]["company_source"]

// Filter dropdown only exposes the sources that /admin/companies actually
// serves — Apollo cold-imports are scoped out at the page query and
// live in /admin/sales instead. The `apollo` label is kept so historical
// rows in other views still render.
const SOURCE_LABEL: Record<CompanySource, string> = {
  apollo: "Apollo",
  direct: "Direct",
  manual: "Manual",
  admin: "Admin",
  invited: "Invited",
}
// One Channel dimension replaces the old Sources filter: acquisition
// channel (token-truth for funnel claims) with the Direct bucket split
// by first-touch. Some splits carry no pro traffic yet — the empty
// buckets are deliberate, they fill as those channels start working.
const CHANNEL_VALUES = ["invite", "showcase", "outreach", "direct", "seo", "social", "referral", "shares"] as const
type CompanyChannel = (typeof CHANNEL_VALUES)[number]
const CHANNEL_LABEL: Record<string, string> = {
  invite: "Invite",
  showcase: "Showcase",
  outreach: "Outreach",
  direct: "Direct",
  seo: "SEO",
  social: "Social",
  referral: "Referral",
  shares: "Shares",
}

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

// Mirrors the /admin/projects status colours exactly: blue = In
// review (in_progress), amber = In progress (draft).
const PROJECT_STATUS_DOT: Record<string, string> = {
  draft: "bg-amber-500",
  in_progress: "bg-blue-500",
  published: "bg-[#7c3aed]",
  completed: "bg-[#7c3aed]",
  archived: "bg-[#a1a1a0]",
  rejected: "bg-red-500",
}

const CONTRIBUTOR_STATUS_CONFIG: Record<string, { label: string; dotColor: string }> = {
  invited: { label: "Invited", dotColor: "bg-amber-500" },
  unlisted: { label: "Unlisted", dotColor: "bg-[#a1a1a0]" },
  listed: { label: "Listed", dotColor: "bg-emerald-500" },
  live_on_page: { label: "Featured", dotColor: "bg-emerald-500" },
  rejected: { label: "Rejected", dotColor: "bg-red-500" },
  removed: { label: "Removed", dotColor: "bg-red-500" },
}

/** ONE credit-status menu for owners and contributors alike. `write`
 *  is the pp.status the item sets; Invited/Added are greyed out for
 *  owners (an owner is never invited — those states belong to the
 *  contributor path). Added and Invited share the 'invited' write: the
 *  display splits on whether the project is live yet. */
const PROJECT_CREDIT_OPTIONS: { key: string; label: string; dotColor: string; write: "live_on_page" | "listed" | "unlisted" | "invited"; ownerDisabled?: boolean }[] = [
  { key: "featured", label: "Featured", dotColor: "bg-emerald-500", write: "live_on_page" },
  { key: "listed",   label: "Listed",   dotColor: "bg-emerald-500", write: "listed" },
  { key: "unlisted", label: "Unlisted", dotColor: "bg-[#a1a1a0]",   write: "unlisted" },
  { key: "invited",  label: "Invited",  dotColor: "bg-amber-500",   write: "invited", ownerDisabled: true },
  { key: "added",    label: "Added",    dotColor: "bg-[#dc2626]",   write: "invited", ownerDisabled: true },
]

/** Derived display key for the credit: 'invited' splits on project
 *  liveness (Added before acceptance, Invited after); an accepted
 *  credit (featured/listed) on a not-yet-live project reads Unlisted —
 *  the project lifecycle itself lives in the DOT before the title. */
function projectCreditKey(project: { projectStatus: string; inviteStatus: string }): string {
  if (project.inviteStatus === "invited") {
    return project.projectStatus === "published" ? "invited" : "added"
  }
  if ((project.inviteStatus === "live_on_page" || project.inviteStatus === "listed") && project.projectStatus !== "published") {
    return "unlisted"
  }
  return project.inviteStatus === "live_on_page" ? "featured" : project.inviteStatus
}

/** Why a credit-menu option is disabled, or null when clickable.
 *  Added is never a TARGET (derived starting state); before the
 *  project is accepted nothing can move (Featured/Listed need a live
 *  project, the invite only dispatches at publish); and owner credits
 *  are never invited/added. */
function creditDisabledReason(
  project: { projectStatus: string; isProjectOwner: boolean },
  option: { key: string; ownerDisabled?: boolean },
): string | null {
  if (project.isProjectOwner && option.ownerDisabled) return "Owner credits are never invited/added"
  if (option.key === "added") return "Starting state — set by adding a company to a project"
  if (project.projectStatus !== "published") return "Project must be accepted first (see /projects)"
  return null
}

/** Pill next to a project title = the credit state (see above). */
function projectPillFor(project: { projectStatus: string; inviteStatus: string }): { label: string; dotColor: string } | undefined {
  const key = projectCreditKey(project)
  return PROJECT_CREDIT_OPTIONS.find((o) => o.key === key)
    ?? CONTRIBUTOR_STATUS_CONFIG[project.inviteStatus]
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

export type AdminCompanyContact = {
  id: string                  // company_contacts.id
  personId: string
  name: string | null
  email: string
  phone: string | null
  phoneCountryCode: string | null
  source: string | null       // persons.source — apollo | direct | manual | invited
  role: "owner" | "admin" | "member" | "contact"
  status: string | null       // active | invited | inactive | deactivated | null
  authUserId: string | null
  lastContactedAt: string | null
  nextFollowUpAt: string | null
  notes: string | null
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
  contacts: AdminCompanyContact[]
  projectsAccepted: number
  projectsPending: number
  /** Contributors on projects this company OWNS: accepted (live/listed)
   *  vs still-invited credits — the per-anchor tagging metric. */
  teamAccepted: number
  teamInvited: number
  projects: AdminLinkedProject[]
  createdAt: string | null
  logoUrl: string | null
  isVerified: boolean
  isFeatured: boolean
  contactEmail: string | null
  website: string | null
  servicesOffered: string[]
  primaryServiceId: string | null
  city: string | null
  country: string | null
  hasPublishedProjects: boolean
  /** ISO timestamp when the company first transitioned to Listed. NULL
   *  for companies still in Created. Used to gate the Unlisted status
   *  option — a Created company can only move to Listed, not directly
   *  to Unlisted. */
  listedAt: string | null
  canPublishProjects: boolean
  autoApproveProjects: boolean
  source: CompanySource | null
  /** Acquisition channel: consumed claim-token channel for funnel
   *  claims, else the source mapping; 'direct' refined by first-touch
   *  (seo/social/referral/shares). Invite pseudo-rows are 'invite'. */
  channel: string
  /** audience='pro' — photographers channel as invite by construction,
   *  but they never sit in the Invited card and would flood the
   *  Invited→Verified conversion's denominator. */
  isPhotographer: boolean
  seoIndexed: boolean | null
  seoIndexationState: string | null
  seoImpressions28d: number | null
  seoClicks28d: number | null
  seoCtr28d: number | null
  seoPosition28d: number | null
}

type ServiceOption = {
  id: string
  name: string
  parentId: string | null
  sortOrder: number | null
}

type Props = {
  data: AdminCompanyRow[]
  serviceOptions: ServiceOption[]
}

type PendingStatusAction = {
  company: AdminCompanyRow
  nextStatus: CompanyStatus
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
  // Contact email is not required here — it can be captured on the
  // Sales page (Add/Change contact) before the sequence is started.
  // A prospect row with an empty email is still valid: sequence_status
  // stays 'not_started' until the rep fills in the address.
  if (!company.logoUrl?.trim()) reasons.push("Missing logo")
  if (!company.city?.trim() && !company.country?.trim()) reasons.push("Missing location")
  if (company.projects.length === 0) reasons.push("No projects linked")
  return { company, eligible: reasons.length === 0, reasons }
}


const STATUS_DOT: Record<string, string> = {
  subscribed: "bg-[#0f766e]",
  added: "bg-[#dc2626]",
  unclaimed: "bg-[#dc2626]",
  created: "bg-[#2563eb]",
  verified: "bg-[#2563eb]",
  owned: "bg-[#2563eb]",
  listed: "bg-[#7c3aed]",
  unlisted: "bg-[#a1a1a0]",
  deactivated: "bg-[#dc2626]",
  invited: "bg-[#f59e0b]",
  prospected: "bg-[#f59e0b]",
}

const STATUS_LABEL: Record<string, string> = {
  subscribed: "Subscribed",
  added: "Added",
  unclaimed: "Unclaimed",
  created: "Created",
  verified: "Verified",
  owned: "Owned",
  listed: "Listed",
  unlisted: "Unlisted",
  deactivated: "Deactivated",
  invited: "Invited",
  prospected: "Showcased",
}

/** Why a status can't be picked for this company right now — null when
 *  allowed. Single source for the Update-status dialog and the row
 *  menu's hover submenu, so the two can't drift. */
function companyStatusDisabledReason(company: AdminCompanyRow, value: CompanyStatus): string | null {
  const isClaimed = !!company.ownerName
  if (value === "listed" && !company.hasPublishedProjects) {
    return company.canPublishProjects
      ? "Publish your first project to list this company page"
      : "Get invited to a published project to list this company page"
  }
  if ((value === ("prospected" as CompanyStatus) || value === ("added" as CompanyStatus)) && isClaimed) {
    return `Company already claimed by ${company.ownerName}`
  }
  // Invited is system-derived: only a credit from another professional
  // lands a company there — never an admin pick.
  if (value === ("invited" as CompanyStatus)) return "System-derived — set by a project credit"
  // Verified and Owned are claim-funnel facts (proven mailbox, linked
  // owner account) — forcing them by hand would fake a claim that
  // never happened, and Owned without an owner_id breaks the
  // listing machinery.
  if (value === ("verified" as CompanyStatus) || value === ("owned" as CompanyStatus)) {
    return "System-derived — set by the claim funnel"
  }
  if ((value === "listed" || value === "unlisted" || value === ("created" as CompanyStatus)) && !isClaimed) {
    return "Company must be claimed first"
  }
  if (value === "unlisted" && company.listedAt == null) {
    return "Company has never been listed — must go Listed first before it can be Unlisted"
  }
  return null
}

const COMPANY_STATUS_OPTIONS: { value: CompanyStatus; label: string; description: string; dotColor: string }[] = [
  { value: "listed", label: "Listed", description: "Public and visible to homeowners", dotColor: "bg-[#7c3aed]" },
  { value: "unlisted", label: "Unlisted", description: "Hidden from public directories", dotColor: "bg-[#a1a1a0]" },
  { value: "owned" as any, label: "Owned", description: "Owned by an Arco user, never listed yet", dotColor: "bg-[#2563eb]" },
  { value: "verified" as any, label: "Verified", description: "Identity proven and company step confirmed — claim not yet completed", dotColor: "bg-[#2563eb]" },
  { value: "invited" as any, label: "Invited", description: "Credited by another professional on a project", dotColor: "bg-amber-500" },
  { value: "prospected" as any, label: "Showcased", description: "Live showcase page, waiting to be claimed", dotColor: "bg-[#f59e0b]" },
  { value: "added" as any, label: "Added", description: "Apollo import, manual add, or photographer", dotColor: "bg-[#dc2626]" },
  { value: "deactivated", label: "Deactivated", description: "Suspended and hidden", dotColor: "bg-[#dc2626]" },
]

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

// ────────────────────────────────────────────────────────────────────────
// Contacts column components. Mirrors the Sales page's ContactsCell:
// primary contact inline (with a click-menu), overflow contacts in a "+N
// more" dropdown each carrying its own sub-menu.
// ────────────────────────────────────────────────────────────────────────

const CONTACT_STATUS_LABEL: Record<string, string> = {
  active: "Active",
  invited: "Invited",
  inactive: "Inactive",
  deactivated: "Deactivated",
}

const CONTACT_ROLE_LABEL: Record<AdminCompanyContact["role"], string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  contact: "Contact",
}

function ContactInline({ contact }: { contact: AdminCompanyContact }) {
  const displayName = contact.name?.trim() || contact.email
  return (
    <>
      <span className="arco-table-status">
        <span className="truncate max-w-[180px]">{displayName}</span>
      </span>
      <span className="status-pill">{CONTACT_ROLE_LABEL[contact.role]}</span>
    </>
  )
}

function ContactActionMenuItems({
  contact,
  companyId,
  companyName,
  onChangeOwner,
  onDetails,
  onRefresh,
  onLogOutbound,
}: {
  contact: AdminCompanyContact
  companyId: string
  companyName: string
  onChangeOwner: () => void
  onDetails: (contact: AdminCompanyContact) => void
  onRefresh: () => void
  onLogOutbound: (contact: AdminCompanyContact) => void
}) {
  const changeRole = async (role: AdminCompanyContact["role"]) => {
    if (role === contact.role) return
    const result = await updateCompanyContactRoleAction({ contactId: contact.id, role })
    if (!result.success) {
      toast.error(result.error ?? "Failed to update role")
      return
    }
    toast.success(`Role changed to ${CONTACT_ROLE_LABEL[role]}`)
    onRefresh()
  }
  const remove = async () => {
    if (!confirm(`Remove ${contact.name ?? contact.email} from ${companyName}?`)) return
    const result = await removeCompanyContactAction({ contactId: contact.id })
    if (!result.success) {
      toast.error(result.error ?? "Failed to remove contact")
      return
    }
    toast.success("Contact removed")
    onRefresh()
  }
  return (
    <>
      <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => onDetails(contact)}>
        Details
      </DropdownMenuItem>
      <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => onLogOutbound(contact)}>
        Log outbound
      </DropdownMenuItem>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="text-xs">Change role</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          {(["owner", "admin", "member", "contact"] as const).map((r) => (
            <DropdownMenuItem
              key={r}
              className="text-xs cursor-pointer"
              disabled={r === contact.role}
              onClick={() => changeRole(r)}
            >
              {CONTACT_ROLE_LABEL[r]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      {contact.role === "owner" && (
        <DropdownMenuItem className="text-xs cursor-pointer" onClick={onChangeOwner}>
          Change owner
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem
        className="text-xs cursor-pointer text-red-600 focus:text-red-700"
        onClick={remove}
      >
        Remove from company
      </DropdownMenuItem>
    </>
  )
}

function ContactsCell({
  contacts,
  companyId,
  companyName,
  onChangeOwner,
  onRefresh,
}: {
  contacts: AdminCompanyContact[]
  companyId: string
  companyName: string
  onChangeOwner: () => void
  onRefresh: () => void
}) {
  const [logOutboundTarget, setLogOutboundTarget] = useState<AdminCompanyContact | null>(null)
  // Details opens the shared Contact Card panel (URL-driven; mounted
  // once at table level) instead of the old ContactDetailsDialog popup.
  const contactParam = useContactParam()
  const openDetails = (c: AdminCompanyContact) => {
    if (c.email?.trim()) contactParam.open(c.email)
    else toast.error("Contact has no email address")
  }
  const primary = contacts[0]
  const overflow = contacts.slice(1)
  if (!primary) return null

  return (
    <div className="flex flex-col gap-0.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 hover:text-[#016D75] transition-colors cursor-pointer text-left"
          >
            <ContactInline contact={primary} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[200px]">
          <ContactActionMenuItems
            contact={primary}
            companyId={companyId}
            companyName={companyName}
            onChangeOwner={onChangeOwner}
            onDetails={openDetails}
            onRefresh={onRefresh}
            onLogOutbound={(c) => setLogOutboundTarget(c)}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      {overflow.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="arco-table-secondary hover:text-[#016D75] transition-colors text-left cursor-pointer w-fit"
            >
              +{overflow.length} more
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[280px]">
            {overflow.map((c) => (
              <DropdownMenuSub key={c.id}>
                <DropdownMenuSubTrigger className="text-xs">
                  <ContactInline contact={c} />
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-[200px]">
                  <ContactActionMenuItems
                    contact={c}
                    companyId={companyId}
                    companyName={companyName}
                    onChangeOwner={onChangeOwner}
                    onDetails={openDetails}
                    onRefresh={onRefresh}
                    onLogOutbound={(target) => setLogOutboundTarget(target)}
                  />
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {logOutboundTarget && (
        <LogOutboundModal
          open
          onOpenChange={(open) => {
            if (!open) setLogOutboundTarget(null)
          }}
          companyContactId={logOutboundTarget.id}
          contactLabel={logOutboundTarget.name?.trim() || logOutboundTarget.email || "Unnamed contact"}
          companyLabel={companyName}
          contactEmail={logOutboundTarget.email ?? null}
          contactPhone={logOutboundTarget.phone ?? null}
          contactAvatarUrl={null}
          onLogged={() => {
            setLogOutboundTarget(null)
            onRefresh()
          }}
        />
      )}
    </div>
  )
}

function formatRelativeDate(iso: string | null): string {
  if (!iso) return "—"
  try {
    return format(new Date(iso), "d MMM yyyy")
  } catch {
    return iso
  }
}

const SOURCE_LABELS: Record<string, string> = {
  apollo: "Apollo",
  direct: "Direct",
  manual: "Manual",
  invited: "Invited",
}

/** Canonical bare-domain form ("valkdesign.nl") — strips protocol, www,
 *  path and trailing slash so the column reads uniformly regardless of
 *  what an import or paste stored. */
function normalizeDomain(input: string | null | undefined): string {
  if (!input) return ""
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
}

function DomainCell({ company, onVerify, onRefresh }: { company: AdminCompanyRow; onVerify: () => void; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(normalizeDomain(company.domain))

  const handleSave = async () => {
    setEditing(false)
    const trimmed = normalizeDomain(value)
    if (trimmed === normalizeDomain(company.domain)) return
    const supabase = getBrowserSupabaseClient()
    // Website follows the domain — the external-link arrows (here and
    // on Sales/Inbox) prefer companies.website over domain.
    await supabase.from("companies").update({ domain: trimmed || null, ...(trimmed ? { website: `https://${trimmed}` } : {}) } as any).eq("id", company.id)
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
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") { setValue(normalizeDomain(company.domain)); setEditing(false) } }}
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
        {normalizeDomain(company.domain) || <span className="text-[#c4c4c2] italic">Add domain...</span>}
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
  // Shared Contact Card slide-over — URL-driven via ?contact=<email>.
  // ContactsCell's "Details" items call contactParam.open(email); this
  // top-level mount renders the panel.
  const contactParam = useContactParam()
  const [showAddModal, setShowAddModal] = useState(false)
  // Inline name edit, opened from the company-name menu. Mirrors
  // DomainCell: edit in place in the table rather than in a dialog.
  const [editingName, setEditingName] = useState<{ id: string; value: string } | null>(null)
  // The company menu is controlled so a click anywhere on the row can
  // open it, anchored to that row's "…" trigger.
  // Row menu opens AT the click position (a zero-size fixed anchor for
  // the dropdown), not at the far-right "…" column.
  const [rowMenu, setRowMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [sorting, setSorting] = useState<SortingState>([{ id: "created", desc: true }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  // "Load more" pagination — start at 50, grow by 50 each click.
  // Mirrors /admin/sales UX; classic Previous/Next buttons removed.
  const LOAD_MORE_STEP = 50
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: LOAD_MORE_STEP,
  })

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)

  const [searchTerm, setSearchTerm] = useState("")
  // Multi-select status filter. Empty array = no filter (all statuses) — same
  // semantics as the previous "all" sentinel but enables OR'd multi-status
  // filtering. Funnel cards toggle in/out of the array; the dropdown uses
  // checkbox items.
  // "subscribed" matches nothing until subscription billing lands.
  type CompanyStatusFilterValue = CompanyStatus | "invited" | "prospected" | "subscribed"
  const [statusFilter, setStatusFilter] = useState<CompanyStatusFilterValue[]>([])
  // Parked groups — hidden from the default table, each behind its own
  // toggle next to the Status guide link. Photographers are credits-only
  // documentation; "manual" are the lean claimable shells the Add
  // company button creates (source 'admin', still status 'added').
  // Showcase companies (source 'manual' — the Add showcase button)
  // always stay visible under Added. Searching reveals everything.
  const [showPhotographers, setShowPhotographers] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [showAddClaimable, setShowAddClaimable] = useState(false)
  // Multi-select source filter. Same semantics as status: empty array =
  // no filter. Filters company-type rows by `source`; invite-type rows
  // (synthetic, no company) are excluded when any source is selected.
  const [channelFilter, setChannelFilter] = useState<CompanyChannel[]>([])
  const toggleChannel = useCallback((c: CompanyChannel) => {
    setChannelFilter((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    )
  }, [])

  // Multi-select service filter — same shape as source. Matches on
  // primaryServiceId OR any id in servicesOffered so a company that
  // lists a service as secondary still surfaces when you pick that
  // service. Empty selection = no filter.
  const [serviceFilter, setServiceFilter] = useState<string[]>([])
  const toggleService = useCallback((id: string) => {
    setServiceFilter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  // Group tree for the services dropdown. Parents (parentId=null)
  // become section headers with a "select all in group" checkbox
  // whose selected state reflects whether every child is picked.
  // Children with no parent still render at the top under "Other".
  const serviceGroups = useMemo(() => {
    const sortByOrderName = (a: ServiceOption, b: ServiceOption) => {
      const ao = a.sortOrder ?? Number.POSITIVE_INFINITY
      const bo = b.sortOrder ?? Number.POSITIVE_INFINITY
      return ao - bo || a.name.localeCompare(b.name)
    }
    const parents = serviceOptions
      .filter((s) => s.parentId === null)
      .slice()
      .sort(sortByOrderName)
    const childrenByParent = new Map<string, ServiceOption[]>()
    const orphans: ServiceOption[] = []
    for (const s of serviceOptions) {
      if (s.parentId === null) continue
      const arr = childrenByParent.get(s.parentId)
      if (arr) arr.push(s)
      else childrenByParent.set(s.parentId, [s])
    }
    for (const s of serviceOptions) {
      if (s.parentId !== null && !parents.some((p) => p.id === s.parentId)) {
        orphans.push(s)
      }
    }
    for (const arr of childrenByParent.values()) arr.sort(sortByOrderName)
    return { parents, childrenByParent, orphans: orphans.sort(sortByOrderName) }
  }, [serviceOptions])

  const setServicesForGroup = useCallback((childIds: string[], selectAll: boolean) => {
    setServiceFilter((prev) => {
      const set = new Set(prev)
      if (selectAll) childIds.forEach((id) => set.add(id))
      else childIds.forEach((id) => set.delete(id))
      return Array.from(set)
    })
  }, [])

  // The parked-toggle baseline: what the table (and the "X companies"
  // count) consider the current universe. Searching reveals everything.
  const baseRows = useMemo(() => {
    let rows = data
    const searching = searchTerm.trim().length > 0
    if (!searching) {
      if (!showPhotographers) rows = rows.filter((row) => !row.isPhotographer)
      if (!showManual) rows = rows.filter((row) => !(row.source === "admin" && row.status === "added"))
    }
    return rows
  }, [data, showPhotographers, showManual, searchTerm])

  const filteredData = useMemo(() => {
    let rows = baseRows
    if (channelFilter.length > 0) {
      rows = rows.filter((row) => channelFilter.includes(row.channel as CompanyChannel))
    }
    if (serviceFilter.length > 0) {
      const selected = new Set(serviceFilter)
      rows = rows.filter((row) => {
        if (row.primaryServiceId && selected.has(row.primaryServiceId)) return true
        return row.servicesOffered.some((id) => selected.has(id))
      })
    }
    return rows
  }, [baseRows, channelFilter, serviceFilter])

  /** Pushes the array into TanStack Table's column filter. Empty = clear. */
  const applyStatusFilter = useCallback((next: CompanyStatusFilterValue[]) => {
    setStatusFilter(next)
    table.getColumn("status")?.setFilterValue(next.length === 0 ? undefined : next)
  // table is defined below; the closure captures the latest reference each render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Toggle one status in or out of the multi-select filter (funnel card click). */
  const toggleStatus = useCallback((status: CompanyStatusFilterValue) => {
    setStatusFilter((prev) => {
      const next = prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
      table.getColumn("status")?.setFilterValue(next.length === 0 ? undefined : next)
      return next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [removeOwnerCompany, setRemoveOwnerCompany] = useState<AdminCompanyRow | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingStatusAction | null>(null)
  // Compact status dropdown at the click position (same list as the
  // row menu's hover submenu) — replaced the old Update-status modal.
  const [statusMenu, setStatusMenu] = useState<{ company: AdminCompanyRow; x: number; y: number } | null>(null)
  const [deleteCompany, setDeleteCompany] = useState<AdminCompanyRow | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  // Its own confirm field rather than sharing the company one: they are
  // never open at once, but a half-typed DELETE surviving from one
  // dialog into the other is exactly the kind of thing a type-to-confirm
  // exists to prevent.
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<{ id: string; title: string } | null>(null)
  const [deleteProjectConfirmText, setDeleteProjectConfirmText] = useState("")
  const [changeOwnerCompany, setChangeOwnerCompany] = useState<AdminCompanyRow | null>(null)
  const [changeOwnerEmail, setChangeOwnerEmail] = useState("")
  const [domainVerifyCompany, setDomainVerifyCompany] = useState<AdminCompanyRow | null>(null)
  const [prospectConfirm, setProspectConfirm] = useState<ProspectConfirmState | null>(null)
  const [showStatusGuide, setShowStatusGuide] = useState(false)
  const [isPending, startTransition] = useTransition()

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

  // Direct status set from the row menu's hover submenu. Prospected
  // keeps its eligibility confirm dialog.
  const applyCompanyStatus = (company: AdminCompanyRow, status: CompanyStatus) => {
    if (status === ("prospected" as CompanyStatus)) {
      setProspectConfirm({ candidates: [validateProspectEligibility(company)] })
      return
    }
    startTransition(async () => {
      try {
        const result = await updateCompanyStatusAction({ companyId: company.id, status })
        if (!result.success) {
          toast.error(result.error ?? "Failed to update company status")
          return
        }
        toast.success(`${company.name} status updated to ${STATUS_LABEL[status]}`)
        router.refresh()
      } catch (error) {
        console.error("Failed to update company status", error)
        toast.error("Failed to update company status")
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
          toast.success(`${success} ${success === 1 ? "company" : "companies"} set to Showcased — start the sequence from /admin/sales`)
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

  const handleDeleteProject = () => {
    if (!deleteProjectTarget) return
    startTransition(async () => {
      try {
        const result = await deleteProjectAction({ projectId: deleteProjectTarget.id })
        if (!result.success) {
          const error = "error" in result ? result.error : null
          toast.error("Delete failed", {
            description: typeof error === "object" && error ? error.message : "Unknown error",
          })
          return
        }
        toast.success("Project deleted", { description: `${deleteProjectTarget.title} has been permanently removed.` })
        setDeleteProjectTarget(null)
        setDeleteProjectConfirmText("")
        router.refresh()
      } catch {
        toast.error("Unexpected error while deleting project.")
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

  // Row actions, shared by the "…" button and the company-name
  // trigger so the two menus can never drift apart.
  const renderCompanyMenuItems = (company: AdminCompanyRow) => {
    const publicUrl = company.slug ? `/professionals/${company.slug}` : null
    return (
      <>
        {publicUrl && (
          <DropdownMenuItem asChild>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-xs cursor-pointer">
              View company
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="text-xs cursor-pointer"
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
          <a href={`/dashboard/company?company_id=${company.id}`} target="_blank" rel="noopener noreferrer" className="text-xs cursor-pointer">
            Edit company
          </a>
        </DropdownMenuItem>
        {/* Hover submenu (same two-layer pattern as "Change role"):
            statuses set directly from the dropdown, dotted like the
            project-status menu, current one bold. */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="text-xs">Update status</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-[160px]">
            {COMPANY_STATUS_OPTIONS.map((option) => {
              const isCurrent = company.status === option.value
              // Same eligibility rules as the Update-status dialog —
              // unavailable statuses render inactive, hover title says why.
              const disabledReason = companyStatusDisabledReason(company, option.value)
              return (
                <DropdownMenuItem
                  key={option.value}
                  disabled={isPending || Boolean(disabledReason)}
                  title={disabledReason ?? undefined}
                  className={cn("text-xs cursor-pointer flex items-center gap-1.5", isCurrent && "font-semibold bg-[#f5f5f4]")}
                  onClick={() => { if (!isCurrent) applyCompanyStatus(company, option.value) }}
                >
                  <span className={cn("inline-block h-1.5 w-1.5 rounded-full", option.dotColor, disabledReason && "opacity-40")} />
                  {option.label}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem
          className="text-xs cursor-pointer"
          onClick={() => { setChangeOwnerCompany(company); setChangeOwnerEmail("") }}
        >
          Change owner
        </DropdownMenuItem>
        {company.ownerName && (
          <DropdownMenuItem
            className="text-xs cursor-pointer text-red-600 focus:text-red-600"
            onClick={() => setRemoveOwnerCompany(company)}
          >
            Remove owner
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-xs cursor-pointer text-red-600 focus:text-red-600"
          onClick={() => { setDeleteCompany(company); setDeleteConfirmText("") }}
        >
          Delete
        </DropdownMenuItem>
      </>
    )
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

          const externalSiteRaw = company.website ?? company.domain ?? null
          const externalHref = externalSiteRaw
            ? /^https?:\/\//i.test(externalSiteRaw) ? externalSiteRaw : `https://${externalSiteRaw}`
            : null

          return (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="shrink-0 transition-colors"
                title={company.isFeatured ? "Remove star (featured tier)" : "Star as featured"}
                onClick={async (e) => {
                  e.stopPropagation()
                  const result = await updateCompanyFeaturedAction({ companyId: company.id, isFeatured: !company.isFeatured })
                  if (result.success) {
                    toast.success(company.isFeatured ? "Star removed" : "Starred as featured")
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
                <span className="flex items-center gap-1 min-w-0">
                  {editingName?.id === company.id ? (
                    <input
                      autoFocus
                      className="arco-table-primary border-b border-[#016D75] bg-transparent outline-none min-w-0 flex-1"
                      value={editingName.value}
                      onChange={(e) => setEditingName({ id: company.id, value: e.target.value })}
                      onBlur={async () => {
                        const trimmed = editingName.value.trim()
                        setEditingName(null)
                        if (!trimmed || trimmed === company.name) return
                        const supabase = getBrowserSupabaseClient()
                        const { error } = await supabase.from("companies").update({ name: trimmed } as any).eq("id", company.id)
                        if (error) { toast.error(error.message); return }
                        toast.success("Name updated")
                        router.refresh()
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur()
                        if (e.key === "Escape") setEditingName(null)
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : company.type === "company" ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setEditingName({ id: company.id, value: company.name }) }}
                      className="arco-table-primary arco-table-primary--wrap hover:text-[#016D75] transition-colors text-left cursor-pointer bg-transparent border-none p-0"
                      title="Click to edit name"
                    >
                      {company.name}
                    </button>
                  ) : (
                    <span className="arco-table-primary arco-table-primary--wrap">{company.name}</span>
                  )}
                  {externalHref && (
                    <a
                      href={externalHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 text-[#a2a29f] hover:text-[#016D75] transition-colors"
                      title={externalHref}
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  )}
                </span>
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
          const order: Record<string, number> = { listed: 0, unlisted: 1, created: 2, invited: 3, deactivated: 4 }
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
                setStatusMenu({ company, x: e.clientX, y: e.clientY })
              }}
            >
              <span className={cn("arco-table-status-dot", STATUS_DOT[status] ?? "bg-gray-400")} />
              <span>{STATUS_LABEL[status] ?? status}</span>
            </button>
          )
        },
        filterFn: (row, columnId, filterValue) => {
          // Multi-select: filterValue is an array of statuses (or undefined = no filter).
          if (!filterValue) return true
          if (Array.isArray(filterValue)) {
            if (filterValue.length === 0) return true
            return filterValue.includes(row.original.status)
          }
          // Backwards-compat: single string filter still works (e.g. legacy "all" sentinel).
          if (filterValue === "all") return true
          return row.original.status === filterValue
        },
      },
      {
        id: "users",
        header: "Users",
        cell: ({ row }) => {
          const company = row.original
          // Empty cell for admin-added-but-unclaimed companies: no user
          // has an auth account linked yet. Sales leads never populate
          // this cell — they're filtered out at the page query.
          if (company.contacts.length === 0) {
            return <span className="text-[#c4c4c2]">—</span>
          }
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <ContactsCell
                contacts={company.contacts}
                companyId={company.id}
                companyName={company.name}
                onChangeOwner={() => setChangeOwnerCompany(company)}
                onRefresh={() => router.refresh()}
              />
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
            return <span className="arco-table-secondary">—</span>
          }
          // Owner projects first
          const projects = [...rawProjects].sort((a, b) => Number(b.isProjectOwner) - Number(a.isProjectOwner))
          const visible = projects.slice(0, 1)
          const overflow = projects.length - 1
          const renderProjectMenu = (project: AdminLinkedProject) => {
            const projDot = PROJECT_STATUS_DOT[project.projectStatus] ?? "bg-[#a1a1a0]"
            const contribConfig = projectPillFor(project)
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
                  {/* Same two-layer pattern as the company menu: statuses
                      set directly from a hover submenu. */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="text-xs">Update status</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="min-w-[160px]">
                      {PROJECT_CREDIT_OPTIONS.map((option) => {
                        const isCurrent = projectCreditKey(project) === option.key
                        const disabledReason = creditDisabledReason(project, option)
                        const disabled = Boolean(disabledReason) && !isCurrent
                        return (
                          <DropdownMenuItem
                            key={option.key}
                            disabled={disabled}
                            title={disabledReason ?? undefined}
                            className={cn("text-xs flex items-center gap-1.5", disabled ? "opacity-40" : "cursor-pointer", isCurrent && "font-semibold bg-[#f5f5f4]")}
                            onClick={async () => {
                              if (disabled || isCurrent) return
                              const result = await updateProjectProfessionalStatusAction({
                                projectId: project.id,
                                companyId,
                                status: option.write,
                              })
                              if (result.success) {
                                toast.success(`Status updated to ${option.label}`)
                                router.refresh()
                              } else {
                                toast.error(result.error ?? "Failed to update status")
                              }
                            }}
                          >
                            <span className={cn("inline-block h-1.5 w-1.5 rounded-full", option.dotColor, disabled && "opacity-40")} />
                            {option.label}
                          </DropdownMenuItem>
                        )
                      })}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  {/* Only for projects this company owns. On a row where the
                      company is merely credited, deleting would destroy
                      someone else's project from their neighbour's line —
                      what you want there is to drop the credit, which
                      Update status already does. */}
                  {project.isProjectOwner && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-xs cursor-pointer text-red-600 focus:text-red-600"
                        onClick={() => { setDeleteProjectTarget({ id: project.id, title: project.title }); setDeleteProjectConfirmText("") }}
                      >
                        Delete project
                      </DropdownMenuItem>
                    </>
                  )}
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
                      const cConfig = projectPillFor(project)
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
                            {/* Same two-layer pattern as the company menu: statuses
                                set directly from a hover submenu. */}
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger className="text-xs">Update status</DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="min-w-[160px]">
{PROJECT_CREDIT_OPTIONS.map((option) => {
                                  const isCurrent = projectCreditKey(project) === option.key
                                  const disabledReason = creditDisabledReason(project, option)
                        const disabled = Boolean(disabledReason) && !isCurrent
                                  return (
                                    <DropdownMenuItem
                                      key={option.key}
                                      disabled={disabled}
                                      title={disabledReason ?? undefined}
                                      className={cn("text-xs flex items-center gap-1.5", disabled ? "opacity-40" : "cursor-pointer", isCurrent && "font-semibold bg-[#f5f5f4]")}
                                      onClick={async () => {
                                        if (disabled || isCurrent) return
                                        const result = await updateProjectProfessionalStatusAction({
                                          projectId: project.id,
                                          companyId,
                                          status: option.write,
                                        })
                                        if (result.success) {
                                          toast.success(`Status updated to ${option.label}`)
                                          router.refresh()
                                        } else {
                                          toast.error(result.error ?? "Failed to update status")
                                        }
                                      }}
                                    >
                                      <span className={cn("inline-block h-1.5 w-1.5 rounded-full", option.dotColor, disabled && "opacity-40")} />
                                      {option.label}
                                    </DropdownMenuItem>
                                  )
                                })}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            {project.isProjectOwner && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-xs cursor-pointer text-red-600 focus:text-red-600"
                                  onClick={() => { setDeleteProjectTarget({ id: project.id, title: project.title }); setDeleteProjectConfirmText("") }}
                                >
                                  Delete project
                                </DropdownMenuItem>
                              </>
                            )}
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
        id: "teamCount",
        header: "Professionals",
        // Contributors on projects this company owns — mirrors the
        // Projects table's accepted · invited split.
        accessorFn: (row) => row.teamAccepted,
        enableSorting: true,
        sortingFn: (rowA, rowB) =>
          rowA.original.teamAccepted - rowB.original.teamAccepted
          || rowA.original.teamInvited - rowB.original.teamInvited,
        cell: ({ row }) => {
          const { teamAccepted, teamInvited } = row.original
          if (teamAccepted === 0 && teamInvited === 0) return <span className="arco-table-secondary">—</span>
          return (
            <span title={`${teamAccepted} accepted · ${teamInvited} invited`} className="arco-table-nowrap">
              <span className="arco-table-primary">{teamAccepted}</span>
              {teamInvited > 0 && <span className="arco-table-secondary"> · {teamInvited} invited</span>}
            </span>
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
        accessorKey: "channel",
        header: "Channel",
        enableSorting: true,
        cell: ({ row }) => {
          const value = row.original.channel
          return <span>{CHANNEL_LABEL[value] ?? value}</span>
        },
      },
      {
        accessorKey: "seoImpressions28d",
        header: "Impressions",
        // Indexed-with-0-impressions sorts ABOVE "Not indexed" (-2) and
        // pending "—" rows (-1) — mirrors the projects table.
        sortingFn: (rowA, rowB) => {
          const rank = (r: AdminCompanyRow) =>
            r.seoIndexed === false ? -2 : r.seoImpressions28d ?? -1
          return rank(rowA.original) - rank(rowB.original)
        },
        cell: ({ row }) => {
          const r = row.original
          if (r.seoIndexed === false) {
            return <span className="arco-table-secondary" title={r.seoIndexationState ?? undefined}>Not indexed</span>
          }
          if (r.seoImpressions28d == null) return <span className="arco-table-secondary">—</span>
          return <span className="arco-table-primary">{r.seoImpressions28d.toLocaleString()}</span>
        },
      },
      {
        accessorKey: "seoClicks28d",
        header: "Clicks",
        sortingFn: (rowA, rowB) =>
          (rowA.original.seoClicks28d ?? -1) - (rowB.original.seoClicks28d ?? -1),
        cell: ({ row }) => {
          const r = row.original
          if (r.seoIndexed === false || r.seoClicks28d == null) {
            return <span className="arco-table-secondary">—</span>
          }
          return <span className="arco-table-primary">{r.seoClicks28d.toLocaleString()}</span>
        },
      },
      {
        accessorKey: "seoCtr28d",
        header: "CTR",
        sortingFn: (rowA, rowB) =>
          (rowA.original.seoCtr28d ?? -1) - (rowB.original.seoCtr28d ?? -1),
        cell: ({ row }) => {
          const r = row.original
          if (r.seoIndexed === false || r.seoCtr28d == null) {
            return <span className="arco-table-secondary">—</span>
          }
          return <span className="arco-table-primary">{r.seoCtr28d.toFixed(1)}%</span>
        },
      },
      // The "…" actions column is gone: the row itself opens the same
      // menu at the click position, so the button was a second door to
      // the same room.
    ]
  // editingName is read inside the name cell, so the column defs must
  // rebuild when it changes — otherwise the cell closes over a stale
  // null and the inline input never appears.
  }, [isPending, editingName, router])

  const table = useReactTable({
    data: filteredData,
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

  const totalCompanies = baseRows.filter((r) => r.status !== "invited").length
  const totalInvites = baseRows.filter((r) => r.status === "invited").length
  const filteredRows = table.getFilteredRowModel().rows
  const filteredCompanies = filteredRows.filter((r) => r.original.status !== "invited").length
  const filteredInvites = filteredRows.filter((r) => r.original.status === "invited").length
  const isFiltered = columnFilters.length > 0 || table.getState().globalFilter

  // Status funnel: Added → Showcased → Created → Listed → Unlisted, with
  // Deactivated as the off-path leak (analogous to Rejected on the projects
  // funnel). Invited is excluded from CR math — invited companies come in
  // via project credits, not the sales funnel.
  //
  // Counts come from the currently-visible cohort, narrowed by every
  // filter EXCEPT status. Status is excluded because the funnel cards
  // are themselves the status filter; counting only the active stage
  // would zero out every other card and make the funnel unusable as a
  // toggle. Source + search apply here so the cards reflect "conversion
  // for the currently-selected slice."
  const funnelData = filteredData.filter((row) => {
    if (!searchTerm) return true
    const lowered = searchTerm.toLowerCase()
    const haystack = [
      row.name,
      row.domain ?? "",
      row.ownerEmail ?? "",
      ...row.services,
    ].join(" ").toLowerCase()
    return haystack.includes(lowered)
  })
  const companyStatusCounts: Record<string, number> = {}
  for (const c of funnelData) {
    companyStatusCounts[c.status] = (companyStatusCounts[c.status] ?? 0) + 1
  }
  type Driver = "prospect" | "acquisition" | "retention" | "monetization" | null
  // Main row runs Added → … → Listed → Subscribed. Unlisted and
  // Deactivated are NOT stages: unlisted parks under Listed, and
  // deactivation is an off-ramp, not a destination — both render as
  // small cards under the retention zone.
  const COMPANY_FUNNEL: { status: CompanyStatus | "invited" | "subscribed"; dotColor: string; driver: Driver }[] = [
    { status: "added" as CompanyStatus,       dotColor: "#dc2626", driver: "prospect" },
    { status: "prospected" as CompanyStatus,  dotColor: "#f59e0b", driver: "prospect" },
    { status: "invited",                       dotColor: "#f59e0b", driver: "prospect" },
    { status: "verified" as CompanyStatus,     dotColor: "#2563eb", driver: "acquisition" },
    { status: "owned" as CompanyStatus,        dotColor: "#2563eb", driver: "acquisition" },
    { status: "listed",                        dotColor: "#7c3aed", driver: "retention" },
    { status: "subscribed",                    dotColor: "#0f766e", driver: "monetization" },
  ]
  // Display label appears above the first card of each driver group.
  const DRIVER_LABEL_AT: Record<string, string> = {
    // Prospect label sits on Showcased, not Added: Added is the parked
    // pre-stage (shells, photographers) — the prospect WORK starts at
    // the showcase.
    prospect: "prospected",
    acquisition: "verified",
    retention: "listed",
    monetization: "subscribed",
  }
  const DRIVER_COLORS: Record<string, string> = {
    prospect: "#f59e0b",
    acquisition: "#2563eb",
    retention: "#7c3aed",
    // Same green as the dashboard's monetization driver.
    monetization: "#0f766e",
  }
  // "subscribed" has no data source yet — subscription billing isn't
  // wired. The card shows 0 until it is.
  const companyCountAt = (status: string) => status === "subscribed" ? 0 : (companyStatusCounts[status] ?? 0)
  // Each cohort represents "everything currently in or past this stage on
  // the linear flow". Deactivated is a terminal leak so it doesn't
  // accumulate forward.
  const companyCohortFor = (status: string): number => {
    const owned = () => companyCountAt("owned") + companyCountAt("created")
    switch (status) {
      case "added":
        return companyCountAt("added") + companyCountAt("prospected") + companyCountAt("invited") + companyCountAt("verified") + owned() + companyCountAt("listed") + companyCountAt("unlisted")
      case "prospected":
        return companyCountAt("prospected") + companyCountAt("verified") + owned() + companyCountAt("listed") + companyCountAt("unlisted")
      case "invited":
        return companyCountAt("invited") + companyCountAt("listed") + companyCountAt("unlisted")
      case "verified":
        return companyCountAt("verified") + owned() + companyCountAt("listed") + companyCountAt("unlisted")
      case "owned":
        return owned() + companyCountAt("listed") + companyCountAt("unlisted")
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
    // min-w-0 + max-w-full: correct flex shrinking. `overflow-hidden`
    // was removed because it was suppressing .arco-table-wrap's own
    // horizontal scroll on mobile — the table appeared to bleed off
    // the viewport instead of scrolling within its container.
    // admin/layout's `overflow-x-clip` on <main> still catches any
    // rogue overflow at the page level.
    <>
      {/* Sticky workbench bar — title, search, filters, primary CTA;
          the component wraps its own content (page renders it full-bleed). */}
      <AdminTabs
        title="Companies"
        actions={
          <>
          <div className="relative shrink-0" style={{ width: 260 }}>
            <input
              type="text"
              placeholder="Search by company, domain, or owner…"
              value={searchTerm}
              onChange={(event) => {
                const value = event.target.value
                setSearchTerm(value)
                table.getColumn("name")?.setFilterValue(value)
              }}
              className="w-full h-9 pl-8 pr-8 text-xs border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#a1a1a0] transition-colors"
            />
            <svg className="absolute left-2.5 top-2.5 text-[#a1a1a0]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {searchTerm && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => { setSearchTerm(""); table.getColumn("name")?.setFilterValue("") }}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-[3px] text-[#a1a1a0] hover:text-[#1c1c1a] transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            )}
          </div>
          {/* Multi-select status filter — checkbox items in a dropdown menu.
              Empty selection = all statuses (no filter). Synced with the
              funnel cards above. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`w-[140px] h-9 px-3 text-xs border rounded-[3px] transition-colors flex items-center justify-between gap-2 shrink-0 ${
                  statusFilter.length > 0
                    ? "border-[#1c1c1a] bg-[#fafaf9]"
                    : "border-[#e5e5e4] bg-white hover:border-[#a1a1a0]"
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  {statusFilter.length === 0 ? (
                    <span className="text-[#6b6b68]">All statuses</span>
                  ) : statusFilter.length === 1 ? (
                    <>
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[statusFilter[0]]}`} />
                      <span className="truncate">{STATUS_LABEL[statusFilter[0]]}</span>
                    </>
                  ) : (
                    <span>{statusFilter.length} statuses</span>
                  )}
                </span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-[#a1a1a0]">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[180px] z-[120]">
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault()
                  if (statusFilter.length > 0) applyStatusFilter([])
                }}
                className="text-xs"
              >
                Clear selection
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {(["subscribed", "listed", "unlisted", "owned", "verified", "invited", "prospected", "added", "deactivated"] as CompanyStatusFilterValue[]).map((s) => (
                <DropdownMenuCheckboxItem
                  key={s}
                  checked={statusFilter.includes(s)}
                  onCheckedChange={() => toggleStatus(s)}
                  onSelect={(e) => e.preventDefault()}
                  className="text-xs"
                >
                  <span className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[s]}`} />
                    {STATUS_LABEL[s]}
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Multi-select source filter. Same shape as the status dropdown.
              Empty selection = all sources (no filter). Excludes synthetic
              invite-type rows when any source is selected (those have no
              company.source). */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`w-[140px] h-9 px-3 text-xs border rounded-[3px] transition-colors flex items-center justify-between gap-2 shrink-0 ${
                  channelFilter.length > 0
                    ? "border-[#1c1c1a] bg-[#fafaf9]"
                    : "border-[#e5e5e4] bg-white hover:border-[#a1a1a0]"
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  {channelFilter.length === 0 ? (
                    <span className="text-[#6b6b68]">All channels</span>
                  ) : channelFilter.length === 1 ? (
                    <span className="truncate">{CHANNEL_LABEL[channelFilter[0]]}</span>
                  ) : (
                    <span>{channelFilter.length} channels</span>
                  )}
                </span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-[#a1a1a0]">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[180px] z-[120]">
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault()
                  if (channelFilter.length > 0) setChannelFilter([])
                }}
                className="text-xs"
              >
                Clear selection
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {CHANNEL_VALUES.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c}
                  checked={channelFilter.includes(c)}
                  onCheckedChange={() => toggleChannel(c)}
                  onSelect={(e) => e.preventDefault()}
                  className="text-xs"
                >
                  {CHANNEL_LABEL[c]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Multi-select service filter. Category list comes from
              the categories table (only is_active=true is loaded on
              the server). Matches on primary or any offered service. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`w-[140px] h-9 px-3 text-xs border rounded-[3px] transition-colors flex items-center justify-between gap-2 shrink-0 ${
                  serviceFilter.length > 0
                    ? "border-[#1c1c1a] bg-[#fafaf9]"
                    : "border-[#e5e5e4] bg-white hover:border-[#a1a1a0]"
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  {serviceFilter.length === 0 ? (
                    <span className="text-[#6b6b68]">All services</span>
                  ) : serviceFilter.length === 1 ? (
                    <span className="truncate">
                      {serviceOptions.find((s) => s.id === serviceFilter[0])?.name ?? "1 service"}
                    </span>
                  ) : (
                    <span>{serviceFilter.length} services</span>
                  )}
                </span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-[#a1a1a0]">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[240px] max-h-[420px] overflow-y-auto">
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault()
                  if (serviceFilter.length > 0) setServiceFilter([])
                }}
                className="text-xs"
              >
                Clear selection
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {serviceGroups.parents.map((group) => {
                const children = serviceGroups.childrenByParent.get(group.id) ?? []
                if (children.length === 0) return null
                const childIds = children.map((c) => c.id)
                const selectedCount = childIds.filter((id) => serviceFilter.includes(id)).length
                const groupChecked: boolean | "indeterminate" =
                  selectedCount === 0 ? false : selectedCount === childIds.length ? true : "indeterminate"
                return (
                  <div key={group.id} className="py-0.5">
                    <DropdownMenuCheckboxItem
                      checked={groupChecked}
                      onCheckedChange={(next) => setServicesForGroup(childIds, next === true)}
                      onSelect={(e) => e.preventDefault()}
                      className="text-xs font-medium"
                    >
                      {group.name}
                    </DropdownMenuCheckboxItem>
                    {children.map((s) => (
                      <DropdownMenuCheckboxItem
                        key={s.id}
                        checked={serviceFilter.includes(s.id)}
                        onCheckedChange={() => toggleService(s.id)}
                        onSelect={(e) => e.preventDefault()}
                        className="text-xs pl-8"
                      >
                        {s.name}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </div>
                )
              })}
              {serviceGroups.orphans.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  {serviceGroups.orphans.map((s) => (
                    <DropdownMenuCheckboxItem
                      key={s.id}
                      checked={serviceFilter.includes(s.id)}
                      onCheckedChange={() => toggleService(s.id)}
                      onSelect={(e) => e.preventDefault()}
                      className="text-xs"
                    >
                      {s.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            className="btn-tertiary shrink-0"
            style={{ fontSize: 13, padding: "6px 16px", borderRadius: 3 }}
            onClick={() => setShowAddClaimable(true)}
          >
            Add company
          </button>
          <button
            type="button"
            className="btn-primary shrink-0"
            style={{ fontSize: 13, padding: "6px 16px", borderRadius: 3 }}
            onClick={() => setShowAddModal(true)}
          >
            Add showcase
          </button>
          </>
        }
      />

      {/* Status guide — floats in the gap under the sticky bar, same
          treatment as the tour-replay link on company edit. */}
      <div className="wrap" style={{ position: "relative", height: 0 }}>
        <div className="absolute right-5 md:right-[60px] flex items-center gap-4" style={{ top: 12 }}>
          <button
            type="button"
            onClick={() => setShowPhotographers((v) => !v)}
            className="arco-text-link"
            style={{ fontSize: 12, color: "#a1a1a0" }}
          >
            {showPhotographers ? "Hide photographers" : "Show photographers"}
          </button>
          <button
            type="button"
            onClick={() => setShowManual((v) => !v)}
            className="arco-text-link"
            style={{ fontSize: 12, color: "#a1a1a0" }}
          >
            {showManual ? "Hide manual" : "Show manual"}
          </button>
          <button
            type="button"
            onClick={() => setShowStatusGuide(true)}
            className="arco-text-link arco-text-link--primary"
            style={{ fontSize: 12 }}
          >
            Status guide
          </button>
        </div>
      </div>

      <div className="wrap" style={{ paddingTop: 52, paddingBottom: 48 }}>

    <div className="space-y-6 w-full">


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
                { dot: "bg-[#2563eb]", label: "Owned", desc: "Owned by an Arco user, never listed yet. Owner is setting up their profile.", specs: "Owner assigned · Not visible · Setup in progress" },
                { dot: "bg-[#2563eb]", label: "Verified", desc: "Identity proven (invite delivery or domain code) and company details confirmed — the claim is not completed yet. Signup is a separate event.", specs: "No owner · Not visible · Claim in progress" },
                { dot: "bg-amber-500", label: "Invited", desc: "Credited by another professional on a project. Auto-created, not yet claimed.", specs: "No owner · Created from project invite" },
                { dot: "bg-[#f59e0b]", label: "Showcased", desc: "Live showcase page on the marketplace, awaiting claim by the pro. Public and in the sales funnel.", specs: "No owner · Visible · Sales emails sent · In sales funnel" },
                { dot: "bg-[#dc2626]", label: "Added", desc: "Catalogued — Apollo bulk import, manual add, or photographer import. No outreach yet. Awaiting promotion to a showcase (→ Showcased) or claim (→ Created).", specs: "No owner · Not visible · Awaiting outreach or claim" },
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
              <strong>Flow:</strong> Added → Showcased (sales emails) → Created (claimed) → Listed (live)
              <br />
              <strong>Constraints:</strong> Companies without an owner cannot be set to Listed or Unlisted. Claimed companies cannot be set to Invited, Showcased or Added.
            </div>
          </div>
        </div>
      )}

      <AdminAddCompanyModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
      <AdminAddClaimableCompanyModal isOpen={showAddClaimable} onClose={() => setShowAddClaimable(false)} />

      {/* Status funnel — same visual pattern as /admin/projects, plus a
          bypass line from Created → Listed (survival rate, skipping the
          Deactivated leak). */}
      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
        {(() => {
          const cols = COMPANY_FUNNEL.map((_, i) => i === 0 ? "auto" : "1fr auto").join(" ")
          const CARD_WIDTH = 132

          // Bypass rate: Prospected → Created, skipping the Invited
          // column since Invited is a parallel entry point (credit
          // path) rather than a sequential stop in the sales funnel.
          const prospectedToDraft = companyConversionRate(
            companyCohortFor("prospected"),
            companyCohortFor("verified"),
          )

          // Invited → Created: an honest rate needs PROVENANCE, not the
          // stage cohorts (those counted listed/unlisted on both sides
          // and rendered a fake 100% at zero conversions). Denominator:
          // everything that ENTERED via a project credit — pending
          // invite rows plus claimed companies whose source is
          // 'invited'. Numerator: the claimed subset.
          // Photographers are invite-channel by construction but follow
          // their own assigned-role path (no claim funnel yet) and are
          // largely parked at Added — counting them buried the real
          // invited-professionals conversion under a photographer pile.
          const inviteOrigin = funnelData.filter((r) => r.channel === "invite" && !r.isPhotographer)
          const inviteOriginClaimed = inviteOrigin.filter(
            (r) => ["verified", "owned", "created", "listed", "unlisted"].includes(r.status),
          ).length
          const invitedToCreated = inviteOrigin.length > 0
            ? `${Math.round((inviteOriginClaimed / inviteOrigin.length) * 100)}%`
            : ""

          // Grid columns (1-indexed, odd = card, even = connector):
          //   1 added · 3 showcased · 5 invited · 7 verified · 9 owned ·
          //   11 listed · 13 subscribed. Row 3: bypass arc (3→8) +
          //   unsubscribe arc (11→14). Row 4: parked cards under Listed.
          return (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: cols,
                gridTemplateRows: "auto auto auto auto",
                gap: 0,
                alignItems: "start",
              }}
            >
              {/* Unsubscribe arc — Subscribed back to Listed, onderlangs
                  (row 3, cols 11 → 14). No billing data yet, so the
                  label shows the metric name without a rate. */}
              <div
                style={{
                  gridRow: 3,
                  gridColumn: "11 / 14",
                  position: "relative",
                  height: 32,
                }}
              >
                <div style={{ position: "absolute", left: CARD_WIDTH / 2, top: 0, height: "50%", borderLeft: "1px solid #d4d4d3" }} />
                <div style={{ position: "absolute", right: CARD_WIDTH / 2, top: 0, height: "50%", borderLeft: "1px solid #d4d4d3" }} />
                <div style={{ position: "absolute", left: CARD_WIDTH / 2, right: CARD_WIDTH / 2, top: "50%", borderTop: "1px solid #d4d4d3" }} />
                <span
                  className="absolute text-[10px] font-medium text-[#6b6b68]"
                  style={{ bottom: 0, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", background: "#fff", padding: "0 6px" }}
                >
                  Unsubscribed —
                </span>
              </div>

              {/* Parked end-states (row 4): Unlisted under Listed;
                  Deactivated far left under Added — both connector-less;
                  they're parks/off-ramps, not steps. */}
              {([
                { status: "unlisted" as CompanyStatus, label: "Unlisted", dot: "#a1a1a0", col: 11 },
                { status: "deactivated" as CompanyStatus, label: "Deactivated", dot: "#dc2626", col: 1 },
              ]).map((sub) => {
                const subActive = statusFilter.includes(sub.status as CompanyStatusFilterValue)
                return (
                  <div key={sub.status} style={{ gridRow: 4, gridColumn: sub.col, display: "flex", flexDirection: "column" }}>
                    <div style={{ height: 6 }} />
                    <button
                      type="button"
                      onClick={() => toggleStatus(sub.status as CompanyStatusFilterValue)}
                      className={`rounded-[3px] border bg-white px-3 py-1.5 transition-colors hover:border-[#c4c4c2] flex items-center gap-[6px] ${subActive ? "border-[#1c1c1a] bg-[#fafaf9]" : "border-[#e5e5e4]"}`}
                      style={{ width: CARD_WIDTH }}
                    >
                      <span className="status-pill-dot shrink-0" style={{ background: sub.dot }} />
                      <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 400, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{sub.label}</span>
                      <span className="text-xs ml-auto" style={{ color: "var(--text-primary)" }}>{companyCountAt(sub.status)}</span>
                    </button>
                  </div>
                )
              })}

              {/* Bypass arc — Prospected → Draft (row 3, below cards),
                  spans cols 3 → 8. */}
              <div
                style={{
                  gridRow: 3,
                  gridColumn: "3 / 8",
                  position: "relative",
                  height: 32,
                }}
              >
                <div style={{ position: "absolute", left: CARD_WIDTH / 2, top: 0, height: "50%", borderLeft: "1px solid #d4d4d3" }} />
                <div style={{ position: "absolute", right: CARD_WIDTH / 2, top: 0, height: "50%", borderLeft: "1px solid #d4d4d3" }} />
                <div style={{ position: "absolute", left: CARD_WIDTH / 2, right: CARD_WIDTH / 2, top: "50%", borderTop: "1px solid #d4d4d3" }} />
                {prospectedToDraft && (
                  <span
                    className="absolute text-[10px] font-medium text-[#6b6b68]"
                    style={{ bottom: 0, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", background: "#fff", padding: "0 6px" }}
                  >
                    {prospectedToDraft}
                  </span>
                )}
              </div>

              {/* Driver labels — row 1, one per driver group at its first card */}
              {COMPANY_FUNNEL.map((stage, i) => {
                if (!stage.driver) return null
                if (DRIVER_LABEL_AT[stage.driver] !== stage.status) return null
                // Card columns are odd-indexed in the grid (1-based):
                // card 0 sits at col 1, card 1 at col 3, etc.
                const cardCol = i * 2 + 1
                return (
                  <p
                    key={`driver-${stage.status}`}
                    className="arco-eyebrow"
                    style={{
                      gridRow: 1,
                      gridColumn: cardCol,
                      color: DRIVER_COLORS[stage.driver],
                      marginBottom: 8,
                    }}
                  >
                    {stage.driver.charAt(0).toUpperCase() + stage.driver.slice(1)}
                  </p>
                )
              })}

              {/* Cards + inline connectors — row 2 */}
              {COMPANY_FUNNEL.map((stage, i) => {
                const count = companyCountAt(stage.status)
                const label = stage.status === "invited" ? "Invited"
                  : stage.status === "subscribed" ? "Subscribed"
                  : companyStatusLabel(stage.status)

                // Inline connector rate before this card. Sequential hops:
                // Added→Prospected, Draft→Listed. Prospected→Invited is a
                // parallel-entry hop (plain line, no rate); the bypass arc
                // covers Prospected→Draft. Invited→Created carries the
                // PROVENANCE rate (invite-origin claimed ÷ invite-origin
                // total) — the stage cohorts lied here, see
                // invitedToCreated above. Listed→Unlisted and
                // Unlisted→Deactivated are leaks, not conversions.
                let rate = ""
                let suppressConnector = false
                if (i > 0) {
                  const prev = COMPANY_FUNNEL[i - 1].status
                  const show =
                    (prev === "added" && stage.status === "prospected") ||
                    (prev === "verified" && stage.status === "owned") ||
                    (prev === "owned" && stage.status === "listed")
                  if (show) {
                    rate = companyConversionRate(companyCohortFor(prev), companyCohortFor(stage.status))
                  }
                  if (prev === "invited" && stage.status === "verified") {
                    rate = invitedToCreated
                  }
                  if (prev === "prospected" && stage.status === "invited") {
                    suppressConnector = true
                  }
                }

                const isActive = stage.status !== "subscribed" && statusFilter.includes(stage.status as CompanyStatusFilterValue)
                return (
                  <Fragment key={stage.status}>
                    {i > 0 && (
                      <div
                        className="relative px-1 self-center"
                        style={{ gridRow: 2, minWidth: 32 }}
                      >
                        {!suppressConnector && <div className="w-full border-t border-[#d4d4d3]" />}
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
                    <div style={{ gridRow: 2 }} className="flex flex-col">
                      <button
                        type="button"
                        disabled={stage.status === "subscribed"}
                        title={stage.status === "subscribed" ? "Subscription billing not live yet" : undefined}
                        onClick={() => stage.status !== "subscribed" && toggleStatus(stage.status as CompanyStatusFilterValue)}
                        className={`rounded-[3px] border bg-white px-3 py-3 transition-colors hover:border-[#c4c4c2] ${isActive ? "border-[#1c1c1a] bg-[#fafaf9]" : "border-[#e5e5e4]"}`}
                        style={{ width: CARD_WIDTH, cursor: stage.status === "subscribed" ? "default" : undefined }}
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
                  {(["listed", "unlisted", "created", "prospected", "added", "deactivated"] as const).map((s) => (
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

      {/* Count — directly above the table, margins as on Users */}
      <div className="discover-results-meta" style={{ marginBottom: 0 }}>
        <p className="discover-results-count">
          {isFiltered ? (
            <>
              <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>{filteredCompanies}</strong> of {totalCompanies} {totalCompanies === 1 ? "company" : "companies"}
            </>
          ) : (
            <>
              <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>{totalCompanies}</strong> {totalCompanies === 1 ? "company" : "companies"}
            </>
          )}
        </p>
      </div>

      {/* Table */}
      <div className="arco-table-wrap" style={{ marginTop: 16 }}>
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
                <tr
                  key={row.id}
                  onClick={(e) => {
                    if (row.original.type === "invite") return
                    if ((e.target as HTMLElement).closest("button, a, input, select, textarea, [role='menuitem']")) return
                    setRowMenu({ id: row.original.id, x: e.clientX, y: e.clientY })
                  }}
                  style={row.original.type === "invite" ? undefined : { cursor: "pointer" }}
                >
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

      {/* Floating row menu — anchored to an invisible fixed point at
          the click position, so opening a row doesn't jump the eye to
          the far-right "…" column. Shared items with that button. */}
      {(() => {
        const company = rowMenu ? data.find((c) => c.id === rowMenu.id) ?? null : null
        return (
          <DropdownMenu
            open={Boolean(rowMenu && company)}
            onOpenChange={(open) => { if (!open) setRowMenu(null) }}
          >
            <DropdownMenuTrigger asChild>
              <span
                aria-hidden
                style={{ position: "fixed", left: rowMenu?.x ?? 0, top: rowMenu?.y ?? 0, width: 0, height: 0, padding: 0, margin: 0 }}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {company && renderCompanyMenuItems(company)}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      })()}

      {/* Compact status dropdown at the click position — the small
          dotted list from the hover submenu, direct apply, unavailable
          statuses inactive with the reason as hover title. */}
      {(() => {
        const company = statusMenu?.company ?? null
        return (
          <DropdownMenu open={Boolean(statusMenu)} onOpenChange={(open) => { if (!open) setStatusMenu(null) }}>
            <DropdownMenuTrigger asChild>
              <span aria-hidden style={{ position: "fixed", left: statusMenu?.x ?? 0, top: statusMenu?.y ?? 0, width: 0, height: 0 }} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[160px]">
              {company && COMPANY_STATUS_OPTIONS.map((option) => {
                const isCurrent = company.status === option.value
                const disabledReason = companyStatusDisabledReason(company, option.value)
                return (
                  <DropdownMenuItem
                    key={option.value}
                    disabled={isPending || Boolean(disabledReason)}
                    title={disabledReason ?? undefined}
                    className={cn("text-xs cursor-pointer flex items-center gap-1.5", isCurrent && "font-semibold bg-[#f5f5f4]")}
                    onClick={() => { if (!isCurrent) applyCompanyStatus(company, option.value) }}
                  >
                    <span className={cn("inline-block h-1.5 w-1.5 rounded-full", option.dotColor, disabledReason && "opacity-40")} />
                    {option.label}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      })()}

      {/* Load more — replaces the previous Previous/Next pagination.
          Shows total loaded vs total matched; button hidden when the
          full result set is already on screen. */}
      {(() => {
        const total = table.getFilteredRowModel().rows.length
        const visible = Math.min(pagination.pageSize, total)
        const canLoadMore = visible < total
        return (
          <div className="arco-table-pagination">
            <span className="arco-table-pagination-count">
              {visible} of {total} {total === 1 ? "result" : "results"}
            </span>
            {canLoadMore && (
              <div className="flex justify-center mt-3 w-full">
                <button
                  className="h-9 px-6 text-xs font-medium border border-[#e5e5e4] rounded-[3px] text-[#6b6b68] hover:bg-[#fafaf9] transition-colors"
                  onClick={() => setPagination((p) => ({ ...p, pageIndex: 0, pageSize: p.pageSize + LOAD_MORE_STEP }))}
                >
                  Load more
                </button>
              </div>
            )}
          </div>
        )
      })()}

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

      {/* Delete a project straight from the company row. Same
          type-to-confirm as deleting a company: the cost of a slip is
          the same, so the ceremony is too. */}
      {deleteProjectTarget && (
        <div className="popup-overlay" onClick={() => { if (!isPending) { setDeleteProjectTarget(null); setDeleteProjectConfirmText("") } }}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Delete project</h3>
              <button
                type="button"
                className="popup-close"
                onClick={() => { if (!isPending) { setDeleteProjectTarget(null); setDeleteProjectConfirmText("") } }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="pb-3">
              <p className="text-sm font-medium text-[#1c1c1a] mb-0.5">{deleteProjectTarget.title}</p>

              <div className="arco-alert arco-alert--warn">
                <AlertTriangle className="arco-alert-icon" />
                <div>
                  <p>This will permanently delete <strong>{deleteProjectTarget.title}</strong> and all associated data (photos, contributors, taxonomy). This action cannot be undone.</p>
                </div>
              </div>

              <div className="pt-1">
                <label className="text-xs text-[#6b6b68] mb-1 block">
                  Type <span className="font-medium text-[#1c1c1a]">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteProjectConfirmText}
                  onChange={(e) => setDeleteProjectConfirmText(e.target.value)}
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
                onClick={() => { setDeleteProjectTarget(null); setDeleteProjectConfirmText("") }}
                disabled={isPending}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleDeleteProject}
                disabled={isPending || deleteProjectConfirmText !== "DELETE"}
                style={{ flex: 1, backgroundColor: deleteProjectConfirmText === "DELETE" ? "#dc2626" : undefined, borderColor: deleteProjectConfirmText === "DELETE" ? "#dc2626" : undefined, color: deleteProjectConfirmText === "DELETE" ? "#fff" : undefined }}
              >
                {isPending ? "Deleting…" : "Delete project"}
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

            <div className="pb-3">
              <p className="text-sm font-medium text-[#1c1c1a] mb-0.5">{deleteCompany.name}</p>

              <div className="arco-alert arco-alert--warn">
                <AlertTriangle className="arco-alert-icon" />
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
      {prospectConfirm && (() => {
        const eligible = prospectConfirm.candidates.filter((c) => c.eligible)
        const ineligible = prospectConfirm.candidates.filter((c) => !c.eligible)
        return (
          <div className="popup-overlay" onClick={() => setProspectConfirm(null)}>
            <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
              <div className="popup-header">
                <h3 className="arco-section-title">Set to Showcased</h3>
                <button type="button" className="popup-close" onClick={() => setProspectConfirm(null)} aria-label="Close">
                  ✕
                </button>
              </div>

              <div style={{ fontSize: 13, color: "#44403c", marginBottom: 16, lineHeight: 1.5 }}>
                Showcase sequence can be started on Sales.
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
                  {isPending ? "Updating…" : `Move to Showcased`}
                </button>
              </div>
            </div>
          </div>
        )
      })()}


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
              <div className="arco-alert arco-alert--warn">
                <AlertTriangle className="arco-alert-icon" />
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

      <ContactCard email={contactParam.email} onClose={contactParam.close} />
    </div>

      </div>
    </>
  )
}
