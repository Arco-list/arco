"use client"

import { Fragment, useState, useTransition, useCallback } from "react"
import { toast } from "sonner"
import {
  fetchProspects,
  fetchProspectEvents,
  addProspect,
  updateProspectStatus,
  deleteProspect,
  fetchFunnel,
  type Prospect,
  type ProspectFunnel,
  type ProspectStatus,
  type ProspectEvent,
} from "./actions"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// -- Status config -----------------------------------------------------------

const STATUS_CONFIG: Record<ProspectStatus, { label: string; cls: string }> = {
  imported: { label: "Imported", cls: "bg-[#f5f5f4] text-[#6b6b68]" },
  sequence_active: { label: "Sequence Active", cls: "bg-blue-50 text-blue-700" },
  email_opened: { label: "Email Opened", cls: "bg-indigo-50 text-indigo-700" },
  email_clicked: { label: "Email Clicked", cls: "bg-purple-50 text-purple-700" },
  landing_visited: { label: "Landing Visited", cls: "bg-amber-50 text-amber-700" },
  signed_up: { label: "Signed Up", cls: "bg-teal-50 text-teal-700" },
  company_created: { label: "Company Created", cls: "bg-cyan-50 text-cyan-700" },
  project_started: { label: "Project Started", cls: "bg-orange-50 text-orange-700" },
  project_published: { label: "Project Published", cls: "bg-green-50 text-green-700" },
  converted: { label: "Converted", cls: "bg-emerald-50 text-emerald-800 font-semibold" },
  unsubscribed: { label: "Unsubscribed", cls: "bg-red-50 text-red-700" },
  bounced: { label: "Bounced", cls: "bg-red-50 text-red-700" },
}

const ALL_STATUSES: ProspectStatus[] = [
  "imported", "sequence_active", "email_opened", "email_clicked",
  "landing_visited", "signed_up", "company_created", "project_started",
  "project_published", "converted", "unsubscribed", "bounced",
]

// Funnel stages (ordered, excluding unsubscribed/bounced)
const FUNNEL_STAGES: ProspectStatus[] = [
  "imported", "sequence_active", "email_opened", "email_clicked",
  "landing_visited", "signed_up", "company_created", "project_started",
  "project_published", "converted",
]

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
    "Email", "Contact Name", "Company", "Status", "Source", "City",
    "Emails Sent", "Emails Opened", "Emails Clicked", "Created",
  ]
  const rows = prospects.map((p) => [
    p.email,
    p.contact_name ?? "",
    p.company_name ?? "",
    p.status,
    p.source,
    p.city ?? "",
    p.emails_sent,
    p.emails_opened,
    p.emails_clicked,
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

// -- Component ---------------------------------------------------------------

type Props = {
  initialProspects: Prospect[]
  initialFunnel: ProspectFunnel
}

export function ProspectsClient({ initialProspects, initialFunnel }: Props) {
  const [prospects, setProspects] = useState(initialProspects)
  const [funnel, setFunnel] = useState(initialFunnel)
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | "all">("all")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [events, setEvents] = useState<ProspectEvent[]>([])
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
        fetchProspects({ status: statusFilter, source: sourceFilter, search, offset: 0, limit: 50 }),
        fetchFunnel(),
      ])
      setProspects(prospectsResult.prospects)
      setFunnel(funnelResult.funnel)
      setOffset(0)
      setHasMore(prospectsResult.prospects.length >= 50)
    })
  }, [statusFilter, sourceFilter, search])

  // Filter change
  const handleFilterChange = useCallback((newStatus?: ProspectStatus | "all", newSource?: string) => {
    const s = newStatus ?? statusFilter
    const src = newSource ?? sourceFilter
    if (newStatus !== undefined) setStatusFilter(s)
    if (newSource !== undefined) setSourceFilter(src)
    startTransition(async () => {
      const [prospectsResult, funnelResult] = await Promise.all([
        fetchProspects({ status: s, source: src, search, offset: 0, limit: 50 }),
        fetchFunnel(),
      ])
      setProspects(prospectsResult.prospects)
      setFunnel(funnelResult.funnel)
      setOffset(0)
      setHasMore(prospectsResult.prospects.length >= 50)
    })
  }, [statusFilter, sourceFilter, search])

  // Search
  const handleSearch = useCallback(() => {
    startTransition(async () => {
      const result = await fetchProspects({ status: statusFilter, source: sourceFilter, search, offset: 0, limit: 50 })
      setProspects(result.prospects)
      setOffset(0)
      setHasMore(result.prospects.length >= 50)
    })
  }, [statusFilter, sourceFilter, search])

  // Load more
  const handleLoadMore = useCallback(() => {
    const newOffset = offset + 50
    startTransition(async () => {
      const result = await fetchProspects({ status: statusFilter, source: sourceFilter, search, offset: newOffset, limit: 50 })
      setProspects((prev) => [...prev, ...result.prospects])
      setOffset(newOffset)
      setHasMore(result.prospects.length >= 50)
    })
  }, [offset, statusFilter, sourceFilter, search])

  // Expand row
  const handleRowClick = useCallback((id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    startTransition(async () => {
      const result = await fetchProspectEvents(id)
      setEvents(result.events)
    })
  }, [expandedId])

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
            <h3 className="arco-section-title">Prospects</h3>
            <p className="text-xs text-[#a1a1a0] mt-0.5">
              {funnel.total} total prospects · {funnel.converted} converted
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
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {FUNNEL_STAGES.map((stage, i) => {
            const count = funnel[stage]
            const prevCount = i > 0 ? funnel[FUNNEL_STAGES[i - 1]] : funnel.total
            const rate = i === 0 ? "100%" : conversionRate(prevCount, count)
            const cfg = STATUS_CONFIG[stage]
            return (
              <div key={stage} className="flex items-center">
                {i > 0 && (
                  <div className="flex flex-col items-center mx-1 shrink-0">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d4d4d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    <span className="text-[9px] text-[#a1a1a0] mt-0.5 whitespace-nowrap">{rate}</span>
                  </div>
                )}
                <button
                  onClick={() => handleFilterChange(stage)}
                  className="flex flex-col items-center px-3 py-2 rounded-md border border-[#e5e5e4] hover:border-[#d4d4d4] transition-colors min-w-[90px] shrink-0"
                  style={{ background: statusFilter === stage ? "#fafaf9" : "white" }}
                >
                  <span className="text-lg font-semibold text-[#1c1c1a] leading-none">{count}</span>
                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full mt-1.5 whitespace-nowrap ${cfg.cls}`}>
                    {cfg.label}
                  </span>
                </button>
              </div>
            )
          })}
        </div>
        {/* Separate metrics for unsubscribed/bounced */}
        <div className="flex items-center gap-3 mt-3">
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_CONFIG.unsubscribed.cls}`}>Unsubscribed</span>
            <span className="text-xs font-medium text-[#6b6b68]">{funnel.unsubscribed}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_CONFIG.bounced.cls}`}>Bounced</span>
            <span className="text-xs font-medium text-[#6b6b68]">{funnel.bounced}</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[10px] text-[#a1a1a0]">Emails sent</span>
            <span className="text-xs font-medium text-[#6b6b68]">{funnel.total_emails_sent.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#a1a1a0]">Open rate</span>
            <span className="text-xs font-medium text-[#6b6b68]">{conversionRate(funnel.total_emails_sent, funnel.with_opens)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#a1a1a0]">Click rate</span>
            <span className="text-xs font-medium text-[#6b6b68]">{conversionRate(funnel.total_emails_sent, funnel.with_clicks)}</span>
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
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
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
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Prospects table */}
      <div className="border border-[#e5e5e4] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e5e5e4]">
              <th className="text-left px-4 py-2 text-xs font-medium text-[#6b6b68]">Contact</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-[#6b6b68]">Email</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-[#6b6b68]">Company</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-[#6b6b68]">Status</th>
              <th className="text-center px-4 py-2 text-xs font-medium text-[#6b6b68]">Sent</th>
              <th className="text-center px-4 py-2 text-xs font-medium text-[#6b6b68]">Opened</th>
              <th className="text-center px-4 py-2 text-xs font-medium text-[#6b6b68]">Clicked</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-[#6b6b68]">Source</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-[#6b6b68]">Created</th>
            </tr>
          </thead>
          <tbody>
            {prospects.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-[#a1a1a0]">
                  No prospects found.
                </td>
              </tr>
            )}
            {prospects.map((p) => (
              <Fragment key={p.id}>
                <tr
                  className={`border-b border-[#e5e5e4] hover:bg-[#fafaf9] cursor-pointer transition-colors ${expandedId === p.id ? "bg-[#fafaf9]" : ""}`}
                  onClick={() => handleRowClick(p.id)}
                >
                  <td className="px-4 py-3 text-sm text-[#1c1c1a] max-w-[160px] truncate">
                    {p.contact_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#1c1c1a] max-w-[200px] truncate">
                    {p.email}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6b6b68] max-w-[160px] truncate">
                    {p.company_name || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_CONFIG[p.status].cls}`}>
                      {STATUS_CONFIG[p.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#6b6b68] text-center">{p.emails_sent}</td>
                  <td className="px-4 py-3 text-xs text-[#6b6b68] text-center">{p.emails_opened}</td>
                  <td className="px-4 py-3 text-xs text-[#6b6b68] text-center">{p.emails_clicked}</td>
                  <td className="px-4 py-3 text-xs text-[#a1a1a0] capitalize">{p.source}</td>
                  <td className="px-4 py-3 text-xs text-[#a1a1a0] text-right whitespace-nowrap">{formatDate(p.created_at)}</td>
                </tr>
                {/* Expanded detail row */}
                {expandedId === p.id && (
                  <tr key={`${p.id}-detail`} className="border-b border-[#e5e5e4] bg-[#fafaf9]">
                    <td colSpan={9} className="px-6 py-4">
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <DetailField label="Ref Code" value={p.ref_code} />
                        <DetailField label="City" value={p.city} />
                        <DetailField label="Apollo Contact ID" value={p.apollo_contact_id} />
                        <DetailField label="Apollo Account ID" value={p.apollo_account_id} />
                        <DetailField label="First Email Sent" value={formatDateTime(p.first_email_sent_at)} />
                        <DetailField label="Last Email Sent" value={formatDateTime(p.last_email_sent_at)} />
                        <DetailField label="Opened At" value={formatDateTime(p.opened_at)} />
                        <DetailField label="Clicked At" value={formatDateTime(p.clicked_at)} />
                        <DetailField label="Landing Visited At" value={formatDateTime(p.landing_visited_at)} />
                        <DetailField label="Signed Up At" value={formatDateTime(p.signed_up_at)} />
                        <DetailField label="Company Created At" value={formatDateTime(p.company_created_at)} />
                        <DetailField label="Converted At" value={formatDateTime(p.converted_at)} />
                        <DetailField label="Linked User ID" value={p.linked_user_id} />
                        <DetailField label="Linked Company ID" value={p.linked_company_id} />
                        <DetailField label="Linked Project ID" value={p.linked_project_id} />
                      </div>
                      {p.notes && (
                        <div className="mb-4">
                          <span className="text-[10px] font-medium text-[#a1a1a0] uppercase tracking-wider">Notes</span>
                          <p className="text-xs text-[#6b6b68] mt-0.5">{p.notes}</p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 mb-4">
                        <Select
                          value={p.status}
                          onValueChange={(v) => handleStatusUpdate(p.id, v as ProspectStatus)}
                        >
                          <SelectTrigger className="w-[170px] h-8 text-xs border-[#e5e5e4] rounded-[3px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ALL_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }}
                          className="h-8 px-3 text-xs font-medium border border-red-200 text-red-600 rounded-[3px] hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                      </div>

                      {/* Event history */}
                      {events.length > 0 && (
                        <div>
                          <span className="text-[10px] font-medium text-[#a1a1a0] uppercase tracking-wider">Event History</span>
                          <div className="mt-1 space-y-1">
                            {events.map((ev) => (
                              <div key={ev.id} className="flex items-center gap-2 text-xs text-[#6b6b68]">
                                <span className="text-[#a1a1a0] whitespace-nowrap">{formatDateTime(ev.created_at)}</span>
                                <span className="font-medium">{ev.event_type}</span>
                                {Object.keys(ev.metadata).length > 0 && (
                                  <span className="text-[#a1a1a0]">{JSON.stringify(ev.metadata)}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
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
