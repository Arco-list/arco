"use client"

import { useState } from "react"
import { Check } from "lucide-react"

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

const FEATURE_ROWS: FeatureRow[] = [
  { label: "Published projects", free: "Unlimited", pro: "Unlimited" },
  { label: "Contributor projects", free: "3 projects", pro: "Unlimited" },
  { label: "Company page with project portfolio", free: true, pro: true },
  { label: "Team management", free: false, pro: true },
  { label: "Portfolio analytics", free: false, pro: true },
]

export default function PricingPage() {
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
        { href: "/dashboard/listings", label: "Listings" },
        { href: "/dashboard/company", label: "Company" },
        { href: "/dashboard/team", label: "Team" },
        { href: "/dashboard/pricing", label: "Plans" },
      ]} />

      <main className="flex-1" style={{ paddingTop: 120 }}>
        <div className="wrap" style={{ maxWidth: 860 }}>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h1 className="arco-page-title" style={{ marginBottom: 16 }}>Simple, transparent plans</h1>
            <p className="arco-body-text" style={{ maxWidth: 480, margin: "0 auto", color: "var(--arco-light)" }}>
              Publishing projects is always free. Upgrade to grow your visibility as a credited professional.
            </p>
          </div>

          {/* Billing toggle */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
            <div className="audience-toggle" style={{ marginBottom: 0 }}>
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`toggle-seg${billingCycle === "monthly" ? " active" : ""}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle("yearly")}
                className={`toggle-seg${billingCycle === "yearly" ? " active" : ""}`}
              >
                Yearly
                <span style={{ marginLeft: 6, fontSize: 11, color: "var(--primary)", fontWeight: 500 }}>Save 20%</span>
              </button>
            </div>
          </div>

          {/* Pricing cards */}
          <div className="pricing-grid">

            {/* Free */}
            <div className="pricing-card pricing-card-subgrid">
              <div className="pricing-card-header">
                <p className="pricing-card-label">Free</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <h2 className="pricing-card-price">€0</h2>
                </div>
                <p style={{ fontSize: 12, minHeight: 18, marginTop: 4 }}>&nbsp;</p>
                <p className="pricing-card-desc">Publish projects and get started as a professional</p>
              </div>

              <div className="pricing-card-features">
                {FEATURE_ROWS.map((f) => {
                  const value = f.free
                  const included = value !== false
                  return (
                    <div key={f.label} className={`pricing-feature${!included ? " disabled" : ""}`}>
                      {included ? (
                        <Check size={16} style={{ color: "var(--arco-mid-grey)", flexShrink: 0 }} />
                      ) : (
                        <span style={{ width: 16, height: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--arco-rule)" }}>—</span>
                      )}
                      <span>{typeof value === "string" ? `${f.label}: ${value}` : f.label}</span>
                    </div>
                  )
                })}
              </div>

              <div className="pricing-card-footer">
                {user && hasProfessionalRole ? (
                  <button disabled style={{ width: "100%", padding: "12px 24px", fontSize: 14, fontFamily: "var(--font-sans)", background: "none", border: "1px solid var(--arco-rule)", borderRadius: 3, color: "var(--arco-light)", cursor: "default" }}>
                    Current plan
                  </button>
                ) : (
                  <button onClick={handleStartFree} style={{ width: "100%", padding: "12px 24px", fontSize: 14, fontFamily: "var(--font-sans)", background: "none", border: "1px solid var(--arco-rule)", borderRadius: 3, color: "var(--arco-black)", cursor: "pointer", transition: "border-color .15s" }}>
                    Get started
                  </button>
                )}
                <p style={{ textAlign: "center", fontSize: 12, color: "transparent", marginTop: 8, userSelect: "none" }}>&nbsp;</p>
              </div>
            </div>

            {/* Pro */}
            <div className="pricing-card pricing-card-featured pricing-card-subgrid">
              <span className="pricing-card-badge">Recommended</span>
              <div className="pricing-card-header">
                <p className="pricing-card-label" style={{ color: "var(--primary)" }}>Pro</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <h2 className="pricing-card-price">€{proPrice}</h2>
                  <span style={{ fontSize: 14, color: "var(--arco-light)" }}>/month</span>
                </div>
                <p style={{ fontSize: 12, color: "var(--arco-light)", marginTop: 4, minHeight: 18 }}>
                  {billingCycle === "yearly" ? "Billed annually at €468/year" : "\u00A0"}
                </p>
                <p className="pricing-card-desc">Showcase your best work and grow your visibility</p>
              </div>

              <div className="pricing-card-features">
                {FEATURE_ROWS.map((f) => {
                  const value = f.pro
                  return (
                    <div key={f.label} className="pricing-feature">
                      <Check size={16} style={{ color: "var(--primary)", flexShrink: 0 }} />
                      <span>{typeof value === "string" ? `${f.label}: ${value}` : f.label}</span>
                    </div>
                  )
                })}
              </div>

              <div className="pricing-card-footer">
                <button disabled style={{ width: "100%", padding: "12px 24px", fontSize: 14, fontFamily: "var(--font-sans)", background: "none", border: "1px solid var(--primary)", borderRadius: 3, color: "var(--primary)", cursor: "default" }}>
                  Upgrade
                </button>
                <p style={{ textAlign: "center", fontSize: 12, color: "var(--arco-light)", marginTop: 8 }}>
                  Coming soon
                </p>
              </div>
            </div>
          </div>

          {/* Architect hero section */}
          <div style={{ margin: "56px 0 0", padding: "40px 32px", background: "var(--arco-off-white)", borderRadius: 8, textAlign: "center" }}>
            <p style={{ fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--primary)", marginBottom: 12 }}>
              For architects
            </p>
            <h3 className="arco-section-title" style={{ marginBottom: 12 }}>Publishing is always free</h3>
            <p className="arco-body-text" style={{ maxWidth: 480, margin: "0 auto", color: "var(--arco-light)" }}>
              Architects are the backbone of Arco. Every project you publish brings visibility to the professionals you work with — and builds a platform the industry can be proud of. That's why publishing will always be free.
            </p>
          </div>

          {/* FAQ section */}
          <div style={{ maxWidth: 600, margin: "48px auto 0", paddingBottom: 80 }}>
            <h3 className="arco-section-title" style={{ textAlign: "center", marginBottom: 32 }}>Frequently asked questions</h3>

            {[
              {
                q: "What's the difference between publishing and being credited?",
                a: "Publishing means you upload and own the project on Arco. Being credited means another professional (usually the architect) added you to their project. Publishing is always free."
              },
              {
                q: "I'm an architect — do I need Pro?",
                a: "Not for publishing. You can publish unlimited projects for free. Pro gives you team management, portfolio analytics, and a full company page."
              },
              {
                q: "How does billing work?",
                a: "Pro is €49/month billed monthly, or €39/month when billed annually (€468/year). We're integrating Stripe — until then, all features are available to help you get started."
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
