"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
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

type Message = {
  id: string
  subject: string | null
  content: string
  created_at: string | null
  is_read: boolean | null
  company_id: string | null
  company?: CompanyInfo
}

export function ClientMessagesTab() {
  const { user } = useAuth()
  const supabase = useMemo(() => getBrowserSupabaseClient(), [])
  const t = useTranslations("messages")
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    async function loadMessages() {
      setIsLoading(true)

      const { data, error } = await supabase
        .from("messages")
        .select("id, subject, content, created_at, is_read, company_id")
        .eq("sender_id", user!.id)
        .eq("message_type", "introduction")
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Failed to load messages:", error)
        setIsLoading(false)
        return
      }

      // Fetch company details
      const companyIds = [...new Set((data ?? []).map((m) => m.company_id).filter(Boolean))]
      const companyMap = new Map<string, CompanyInfo>()

      if (companyIds.length > 0) {
        const { data: companies } = await supabase
          .from("companies")
          .select("id, name, slug, city, logo_url, primary_service_id")
          .in("id", companyIds as string[])

        // Fetch service names
        const serviceIds = (companies ?? []).map((c) => c.primary_service_id).filter(Boolean) as string[]
        const serviceMap = new Map<string, string>()
        if (serviceIds.length > 0) {
          const { data: categories } = await supabase
            .from("categories")
            .select("id, name")
            .in("id", serviceIds)
          for (const cat of categories ?? []) {
            serviceMap.set(cat.id, cat.name)
          }
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
          company: m.company_id ? companyMap.get(m.company_id) : undefined,
        }))
      )
      setIsLoading(false)
    }

    loadMessages()
  }, [user, supabase])

  return (
    <main style={{ flex: 1 }}>
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
            <div style={{ border: "1px dashed var(--border)", borderRadius: 8, padding: "80px 24px", textAlign: "center" }}>
              <p className="arco-eyebrow" style={{ marginBottom: 16 }}>{t("inbox")}</p>
              <h2 className="arco-section-title" style={{ marginBottom: 12 }}>{t("no_messages")}</h2>
              <p className="arco-body-text" style={{ maxWidth: 400, margin: "0 auto" }}>
                {t("no_messages_client_description")}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              {messages.map((msg) => {
                const company = msg.company
                const subtitle = [company?.primary_service_name, company?.city].filter(Boolean).join(" · ")

                return (
                  <div key={msg.id}>
                    {/* Company — pro-card-info style */}
                    {company && (
                      <div className="pro-card-info" style={{ marginBottom: 12 }}>
                        {company.logo_url ? (
                          <img src={company.logo_url} alt="" className="pro-card-logo" />
                        ) : (
                          <div className="pro-card-logo pro-card-logo-placeholder">
                            {company.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          {company.slug ? (
                            <Link href={`/professionals/${company.slug}`} className="discover-card-title" style={{ textDecoration: "none" }}>
                              {company.name}
                            </Link>
                          ) : (
                            <h3 className="discover-card-title">{company.name}</h3>
                          )}
                          {subtitle && <p className="discover-card-sub">{subtitle}</p>}
                        </div>
                      </div>
                    )}

                    {/* Message content */}
                    <p className="arco-body-text" style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                      {msg.content}
                    </p>

                    {/* Date */}
                    {msg.created_at && (
                      <p style={{ fontSize: 12, color: "var(--arco-mid-grey)", marginTop: 8, marginBottom: 0 }}>
                        {t("sent")} {format(new Date(msg.created_at), "PP")}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
