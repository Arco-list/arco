"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { fetchRecentEmails, sendTestEmail, type ResendEmail } from "./actions"
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
  { id: "magic-link", name: "Sign-in Code", type: "transactional", audience: "all", description: "OTP code for magic link sign-in", subject: "[Code] is your Arco sign-in code", sends: 0, deliveryRate: 100, active: true },
  { id: "signup", name: "Signup Confirmation", type: "transactional", audience: "all", description: "Email confirmation after signup", subject: "[Code] is your Arco verification code", sends: 0, deliveryRate: 100, active: true },
  { id: "domain-verification", name: "Domain Verification", type: "transactional", audience: "professional", description: "6-digit code for domain ownership", subject: "[Code] is your Arco verification code", sends: 0, deliveryRate: 100, active: true },
  { id: "professional-invite", name: "Professional Invite", type: "transactional", audience: "professional", description: "Credited on a project", subject: "[Owner] credited you on [Project]", sends: 0, deliveryRate: 100, active: true },
  { id: "team-invite", name: "Team Invite", type: "transactional", audience: "professional", description: "Invited to join a company", subject: "You're invited to join [Company]", sends: 0, deliveryRate: 100, active: true },
  { id: "project-live", name: "Project Live", type: "transactional", audience: "professional", description: "Project published on Arco", subject: "[Project] is now live on Arco", sends: 0, deliveryRate: 100, active: true },
  { id: "project-rejected", name: "Project Rejected", type: "transactional", audience: "professional", description: "Project not approved", subject: "Update on [Project]", sends: 0, deliveryRate: 100, active: true },
  { id: "password-reset", name: "Password Reset", type: "transactional", audience: "all", description: "Reset password link", subject: "Reset your Arco password", sends: 0, deliveryRate: 100, active: true },
  { id: "welcome-series", name: "Welcome Series", type: "marketing", audience: "professional", description: "Onboarding after company creation", subject: "Welcome to Arco", sends: 0, deliveryRate: 0, active: false },
  { id: "project-digest", name: "Project Digest", type: "marketing", audience: "homeowner", description: "Weekly digest of new projects", subject: "New projects on Arco this week", sends: 0, deliveryRate: 0, active: false },
  { id: "inactive-reminder", name: "Inactive Reminder", type: "marketing", audience: "professional", description: "Re-engagement for inactive users", subject: "Your company page on Arco", sends: 0, deliveryRate: 0, active: false },
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
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null)
  const [audienceFilter, setAudienceFilter] = useState<UserAudience | "all-filter">("all-filter")
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    fetchRecentEmails().then((result) => {
      if (result.error) setError(result.error)
      else setEmails(result.emails)
      setIsLoading(false)
    })
  }, [])

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

          {/* Count */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-[#6b6b68]">
              {activeTab === "sent"
                ? `${emails.length} emails`
                : `${totalCount} total · ${activeCount} active`}
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
            <div className="border border-[#e5e5e4] overflow-hidden mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e5e5e4]">
                    <th className="text-left px-4 py-2 text-xs font-medium text-[#6b6b68]">Email</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-[#6b6b68]">User</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-[#6b6b68]">Subject</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-[#6b6b68]">Sends</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-[#6b6b68]">Delivery</th>
                    <th className="text-center px-4 py-2 text-xs font-medium text-[#6b6b68]">Active</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-[#6b6b68]"></th>
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
                        <div className="text-[11px] text-[#a1a1a0]">{t.description}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${AUDIENCE_CONFIG[t.audience].cls}`}>
                          {AUDIENCE_CONFIG[t.audience].label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#6b6b68] max-w-[250px] truncate">
                        {t.subject}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#6b6b68] text-right">
                        {t.sends > 0 ? t.sends.toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-right">
                        <span className={t.deliveryRate >= 95 ? "text-emerald-600" : t.deliveryRate > 0 ? "text-amber-600" : "text-[#a1a1a0]"}>
                          {t.deliveryRate > 0 ? `${t.deliveryRate}%` : "—"}
                        </span>
                      </td>
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
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleSendTest(t.id, e)}
                          disabled={isPending}
                          className="arco-nav-text h-7 px-2.5 rounded-[3px] btn-scrolled inline-flex items-center text-xs"
                          style={{ opacity: isPending ? 0.5 : 1 }}
                        >
                          Test
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
            <div className="border border-[#e5e5e4] overflow-hidden mt-4">
              {isLoading ? (
                <p className="text-sm text-[#a1a1a0] text-center py-10">Loading sent emails...</p>
              ) : error ? (
                <p className="text-sm text-red-600 text-center py-10">{error}</p>
              ) : emails.length === 0 ? (
                <p className="text-sm text-[#a1a1a0] text-center py-10">No emails sent yet.</p>
              ) : (
                <table className="w-full text-sm">
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
