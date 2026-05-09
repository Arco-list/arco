"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  archiveInboundEmail,
  fetchInboundEmailDetail,
  fetchInboundEmails,
  generateReplyDraft,
  markInboundEmailUnread,
  sendReply,
  unarchiveInboundEmail,
  type FetchInboundResult,
  type InboundEmailDetail,
  type InboundEmailRow,
  type InboundTab,
} from "./actions"

// Mirrors the funnel-stage colours used on /admin/sales so the
// prospect badge in the inbox row matches the same contact's pill in
// the sales table at a glance.
const PROSPECT_STATUS_DOT: Record<string, string> = {
  prospect: "bg-[#f59e0b]",
  contacted: "bg-[#f59e0b]",
  visitor: "bg-[#2563eb]",
  signup: "bg-[#2563eb]",
  company: "bg-[#2563eb]",
  active: "bg-[#7c3aed]",
  removed: "bg-[#a1a1a0]",
}
const PROSPECT_STATUS_LABEL: Record<string, string> = {
  prospect: "Prospect",
  contacted: "Contacted",
  visitor: "Visitor",
  signup: "Signup",
  company: "Draft",
  active: "Listed",
  removed: "Removed",
}

const SEQUENCE_DOT: Record<string, string> = {
  not_started: "bg-[#a1a1a0]",
  active: "bg-[#2563eb]",
  paused: "bg-amber-400",
  finished: "bg-emerald-500",
}
const SEQUENCE_LABEL: Record<string, string> = {
  not_started: "Not started",
  active: "Active",
  paused: "Paused",
  finished: "Finished",
}

const CHANNEL_LABEL: Record<string, string> = {
  arco: "Showcase",
  invites: "Invite",
  apollo: "Outreach",
  manual: "Manual",
}
const channelLabel = (s: string | null): string =>
  !s ? "—" : CHANNEL_LABEL[s] ?? s.charAt(0).toUpperCase() + s.slice(1)

function formatRelative(ts: string): string {
  try {
    const ms = Date.now() - new Date(ts).getTime()
    if (ms < 60_000) return "just now"
    const m = Math.floor(ms / 60_000)
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.floor(h / 24)
    if (d < 7) return `${d}d ago`
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })
  } catch {
    return ts
  }
}

function formatAbsolute(ts: string): string {
  try {
    return new Date(ts).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return ts
  }
}

export function InboxClient({
  initial,
  initialTab,
}: {
  initial: FetchInboundResult
  initialTab: InboundTab
}) {
  const [emails, setEmails] = useState<InboundEmailRow[]>(initial.emails)
  const [total, setTotal] = useState(initial.total)
  const [unreadCount, setUnreadCount] = useState(initial.unreadCount)
  const [tab, setTab] = useState<InboundTab>(initialTab)
  const [search, setSearch] = useState("")
  const [openDetail, setOpenDetail] = useState<InboundEmailDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  // Respond popup state. Holds the row being replied to + the editable
  // draft text. Loading flag covers both AI generation and the send
  // call so the Send button can show "Sending…" while the request
  // is in flight without flickering between two states.
  const [respondTarget, setRespondTarget] = useState<InboundEmailRow | null>(null)
  const [respondDraft, setRespondDraft] = useState("")
  // Snapshot of whatever the AI most recently returned, separate from
  // the user-editable draft. Used to detect "user has edited" so the
  // Regenerate button can switch into Refine mode (server gets the
  // edit + refines instead of regenerating from scratch).
  const [respondAIDraft, setRespondAIDraft] = useState("")
  const [respondOriginal, setRespondOriginal] = useState<string>("")
  const [respondGenerating, setRespondGenerating] = useState(false)
  const [respondSending, setRespondSending] = useState(false)
  const [respondError, setRespondError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const reload = useCallback(
    (overrides?: { tab?: InboundTab; search?: string }) => {
      const t = overrides?.tab ?? tab
      const s = overrides?.search ?? search
      startTransition(async () => {
        const result = await fetchInboundEmails({ tab: t, search: s })
        setEmails(result.emails)
        setTotal(result.total)
        setUnreadCount(result.unreadCount)
      })
    },
    [tab, search],
  )

  const handleTab = (next: InboundTab) => {
    setTab(next)
    reload({ tab: next })
  }

  const handleOpen = (row: InboundEmailRow) => {
    setOpenDetail(null)
    setDetailLoading(true)
    startTransition(async () => {
      const detail = await fetchInboundEmailDetail(row.id)
      setDetailLoading(false)
      if (!detail) {
        toast.error("Could not load email")
        return
      }
      setOpenDetail(detail)
      // Optimistically reflect read state in the list — fetchDetail
      // marks unread→read server-side as a side effect.
      if (row.status === "unread") {
        setEmails((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, status: "read" } : r)),
        )
        setUnreadCount((c) => Math.max(0, c - 1))
      }
    })
  }

  const handleArchive = async (id: string) => {
    const result = await archiveInboundEmail(id)
    if (result.success) {
      toast.success("Archived")
      setOpenDetail(null)
      reload()
    } else {
      toast.error(result.error ?? "Failed to archive")
    }
  }

  const handleUnarchive = async (id: string) => {
    const result = await unarchiveInboundEmail(id)
    if (result.success) {
      toast.success("Moved back to inbox")
      setOpenDetail(null)
      reload()
    } else {
      toast.error(result.error ?? "Failed to move back")
    }
  }

  const handleMarkUnread = async (id: string) => {
    const result = await markInboundEmailUnread(id)
    if (result.success) {
      toast.success("Marked unread")
      setOpenDetail(null)
      reload()
    } else {
      toast.error(result.error ?? "Failed to mark unread")
    }
  }

  /** Open the Respond popup for a row. Loads (or re-uses cached) AI
   *  draft from the server; user can edit before sending. Detail popup
   *  is closed if open so the two popups don't stack. */
  const openRespond = (row: InboundEmailRow) => {
    setOpenDetail(null)
    setDetailLoading(false)
    setRespondTarget(row)
    setRespondDraft("")
    setRespondAIDraft("")
    setRespondOriginal("")
    setRespondError(null)
    setRespondGenerating(true)
    startTransition(async () => {
      const result = await generateReplyDraft(row.id)
      setRespondGenerating(false)
      if (result.success && result.draft) {
        setRespondDraft(result.draft)
        setRespondAIDraft(result.draft)
        setRespondOriginal(result.originalBody ?? "")
      } else {
        setRespondError(result.error ?? "Could not generate draft")
      }
    })
  }

  const closeRespond = () => {
    if (respondSending) return
    setRespondTarget(null)
    setRespondDraft("")
    setRespondAIDraft("")
    setRespondOriginal("")
    setRespondError(null)
    setRespondGenerating(false)
  }

  const handleSendReply = async () => {
    if (!respondTarget || !respondDraft.trim()) return
    setRespondSending(true)
    setRespondError(null)
    const result = await sendReply(respondTarget.id, respondDraft)
    setRespondSending(false)
    if (result.success) {
      toast.success("Reply sent")
      closeRespondForce()
      reload()
    } else {
      setRespondError(result.error ?? "Failed to send")
    }
  }

  /** Force-close that bypasses the in-flight guard. Used after a
   *  successful send (when respondSending has just flipped back to false
   *  but we want to dismiss the popup anyway). */
  const closeRespondForce = () => {
    setRespondTarget(null)
    setRespondDraft("")
    setRespondAIDraft("")
    setRespondOriginal("")
    setRespondError(null)
    setRespondGenerating(false)
    setRespondSending(false)
  }

  const handleRegenerateDraft = () => {
    if (!respondTarget) return
    // If the textarea differs from the last AI draft, the admin has
    // edited — pass the current text up so the server flips into
    // refine mode (keeps their direction, polishes phrasing). Pure
    // unedited Regenerate falls through to a fresh-from-scratch draft.
    const userEdit =
      respondDraft.trim() !== respondAIDraft.trim() && respondDraft.trim().length > 0
        ? respondDraft
        : undefined
    setRespondGenerating(true)
    setRespondError(null)
    startTransition(async () => {
      const result = await generateReplyDraft(respondTarget.id, {
        force: true,
        userEdit,
      })
      setRespondGenerating(false)
      if (result.success && result.draft) {
        setRespondDraft(result.draft)
        setRespondAIDraft(result.draft)
        if (result.originalBody) setRespondOriginal(result.originalBody)
      } else {
        setRespondError(result.error ?? "Could not regenerate draft")
      }
    })
  }

  return (
    <>
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-3">
        {(
          [
            { key: "active", label: "Inbox", showBadge: true },
            { key: "replied", label: "Replied", showBadge: false },
            { key: "archived", label: "Archived", showBadge: false },
            { key: "all", label: "All", showBadge: false },
          ] as Array<{ key: InboundTab; label: string; showBadge: boolean }>
        ).map((t) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => handleTab(t.key)}
              className={`h-8 px-3 text-xs font-medium rounded-[3px] border transition-colors ${
                active
                  ? "border-[#1c1c1a] bg-[#fafaf9] text-[#1c1c1a]"
                  : "border-[#e5e5e4] text-[#6b6b68] hover:border-[#a1a1a0]"
              }`}
            >
              {t.label}
              {t.showBadge && unreadCount > 0 && (
                <span
                  className="ml-1.5 inline-flex items-center justify-center text-[10px] font-medium px-1.5 rounded-full"
                  style={{
                    background: active ? "#1c1c1a" : "#016D75",
                    color: "#fff",
                    minWidth: 16,
                    height: 16,
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="mb-4 relative max-w-xs">
        <input
          type="text"
          placeholder="Search from, subject, snippet…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") reload()
          }}
          className="w-full h-9 pl-8 pr-3 text-xs border border-[#e5e5e4] rounded-[3px] outline-none focus:border-[#a1a1a0] transition-colors"
        />
        <svg
          className="absolute left-2.5 top-2.5 text-[#a1a1a0]"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>

      {/* List */}
      <div className="arco-table-wrap">
        <table className="arco-table" style={{ minWidth: 1100 }}>
          <thead>
            <tr>
              <th>From</th>
              <th>Company</th>
              <th>Subject</th>
              <th style={{ textAlign: "right" }}>Received</th>
              <th style={{ textAlign: "right", width: 180 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {emails.length === 0 && (
              <tr>
                <td colSpan={5} style={{ height: 96, textAlign: "center", color: "var(--text-disabled)" }}>
                  {search ? "No emails match your search." : "No emails yet."}
                </td>
              </tr>
            )}
            {emails.map((row) => {
              const unread = row.status === "unread"
              const replied = row.status === "replied"
              const personName = row.fromName?.trim() || null
              const statusDot = row.prospectStatus
                ? PROSPECT_STATUS_DOT[row.prospectStatus] ?? "bg-[#a1a1a0]"
                : "bg-[#d4d4d3]"
              return (
                <tr
                  key={row.id}
                  onClick={() => handleOpen(row)}
                  style={{ cursor: "pointer" }}
                  className="hover:bg-[#fafaf9]"
                >
                  {/* From — sender's person identity, regardless of match */}
                  <td>
                    <div className="flex flex-col min-w-0">
                      {personName && (
                        <span
                          className="arco-table-primary truncate max-w-[200px]"
                          style={{ fontWeight: unread ? 600 : 400 }}
                        >
                          {personName}
                        </span>
                      )}
                      <span
                        className={
                          (personName ? "arco-table-secondary" : "arco-table-primary")
                          + " truncate max-w-[200px]"
                        }
                        style={{ fontWeight: !personName && unread ? 600 : undefined }}
                      >
                        {row.fromEmail}
                      </span>
                    </div>
                  </td>

                  {/* Company — populated either via the prospect path or
                      the domain fallback. Three link targets depending on
                      what the company actually is:
                        - Claimed company (companySlug present) →
                          /professionals/<slug> (public page)
                        - Sales company (prospect with company_name but
                          no claimed companies row) → /admin/sales?search=<email>
                          so admin can jump to the funnel row.
                        - Domain-only marketplace company (prospect
                          missing) → /professionals/<slug> when slug exists.
                      Status dot + sequence/channel pills only render when
                      there's a prospect; domain-only matches show just
                      the company name (no funnel state to surface). */}
                  <td>
                    {row.prospectCompanyName ? (
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <span className="arco-table-status">
                          <span className={`arco-table-status-dot ${statusDot}`} />
                          {(() => {
                            // Has funnel context if EITHER directly matched
                            // a prospect OR domain-matched a prospect (status
                            // gets carried over in the latter case).
                            const hasFunnelContext = Boolean(row.prospectStatus)
                            const linkTarget = row.companySlug
                              ? `/professionals/${row.companySlug}`
                              : hasFunnelContext
                                ? `/admin/sales?search=${encodeURIComponent(row.fromEmail)}`
                                : null
                            const titleText = row.prospectStatus
                              ? PROSPECT_STATUS_LABEL[row.prospectStatus] ?? row.prospectStatus
                              : "Linked by email domain"
                            if (linkTarget) {
                              const isExternalProfessional = Boolean(row.companySlug)
                              return (
                                <a
                                  href={linkTarget}
                                  {...(isExternalProfessional
                                    ? { target: "_blank", rel: "noopener noreferrer" }
                                    : {})}
                                  onClick={(e) => e.stopPropagation()}
                                  className="truncate max-w-[160px] hover:underline"
                                  title={titleText}
                                >
                                  {row.prospectCompanyName}
                                </a>
                              )
                            }
                            return (
                              <span className="truncate max-w-[160px]" title={titleText}>
                                {row.prospectCompanyName}
                              </span>
                            )
                          })()}
                        </span>
                        {row.prospectSequence && (
                          <span className="status-pill">
                            <span
                              className={`status-pill-dot ${
                                SEQUENCE_DOT[row.prospectSequence] ?? "bg-[#a1a1a0]"
                              }`}
                            />
                            {SEQUENCE_LABEL[row.prospectSequence] ?? row.prospectSequence}
                          </span>
                        )}
                        {row.prospectChannel && (
                          <span className="status-pill">{channelLabel(row.prospectChannel)}</span>
                        )}
                      </div>
                    ) : (
                      <span className="arco-table-secondary">—</span>
                    )}
                  </td>

                  {/* Subject + snippet */}
                  <td>
                    <div className="flex flex-col min-w-0">
                      <span
                        className="arco-table-primary truncate"
                        style={{ fontWeight: unread ? 600 : 400, maxWidth: 380 }}
                      >
                        {row.subject || <span className="text-[#a1a1a0]">(no subject)</span>}
                      </span>
                      {row.snippet && (
                        <span className="arco-table-secondary truncate" style={{ maxWidth: 380 }}>
                          {row.snippet}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="arco-table-nowrap" style={{ textAlign: "right", color: "var(--text-disabled)" }}>
                    <div className="flex items-center justify-end gap-2">
                      {replied && (
                        <span className="status-pill" style={{ borderColor: "#bbf7d0", color: "#166534" }}>
                          <span className="status-pill-dot bg-emerald-500" />
                          Replied
                        </span>
                      )}
                      <span title={formatAbsolute(row.receivedAt)}>{formatRelative(row.receivedAt)}</span>
                    </div>
                  </td>

                  {/* Actions — Archive + Respond. Buttons stop propagation so
                      they don't also fire the row's open-popup handler. */}
                  <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "right" }}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          row.status === "archived"
                            ? handleUnarchive(row.id)
                            : handleArchive(row.id)
                        }
                        className="h-8 px-2.5 text-xs font-medium border border-[#e5e5e4] rounded-[3px] text-[#6b6b68] hover:bg-[#fafaf9] transition-colors"
                      >
                        {row.status === "archived" ? "Move back" : "Archive"}
                      </button>
                      <button
                        type="button"
                        onClick={() => openRespond(row)}
                        className="h-8 px-3 text-xs font-medium rounded-[3px] text-white transition-colors"
                        style={{ background: "var(--primary, #016D75)" }}
                      >
                        Respond
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {total > emails.length && (
        <p className="mt-3 text-xs text-[#a1a1a0] text-center">
          Showing {emails.length} of {total}. Pagination ships in slice 5 polish.
        </p>
      )}

      {/* Respond popup — AI-drafted reply that the admin reviews before
          sending. Generates on open (cached on inbound_emails.ai_draft_text
          so re-opens don't re-bill the model). Sending posts via the
          Gmail API to the original sender, threaded via Message-ID + threadId.
          On success, the row's status flips to 'replied' so it leaves
          the active inbox tab and shows up under Replied. */}
      {respondTarget && (
        <div className="popup-overlay" onClick={closeRespond}>
          <div
            className="popup-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 640, width: "calc(100vw - 48px)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
          >
            <div className="popup-header">
              <div className="min-w-0 flex-1">
                <h3 className="arco-section-title">Respond to {respondTarget.fromName?.trim() || respondTarget.fromEmail}</h3>
                <p className="text-xs text-[#6b6b68] mt-0.5 truncate">
                  Re: {respondTarget.subject || <span className="text-[#a1a1a0]">(no subject)</span>}
                  {" · "}
                  <span className="text-[#a1a1a0]">{respondTarget.fromEmail}</span>
                </p>
              </div>
              <button type="button" className="popup-close" onClick={closeRespond} aria-label="Close" disabled={respondSending}>✕</button>
            </div>

            {(respondOriginal || respondTarget.snippet) && (
              <details className="mb-3 text-xs text-[#6b6b68]">
                <summary className="cursor-pointer text-[#016D75] hover:underline">
                  Show original
                </summary>
                {/* Capped height + scroll so a long thread doesn't blow up
                    the popup. whitespace-pre-wrap preserves line breaks
                    from the parsed plain-text body. */}
                <div
                  className="mt-1.5 p-3 bg-[#fafaf9] border border-[#e5e5e4] rounded-[3px] whitespace-pre-wrap"
                  style={{ maxHeight: 200, overflowY: "auto", lineHeight: 1.55 }}
                >
                  {respondOriginal || respondTarget.snippet}
                </div>
              </details>
            )}

            {(() => {
              // hasEdited drives both the label and the Regenerate vs
              // Refine button copy, so the admin sees what'll happen.
              const hasEdited =
                respondDraft.trim().length > 0
                && respondDraft.trim() !== respondAIDraft.trim()
              const buttonLabel = respondGenerating
                ? hasEdited
                  ? "Refining…"
                  : "Generating…"
                : hasEdited
                  ? "Refine with my edits"
                  : "Regenerate"
              return (
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-medium text-[#a1a1a0] uppercase tracking-wider">
                    Your reply {respondGenerating
                      ? "(generating…)"
                      : hasEdited
                        ? "(edited — refine will incorporate your changes)"
                        : "(AI-drafted, edit before sending)"}
                  </span>
                  <button
                    type="button"
                    onClick={handleRegenerateDraft}
                    disabled={respondGenerating || respondSending}
                    className="text-[11px] text-[#016D75] hover:underline disabled:opacity-50"
                  >
                    {buttonLabel}
                  </button>
                </div>
              )
            })()}

            <textarea
              value={respondDraft}
              onChange={(e) => setRespondDraft(e.target.value)}
              disabled={respondGenerating || respondSending}
              placeholder={respondGenerating ? "Drafting reply in Niek's voice…" : "Write your reply…"}
              style={{
                flex: 1,
                minHeight: 240,
                width: "100%",
                padding: 12,
                fontSize: 13,
                lineHeight: 1.6,
                fontFamily: "var(--font-sans)",
                color: "#1c1c1a",
                border: "1px solid var(--arco-rule, #e5e5e4)",
                borderRadius: 3,
                resize: "vertical",
                outline: "none",
              }}
            />

            {respondError && (
              <p className="mt-2 text-xs text-red-700 break-all">{respondError}</p>
            )}

            <div className="mt-4 flex items-center justify-between gap-2">
              <p className="text-[10px] text-[#a1a1a0]">
                Sends from <code className="text-[10px]">hello@arcolist.com</code> via Gmail. Threaded to the original conversation.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeRespond}
                  disabled={respondSending}
                  className="h-9 px-3 text-xs font-medium border border-[#e5e5e4] rounded-[3px] text-[#6b6b68] hover:bg-[#fafaf9] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendReply}
                  disabled={respondGenerating || respondSending || !respondDraft.trim()}
                  className="h-9 px-4 text-xs font-medium rounded-[3px] text-white transition-colors disabled:opacity-50"
                  style={{ background: "var(--primary, #016D75)" }}
                >
                  {respondSending ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail popup */}
      {(openDetail || detailLoading) && (
        <div
          className="popup-overlay"
          onClick={() => {
            setOpenDetail(null)
            setDetailLoading(false)
          }}
        >
          <div
            className="popup-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 760, width: "calc(100vw - 48px)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
          >
            <div className="popup-header">
              <div className="min-w-0 flex-1">
                <h3 className="arco-section-title truncate">
                  {openDetail?.subject || (detailLoading ? "Loading…" : "(no subject)")}
                </h3>
                {openDetail && (
                  <p className="text-xs text-[#6b6b68] mt-0.5 truncate">
                    {openDetail.fromName ? `${openDetail.fromName} · ` : ""}
                    {openDetail.fromEmail}
                    {" · "}
                    <span className="text-[#a1a1a0]">{formatAbsolute(openDetail.receivedAt)}</span>
                  </p>
                )}
              </div>
              <button
                type="button"
                className="popup-close"
                onClick={() => {
                  setOpenDetail(null)
                  setDetailLoading(false)
                }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {detailLoading && !openDetail && (
              <p className="text-xs text-[#a1a1a0]">Loading email…</p>
            )}

            {openDetail && (
              <>
                {/* Company context strip — fires for prospect matches
                    (full pill set) AND domain-only matches (just company
                    name + slug link, no funnel pills). Falls through to
                    the "doesn't match" hint when neither path resolved. */}
                {openDetail.prospectCompanyName ? (
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-[10px] font-medium text-[#a1a1a0] uppercase tracking-wider">
                      Company
                    </span>
                    <span className="arco-table-status">
                      <span
                        className={`arco-table-status-dot ${
                          openDetail.prospectStatus
                            ? PROSPECT_STATUS_DOT[openDetail.prospectStatus] ?? "bg-[#a1a1a0]"
                            : "bg-[#d4d4d3]"
                        }`}
                      />
                      {openDetail.companySlug ? (
                        <a
                          href={`/professionals/${openDetail.companySlug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {openDetail.prospectCompanyName}
                        </a>
                      ) : openDetail.prospectId ? (
                        <Link
                          href={`/admin/sales?search=${encodeURIComponent(openDetail.fromEmail)}`}
                          className="hover:underline"
                        >
                          {openDetail.prospectCompanyName}
                        </Link>
                      ) : (
                        <span>{openDetail.prospectCompanyName}</span>
                      )}
                    </span>
                    {openDetail.prospectSequence && (
                      <span className="status-pill">
                        <span
                          className={`status-pill-dot ${
                            SEQUENCE_DOT[openDetail.prospectSequence] ?? "bg-[#a1a1a0]"
                          }`}
                        />
                        {SEQUENCE_LABEL[openDetail.prospectSequence] ?? openDetail.prospectSequence}
                      </span>
                    )}
                    {openDetail.prospectChannel && (
                      <span className="status-pill">{channelLabel(openDetail.prospectChannel)}</span>
                    )}
                    {!openDetail.prospectId && (
                      <span className="text-[10px] text-[#a1a1a0]">linked by email domain</span>
                    )}
                    <Link
                      href={`/admin/sales?search=${encodeURIComponent(openDetail.fromEmail)}`}
                      className="text-[#016D75] hover:underline ml-auto"
                    >
                      View on Sales →
                    </Link>
                  </div>
                ) : (
                  <p className="mb-3 text-[11px] text-[#a1a1a0]">
                    Sender doesn't match a known prospect or company.
                  </p>
                )}

                {/* Body — sandboxed iframe so any inline JS can't run.
                    sandbox="" with no allowances still loads images +
                    CSS, which is what email needs. Falls back to
                    plaintext when no HTML is available. */}
                <div
                  style={{
                    flex: 1,
                    minHeight: 320,
                    border: "1px solid var(--arco-rule, #e5e5e4)",
                    borderRadius: 3,
                    overflow: "hidden",
                    background: "#fafaf9",
                  }}
                >
                  {openDetail.bodyHtml ? (
                    <iframe
                      sandbox=""
                      srcDoc={openDetail.bodyHtml}
                      style={{ width: "100%", height: "100%", minHeight: 320, border: "none", background: "#fff" }}
                      title="Email body"
                    />
                  ) : (
                    <pre
                      style={{
                        margin: 0,
                        padding: 16,
                        background: "#fff",
                        fontFamily: "var(--font-sans)",
                        fontSize: 13,
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                        color: "#1c1c1a",
                      }}
                    >
                      {openDetail.bodyText ?? "(empty body)"}
                    </pre>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleMarkUnread(openDetail.id)}
                    className="h-9 px-3 text-xs font-medium border border-[#e5e5e4] rounded-[3px] text-[#6b6b68] hover:bg-[#fafaf9] transition-colors"
                  >
                    Mark unread
                  </button>
                  {openDetail.status === "archived" ? (
                    <button
                      type="button"
                      onClick={() => handleUnarchive(openDetail.id)}
                      className="h-9 px-3 text-xs font-medium border border-[#e5e5e4] rounded-[3px] text-[#1c1c1a] hover:bg-[#fafaf9] transition-colors"
                    >
                      Move to inbox
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleArchive(openDetail.id)}
                      className="h-9 px-3 text-xs font-medium border border-[#e5e5e4] rounded-[3px] text-[#1c1c1a] hover:bg-[#fafaf9] transition-colors"
                    >
                      Archive
                    </button>
                  )}
                  <a
                    href={`https://mail.google.com/mail/u/0/#inbox/${
                      openDetail.metadata && (openDetail.metadata as Record<string, unknown>).gmail_message_id
                        ? String((openDetail.metadata as Record<string, unknown>).gmail_message_id)
                        : openDetail.id
                    }`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 px-4 text-xs font-medium rounded-[3px] text-white inline-flex items-center"
                    style={{ background: "var(--primary, #016D75)" }}
                  >
                    Open in Gmail
                  </a>
                </div>
                <p className="mt-2 text-[10px] text-[#a1a1a0] text-right">
                  Reply composer ships in slice 4. For now use Gmail to respond — replies
                  to the same thread are detected on the next sync run.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
