"use client"

import { useState } from "react"
import { Check } from "lucide-react"
import { useTranslations } from "next-intl"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { useAuth } from "@/contexts/auth-context"
import { useLoginModal } from "@/contexts/login-modal-context"

type Feature = {
  text: string
  free: boolean
  pro: boolean
}

type FeatureRow = {
  label: string
  free: string | boolean
  pro: string | boolean
}

// Feature keys for translation lookup
const FEATURE_KEYS = [
  { labelKey: "pricing_feature_published", freeKey: "pricing_unlimited", proKey: "pricing_unlimited", freeBool: true, proBool: true },
  { labelKey: "pricing_feature_contributor", freeKey: "pricing_3_projects", proKey: "pricing_unlimited", freeBool: true, proBool: true },
  { labelKey: "pricing_feature_company_page", freeKey: null, proKey: null, freeBool: true, proBool: true },
  { labelKey: "pricing_feature_team", freeKey: null, proKey: null, freeBool: false, proBool: true },
  { labelKey: "pricing_feature_analytics", freeKey: null, proKey: null, freeBool: false, proBool: true },
] as const

export default function PricingPage() {
  const t = useTranslations("dashboard")
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly")
  const { user, profile } = useAuth()
  const { openLoginModal } = useLoginModal()

  const proPrice = billingCycle === "yearly" ? 39 : 49

  const userTypes = profile?.user_types as string[] | null
  const hasProfessionalRole = userTypes?.includes("professional") ?? false

  const handleStartFree = () => {
    if (!user) {
      openLoginModal("/create-company")
      return
    }
    if (hasProfessionalRole) {
      window.location.href = "/dashboard/listings"
    } else {
      window.location.href = "/create-company"
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header navLinks={[
        { href: "/dashboard/listings", label: t("listings") },
        { href: "/dashboard/company", label: t("company") },
        { href: "/dashboard/team", label: t("team") },
        { href: "/dashboard/pricing", label: t("plans") },
      ]} />

      <main className="flex-1" style={{ paddingTop: 120 }}>
        <div className="wrap" style={{ maxWidth: 860 }}>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h1 className="arco-page-title" style={{ marginBottom: 16 }}>{t("pricing_title")}</h1>
            <p className="arco-body-text" style={{ maxWidth: 480, margin: "0 auto", color: "var(--arco-light)" }}>
              {t("pricing_subtitle")}
            </p>
          </div>

          {/* Billing toggle */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
            <div className="audience-toggle" style={{ marginBottom: 0 }}>
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`toggle-seg${billingCycle === "monthly" ? " active" : ""}`}
              >
                {t("pricing_monthly")}
              </button>
              <button
                onClick={() => setBillingCycle("yearly")}
                className={`toggle-seg${billingCycle === "yearly" ? " active" : ""}`}
              >
                {t("pricing_yearly")}
                <span style={{ marginLeft: 6, fontSize: 11, color: "var(--primary)", fontWeight: 500 }}>{t("pricing_save_20")}</span>
              </button>
            </div>
          </div>

          {/* Pricing cards */}
          <div className="pricing-grid">

            {/* Free */}
            <div className="pricing-card pricing-card-subgrid">
              <div className="pricing-card-header">
                <p className="pricing-card-label">{t("pricing_free")}</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <h2 className="pricing-card-price">€0</h2>
                </div>
                <p style={{ fontSize: 12, minHeight: 18, marginTop: 4 }}>&nbsp;</p>
                <p className="pricing-card-desc">{t("pricing_free_desc")}</p>
              </div>

              <div className="pricing-card-features">
                {FEATURE_KEYS.map((f) => {
                  const included = f.freeBool
                  const label = t(f.labelKey as any)
                  const valueStr = f.freeKey ? t(f.freeKey as any) : null
                  return (
                    <div key={f.labelKey} className={`pricing-feature${!included ? " disabled" : ""}`}>
                      {included ? (
                        <Check size={16} style={{ color: "var(--arco-mid-grey)", flexShrink: 0 }} />
                      ) : (
                        <span style={{ width: 16, height: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--arco-rule)" }}>—</span>
                      )}
                      <span>{valueStr ? `${label}: ${valueStr}` : label}</span>
                    </div>
                  )
                })}
              </div>

              <div className="pricing-card-footer">
                {user && hasProfessionalRole ? (
                  <button disabled style={{ width: "100%", padding: "12px 24px", fontSize: 14, fontFamily: "var(--font-sans)", background: "none", border: "1px solid var(--arco-rule)", borderRadius: 3, color: "var(--arco-light)", cursor: "default" }}>
                    {t("pricing_current_plan")}
                  </button>
                ) : (
                  <button onClick={handleStartFree} style={{ width: "100%", padding: "12px 24px", fontSize: 14, fontFamily: "var(--font-sans)", background: "none", border: "1px solid var(--arco-rule)", borderRadius: 3, color: "var(--arco-black)", cursor: "pointer", transition: "border-color .15s" }}>
                    {t("pricing_get_started")}
                  </button>
                )}
                <p style={{ textAlign: "center", fontSize: 12, color: "transparent", marginTop: 8, userSelect: "none" }}>&nbsp;</p>
              </div>
            </div>

            {/* Pro */}
            <div className="pricing-card pricing-card-featured pricing-card-subgrid">
              <span className="pricing-card-badge">{t("pricing_recommended")}</span>
              <div className="pricing-card-header">
                <p className="pricing-card-label" style={{ color: "var(--primary)" }}>{t("pricing_pro")}</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <h2 className="pricing-card-price">€{proPrice}</h2>
                  <span style={{ fontSize: 14, color: "var(--arco-light)" }}>{t("pricing_per_month")}</span>
                </div>
                <p style={{ fontSize: 12, color: "var(--arco-light)", marginTop: 4, minHeight: 18 }}>
                  {billingCycle === "yearly" ? t("pricing_billed_annually", { amount: "€468" }) : "\u00A0"}
                </p>
                <p className="pricing-card-desc">{t("pricing_pro_desc")}</p>
              </div>

              <div className="pricing-card-features">
                {FEATURE_KEYS.map((f) => {
                  const label = t(f.labelKey as any)
                  const valueStr = f.proKey ? t(f.proKey as any) : null
                  return (
                    <div key={f.labelKey} className="pricing-feature">
                      <Check size={16} style={{ color: "var(--primary)", flexShrink: 0 }} />
                      <span>{valueStr ? `${label}: ${valueStr}` : label}</span>
                    </div>
                  )
                })}
              </div>

              <div className="pricing-card-footer">
                <button disabled style={{ width: "100%", padding: "12px 24px", fontSize: 14, fontFamily: "var(--font-sans)", background: "none", border: "1px solid var(--primary)", borderRadius: 3, color: "var(--primary)", cursor: "default" }}>
                  {t("pricing_upgrade")}
                </button>
                <p style={{ textAlign: "center", fontSize: 12, color: "var(--arco-light)", marginTop: 8 }}>
                  {t("pricing_coming_soon")}
                </p>
              </div>
            </div>
          </div>

          {/* Architect hero section */}
          <div style={{ margin: "56px 0 0", padding: "40px 32px", background: "var(--arco-off-white)", borderRadius: 8, textAlign: "center" }}>
            <p style={{ fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--primary)", marginBottom: 12 }}>
              {t("pricing_for_architects")}
            </p>
            <h3 className="arco-section-title" style={{ marginBottom: 12 }}>{t("pricing_publishing_free")}</h3>
            <p className="arco-body-text" style={{ maxWidth: 480, margin: "0 auto", color: "var(--arco-light)" }}>
              {t("pricing_publishing_free_body")}
            </p>
          </div>

          {/* FAQ section */}
          <div style={{ maxWidth: 600, margin: "48px auto 0", paddingBottom: 80 }}>
            <h3 className="arco-section-title" style={{ textAlign: "center", marginBottom: 32 }}>{t("pricing_faq_title")}</h3>

            {[
              {
                q: t("pricing_faq_q1"),
                a: t("pricing_faq_a1"),
              },
              {
                q: t("pricing_faq_q2"),
                a: t("pricing_faq_a2"),
              },
              {
                q: t("pricing_faq_q3"),
                a: t("pricing_faq_a3"),
              },
            ].map((item) => (
              <details key={item.q} style={{ borderBottom: "1px solid var(--arco-rule)", padding: "16px 0" }}>
                <summary style={{ fontSize: 14, fontWeight: 400, cursor: "pointer", color: "var(--arco-black)", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  {item.q}
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--arco-light)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, transition: "transform .2s" }}>
                    <path d="M4 6l4 4 4-4" />
                  </svg>
                </summary>
                <p className="arco-body-text" style={{ marginTop: 12, color: "var(--arco-light)" }}>
                  {item.a}
                </p>
              </details>
            ))}
          </div>

        </div>
      </main>

      <Footer />
    </div>
  )
}
