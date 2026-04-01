"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { Mail } from "lucide-react"
import { useTranslations } from "next-intl"
import { useAuth } from "@/contexts/auth-context"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

type SenderInfo = {
  name: string
  avatar_url: string | null
  email: string | null
  phone: string | null
}

type Message = {
  id: string
  subject: string | null
  content: string
  created_at: string | null
  is_read: boolean | null
  sender_id: string
  sender_email: string | null
  sender_phone: string | null
  sender?: SenderInfo
}

export default function CompanyMessagesPage() {
  const { user } = useAuth()
  const supabase = useMemo(() => getBrowserSupabaseClient(), [])
  const t = useTranslations("messages")
  const tDash = useTranslations("dashboard")
  const [messages, setMessages] = useState<Message[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    async function loadMessages() {
      setIsLoading(true)

      // Find user's company via professionals table or owner_id
      let resolvedCompanyId: string | null = null

      const { data: pro } = await supabase
        .from("professionals")
        .select("company_id")
        .eq("user_id", user!.id)
        .maybeSingle()

      resolvedCompanyId = pro?.company_id ?? null

      if (!resolvedCompanyId) {
        const { data: owned } = await supabase
          .from("companies")
          .select("id")
          .eq("owner_id", user!.id)
          .limit(1)
          .maybeSingle()
        resolvedCompanyId = owned?.id ?? null
      }

      setCompanyId(resolvedCompanyId)

      // Query messages: by company_id if found, or by recipient_id as fallback
      let query = supabase
        .from("messages")
        .select("id, subject, content, created_at, is_read, sender_id, sender_email, sender_phone")
        .eq("message_type", "introduction")
        .order("created_at", { ascending: false })

      if (resolvedCompanyId) {
        query = query.eq("company_id", resolvedCompanyId)
      } else {
        // Fallback: show messages where user is the recipient
        query = query.eq("recipient_id", user!.id)
      }

      const { data, error } = await query

      if (error) {
        console.error("Failed to load messages:", error)
        setIsLoading(false)
        return
      }

      // Fetch sender profiles
      const senderIds = [...new Set((data ?? []).map((m) => m.sender_id).filter(Boolean))]
      const senderMap = new Map<string, SenderInfo>()

      if (senderIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, avatar_url, phone")
          .in("id", senderIds)

        for (const p of profiles ?? []) {
          senderMap.set(p.id, {
            name: [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "Client",
            avatar_url: p.avatar_url,
            email: null, // email lives in auth.users, populated below
            phone: p.phone,
          })
        }

      }

      setMessages(
        (data ?? []).map((m) => {
          const profile = senderMap.get(m.sender_id)
          return {
            ...m,
            sender: {
              name: profile?.name || "Client",
              avatar_url: profile?.avatar_url ?? null,
              email: m.sender_email ?? profile?.email ?? null,
              phone: m.sender_phone ?? profile?.phone ?? null,
            },
          }
        })
      )

      // Mark unread messages as read
      const unreadIds = (data ?? []).filter((m) => !m.is_read).map((m) => m.id)
      if (unreadIds.length > 0) {
        await supabase
          .from("messages")
          .update({ is_read: true, read_at: new Date().toISOString() })
          .in("id", unreadIds)
      }

      setIsLoading(false)
    }

    loadMessages()
  }, [user, supabase])

  const cq = companyId ? `?company_id=${companyId}` : ""
  const navLinks = [
    { href: `/dashboard/listings${cq}`, label: tDash("listings") },
    { href: `/dashboard/company${cq}`, label: tDash("company") },
    { href: `/dashboard/team${cq}`, label: tDash("team") },
    { href: "/dashboard/inbox", label: tDash("messages") },
    { href: "/dashboard/pricing", label: tDash("plans") },
  ]

  return (
    <div className="min-h-screen bg-white flex flex-col" style={{ paddingTop: 60 }}>
      <Header navLinks={navLinks} />

      <div className="discover-page-title">
        <div className="wrap">
          <h2 className="arco-section-title">{t("inbox")}</h2>
        </div>
      </div>

      <div className="discover-results" style={{ flex: 1 }}>
        <div className="wrap">
          {!isLoading && messages.length > 0 && (
            <div className="discover-results-meta">
              <p className="discover-results-count">
                <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>
                  {messages.length}
                </strong>{" "}
                {t("message_count", { count: messages.length })}
              </p>
            </div>
          )}

          {isLoading ? (
            <div style={{ padding: "60px 0", textAlign: "center", color: "var(--arco-mid-grey)", fontSize: 14 }}>
              Loading...
            </div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <Mail style={{ width: 40, height: 40, color: "var(--arco-rule)", margin: "0 auto 16px" }} />
              <h3 className="arco-section-title" style={{ marginBottom: 8 }}>{t("no_messages")}</h3>
              <p className="arco-body-text" style={{ color: "var(--arco-mid-grey)" }}>
                {t("no_messages_company_description")}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 32, maxWidth: 800 }}>
              {messages.map((msg) => {
                const sender = msg.sender
                const initial = sender?.name?.charAt(0)?.toUpperCase() || "?"

                return (
                  <div key={msg.id}>
                    {/* Sender — pro-card-info style */}
                    <div className="pro-card-info" style={{ marginBottom: 12 }}>
                      {sender?.avatar_url ? (
                        <img src={sender.avatar_url} alt="" className="pro-card-logo" />
                      ) : (
                        <div className="pro-card-logo pro-card-logo-placeholder">
                          {initial}
                        </div>
                      )}
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <h3 className="discover-card-title">{sender?.name || "Client"}</h3>
                          {!msg.is_read && (
                            <span style={{
                              display: "inline-block",
                              fontSize: 10,
                              fontWeight: 600,
                              color: "#016D75",
                              background: "rgba(1,109,117,0.1)",
                              padding: "2px 8px",
                              borderRadius: 12,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                            }}>
                              {t("unread")}
                            </span>
                          )}
                        </div>
                        <p className="discover-card-sub">
                          {[sender?.email, sender?.phone].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </div>

                    {/* Message content */}
                    <p className="arco-body-text" style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                      {msg.content}
                    </p>

                    {/* Date */}
                    {msg.created_at && (
                      <p style={{ fontSize: 12, color: "var(--arco-mid-grey)", marginTop: 8, marginBottom: 0 }}>
                        {t("received")} {format(new Date(msg.created_at), "PP")}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  )
}
