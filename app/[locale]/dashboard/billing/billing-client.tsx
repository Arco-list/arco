"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { useLocale, useTranslations } from "next-intl"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { PricingSection } from "@/components/pricing-section"

import type { CompanyBilling } from "@/lib/subscriptions/get-company-subscription"
import { PREVIEW_LABELS, PREVIEW_STATES, type PreviewState } from "@/lib/subscriptions/preview-states"
import { openPortalAction, startCheckoutAction } from "./actions"

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
  previewState = null,
}: {
  companyName: string
  isOwner: boolean
  billing: CompanyBilling
  /** Set only for an admin viewing a synthetic state. */
  previewState?: string | null
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

  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState<"portal" | "primary" | null>(null)

  // Every route out of this page ends at Stripe. The action returns a
  // URL rather than redirecting itself, so a failure can surface here
  // as a message instead of a blank page.
  const go = (which: "portal" | "primary", run: () => Promise<{ url: string } | { error: string }>) => {
    if (pending) return
    setBusy(which)
    startTransition(async () => {
      const result = await run()
      if ("url" in result) {
        window.location.href = result.url
        return
      }
      setBusy(null)
      toast.error(tb(`error_${result.error}` as never))
    })
  }

  const renewal = formatDate(billing.currentPeriodEnd)
  const isPro = billing.plan === "pro"

  // Heading: the plan plus its billing cycle, because "Pro" alone
  // leaves the reader wondering what they are actually paying.
  const planTitle = !isPro
    ? tb("plan_free")
    : billing.interval === "month"
      ? `Pro (${t("pricing_monthly")})`
      : billing.interval === "year"
        ? `Pro (${t("pricing_yearly")})`
        : "Pro"

  // One line describing where they stand. Deliberately concrete: a date
  // beats the word "active".
  const statusLine =
    billing.source === "founding" ? tb("founding_body", { company: companyName })
    : billing.source === "none" ? tb("free_body")
    : billing.cancelAtPeriodEnd && renewal ? tb("ends_on", { date: renewal })
    : renewal ? (billing.interval === "month" ? tb("renews_monthly", { date: renewal }) : tb("renews_yearly", { date: renewal }))
    : ""

  // Exactly one primary action, chosen by what the company should do
  // next — not a row of equally-weighted buttons.
  const primaryAction =
    billing.status === "past_due" ? tb("action_fix_payment")
    : billing.cancelAtPeriodEnd ? tb("action_reactivate")
    : !isPro ? tb("action_upgrade")
    : null

  // Reactivating and fixing a payment both happen inside Stripe's
  // portal; only a new subscription needs Checkout.
  const primaryGoesToPortal = billing.status === "past_due" || billing.cancelAtPeriodEnd

  // What the plan actually gives, mirroring the pricing page so the two
  // never drift. Price sits on the subscription row alone; the rest are
  // part of it.
  const priceLabel = !isPro
    ? tb("per_month", { amount: "0" })
    : billing.source === "founding"
      ? tb("per_month", { amount: "0" })
      : billing.interval === "month"
        ? tb("per_month", { amount: "49" })
        : tb("per_year", { amount: "468" })

  const includedRows: { label: string; value: string; price: string; muted?: boolean; soon?: boolean }[] = [
    {
      label: tb("row_subscription"),
      value: billing.source === "founding" ? tb("plan_founding_row")
        : !isPro ? tb("plan_free_row")
        : billing.interval === "month" ? tb("billed_monthly") : tb("billed_yearly"),
      price: priceLabel,
    },
    {
      label: t("pricing_feature_contributor"),
      value: isPro ? tb("unlimited") : tb("one_project"),
      price: tb("included_value"),
    },
    { label: t("pricing_feature_published"), value: tb("unlimited"), price: tb("included_value") },
    { label: t("pricing_feature_company_page"), value: tb("included_value"), price: tb("included_value") },
    {
      label: t("pricing_feature_team"),
      value: isPro ? tb("included_value") : tb("not_included"),
      price: isPro ? tb("included_value") : "—",
      muted: !isPro,
    },
    {
      label: t("pricing_feature_analytics"),
      value: isPro ? tb("included_value") : tb("not_included"),
      price: isPro ? tb("included_value") : "—",
      muted: !isPro, soon: true,
    },
    {
      label: t("pricing_feature_arco_approved"),
      value: isPro ? tb("included_value") : tb("not_included"),
      price: isPro ? tb("included_value") : "—",
      muted: !isPro, soon: true,
    },
  ]

  return (
    <div className="min-h-screen bg-white flex flex-col" style={{ paddingTop: 60 }}>
      <Header navLinks={[
        { href: "/dashboard/listings", label: t("listings") },
        { href: "/dashboard/company", label: t("company") },
        { href: "/dashboard/team", label: t("team") },
        { href: "/dashboard/inbox", label: t("inbox") },
        { href: "/dashboard/billing", label: t("plans") },
      ]} />

      {/* Admin-only switcher. Never rendered for a real visitor: the
          server only sets previewState for an admin. */}
      {previewState && (
        <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--arco-light-grey)", padding: "10px 0" }}>
          <div className="wrap" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="arco-eyebrow" style={{ color: "var(--arco-mid-grey)" }}>Preview</span>
            {PREVIEW_STATES.map((s) => (
              <a
                key={s}
                href={`/dashboard/billing?preview=${s}`}
                className="status-pill"
                style={{
                  textDecoration: "none",
                  borderColor: s === previewState ? "#1c1c1a" : undefined,
                  color: s === previewState ? "#1c1c1a" : "var(--arco-mid-grey)",
                }}
              >
                {PREVIEW_LABELS[s as PreviewState]}
              </a>
            ))}
            <a href="/dashboard/billing" className="arco-small-text" style={{ marginLeft: "auto" }}>
              Exit preview
            </a>
          </div>
        </div>
      )}

      <div className="discover-page-title">
        <div className="wrap">
          <h2 className="arco-section-title">{tb("title")}</h2>
        </div>
      </div>

      <main style={{ flex: 1 }}>
        <div className="discover-results">
          {/* Full wrap width, like the rest of the dashboard: the
              banner and the included table share one edge, and the
              price column lands where the eye already expects a
              right-hand value. */}
          <div className="wrap">

            {/* ── Plan header: name, state, and the one action that
                   matters right now. The quiet banner (.arco-banner) is
                   the system's "here is where you stand" surface —
                   exactly what a plan summary is. ─────────────────── */}
            <div className="arco-banner" style={{ marginBottom: 32, alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 5 }}>
                  <h3 className="arco-banner-title" style={{ margin: 0 }}>{planTitle}</h3>
                  {billing.source === "founding" && (
                    <span className="status-pill shrink-0">
                      <span className="status-pill-dot" style={{ background: "#0f766e" }} />
                      {tb("founding_badge")}
                    </span>
                  )}
                  {billing.cancelAtPeriodEnd && renewal && (
                    <span className="status-pill shrink-0">
                      <span className="status-pill-dot" style={{ background: "#a1a1a0" }} />
                      {tb("pill_ends", { date: renewal })}
                    </span>
                  )}
                  {billing.status === "past_due" && (
                    <span className="status-pill shrink-0">
                      <span className="status-pill-dot" style={{ background: "#dc2626" }} />
                      {tb("status_past_due")}
                    </span>
                  )}
                </div>
                <p className="arco-banner-body">{statusLine}</p>
              </div>

              {isOwner && (
                <div className="arco-banner-actions">
                  {/* Tertiary first, primary last — the eye lands on the
                      action we want taken. Manage plan is always here:
                      invoices and payment details are what a billing
                      page is for, even between subscriptions. */}
                  <button
                    type="button"
                    className="btn-tertiary"
                    style={{ fontSize: 14, padding: "10px 20px", opacity: busy === "portal" ? 0.6 : 1 }}
                    onClick={() => go("portal", openPortalAction)}
                    disabled={pending}
                  >
                    {busy === "portal" ? tb("opening") : tb("manage_billing")}
                  </button>
                  {primaryAction && (
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ fontSize: 14, padding: "10px 20px", opacity: busy === "primary" ? 0.6 : 1 }}
                      onClick={() => go("primary", primaryGoesToPortal
                        ? openPortalAction
                        : () => startCheckoutAction(billing.interval === "month" ? "month" : "year"))}
                      disabled={pending}
                    >
                      {busy === "primary" ? tb("opening") : primaryAction}
                    </button>
                  )}
                </div>
              )}
            </div>

            {!isOwner && (
              <p className="arco-small-text" style={{ marginBottom: 24 }}>{tb("owner_only")}</p>
            )}

            {/* ── What's included ──────────────────────────────────── */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span className="arco-eyebrow">{tb("whats_included")}</span>
              <span className="arco-eyebrow">{tb("price_col")}</span>
            </div>

            <div style={{ borderTop: "1px solid var(--arco-light-grey)" }}>
              {includedRows.map((row) => (
                <div
                  key={row.label}
                  style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 16,
                    alignItems: "baseline", padding: "14px 0",
                    borderBottom: "1px solid var(--arco-light-grey)",
                    color: row.muted ? "var(--text-disabled)" : undefined,
                  }}
                >
                  <span style={{ fontSize: 14 }}>
                    {row.label}
                    {row.soon && <span className="pricing-feature-soon" style={{ marginLeft: 8 }}>{t("pricing_feature_coming")}</span>}
                  </span>
                  <span style={{ fontSize: 14, color: row.muted ? "inherit" : "var(--text-secondary)" }}>{row.value}</span>
                  <span style={{ fontSize: 14, color: "var(--text-secondary)", whiteSpace: "nowrap", textAlign: "right" }}>{row.price}</span>
                </div>
              ))}
            </div>

            {/* Founding companies have no Stripe object yet — say what
                happens next rather than leaving a dead page. */}
            {billing.source === "founding" && (
              <p className="arco-small-text" style={{ marginTop: 20 }}>
                {tb("founding_next")}
              </p>
            )}

            {billing.status === "past_due" && (
              <p className="arco-small-text" style={{ marginTop: 20 }}>
                {tb("past_due_help")}
              </p>
            )}

          </div>
        </div>

        {/* The plans themselves, for anyone without an active
            subscription. A subscriber has nothing to choose here — they
            change plan through the portal — so the sales cards would be
            noise on their page. */}
        {billing.plan === "free" && (
          <div style={{ borderTop: "1px solid var(--arco-light-grey)", paddingTop: 8 }}>
            <PricingSection />
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
