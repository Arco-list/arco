"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { Mail } from "lucide-react"
import { useTranslations } from "next-intl"
import { useAuth } from "@/contexts/auth-context"
import { getBrowserSupabaseClient } from "@/lib/supabase/browser"

type CompanyInfo = {
  name: string
  slug: string | null
  city: string | null
  logo_url: string | null
  primary_service_name: string | null
}

type SenderInfo = {
  name: string
  avatar_url: string | null
}

type Message = {
  id: string
  subject: string | null
  content: string
  created_at: string | null
  is_read: boolean | null
  sender_id: string
  company_id: string | null
  sender?: SenderInfo
  company?: CompanyInfo
}

export default function AdminMessagesPage() {
  const { user } = useAuth()
  const supabase = useMemo(() => getBrowserSupabaseClient(), [])
  const t = useTranslations("messages")
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    async function loadMessages() {
      setIsLoading(true)

      // Admin sees all introduction messages
      const { data, error } = await supabase
        .from("messages")
        .select("id, subject, content, created_at, is_read, sender_id, company_id")
        .eq("message_type", "introduction")
        .order("created_at", { ascending: false })

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
          .select("id, first_name, last_name, avatar_url")
          .in("id", senderIds)
        for (const p of profiles ?? []) {
          senderMap.set(p.id, {
            name: [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "Client",
            avatar_url: p.avatar_url,
          })
        }
      }

      // Fetch company details
      const companyIds = [...new Set((data ?? []).map((m) => m.company_id).filter(Boolean))]
      const companyMap = new Map<string, CompanyInfo>()
      if (companyIds.length > 0) {
        const { data: companies } = await supabase
          .from("companies")
          .select("id, name, slug, city, logo_url, primary_service_id")
          .in("id", companyIds as string[])

        const serviceIds = (companies ?? []).map((c) => c.primary_service_id).filter(Boolean) as string[]
        const serviceMap = new Map<string, string>()
        if (serviceIds.length > 0) {
          const { data: categories } = await supabase.from("categories").select("id, name").in("id", serviceIds)
          for (const cat of categories ?? []) serviceMap.set(cat.id, cat.name)
        }

        for (const c of companies ?? []) {
          companyMap.set(c.id, {
            name: c.name,
            slug: c.slug,
            city: c.city,
            logo_url: c.logo_url,
            primary_service_name: c.primary_service_id ? serviceMap.get(c.primary_service_id) ?? null : null,
          })
        }
      }

      setMessages(
        (data ?? []).map((m) => ({
          ...m,
          sender: senderMap.get(m.sender_id),
          company: m.company_id ? companyMap.get(m.company_id) : undefined,
        }))
      )
      setIsLoading(false)
    }

    loadMessages()
  }, [user, supabase])

  return (
    <div className="min-h-screen bg-white">
      <div className="discover-page-title">
        <div className="wrap">
          <h2 className="arco-section-title">{t("title")}</h2>
        </div>
      </div>

      <div className="discover-results">
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
                const company = msg.company
                const companySubtitle = [company?.primary_service_name, company?.city].filter(Boolean).join(" · ")

                return (
                  <div key={msg.id}>
                    {/* Sender + Company */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div className="pro-card-info">
                        {sender?.avatar_url ? (
                          <img src={sender.avatar_url} alt="" className="pro-card-logo" />
                        ) : (
                          <div className="pro-card-logo pro-card-logo-placeholder">
                            {sender?.name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                        )}
                        <div>
                          <h3 className="discover-card-title">{sender?.name || "Client"}</h3>
                          {company && (
                            <p className="discover-card-sub">
                              {t("to")}{" "}
                              {company.slug ? (
                                <Link href={`/professionals/${company.slug}`} style={{ color: "inherit", textDecoration: "underline" }}>
                                  {company.name}
                                </Link>
                              ) : company.name}
                              {companySubtitle ? ` · ${companySubtitle}` : ""}
                            </p>
                          )}
                        </div>
                      </div>
                      {!msg.is_read && (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: "#016D75",
                          background: "rgba(1,109,117,0.1)",
                          padding: "2px 8px",
                          borderRadius: 12,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          flexShrink: 0,
                        }}>
                          {t("unread")}
                        </span>
                      )}
                    </div>

                    {/* Message content */}
                    <p className="arco-body-text" style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                      {msg.content}
                    </p>

                    {/* Date */}
                    {msg.created_at && (
                      <p style={{ fontSize: 12, color: "var(--arco-mid-grey)", marginTop: 8, marginBottom: 0 }}>
                        {format(new Date(msg.created_at), "PP")}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
