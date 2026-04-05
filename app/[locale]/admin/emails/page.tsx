"use client"

import { Fragment, useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { fetchRecentEmails, fetchTemplateStats, sendTestEmail, type ResendEmail, type TemplateStats } from "./actions"
import { useAuth } from "@/contexts/auth-context"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type UserAudience = "all" | "professional" | "homeowner" | "admin"

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
  niek: { name: "Niek van Leeuwen", email: "niek@arcolist.com" },
  team: { name: "Arco Team", email: "team@arcolist.com", icon: "/arco-logo-square.png" },
}

const AUDIENCE_CONFIG: Record<UserAudience, { label: string; cls: string }> = {
  all: { label: "All", cls: "bg-[#f5f5f4] text-[#6b6b68]" },
  professional: { label: "Professional", cls: "bg-[#e6f4f5] text-[#016D75]" },
  homeowner: { label: "Homeowner", cls: "bg-amber-50 text-amber-700" },
  admin: { label: "Admin", cls: "bg-violet-50 text-violet-700" },
}

const INITIAL_TEMPLATES: EmailTemplate[] = [
  { id: "magic-link", name: "Sign-in Code", type: "transactional", audience: "all", description: "OTP code for magic link sign-in", trigger: "User signs in with email (OTP)", subject: "[Code] is your Arco sign-in code", sends: 0, deliveryRate: 100, active: true, from: SENDERS.arco },
  { id: "signup", name: "Signup Confirmation", type: "transactional", audience: "all", description: "Email confirmation after signup", trigger: "User creates account with email + password", subject: "[Code] is your Arco verification code", sends: 0, deliveryRate: 100, active: true, from: SENDERS.arco },
  { id: "domain-verification", name: "Domain Verification", type: "transactional", audience: "professional", description: "6-digit code for domain ownership", trigger: "User verifies company domain during creation", subject: "[Code] is your Arco verification code", sends: 0, deliveryRate: 100, active: true, from: SENDERS.arco },
  { id: "professional-invite", name: "Professional Invite", type: "transactional", audience: "professional", description: "Credited on a project", trigger: "Architect credits professional on published project", subject: "[Company] credited you on [Project]", sends: 0, deliveryRate: 100, active: true, from: SENDERS.arco },
  { id: "team-invite", name: "Team Invite", type: "transactional", audience: "professional", description: "Invited to join a company", trigger: "Company admin invites team member", subject: "You're invited to join [Company]", sends: 0, deliveryRate: 100, active: true, from: SENDERS.arco },
  { id: "project-live", name: "Project Live", type: "transactional", audience: "professional", description: "Project published on Arco", trigger: "Admin publishes project (status → published)", subject: "[Project] is now live on Arco", sends: 0, deliveryRate: 100, active: true, from: SENDERS.arco },
  { id: "project-rejected", name: "Project Rejected", type: "transactional", audience: "professional", description: "Project not approved", trigger: "Admin rejects project (status → rejected)", subject: "Update on [Project]", sends: 0, deliveryRate: 100, active: true, from: SENDERS.arco },
  { id: "password-reset", name: "Password Reset", type: "transactional", audience: "all", description: "Reset password link", trigger: "User requests password reset", subject: "Reset your Arco password", sends: 0, deliveryRate: 100, active: true, from: SENDERS.arco },
  { id: "welcome-homeowner", name: "Welcome", type: "marketing", audience: "homeowner", description: "Sent immediately after homeowner signup", trigger: "Profile created with client user type", subject: "Welcome to Arco", sends: 0, deliveryRate: 100, active: true, drip: "homeowner-onboarding", dripDay: 0, from: SENDERS.arco },
  { id: "discover-projects", name: "Discover Projects", type: "marketing", audience: "homeowner", description: "Highlights project browsing and filtering", trigger: "Drip queue · 2 days after signup", subject: "Discover projects on Arco", sends: 0, deliveryRate: 100, active: true, drip: "homeowner-onboarding", dripDay: 2, from: SENDERS.niek },
  { id: "find-professionals", name: "Find Professionals", type: "marketing", audience: "homeowner", description: "Introduces professional discovery", trigger: "Drip queue · 5 days after signup", subject: "Find the right professional on Arco", sends: 0, deliveryRate: 100, active: true, drip: "homeowner-onboarding", dripDay: 5, from: SENDERS.niek },
  { id: "project-digest", name: "Project Digest", type: "marketing", audience: "homeowner", description: "Weekly digest of new projects", trigger: "Not built", subject: "New projects on Arco this week", sends: 0, deliveryRate: 0, active: false, from: SENDERS.arco },
  { id: "inactive-reminder", name: "Inactive Reminder", type: "marketing", audience: "professional", description: "Re-engagement for inactive users", trigger: "Not built", subject: "Your company page on Arco", sends: 0, deliveryRate: 0, active: false, from: SENDERS.arco },
  { id: "prospect-intro", name: "Prospect Intro", type: "marketing", audience: "professional", description: "Outreach to companies added by platform", trigger: "Admin sends from Companies table (status: Prospected)", subject: "Een podium voor [Company]", sends: 0, deliveryRate: 100, active: true, drip: "prospect-outreach", dripDay: 0, from: SENDERS.niek },
  { id: "prospect-followup", name: "Prospect Follow-up", type: "marketing", audience: "professional", description: "Follow-up if no response to intro", trigger: "Drip queue · 3 days after intro", subject: "Uw pagina op Arco is klaar", sends: 0, deliveryRate: 100, active: true, drip: "prospect-outreach", dripDay: 3, from: SENDERS.niek },
  { id: "prospect-final", name: "Prospect Final", type: "marketing", audience: "professional", description: "Last reminder before sequence ends", trigger: "Drip queue · 7 days after intro", subject: "Laatste herinnering: claim [Company] op Arco", sends: 0, deliveryRate: 100, active: true, drip: "prospect-outreach", dripDay: 7, from: SENDERS.niek },
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
  const [audienceFilter, setAudienceFilter] = useState<UserAudience | "all-filter">("all-filter")
  const [timeFilter, setTimeFilter] = useState<string>("all")
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const sinceDate = timeFilter === "all" ? undefined
      : timeFilter === "7d" ? new Date(Date.now() - 7 * 86400000).toISOString()
      : timeFilter === "30d" ? new Date(Date.now() - 30 * 86400000).toISOString()
      : timeFilter === "90d" ? new Date(Date.now() - 90 * 86400000).toISOString()
      : undefined
    setIsLoading(true)
    Promise.all([fetchRecentEmails(), fetchTemplateStats(sinceDate)]).then(([emailResult, statsResult]) => {
      if (emailResult.error) setError(emailResult.error)
      else setEmails(emailResult.emails)
      if (statsResult.stats) setTemplateStats(statsResult.stats)
      setIsLoading(false)
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

  const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
    sent: { label: "Sent", cls: "bg-[#e6f4f5] text-[#016D75]" },
    delivered: { label: "Delivered", cls: "bg-emerald-50 text-emerald-700" },
    opened: { label: "Opened", cls: "bg-blue-50 text-blue-700" },
    clicked: { label: "Clicked", cls: "bg-violet-50 text-violet-700" },
    bounced: { label: "Bounced", cls: "bg-red-50 text-red-700" },
    complained: { label: "Spam", cls: "bg-red-50 text-red-700" },
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
                    <SelectItem value="homeowner">Homeowner</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="border border-[#e5e5e4] overflow-x-auto max-w-full mt-4">
              <table className="w-full text-sm" style={{ minWidth: 600 }}>
                <thead>
                  <tr className="border-b border-[#e5e5e4]">
                    <th className="text-left px-4 py-2 text-xs font-medium text-[#6b6b68]">Email</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-[#6b6b68]">From</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-[#6b6b68]">User</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-[#6b6b68]">Subject</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-[#6b6b68]">Sends</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-[#6b6b68]">Delivered</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-[#6b6b68]" title="Enable tracking in Resend dashboard">Opened</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-[#6b6b68]" title="Enable tracking in Resend dashboard">Clicked</th>
                    <th className="text-center px-4 py-2 text-xs font-medium text-[#6b6b68]">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedTemplates.map(({ template: t, isDripHeader, dripCount, dripChildren }) => (
                    <Fragment key={t.id}>
                    <tr
                      className="border-b border-[#e5e5e4] hover:bg-[#fafaf9] cursor-pointer transition-colors"
                      onClick={() => setPreviewTemplate(t.id)}
                    >
                      <td className="px-4 py-3">
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
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-[#1c1c1a]">{t.name}</span>
                              {isDripHeader && (
                                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-[#f5f5f4] text-[#6b6b68]">{dripCount} emails</span>
                              )}
                              {t.dripDay !== undefined && (
                                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">Day {t.dripDay}</span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#a1a1a0]">{t.trigger}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {t.from ? (
                          <div className="flex items-center gap-2">
                            {t.from.icon ? (
                              <img src={t.from.icon} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
                            ) : (
                              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f5f5f4] text-[9px] font-medium text-[#6b6b68]">
                                {t.from.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                              </div>
                            )}
                            <div className="flex flex-col min-w-0">
                              <span className="text-[11px] font-medium text-[#1c1c1a] truncate">{t.from.name}</span>
                              <span className="text-[10px] text-[#a1a1a0] truncate">{t.from.email}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-[#a1a1a0]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${AUDIENCE_CONFIG[t.audience].cls}`}>
                          {AUDIENCE_CONFIG[t.audience].label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#6b6b68] max-w-[250px] truncate">
                        {t.subject}
                      </td>
                      {(() => {
                        const s = templateStats[t.id]
                        const sends = s?.sends ?? 0
                        const deliveryRate = sends > 0 ? Math.round((s.delivered / sends) * 100) : 0
                        const openRate = sends > 0 ? Math.round((s.opened / sends) * 100) : 0
                        const clickRate = sends > 0 ? Math.round((s.clicked / sends) * 100) : 0
                        return <>
                      <td className="px-4 py-3 text-xs text-[#6b6b68] text-right">
                        {sends > 0 ? sends.toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-right">
                        <span className={deliveryRate >= 95 ? "text-emerald-600" : deliveryRate > 0 ? "text-amber-600" : "text-[#a1a1a0]"}>
                          {sends > 0 ? `${deliveryRate}%` : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-right">
                        <span className={openRate > 0 ? "text-[#1c1c1a]" : "text-[#a1a1a0]"}>
                          {sends > 0 ? `${openRate}%` : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-right">
                        <span className={clickRate > 0 ? "text-[#1c1c1a]" : "text-[#a1a1a0]"}>
                          {sends > 0 ? `${clickRate}%` : "—"}
                        </span>
                      </td>
                        </>
                      })()}
                      <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
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
                        className="border-b border-[#e5e5e4] bg-[#fafaf9] hover:bg-[#f0f0ee] cursor-pointer transition-colors"
                        onClick={() => setPreviewTemplate(child.id)}
                      >
                        <td className="px-4 py-3 pl-10">
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-[#1c1c1a]">{child.name}</span>
                                {child.dripDay !== undefined && (
                                  <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">Day {child.dripDay}</span>
                                )}
                              </div>
                              <div className="text-[11px] text-[#a1a1a0]">{child.trigger}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          {child.from ? (
                            <div className="flex items-center gap-2">
                              {child.from.icon ? (
                                <img src={child.from.icon} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
                              ) : (
                                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f5f5f4] text-[9px] font-medium text-[#6b6b68]">
                                  {child.from.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                                </div>
                              )}
                              <span className="text-[11px] font-medium text-[#1c1c1a] truncate">{child.from.name}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-[#a1a1a0]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${AUDIENCE_CONFIG[child.audience].cls}`}>
                            {AUDIENCE_CONFIG[child.audience].label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-[#6b6b68] max-w-[250px] truncate">{child.subject}</td>
                        {(() => {
                          const s = templateStats[child.id]
                          const sends = s?.sends ?? 0
                          const deliveryRate = sends > 0 ? Math.round((s.delivered / sends) * 100) : 0
                          const openRate = sends > 0 ? Math.round((s.opened / sends) * 100) : 0
                          const clickRate = sends > 0 ? Math.round((s.clicked / sends) * 100) : 0
                          return <>
                            <td className="px-4 py-2.5 text-xs text-[#6b6b68] text-right">{sends > 0 ? sends.toLocaleString() : "—"}</td>
                            <td className="px-4 py-2.5 text-xs text-right"><span className={deliveryRate >= 95 ? "text-emerald-600" : deliveryRate > 0 ? "text-amber-600" : "text-[#a1a1a0]"}>{sends > 0 ? `${deliveryRate}%` : "—"}</span></td>
                            <td className="px-4 py-2.5 text-xs text-right"><span className={openRate > 0 ? "text-[#1c1c1a]" : "text-[#a1a1a0]"}>{sends > 0 ? `${openRate}%` : "—"}</span></td>
                            <td className="px-4 py-2.5 text-xs text-right"><span className={clickRate > 0 ? "text-[#1c1c1a]" : "text-[#a1a1a0]"}>{sends > 0 ? `${clickRate}%` : "—"}</span></td>
                          </>
                        })()}
                        <td className="px-4 py-2.5 text-center" onClick={e => e.stopPropagation()}>
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
            <div className="border border-[#e5e5e4] overflow-x-auto max-w-full mt-4">
              {isLoading ? (
                <p className="text-sm text-[#a1a1a0] text-center py-10">Loading sent emails...</p>
              ) : error ? (
                <p className="text-sm text-red-600 text-center py-10">{error}</p>
              ) : emails.length === 0 ? (
                <p className="text-sm text-[#a1a1a0] text-center py-10">No emails sent yet.</p>
              ) : (
                <table className="w-full text-sm" style={{ minWidth: 600 }}>
                  <thead>
                    <tr className="border-b border-[#e5e5e4]">
                      <th className="text-left px-4 py-2 text-xs font-medium text-[#6b6b68]">To</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-[#6b6b68]">Email</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-[#6b6b68]">Subject</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-[#6b6b68]">Status</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-[#6b6b68]">Sent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emails.map((email) => {
                      const status = STATUS_CONFIG[email.last_event] ?? { label: email.last_event, cls: "bg-[#f5f5f4] text-[#a1a1a0]" }
                      return (
                        <tr key={email.id} className="border-b border-[#e5e5e4] hover:bg-[#fafaf9] transition-colors">
                          <td className="px-4 py-3 text-sm text-[#1c1c1a]">{email.to.join(", ")}</td>
                          <td className="px-4 py-3 text-xs text-[#6b6b68]">
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
                          </td>
                          <td className="px-4 py-3 text-sm text-[#1c1c1a] max-w-[300px] truncate">{email.subject}</td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${status.cls}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-[#a1a1a0] text-right whitespace-nowrap">{formatDate(email.created_at)}</td>
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
                  <span className="text-sm font-medium text-[#1c1c1a]">
                    {templates.find(t => t.id === previewTemplate)?.name}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                  src={`/admin/emails/preview?template=${previewTemplate}`}
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
