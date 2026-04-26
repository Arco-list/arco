"use client"

import { useState } from "react"
import { Check, Info } from "lucide-react"
import { useTranslations } from "next-intl"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { FAQSection } from "@/components/landing"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
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
  { labelKey: "pricing_feature_published", freeKey: "pricing_unlimited", proKey: "pricing_unlimited", freeBool: true, proBool: true, tooltipKey: "pricing_feature_published_tooltip", tooltipTitleKey: null },
  { labelKey: "pricing_feature_contributor", freeKey: "pricing_1_project", proKey: "pricing_unlimited", freeBool: true, proBool: true, tooltipKey: "pricing_feature_contributor_tooltip", tooltipTitleKey: null },
  { labelKey: "pricing_feature_company_page", freeKey: null, proKey: null, freeBool: true, proBool: true, tooltipKey: "pricing_feature_company_page_tooltip", tooltipTitleKey: null },
  { labelKey: "pricing_feature_team", freeKey: null, proKey: null, freeBool: false, proBool: true, tooltipKey: "pricing_feature_team_tooltip", tooltipTitleKey: null },
  { labelKey: "pricing_feature_analytics", freeKey: null, proKey: null, freeBool: false, proBool: true, tooltipKey: "pricing_feature_analytics_tooltip", tooltipTitleKey: null },
  { labelKey: "pricing_feature_arco_approved", freeKey: null, proKey: null, freeBool: false, proBool: true, tooltipKey: "pricing_feature_arco_approved_tooltip", tooltipTitleKey: "pricing_feature_arco_approved_tooltip_title" },
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
        { href: "/dashboard/inbox", label: t("messages") },
        { href: "/dashboard/pricing", label: t("plans") },
      ]} />

      <main className="flex-1" style={{ paddingTop: 120 }}>
        <div className="wrap" style={{ maxWidth: 860 }}>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h1 className="arco-page-title" style={{ marginBottom: 16 }}>{t("pricing_title")}</h1>
            <p className="arco-body-text" style={{ maxWidth: 480, margin: "0 auto" }}>
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
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <h2 className="pricing-card-price">€0</h2>
                </div>
                <p className="arco-small-text" style={{ marginTop: 8 }}>{t("pricing_free_desc")}</p>
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
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {valueStr ? `${label}: ${valueStr}` : label}
                        {f.tooltipKey && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" aria-label={`More info: ${label}`} style={{ display: "inline-flex", alignItems: "center", border: "none", background: "transparent", padding: 0, cursor: "help", color: "var(--arco-light)" }}>
                                <Info size={13} />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-left">
                              <div style={{ fontWeight: 500, marginBottom: 4 }}>
                                {t((f.tooltipTitleKey ?? f.labelKey) as any)}
                              </div>
                              <div style={{ fontWeight: 300, lineHeight: 1.5 }}>{t(f.tooltipKey as any)}</div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
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
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <h2 className="pricing-card-price">€{proPrice}</h2>
                    <span style={{ fontSize: 14, color: "var(--arco-light)" }}>{t("pricing_per_month")}</span>
                  </div>
                  {billingCycle === "yearly" && (
                    <span className="status-pill" style={{ marginLeft: "auto" }}>
                      {t("pricing_billed_annually", { amount: "€468" })}
                    </span>
                  )}
                </div>
                <p className="arco-small-text" style={{ marginTop: 8 }}>{t("pricing_pro_desc")}</p>
              </div>

              <div className="pricing-card-features">
                {FEATURE_KEYS.map((f) => {
                  const label = t(f.labelKey as any)
                  const valueStr = f.proKey ? t(f.proKey as any) : null
                  return (
                    <div key={f.labelKey} className="pricing-feature">
                      <Check size={16} style={{ color: "var(--primary)", flexShrink: 0 }} />
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {valueStr ? `${label}: ${valueStr}` : label}
                        {f.tooltipKey && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" aria-label={`More info: ${label}`} style={{ display: "inline-flex", alignItems: "center", border: "none", background: "transparent", padding: 0, cursor: "help", color: "var(--primary)" }}>
                                <Info size={13} />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-left">
                              <div style={{ fontWeight: 500, marginBottom: 4 }}>
                                {t((f.tooltipTitleKey ?? f.labelKey) as any)}
                              </div>
                              <div style={{ fontWeight: 300, lineHeight: 1.5 }}>{t(f.tooltipKey as any)}</div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </span>
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
            <p className="arco-eyebrow" style={{ marginBottom: 12 }}>
              {t("pricing_for_architects")}
            </p>
            <h3 className="arco-section-title" style={{ marginBottom: 12 }}>{t("pricing_publishing_free")}</h3>
            <p className="arco-body-text" style={{ maxWidth: 480, margin: "0 auto" }}>
              {t("pricing_publishing_free_body")}
            </p>
          </div>

        </div>

        <FAQSection
          heading={t("pricing_faq_title")}
          items={[
            { question: t("pricing_faq_q1"), answer: t("pricing_faq_a1") },
            { question: t("pricing_faq_q2"), answer: t("pricing_faq_a2") },
            { question: t("pricing_faq_q3"), answer: t("pricing_faq_a3") },
          ]}
          paddingTop={56}
        />
      </main>

      <Footer />
    </div>
  )
}
