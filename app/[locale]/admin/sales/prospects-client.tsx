"use client"

import { Fragment, useEffect, useRef, useState, useTransition, useCallback } from "react"
import { toast } from "sonner"
import {
  fetchSalesCompanies,
  fetchProspectById,
  fetchProspectEvents,
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
  type SequenceFilterValue,
} from "./actions"
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
import { Checkbox } from "@/components/ui/checkbox"
import { clickedRateColor, deliveredRateColor, openedRateColor } from "@/lib/email-rate-colors"
import { LogOutboundModal } from "./log-outbound-modal"

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

// Sequence-filter dropdown options. Real sequence_status values plus
// the three suppression states that override the row's Sequence
// display (all three render with a red dot).
const SEQUENCE_FILTER_OPTIONS: { value: SequenceFilterValue; label: string; dot: string }[] = [
  { value: "not_started", label: "Not started", dot: "bg-[#a1a1a0]" },
  { value: "active", label: "Active", dot: "bg-[#2563eb]" },
  { value: "paused", label: "Paused", dot: "bg-amber-400" },
  { value: "finished", label: "Finished", dot: "bg-emerald-500" },
  { value: "bounced", label: "Bounced", dot: "bg-red-500" },
  { value: "complained", label: "Complained", dot: "bg-red-500" },
  { value: "unsubscribed", label: "Unsubscribed", dot: "bg-red-500" },
]
const SEQUENCE_FILTER_LABEL: Record<SequenceFilterValue, { label: string; dot: string }> = Object.fromEntries(
  SEQUENCE_FILTER_OPTIONS.map((o) => [o.value, { label: o.label, dot: o.dot }]),
) as Record<SequenceFilterValue, { label: string; dot: string }>

// Channel-filter dropdown options. DB still stores the historical source
// codes; sourceLabel renders them post-Apollo-cutover names.
// "outbound" is a synthetic channel: it doesn't correspond to a
// prospects.source value — it represents any company with at least one
// manual outbound touch logged (call/meeting/manual email/linkedin,
// including no-answer attempts). Read off rows.lastOutboundAt.
const CHANNEL_OPTIONS: { value: string; label: string }[] = [
  { value: "arco", label: "Showcase" },
  { value: "invites", label: "Invite" },
  { value: "apollo", label: "Outreach" },
  { value: "outbound", label: "Outbound" },
]

// Recipient-suppression states from the Resend webhook + List-Unsubscribe.
// All three terminate the sequence — surfaced as a red override in the
// row's Sequence column. Priority complained > bounced > unsubscribed
// (most reputation-damaging first); only one ever renders. Cancellation
// reasons echoing these states are suppressed in the per-email step list
// (the override is enough; we don't need to repeat "bounced" on every
// cancelled row).
const SUPPRESSED_CANCEL_REASONS = new Set(["bounced", "complained", "unsubscribed"])
function getSuppressionState(contact: { bouncedAt: string | null; complainedAt: string | null; unsubscribedAt: string | null }):
  { label: "Bounced" | "Complained" | "Unsubscribed" } | null {
  if (contact.complainedAt) return { label: "Complained" }
  if (contact.bouncedAt) return { label: "Bounced" }
  if (contact.unsubscribedAt) return { label: "Unsubscribed" }
  return null
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
  outbound: "Outbound",
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
    const d = new Date(dateStr)
    const datePart = d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    const timePart = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    return `${datePart} · ${timePart}`
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
  bounced: "Email bounced",
  complained: "Marked as spam",
  company_invited: "Company invited",
  "prospect.landing_visited": "Visited landing page",
}

function formatEventLabel(type: string, metadata?: Record<string, unknown> | null): string {
  // Email send events get specialised when metadata.template is present:
  // "Showcase Intro sent" / "Outreach Follow-up resent" reads better
  // than the generic "Email sent" / "Email resent".
  if (type === "email_sent" || type === "email_resent") {
    const rawTemplate = typeof metadata?.template === "string" ? metadata.template : null
    if (rawTemplate) {
      const friendly =
        TEMPLATE_NAMES[rawTemplate]
        ?? TEMPLATE_NAMES[rawTemplate.replace(/_/g, "-")]
        ?? templateDisplayName(rawTemplate.replace(/_/g, "-"))
      return `${friendly} ${type === "email_resent" ? "resent" : "sent"}`
    }
  }
  // Surface the differentiating bit of metadata inline so the row tells
  // the whole story without an expansion drawer.
  if (type === "removed_from_funnel") {
    const prev = typeof metadata?.previous_status === "string" ? metadata.previous_status : null
    return prev ? `Removed from funnel · was ${prev}` : "Removed from funnel"
  }
  if (EVENT_LABELS[type]) return EVENT_LABELS[type]
  if (type.startsWith("status_changed_to_")) {
    const to = type.slice("status_changed_to_".length).replace(/_/g, " ")
    return `Status → ${to}`
  }
  return type
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// -- Event history row -------------------------------------------------------

const MANUAL_KIND_ICON: Record<string, string> = {
  call: "☎",
  meeting: "📅",
  email: "✉",
  linkedin: "🔗",
  note: "📝",
}

const MANUAL_OUTCOME_LABEL: Record<string, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
  no_answer: "No answer",
}

const MANUAL_OUTCOME_DOT: Record<string, string> = {
  positive: "bg-emerald-500",
  neutral: "bg-[#a1a1a0]",
  negative: "bg-red-500",
  no_answer: "bg-amber-400",
}

function EventHistoryRow({ event }: { event: ProspectEvent }) {
  const [open, setOpen] = useState(false)
  const isManual = event.event_type.startsWith("manual.")
  // Only company_invited carries auto-event data that's worth expanding
  // (project + inviter links). All other auto-events fold their
  // differentiating bits into the label via formatEventLabel.
  const isCompanyInvited = event.event_type === "company_invited"
  const manualBody = isManual
    ? typeof event.metadata?.body === "string" && event.metadata.body.trim()
      ? (event.metadata.body as string)
      : null
    : null
  const expandable =
    (isCompanyInvited && Object.keys(event.metadata ?? {}).length > 0) || Boolean(manualBody)

  if (isManual) {
    const kind = event.event_type.slice("manual.".length)
    const outcome = typeof event.metadata?.outcome === "string" ? (event.metadata.outcome as string) : null
    const author = typeof event.metadata?.author === "string" ? (event.metadata.author as string) : null
    const kindLabel = kind.charAt(0).toUpperCase() + kind.slice(1)
    const icon = MANUAL_KIND_ICON[kind] ?? "•"

    return (
      <div className="text-xs">
        <button
          type="button"
          onClick={() => expandable && setOpen((v) => !v)}
          className={`w-full grid items-baseline gap-2 text-left py-0.5 ${expandable ? "cursor-pointer hover:text-[#1c1c1a]" : "cursor-default"}`}
          style={{ gridTemplateColumns: "90px 1fr" }}
          disabled={!expandable}
        >
          <span className="text-[#a1a1a0] whitespace-nowrap">{formatDateShort(event.created_at)}</span>
          <span className="text-[#1c1c1a] inline-flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <span className="text-[10px] text-[#6b6b68] w-3 inline-block text-center">{icon}</span>
              <span>{kindLabel}</span>
            </span>
            {outcome && MANUAL_OUTCOME_LABEL[outcome] && (
              <span className="inline-flex items-center gap-1 text-[#6b6b68]">
                <span className={`h-1.5 w-1.5 rounded-full ${MANUAL_OUTCOME_DOT[outcome] ?? "bg-[#a1a1a0]"}`} />
                {MANUAL_OUTCOME_LABEL[outcome]}
              </span>
            )}
            {author && <span className="text-[#a1a1a0]">· {author}</span>}
            {expandable && (
              <span
                className={`text-[#a1a1a0] transition-transform ${open ? "rotate-90" : ""}`}
                style={{ fontSize: 10 }}
              >
                ▶
              </span>
            )}
          </span>
        </button>
        {open && manualBody && (
          <p className="mt-1 pl-[98px] text-[#6b6b68] whitespace-pre-wrap">{manualBody}</p>
        )}
      </div>
    )
  }

  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => expandable && setOpen((v) => !v)}
        className={`w-full grid items-baseline gap-2 text-left py-0.5 ${expandable ? "cursor-pointer hover:text-[#1c1c1a]" : "cursor-default"}`}
        style={{ gridTemplateColumns: "90px 1fr" }}
        disabled={!expandable}
      >
        <span className="text-[#a1a1a0] whitespace-nowrap">{formatDateShort(event.created_at)}</span>
        <span className="text-[#1c1c1a] inline-flex items-center gap-1.5">
          {formatEventLabel(event.event_type, event.metadata as Record<string, unknown> | null)}
          {expandable && (
            <span
              className={`text-[#a1a1a0] transition-transform ${open ? "rotate-90" : ""}`}
              style={{ fontSize: 10 }}
            >
              ▶
            </span>
          )}
        </span>
      </button>
      {open && expandable && isCompanyInvited && <CompanyInvitedDetails metadata={event.metadata} />}
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
 * Per-contact data fetched lazily when the contact popup opens.
 */
type ContactDetailBundle = {
  prospect: Prospect | null
  events: ProspectEvent[]
  sequence: ProspectSequenceStep[]
  locale: "en" | "nl" | null
  inviteContext: ProspectInviteContext | null
}

type Props = {
  initialCompanies: SalesCompanyRow[]
  initialTotalCompanies: number
  initialFunnel: SalesFunnel
  initialEmailsSent: number
  initialOutboundDueCount: number
  currentApolloListId?: string | null
  apolloProspectsCount?: number
}

export function ProspectsClient({
  initialCompanies,
  initialTotalCompanies,
  initialFunnel,
  initialEmailsSent,
  initialOutboundDueCount,
  currentApolloListId = null,
  apolloProspectsCount = 0,
}: Props) {
  const [companies, setCompanies] = useState(initialCompanies)
  const [totalCompanies, setTotalCompanies] = useState(initialTotalCompanies)
  const [funnel, setFunnel] = useState(initialFunnel)
  const [totalEmailsSent, setTotalEmailsSent] = useState(initialEmailsSent)
  const [statusFilter, setStatusFilter] = useState<ProspectStatus[]>([])
  const [sourceFilter, setSourceFilter] = useState<string[]>([])
  const [sequenceFilter, setSequenceFilter] = useState<SequenceFilterValue[]>([])
  // Toggle for the Outbound-due button: when true, the table only renders
  // companies with a next outbound today or in the past. Count next to the
  // button stays global (initialOutboundDueCount) — it doesn't shrink to
  // zero when the filter is active.
  const [outboundDueOnly, setOutboundDueOnly] = useState(false)
  const [outboundDueCount, setOutboundDueCount] = useState(initialOutboundDueCount)
  // Multi-select row state — mirrors the /admin/companies pattern. Keyed
  // on row.rowId; bulk actions iterate the underlying contacts of every
  // selected row. Cleared on successful bulk action or filter change.
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set())
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)
  const [search, setSearch] = useState("")
  // Per-contact details popup. One click = one contact = one popup, so
  // the fetched details bundle is a single value (not a map). The row is
  // kept alongside the contact so the popup header can still render the
  // company logo / name context.
  const [detailContact, setDetailContact] = useState<
    { contact: SalesContact; row: SalesCompanyRow } | null
  >(null)
  const [contactDetail, setContactDetail] = useState<ContactDetailBundle | null>(null)
  const [previewEmail, setPreviewEmail] = useState<{ template: string; lang: string } | null>(null)
  const [logOutboundTarget, setLogOutboundTarget] = useState<
    {
      prospectId: string
      contactLabel: string
      companyLabel: string
      contactEmail: string | null
      contactPhone: string | null
      contactAvatarUrl: string | null
    } | null
  >(null)
  const [showStatusGuide, setShowStatusGuide] = useState(false)
  const [showApolloSync, setShowApolloSync] = useState(false)
  const [syncListId, setSyncListId] = useState("")
  const [editingListId, setEditingListId] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
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
        sources: sourceFilter,
        sequences: sequenceFilter,
        search,
        outboundDueOnly,
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
      setOutboundDueCount(result.outboundDueCount)
      setOffset(off)
      setHasMore(result.totalCompanies > off + result.companies.length)
    })
  }, [statusFilter, sourceFilter, sequenceFilter, search, outboundDueOnly, sortBy, sortDir])

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

  const handleFilterChange = useCallback((opts: {
    statuses?: ProspectStatus[]
    sources?: string[]
    sequences?: SequenceFilterValue[]
    outboundDueOnly?: boolean
  }) => {
    if (opts.statuses !== undefined) setStatusFilter(opts.statuses)
    if (opts.sources !== undefined) setSourceFilter(opts.sources)
    if (opts.sequences !== undefined) setSequenceFilter(opts.sequences)
    if (opts.outboundDueOnly !== undefined) setOutboundDueOnly(opts.outboundDueOnly)
    const s = opts.statuses ?? statusFilter
    const src = opts.sources ?? sourceFilter
    const seq = opts.sequences ?? sequenceFilter
    const due = opts.outboundDueOnly ?? outboundDueOnly
    startTransition(async () => {
      const result = await fetchSalesCompanies({
        statuses: s, sources: src, sequences: seq, search,
        outboundDueOnly: due,
        offset: 0, limit: 50, sortBy, sortDir,
      })
      setCompanies(result.companies)
      setTotalCompanies(result.totalCompanies)
      setFunnel(result.funnel)
      setOutboundDueCount(result.outboundDueCount)
      setTotalEmailsSent(result.companies.reduce((sum, c) => sum + c.emailsSent, 0))
      setOffset(0)
      setHasMore(result.totalCompanies > result.companies.length)
      // Any narrowing invalidates the current selection — otherwise a
      // hidden selected row would still be picked up by bulk actions.
      setSelectedRowIds(new Set())
    })
  }, [statusFilter, sourceFilter, sequenceFilter, search, outboundDueOnly, sortBy, sortDir])

  const toggleStatus = useCallback((status: ProspectStatus) => {
    const next = statusFilter.includes(status)
      ? statusFilter.filter((s) => s !== status)
      : [...statusFilter, status]
    handleFilterChange({ statuses: next })
  }, [statusFilter, handleFilterChange])

  const toggleSource = useCallback((src: string) => {
    const next = sourceFilter.includes(src)
      ? sourceFilter.filter((s) => s !== src)
      : [...sourceFilter, src]
    handleFilterChange({ sources: next })
  }, [sourceFilter, handleFilterChange])

  const toggleSequence = useCallback((seq: SequenceFilterValue) => {
    const next = sequenceFilter.includes(seq)
      ? sequenceFilter.filter((s) => s !== seq)
      : [...sequenceFilter, seq]
    handleFilterChange({ sequences: next })
  }, [sequenceFilter, handleFilterChange])

  const handleSearch = useCallback(() => {
    reload({ offset: 0 })
  }, [reload])

  // Live search: debounce typed input and re-fetch automatically — matches
  // the admin/companies search-as-you-type behaviour. Skip on first render.
  const firstSearchRender = useRef(true)
  useEffect(() => {
    if (firstSearchRender.current) { firstSearchRender.current = false; return }
    const t = setTimeout(() => reload({ offset: 0 }), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const handleLoadMore = useCallback(() => {
    reload({ offset: offset + 50, append: true })
  }, [reload, offset])

  const toggleSort = useCallback((field: SalesSortBy) => {
    // Default first-click direction is "desc" for date columns (most recent
    // first) — except next_scheduled_at, where the natural reading is
    // "soonest pending send first" (asc).
    const defaultDir: SalesSortDir = field === "next_scheduled_at" ? "asc" : "desc"
    const nextDir: SalesSortDir = sortBy === field ? (sortDir === "desc" ? "asc" : "desc") : defaultDir
    setSortBy(field)
    setSortDir(nextDir)
    startTransition(async () => {
      const result = await fetchSalesCompanies({
        statuses: statusFilter, sources: sourceFilter, sequences: sequenceFilter, search,
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
  // Popup opens for exactly one contact at a time — either the primary
  // (row-level "Details" click) or a specific contact from the +N-more
  // menu. Fires the ~4 detail queries for just that one contact.
  const openContactPopup = useCallback((row: SalesCompanyRow, contact: SalesContact) => {
    setDetailContact({ contact, row })
    setContactDetail(null)
    startTransition(async () => {
      const [prospect, eventsResult, sequenceResult, inviteResult] = await Promise.all([
        fetchProspectById(contact.prospectId),
        fetchProspectEvents(contact.prospectId),
        getProspectSequence(contact.prospectId),
        contact.source === "invites"
          ? getProspectInviteContext(contact.prospectId)
          : Promise.resolve({ success: true, context: null } as const),
      ])
      setContactDetail({
        prospect,
        events: eventsResult.events,
        sequence: sequenceResult.success ? sequenceResult.steps ?? [] : [],
        locale: sequenceResult.success ? sequenceResult.locale ?? null : null,
        inviteContext: inviteResult.success ? inviteResult.context ?? null : null,
      })
    })
  }, [])

  // Find the row + contact by prospect id and open the single-contact
  // popup. Used by both the row-level "Details" action (passes the
  // primary contact's prospectId) and the +N-more menu.
  const openContactDetails = useCallback((prospectId: string) => {
    const row = companies.find((r) => r.contacts.some((c) => c.prospectId === prospectId))
    if (!row) return
    const contact = row.contacts.find((c) => c.prospectId === prospectId)
    if (!contact) return
    openContactPopup(row, contact)
  }, [companies, openContactPopup])

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
        setSyncResult(`Imported ${data.synced} contacts`)
        reload({ offset: 0 })
      } else {
        setSyncResult(`Error: ${data.error}`)
      }
    } catch {
      setSyncResult("Failed to import contacts")
    } finally {
      setIsSyncing(false)
    }
  }

  const closeDetails = () => {
    setDetailContact(null)
    setContactDetail(null)
  }

  // ── Multi-select helpers ───────────────────────────────────────────────
  const allVisibleSelected = companies.length > 0 && companies.every((r) => selectedRowIds.has(r.rowId))
  const someVisibleSelected = companies.some((r) => selectedRowIds.has(r.rowId))

  const toggleAllVisible = useCallback((value: boolean) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev)
      if (value) companies.forEach((r) => next.add(r.rowId))
      else companies.forEach((r) => next.delete(r.rowId))
      return next
    })
  }, [companies])

  const toggleRow = useCallback((rowId: string, value: boolean) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev)
      if (value) next.add(rowId)
      else next.delete(rowId)
      return next
    })
  }, [])

  // Fan out a per-prospect action across every contact of every selected
  // row. Reports the count that succeeded so the toast is honest even if
  // half of them are already in the target state (e.g. paused).
  const runBulkContactAction = useCallback(
    async (
      actionLabel: string,
      fn: (prospectId: string) => Promise<{ success: boolean; error?: string }>,
    ) => {
      const selectedRows = companies.filter((r) => selectedRowIds.has(r.rowId))
      if (selectedRows.length === 0) return
      setIsBulkProcessing(true)
      let success = 0
      let failure = 0
      for (const row of selectedRows) {
        for (const contact of row.contacts) {
          const result = await fn(contact.prospectId)
          if (result.success) success++
          else failure++
        }
      }
      if (success > 0) toast.success(`${actionLabel} — ${success} ${success === 1 ? "contact" : "contacts"}`)
      if (failure > 0 && success === 0) toast.error(`${actionLabel} failed`)
      setSelectedRowIds(new Set())
      setIsBulkProcessing(false)
      reload({ offset, append: false })
    },
    [companies, selectedRowIds, reload, offset],
  )

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
            onClick={() => {
              setSyncListId(currentApolloListId ?? "")
              setShowApolloSync(true)
            }}
            className="h-8 px-3 text-xs font-medium border border-[#e5e5e4] rounded-[3px] text-[#6b6b68] hover:bg-[#fafaf9] transition-colors"
          >
            Import contacts
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
                        style={{ width: 132 }}
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
              className="w-full h-9 pl-8 pr-3 text-xs border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#a1a1a0] transition-colors"
            />
            <svg className="absolute left-2.5 top-2.5 text-[#a1a1a0]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Outbound-due toggle — accent button sitting left of the Status
              filter, mirroring the Review CTA on /admin/projects. Always
              renders when the global count is > 0 so the rep can see how
              many companies are due for outbound at a glance; clicking
              toggles the table-level filter. */}
          {outboundDueCount > 0 && (
            <button
              type="button"
              onClick={() => handleFilterChange({ outboundDueOnly: !outboundDueOnly })}
              className="btn-primary"
              style={{
                fontSize: 13,
                padding: "6px 16px",
                borderRadius: 3,
                opacity: outboundDueOnly ? 1 : 0.92,
                boxShadow: outboundDueOnly ? "inset 0 0 0 2px rgba(0,0,0,0.18)" : undefined,
              }}
              aria-pressed={outboundDueOnly}
            >
              Outbound ({outboundDueCount})
            </button>
          )}
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
                  if (statusFilter.length > 0) handleFilterChange({ statuses: [] })
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
          {/* Multi-select sequence filter — empty selection = all sequences. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-[170px] h-9 px-3 text-xs border border-[#e5e5e4] rounded-[3px] bg-white hover:border-[#a1a1a0] transition-colors flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-1.5 truncate">
                  {sequenceFilter.length === 0 ? (
                    <span className="text-[#6b6b68]">All sequences</span>
                  ) : sequenceFilter.length === 1 ? (
                    <>
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${SEQUENCE_FILTER_LABEL[sequenceFilter[0]].dot}`} />
                      <span className="truncate">{SEQUENCE_FILTER_LABEL[sequenceFilter[0]].label}</span>
                    </>
                  ) : (
                    <span>{sequenceFilter.length} sequences</span>
                  )}
                </span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-[#a1a1a0]">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[200px]">
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault()
                  if (sequenceFilter.length > 0) handleFilterChange({ sequences: [] })
                }}
                className="text-xs"
              >
                Clear selection
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {SEQUENCE_FILTER_OPTIONS.map((o) => (
                <DropdownMenuCheckboxItem
                  key={o.value}
                  checked={sequenceFilter.includes(o.value)}
                  onCheckedChange={() => toggleSequence(o.value)}
                  onSelect={(e) => e.preventDefault()}
                  className="text-xs"
                >
                  <span className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${o.dot}`} />
                    {o.label}
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Multi-select channel filter — empty selection = all channels. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-[150px] h-9 px-3 text-xs border border-[#e5e5e4] rounded-[3px] bg-white hover:border-[#a1a1a0] transition-colors flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-1.5 truncate">
                  {sourceFilter.length === 0 ? (
                    <span className="text-[#6b6b68]">All channels</span>
                  ) : sourceFilter.length === 1 ? (
                    <span className="truncate">{sourceLabel(sourceFilter[0])}</span>
                  ) : (
                    <span>{sourceFilter.length} channels</span>
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
                  if (sourceFilter.length > 0) handleFilterChange({ sources: [] })
                }}
                className="text-xs"
              >
                Clear selection
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {CHANNEL_OPTIONS.map((o) => (
                <DropdownMenuCheckboxItem
                  key={o.value}
                  checked={sourceFilter.includes(o.value)}
                  onCheckedChange={() => toggleSource(o.value)}
                  onSelect={(e) => e.preventDefault()}
                  className="text-xs"
                >
                  {o.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Bulk actions bar — mirrors /admin/companies. Appears when any
          row is selected; iterates every contact of every selected row
          for prospect-level actions (Pause / Remove). */}
      {selectedRowIds.size > 0 && (() => {
        const selectedCount = selectedRowIds.size
        const selectedContacts = companies
          .filter((r) => selectedRowIds.has(r.rowId))
          .reduce((n, r) => n + r.contacts.length, 0)
        return (
          <div className="mb-3 flex items-center gap-3 px-4 py-2.5 bg-[#f5f5f4] rounded-[3px] border border-[#e5e5e4]">
            <span className="text-xs text-[#6b6b68]">
              {selectedCount} {selectedCount === 1 ? "company" : "companies"} selected
              {selectedContacts !== selectedCount && ` · ${selectedContacts} contacts`}
            </span>
            <div className="flex items-center gap-2">
              <button
                className="text-xs px-2.5 py-1 rounded-[3px] border border-[#e5e5e4] bg-white hover:bg-[#f5f5f4] transition-colors"
                disabled={isBulkProcessing}
                onClick={() => runBulkContactAction("Sequence paused", pauseProspectSequence)}
              >
                Pause sequence
              </button>
              <button
                className="text-xs px-2.5 py-1 rounded-[3px] border border-red-200 bg-white text-red-600 hover:bg-red-50 transition-colors"
                disabled={isBulkProcessing}
                onClick={() => runBulkContactAction("Removed from funnel", removeProspectFromFunnel)}
              >
                Remove
              </button>
              <button
                className="text-xs px-2.5 py-1 rounded-[3px] border border-[#e5e5e4] bg-white hover:bg-[#f5f5f4] transition-colors"
                disabled={isBulkProcessing}
                onClick={() => setSelectedRowIds(new Set())}
              >
                Clear
              </button>
            </div>
            {isBulkProcessing && <span className="text-xs text-[#a1a1a0]">Processing…</span>}
          </div>
        )
      })()}

      {/* Companies table — one row per company, contacts column expands inline. */}
      <div className="arco-table-wrap">
        <table className="arco-table" style={{ minWidth: 1200 }}>
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <Checkbox
                  checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                  onCheckedChange={(v) => toggleAllVisible(!!v)}
                  aria-label="Select all"
                  className="h-3.5 w-3.5"
                />
              </th>
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
                title="Sort by last email sent"
              >
                <span className="inline-flex items-center justify-end gap-1">
                  Last email
                  {sortBy === "last_contacted_at" && (
                    <span className="text-[10px] text-[#a1a1a0]">{sortDir === "desc" ? "↓" : "↑"}</span>
                  )}
                </span>
              </th>
              <th
                style={{ textAlign: "right", cursor: "pointer", userSelect: "none" }}
                onClick={() => toggleSort("next_scheduled_at")}
                title="Sort by next email scheduled"
              >
                <span className="inline-flex items-center justify-end gap-1">
                  Next email
                  {sortBy === "next_scheduled_at" && (
                    <span className="text-[10px] text-[#a1a1a0]">{sortDir === "desc" ? "↓" : "↑"}</span>
                  )}
                </span>
              </th>
              <th
                style={{ textAlign: "right", cursor: "pointer", userSelect: "none" }}
                onClick={() => toggleSort("last_outbound_at")}
                title="Sort by last manual outbound touch"
              >
                <span className="inline-flex items-center justify-end gap-1">
                  Last outbound
                  {sortBy === "last_outbound_at" && (
                    <span className="text-[10px] text-[#a1a1a0]">{sortDir === "desc" ? "↓" : "↑"}</span>
                  )}
                </span>
              </th>
              <th
                style={{ textAlign: "right", cursor: "pointer", userSelect: "none" }}
                onClick={() => toggleSort("next_outbound_at")}
                title="Sort by next outbound follow-up"
              >
                <span className="inline-flex items-center justify-end gap-1">
                  Next outbound
                  {sortBy === "next_outbound_at" && (
                    <span className="text-[10px] text-[#a1a1a0]">{sortDir === "desc" ? "↓" : "↑"}</span>
                  )}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 && (
              <tr>
                <td colSpan={15} style={{ height: 96, textAlign: "center", color: "var(--text-disabled)" }}>
                  No companies found.
                </td>
              </tr>
            )}
            {companies.map((row) => (
              <CompanyRowView
                key={row.rowId}
                row={row}
                selected={selectedRowIds.has(row.rowId)}
                onToggleSelect={(v) => toggleRow(row.rowId, v)}
                onOpenContactDetails={openContactDetails}
                onContactAction={runContactAction}
                onLogOutbound={(contact, companyName, companyPhone) =>
                  setLogOutboundTarget({
                    prospectId: contact.prospectId,
                    contactLabel:
                      contact.resolvedContact.name?.trim() || contact.email || "Unnamed contact",
                    companyLabel: companyName,
                    contactEmail: contact.resolvedContact.email ?? contact.email ?? null,
                    contactPhone: companyPhone,
                    contactAvatarUrl: contact.resolvedContact.avatarUrl ?? null,
                  })
                }
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
      {detailContact && (() => {
        const { contact, row } = detailContact
        const displayName = contact.resolvedContact.name?.trim() || contact.contactName?.trim() || contact.email
        const contactEmail = contact.resolvedContact.email ?? contact.email ?? null
        const companyPhone = row.claimedCompany?.phone ?? null
        return (
          <div className="popup-overlay" onClick={closeDetails}>
            <div
              className="popup-card"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 720, maxHeight: "90vh", overflowY: "auto" }}
            >
              <div className="popup-header">
                <div className="min-w-0">
                  <h3 className="arco-section-title truncate">{displayName}</h3>
                  <div className="text-xs text-[#6b6b68] truncate">
                    {row.claimedCompany?.slug ? (
                      <a
                        href={`/professionals/${row.claimedCompany.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {row.companyName}
                      </a>
                    ) : (
                      row.companyName
                    )}
                    {contactEmail && (
                      <>
                        <span className="text-[#d4d4d3]"> · </span>
                        <span>{contactEmail}</span>
                      </>
                    )}
                    {companyPhone && (
                      <>
                        <span className="text-[#d4d4d3]"> · </span>
                        <span>{companyPhone}</span>
                      </>
                    )}
                  </div>
                </div>
                <button type="button" className="popup-close" onClick={closeDetails} aria-label="Close">✕</button>
              </div>

              <div className="mt-3">
                {!contactDetail ? (
                  <p className="text-xs text-[#a1a1a0]">Loading…</p>
                ) : (
                  <ContactDetailBody
                    contact={contact}
                    details={contactDetail}
                    onPreviewEmail={(template, lang) => setPreviewEmail({ template, lang })}
                  />
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Log outbound modal — opens from the contact dropdown in any row */}
      {logOutboundTarget && (
        <LogOutboundModal
          open
          onOpenChange={(open) => {
            if (!open) setLogOutboundTarget(null)
          }}
          prospectId={logOutboundTarget.prospectId}
          contactLabel={logOutboundTarget.contactLabel}
          companyLabel={logOutboundTarget.companyLabel}
          contactEmail={logOutboundTarget.contactEmail}
          contactPhone={logOutboundTarget.contactPhone}
          contactAvatarUrl={logOutboundTarget.contactAvatarUrl}
          onLogged={() => {
            // The trigger updates prospects.last_outbound_at; refresh the
            // table + popup so the new entry surfaces immediately.
            reload({ offset, append: false })
            // If the single-contact popup is open, re-fetch its events so
            // the new manual entry shows in Activity.
            if (detailContact) openContactPopup(detailContact.row, detailContact.contact)
          }}
        />
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

      {/* Import contacts popup. Imports a Apollo list of contacts into
          prospects + auto-enrols them on the Outreach drip. List ID is
          stored on each row so we can re-import a list later. */}
      {showApolloSync && (
        <div className="popup-overlay" onClick={() => setShowApolloSync(false)}>
          <div className="popup-card" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <h3 className="arco-section-title">Import contacts</h3>
              <button type="button" className="popup-close" onClick={() => setShowApolloSync(false)} aria-label="Close">✕</button>
            </div>

            <p style={{ margin: "0 0 12px", fontSize: 11, color: "#a1a1a0", lineHeight: 1.5 }}>
              Pulls contacts from an Apollo list into prospects and auto-enrols them on the Outreach sequence. Find the list ID in Apollo → Lists → click a list → the ID is in the URL.
            </p>

            <label className="text-xs font-medium text-[#6b6b68] block mb-1">List ID</label>
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
              {apolloProspectsCount} contact{apolloProspectsCount === 1 ? "" : "s"} imported so far.
            </p>

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
                onClick={handleSyncList}
                disabled={isSyncing || !syncListId.trim()}
                className="h-9 px-4 text-xs font-medium rounded-[3px] text-white transition-colors disabled:opacity-50"
                style={{ background: "var(--primary, #016D75)" }}
              >
                {isSyncing ? "Importing…" : "Import"}
              </button>
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
 * Contacts column mirrors the Projects column on /admin/companies:
 * the primary contact is rendered inline with `dot + name + status pill +
 * sequence pill` and is itself a dropdown trigger for the per-contact
 * action menu. Companies with multiple contacts get a "+N more" link
 * below that opens a dropdown listing every other contact as a
 * DropdownMenuSub — sub-trigger shows the same identity row, sub-content
 * carries the same action menu. The row never expands inline.
 */
function CompanyRowView({
  row,
  selected,
  onToggleSelect,
  onOpenContactDetails,
  onContactAction,
  onLogOutbound,
}: {
  row: SalesCompanyRow
  selected: boolean
  onToggleSelect: (value: boolean) => void
  onOpenContactDetails: (prospectId: string) => void
  onContactAction: ContactActionRunner
  onLogOutbound: (contact: SalesContact, companyName: string, companyPhone: string | null) => void
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
  // Suppression overrides the underlying sequence pill — when the
  // primary contact has bounced / complained / unsubscribed the
  // sequence is effectively over, so we surface that as the row's
  // Sequence display. Multi-contact rows use the primary contact's
  // state since the row click also opens the primary's popup.
  const suppression = getSuppressionState(row.primaryContact)

  return (
    <tr
      onClick={() => onOpenContactDetails(row.primaryContact.prospectId)}
      style={{ cursor: "pointer" }}
      className="hover:bg-[#fafaf9]"
    >
      {/* Row-select checkbox — stops row-click bubble so ticking a row
          doesn't also open its details popup. */}
      <td onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={selected}
          onCheckedChange={(v) => onToggleSelect(!!v)}
          aria-label="Select row"
          className="h-3.5 w-3.5"
        />
      </td>

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
                onClick={(e) => e.stopPropagation()}
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

      {/* Contacts — own onClick handler stops the row's click bubble so
          the contact dropdown / +N more popover open without the row's
          Details popup also firing on top. */}
      <td onClick={(e) => e.stopPropagation()}>
        <ContactsCell
          row={row}
          onOpenContactDetails={onOpenContactDetails}
          onContactAction={onContactAction}
          onLogOutbound={onLogOutbound}
        />
      </td>

      {/* Status (aggregated) */}
      <td>
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusCfg.dot}`} />
          <span className="arco-table-primary" style={{ whiteSpace: "nowrap" }}>{statusCfg.label}</span>
        </div>
      </td>

      {/* Sequence (aggregated single value, or suppression override) */}
      <td>
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${suppression ? "bg-red-500" : sequenceCfg.dot}`} />
          <span className="arco-table-primary" style={{ whiteSpace: "nowrap", fontWeight: 400 }}>
            {suppression ? suppression.label : sequenceCfg.label}
          </span>
        </div>
      </td>

      {/* Source (multi-pill) — Outbound is appended when any contact has
          a manual outbound touch logged (attempts included). */}
      <td>
        <div className="flex flex-wrap items-center gap-1">
          {row.sources.map((s) => (
            <span key={s} className="status-pill">{sourceLabel(s)}</span>
          ))}
          {row.lastOutboundAt && (
            <span className="status-pill">Outbound</span>
          )}
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
      <td className="arco-table-nowrap" style={{ textAlign: "right", color: "var(--text-disabled)" }}>
        {row.nextScheduledAt ? formatDate(row.nextScheduledAt) : <span className="text-[#c4c4c2]">—</span>}
      </td>
      <td className="arco-table-nowrap" style={{ textAlign: "right", color: "var(--text-disabled)" }}>
        {row.lastOutboundAt ? formatDate(row.lastOutboundAt) : <span className="text-[#c4c4c2]">—</span>}
      </td>
      <td className="arco-table-nowrap" style={{ textAlign: "right", color: "var(--text-disabled)" }}>
        {row.nextOutboundAt ? (
          <span className="inline-flex items-center gap-1.5">
            {new Date(row.nextOutboundAt) < new Date() && (
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" title="Overdue" />
            )}
            {formatDate(row.nextOutboundAt)}
          </span>
        ) : (
          <span className="text-[#c4c4c2]">—</span>
        )}
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
  onLogOutbound,
}: {
  row: SalesCompanyRow
  onOpenContactDetails: (prospectId: string) => void
  onContactAction: ContactActionRunner
  onLogOutbound: (contact: SalesContact, companyName: string, companyPhone: string | null) => void
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
            onLogOutbound: () => onLogOutbound(primary, row.companyName, row.claimedCompany?.phone ?? null),
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
                    onLogOutbound: () => onLogOutbound(c, row.companyName, row.claimedCompany?.phone ?? null),
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
 *  Suppression states (bounced / complained / unsubscribed) override
 *  the row's Sequence column instead — keeping the source pill stable
 *  here so the admin can still identify the channel at a glance. */
function ContactInline({ contact }: { contact: SalesContact }) {
  const statusCfg = STATUS_CONFIG[contact.status] ?? STATUS_CONFIG.prospect
  const sequenceCfg = SEQUENCE_CONFIG[contact.sequenceStatus] ?? SEQUENCE_CONFIG.not_started
  const suppression = getSuppressionState(contact)
  const displayName = contact.resolvedContact.name?.trim() || contact.contactName?.trim() || contact.email
  return (
    <>
      <span className="arco-table-status">
        <span className={`arco-table-status-dot ${suppression ? "bg-red-500" : sequenceCfg.dot}`} />
        <span className="truncate max-w-[160px]">{displayName}</span>
      </span>
      <span className="status-pill">
        <span className={`status-pill-dot ${statusCfg.dot}`} />
        {statusCfg.label}
      </span>
      <span className="status-pill">{sourceLabel(contact.source)}</span>
      {contact.lastOutboundAt && (
        <span className="status-pill">Outbound</span>
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
  onLogOutbound,
}: {
  contact: SalesContact
  onOpenDetails: () => void
  onAction: ContactActionRunner
  onLogOutbound: () => void
}) {
  // All three sales-source prospects can be enrolled in / managed via
  // an Arco-controlled drip now: arco (Showcase), invites (Invite),
  // apollo (Outreach). Renamed for clarity but kept as the same gate
  // so the rest of the menu stays untouched.
  const canDripFromArco =
    contact.source === "arco"
    || contact.source === "invites"
    || contact.source === "apollo"
  // Suppression states (bounced / complained / unsubscribed) terminate
  // the sequence — Resend's auto-stop short-circuits any new send to
  // this address before it leaves Arco, so the send-action items get
  // greyed out instead of hidden. Kept visible to signal "this menu
  // exists, just not for this contact" rather than disappearing.
  const isSuppressed = !!getSuppressionState(contact)
  return (
    <>
      <DropdownMenuItem className="text-xs cursor-pointer" onClick={onOpenDetails}>
        Details
      </DropdownMenuItem>
      <DropdownMenuItem className="text-xs cursor-pointer" onClick={onLogOutbound}>
        Log outbound
      </DropdownMenuItem>
      <DropdownMenuSeparator />

      {canDripFromArco && contact.sequenceStatus === "not_started" && (
        <DropdownMenuItem
          disabled={isSuppressed}
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
          disabled={isSuppressed}
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
          disabled={isSuppressed}
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
          disabled={isSuppressed}
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
          disabled={isSuppressed}
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

  // Earliest sent timestamp across the loaded sequence steps — this is
  // when the contact actually entered the Contacted stage. We can't use
  // prospect.last_email_sent_at (which gets bumped on every send and
  // would mislabel the stage as "started after the most recent email").
  const firstSentAt: string | null = (() => {
    const sentTimestamps = details.sequence
      .filter((step) => step.status === "sent" && step.timestamp)
      .map((step) => step.timestamp as string)
      .sort()
    return sentTimestamps[0] ?? null
  })()

  // Lifecycle uses the prospect-level timestamps when we have them; falls
  // back to whatever's on SalesContact for a graceful render. Stages
  // that haven't been reached yet are filtered out so the list stays
  // tight to actual history.
  const lifecycle: Array<{ label: string; ts: string | null; status: ProspectStatus }> = (() => {
    if (!prospect) {
      return [
        { label: isInvite ? "Invited" : "Prospect", ts: contact.createdAt, status: initial },
        { label: "Contacted", ts: firstSentAt ?? contact.lastEmailSentAt, status: "contacted" },
      ].filter((s) => s.ts) as Array<{ label: string; ts: string; status: ProspectStatus }>
    }
    return [
      { label: isInvite ? "Invited" : "Prospect", ts: prospect.created_at, status: initial },
      { label: "Contacted", ts: firstSentAt ?? prospect.last_email_sent_at, status: "contacted" },
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
              <div
                key={s.label}
                className="grid items-center gap-2 text-xs"
                style={{ gridTemplateColumns: "90px 1fr" }}
              >
                <span className="text-[#a1a1a0] whitespace-nowrap">{formatDateShort(s.ts)}</span>
                <span className="inline-flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_CONFIG[s.status].dot}`} />
                  <span className="text-[#1c1c1a]">{s.label}</span>
                </span>
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
          <span className="text-[10px] font-medium text-[#a1a1a0] uppercase tracking-wider">Outreach Sequence</span>
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
                    style={{ gridTemplateColumns: "90px 210px auto" }}
                  >
                    <span className="text-[#a1a1a0] whitespace-nowrap">
                      {step.timestamp ? formatDateShort(step.timestamp) : "—"}
                    </span>
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
                      <span className={`status-pill ${sc.variant}`}>{sc.label}</span>
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
                    // Suppress reasons that are already surfaced as the
                    // contact's row-level Sequence override (bounced /
                    // complained / unsubscribed) — the override carries
                    // the signal once, no need to repeat it on every
                    // cancelled step beneath the actual triggering send.
                    const reason = step.cancelledReason?.trim().toLowerCase() ?? ""
                    const showReason =
                      step.cancelledReason
                      && step.status === "cancelled"
                      && !SUPPRESSED_CANCEL_REASONS.has(reason)
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
        <span className="text-[10px] font-medium text-[#a1a1a0] uppercase tracking-wider">Activity</span>
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

// CompanyInfo type kept for backwards compat with any external imports —
// the new aggregator bakes this directly into SalesCompanyRow.claimedCompany.
export type CompanyInfo = { logoUrl: string | null; services: string[]; city: string | null }
