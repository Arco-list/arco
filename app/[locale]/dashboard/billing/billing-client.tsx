"use client"

import { useLocale, useTranslations } from "next-intl"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

import type { CompanyBilling } from "@/lib/subscriptions/get-company-subscription"

/**
 * Plan and billing for one company.
 *
 * Reads only — every state-changing route (upgrade, payment method,
 * cancellation, invoices) hands off to Stripe's own hosted pages.
 * Building those screens ourselves would mean re-implementing PCI-shaped
 * flows for no gain.
 */
export function BillingClient({
  companyName,
  isOwner,
  billing,
}: {
  companyName: string
  isOwner: boolean
  billing: CompanyBilling
}) {
  const t = useTranslations("dashboard")
  const tb = useTranslations("dashboard.billing")
  const locale = useLocale()

  const formatDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(locale === "nl" ? "nl-NL" : "en-GB", {
          day: "numeric", month: "long", year: "numeric",
        })
      : null

  // One line describing where they stand, per source. Deliberately
  // concrete: a date beats "active".
  const planLabel = billing.plan === "pro" ? "Pro" : tb("plan_free")
  const renewal = formatDate(billing.currentPeriodEnd)

  return (
    <div className="min-h-screen bg-white flex flex-col" style={{ paddingTop: 60 }}>
      <Header navLinks={[
        { href: "/dashboard/listings", label: t("listings") },
        { href: "/dashboard/company", label: t("company") },
        { href: "/dashboard/team", label: t("team") },
        { href: "/dashboard/inbox", label: t("inbox") },
        { href: "/dashboard/billing", label: t("plans") },
      ]} />

      <div className="discover-page-title">
        <div className="wrap">
          <h2 className="arco-section-title">{tb("title")}</h2>
        </div>
      </div>

      <main style={{ flex: 1 }}>
        <div className="discover-results">
          <div className="wrap" style={{ maxWidth: 720 }}>

            {/* ── Current plan ──────────────────────────────────── */}
            <div style={{
              border: "1px solid var(--arco-light-grey)", borderRadius: 6,
              padding: "24px 28px", marginBottom: 24,
            }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <p className="arco-eyebrow" style={{ marginBottom: 6 }}>{tb("current_plan")}</p>
                  <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 32, fontWeight: 300, lineHeight: 1, margin: 0 }}>
                    {planLabel}
                  </h3>
                </div>
                {billing.source === "founding" && (
                  <span className="status-pill shrink-0">
                    <span className="status-pill-dot" style={{ background: "#0f766e" }} />
                    {tb("founding_badge")}
                  </span>
                )}
                {billing.source === "subscription" && billing.status === "past_due" && (
                  <span className="status-pill shrink-0">
                    <span className="status-pill-dot" style={{ background: "#dc2626" }} />
                    {tb("status_past_due")}
                  </span>
                )}
              </div>

              <p className="arco-body-text" style={{ marginTop: 14, marginBottom: 0, color: "var(--text-secondary)" }}>
                {billing.source === "founding" && tb("founding_body", { company: companyName })}
                {billing.source === "none" && tb("free_body")}
                {billing.source === "subscription" && billing.cancelAtPeriodEnd && renewal
                  && tb("ends_on", { date: renewal })}
                {billing.source === "subscription" && !billing.cancelAtPeriodEnd && renewal
                  && (billing.interval === "month" ? tb("renews_monthly", { date: renewal }) : tb("renews_yearly", { date: renewal }))}
              </p>

              {/* SEPA settles in days: a first payment can still be in
                  flight while the subscription is already active. Saying
                  so beats a customer wondering whether it worked. */}
              {billing.source === "subscription" && billing.status === "past_due" && (
                <p className="arco-small-text" style={{ marginTop: 10, marginBottom: 0 }}>
                  {tb("past_due_help")}
                </p>
              )}
            </div>

            {/* ── Actions ───────────────────────────────────────── */}
            {isOwner ? (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {billing.plan === "free" && (
                  <a href="/dashboard/pricing" className="btn-primary" style={{ fontSize: 14, padding: "12px 24px", textDecoration: "none" }}>
                    {tb("view_plans")}
                  </a>
                )}
                {billing.stripeCustomerId && (
                  <button type="button" className="btn-tertiary" style={{ fontSize: 14, padding: "12px 24px" }} disabled>
                    {tb("manage_billing")}
                  </button>
                )}
              </div>
            ) : (
              <p className="arco-small-text">{tb("owner_only")}</p>
            )}

            {/* Founding companies have no Stripe object yet — say what
                happens next rather than leaving a dead page. */}
            {billing.source === "founding" && (
              <p className="arco-small-text" style={{ marginTop: 20 }}>
                {tb("founding_next")}
              </p>
            )}

          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
