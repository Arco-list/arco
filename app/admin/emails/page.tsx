"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { fetchRecentEmails, sendTestEmail, type ResendEmail } from "./actions"
import { useAuth } from "@/contexts/auth-context"

type EmailTemplate = {
  id: string
  name: string
  description: string
  subject: string
}

const TEMPLATES: EmailTemplate[] = [
  { id: "project-live", name: "Project Live", description: "Sent when a project is published on Arco", subject: "[Project] is now live on Arco" },
  { id: "project-rejected", name: "Project Rejected", description: "Sent when a project is not approved", subject: "Update on [Project]" },
  { id: "professional-invite", name: "Professional Invite", description: "Sent when a professional is credited on a project", subject: "[Owner] credited you on [Project]" },
  { id: "team-invite", name: "Team Invite", description: "Sent when someone is invited to join a company", subject: "You're invited to join [Company] on Arco" },
  { id: "domain-verification", name: "Domain Verification", description: "6-digit code for domain ownership verification", subject: "[Code] is your Arco verification code" },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  sent: { label: "Sent", color: "#016D75", bg: "#e6f4f5" },
  delivered: { label: "Delivered", color: "#059669", bg: "#ecfdf5" },
  opened: { label: "Opened", color: "#2563eb", bg: "#eff6ff" },
  clicked: { label: "Clicked", color: "#7c3aed", bg: "#f5f3ff" },
  bounced: { label: "Bounced", color: "#dc2626", bg: "#fef2f2" },
  complained: { label: "Spam", color: "#dc2626", bg: "#fef2f2" },
}

export default function AdminEmailsPage() {
  const { user } = useAuth()
  const [emails, setEmails] = useState<ResendEmail[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"templates" | "sent">("templates")
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    fetchRecentEmails().then((result) => {
      if (result.error) setError(result.error)
      else setEmails(result.emails)
      setIsLoading(false)
    })
  }, [])

  const handleSendTest = (templateId: string) => {
    if (!user?.email) { toast.error("No email address found"); return }
    startTransition(async () => {
      const result = await sendTestEmail(templateId, user.email!)
      if (result.success) toast.success(`Test email sent to ${user.email}`)
      else toast.error(result.error ?? "Failed to send test email")
    })
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
      })
    } catch { return dateStr }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="discover-page-title">
        <div className="wrap">

        {/* Tabs */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div className="audience-toggle" style={{ marginBottom: 0 }}>
          <button
            className={`toggle-seg${activeTab === "templates" ? " active" : ""}`}
            onClick={() => setActiveTab("templates")}
          >
            Templates
          </button>
          <button
            className={`toggle-seg${activeTab === "sent" ? " active" : ""}`}
            onClick={() => setActiveTab("sent")}
          >
            Sent emails
          </button>
          </div>
        </div>

        {/* Templates tab */}
        {activeTab === "templates" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {TEMPLATES.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "20px 0", borderBottom: "1px solid var(--arco-rule)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 500, color: "var(--arco-black)" }}>{t.name}</span>
                  </div>
                  <p className="arco-body-text" style={{ margin: 0, fontSize: 13 }}>{t.description}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--arco-mid-grey)" }}>Subject: {t.subject}</p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => setPreviewTemplate(previewTemplate === t.id ? null : t.id)}
                    style={{
                      fontSize: 13, fontWeight: 400, padding: "6px 14px", borderRadius: 3,
                      border: "1px solid var(--arco-rule)", background: "none", cursor: "pointer",
                      color: "var(--arco-black)",
                    }}
                  >
                    {previewTemplate === t.id ? "Close" : "Preview"}
                  </button>
                  <button
                    onClick={() => handleSendTest(t.id)}
                    disabled={isPending}
                    style={{
                      fontSize: 13, fontWeight: 400, padding: "6px 14px", borderRadius: 3,
                      border: "none", background: "var(--primary)", color: "#fff", cursor: "pointer",
                      opacity: isPending ? 0.5 : 1,
                    }}
                  >
                    {isPending ? "Sending..." : "Send test"}
                  </button>
                </div>
              </div>
            ))}

            {/* Preview iframe */}
            {previewTemplate && (
              <div style={{ marginTop: 24, border: "1px solid var(--arco-rule)", borderRadius: 8, overflow: "hidden" }}>
                <div style={{
                  padding: "12px 20px", background: "var(--arco-off-white)",
                  borderBottom: "1px solid var(--arco-rule)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--arco-black)" }}>
                    Preview: {TEMPLATES.find(t => t.id === previewTemplate)?.name}
                  </span>
                  <button
                    onClick={() => setPreviewTemplate(null)}
                    style={{ fontSize: 12, color: "var(--arco-mid-grey)", background: "none", border: "none", cursor: "pointer" }}
                  >
                    Close
                  </button>
                </div>
                <iframe
                  src={`/admin/emails/preview?template=${previewTemplate}`}
                  style={{ width: "100%", height: 600, border: "none", background: "#f5f5f4" }}
                  title="Email preview"
                />
              </div>
            )}
          </div>
        )}

        {/* Sent emails tab */}
        {activeTab === "sent" && (
          <div>
            {isLoading && (
              <p className="arco-body-text" style={{ textAlign: "center", padding: "40px 0", color: "var(--arco-mid-grey)" }}>
                Loading sent emails...
              </p>
            )}

            {error && (
              <p className="arco-body-text" style={{ textAlign: "center", padding: "40px 0", color: "#dc2626" }}>
                {error}
              </p>
            )}

            {!isLoading && !error && emails.length === 0 && (
              <p className="arco-body-text" style={{ textAlign: "center", padding: "40px 0", color: "var(--arco-mid-grey)" }}>
                No emails sent yet.
              </p>
            )}

            {!isLoading && emails.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--arco-rule)" }}>
                    <th style={{ textAlign: "left", padding: "12px 0", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--arco-mid-grey)" }}>To</th>
                    <th style={{ textAlign: "left", padding: "12px 0", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--arco-mid-grey)" }}>Subject</th>
                    <th style={{ textAlign: "left", padding: "12px 0", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--arco-mid-grey)" }}>Status</th>
                    <th style={{ textAlign: "right", padding: "12px 0", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--arco-mid-grey)" }}>Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {emails.map((email) => {
                    const status = STATUS_CONFIG[email.last_event] ?? { label: email.last_event, color: "#a1a1a0", bg: "#f5f5f4" }
                    return (
                      <tr key={email.id} style={{ borderBottom: "1px solid var(--arco-rule)" }}>
                        <td style={{ padding: "14px 12px 14px 0", fontSize: 14, color: "var(--arco-black)" }}>
                          {email.to.join(", ")}
                        </td>
                        <td style={{ padding: "14px 12px", fontSize: 14, color: "var(--arco-black)", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {email.subject}
                        </td>
                        <td style={{ padding: "14px 12px" }}>
                          <span style={{
                            fontSize: 11, fontWeight: 500, padding: "3px 8px", borderRadius: 10,
                            background: status.bg, color: status.color,
                          }}>
                            {status.label}
                          </span>
                        </td>
                        <td style={{ padding: "14px 0 14px 12px", fontSize: 13, color: "var(--arco-mid-grey)", textAlign: "right", whiteSpace: "nowrap" }}>
                          {formatDate(email.created_at)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        </div>
      </div>
    </div>
  )
}
