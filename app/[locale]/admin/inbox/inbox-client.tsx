"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  archiveInboundEmail,
  fetchInboundEmailDetail,
  fetchInboundEmails,
  markInboundEmailUnread,
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
        <table className="arco-table" style={{ minWidth: 1000 }}>
          <thead>
            <tr>
              <th>From</th>
              <th>Company</th>
              <th>Subject</th>
              <th style={{ textAlign: "right" }}>Received</th>
            </tr>
          </thead>
          <tbody>
            {emails.length === 0 && (
              <tr>
                <td colSpan={4} style={{ height: 96, textAlign: "center", color: "var(--text-disabled)" }}>
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
                            const linkTarget = row.companySlug
                              ? `/professionals/${row.companySlug}`
                              : row.prospectId
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
                        {row.prospectId && row.prospectSequence && (
                          <span className="status-pill">
                            <span
                              className={`status-pill-dot ${
                                SEQUENCE_DOT[row.prospectSequence] ?? "bg-[#a1a1a0]"
                              }`}
                            />
                            {SEQUENCE_LABEL[row.prospectSequence] ?? row.prospectSequence}
                          </span>
                        )}
                        {row.prospectId && row.prospectChannel && (
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
                    {openDetail.prospectId && openDetail.prospectSequence && (
                      <span className="status-pill">
                        <span
                          className={`status-pill-dot ${
                            SEQUENCE_DOT[openDetail.prospectSequence] ?? "bg-[#a1a1a0]"
                          }`}
                        />
                        {SEQUENCE_LABEL[openDetail.prospectSequence] ?? openDetail.prospectSequence}
                      </span>
                    )}
                    {openDetail.prospectId && openDetail.prospectChannel && (
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
