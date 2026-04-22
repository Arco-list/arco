"use client"

import { Fragment, useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { fetchRecentEmails, fetchTemplateStats, fetchCachedStats, sendTestEmail, type ResendEmail, type TemplateStats } from "./actions"
import { useAuth } from "@/contexts/auth-context"
import { clickedRateColor, deliveredRateColor, openedRateColor } from "@/lib/email-rate-colors"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type UserAudience = "all" | "professional" | "client" | "admin"

type EmailSender = {
  name: string
  email: string
  icon?: string // URL or initials fallback
}

type EmailTemplate = {
  id: string
  name: string
  type: "transactional" | "marketing"
  audience: UserAudience
  description: string
  trigger: string
  subject: string
  sends: number
  deliveryRate: number
  active: boolean
  drip?: string  // group key for drip sequences
  dripDay?: number  // day number in the drip
  from?: EmailSender
}

const SENDERS: Record<string, EmailSender> = {
  arco: { name: "Arco", email: "automated@arcolist.com", icon: "/arco-logo-square.png" },
  niek: { name: "Niek van Leeuwen", email: "niek@arcolist.com", icon: "/arco-logo-square.png" },
  team: { name: "Arco Team", email: "team@arcolist.com", icon: "/arco-logo-square.png" },
}

const AUDIENCE_CONFIG: Record<UserAudience, { label: string; cls: string }> = {
  all: { label: "All", cls: "bg-[#f5f5f4] text-[#6b6b68]" },
  professional: { label: "Professional", cls: "bg-[#e6f4f5] text-[#016D75]" },
  client: { label: "Client", cls: "bg-amber-50 text-amber-700" },
  admin: { label: "Admin", cls: "bg-violet-50 text-violet-700" },
}

const INITIAL_TEMPLATES: EmailTemplate[] = [
  { id: "magic-link", name: "Sign-in Code", type: "transactional", audience: "all", description: "OTP code for magic link sign-in", trigger: "User signs in with email (OTP)", subject: "[Code] is your Arco sign-in code", sends: 0, deliveryRate: 100, active: true, from: SENDERS.arco },
  { id: "signup", name: "Signup Confirmation", type: "transactional", audience: "all", description: "Email confirmation after signup", trigger: "User creates account with email + password", subject: "[Code] is your Arco verification code", sends: 0, deliveryRate: 100, active: true, from: SENDERS.arco },
  { id: "domain-verification", name: "Domain Verification", type: "transactional", audience: "professional", description: "6-digit code for domain ownership", trigger: "User verifies company domain during creation", subject: "[Code] is your Arco domain verification code", sends: 0, deliveryRate: 100, active: true, from: SENDERS.arco },
  { id: "professional-invite", name: "Professional Invite", type: "transactional", audience: "professional", description: "Credited on a project", trigger: "Architect credits professional on published project", subject: "[Company] credited you on [Project]", sends: 0, deliveryRate: 100, active: true, from: SENDERS.arco },
  { id: "team-invite", name: "Team Invite", type: "transactional", audience: "professional", description: "Invited to join a company", trigger: "Company admin invites team member", subject: "You're invited to join [Company]", sends: 0, deliveryRate: 100, active: true, from: SENDERS.arco },
  { id: "project-live", name: "Project Live", type: "transactional", audience: "professional", description: "Project published on Arco", trigger: "Admin publishes project (status → published)", subject: "[Project] is now live on Arco", sends: 0, deliveryRate: 100, active: true, from: SENDERS.arco },
  { id: "project-rejected", name: "Project Rejected", type: "transactional", audience: "professional", description: "Project not approved", trigger: "Admin rejects project (status → rejected)", subject: "Update on [Project]", sends: 0, deliveryRate: 100, active: true, from: SENDERS.arco },
  { id: "password-reset", name: "Password Reset", type: "transactional", audience: "all", description: "Reset password link", trigger: "User requests password reset", subject: "Reset your Arco password", sends: 0, deliveryRate: 100, active: true, from: SENDERS.arco },
  { id: "welcome-homeowner", name: "Welcome", type: "marketing", audience: "client", description: "Sent immediately after homeowner signup", trigger: "Profile created with client user type", subject: "Welcome to Arco", sends: 0, deliveryRate: 100, active: true, drip: "homeowner-onboarding", dripDay: 0, from: SENDERS.arco },
  { id: "discover-projects", name: "Discover Projects", type: "marketing", audience: "client", description: "Highlights project browsing and filtering", trigger: "Drip queue · 3 days after signup", subject: "Discover projects on Arco", sends: 0, deliveryRate: 100, active: true, drip: "homeowner-onboarding", dripDay: 3, from: SENDERS.arco },
  { id: "find-professionals", name: "Find Professionals", type: "marketing", audience: "client", description: "Introduces professional discovery", trigger: "Drip queue · 10 days after signup", subject: "Find the right professional on Arco", sends: 0, deliveryRate: 100, active: true, drip: "homeowner-onboarding", dripDay: 10, from: SENDERS.arco },
  { id: "project-digest", name: "Project Digest", type: "marketing", audience: "client", description: "Weekly digest of new projects", trigger: "Not built", subject: "New projects on Arco this week", sends: 0, deliveryRate: 0, active: false, from: SENDERS.arco },
  { id: "inactive-reminder", name: "Inactive Reminder", type: "marketing", audience: "professional", description: "Re-engagement for inactive users", trigger: "Not built", subject: "Your company page on Arco", sends: 0, deliveryRate: 0, active: false, from: SENDERS.arco },
  { id: "prospect-intro", name: "Prospect Intro", type: "marketing", audience: "professional", description: "Outreach to companies added by platform", trigger: "Admin sends from Companies table (status: Prospected)", subject: "Een podium voor [Company]", sends: 0, deliveryRate: 100, active: true, drip: "prospect-outreach", dripDay: 0, from: SENDERS.niek },
  { id: "prospect-followup", name: "Prospect Follow-up", type: "marketing", audience: "professional", description: "Follow-up if no response to intro", trigger: "Drip queue · 3 days after intro", subject: "[Company] op Arco", sends: 0, deliveryRate: 100, active: true, drip: "prospect-outreach", dripDay: 3, from: SENDERS.niek },
  { id: "prospect-final", name: "Prospect Final", type: "marketing", audience: "professional", description: "Last reminder before sequence ends", trigger: "Drip queue · 7 days after intro", subject: "Claim [Company] op Arco", sends: 0, deliveryRate: 100, active: true, drip: "prospect-outreach", dripDay: 7, from: SENDERS.niek },
  { id: "new-professional-invite", name: "New Professional Invite", type: "marketing", audience: "professional", description: "First contact when an unclaimed company is credited on a project", trigger: "Project owner credits an unclaimed company on a published project", subject: "[Inviter] credited you on [Project]", sends: 0, deliveryRate: 100, active: true, drip: "new-professional-invite", dripDay: 0, from: SENDERS.arco },
  { id: "new-professional-followup", name: "New Professional Follow-up", type: "marketing", audience: "professional", description: "Follow-up if no response to invite", trigger: "Drip queue · 3 days after invite", subject: "Claim [Company]", sends: 0, deliveryRate: 100, active: true, drip: "new-professional-invite", dripDay: 3, from: SENDERS.arco },
  { id: "new-professional-final", name: "New Professional Final", type: "marketing", audience: "professional", description: "Last reminder before sequence ends", trigger: "Drip queue · 7 days after invite", subject: "Last reminder: claim [Company] on Arco", sends: 0, deliveryRate: 100, active: true, drip: "new-professional-invite", dripDay: 7, from: SENDERS.arco },
]

type TabKey = "transactional" | "marketing" | "sent"
// All templates are now previewable

export default function AdminEmailsPage() {
  const { user } = useAuth()
  const [emails, setEmails] = useState<ResendEmail[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>("transactional")
  const [templates, setTemplates] = useState(INITIAL_TEMPLATES)
  const [templateStats, setTemplateStats] = useState<Record<string, TemplateStats>>({})
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null)
  // Preview locale — toggles the iframe URL so we can eyeball both Dutch
  // and English rendering without restarting the dev server. Reset to EN
  // whenever the preview popup opens on a different template.
  const [previewLocale, setPreviewLocale] = useState<"en" | "nl">("en")
  // Subject for the currently previewed template+locale. Fetched from
  // /admin/emails/preview?meta=1 so it always matches what the renderer
  // would actually send (e.g. "Welkom bij Arco" for the NL welcome).
  const [previewSubject, setPreviewSubject] = useState<string | null>(null)

  // Re-fetch whenever the previewed template or the locale toggle changes.
  useEffect(() => {
    if (!previewTemplate) {
      setPreviewSubject(null)
      return
    }
    let cancelled = false
    setPreviewSubject(null)
    fetch(`/admin/emails/preview?template=${previewTemplate}&lang=${previewLocale}&meta=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json?.subject) setPreviewSubject(json.subject)
      })
      .catch(() => { /* non-fatal — header just shows template name */ })
    return () => { cancelled = true }
  }, [previewTemplate, previewLocale])
  const [audienceFilter, setAudienceFilter] = useState<UserAudience | "all-filter">("all-filter")
  const [timeFilter, setTimeFilter] = useState<string>("30d")
  const [isPending, startTransition] = useTransition()

  // On mount: load cached stats instantly so the table renders with data
  // before the slower Resend API fetch completes.
  const [statsLoaded, setStatsLoaded] = useState(false)
  useEffect(() => {
    fetchCachedStats().then(({ stats }) => {
      if (Object.keys(stats).length > 0) {
        setTemplateStats(stats)
        setStatsLoaded(true)
      }
    })
  }, [])

  useEffect(() => {
    const sinceDate = timeFilter === "all" ? undefined
      : timeFilter === "7d" ? new Date(Date.now() - 7 * 86400000).toISOString()
      : timeFilter === "30d" ? new Date(Date.now() - 30 * 86400000).toISOString()
      : timeFilter === "90d" ? new Date(Date.now() - 90 * 86400000).toISOString()
      : undefined
    if (!statsLoaded) setIsLoading(true)
    Promise.all([fetchRecentEmails(), fetchTemplateStats(sinceDate)]).then(([emailResult, statsResult]) => {
      if (emailResult.error) setError(emailResult.error)
      else setEmails(emailResult.emails)
      // Merge fresh stats on top of cached — keeps cached values for
      // templates the fresh fetch didn't return (e.g. no sends in the
      // selected time window).
      if (statsResult.stats && Object.keys(statsResult.stats).length > 0) {
        setTemplateStats(prev => ({ ...prev, ...statsResult.stats }))
      }
      setIsLoading(false)
      setStatsLoaded(true)
    })
  }, [timeFilter])

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab)
  }

  const handleSendTest = (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user?.email) { toast.error("No email address found"); return }
    startTransition(async () => {
      const result = await sendTestEmail(templateId, user.email!)
      if (result.success) toast.success(`Test email sent to ${user.email}`)
      else toast.error(result.error ?? "Failed to send test email")
    })
  }

  const toggleActive = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, active: !t.active } : t))
    const t = templates.find(t => t.id === id)
    toast.success(`${t?.name} ${t?.active ? "deactivated" : "activated"}`)
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    } catch { return dateStr }
  }

  const filteredTemplates = templates
    .filter(t => t.type === activeTab)
    .filter(t => audienceFilter === "all-filter" || t.audience === audienceFilter)
  const activeCount = templates.filter(t => t.type === activeTab && t.active).length
  const totalCount = templates.filter(t => t.type === activeTab).length

  // Group drip sequences: first email is the header, rest are collapsed
  const [expandedDrips, setExpandedDrips] = useState<Set<string>>(new Set())
  const groupedTemplates = (() => {
    const result: Array<{ template: EmailTemplate; isDripHeader: boolean; dripCount: number; dripChildren: EmailTemplate[] }> = []
    const seenDrips = new Set<string>()

    for (const t of filteredTemplates) {
      if (t.drip) {
        if (seenDrips.has(t.drip)) continue // skip non-first drip items
        seenDrips.add(t.drip)
        const dripItems = filteredTemplates.filter(x => x.drip === t.drip).sort((a, b) => (a.dripDay ?? 0) - (b.dripDay ?? 0))
        result.push({ template: dripItems[0], isDripHeader: true, dripCount: dripItems.length, dripChildren: dripItems.slice(1) })
      } else {
        result.push({ template: t, isDripHeader: false, dripCount: 0, dripChildren: [] })
      }
    }
    return result
  })()

  const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
    sent: { label: "Sent", dot: "#016D75" },
    delivered: { label: "Delivered", dot: "#059669" },
    opened: { label: "Opened", dot: "#2563eb" },
    clicked: { label: "Clicked", dot: "#7c3aed" },
    bounced: { label: "Bounced", dot: "#dc2626" },
    complained: { label: "Spam", dot: "#dc2626" },
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="discover-page-title">
        <div className="wrap">

          {/* Header */}
          <div className="flex flex-col gap-1 mb-6">
            <h3 className="arco-section-title">Emails</h3>
            <p className="text-xs text-[#a1a1a0] mt-0.5">
              {activeTab === "sent"
                ? `${emails.length} emails`
                : `${totalCount} total \u00b7 ${activeCount} active`}
            </p>
          </div>

          {/* Tabs — underline style like categories */}
          <div className="flex gap-0 border-b border-[#e5e5e4]">
            <button
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === "transactional"
                  ? "border-[#1c1c1a] text-[#1c1c1a]"
                  : "border-transparent text-[#a1a1a0] hover:text-[#6b6b68]"
              }`}
              onClick={() => handleTabChange("transactional")}
            >
              Transactional
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === "marketing"
                  ? "border-[#1c1c1a] text-[#1c1c1a]"
                  : "border-transparent text-[#a1a1a0] hover:text-[#6b6b68]"
              }`}
              onClick={() => handleTabChange("marketing")}
            >
              Marketing
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === "sent"
                  ? "border-[#1c1c1a] text-[#1c1c1a]"
                  : "border-transparent text-[#a1a1a0] hover:text-[#6b6b68]"
              }`}
              onClick={() => handleTabChange("sent")}
            >
              Sent
            </button>
          </div>

          {/* Transactional / Marketing table */}
          {(activeTab === "transactional" || activeTab === "marketing") && (
            <>
            {/* Filters — same layout as categories page */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mt-4 mb-4">
              <div className="flex flex-1 items-center" />
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={timeFilter}
                  onValueChange={setTimeFilter}
                >
                  <SelectTrigger className="w-[140px] h-9 text-xs border-[#e5e5e4] rounded-[3px]">
                    <SelectValue placeholder="All time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All time</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={audienceFilter}
                  onValueChange={(value) => setAudienceFilter(value as UserAudience | "all-filter")}
                >
                  <SelectTrigger className="w-[180px] h-9 text-xs border-[#e5e5e4] rounded-[3px]">
                    <SelectValue placeholder="All audiences" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-filter">All audiences</SelectItem>
                    <SelectItem value="all">All users</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="arco-table-wrap" style={{ maxWidth: "100%", marginTop: 16 }}>
              <table className="arco-table" style={{ minWidth: 600 }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 220 }}>Email</th>
                    <th>From</th>
                    <th>User</th>
                    <th>Subject</th>
                    <th style={{ textAlign: "right" }}>Sends</th>
                    <th style={{ textAlign: "right" }}>Delivered</th>
                    <th style={{ textAlign: "right" }} title="Enable tracking in Resend dashboard">Opened</th>
                    <th style={{ textAlign: "right" }} title="Enable tracking in Resend dashboard">Clicked</th>
                    <th style={{ textAlign: "center" }}>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedTemplates.map(({ template: t, isDripHeader, dripCount, dripChildren }) => (
                    <Fragment key={t.id}>
                    <tr
                      style={{ cursor: "pointer" }}
                      onClick={() => setPreviewTemplate(t.id)}
                    >
                      <td>
                        <div className="flex items-center gap-2">
                          {isDripHeader && (
                            <button
                              className="shrink-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                setExpandedDrips((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(t.drip!)) next.delete(t.drip!)
                                  else next.add(t.drip!)
                                  return next
                                })
                              }}
                            >
                              <svg width="10" height="10" viewBox="0 0 10 10" className={`transition-transform ${expandedDrips.has(t.drip!) ? "rotate-90" : ""}`}>
                                <path d="M3 2L7 5L3 8" stroke="#a1a1a0" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                              </svg>
                            </button>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="arco-table-primary">{t.name}</span>
                              {isDripHeader && (
                                <span className="status-pill">{dripCount} emails</span>
                              )}
                              {t.dripDay !== undefined && (
                                <span className="status-pill" style={{ borderColor: "#bfdbfe", color: "#2563eb" }}>Day {t.dripDay}</span>
                              )}
                            </div>
                            <div className="arco-table-secondary" style={{ marginTop: 2 }}>{t.trigger}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {t.from ? (
                          <div className="flex items-center gap-2">
                            {t.from.icon ? (
                              <div className="arco-table-avatar" style={{ width: 20, height: 20 }}>
                                <img src={t.from.icon} alt="" />
                              </div>
                            ) : (
                              <div className="arco-table-avatar" style={{ width: 20, height: 20, background: "#f5f5f4", color: "#6b6b68", fontSize: 9 }}>
                                {t.from.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                              </div>
                            )}
                            <div className="flex flex-col min-w-0">
                              <span className="arco-table-primary">{t.from.name}</span>
                              <span className="arco-table-secondary" style={{ marginTop: 1 }}>{t.from.email}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="arco-table-secondary" style={{ marginTop: 0 }}>—</span>
                        )}
                      </td>
                      <td>
                        {AUDIENCE_CONFIG[t.audience].label}
                      </td>
                      <td style={{ maxWidth: 250 }} className="text-xs text-[#6b6b68] truncate">
                        {t.subject}
                      </td>
                      {(() => {
                        const s = templateStats[t.id]
                        const sends = s?.sends ?? 0
                        const deliveryRate = sends > 0 ? Math.round((s.delivered / sends) * 100) : 0
                        const openRate = sends > 0 ? Math.round((s.opened / sends) * 100) : 0
                        const clickRate = sends > 0 ? Math.round((s.clicked / sends) * 100) : 0
                        return <>
                      <td style={{ textAlign: "right" }} className="text-xs text-[#6b6b68] font-medium">
                        {sends > 0 ? sends.toLocaleString() : "—"}
                      </td>
                      <td style={{ textAlign: "right" }} className="text-xs font-medium">
                        <span className={deliveredRateColor(deliveryRate, sends)}>
                          {sends > 0 ? `${deliveryRate}%` : "—"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }} className="text-xs font-medium">
                        <span className={openedRateColor(openRate, sends)}>
                          {sends > 0 ? `${openRate}%` : "—"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }} className="text-xs font-medium">
                        <span className={clickedRateColor(clickRate, sends)}>
                          {sends > 0 ? `${clickRate}%` : "—"}
                        </span>
                      </td>
                        </>
                      })()}
                      <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                        <button
                          onClick={(e) => toggleActive(t.id, e)}
                          className="relative inline-block"
                          style={{ width: 34, height: 18, borderRadius: 9, border: "none", cursor: "pointer", background: t.active ? "#016D75" : "#d4d4d4", transition: "background .2s" }}
                        >
                          <span style={{
                            position: "absolute", top: 2, left: t.active ? 18 : 2,
                            width: 14, height: 14, borderRadius: 7, background: "#fff",
                            transition: "left .2s", boxShadow: "0 1px 2px rgba(0,0,0,.15)",
                          }} />
                        </button>
                      </td>
                    </tr>
                    {/* Drip children — shown when expanded */}
                    {isDripHeader && expandedDrips.has(t.drip!) && dripChildren.map((child) => (
                      <tr
                        key={child.id}
                        style={{ cursor: "pointer", background: "var(--arco-white)" }}
                        onClick={() => setPreviewTemplate(child.id)}
                      >
                        <td style={{ paddingLeft: 40 }}>
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="arco-table-primary">{child.name}</span>
                                {child.dripDay !== undefined && (
                                  <span className="status-pill" style={{ borderColor: "#bfdbfe", color: "#2563eb" }}>Day {child.dripDay}</span>
                                )}
                              </div>
                              <div className="arco-table-secondary" style={{ marginTop: 2 }}>{child.trigger}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          {child.from ? (
                            <div className="flex items-center gap-2">
                              {child.from.icon ? (
                                <div className="arco-table-avatar" style={{ width: 20, height: 20 }}>
                                  <img src={child.from.icon} alt="" />
                                </div>
                              ) : (
                                <div className="arco-table-avatar" style={{ width: 20, height: 20, background: "#f5f5f4", color: "#6b6b68", fontSize: 9 }}>
                                  {child.from.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                                </div>
                              )}
                              <div className="flex flex-col min-w-0">
                                <span className="arco-table-primary">{child.from.name}</span>
                                <span className="arco-table-secondary" style={{ marginTop: 1 }}>{child.from.email}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="arco-table-secondary" style={{ marginTop: 0 }}>—</span>
                          )}
                        </td>
                        <td>
                          {AUDIENCE_CONFIG[child.audience].label}
                        </td>
                        <td style={{ maxWidth: 250 }} className="text-xs text-[#6b6b68] truncate">{child.subject}</td>
                        {(() => {
                          const s = templateStats[child.id]
                          const sends = s?.sends ?? 0
                          const deliveryRate = sends > 0 ? Math.round((s.delivered / sends) * 100) : 0
                          const openRate = sends > 0 ? Math.round((s.opened / sends) * 100) : 0
                          const clickRate = sends > 0 ? Math.round((s.clicked / sends) * 100) : 0
                          return <>
                            <td style={{ textAlign: "right" }} className="text-xs text-[#6b6b68] font-medium">{sends > 0 ? sends.toLocaleString() : "—"}</td>
                            <td style={{ textAlign: "right" }} className="text-xs font-medium"><span className={deliveredRateColor(deliveryRate, sends)}>{sends > 0 ? `${deliveryRate}%` : "—"}</span></td>
                            <td style={{ textAlign: "right" }} className="text-xs font-medium"><span className={openedRateColor(openRate, sends)}>{sends > 0 ? `${openRate}%` : "—"}</span></td>
                            <td style={{ textAlign: "right" }} className="text-xs font-medium"><span className={clickedRateColor(clickRate, sends)}>{sends > 0 ? `${clickRate}%` : "—"}</span></td>
                          </>
                        })()}
                        <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                          <button
                            onClick={(e) => toggleActive(child.id, e)}
                            className="relative inline-block"
                            style={{ width: 34, height: 18, borderRadius: 9, border: "none", cursor: "pointer", background: child.active ? "#016D75" : "#d4d4d4", transition: "background .2s" }}
                          >
                            <span style={{
                              position: "absolute", top: 2, left: child.active ? 18 : 2,
                              width: 14, height: 14, borderRadius: 7, background: "#fff",
                              transition: "left .2s", boxShadow: "0 1px 2px rgba(0,0,0,.15)",
                            }} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}

          {/* Sent emails table */}
          {activeTab === "sent" && (
            <div className="arco-table-wrap" style={{ maxWidth: "100%", marginTop: 16 }}>
              {isLoading ? (
                <p className="text-sm text-[#a1a1a0] text-center py-10">Loading sent emails...</p>
              ) : error ? (
                <p className="text-sm text-red-600 text-center py-10">{error}</p>
              ) : emails.length === 0 ? (
                <p className="text-sm text-[#a1a1a0] text-center py-10">No emails sent yet.</p>
              ) : (
                <table className="arco-table" style={{ minWidth: 600 }}>
                  <thead>
                    <tr>
                      <th>To</th>
                      <th style={{ minWidth: 220 }}>Email</th>
                      <th>Subject</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Sent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emails.map((email) => {
                      const status = STATUS_CONFIG[email.last_event] ?? { label: email.last_event, dot: "#a1a1a0" }
                      return (
                        <tr key={email.id}>
                          <td className="text-sm text-[#1c1c1a]">{email.to.join(", ")}</td>
                          <td className="text-xs text-[#6b6b68]">
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              {email.templateId ? (
                                <button
                                  type="button"
                                  className="text-[#016D75] hover:underline cursor-pointer"
                                  onClick={() => setPreviewTemplate(email.templateId)}
                                >
                                  {email.templateName}
                                </button>
                              ) : (
                                <span className="text-[#c4c4c2] italic">Unknown</span>
                              )}
                              {email.locale && (
                                <span
                                  className="status-pill"
                                  title={email.locale === "nl" ? "Dutch" : "English"}
                                  style={{ textTransform: "uppercase" }}
                                >
                                  {email.locale}
                                </span>
                              )}
                            </span>
                          </td>
                          <td style={{ maxWidth: 300 }} className="text-sm text-[#1c1c1a] truncate">{email.subject}</td>
                          <td>
                            <span className="arco-table-status">
                              <span className="arco-table-status-dot" style={{ background: status.dot }} />
                              {status.label}
                            </span>
                          </td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }} className="text-xs text-[#a1a1a0]">{formatDate(email.created_at)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Preview popup */}
          {previewTemplate && (
            <div className="popup-overlay" onClick={() => setPreviewTemplate(null)}>
              <div
                className="popup-card"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: 640, padding: 0, maxHeight: "85vh", display: "flex", flexDirection: "column" }}
              >
                <div style={{
                  padding: "16px 24px", background: "var(--arco-off-white)",
                  borderRadius: "12px 12px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
                }}>
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <span className="text-sm font-medium text-[#1c1c1a]">
                      {templates.find(t => t.id === previewTemplate)?.name}
                    </span>
                    {previewSubject && (
                      <span
                        className="text-xs text-[#6b6b68] truncate"
                        style={{ marginTop: 2 }}
                        title={previewSubject}
                      >
                        {previewSubject}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {/* Locale toggle — affects only the iframe render.
                        Test send still uses the resolver. */}
                    <div style={{ display: "inline-flex", border: "1px solid var(--arco-rule)", borderRadius: 3, overflow: "hidden", fontSize: 11 }}>
                      {(["en", "nl"] as const).map((loc) => (
                        <button
                          key={loc}
                          type="button"
                          onClick={() => setPreviewLocale(loc)}
                          style={{
                            padding: "4px 10px",
                            background: previewLocale === loc ? "var(--arco-black)" : "transparent",
                            color: previewLocale === loc ? "#fff" : "var(--arco-mid-grey)",
                            border: "none",
                            cursor: "pointer",
                            fontWeight: previewLocale === loc ? 500 : 400,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {loc}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={(e) => handleSendTest(previewTemplate, e)}
                      disabled={isPending}
                      className="arco-nav-text h-7 px-3 rounded-[3px] text-xs"
                      style={{ background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer", opacity: isPending ? 0.5 : 1 }}
                    >
                      {isPending ? "Sending..." : "Send test"}
                    </button>
                    <button className="popup-close" onClick={() => setPreviewTemplate(null)} aria-label="Close">✕</button>
                  </div>
                </div>
                <iframe
                  src={`/admin/emails/preview?template=${previewTemplate}&lang=${previewLocale}`}
                  style={{ width: "100%", flex: 1, minHeight: 500, border: "none", background: "#f5f5f4" }}
                  title="Email preview"
                />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
