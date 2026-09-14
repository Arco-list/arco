"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Info, Mail, MoreHorizontal, RotateCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { useTranslations } from "next-intl"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

import { ToggleSwitch } from "@/components/toggle-switch"
import { PersonIcon } from "@/lib/icons/custom-service-icons"

import {
  inviteTeamMemberAction,
  changeTeamMemberRoleAction,
  removeTeamMemberAction,
  resendTeamInviteAction,
  setCompanyEmailAction,
} from "./actions"

type MemberRow = {
  id: string
  company_id: string
  user_id: string | null
  email: string
  role: string
  status: string
  invited_at: string
  invited_by: string | null
  joined_at: string | null
  receives_company_email: boolean
  profiles: {
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
  } | null
}

interface TeamPageClientProps {
  companyId: string
  companyName: string
  members: MemberRow[]
  isOwner: boolean
  currentUserId: string
}

export function TeamPageClient({ companyId, companyName, members, isOwner, currentUserId }: TeamPageClientProps) {
  const t = useTranslations("dashboard")
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member")
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)

  const canManage = isOwner || members.some(m => m.user_id === currentUserId && m.role === "admin")

  // Close dropdown / info popover on outside click
  useEffect(() => {
    if (!openMenuId && !infoOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element
      if (openMenuId && !target.closest(".dropdown-menu")) setOpenMenuId(null)
      if (infoOpen && !target.closest(".company-email-info")) setInfoOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [openMenuId, infoOpen])

  const handleInvite = () => {
    if (!inviteEmail.trim() || isPending) return
    startTransition(async () => {
      const result = await inviteTeamMemberAction({ email: inviteEmail.trim(), role: inviteRole })
      if (result.success) {
        toast.success(t("invitation_sent"))
        setInviteEmail("")
        setInviteRole("member")
        setInviteModalOpen(false)
        router.refresh()
      } else {
        toast.error(result.error ?? t("failed_send_invitation"))
      }
    })
  }

  const handleChangeRole = (memberId: string, role: "admin" | "member") => {
    startTransition(async () => {
      const result = await changeTeamMemberRoleAction({ memberId, role })
      if (result.success) {
        toast.success(t("role_updated"))
        setOpenMenuId(null)
        router.refresh()
      } else {
        toast.error(result.error ?? t("failed_update_role"))
      }
    })
  }

  const handleRemove = (memberId: string) => {
    startTransition(async () => {
      const result = await removeTeamMemberAction({ memberId })
      if (result.success) {
        toast.success(t("member_removed"))
        setOpenMenuId(null)
        router.refresh()
      } else {
        toast.error(result.error ?? t("failed_remove_member"))
      }
    })
  }

  const handleResend = (memberId: string) => {
    startTransition(async () => {
      const result = await resendTeamInviteAction(memberId)
      if (result.success) {
        toast.success(t("invitation_resent"))
      } else {
        toast.error(result.error ?? t("failed_resend_invitation"))
      }
    })
  }

  const handleCompanyEmail = (memberId: string, enabled: boolean) => {
    startTransition(async () => {
      const result = await setCompanyEmailAction({ memberId, enabled })
      if (result.success) {
        toast.success(t("company_email_updated"))
        router.refresh()
      } else if (result.error === "min_one_receiver") {
        toast.error(t("company_email_min_one"))
      } else {
        toast.error(result.error ?? t("failed_update_role"))
      }
    })
  }

  // Sort: admins first
  const sortedMembers = [...members].sort((a, b) => {
    if (a.role === "admin" && b.role !== "admin") return -1
    if (a.role !== "admin" && b.role === "admin") return 1
    return 0
  })

  const activeMembers = sortedMembers.filter(m => m.status === "active")
  const pendingInvites = sortedMembers.filter(m => m.status === "invited")

  const getDisplayName = (m: MemberRow) => {
    const first = m.profiles?.first_name
    const last = m.profiles?.last_name
    if (first || last) return [first, last].filter(Boolean).join(" ")
    return null
  }

  return (
    <div className="min-h-screen bg-white flex flex-col" style={{ paddingTop: 60 }}>
      <Header navLinks={[
        { href: `/dashboard/listings?company_id=${companyId}`, label: t("listings") },
        { href: `/dashboard/company?company_id=${companyId}`, label: t("company") },
        { href: `/dashboard/team?company_id=${companyId}`, label: t("team") },
        { href: "/dashboard/inbox", label: t("inbox") },
        { href: "/dashboard/pricing", label: t("plans") },
      ]} />

      {/* Page title — matches /dashboard/listings layout */}
      <div className="discover-page-title">
        <div className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 className="arco-section-title">{t("team")}</h2>
          {canManage && (
            <button onClick={() => setInviteModalOpen(true)} className="btn-primary" style={{ fontSize: 14, padding: "10px 20px" }}>
              {t("invite_team_member")}
            </button>
          )}
        </div>
      </div>

      <main style={{ flex: 1 }}>
        <div className="discover-results">
          <div className="wrap">

            {/* Result count */}
            <div className="discover-results-meta">
              <p className="discover-results-count">
                <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>
                  {activeMembers.length.toLocaleString()}
                </strong>{" "}
                {activeMembers.length === 1 ? t("role_member").toLowerCase() : t("team_member_count", { count: activeMembers.length }).replace(String(activeMembers.length), "").trim()}
                {pendingInvites.length > 0 && (
                  <span style={{ color: "var(--arco-mid-grey)" }}>
                    {" "}· {t("pending_count", { count: pendingInvites.length })}
                  </span>
                )}
              </p>
            </div>

            {/* Members table */}
            <div style={{ borderTop: "1px solid var(--arco-light-grey)" }}>
              {/* Column header — label + info dot centred on the
                  switch column (44px cell, overflow lets the text
                  centre on the switch either side). */}
              {activeMembers.length > 0 && (
                <div className="team-col-header">
                  <div style={{ flex: 1 }} />
                  <span style={{ width: 44, display: "flex", justifyContent: "center", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                    <span className="text-xs" style={{ color: "var(--arco-mid-grey)" }}>{t("company_email")}</span>
                    <span className="company-email-info" style={{ position: "relative", display: "flex" }}>
                      <button
                        type="button"
                        onClick={() => setInfoOpen(o => !o)}
                        aria-label={t("company_email_description")}
                        style={{ display: "flex", background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--arco-mid-grey)" }}
                      >
                        <Info size={13} style={{ flexShrink: 0 }} />
                      </button>
                      {infoOpen && (
                        <span style={{
                          position: "absolute", top: "calc(100% + 8px)", right: -8, zIndex: 30,
                          width: 230, padding: "8px 12px", background: "#fff",
                          border: "1px solid var(--arco-light-grey)", borderRadius: 8,
                          boxShadow: "0 4px 16px rgba(0,0,0,.08)",
                          fontSize: 12, lineHeight: 1.5, color: "var(--arco-mid-grey)",
                          whiteSpace: "normal", textAlign: "left",
                        }}>
                          {t("company_email_description")}
                        </span>
                      )}
                    </span>
                  </span>
                  <div style={{ width: 90 }} />
                  {canManage && <div style={{ width: 32 }} />}
                </div>
              )}
              {activeMembers.map(m => {
                const name = getDisplayName(m)
                const isSelf = m.user_id === currentUserId
                const isMenuOpen = openMenuId === m.id

                return (
                  <div key={m.id} className="team-row">
                    {/* Avatar */}
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%",
                      background: "var(--surface)", display: "flex",
                      alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 500, color: "var(--arco-mid-grey)",
                      overflow: "hidden", flexShrink: 0,
                    }}>
                      {m.profiles?.avatar_url ? (
                        <img src={m.profiles.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <PersonIcon size={26} strokeWidth={0.9} />
                      )}
                    </div>

                    {/* Info */}
                    <div className="team-row-info">
                      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <span className="team-row-name">{name ?? m.email}</span>
                        {isSelf && (
                          <span style={{ fontSize: 11, color: "var(--arco-mid-grey)", flexShrink: 0 }}>{t("you")}</span>
                        )}
                      </div>
                      {name && (
                        <p className="team-row-email">{m.email}</p>
                      )}
                    </div>

                    {/* Toggle + role + menu: inline on desktop, their
                        own indented line on mobile (see .team-row-*). */}
                    <div className="team-row-controls">
                    <span
                      className="flex items-center justify-center gap-2"
                      title={t("company_email_hint")}
                      style={{ cursor: canManage ? undefined : "default" }}
                    >
                      <span className="team-toggle-label">{t("company_email")}</span>
                      <ToggleSwitch
                        checked={m.receives_company_email}
                        disabled={!canManage || isPending}
                        onChange={() => handleCompanyEmail(m.id, !m.receives_company_email)}
                      />
                    </span>

                    {/* Role pill — fixed column so the toggle column
                        before it stays aligned across rows. */}
                    <span className="team-role-col">
                      <span className="filter-pill flex items-center gap-1.5" style={{ cursor: "default" }}>
                        <span
                          className="inline-block w-[7px] h-[7px] rounded-full shrink-0"
                          style={{ background: m.role === "admin" ? "var(--arco-black)" : "#939393" }}
                        />
                        <span className="text-xs font-medium">{m.role === "admin" ? t("role_admin") : t("role_member")}</span>
                      </span>
                    </span>

                    {/* 3-dot menu (or spacer for alignment) */}
                    {canManage && !isSelf ? (
                      <div className="dropdown-menu" style={{ position: "relative" }}>
                        <button
                          className="filter-pill"
                          onClick={() => setOpenMenuId(isMenuOpen ? null : m.id)}
                          aria-label="Member options"
                          style={{ padding: "6px 8px", gap: 0 }}
                          data-open={isMenuOpen ? "true" : undefined}
                        >
                          <MoreHorizontal style={{ width: 16, height: 16 }} />
                        </button>
                        <div
                          className="filter-dropdown"
                          data-open={isMenuOpen ? "true" : undefined}
                          data-align="right"
                          style={{ minWidth: 180, top: "calc(100% + 6px)" }}
                        >
                          {isOwner && (
                            <div
                              className="filter-dropdown-option"
                              onClick={() => handleChangeRole(m.id, m.role === "admin" ? "member" : "admin")}
                              role="menuitem"
                            >
                              <span className="filter-dropdown-label">
                                {m.role === "admin" ? t("change_to_member") : t("make_admin")}
                              </span>
                            </div>
                          )}
                          <div style={{ borderTop: "1px solid var(--arco-rule)", margin: "4px 0" }} />
                          <div
                            className="filter-dropdown-option"
                            onClick={() => handleRemove(m.id)}
                            role="menuitem"
                          >
                            <span className="filter-dropdown-label" style={{ color: "#dc2626" }}>{t("remove")}</span>
                          </div>
                        </div>
                      </div>
                    ) : canManage ? (
                      <div className="team-menu-spacer" style={{ width: 32 }} />
                    ) : null}
                    </div>
                  </div>
                )
              })}

              {/* Pending invites */}
              {pendingInvites.map(m => (
                <div key={m.id} className="team-row">
                  {/* Icon */}
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: "var(--surface)", display: "flex",
                    alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <Mail size={14} style={{ color: "var(--arco-mid-grey)" }} />
                  </div>

                  {/* Info */}
                  <div className="team-row-info">
                    <span className="team-row-name" style={{ fontWeight: 400 }}>{m.email}</span>
                    <p className="team-row-email">
                      {t("invited_date", { date: new Date(m.invited_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) })}
                    </p>
                  </div>

                  <div className="team-row-controls">
                  {/* Status pill */}
                  <span className="filter-pill flex items-center gap-1.5" style={{ cursor: "default" }}>
                    <span
                      className="inline-block w-[7px] h-[7px] rounded-full shrink-0"
                      style={{ background: "#f59e0b" }}
                    />
                    <span className="text-xs font-medium">{t("invited")}</span>
                  </span>

                  {/* 3-dot menu */}
                  {canManage && (
                    <div className="dropdown-menu" style={{ position: "relative" }}>
                      <button
                        className="filter-pill"
                        onClick={() => setOpenMenuId(openMenuId === m.id ? null : m.id)}
                        aria-label="Invite options"
                        style={{ padding: "6px 8px", gap: 0 }}
                        data-open={openMenuId === m.id ? "true" : undefined}
                      >
                        <MoreHorizontal style={{ width: 16, height: 16 }} />
                      </button>
                      <div
                        className="filter-dropdown"
                        data-open={openMenuId === m.id ? "true" : undefined}
                        data-align="right"
                        style={{ minWidth: 180, top: "calc(100% + 6px)" }}
                      >
                        <div
                          className="filter-dropdown-option"
                          onClick={() => { handleResend(m.id); setOpenMenuId(null) }}
                          role="menuitem"
                        >
                          <span className="filter-dropdown-label">{t("resend_invite")}</span>
                        </div>
                        <div style={{ borderTop: "1px solid var(--arco-rule)", margin: "4px 0" }} />
                        <div
                          className="filter-dropdown-option"
                          onClick={() => { handleRemove(m.id); setOpenMenuId(null) }}
                          role="menuitem"
                        >
                          <span className="filter-dropdown-label" style={{ color: "#dc2626" }}>{t("cancel_invite")}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  </div>
                </div>
              ))}
            </div>

            {/* Empty state */}
            {members.length <= 1 && pendingInvites.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <p className="arco-body-text" style={{ color: "var(--arco-mid-grey)" }}>
                  {t("empty_team")}
                </p>
              </div>
            )}

          </div>
        </div>
      </main>

      {/* Invite modal */}
      {inviteModalOpen && (
        <div className="popup-overlay" onClick={() => setInviteModalOpen(false)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">{t("invite_modal_title")}</h3>
              <button type="button" className="popup-close" onClick={() => setInviteModalOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>

            <p className="arco-body-text" style={{ color: "var(--arco-mid-grey)", marginBottom: 20 }}>
              {t("invite_modal_description", { company: companyName })}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--arco-black)" }}>
                  {t("invite_email_label")}
                </label>
                <input
                  type="email"
                  className="form-input"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleInvite() }}
                  placeholder="colleague@company.com"
                  autoFocus
                  style={{ marginBottom: 0 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--arco-black)" }}>
                  {t("invite_role_label")}
                </label>
                <select
                  className="form-input"
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as "member" | "admin")}
                  style={{ marginBottom: 0 }}
                >
                  <option value="member">{t("role_member")}</option>
                  <option value="admin">{t("role_admin")}</option>
                </select>
              </div>

              <button
                onClick={handleInvite}
                disabled={isPending || !inviteEmail.trim()}
                className="btn-primary"
                style={{ width: "100%", marginTop: 4, fontSize: 14, padding: "12px 20px" }}
              >
                {isPending ? t("invite_sending") : t("invite_send")}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer maxWidth="max-w-7xl" />
    </div>
  )
}
