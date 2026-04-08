"use client"

import { Fragment, useEffect, useRef, useState, useTransition, useCallback } from "react"
import { toast } from "sonner"
import {
  fetchProspects,
  fetchProspectEvents,
  addProspect,
  updateProspectStatus,
  deleteProspect,
  fetchFunnel,
  startProspectSequence,
  updateProspectEmail,
  pauseProspectSequence,
  resumeProspectSequence,
  restartProspectSequence,
  getProspectSequence,
  type Prospect,
  type ProspectFunnel,
  type ProspectStatus,
  type ProspectEvent,
  type ProspectSequenceStep,
  type SequenceStatus,
  syncResendEmailStats,
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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from "lucide-react"

// -- Status config -----------------------------------------------------------

const STATUS_CONFIG: Record<ProspectStatus, { label: string; cls: string; dot: string }> = {
  prospect: { label: "Prospect", cls: "bg-amber-50 text-amber-700", dot: "bg-[#f59e0b]" },
  contacted: { label: "Contacted", cls: "bg-amber-50 text-amber-700", dot: "bg-[#f59e0b]" },
  visitor: { label: "Visitor", cls: "bg-blue-50 text-blue-700", dot: "bg-[#2563eb]" },
  signup: { label: "Signup", cls: "bg-blue-50 text-blue-700", dot: "bg-[#2563eb]" },
  company: { label: "Draft", cls: "bg-blue-50 text-blue-700", dot: "bg-[#2563eb]" },
  active: { label: "Listed", cls: "bg-purple-50 text-purple-800 font-semibold", dot: "bg-[#7c3aed]" },
}

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

// -- Helpers -----------------------------------------------------------------

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—"
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    })
  } catch { return dateStr }
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "—"
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
  } catch { return dateStr }
}

function conversionRate(from: number, to: number): string {
  if (from === 0) return "0%"
  return `${Math.round((to / from) * 100)}%`
}

function exportToCsv(prospects: Prospect[]) {
  const headers = [
    "Email", "Contact Name", "Company", "Status", "Sequence", "Source", "City",
    "Emails Sent", "Emails Delivered", "Created",
  ]
  const rows = prospects.map((p) => [
    p.email,
    p.contact_name ?? "",
    p.company_name ?? "",
    p.status,
    p.sequence_status ?? "not_started",
    p.source,
    p.city ?? "",
    p.emails_sent,
    p.emails_delivered,
    p.created_at,
  ])
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `prospects-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
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

export type CompanyInfo = { logoUrl: string | null; services: string[]; city: string | null }

type Props = {
  initialProspects: Prospect[]
  initialFunnel: ProspectFunnel
  companyMap?: Record<string, CompanyInfo>
}

export function ProspectsClient({ initialProspects, initialFunnel, companyMap = {} }: Props) {
  const [prospects, setProspects] = useState(initialProspects)
  const [funnel, setFunnel] = useState(initialFunnel)
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | "all">("all")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [sequenceFilter, setSequenceFilter] = useState<SequenceStatus | "all">("all")
  const [search, setSearch] = useState("")
  const [detailProspect, setDetailProspect] = useState<Prospect | null>(null)
  const [events, setEvents] = useState<ProspectEvent[]>([])
  // PR 5 of the drip pipeline: load and render the full sequence (intro,
  // followup, final) for the prospect's company in the details panel.
  const [sequenceSteps, setSequenceSteps] = useState<ProspectSequenceStep[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [syncListId, setSyncListId] = useState("")
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [showEmailsModal, setShowEmailsModal] = useState(false)
  const [emailLang, setEmailLang] = useState<"en" | "nl">("nl")
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(initialProspects.length >= 50)
  const [isPending, startTransition] = useTransition()

  // Refresh data
  const refreshData = useCallback(() => {
    startTransition(async () => {
      const [prospectsResult, funnelResult] = await Promise.all([
        fetchProspects({ status: statusFilter, source: sourceFilter, sequence: sequenceFilter, search, offset: 0, limit: 50 }),
        fetchFunnel(sourceFilter),
      ])
      setProspects(prospectsResult.prospects)
      setFunnel(funnelResult.funnel)
      setOffset(0)
      setHasMore(prospectsResult.prospects.length >= 50)
    })
  }, [statusFilter, sourceFilter, sequenceFilter, search])

  // Sync Resend email stats on mount (backfills opened/clicked from Resend API)
  const syncedRef = useRef(false)
  useEffect(() => {
    if (syncedRef.current) return
    syncedRef.current = true
    syncResendEmailStats().then(({ synced }) => {
      if (synced > 0) refreshData()
    })
  }, [refreshData])

  // Filter change
  const handleFilterChange = useCallback((newStatus?: ProspectStatus | "all", newSource?: string, newSequence?: SequenceStatus | "all") => {
    const s = newStatus ?? statusFilter
    const src = newSource ?? sourceFilter
    const seq = newSequence ?? sequenceFilter
    if (newStatus !== undefined) setStatusFilter(s)
    if (newSource !== undefined) setSourceFilter(src)
    if (newSequence !== undefined) setSequenceFilter(seq)
    startTransition(async () => {
      const [prospectsResult, funnelResult] = await Promise.all([
        fetchProspects({ status: s, source: src, sequence: seq, search, offset: 0, limit: 50 }),
        fetchFunnel(src),
      ])
      setProspects(prospectsResult.prospects)
      setFunnel(funnelResult.funnel)
      setOffset(0)
      setHasMore(prospectsResult.prospects.length >= 50)
    })
  }, [statusFilter, sourceFilter, sequenceFilter, search])

  // Search
  const handleSearch = useCallback(() => {
    startTransition(async () => {
      const result = await fetchProspects({ status: statusFilter, source: sourceFilter, sequence: sequenceFilter, search, offset: 0, limit: 50 })
      setProspects(result.prospects)
      setOffset(0)
      setHasMore(result.prospects.length >= 50)
    })
  }, [statusFilter, sourceFilter, sequenceFilter, search])

  // Load more
  const handleLoadMore = useCallback(() => {
    const newOffset = offset + 50
    startTransition(async () => {
      const result = await fetchProspects({ status: statusFilter, source: sourceFilter, sequence: sequenceFilter, search, offset: newOffset, limit: 50 })
      setProspects((prev) => [...prev, ...result.prospects])
      setOffset(newOffset)
      setHasMore(result.prospects.length >= 50)
    })
  }, [offset, statusFilter, sourceFilter, sequenceFilter, search])

  // Expand row
  const openDetails = useCallback((prospect: Prospect) => {
    setDetailProspect(prospect)
    setSequenceSteps([])
    startTransition(async () => {
      const [eventsResult, sequenceResult] = await Promise.all([
        fetchProspectEvents(prospect.id),
        getProspectSequence(prospect.id),
      ])
      setEvents(eventsResult.events)
      if (sequenceResult.success && sequenceResult.steps) {
        setSequenceSteps(sequenceResult.steps)
      }
    })
  }, [])

  // Delete
  const handleDelete = useCallback((id: string) => {
    if (!confirm("Are you sure you want to delete this prospect?")) return
    startTransition(async () => {
      const result = await deleteProspect(id)
      if (result.success) {
        toast.success("Prospect deleted")
        setExpandedId(null)
        refreshData()
      } else {
        toast.error(result.error ?? "Failed to delete")
      }
    })
  }, [refreshData])

  // Status update
  const handleStatusUpdate = useCallback((id: string, newStatus: ProspectStatus) => {
    startTransition(async () => {
      const result = await updateProspectStatus(id, newStatus)
      if (result.success) {
        toast.success("Status updated")
        refreshData()
      } else {
        toast.error(result.error ?? "Failed to update status")
      }
    })
  }, [refreshData])

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
        refreshData()
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
        refreshData()
      } else {
        setSyncResult(`Error: ${data.error}`)
      }
    } catch {
      setSyncResult("Failed to connect to Apollo")
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <>
      {/* Page header */}
      <div className="flex flex-col gap-1 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="arco-section-title">Sales</h3>
            <p className="text-xs text-[#a1a1a0] mt-0.5">
              {prospects.length} shown · {funnel.total} total
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEmailsModal(true)}
              className="h-8 px-3 text-xs font-medium border border-[#e5e5e4] rounded-[3px] text-[#6b6b68] hover:bg-[#fafaf9] transition-colors"
            >
              Email Templates
            </button>
            <button
              onClick={() => setShowSyncModal(true)}
              className="h-8 px-3 text-xs font-medium border border-[#e5e5e4] rounded-[3px] text-[#6b6b68] hover:bg-[#fafaf9] transition-colors"
            >
              Apollo Sync
            </button>
            <button
              onClick={handleSyncActivity}
              disabled={isSyncing}
              className="h-8 px-3 text-xs font-medium border border-[#e5e5e4] rounded-[3px] text-[#6b6b68] hover:bg-[#fafaf9] transition-colors disabled:opacity-50"
            >
              {isSyncing ? "Syncing…" : "Refresh Activity"}
            </button>
            <button
              onClick={() => exportToCsv(prospects)}
              className="h-8 px-3 text-xs font-medium border border-[#e5e5e4] rounded-[3px] text-[#6b6b68] hover:bg-[#fafaf9] transition-colors"
            >
              Export CSV
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="h-8 px-3 text-xs font-medium rounded-[3px] text-white transition-colors"
              style={{ background: "var(--primary, #016D75)" }}
            >
              Add Prospect
            </button>
          </div>
        </div>
      </div>

      {/* Conversion funnel */}
      <div className="mb-8">
        {/* Single grid row: connector cells align center, card cells align end */}
        {(() => {
          const cols = FUNNEL_STAGES.map((_, i) => i === 0 ? "auto" : "1fr auto").join(" ")
          // Cohorted counts: everyone who reached stage X = count at X + all later stages
          const stageKeys = FUNNEL_STAGES.map((s) => s.status)
          const cohorted = stageKeys.map((key, i) =>
            stageKeys.slice(i).reduce((sum, k) => sum + (funnel[k] ?? 0), 0)
          )

          return (
            <div style={{ display: "grid", gridTemplateColumns: cols, gap: 0, alignItems: "start" }}>
              {FUNNEL_STAGES.map((stage, i) => {
                const count = funnel[stage.status]
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
                        onClick={() => handleFilterChange(stage.status)}
                        className={`rounded-[3px] border bg-white px-3 py-3 transition-colors hover:border-[#c4c4c2] ${statusFilter === stage.status ? "border-[#c4c4c2] bg-[#fafaf9]" : "border-[#e5e5e4]"}`}
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
        {/* Email stats */}
        <div className="flex items-center gap-3 mt-4 justify-end">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#a1a1a0]">Emails sent</span>
            <span className="text-[11px] font-medium text-[#1c1c1a]">{funnel.total_emails_sent.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
        <div className="flex-1">
          <div className="relative max-w-xs">
            <input
              type="text"
              placeholder="Search email or company..."
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
          <Select value={statusFilter} onValueChange={(v) => handleFilterChange(v as ProspectStatus | "all")}>
            <SelectTrigger className="w-[170px] h-9 text-xs border-[#e5e5e4] rounded-[3px]">
              <SelectValue placeholder="All statuses">
                {statusFilter === "all" ? "All statuses" : (
                  <span className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_CONFIG[statusFilter as ProspectStatus].dot}`} />
                    {STATUS_CONFIG[statusFilter as ProspectStatus].label}
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  <span className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_CONFIG[s].dot}`} />
                    {STATUS_CONFIG[s].label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              {(["not_started", "active", "finished"] as SequenceStatus[]).map((s) => (
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
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="apollo">Apollo</SelectItem>
              <SelectItem value="arco">Arco</SelectItem>
              <SelectItem value="invites">Invites</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Prospects table */}
      <div className="border border-[#e5e5e4] overflow-x-auto max-w-full">
        <table className="w-full text-sm" style={{ minWidth: 1050 }}>
          <thead>
            <tr className="border-b border-[#e5e5e4]">
              <th className="text-left px-4 py-2 text-xs font-medium text-[#6b6b68]">Contact</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-[#6b6b68]">Status</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-[#6b6b68]">Sequence</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-[#6b6b68]">Company</th>
              <th className="text-center px-4 py-2 text-xs font-medium text-[#6b6b68]">Sent</th>
              <th className="text-center px-4 py-2 text-xs font-medium text-[#6b6b68]">Delivered</th>
              <th className="text-center px-4 py-2 text-xs font-medium text-[#6b6b68]">Opened</th>
              <th className="text-center px-4 py-2 text-xs font-medium text-[#6b6b68]">Clicked</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-[#6b6b68]">Source</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-[#6b6b68]">Created</th>
              <th className="w-[40px]"></th>
            </tr>
          </thead>
          <tbody>
            {prospects.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-sm text-[#a1a1a0]">
                  No prospects found.
                </td>
              </tr>
            )}
            {prospects.map((p) => {
              const initials = (p.contact_name ?? "")
                .split(" ")
                .filter(Boolean)
                .map((t) => t[0]?.toUpperCase())
                .slice(0, 2)
                .join("") || (p.email?.charAt(0).toUpperCase() ?? "?")

              const companyInitials = (p.company_name ?? "")
                .split(" ")
                .filter(Boolean)
                .map((t) => t[0]?.toUpperCase())
                .slice(0, 2)
                .join("")

              return (
              <Fragment key={p.id}>
                <tr
                  className="border-b border-[#e5e5e4] hover:bg-[#fafaf9] transition-colors"
                >
                  {/* Contact — avatar/initials + name + email */}
                  <td className="px-4 py-3">
                    {(p.source === "arco" || p.source === "invites") ? (
                      p.contact_name ? (
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f5f5f4] text-xs font-medium text-[#6b6b68]">
                            {p.contact_name.split(" ").filter(Boolean).map(t => t[0]?.toUpperCase()).slice(0, 2).join("")}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-medium text-[#1c1c1a] truncate">{p.contact_name}</span>
                            <ProspectEmailField prospect={p} onRefresh={refreshData} />
                          </div>
                        </div>
                      ) : (
                        <ProspectEmailField prospect={p} onRefresh={refreshData} />
                      )
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f5f5f4] text-xs font-medium text-[#6b6b68]">
                          {initials}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-medium text-[#1c1c1a] truncate">{p.contact_name || "—"}</span>
                          <span className="text-xs text-[#a1a1a0] truncate">{p.email}</span>
                        </div>
                      </div>
                    )}
                  </td>
                  {/* Status — dot + label */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_CONFIG[p.status].dot}`} />
                      <span className="text-xs font-medium text-[#1c1c1a] whitespace-nowrap">{STATUS_CONFIG[p.status].label}</span>
                    </div>
                  </td>
                  {/* Sequence — dot + label */}
                  <td className="px-4 py-3">
                    {(() => {
                      const seq = (p.sequence_status ?? "not_started") as SequenceStatus
                      const cfg = SEQUENCE_CONFIG[seq] ?? SEQUENCE_CONFIG.not_started
                      return (
                        <div className="flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                          <span className="text-xs text-[#1c1c1a] whitespace-nowrap">{cfg.label}</span>
                        </div>
                      )
                    })()}
                  </td>
                  {/* Company — logo/initials + name + service · city */}
                  <td className="px-4 py-3">
                    {p.company_name ? (() => {
                      const ci = p.company_id ? companyMap[p.company_id] : null
                      const subtitle = [ci?.services?.[0], ci?.city].filter(Boolean).join(" · ")
                      return (
                        <div className="flex items-center gap-3">
                          {ci?.logoUrl ? (
                            <img src={ci.logoUrl} alt={p.company_name} className="h-8 w-8 shrink-0 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f5f5f4] text-xs font-medium text-[#6b6b68]">
                              {companyInitials}
                            </div>
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-medium text-[#1c1c1a] truncate">{p.company_name}</span>
                            {subtitle && <span className="text-[11px] text-[#a1a1a0] truncate">{subtitle}</span>}
                          </div>
                        </div>
                      )
                    })() : (
                      <span className="text-xs text-[#a1a1a0]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#6b6b68] text-center">{p.emails_sent || "—"}</td>
                  <td className="px-4 py-3 text-xs text-center font-medium">
                    {p.emails_sent > 0 ? (() => {
                      const pct = Math.round((p.emails_delivered / p.emails_sent) * 100)
                      const color = pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600"
                      return <span className={color}>{pct}%</span>
                    })() : <span className="text-[#a1a1a0] font-normal">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-center font-medium">
                    {p.emails_sent > 0 && p.emails_opened > 0 ? (
                      <span className="text-emerald-600">{Math.round((p.emails_opened / p.emails_sent) * 100)}%</span>
                    ) : <span className="text-[#a1a1a0] font-normal">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-center font-medium">
                    {p.emails_sent > 0 && p.emails_clicked > 0 ? (
                      <span className="text-emerald-600">{Math.round((p.emails_clicked / p.emails_sent) * 100)}%</span>
                    ) : <span className="text-[#a1a1a0] font-normal">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#a1a1a0] capitalize">{p.source}</td>
                  <td className="px-4 py-3 text-xs text-[#a1a1a0] text-right whitespace-nowrap">{formatDate(p.created_at)}</td>
                  <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 rounded hover:bg-[#f5f5f4] transition-colors">
                          <MoreHorizontal size={14} className="text-[#a1a1a0]" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[160px]">
                        <DropdownMenuItem
                          className="text-xs cursor-pointer"
                          onClick={() => openDetails(p)}
                        >
                          Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {/* Start sequence — not started yet */}
                        {(p.source === "arco" || p.source === "invites") && p.sequence_status === "not_started" && p.company_id && (
                          <DropdownMenuItem
                            className="text-xs cursor-pointer"
                            onClick={async () => {
                              const result = await startProspectSequence(p.id)
                              if (result.success) { toast.success("Sequence started — email sent"); refreshData() }
                              else toast.error(result.error ?? "Failed to start sequence")
                            }}
                          >
                            Start sequence
                          </DropdownMenuItem>
                        )}
                        {/* Pause / Resume */}
                        {(p.source === "arco" || p.source === "invites") && (p.sequence_status === "active" || p.sequence_status === "finished") && (
                          <DropdownMenuItem
                            className="text-xs cursor-pointer"
                            onClick={async () => {
                              const result = await pauseProspectSequence(p.id)
                              if (result.success) { toast.success("Sequence paused"); refreshData() }
                              else toast.error(result.error ?? "Failed to pause")
                            }}
                          >
                            Pause sequence
                          </DropdownMenuItem>
                        )}
                        {(p.source === "arco" || p.source === "invites") && p.sequence_status === "paused" && (
                          <DropdownMenuItem
                            className="text-xs cursor-pointer"
                            onClick={async () => {
                              const result = await resumeProspectSequence(p.id)
                              if (result.success) { toast.success("Sequence resumed"); refreshData() }
                              else toast.error(result.error ?? "Failed to resume")
                            }}
                          >
                            Resume sequence
                          </DropdownMenuItem>
                        )}
                        {/* Restart — Arco only */}
                        {p.source === "arco" && p.emails_sent > 0 && p.sequence_status !== "active" && (
                          <DropdownMenuItem
                            className="text-xs cursor-pointer"
                            onClick={async () => {
                              const result = await restartProspectSequence(p.id)
                              if (result.success) { toast.success("Email resent"); refreshData() }
                              else toast.error(result.error ?? "Failed to restart")
                            }}
                          >
                            Restart sequence
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {/* Remove */}
                        <DropdownMenuItem
                          className="text-xs cursor-pointer text-red-600"
                          onClick={async () => {
                            const result = await deleteProspect(p.id)
                            if (result.success) { toast.success("Prospect removed"); refreshData() }
                            else toast.error(result.error ?? "Failed to remove")
                          }}
                        >
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              </Fragment>
              )
            })}
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

      {/* Details popup */}
      {detailProspect && (
        <div className="popup-overlay" onClick={() => { setDetailProspect(null); setEvents([]); setSequenceSteps([]) }}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">{detailProspect.company_name || detailProspect.email}</h3>
              <button type="button" className="popup-close" onClick={() => { setDetailProspect(null); setEvents([]); setSequenceSteps([]) }} aria-label="Close">✕</button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
              <DetailField label="Ref Code" value={detailProspect.ref_code} />
              <DetailField label="City" value={detailProspect.city} />
              <DetailField label="Apollo Contact ID" value={detailProspect.apollo_contact_id} />
              <DetailField label="Last Email Sent" value={formatDateTime(detailProspect.last_email_sent_at)} />
              <DetailField label="Visited At" value={formatDateTime(detailProspect.landing_visited_at)} />
              <DetailField label="Signed Up At" value={formatDateTime(detailProspect.signed_up_at)} />
              <DetailField label="Company Created At" value={formatDateTime(detailProspect.company_created_at)} />
              <DetailField label="Active At" value={formatDateTime(detailProspect.converted_at)} />
              <DetailField label="Linked User ID" value={detailProspect.user_id} />
              <DetailField label="Linked Company ID" value={detailProspect.company_id} />
              <DetailField label="Linked Project ID" value={detailProspect.project_id} />
            </div>

            {detailProspect.notes && (
              <div className="mb-4">
                <span className="text-[10px] font-medium text-[#a1a1a0] uppercase tracking-wider">Notes</span>
                <p className="text-xs text-[#6b6b68] mt-0.5">{detailProspect.notes}</p>
              </div>
            )}

            {/* PR 5 of the drip pipeline: prospect outreach sequence status. */}
            {sequenceSteps.length > 0 && (
              <div className="mb-4">
                <span className="text-[10px] font-medium text-[#a1a1a0] uppercase tracking-wider">Outreach Sequence</span>
                <div className="mt-1 space-y-1.5">
                  {sequenceSteps.map((step) => {
                    const statusColours: Record<ProspectSequenceStep["status"], { bg: string; text: string; label: string }> = {
                      sent:      { bg: "bg-emerald-50",  text: "text-emerald-700", label: "Sent" },
                      scheduled: { bg: "bg-blue-50",     text: "text-blue-700",    label: "Scheduled" },
                      cancelled: { bg: "bg-[#f5f5f4]",   text: "text-[#6b6b68]",   label: "Cancelled" },
                      failed:    { bg: "bg-amber-50",    text: "text-amber-700",   label: "Retrying" },
                      missing:   { bg: "bg-[#f5f5f4]",   text: "text-[#a1a1a0]",   label: "Not yet enqueued" },
                    }
                    const sc = statusColours[step.status]
                    return (
                      <div key={step.template} className="flex items-start gap-2 text-xs">
                        <span className="font-medium text-[#1c1c1a] w-20 shrink-0">{step.label}</span>
                        <span className={`px-1.5 py-0.5 rounded-[3px] ${sc.bg} ${sc.text} font-medium shrink-0`}>{sc.label}</span>
                        {step.timestamp && (
                          <span className="text-[#6b6b68]">{formatDateTime(step.timestamp)}</span>
                        )}
                        {step.cancelledReason && (
                          <span className="text-[#a1a1a0]">· {step.cancelledReason}</span>
                        )}
                        {step.lastError && step.status === "failed" && (
                          <span className="text-amber-600 break-all">· {step.lastError}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {events.length > 0 && (
              <div>
                <span className="text-[10px] font-medium text-[#a1a1a0] uppercase tracking-wider">Event History</span>
                <div className="mt-1 space-y-1" style={{ maxHeight: 200, overflowY: "auto" }}>
                  {events.map((ev) => (
                    <div key={ev.id} className="flex items-start gap-2 text-xs text-[#6b6b68]">
                      <span className="text-[#a1a1a0] whitespace-nowrap">{formatDateTime(ev.created_at)}</span>
                      <span className="font-medium">{ev.event_type}</span>
                      {Object.keys(ev.metadata).length > 0 && (
                        <span className="text-[#a1a1a0] break-all">{JSON.stringify(ev.metadata)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add prospect modal */}
      {showAddModal && (
        <AddProspectModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => { setShowAddModal(false); refreshData() }}
        />
      )}

      {/* Apollo sync modal */}
      {showSyncModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40" onClick={() => setShowSyncModal(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-[#1c1c1a]">Sync from Apollo</span>
              <button className="text-[#a1a1a0] hover:text-[#1c1c1a]" onClick={() => setShowSyncModal(false)}>✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[#6b6b68] block mb-1">Apollo List ID</label>
                <p className="text-[11px] text-[#a1a1a0] mb-2">
                  Find this in Apollo → Lists → click a list → the ID is in the URL
                </p>
                <input
                  type="text"
                  value={syncListId}
                  onChange={(e) => setSyncListId(e.target.value)}
                  className="w-full h-9 px-3 text-sm border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#a1a1a0] transition-colors"
                  placeholder="e.g. 6501a2b3c4d5e6f7..."
                />
              </div>

              {syncResult && (
                <p className={`text-xs ${syncResult.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>
                  {syncResult}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowSyncModal(false)}
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
                  {isSyncing ? "Syncing…" : "Import Contacts"}
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

Ik ben Niek, oprichter van Arco. We bouwen een platform waar opdrachtgevers het juiste architectenbureau én het volledige team vinden voor verbouwing of nieuwbouw.

Op Arco tonen we gerealiseerde projecten met alle betrokken partijen — architect, aannemer, interieurontwerper — gekoppeld. Geen biedingen, geen reviews, geen zelf-gepubliceerde portfolio's. Alleen uitzonderlijk werk, redactioneel beoordeeld.

We zijn net begonnen en nodigen nu geselecteerde bureaus uit. {{account.name}} past bij het type architectuur dat we op Arco willen tonen.

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

I'm Niek, founder of Arco. We're building a platform where clients find the right architecture firm and the full team behind every renovation or new build.

On Arco, we showcase completed projects with all contributing parties — architect, builder, interior designer — linked together. No bidding, no reviews, no self-published portfolios. Only exceptional work, editorially reviewed.

We've just launched and are now inviting selected studios. {{account.name}} fits the type of architecture we want to showcase on Arco.

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

function DetailField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <span className="text-[10px] font-medium text-[#a1a1a0] uppercase tracking-wider">{label}</span>
      <p className="text-xs text-[#1c1c1a] mt-0.5 truncate">{value || "—"}</p>
    </div>
  )
}

function AddProspectModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [email, setEmail] = useState("")
  const [contactName, setContactName] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [city, setCity] = useState("")
  const [source, setSource] = useState("manual")
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      toast.error("Email is required")
      return
    }
    startTransition(async () => {
      const result = await addProspect({
        email: email.trim(),
        contact_name: contactName.trim() || undefined,
        company_name: companyName.trim() || undefined,
        city: city.trim() || undefined,
        source,
      })
      if (result.success) {
        toast.success("Prospect added")
        onAdded()
      } else {
        toast.error(result.error ?? "Failed to add prospect")
      }
    })
  }

  return (
    <div className="popup-overlay" onClick={onClose}>
      <div
        className="popup-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 480, padding: 0 }}
      >
        <div
          style={{
            padding: "16px 24px",
            background: "var(--arco-off-white, #fafaf9)",
            borderRadius: "12px 12px 0 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span className="text-sm font-medium text-[#1c1c1a]">Add Prospect</span>
          <button className="popup-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-[#6b6b68] block mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-9 px-3 text-sm border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#a1a1a0] transition-colors"
              placeholder="name@company.com"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#6b6b68] block mb-1">Contact Name</label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="w-full h-9 px-3 text-sm border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#a1a1a0] transition-colors"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#6b6b68] block mb-1">Company Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full h-9 px-3 text-sm border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#a1a1a0] transition-colors"
              placeholder="Acme Design Studio"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#6b6b68] block mb-1">City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full h-9 px-3 text-sm border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#a1a1a0] transition-colors"
              placeholder="Amsterdam"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#6b6b68] block mb-1">Source</label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="w-full h-9 text-sm border-[#e5e5e4] rounded-[3px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="apollo">Apollo</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 text-xs font-medium border border-[#e5e5e4] rounded-[3px] text-[#6b6b68] hover:bg-[#fafaf9] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="h-9 px-4 text-xs font-medium rounded-[3px] text-white transition-colors disabled:opacity-50"
              style={{ background: "var(--primary, #016D75)" }}
            >
              {isPending ? "Adding..." : "Add Prospect"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
