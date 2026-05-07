"use client"

import { Fragment, useEffect, useRef, useState, useTransition, useCallback } from "react"
import { toast } from "sonner"
import {
  fetchSalesCompanies,
  fetchProspectById,
  fetchProspectEvents,
  fetchLatestApolloSyncRuns,
  startProspectSequence,
  pauseProspectSequence,
  resumeProspectSequence,
  restartProspectSequence,
  finishProspectSequence,
  removeProspectFromFunnel,
  updateProspectEmail,
  getProspectSequence,
  getProspectInviteContext,
  syncResendEmailStats,
  type Prospect,
  type ProspectEvent,
  type ProspectSequenceStep,
  type ProspectStatus,
  type ProspectInviteContext,
  type SalesCompanyRow,
  type SalesContact,
  type SalesFunnel,
  type SalesSortBy,
  type SalesSortDir,
  type SequenceStatus,
} from "./actions"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from "lucide-react"
import { clickedRateColor, deliveredRateColor, openedRateColor } from "@/lib/email-rate-colors"

// -- Status config -----------------------------------------------------------

const STATUS_CONFIG: Record<ProspectStatus, { label: string; cls: string; dot: string }> = {
  prospect: { label: "Prospect", cls: "bg-amber-50 text-amber-700", dot: "bg-[#f59e0b]" },
  contacted: { label: "Contacted", cls: "bg-amber-50 text-amber-700", dot: "bg-[#f59e0b]" },
  visitor: { label: "Visitor", cls: "bg-blue-50 text-blue-700", dot: "bg-[#2563eb]" },
  signup: { label: "Signup", cls: "bg-blue-50 text-blue-700", dot: "bg-[#2563eb]" },
  company: { label: "Draft", cls: "bg-blue-50 text-blue-700", dot: "bg-[#2563eb]" },
  active: { label: "Listed", cls: "bg-purple-50 text-purple-800 font-semibold", dot: "bg-[#7c3aed]" },
  // Removed never renders in the funnel — the row hides any contact with this
  // status, and the company row drops entirely if every contact is removed.
  // Kept here so per-contact rendering doesn't crash if a stray row slips in.
  removed: { label: "Removed", cls: "bg-gray-50 text-gray-500", dot: "bg-[#a1a1a0]" },
}

// Statuses surfaced in the multi-select status filter. 'removed' is a soft-
// delete marker — admin doesn't filter for it, the row is just hidden.
const ALL_STATUSES: ProspectStatus[] = [
  "prospect", "contacted", "visitor", "signup", "company", "active",
]

const SEQUENCE_CONFIG: Record<SequenceStatus, { label: string; dot: string }> = {
  not_started: { label: "Not started", dot: "bg-[#a1a1a0]" },
  active: { label: "Active", dot: "bg-[#2563eb]" },
  paused: { label: "Paused", dot: "bg-amber-400" },
  finished: { label: "Finished", dot: "bg-emerald-500" },
}

// Funnel stages aligned with Growth lifecycle model
const FUNNEL_STAGES: { status: ProspectStatus; label: string; driver: "prospect" | "acquisition" | "retention" }[] = [
  { status: "prospect", label: "Prospect", driver: "prospect" },
  { status: "contacted", label: "Contacted", driver: "prospect" },
  { status: "visitor", label: "Visitor", driver: "acquisition" },
  { status: "signup", label: "Signup", driver: "acquisition" },
  { status: "company", label: "Draft", driver: "acquisition" },
  { status: "active", label: "Listed", driver: "retention" },
]

// First card where each driver label should appear
const DRIVER_LABEL_AT: Record<string, string> = {
  prospect: "prospect",
  acquisition: "visitor",
  retention: "active",
}

const DRIVER_COLORS: Record<string, string> = {
  prospect: "#f59e0b",
  acquisition: "#2563eb",
  retention: "#7c3aed",
}

// Source labels shown in the multi-pill cell. The DB still stores the
// historical source codes ('arco' | 'invites' | 'apollo') — this map
// renders them as their post-Apollo-cutover names: Showcase (we built a
// page + project), Invite (peer-to-peer from another professional), and
// Outreach (cold outbound, formerly run from Apollo).
const SOURCE_LABELS: Record<string, string> = {
  arco: "Showcase",
  invites: "Invite",
  apollo: "Outreach",
  manual: "Manual",
}
const sourceLabel = (s: string): string => SOURCE_LABELS[s] ?? s.charAt(0).toUpperCase() + s.slice(1)

// -- Helpers -----------------------------------------------------------------

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—"
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    })
  } catch { return dateStr }
}

function formatDateShort(dateStr: string | null) {
  if (!dateStr) return "—"
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
  } catch { return dateStr }
}

/** Human-friendly "5m ago" / "2h ago" / "3d ago" — falls back to formatDateShort beyond 7 days. */
function formatRelativeTime(dateStr: string | null) {
  if (!dateStr) return "never"
  try {
    const ms = Date.now() - new Date(dateStr).getTime()
    if (ms < 0) return "just now"
    const m = Math.floor(ms / 60000)
    if (m < 1) return "just now"
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.floor(h / 24)
    if (d < 7) return `${d}d ago`
    return formatDateShort(dateStr)
  } catch { return dateStr }
}

// Map template ids → friendly display names (same labels as the
// Marketing table on /admin/emails). Falls back to humanised slug.
const TEMPLATE_NAMES: Record<string, string> = {
  // Showcase (formerly "prospect-") — we built a page + project, recipient claims.
  "prospect-intro": "Showcase Intro",
  "prospect-followup": "Showcase Follow-up",
  "prospect-final": "Showcase Final",
  // Invite — peer-to-peer from another professional on a real project.
  "new-professional-invite": "Invite Intro",
  "new-professional-followup": "Invite Follow-up",
  "new-professional-final": "Invite Final",
  // Outreach (cold) — formerly run via Apollo, now Arco-controlled.
  "outreach-intro": "Outreach Intro",
  "outreach-followup": "Outreach Follow-up",
  "outreach-final": "Outreach Final",
}
function templateDisplayName(template: string): string {
  if (TEMPLATE_NAMES[template]) return TEMPLATE_NAMES[template]
  return template
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function conversionRate(from: number, to: number): string {
  if (from === 0) return "0%"
  return `${Math.round((to / from) * 100)}%`
}

const EVENT_LABELS: Record<string, string> = {
  status_changed: "Status changed",
  email_sent: "Email sent",
  email_resent: "Email resent",
  sequence_started: "Sequence started",
  sequence_paused: "Sequence paused",
  sequence_resumed: "Sequence resumed",
  sequence_finished: "Sequence finished",
  removed_from_funnel: "Removed from funnel",
  unsubscribed: "Unsubscribed",
  company_invited: "Company invited",
  "prospect.landing_visited": "Visited landing page",
}

function formatEventLabel(type: string): string {
  if (EVENT_LABELS[type]) return EVENT_LABELS[type]
  if (type.startsWith("status_changed_to_")) {
    const to = type.slice("status_changed_to_".length).replace(/_/g, " ")
    return `Status → ${to}`
  }
  return type
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const METADATA_KEY_LABELS: Record<string, string> = {
  template: "Template",
  email: "Email",
  trigger: "Trigger",
  from: "From",
  to: "To",
  reason: "Reason",
  source: "Source",
  status: "Status",
  previous_status: "Previous status",
  new_status: "New status",
}

function formatMetadataKey(key: string): string {
  if (METADATA_KEY_LABELS[key]) return METADATA_KEY_LABELS[key]
  return key
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  return JSON.stringify(value)
}

// -- Event history row -------------------------------------------------------

function EventHistoryRow({ event }: { event: ProspectEvent }) {
  const [open, setOpen] = useState(false)
  const hasMeta = Object.keys(event.metadata ?? {}).length > 0
  const isCompanyInvited = event.event_type === "company_invited"
  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => hasMeta && setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 text-left py-0.5 ${hasMeta ? "cursor-pointer hover:text-[#1c1c1a]" : "cursor-default"}`}
        disabled={!hasMeta}
      >
        <span
          className={`text-[#a1a1a0] inline-block transition-transform ${open ? "rotate-90" : ""}`}
          style={{ width: 8, fontSize: 10 }}
        >
          {hasMeta ? "▶" : ""}
        </span>
        <span className="text-[#a1a1a0] whitespace-nowrap">{formatDateShort(event.created_at)}</span>
        <span className="font-medium text-[#1c1c1a]">{formatEventLabel(event.event_type)}</span>
      </button>
      {open && hasMeta && (
        isCompanyInvited
          ? <CompanyInvitedDetails metadata={event.metadata} />
          : (
            <div className="mt-1 ml-4 flex flex-col gap-0.5 pb-1">
              {Object.entries(event.metadata).map(([key, value]) => (
                <div key={key} className="flex items-baseline gap-2">
                  <span className="text-[#a1a1a0] w-24 shrink-0">{formatMetadataKey(key)}</span>
                  <span className="text-[#6b6b68] break-all">{formatMetadataValue(value)}</span>
                </div>
              ))}
            </div>
          )
      )}
    </div>
  )
}

function CompanyInvitedDetails({ metadata }: { metadata: Record<string, unknown> }) {
  const project = metadata.project as
    | { slug: string | null; title: string | null }
    | null
  const inviter = metadata.inviter as
    | { slug: string | null; name: string | null }
    | null
  return (
    <div className="mt-1 ml-4 flex flex-col gap-0.5 pb-1">
      {project && (
        <div className="flex items-baseline gap-2">
          <span className="text-[#a1a1a0] w-24 shrink-0">Invited on</span>
          {project.slug ? (
            <a
              href={`/projects/${project.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#016D75] hover:underline break-all"
            >
              {project.title || "Untitled project"}
            </a>
          ) : (
            <span className="text-[#6b6b68] break-all">{project.title || "Untitled project"}</span>
          )}
        </div>
      )}
      {inviter && (
        <div className="flex items-baseline gap-2">
          <span className="text-[#a1a1a0] w-24 shrink-0">Invited by</span>
          {inviter.slug ? (
            <a
              href={`/professionals/${inviter.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#016D75] hover:underline break-all"
            >
              {inviter.name}
            </a>
          ) : (
            <span className="text-[#6b6b68] break-all">{inviter.name}</span>
          )}
        </div>
      )}
    </div>
  )
}

// -- Editable email field for arco/invites sources --------------------------

function ProspectEmailField({ prospect, onRefresh }: { prospect: Prospect; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false)
  const [email, setEmail] = useState(prospect.email)
  const isEditable = prospect.source === "arco"

  const handleSave = async () => {
    setEditing(false)
    if (email !== prospect.email && email.includes("@")) {
      const result = await updateProspectEmail(prospect.id, email)
      if (result.success) {
        toast.success("Email updated")
        onRefresh()
      } else {
        toast.error(result.error ?? "Failed to update")
        setEmail(prospect.email)
      }
    } else {
      setEmail(prospect.email)
    }
  }

  if (editing && isEditable) {
    return (
      <input
        autoFocus
        placeholder="email@company.com"
        className="text-xs text-[#1c1c1a] border-b border-[#016D75] bg-transparent outline-none w-full max-w-[200px]"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") { setEmail(prospect.email); setEditing(false) } }}
        onClick={(e) => e.stopPropagation()}
      />
    )
  }

  return (
    <button
      type="button"
      className={`text-xs truncate max-w-[200px] text-left ${isEditable ? "text-[#6b6b68] hover:text-[#1c1c1a] cursor-pointer" : "text-[#a1a1a0] cursor-default"}`}
      onClick={(e) => { if (isEditable) { e.stopPropagation(); setEditing(true) } }}
      title={isEditable ? "Click to edit email" : undefined}
    >
      {email || (isEditable ? <span className="text-[#c4c4c2] italic">Add email...</span> : "—")}
    </button>
  )
}

// -- Component ---------------------------------------------------------------

/**
 * Per-contact data fetched lazily when the company popup opens. Keyed by
 * `prospectId` in the parent's contactDetails map.
 */
type ContactDetailBundle = {
  prospect: Prospect | null
  events: ProspectEvent[]
  sequence: ProspectSequenceStep[]
  locale: "en" | "nl" | null
  inviteContext: ProspectInviteContext | null
}

type ApolloSyncRunSummary = {
  id: string
  kind: "list" | "activity"
  triggeredBy: "manual" | "cron"
  startedAt: string
  finishedAt: string | null
  syncedCount: number | null
  totalCount: number | null
  errorCount: number
  lastError: string | null
  listId: string | null
}

type Props = {
  initialCompanies: SalesCompanyRow[]
  initialTotalCompanies: number
  initialFunnel: SalesFunnel
  initialEmailsSent: number
  currentApolloListId?: string | null
  apolloSyncRuns?: { list: ApolloSyncRunSummary | null; activity: ApolloSyncRunSummary | null }
  apolloProspectsCount?: number
}

export function ProspectsClient({
  initialCompanies,
  initialTotalCompanies,
  initialFunnel,
  initialEmailsSent,
  currentApolloListId = null,
  apolloSyncRuns = { list: null, activity: null },
  apolloProspectsCount = 0,
}: Props) {
  const [companies, setCompanies] = useState(initialCompanies)
  const [totalCompanies, setTotalCompanies] = useState(initialTotalCompanies)
  const [funnel, setFunnel] = useState(initialFunnel)
  const [totalEmailsSent, setTotalEmailsSent] = useState(initialEmailsSent)
  const [statusFilter, setStatusFilter] = useState<ProspectStatus[]>([])
  const [sourceFilter, setSourceFilter] = useState("all")
  const [sequenceFilter, setSequenceFilter] = useState<SequenceStatus | "all">("all")
  const [search, setSearch] = useState("")
  // Company-scoped details popup. Holds the row the admin clicked, plus
  // a per-contact map of fetched details (events + sequence + invite ctx +
  // full Prospect snapshot). Expanded contacts render their full timeline;
  // collapsed contacts show only the identity header. Primary contact (or
  // the contact the admin clicked from the per-contact menu) is expanded
  // by default.
  const [detailCompany, setDetailCompany] = useState<SalesCompanyRow | null>(null)
  const [contactDetails, setContactDetails] = useState<
    Map<string, ContactDetailBundle>
  >(new Map())
  const [expandedContacts, setExpandedContacts] = useState<Set<string>>(new Set())
  const [previewEmail, setPreviewEmail] = useState<{ template: string; lang: string } | null>(null)
  const [showStatusGuide, setShowStatusGuide] = useState(false)
  const [showApolloSync, setShowApolloSync] = useState(false)
  const [syncListId, setSyncListId] = useState("")
  const [editingListId, setEditingListId] = useState(false)
  const [latestRuns, setLatestRuns] = useState(apolloSyncRuns)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [showEmailsModal, setShowEmailsModal] = useState(false)
  const [emailLang, setEmailLang] = useState<"en" | "nl">("nl")
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(initialTotalCompanies > 50)
  const [isPending, startTransition] = useTransition()
  // last_contacted_at desc is the primary sales workflow — admins want to
  // see who they last touched first. Created sort exists for cohort
  // analysis ("everyone added this week").
  const [sortBy, setSortBy] = useState<SalesSortBy>("last_contacted_at")
  const [sortDir, setSortDir] = useState<SalesSortDir>("desc")

  const reload = useCallback((opts?: { offset?: number; append?: boolean }) => {
    const off = opts?.offset ?? 0
    startTransition(async () => {
      const result = await fetchSalesCompanies({
        statuses: statusFilter,
        source: sourceFilter,
        sequence: sequenceFilter,
        search,
        offset: off,
        limit: 50,
        sortBy,
        sortDir,
      })
      if (opts?.append) {
        setCompanies((prev) => [...prev, ...result.companies])
        // Email totals are summed across the loaded page, so when paginating
        // we accumulate; resetting on a fresh load would clobber prior pages.
        setTotalEmailsSent((prev) => prev + result.companies.reduce((s, c) => s + c.emailsSent, 0))
      } else {
        setCompanies(result.companies)
        setTotalEmailsSent(result.companies.reduce((s, c) => s + c.emailsSent, 0))
      }
      setTotalCompanies(result.totalCompanies)
      setFunnel(result.funnel)
      setOffset(off)
      setHasMore(result.totalCompanies > off + result.companies.length)
    })
  }, [statusFilter, sourceFilter, sequenceFilter, search, sortBy, sortDir])

  // Resend email backfill — pulls open/click events the webhook may have
  // missed. Cheap (throttled to once/hour server-side); refresh the table
  // afterwards so newly-credited engagements show up.
  const syncedRef = useRef(false)
  useEffect(() => {
    if (syncedRef.current) return
    syncedRef.current = true
    syncResendEmailStats().then(({ synced }) => {
      if (synced > 0) reload()
    })
  }, [reload])

  const handleFilterChange = useCallback((newStatuses?: ProspectStatus[], newSource?: string, newSequence?: SequenceStatus | "all") => {
    if (newStatuses !== undefined) setStatusFilter(newStatuses)
    if (newSource !== undefined) setSourceFilter(newSource)
    if (newSequence !== undefined) setSequenceFilter(newSequence)
    const s = newStatuses ?? statusFilter
    const src = newSource ?? sourceFilter
    const seq = newSequence ?? sequenceFilter
    startTransition(async () => {
      const result = await fetchSalesCompanies({
        statuses: s, source: src, sequence: seq, search,
        offset: 0, limit: 50, sortBy, sortDir,
      })
      setCompanies(result.companies)
      setTotalCompanies(result.totalCompanies)
      setFunnel(result.funnel)
      setTotalEmailsSent(result.companies.reduce((sum, c) => sum + c.emailsSent, 0))
      setOffset(0)
      setHasMore(result.totalCompanies > result.companies.length)
    })
  }, [statusFilter, sourceFilter, sequenceFilter, search, sortBy, sortDir])

  const toggleStatus = useCallback((status: ProspectStatus) => {
    const next = statusFilter.includes(status)
      ? statusFilter.filter((s) => s !== status)
      : [...statusFilter, status]
    handleFilterChange(next)
  }, [statusFilter, handleFilterChange])

  const handleSearch = useCallback(() => {
    reload({ offset: 0 })
  }, [reload])

  const handleLoadMore = useCallback(() => {
    reload({ offset: offset + 50, append: true })
  }, [reload, offset])

  const toggleSort = useCallback((field: SalesSortBy) => {
    const nextDir: SalesSortDir = sortBy === field ? (sortDir === "desc" ? "asc" : "desc") : "desc"
    setSortBy(field)
    setSortDir(nextDir)
    startTransition(async () => {
      const result = await fetchSalesCompanies({
        statuses: statusFilter, source: sourceFilter, sequence: sequenceFilter, search,
        offset: 0, limit: 50, sortBy: field, sortDir: nextDir,
      })
      setCompanies(result.companies)
      setTotalCompanies(result.totalCompanies)
      setFunnel(result.funnel)
      setTotalEmailsSent(result.companies.reduce((sum, c) => sum + c.emailsSent, 0))
      setOffset(0)
      setHasMore(result.totalCompanies > result.companies.length)
    })
  }, [sortBy, sortDir, statusFilter, sourceFilter, sequenceFilter, search])

  // Open the company-scoped details popup. Two entry points:
  //   1. Row-level "Details" menu → focuses primary contact (no focusId).
  //   2. Per-contact "Details" → opens with that contact expanded.
  // Per-contact data (events / sequence / invite context / full Prospect)
  // is fetched in parallel for every contact in the row, then dropped into
  // a Map for the popup to read. Multiple contacts × ~4 server calls each
  // is acceptable here — popups are admin-only and on demand.
  const openCompanyDetails = useCallback((row: SalesCompanyRow, focusContactId?: string) => {
    setDetailCompany(row)
    setExpandedContacts(new Set([focusContactId ?? row.primaryContact.prospectId]))
    setContactDetails(new Map())
    startTransition(async () => {
      const entries = await Promise.all(row.contacts.map(async (c): Promise<[string, ContactDetailBundle]> => {
        const [prospect, eventsResult, sequenceResult, inviteResult] = await Promise.all([
          fetchProspectById(c.prospectId),
          fetchProspectEvents(c.prospectId),
          getProspectSequence(c.prospectId),
          c.source === "invites"
            ? getProspectInviteContext(c.prospectId)
            : Promise.resolve({ success: true, context: null } as const),
        ])
        return [c.prospectId, {
          prospect,
          events: eventsResult.events,
          sequence: sequenceResult.success ? sequenceResult.steps ?? [] : [],
          locale: sequenceResult.success ? sequenceResult.locale ?? null : null,
          inviteContext: inviteResult.success ? inviteResult.context ?? null : null,
        }]
      }))
      setContactDetails(new Map(entries))
    })
  }, [])

  // Find a row by prospect id and open the company popup focused on that
  // contact. Used by the per-contact chevron menu in the expanded contacts
  // cell — the menu only knows the prospectId, not the row.
  const openContactDetails = useCallback((prospectId: string) => {
    const row = companies.find((r) => r.contacts.some((c) => c.prospectId === prospectId))
    if (!row) return
    openCompanyDetails(row, prospectId)
  }, [companies, openCompanyDetails])

  const toggleContactExpanded = useCallback((prospectId: string) => {
    setExpandedContacts((prev) => {
      const next = new Set(prev)
      if (next.has(prospectId)) next.delete(prospectId)
      else next.add(prospectId)
      return next
    })
  }, [])

  // ── Per-contact actions ────────────────────────────────────────────────
  // Reuse the existing per-prospect server actions; the row aggregator will
  // re-derive Status / Sequence / Sources after each call via reload().

  const runContactAction = useCallback(async (
    fn: () => Promise<{ success: boolean; error?: string; warning?: string }>,
    successLabel: string,
    failLabel: string,
  ) => {
    const result = await fn()
    if (result.success) {
      if (result.warning) toast.warning(result.warning)
      else toast.success(successLabel)
      reload({ offset })
    } else {
      toast.error(result.error ?? failLabel)
    }
  }, [reload, offset])

  const refreshSyncRuns = async () => {
    try {
      const runs = await fetchLatestApolloSyncRuns()
      setLatestRuns(runs)
    } catch { /* keep state */ }
  }

  const handleSyncList = async () => {
    if (!syncListId.trim()) return
    setIsSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch("/api/apollo-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_list", list_id: syncListId.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setSyncResult(`Synced ${data.synced} contacts from Apollo`)
        await refreshSyncRuns()
        reload({ offset: 0 })
      } else {
        setSyncResult(`Error: ${data.error}`)
      }
    } catch {
      setSyncResult("Failed to connect to Apollo")
    } finally {
      setIsSyncing(false)
    }
  }

  const handleSyncActivity = async () => {
    setIsSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch("/api/apollo-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_activity" }),
      })
      const data = await res.json()
      if (res.ok) {
        setSyncResult(`Updated ${data.updated} of ${data.total} prospects`)
        await refreshSyncRuns()
        reload({ offset: 0 })
      } else {
        setSyncResult(`Error: ${data.error}`)
      }
    } catch {
      setSyncResult("Failed to connect to Apollo")
    } finally {
      setIsSyncing(false)
    }
  }

  const closeDetails = () => {
    setDetailCompany(null)
    setContactDetails(new Map())
    setExpandedContacts(new Set())
  }

  return (
    <>
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="arco-section-title">Sales</h3>
          <p className="text-xs text-[#a1a1a0] mt-0.5">
            {companies.length} of {totalCompanies} companies
            {" · "}
            <button type="button" className="text-[#016D75] hover:underline cursor-pointer" onClick={() => setShowStatusGuide(true)}>
              Status guide
            </button>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowEmailsModal(true)}
            className="h-8 px-3 text-xs font-medium border border-[#e5e5e4] rounded-[3px] text-[#6b6b68] hover:bg-[#fafaf9] transition-colors"
          >
            Email Templates
          </button>
          <button
            onClick={() => {
              setSyncListId(currentApolloListId ?? "")
              setShowApolloSync(true)
            }}
            className="h-8 px-3 text-xs font-medium border border-[#e5e5e4] rounded-[3px] text-[#6b6b68] hover:bg-[#fafaf9] transition-colors"
          >
            Apollo Sync
          </button>
        </div>
      </div>

      {/* Conversion funnel — counts unique companies per stage. */}
      <div className="mb-8 -mx-4 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
        {(() => {
          const cols = FUNNEL_STAGES.map((_, i) => i === 0 ? "auto" : "1fr auto").join(" ")
          const stageKeys = FUNNEL_STAGES.map((s) => s.status)
          const cohorted = stageKeys.map((key, i) =>
            stageKeys.slice(i).reduce((sum, k) => sum + ((funnel as any)[k] ?? 0), 0)
          )

          return (
            <div style={{ display: "grid", gridTemplateColumns: cols, gap: 0, alignItems: "start" }}>
              {FUNNEL_STAGES.map((stage, i) => {
                const count = (funnel as any)[stage.status] ?? 0
                const prevCohort = i > 0 ? cohorted[i - 1] : funnel.total
                const thisCohort = cohorted[i]
                const rate = i === 0 ? "" : conversionRate(prevCohort, thisCohort)
                const color = DRIVER_COLORS[stage.driver]
                const driverLabel = Object.entries(DRIVER_LABEL_AT).find(([, s]) => s === stage.status)?.[0]
                return (
                  <Fragment key={stage.status}>
                    {i > 0 && (
                      <div className="relative px-1 self-center" style={{ minWidth: 32 }}>
                        <div className="w-full border-t border-[#d4d4d3]" />
                        {rate && (
                          <span className="absolute text-[10px] font-medium text-[#6b6b68]" style={{ top: -16, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap" }}>{rate}</span>
                        )}
                      </div>
                    )}
                    <div className="flex flex-col">
                      {driverLabel ? (
                        <p className="arco-eyebrow mb-2" style={{ color: DRIVER_COLORS[driverLabel] }}>{driverLabel.charAt(0).toUpperCase() + driverLabel.slice(1)}</p>
                      ) : (
                        <div style={{ height: 24 }} />
                      )}
                      <button
                        onClick={() => toggleStatus(stage.status)}
                        className={`rounded-[3px] border bg-white px-3 py-3 transition-colors hover:border-[#c4c4c2] ${statusFilter.includes(stage.status) ? "border-[#1c1c1a] bg-[#fafaf9]" : "border-[#e5e5e4]"}`}
                        style={{ width: 100 }}
                      >
                        <div className="flex items-center gap-[6px] mb-1.5">
                          <span className="status-pill-dot shrink-0" style={{ background: color }} />
                          <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 400, color: "var(--text-primary)" }}>{stage.label}</span>
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
        {/* Email stats — sum across the loaded page; cards stay stable when filters narrow. */}
        <div className="flex items-center gap-3 mt-4 justify-end">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#a1a1a0]">Emails sent</span>
            <span className="text-[11px] font-medium text-[#1c1c1a]">{totalEmailsSent.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
        <div className="flex-1">
          <div className="relative max-w-xs">
            <input
              type="text"
              placeholder="Search company or contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full h-9 pl-8 pr-3 text-xs border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#a1a1a0] transition-colors"
            />
            <svg className="absolute left-2.5 top-2.5 text-[#a1a1a0]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Multi-select status filter — empty selection = all statuses. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-[170px] h-9 px-3 text-xs border border-[#e5e5e4] rounded-[3px] bg-white hover:border-[#a1a1a0] transition-colors flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-1.5 truncate">
                  {statusFilter.length === 0 ? (
                    <span className="text-[#6b6b68]">All statuses</span>
                  ) : statusFilter.length === 1 ? (
                    <>
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_CONFIG[statusFilter[0]].dot}`} />
                      <span className="truncate">{STATUS_CONFIG[statusFilter[0]].label}</span>
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
            <DropdownMenuContent align="start" className="min-w-[180px]">
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault()
                  if (statusFilter.length > 0) handleFilterChange([])
                }}
                className="text-xs"
              >
                Clear selection
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {ALL_STATUSES.map((s) => (
                <DropdownMenuCheckboxItem
                  key={s}
                  checked={statusFilter.includes(s)}
                  onCheckedChange={() => toggleStatus(s)}
                  onSelect={(e) => e.preventDefault()}
                  className="text-xs"
                >
                  <span className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_CONFIG[s].dot}`} />
                    {STATUS_CONFIG[s].label}
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Select value={sequenceFilter} onValueChange={(v) => handleFilterChange(undefined, undefined, v as SequenceStatus | "all")}>
            <SelectTrigger className="w-[160px] h-9 text-xs border-[#e5e5e4] rounded-[3px]">
              <SelectValue placeholder="All sequences">
                {sequenceFilter === "all" ? "All sequences" : (
                  <span className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${SEQUENCE_CONFIG[sequenceFilter as SequenceStatus].dot}`} />
                    {SEQUENCE_CONFIG[sequenceFilter as SequenceStatus].label}
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sequences</SelectItem>
              {(["not_started", "active", "paused", "finished"] as SequenceStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  <span className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${SEQUENCE_CONFIG[s].dot}`} />
                    {SEQUENCE_CONFIG[s].label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={(v) => handleFilterChange(undefined, v)}>
            <SelectTrigger className="w-[140px] h-9 text-xs border-[#e5e5e4] rounded-[3px]">
              <SelectValue placeholder="All channels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All channels</SelectItem>
              <SelectItem value="arco">Showcase</SelectItem>
              <SelectItem value="invites">Invite</SelectItem>
              <SelectItem value="apollo">Outreach</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Companies table — one row per company, contacts column expands inline. */}
      <div className="arco-table-wrap">
        <table className="arco-table" style={{ minWidth: 1200 }}>
          <thead>
            <tr>
              <th>Company</th>
              <th>Contacts</th>
              <th>Status</th>
              <th>Sequence</th>
              <th>Channel</th>
              <th style={{ textAlign: "center" }}>Sent</th>
              <th style={{ textAlign: "center" }}>Delivered</th>
              <th style={{ textAlign: "center" }}>Opened</th>
              <th style={{ textAlign: "center" }}>Clicked</th>
              <th
                style={{ textAlign: "right", cursor: "pointer", userSelect: "none" }}
                onClick={() => toggleSort("created_at")}
                title="Sort by created"
              >
                <span className="inline-flex items-center justify-end gap-1">
                  Created
                  {sortBy === "created_at" && (
                    <span className="text-[10px] text-[#a1a1a0]">{sortDir === "desc" ? "↓" : "↑"}</span>
                  )}
                </span>
              </th>
              <th
                style={{ textAlign: "right", cursor: "pointer", userSelect: "none" }}
                onClick={() => toggleSort("last_contacted_at")}
                title="Sort by last contacted"
              >
                <span className="inline-flex items-center justify-end gap-1">
                  Last contacted
                  {sortBy === "last_contacted_at" && (
                    <span className="text-[10px] text-[#a1a1a0]">{sortDir === "desc" ? "↓" : "↑"}</span>
                  )}
                </span>
              </th>
              <th className="w-[40px]"></th>
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 && (
              <tr>
                <td colSpan={12} style={{ height: 96, textAlign: "center", color: "var(--text-disabled)" }}>
                  No companies found.
                </td>
              </tr>
            )}
            {companies.map((row) => (
              <CompanyRowView
                key={row.rowId}
                row={row}
                onOpenContactDetails={openContactDetails}
                onContactAction={runContactAction}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center mt-4">
          <button
            onClick={handleLoadMore}
            disabled={isPending}
            className="h-9 px-6 text-xs font-medium border border-[#e5e5e4] rounded-[3px] text-[#6b6b68] hover:bg-[#fafaf9] transition-colors disabled:opacity-50"
          >
            {isPending ? "Loading..." : "Load more"}
          </button>
        </div>
      )}

      {/* Details popup — company-scoped, every contact rendered as an
          accordion with its own lifecycle / sequence / events history.
          Primary contact (or the per-contact "Details" target) opens
          expanded; the rest collapse to identity headers. */}
      {detailCompany && (
        <div className="popup-overlay" onClick={closeDetails}>
          <div
            className="popup-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 720, maxHeight: "90vh", overflowY: "auto" }}
          >
            <div className="popup-header">
              <div className="flex items-center gap-3 min-w-0">
                {detailCompany.claimedCompany?.logoUrl ? (
                  <div className="arco-table-avatar shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={detailCompany.claimedCompany.logoUrl}
                      alt={detailCompany.companyName}
                    />
                  </div>
                ) : (
                  <div
                    className="arco-table-avatar shrink-0"
                    style={{ background: "#f5f5f4", color: "#6b6b68" }}
                  >
                    {(detailCompany.companyName ?? "")
                      .split(" ")
                      .filter(Boolean)
                      .map((t) => t[0]?.toUpperCase())
                      .slice(0, 2)
                      .join("") || "?"}
                  </div>
                )}
                <div className="min-w-0">
                  {detailCompany.claimedCompany?.slug ? (
                    <a
                      href={`/professionals/${detailCompany.claimedCompany.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="arco-section-title hover:underline"
                    >
                      {detailCompany.companyName}
                    </a>
                  ) : (
                    <h3 className="arco-section-title">{detailCompany.companyName}</h3>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {[detailCompany.claimedCompany?.primaryService, detailCompany.claimedCompany?.city ?? detailCompany.city]
                      .filter(Boolean)
                      .map((label, i, arr) => (
                        <Fragment key={String(label)}>
                          <span className="text-xs text-[#6b6b68]">{label}</span>
                          {i < arr.length - 1 && <span className="text-[#c4c4c2] text-xs">·</span>}
                        </Fragment>
                      ))}
                    {detailCompany.sources.length > 0 && (
                      <span className="flex items-center gap-1 ml-1">
                        {detailCompany.sources.map((s) => (
                          <span key={s} className="status-pill">{sourceLabel(s)}</span>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button type="button" className="popup-close" onClick={closeDetails} aria-label="Close">✕</button>
            </div>

            <div className="mb-2 mt-2">
              <span className="text-[10px] font-medium text-[#a1a1a0] uppercase tracking-wider">
                Contacts ({detailCompany.contacts.length})
              </span>
            </div>
            <div className="space-y-3">
              {detailCompany.contacts.map((contact) => (
                <ContactDetailCard
                  key={contact.prospectId}
                  contact={contact}
                  details={contactDetails.get(contact.prospectId) ?? null}
                  expanded={expandedContacts.has(contact.prospectId)}
                  onToggleExpand={() => toggleContactExpanded(contact.prospectId)}
                  onPreviewEmail={(template, lang) => setPreviewEmail({ template, lang })}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Email preview popup */}
      {previewEmail && (
        <div className="popup-overlay" onClick={() => setPreviewEmail(null)}>
          <div
            className="popup-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 720, width: "calc(100vw - 48px)", display: "flex", flexDirection: "column", maxHeight: "90vh" }}
          >
            <div className="popup-header">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="arco-section-title">{templateDisplayName(previewEmail.template)}</h3>
                <div style={{ display: "inline-flex", border: "1px solid var(--arco-rule)", borderRadius: 3, overflow: "hidden", fontSize: 11 }}>
                  {(["en", "nl"] as const).map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setPreviewEmail((prev) => (prev ? { ...prev, lang: loc } : prev))}
                      style={{
                        padding: "4px 10px",
                        background: previewEmail.lang === loc ? "var(--arco-black)" : "transparent",
                        color: previewEmail.lang === loc ? "#fff" : "var(--arco-mid-grey)",
                        border: "none",
                        cursor: "pointer",
                        fontWeight: previewEmail.lang === loc ? 500 : 400,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" className="popup-close" onClick={() => setPreviewEmail(null)} aria-label="Close">✕</button>
            </div>
            <iframe
              src={`/admin/emails/preview?template=${previewEmail.template}&lang=${previewEmail.lang}`}
              style={{ width: "100%", flex: 1, minHeight: 500, border: "none", background: "#f5f5f4" }}
              title="Email preview"
            />
          </div>
        </div>
      )}

      {/* Status Guide Popup */}
      {showStatusGuide && (
        <div className="popup-overlay" onClick={() => setShowStatusGuide(false)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: "85vh", overflowY: "auto" }}>
            <div className="popup-header">
              <h3 className="arco-section-title">Sales statuses</h3>
              <button type="button" className="popup-close" onClick={() => setShowStatusGuide(false)} aria-label="Close">✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { dot: "bg-[#7c3aed]", label: "Listed", desc: "Owns a Listed company — fully converted.", specs: "Live on platform · Conversion complete" },
                { dot: "bg-[#2563eb]", label: "Draft", desc: "Owns a company in Draft status — onboarding in progress.", specs: "Company claimed · Profile setup" },
                { dot: "bg-[#2563eb]", label: "Signup", desc: "Created an Arco account but has not claimed or created a company yet.", specs: "Account created · No company" },
                { dot: "bg-[#2563eb]", label: "Visitor", desc: "Clicked a link in an outreach email and visited the site.", specs: "Email engagement · No account yet" },
                { dot: "bg-[#f59e0b]", label: "Contacted", desc: "At least one intro email has been sent. Advances automatically on send.", specs: "Intro sent · Drip sequence active" },
                { dot: "bg-[#f59e0b]", label: "Prospect", desc: "In the sales funnel — Showcase, Invite, or Outreach contact with no email sent yet.", specs: "In sales funnel · Awaiting first email" },
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
              <strong>Flow:</strong> Prospect → Contacted → Visitor → Signup → Draft → Listed
              <br />
              <strong>Aggregation:</strong> Each row shows the highest stage any contact at the company has reached. Channel column shows every distinct entry point (Showcase, Invite, Outreach).
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowStatusGuide(false)}
                className="h-9 px-4 text-xs font-medium border border-[#e5e5e4] rounded-[3px] text-[#6b6b68] hover:bg-[#fafaf9] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apollo Sync popup */}
      {showApolloSync && (
        <div className="popup-overlay" onClick={() => setShowApolloSync(false)}>
          <div className="popup-card" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <h3 className="arco-section-title">Apollo Sync</h3>
              <button type="button" className="popup-close" onClick={() => setShowApolloSync(false)} aria-label="Close">✕</button>
            </div>

            <div style={{ marginBottom: 24 }}>
              <h4 style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 500, color: "#1c1c1a" }}>Import contacts from a list</h4>
              <p style={{ margin: "0 0 10px", fontSize: 11, color: "#a1a1a0", lineHeight: 1.5 }}>
                The list ID feeds prospects into the sales funnel. Find it in Apollo → Lists → click a list → the ID is in the URL.
              </p>

              <label className="text-xs font-medium text-[#6b6b68] block mb-1">Current list ID</label>
              {editingListId || !currentApolloListId ? (
                <input
                  type="text"
                  value={syncListId}
                  onChange={(e) => setSyncListId(e.target.value)}
                  className="w-full h-9 px-3 text-sm border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#a1a1a0] transition-colors"
                  placeholder={currentApolloListId ?? "e.g. 6501a2b3c4d5e6f7..."}
                  autoFocus={editingListId}
                />
              ) : (
                <div className="flex items-center justify-between gap-2 h-9 px-3 border border-[#e5e5e4] rounded-[3px] bg-[#fafaf9]">
                  <code className="text-xs text-[#1c1c1a] truncate">{currentApolloListId}</code>
                  <button
                    type="button"
                    onClick={() => {
                      setSyncListId(currentApolloListId ?? "")
                      setEditingListId(true)
                    }}
                    className="text-xs font-medium text-[#016D75] hover:underline shrink-0"
                  >
                    Change
                  </button>
                </div>
              )}

              <p style={{ margin: "10px 0 12px", fontSize: 11, color: "#6b6b68" }}>
                {apolloProspectsCount} contact{apolloProspectsCount === 1 ? "" : "s"} in the prospects table from Apollo.
                {latestRuns.list?.startedAt && (
                  <>
                    {" · "}
                    Last import {formatRelativeTime(latestRuns.list.startedAt)}
                    {latestRuns.list.syncedCount !== null && ` (synced ${latestRuns.list.syncedCount})`}
                    {latestRuns.list.errorCount > 0 && ` · ${latestRuns.list.errorCount} error${latestRuns.list.errorCount === 1 ? "" : "s"}`}
                  </>
                )}
              </p>

              <div className="flex justify-end">
                <button
                  onClick={handleSyncList}
                  disabled={isSyncing || !syncListId.trim()}
                  className="h-9 px-4 text-xs font-medium rounded-[3px] text-white transition-colors disabled:opacity-50"
                  style={{ background: "var(--primary, #016D75)" }}
                >
                  {isSyncing ? "Syncing…" : "Import Contacts"}
                </button>
              </div>
            </div>

            <div style={{ paddingTop: 20, borderTop: "1px solid #e5e5e4" }}>
              <h4 style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 500, color: "#1c1c1a" }}>Refresh prospect activity</h4>
              <p style={{ margin: "0 0 12px", fontSize: 11, color: "#a1a1a0", lineHeight: 1.5 }}>
                Re-reads campaign status from Apollo for every active prospect. Runs automatically every 6 hours; the manual button is for "I just sent emails, refresh now" cases.
              </p>

              <div style={{ background: "#fafaf9", border: "1px solid #e5e5e4", borderRadius: 3, padding: "10px 12px", marginBottom: 12, fontSize: 11, lineHeight: 1.6, color: "#1c1c1a" }}>
                {latestRuns.activity ? (
                  <>
                    <div>
                      <strong style={{ fontWeight: 500 }}>Last sync:</strong>{" "}
                      <span style={{ color: "#6b6b68" }}>
                        {formatRelativeTime(latestRuns.activity.startedAt)}
                        {" "}({latestRuns.activity.triggeredBy})
                      </span>
                    </div>
                    <div>
                      <strong style={{ fontWeight: 500 }}>Result:</strong>{" "}
                      <span style={{ color: latestRuns.activity.errorCount > 0 ? "#dc2626" : "#059669" }}>
                        {latestRuns.activity.finishedAt
                          ? `${latestRuns.activity.syncedCount ?? 0} of ${latestRuns.activity.totalCount ?? 0} prospects refreshed${latestRuns.activity.errorCount > 0 ? ` · ${latestRuns.activity.errorCount} error${latestRuns.activity.errorCount === 1 ? "" : "s"}` : ""}`
                          : "Running…"}
                      </span>
                    </div>
                    {latestRuns.activity.lastError && (
                      <div style={{ marginTop: 4, color: "#dc2626", fontSize: 10 }}>
                        Last error: {latestRuns.activity.lastError}
                      </div>
                    )}
                  </>
                ) : (
                  <span style={{ color: "#a1a1a0" }}>No syncs run yet.</span>
                )}
              </div>

              {syncResult && (
                <p className={`text-xs mb-3 ${syncResult.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>
                  {syncResult}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowApolloSync(false)}
                  className="h-9 px-4 text-xs font-medium border border-[#e5e5e4] rounded-[3px] text-[#6b6b68] hover:bg-[#fafaf9] transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={handleSyncActivity}
                  disabled={isSyncing}
                  className="h-9 px-4 text-xs font-medium border border-[#e5e5e4] rounded-[3px] text-[#1c1c1a] hover:bg-[#fafaf9] transition-colors disabled:opacity-50"
                >
                  {isSyncing ? "Refreshing…" : "Refresh now"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email templates modal */}
      {showEmailsModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40" onClick={() => setShowEmailsModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-[#e5e5e4] px-6 py-4 flex items-center justify-between z-10">
              <span className="text-sm font-medium text-[#1c1c1a]">Apollo Email Sequence — Architect Outreach</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center border border-[#e5e5e4] rounded-[3px] overflow-hidden">
                  <button
                    onClick={() => setEmailLang("nl")}
                    className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${emailLang === "nl" ? "bg-[#1c1c1a] text-white" : "text-[#6b6b68] hover:bg-[#fafaf9]"}`}
                  >
                    NL
                  </button>
                  <button
                    onClick={() => setEmailLang("en")}
                    className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${emailLang === "en" ? "bg-[#1c1c1a] text-white" : "text-[#6b6b68] hover:bg-[#fafaf9]"}`}
                  >
                    EN
                  </button>
                </div>
                <button className="text-[#a1a1a0] hover:text-[#1c1c1a]" onClick={() => setShowEmailsModal(false)}>✕</button>
              </div>
            </div>
            <div className="px-6 py-5 space-y-8">
              <p className="text-xs text-[#a1a1a0]">
                {emailLang === "nl"
                  ? <>Kopieer deze e-mails naar je Apollo-sequence. {'{{first_name}}'}, {'{{account.name}}'} en {'{{email}}'} worden automatisch ingevuld door Apollo.</>
                  : <>Copy these into your Apollo sequence. {'{{first_name}}'}, {'{{account.name}}'}, and {'{{email}}'} are Apollo variables that auto-fill per prospect.</>
                }
              </p>

              {emailLang === "nl" ? (
                <>
                  <EmailTemplate
                    step={1}
                    delay="Dag 1"
                    subject="{{first_name}}, {{account.name}} past bij Arco"
                    body={`Beste {{first_name}},

Ik ben Niek, oprichter van Arco — een nieuw professioneel netwerk waar toonaangevende architecten hun beste werk publiceren en de vakmensen waarmee ze samenwerken aanbevelen.

Op Arco tonen we gerealiseerde projecten met alle betrokken partijen — architect, aannemer, interieurontwerper — gekoppeld. Geen biedingen, geen reviews, geen zelf-gepubliceerde portfolio's. Alleen uitzonderlijk werk, redactioneel beoordeeld.

Wat Arco biedt:
• Publiceer onbeperkt projecten — volledig gratis, voor altijd
• Vermeld alle partijen die hebben bijgedragen aan de realisatie
• Word gevonden door serieuze opdrachtgevers in jouw regio

Het aanmaken van jullie studiopagina en eerste project kost een paar minuten — plak een link naar jullie website en wij halen alles automatisch op.

Bekijk hoe het werkt → ← hyperlink this text to: https://arcolist.com/businesses/architects?ref={{email}}

Groet,
Niek van Leeuwen
Oprichter, Arco`}
                  />
                  <EmailTemplate
                    step={2}
                    delay="Dag 4"
                    subject="Hoe architecten op Arco gevonden worden"
                    body={`Beste {{first_name}},

Een korte follow-up — ik wilde laten zien hoe Arco werkt:

1. Plak een link naar jullie website of project — wij halen alles op
2. Ons redactieteam beoordeelt het op kwaliteit
3. Na publicatie is {{account.name}} zichtbaar voor opdrachtgevers in jullie regio
4. Opdrachtgevers nemen direct contact op — geen tussenpersonen, geen leadkosten

De architecten die al op Arco staan waarderen vooral de kwaliteit van de presentatie en het feit dat opdrachtgevers die contact opnemen serieus zijn.

Jullie projecten zouden er goed bij passen. Maak jullie studiopagina aan en publiceer jullie eerste project → ← hyperlink this text to: https://arcolist.com/businesses/architects?ref={{email}}

Groet,
Niek`}
                  />
                  <EmailTemplate
                    step={3}
                    delay="Dag 8"
                    subject="De eerste bureaus publiceren al op Arco"
                    body={`Beste {{first_name}},

De eerste architectenbureaus publiceren hun werk al op Arco en worden gevonden door opdrachtgevers die actief zoeken naar een architect.

Wat Arco anders maakt:
• Elk project wordt redactioneel beoordeeld — kwaliteit is het filter, niet advertentiebudget
• Alle betrokken partijen worden vermeld bij het project
• Opdrachtgevers zien eerst het gerealiseerde werk, dan ontdekken ze het team erachter

Het platform is gratis voor architecten. Geen addertje — onze inkomsten komen van premium functies voor andere partijen, niet van jullie.

Ik zou {{account.name}} graag verwelkomen. Het aanmaken van jullie studiopagina kost een paar minuten → ← hyperlink this text to: https://arcolist.com/businesses/architects?ref={{email}}

Groet,
Niek`}
                  />
                  <EmailTemplate
                    step={4}
                    delay="Dag 14"
                    subject="Laatste bericht — uitnodiging staat nog open"
                    body={`Beste {{first_name}},

Nog een laatste bericht — jullie uitnodiging om op Arco te publiceren staat nog open.

Plak een link naar een project op jullie website, en wij halen de foto's, details en beschrijving automatisch op. Je bekijkt het, past aan waar nodig, en publiceert. Geen verplichting, geen kosten.

Maak jullie studiopagina aan → ← hyperlink this text to: https://arcolist.com/businesses/architects?ref={{email}}

Als Arco niet de juiste match is, helemaal geen probleem. Bedankt voor je tijd.

Groet,
Niek`}
                  />
                </>
              ) : (
                <>
                  <EmailTemplate
                    step={1}
                    delay="Day 1"
                    subject="{{first_name}}, {{account.name}} is a fit for Arco"
                    body={`Dear {{first_name}},

I'm Niek, founder of Arco — a new professional network where leading architects publish their best work and recommend the craftspeople they work with.

On Arco, we showcase completed projects with all contributing parties — architect, builder, interior designer — linked together. No bidding, no reviews, no self-published portfolios. Only exceptional work, editorially reviewed.

What Arco offers:
• Publish unlimited projects — completely free, forever
• Feature every party that contributed to the project
• Get discovered by serious clients in your region

Setting up your studio page and first project takes just a few minutes — paste a link to your website and we extract everything automatically.

See how it works → ← hyperlink this text to: https://arcolist.com/businesses/architects?ref={{email}}

Best,
Niek van Leeuwen
Founder, Arco`}
                  />
                  <EmailTemplate
                    step={2}
                    delay="Day 4"
                    subject="How architects get found on Arco"
                    body={`Dear {{first_name}},

A quick follow-up — here's how Arco works:

1. Paste a link to your website or project — we extract everything
2. Our editorial team reviews it for quality
3. Once published, {{account.name}} is visible to clients in your region
4. Clients reach out directly — no middlemen, no lead fees

The architects already on Arco value two things most: the quality of the presentation and the fact that clients who reach out are serious.

Your projects would be a great fit. Set up your studio page and publish your first project → ← hyperlink this text to: https://arcolist.com/businesses/architects?ref={{email}}

Best,
Niek`}
                  />
                  <EmailTemplate
                    step={3}
                    delay="Day 8"
                    subject="The first firms are already publishing on Arco"
                    body={`Dear {{first_name}},

The first architecture firms are already publishing their work on Arco and getting found by clients actively looking for an architect.

What makes Arco different:
• Every project is editorially reviewed — quality is the filter, not ad spend
• All contributing parties are featured on the project
• Clients see the built work first, then discover the team behind it

The platform is free for architects. No catch — our revenue comes from premium features for other parties, not from you.

I'd love to welcome {{account.name}}. Setting up your studio page takes just a few minutes → ← hyperlink this text to: https://arcolist.com/businesses/architects?ref={{email}}

Best,
Niek`}
                  />
                  <EmailTemplate
                    step={4}
                    delay="Day 14"
                    subject="Last note — your invitation is still open"
                    body={`Dear {{first_name}},

One last note — your invitation to publish on Arco is still open.

Paste a link to a project on your website, and we'll extract the photos, details, and description automatically. You review, adjust if needed, and publish. No commitment, no cost.

Set up your studio page → ← hyperlink this text to: https://arcolist.com/businesses/architects?ref={{email}}

If Arco isn't the right fit, no worries at all. Thanks for your time.

Best,
Niek`}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// -- Sub-components ----------------------------------------------------------

type ContactActionRunner = (
  fn: () => Promise<{ success: boolean; error?: string; warning?: string }>,
  successLabel: string,
  failLabel: string,
) => void | Promise<void>

/**
 * One row of the Sales table = one company.
 *
 * Contacts column mirrors the Projects column on /admin/professionals:
 * the primary contact is rendered inline with `dot + name + status pill +
 * sequence pill` and is itself a dropdown trigger for the per-contact
 * action menu. Companies with multiple contacts get a "+N more" link
 * below that opens a dropdown listing every other contact as a
 * DropdownMenuSub — sub-trigger shows the same identity row, sub-content
 * carries the same action menu. The row never expands inline.
 */
function CompanyRowView({
  row,
  onOpenContactDetails,
  onContactAction,
}: {
  row: SalesCompanyRow
  onOpenContactDetails: (prospectId: string) => void
  onContactAction: ContactActionRunner
}) {
  const claimed = row.claimedCompany
  const companyInitials = (row.companyName ?? "")
    .split(" ")
    .filter(Boolean)
    .map((t) => t[0]?.toUpperCase())
    .slice(0, 2)
    .join("") || "?"

  const subtitle = [claimed?.primaryService, claimed?.city ?? row.city].filter(Boolean).join(" · ")

  // Email rate display — clamp delivered up so we never show delivered <
  // opened (Resend webhook latency between event types). Cap at sent so
  // duplicate webhook events can't push the rate past 100%.
  const ratePct = row.emailsSent > 0 ? {
    delivered: Math.round(
      Math.min(Math.max(row.emailsDelivered, row.emailsOpened, row.emailsClicked), row.emailsSent) /
        row.emailsSent * 100,
    ),
    opened: Math.round(Math.min(row.emailsOpened, row.emailsSent) / row.emailsSent * 100),
    clicked: Math.round(Math.min(row.emailsClicked, row.emailsSent) / row.emailsSent * 100),
  } : null

  const statusCfg = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.prospect
  const sequenceCfg = SEQUENCE_CONFIG[row.sequenceStatus] ?? SEQUENCE_CONFIG.not_started

  return (
    <tr>
      {/* Company */}
      <td>
        <div className="flex items-center gap-3">
          {claimed?.logoUrl ? (
            <div className="arco-table-avatar">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={claimed.logoUrl} alt={row.companyName} />
            </div>
          ) : (
            <div className="arco-table-avatar" style={{ background: "#f5f5f4", color: "#6b6b68" }}>
              {companyInitials}
            </div>
          )}
          <div className="flex flex-col min-w-0">
            {claimed?.slug ? (
              <a
                href={`/professionals/${claimed.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="arco-table-primary hover:underline"
              >
                {row.companyName}
              </a>
            ) : (
              <span className="arco-table-primary">{row.companyName}</span>
            )}
            {subtitle && <span className="arco-table-secondary">{subtitle}</span>}
          </div>
        </div>
      </td>

      {/* Contacts */}
      <td>
        <ContactsCell
          row={row}
          onOpenContactDetails={onOpenContactDetails}
          onContactAction={onContactAction}
        />
      </td>

      {/* Status (aggregated) */}
      <td>
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusCfg.dot}`} />
          <span className="arco-table-primary" style={{ whiteSpace: "nowrap" }}>{statusCfg.label}</span>
        </div>
      </td>

      {/* Sequence (aggregated single value) */}
      <td>
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${sequenceCfg.dot}`} />
          <span className="arco-table-primary" style={{ whiteSpace: "nowrap", fontWeight: 400 }}>{sequenceCfg.label}</span>
        </div>
      </td>

      {/* Source (multi-pill) */}
      <td>
        <div className="flex flex-wrap items-center gap-1">
          {row.sources.map((s) => (
            <span key={s} className="status-pill">{sourceLabel(s)}</span>
          ))}
        </div>
      </td>

      <td style={{ textAlign: "center" }}>{row.emailsSent || "—"}</td>
      <td style={{ textAlign: "center" }}>
        {ratePct ? <span className={deliveredRateColor(ratePct.delivered, row.emailsSent)}>{ratePct.delivered}%</span> : <span className="text-[#a1a1a0] font-normal">—</span>}
      </td>
      <td style={{ textAlign: "center" }}>
        {ratePct ? <span className={openedRateColor(ratePct.opened, row.emailsSent)}>{ratePct.opened}%</span> : <span className="text-[#a1a1a0] font-normal">—</span>}
      </td>
      <td style={{ textAlign: "center" }}>
        {ratePct ? <span className={clickedRateColor(ratePct.clicked, row.emailsSent)}>{ratePct.clicked}%</span> : <span className="text-[#a1a1a0] font-normal">—</span>}
      </td>

      <td className="arco-table-nowrap" style={{ textAlign: "right", color: "var(--text-disabled)" }}>{formatDate(row.createdAt)}</td>
      <td className="arco-table-nowrap" style={{ textAlign: "right", color: "var(--text-disabled)" }}>
        {row.lastContactedAt ? formatDate(row.lastContactedAt) : <span className="text-[#c4c4c2]">—</span>}
      </td>

      <td onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="arco-table-action">
              <MoreHorizontal size={14} className="text-[#a1a1a0]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[160px]">
            <DropdownMenuItem
              className="text-xs cursor-pointer"
              onClick={() => onOpenContactDetails(row.primaryContact.prospectId)}
            >
              Details
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  )
}

/** Contact identity block — avatar + name + email. Used for both the
 *  primary contact (inline in the row) and each contact in the expanded
 *  list. */
function ContactIdentity({ contact }: { contact: SalesContact }) {
  const rc = contact.resolvedContact
  const initials = (rc.name ?? "")
    .split(" ")
    .filter(Boolean)
    .map((t) => t[0]?.toUpperCase())
    .slice(0, 2)
    .join("") || (rc.email?.charAt(0).toUpperCase() ?? "?")
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="arco-table-avatar" style={{ background: "#f5f5f4", color: "#6b6b68", overflow: "hidden", flexShrink: 0 }}>
        {rc.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={rc.avatarUrl} alt={rc.name ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          initials
        )}
      </div>
      <div className="flex flex-col min-w-0">
        {rc.name && <span className="arco-table-primary truncate">{rc.name}</span>}
        <span className={(rc.name ? "arco-table-secondary" : "arco-table-primary") + " truncate"}>
          {rc.email ?? contact.email ?? "—"}
        </span>
      </div>
    </div>
  )
}

/** Contacts cell — Projects-column pattern.
 *
 *   Layout:
 *     ● <name>  [● Status]  [● Sequence]
 *     +N more
 *
 *   The primary row is itself the trigger of a DropdownMenu carrying the
 *   per-contact action menu; "+N more" opens a dropdown listing the
 *   remaining contacts as DropdownMenuSub items, each with the same
 *   action menu in their sub-content. The row never expands inline. */
function ContactsCell({
  row,
  onOpenContactDetails,
  onContactAction,
}: {
  row: SalesCompanyRow
  onOpenContactDetails: (prospectId: string) => void
  onContactAction: ContactActionRunner
}) {
  const primary = row.primaryContact
  const overflow = row.contacts.length - 1

  return (
    <div className="flex flex-col gap-0.5">
      {/* Primary contact — clickable opens its action menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 hover:text-[#016D75] transition-colors cursor-pointer text-left"
          >
            <ContactInline contact={primary} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[180px]">
          {renderContactMenuItems({
            contact: primary,
            onOpenDetails: () => onOpenContactDetails(primary.prospectId),
            onAction: onContactAction,
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Overflow — opens a dropdown listing remaining contacts as
          DropdownMenuSub items so each carries its own action menu. */}
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
          <DropdownMenuContent align="start" className="min-w-[280px]">
            {row.contacts.slice(1).map((c) => (
              <DropdownMenuSub key={c.prospectId}>
                <DropdownMenuSubTrigger className="text-xs">
                  <ContactInline contact={c} />
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-[180px]">
                  {renderContactMenuItems({
                    contact: c,
                    onOpenDetails: () => onOpenContactDetails(c.prospectId),
                    onAction: onContactAction,
                  })}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

/** Inline pill-row representation of a single contact: leading sequence
 *  dot + name + status pill + source pill. Used as the trigger label
 *  inside both the primary contact's DropdownMenu and each overflow
 *  contact's DropdownMenuSub. The leading dot reflects the *sequence*
 *  state (active / paused / finished / not_started) for at-a-glance
 *  outreach scanning; status (the funnel stage) sits in its own pill
 *  alongside the source. Email is intentionally omitted — the popup
 *  carries the full address.
 *
 *  When a contact has clicked List-Unsubscribe their `unsubscribedAt`
 *  is set — we replace the source pill with a red "Unsubscribed" pill
 *  so the admin sees the don't-contact warning at a glance and doesn't
 *  manually re-enrol them. */
function ContactInline({ contact }: { contact: SalesContact }) {
  const statusCfg = STATUS_CONFIG[contact.status] ?? STATUS_CONFIG.prospect
  const sequenceCfg = SEQUENCE_CONFIG[contact.sequenceStatus] ?? SEQUENCE_CONFIG.not_started
  const displayName = contact.resolvedContact.name?.trim() || contact.contactName?.trim() || contact.email
  return (
    <>
      <span className="arco-table-status">
        <span className={`arco-table-status-dot ${sequenceCfg.dot}`} />
        <span className="truncate max-w-[160px]">{displayName}</span>
      </span>
      <span className="status-pill">
        <span className={`status-pill-dot ${statusCfg.dot}`} />
        {statusCfg.label}
      </span>
      {contact.unsubscribedAt ? (
        <span className="status-pill" style={{ borderColor: "#fecaca", color: "#b91c1c" }}>
          <span className="status-pill-dot bg-red-500" />
          Unsubscribed
        </span>
      ) : (
        <span className="status-pill">{sourceLabel(contact.source)}</span>
      )}
    </>
  )
}

/** Action menu items for a single contact — Details + sequence
 *  transitions + Remove. Returns a Fragment so the same set can be
 *  used inside both a top-level DropdownMenuContent and a nested
 *  DropdownMenuSubContent. */
function renderContactMenuItems({
  contact,
  onOpenDetails,
  onAction,
}: {
  contact: SalesContact
  onOpenDetails: () => void
  onAction: ContactActionRunner
}) {
  const canDripFromArco = contact.source === "arco" || contact.source === "invites"
  return (
    <>
      <DropdownMenuItem className="text-xs cursor-pointer" onClick={onOpenDetails}>
        Details
      </DropdownMenuItem>
      <DropdownMenuSeparator />

      {canDripFromArco && contact.sequenceStatus === "not_started" && (
        <DropdownMenuItem
          className="text-xs cursor-pointer"
          onClick={() =>
            onAction(
              () => startProspectSequence(contact.prospectId),
              "Sequence started — email sent",
              "Failed to start sequence",
            )
          }
        >
          Start sequence
        </DropdownMenuItem>
      )}

      {canDripFromArco && contact.sequenceStatus === "active" && (
        <DropdownMenuItem
          className="text-xs cursor-pointer"
          onClick={() =>
            onAction(
              () => pauseProspectSequence(contact.prospectId),
              "Sequence paused",
              "Failed to pause",
            )
          }
        >
          Pause sequence
        </DropdownMenuItem>
      )}

      {canDripFromArco && contact.sequenceStatus === "paused" && (
        <DropdownMenuItem
          className="text-xs cursor-pointer"
          onClick={() =>
            onAction(
              () => resumeProspectSequence(contact.prospectId),
              "Sequence resumed",
              "Failed to resume",
            )
          }
        >
          Continue sequence
        </DropdownMenuItem>
      )}

      {canDripFromArco && contact.sequenceStatus === "finished" && (
        <DropdownMenuItem
          className="text-xs cursor-pointer"
          onClick={() =>
            onAction(
              () => restartProspectSequence(contact.prospectId),
              "Sequence restarted",
              "Failed to restart",
            )
          }
        >
          Restart sequence
        </DropdownMenuItem>
      )}

      {canDripFromArco && contact.sequenceStatus === "active" && (
        <DropdownMenuItem
          className="text-xs cursor-pointer"
          onClick={() =>
            onAction(
              () => finishProspectSequence(contact.prospectId),
              "Sequence finished",
              "Failed to finish sequence",
            )
          }
        >
          Finish sequence
        </DropdownMenuItem>
      )}

      <DropdownMenuSeparator />
      <DropdownMenuItem
        className="text-xs cursor-pointer text-red-600"
        onClick={() =>
          onAction(
            () => removeProspectFromFunnel(contact.prospectId),
            "Contact removed",
            "Failed to remove contact",
          )
        }
      >
        Remove from funnel
      </DropdownMenuItem>
    </>
  )
}

/**
 * One contact section inside the company-scoped details popup.
 *
 * Header row is always visible: identity + status/sequence/source pills
 * + chevron. Expanded view renders the per-contact lifecycle, Apollo
 * IDs (if applicable), notes, the outreach sequence (with email-preview
 * links), and the event history. While the per-contact data is still
 * loading, the body collapses to a "Loading…" placeholder so the popup
 * doesn't pop into existence empty and rebuild as data arrives.
 */
function ContactDetailCard({
  contact,
  details,
  expanded,
  onToggleExpand,
  onPreviewEmail,
}: {
  contact: SalesContact
  details: ContactDetailBundle | null
  expanded: boolean
  onToggleExpand: () => void
  onPreviewEmail: (template: string, lang: "en" | "nl") => void
}) {
  const statusCfg = STATUS_CONFIG[contact.status] ?? STATUS_CONFIG.prospect
  const sequenceCfg = SEQUENCE_CONFIG[contact.sequenceStatus] ?? SEQUENCE_CONFIG.not_started

  return (
    <div className="border border-[#e5e5e4] rounded-[3px] overflow-hidden">
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[#fafaf9] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <ContactIdentity contact={contact} />
        </div>
        <span className="flex items-center gap-1.5 shrink-0">
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusCfg.dot}`} />
          <span className="text-[11px] text-[#1c1c1a] whitespace-nowrap">{statusCfg.label}</span>
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${sequenceCfg.dot}`} />
          <span className="text-[11px] text-[#6b6b68] whitespace-nowrap">{sequenceCfg.label}</span>
        </span>
        {contact.unsubscribedAt ? (
          <span className="status-pill shrink-0" style={{ borderColor: "#fecaca", color: "#b91c1c" }}>
            <span className="status-pill-dot bg-red-500" />
            Unsubscribed
          </span>
        ) : (
          <span className="status-pill shrink-0">{sourceLabel(contact.source)}</span>
        )}
        <span
          className={`text-[#a1a1a0] inline-block transition-transform shrink-0 ${expanded ? "rotate-90" : ""}`}
          style={{ width: 8, fontSize: 10 }}
        >
          ▶
        </span>
      </button>

      {expanded && (
        <div className="border-t border-[#e5e5e4] px-3 py-3">
          {!details ? (
            <p className="text-xs text-[#a1a1a0]">Loading…</p>
          ) : (
            <ContactDetailBody
              contact={contact}
              details={details}
              onPreviewEmail={onPreviewEmail}
            />
          )}
        </div>
      )}
    </div>
  )
}

/** Inner body of a contact section once its data has loaded — lifecycle,
 *  Apollo, notes, sequence, events. Split out so the loading shell stays
 *  readable. */
function ContactDetailBody({
  contact,
  details,
  onPreviewEmail,
}: {
  contact: SalesContact
  details: ContactDetailBundle
  onPreviewEmail: (template: string, lang: "en" | "nl") => void
}) {
  const prospect = details.prospect
  const isInvite = contact.source === "invites"
  const initial = (isInvite ? "contacted" : "prospect") as ProspectStatus

  // Lifecycle uses the prospect-level timestamps when we have them; falls
  // back to whatever's on SalesContact for a graceful render.
  const lifecycle: Array<{ label: string; ts: string | null; status: ProspectStatus }> = (() => {
    if (!prospect) {
      return [
        { label: isInvite ? "Invited" : "Prospect", ts: contact.createdAt, status: initial },
        { label: "Contacted", ts: contact.lastEmailSentAt, status: "contacted" },
      ].filter((s) => s.ts) as Array<{ label: string; ts: string; status: ProspectStatus }>
    }
    return [
      { label: isInvite ? "Invited" : "Prospect", ts: prospect.created_at, status: initial },
      { label: "Contacted", ts: prospect.last_email_sent_at, status: "contacted" },
      { label: "Visitor", ts: prospect.landing_visited_at, status: "visitor" },
      { label: "Signup", ts: prospect.signed_up_at, status: "signup" },
      { label: "Draft", ts: prospect.company_created_at, status: "company" },
      { label: "Listed", ts: prospect.converted_at, status: "active" },
    ].filter((s) => s.ts) as Array<{ label: string; ts: string; status: ProspectStatus }>
  })()

  const guessedLang: "en" | "nl" = details.locale
    ?? ((prospect as any)?.country?.toLowerCase().startsWith("nl") || (prospect as any)?.country?.toLowerCase().startsWith("be") ||
        contact.email?.toLowerCase().endsWith(".nl") || contact.email?.toLowerCase().endsWith(".be")
      ? "nl"
      : "en")

  const inviteEvent: ProspectEvent | null =
    isInvite && details.inviteContext && (details.inviteContext.project || details.inviteContext.inviter)
      ? {
          id: `synthetic-company-invited-${contact.prospectId}`,
          prospect_id: contact.prospectId,
          event_type: "company_invited",
          created_at: prospect?.created_at ?? contact.createdAt,
          metadata: {
            project: details.inviteContext.project,
            inviter: details.inviteContext.inviter,
          } as Record<string, unknown>,
        }
      : null
  const allEvents = inviteEvent ? [...details.events, inviteEvent] : details.events

  return (
    <div className="space-y-4">
      {lifecycle.length > 0 && (
        <div>
          <span className="text-[10px] font-medium text-[#a1a1a0] uppercase tracking-wider">Lifecycle</span>
          <div className="mt-1.5 space-y-1">
            {lifecycle.map((s) => (
              <div key={s.label} className="flex items-center gap-2 text-xs">
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_CONFIG[s.status].dot}`} />
                <span className="font-medium text-[#1c1c1a] w-32 shrink-0">{s.label}</span>
                <span className="text-[#6b6b68]">{formatDateShort(s.ts)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {contact.source === "apollo" && prospect && (
        <div>
          <span className="text-[10px] font-medium text-[#a1a1a0] uppercase tracking-wider">Apollo</span>
          <div className="mt-1.5 space-y-1">
            {[
              { label: "Contact ID", value: (prospect as any).apollo_contact_id },
              { label: "Sequence ID", value: (prospect as any).apollo_sequence_id },
              { label: "List ID", value: (prospect as any).apollo_list_id },
            ]
              .filter((r) => r.value)
              .map((r) => (
                <div key={r.label} className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-[#1c1c1a] w-32 shrink-0">{r.label}</span>
                  <span className="text-[#6b6b68] break-all">{r.value}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {prospect?.notes && (
        <div>
          <span className="text-[10px] font-medium text-[#a1a1a0] uppercase tracking-wider">Notes</span>
          <p className="text-xs text-[#6b6b68] mt-0.5">{prospect.notes}</p>
        </div>
      )}

      {details.sequence.length > 0 && (
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-[#a1a1a0] uppercase tracking-wider">Outreach Sequence</span>
            <span className="status-pill">{sourceLabel(contact.source)}</span>
          </div>
          <div className="mt-1.5 space-y-1">
            {details.sequence.map((step) => {
              const statusPill: Record<ProspectSequenceStep["status"], { variant: string; label: string }> = {
                sent:      { variant: "status-pill--green",  label: "Sent" },
                queued:    { variant: "status-pill--blue",   label: "Queued" },
                paused:    { variant: "status-pill--orange", label: "Paused" },
                finished:  { variant: "",                    label: "Finished" },
                cancelled: { variant: "",                    label: "Cancelled" },
                failed:    { variant: "status-pill--orange", label: "Retrying" },
                missing:   { variant: "",                    label: "Not queued" },
              }
              const sc = statusPill[step.status]
              const engagement: { dot: string; label: string } | null = (() => {
                if (step.clickedAt || step.lastEvent === "clicked") return { dot: "bg-purple-500", label: "Clicked" }
                if (step.openedAt || step.lastEvent === "opened") return { dot: "bg-blue-500", label: "Opened" }
                if (step.lastEvent === "delivered") return { dot: "bg-emerald-500", label: "Delivered" }
                if (step.lastEvent === "bounced") return { dot: "bg-red-500", label: "Bounced" }
                if (step.lastEvent === "complained") return { dot: "bg-red-500", label: "Complained" }
                return null
              })()
              return (
                <div key={step.template} className="text-xs">
                  <div
                    className="grid items-center gap-2"
                    style={{ gridTemplateColumns: "minmax(180px, 1fr) minmax(80px, auto) minmax(120px, auto) minmax(100px, auto)" }}
                  >
                    <span className="inline-flex items-center gap-2 min-w-0">
                      {step.template.startsWith("apollo-step-") ? (
                        <span className="text-[#1c1c1a] truncate text-left">
                          {step.label || templateDisplayName(step.template)}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="text-[#016D75] hover:underline truncate cursor-pointer text-left"
                          onClick={() => onPreviewEmail(step.template, guessedLang)}
                        >
                          {templateDisplayName(step.template)}
                        </button>
                      )}
                      <span className="status-pill">{guessedLang.toUpperCase()}</span>
                    </span>
                    <span className={`status-pill ${sc.variant} justify-self-start`}>{sc.label}</span>
                    <span className="text-[#6b6b68] whitespace-nowrap">
                      {step.timestamp ? formatDateShort(step.timestamp) : ""}
                    </span>
                    {engagement ? (
                      <span className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${engagement.dot}`} />
                        <span className="text-[#6b6b68]">{engagement.label}</span>
                      </span>
                    ) : (
                      <span />
                    )}
                  </div>
                  {(() => {
                    const showReason = step.cancelledReason && step.status === "cancelled"
                    const showError = step.lastError && step.status === "failed"
                    if (!showReason && !showError) return null
                    return (
                      <div className="mt-0.5 ml-1 text-[#a1a1a0]">
                        {showReason && <span>· {step.cancelledReason}</span>}
                        {showError && <span className="text-amber-600 break-all"> · {step.lastError}</span>}
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <span className="text-[10px] font-medium text-[#a1a1a0] uppercase tracking-wider">Event History</span>
        {allEvents.length === 0 ? (
          <p className="mt-1 text-xs text-[#a1a1a0]">No events yet.</p>
        ) : (
          <div className="mt-1.5 space-y-1" style={{ maxHeight: 240, overflowY: "auto" }}>
            {allEvents.map((ev) => (
              <EventHistoryRow key={ev.id} event={ev} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function EmailTemplate({ step, delay, subject, body }: { step: number; delay: string; subject: string; body: string }) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="border border-[#e5e5e4] rounded-lg overflow-hidden">
      <div className="bg-[#fafaf9] px-4 py-2.5 flex items-center justify-between border-b border-[#e5e5e4]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-white px-1.5 py-0.5 rounded" style={{ background: "var(--primary, #016D75)" }}>
            Step {step}
          </span>
          <span className="text-[11px] text-[#a1a1a0]">{delay}</span>
        </div>
        <button
          onClick={() => copyToClipboard(`Subject: ${subject}\n\n${body}`)}
          className="text-[11px] text-[#6b6b68] hover:text-[#1c1c1a] transition-colors"
        >
          {copied ? "Copied!" : "Copy email"}
        </button>
      </div>
      <div className="px-4 py-3">
        <p className="text-xs font-medium text-[#1c1c1a] mb-2">Subject: {subject}</p>
        <pre className="text-xs text-[#6b6b68] whitespace-pre-wrap font-sans leading-relaxed">{body}</pre>
      </div>
    </div>
  )
}

// CompanyInfo type kept for backwards compat with any external imports —
// the new aggregator bakes this directly into SalesCompanyRow.claimedCompany.
export type CompanyInfo = { logoUrl: string | null; services: string[]; city: string | null }
