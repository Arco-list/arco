"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, Info, Lock } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useAuth } from "@/contexts/auth-context"
import { useLoginModal } from "@/contexts/login-modal-context"
import { trackPageView, trackUpgradeIntent } from "@/lib/tracking"

// Billing toggle + Free/Pro cards + architects-are-free note, extracted
// from the dashboard pricing page so public surfaces (the /pricing route,
// the /businesses/professionals landing where invited contributors
// arrive) can show the price before signup. Translation keys stay under
// the "dashboard" namespace — single source of truth for pricing copy.
const FEATURE_KEYS = [
  { labelKey: "pricing_feature_published", freeKey: "pricing_unlimited", proKey: "pricing_unlimited", freeBool: true, proBool: true, tooltipKey: "pricing_feature_published_tooltip", tooltipTitleKey: null },
  { labelKey: "pricing_feature_contributor", freeKey: "pricing_1_project", proKey: "pricing_unlimited", freeBool: true, proBool: true, tooltipKey: "pricing_feature_contributor_tooltip", tooltipTitleKey: null },
  { labelKey: "pricing_feature_company_page", freeKey: null, proKey: null, freeBool: true, proBool: true, tooltipKey: "pricing_feature_company_page_tooltip", tooltipTitleKey: null },
  { labelKey: "pricing_feature_team", freeKey: null, proKey: null, freeBool: false, proBool: true, tooltipKey: "pricing_feature_team_tooltip", tooltipTitleKey: null },
  { labelKey: "pricing_feature_analytics", freeKey: null, proKey: null, freeBool: false, proBool: true, tooltipKey: "pricing_feature_analytics_tooltip", tooltipTitleKey: null },
  { labelKey: "pricing_feature_arco_approved", freeKey: null, proKey: null, freeBool: false, proBool: true, tooltipKey: "pricing_feature_arco_approved_tooltip", tooltipTitleKey: "pricing_feature_arco_approved_tooltip_title" },
] as const

// The Free card leads with unlimited publishing (the anchor-side story);
// the Pro card leads with what the PAYING trade actually buys: unlimited
// credits, their portfolio page, and the Arco Approved trust badge.
// Published-projects drops to the bottom — a builder doesn't publish.
const FREE_ORDER = ["pricing_feature_published", "pricing_feature_contributor", "pricing_feature_company_page", "pricing_feature_team", "pricing_feature_analytics", "pricing_feature_arco_approved"]
const PRO_ORDER = ["pricing_feature_contributor", "pricing_feature_company_page", "pricing_feature_arco_approved", "pricing_feature_team", "pricing_feature_analytics", "pricing_feature_published"]
const byOrder = (order: string[]) =>
  order.map((k) => FEATURE_KEYS.find((f) => f.labelKey === k)!).filter(Boolean)

export function PricingSection({ embedded = false }: { embedded?: boolean }) {
  const t = useTranslations("dashboard")
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly")
  const { user, profile } = useAuth()
  const { openLoginModal } = useLoginModal()

  const proPrice = billingCycle === "yearly" ? 39 : 49

  const userTypes = profile?.user_types as string[] | null
  const hasProfessionalRole = userTypes?.includes("professional") ?? false

  // Key pages get a manual pageview (autocapture is off). The same
  // component serves /pricing and /dashboard/pricing — track the real path.
  useEffect(() => {
    if (typeof window !== "undefined") trackPageView(window.location.pathname.replace(/^\/(nl|en)(?=\/)/, ""))
  }, [])

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

  // Billing doesn't exist yet — the Pro CTA's job is to COLLECT the
  // willingness-to-pay signal (upgrade_intent) and route into the same
  // free claim flow. Logged-in professionals just get confirmation that
  // their founding price is locked.
  const handleClaimFounding = () => {
    trackUpgradeIntent(typeof window !== "undefined" ? window.location.pathname : "pricing", billingCycle)
    if (user && hasProfessionalRole) {
      toast.success(t("pricing_founding_toast"))
      return
    }
    handleStartFree()
  }

  return (
    <div className="wrap" style={{ maxWidth: 860 }}>

      {/* Header — page title on /pricing, section title when embedded
          in a landing page. */}
      <div style={{ textAlign: "center", marginBottom: embedded ? 40 : 56 }}>
        {embedded ? (
          <h2 className="arco-section-title" style={{ marginBottom: 16 }}>{t("pricing_title")}</h2>
        ) : (
          <h1 className="arco-page-title" style={{ marginBottom: 16 }}>{t("pricing_title")}</h1>
        )}
        <p className="arco-body-text" style={{ maxWidth: 480, margin: "0 auto" }}>
          {t("pricing_subtitle")}
        </p>
      </div>

      {/* Architect reassurance ABOVE the cards — an anchor scanning the
          €39 card must never conclude they're being asked to pay. */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
        <p className="arco-small-text" style={{ textAlign: "center", background: "var(--arco-off-white)", borderRadius: 999, padding: "8px 18px" }}>
          {t("pricing_architect_strip")}{" "}
          <Link href="/businesses/architects" style={{ color: "var(--primary)", textDecoration: "underline" }}>
            {t("pricing_architect_strip_link")}
          </Link>
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
            {byOrder(FREE_ORDER).map((f) => {
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
            <p style={{ fontSize: 11, color: "var(--arco-light)", marginTop: 2 }}>{t("pricing_ex_vat")}</p>
            <p className="arco-small-text" style={{ marginTop: 8 }}>{t("pricing_pro_desc")}</p>
          </div>

          <div className="pricing-card-features">
            {byOrder(PRO_ORDER).map((f) => {
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
            {/* Live CTA even though billing doesn't exist: clicks stamp an
                upgrade_intent event (the pre-payments pay-rate signal) and
                route into the same free claim flow. */}
            <button onClick={handleClaimFounding} style={{ width: "100%", padding: "12px 24px", fontSize: 14, fontFamily: "var(--font-sans)", background: "var(--primary)", border: "1px solid var(--primary)", borderRadius: 3, color: "#ffffff", cursor: "pointer" }}>
              {t("pricing_claim_founding")}
            </button>
            <p style={{ textAlign: "center", fontSize: 12, color: "var(--arco-light)", marginTop: 8 }}>
              {t("pricing_coming_soon")}
            </p>
          </div>
        </div>
      </div>

      {/* Credit example — the product is a credit on a photographed
          project; SHOW it. Row 1 = a live (Pro) credit, row 2 = the
          locked state an unpaid second credit will get. Selling by
          preview: the free/paid difference becomes self-evident. */}
      <div style={{ margin: "56px auto 0", maxWidth: 560 }}>
        <h3 className="arco-section-title" style={{ textAlign: "center", marginBottom: 6 }}>{t("pricing_credit_example_title")}</h3>
        <p className="arco-small-text" style={{ textAlign: "center", marginBottom: 20 }}>{t("pricing_credit_example_caption")}</p>
        <div style={{ border: "1px solid #e8e8e6", borderRadius: 8, padding: "20px 24px", background: "#ffffff" }}>
          <p className="arco-eyebrow" style={{ marginBottom: 14 }}>{t("pricing_mock_team")}</p>
          {/* Live credit */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #f0f0ee" }}>
            <div style={{ width: 36, height: 36, borderRadius: 6, background: "#1c1c1a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 500, flexShrink: 0 }}>VD</div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 14, color: "var(--primary)", textDecoration: "underline", margin: 0 }}>Van Dijk Keukens</p>
              <p className="arco-small-text" style={{ margin: 0 }}>{t("pricing_mock_role_kitchen")}</p>
            </div>
            <span className="status-pill" style={{ marginLeft: "auto", flexShrink: 0 }}>Arco Approved</span>
          </div>
          {/* Locked credit */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", opacity: 0.55 }}>
            <div style={{ width: 36, height: 36, borderRadius: 6, background: "#f5f5f4", color: "#a1a1a0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Lock size={15} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 14, color: "#6b6b68", margin: 0 }}>B&amp;W Zwembadbouw</p>
              <p className="arco-small-text" style={{ margin: 0 }}>{t("pricing_mock_role_pool")}</p>
            </div>
            <span style={{ marginLeft: "auto", flexShrink: 0, fontSize: 11, border: "1px solid var(--primary)", color: "var(--primary)", borderRadius: 999, padding: "3px 10px" }}>{t("pricing_mock_unlock")}</span>
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
  )
}
