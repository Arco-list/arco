"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Mail, MoreHorizontal, RotateCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { useTranslations } from "next-intl"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

import {
  inviteTeamMemberAction,
  changeTeamMemberRoleAction,
  removeTeamMemberAction,
  resendTeamInviteAction,
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

  const canManage = isOwner || members.some(m => m.user_id === currentUserId && m.role === "admin")

  // Close dropdown on outside click
  useEffect(() => {
    if (!openMenuId) return
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest(".dropdown-menu")) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [openMenuId])

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

  const getInitials = (m: MemberRow) => {
    const name = getDisplayName(m)
    if (name) {
      const parts = name.split(" ").filter(Boolean)
      return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].substring(0, 2).toUpperCase()
    }
    return m.email.substring(0, 2).toUpperCase()
  }

  return (
    <div className="min-h-screen bg-white flex flex-col" style={{ paddingTop: 60 }}>
      <Header navLinks={[
        { href: `/dashboard/listings?company_id=${companyId}`, label: t("listings") },
        { href: `/dashboard/company?company_id=${companyId}`, label: t("company") },
        { href: `/dashboard/team?company_id=${companyId}`, label: t("team") },
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
              {activeMembers.map(m => {
                const name = getDisplayName(m)
                const isSelf = m.user_id === currentUserId
                const isMenuOpen = openMenuId === m.id

                return (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "14px 0",
                      borderBottom: "1px solid var(--arco-light-grey)",
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%",
                      background: "var(--arco-off-white)", display: "flex",
                      alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 500, color: "var(--arco-mid-grey)",
                      overflow: "hidden", flexShrink: 0,
                    }}>
                      {m.profiles?.avatar_url ? (
                        <img src={m.profiles.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        getInitials(m)
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--arco-black)" }}>
                          {name ?? m.email}
                        </span>
                        {isSelf && (
                          <span style={{ fontSize: 11, color: "var(--arco-mid-grey)" }}>{t("you")}</span>
                        )}
                      </div>
                      {name && (
                        <p style={{ fontSize: 13, color: "var(--arco-mid-grey)", margin: 0 }}>{m.email}</p>
                      )}
                    </div>

                    {/* Role pill */}
                    <span className="filter-pill flex items-center gap-1.5" style={{ cursor: "default" }}>
                      <span
                        className="inline-block w-[7px] h-[7px] rounded-full shrink-0"
                        style={{ background: m.role === "admin" ? "var(--arco-black)" : "#939393" }}
                      />
                      <span className="text-xs font-medium">{m.role === "admin" ? t("role_admin") : t("role_member")}</span>
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
                      <div style={{ width: 32 }} />
                    ) : null}
                  </div>
                )
              })}

              {/* Pending invites */}
              {pendingInvites.map(m => (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "14px 0",
                    borderBottom: "1px solid var(--arco-light-grey)",
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: "var(--arco-off-white)", display: "flex",
                    alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <Mail size={14} style={{ color: "var(--arco-mid-grey)" }} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 14, color: "var(--arco-black)" }}>{m.email}</span>
                    <p style={{ fontSize: 13, color: "var(--arco-mid-grey)", margin: 0 }}>
                      {t("invited_date", { date: new Date(m.invited_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) })}
                    </p>
                  </div>

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
