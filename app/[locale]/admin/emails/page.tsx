"use client"

import { useEffect, useState, useTransition } from "react"
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
}

const AUDIENCE_CONFIG: Record<UserAudience, { label: string; cls: string }> = {
  all: { label: "All", cls: "bg-[#f5f5f4] text-[#6b6b68]" },
  professional: { label: "Professional", cls: "bg-[#e6f4f5] text-[#016D75]" },
  homeowner: { label: "Homeowner", cls: "bg-amber-50 text-amber-700" },
  admin: { label: "Admin", cls: "bg-violet-50 text-violet-700" },
}

const INITIAL_TEMPLATES: EmailTemplate[] = [
  { id: "magic-link", name: "Sign-in Code", type: "transactional", audience: "all", description: "OTP code for magic link sign-in", trigger: "User signs in with email (OTP)", subject: "[Code] is your Arco sign-in code", sends: 0, deliveryRate: 100, active: true },
  { id: "signup", name: "Signup Confirmation", type: "transactional", audience: "all", description: "Email confirmation after signup", trigger: "User creates account with email + password", subject: "[Code] is your Arco verification code", sends: 0, deliveryRate: 100, active: true },
  { id: "domain-verification", name: "Domain Verification", type: "transactional", audience: "professional", description: "6-digit code for domain ownership", trigger: "User verifies company domain during creation", subject: "[Code] is your Arco verification code", sends: 0, deliveryRate: 100, active: true },
  { id: "professional-invite", name: "Professional Invite", type: "transactional", audience: "professional", description: "Credited on a project", trigger: "Architect credits professional on published project", subject: "[Company] credited you on [Project]", sends: 0, deliveryRate: 100, active: true },
  { id: "team-invite", name: "Team Invite", type: "transactional", audience: "professional", description: "Invited to join a company", trigger: "Company admin invites team member", subject: "You're invited to join [Company]", sends: 0, deliveryRate: 100, active: true },
  { id: "project-live", name: "Project Live", type: "transactional", audience: "professional", description: "Project published on Arco", trigger: "Admin publishes project (status → published)", subject: "[Project] is now live on Arco", sends: 0, deliveryRate: 100, active: true },
  { id: "project-rejected", name: "Project Rejected", type: "transactional", audience: "professional", description: "Project not approved", trigger: "Admin rejects project (status → rejected)", subject: "Update on [Project]", sends: 0, deliveryRate: 100, active: true },
  { id: "password-reset", name: "Password Reset", type: "transactional", audience: "all", description: "Reset password link", trigger: "User requests password reset", subject: "Reset your Arco password", sends: 0, deliveryRate: 100, active: true },
  { id: "welcome-homeowner", name: "Welcome (Day 0)", type: "marketing", audience: "homeowner", description: "Sent immediately after homeowner signup", trigger: "Profile created with client user type", subject: "Welcome to Arco", sends: 0, deliveryRate: 100, active: true },
  { id: "discover-projects", name: "Discover Projects (Day 2)", type: "marketing", audience: "homeowner", description: "Highlights project browsing and filtering", trigger: "Drip queue · 2 days after signup", subject: "Discover projects on Arco", sends: 0, deliveryRate: 100, active: true },
  { id: "find-professionals", name: "Find Professionals (Day 5)", type: "marketing", audience: "homeowner", description: "Introduces professional discovery", trigger: "Drip queue · 5 days after signup", subject: "Find the right professional on Arco", sends: 0, deliveryRate: 100, active: true },
  { id: "project-digest", name: "Project Digest", type: "marketing", audience: "homeowner", description: "Weekly digest of new projects", trigger: "Not built", subject: "New projects on Arco this week", sends: 0, deliveryRate: 0, active: false },
  { id: "inactive-reminder", name: "Inactive Reminder", type: "marketing", audience: "professional", description: "Re-engagement for inactive users", trigger: "Not built", subject: "Your company page on Arco", sends: 0, deliveryRate: 0, active: false },
  { id: "prospect-intro", name: "Prospect Intro", type: "marketing", audience: "professional", description: "Outreach to companies added by platform", trigger: "Admin sends from Companies table (status: Prospected)", subject: "[Company] is now on Arco", sends: 0, deliveryRate: 100, active: true },
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
                  {filteredTemplates.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-[#e5e5e4] hover:bg-[#fafaf9] cursor-pointer transition-colors"
                      onClick={() => setPreviewTemplate(t.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-[#1c1c1a]">{t.name}</div>
                        <div className="text-[11px] text-[#a1a1a0]">{t.trigger}</div>
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
