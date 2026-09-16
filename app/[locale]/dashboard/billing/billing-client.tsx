"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { useLocale, useTranslations } from "next-intl"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

import type { CompanyBilling } from "@/lib/subscriptions/get-company-subscription"
import { FREE_CONTRIBUTOR_LIMIT, type ProjectUsage } from "@/lib/subscriptions/usage-types"
import type { BillingDetails } from "@/lib/subscriptions/billing-details-types"
import { PREVIEW_LABELS, PREVIEW_STATES, type PreviewState } from "@/lib/subscriptions/preview-states"
import { PricingSection } from "@/components/pricing-section"
import { UsageBar } from "@/components/usage-bar"
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
  usage,
  details,
  previewState = null,
}: {
  companyName: string
  isOwner: boolean
  billing: CompanyBilling
  usage: ProjectUsage
  details: BillingDetails
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
            {/* No alignItems override: .arco-banner centres its children,
                which is what keeps the buttons on the optical middle of a
                two- or three-line body instead of hanging from the top. */}
            <div className="arco-banner" style={{ marginBottom: 32 }}>
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
                  {/* Invoices and payment details have their own
                      section below, so the banner's slot goes to the one
                      thing that is not on this page: the plan chooser. */}
                  {/* The plans sit further down this same page, so this
                      is a jump rather than a route: nothing to load,
                      nothing to come back from. */}
                  <a
                    href="#plans"
                    className="btn-tertiary"
                    style={{ fontSize: 14, padding: "10px 20px", textDecoration: "none" }}
                  >
                    {tb("manage_plan")}
                  </a>
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

            {/* ── What is actually on Arco ───────────────────────
                   Two meters, because the pricing model draws a line
                   here: publishing is unlimited on every plan, credits
                   are what Pro unlocks. A company that cannot publish
                   (a photographer, say) gets only the second — an empty
                   publisher meter would imply a limit that does not
                   apply to them. */}
            <div style={{ marginBottom: 36, display: "flex", flexDirection: "column", gap: 24 }}>
              {usage.canPublish && (
                <UsageBar
                  label={t("pricing_feature_published")}
                  countLabel={tb("projects_count", { count: usage.publishedCount })}
                  fillPct={100}
                  right={tb("unlimited")}
                />
              )}

              <UsageBar
                label={t("pricing_feature_contributor")}
                countLabel={tb("projects_count", { count: usage.contributorTotal })}
                // The bar's length is everything they have; the filled
                // part is what the public actually sees.
                fillPct={usage.contributorTotal === 0 ? 0 : (usage.contributorVisible / usage.contributorTotal) * 100}
                // The dashed mark sits where Free stops. Past that point
                // the bar is theirs but not visible.
                markerPct={
                  isPro || usage.contributorTotal <= FREE_CONTRIBUTOR_LIMIT
                    ? null
                    : (FREE_CONTRIBUTOR_LIMIT / usage.contributorTotal) * 100
                }
                right={isPro ? tb("unlimited") : tb("free_limit", { count: FREE_CONTRIBUTOR_LIMIT })}
                note={usage.contributorHidden > 0 ? tb("hidden_note", { count: usage.contributorHidden }) : null}
              />
            </div>

            {!isOwner && (
              <p className="arco-small-text" style={{ marginBottom: 24 }}>{tb("owner_only")}</p>
            )}

            {/* ── Payment ──────────────────────────────────────────── */}
            {isOwner && (billing.stripeCustomerId || details.paymentMethod) && (
              <div style={{ marginBottom: 36 }}>
                <h4 className="arco-label" style={{ marginBottom: 14 }}>{tb("payment_heading")}</h4>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: 16, padding: "14px 0", borderTop: "1px solid var(--arco-light-grey)",
                  borderBottom: "1px solid var(--arco-light-grey)",
                }}>
                  <span style={{ fontSize: 14 }}>
                    {details.paymentMethod ? (
                      <>
                        {details.paymentMethod.label}
                        {details.paymentMethod.last4 && (
                          <span style={{ color: "var(--text-secondary)" }}>{` ···· ${details.paymentMethod.last4}`}</span>
                        )}
                        {details.paymentMethod.expiry && (
                          <span style={{ color: "var(--text-secondary)" }}>{` · ${details.paymentMethod.expiry}`}</span>
                        )}
                      </>
                    ) : (
                      <span style={{ color: "var(--text-secondary)" }}>{tb("no_payment_method")}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="btn-tertiary"
                    style={{ fontSize: 13, padding: "8px 16px" }}
                    onClick={() => go("portal", openPortalAction)}
                    disabled={pending}
                  >
                    {tb("update")}
                  </button>
                </div>
              </div>
            )}

            {/* ── Invoices ─────────────────────────────────────────── */}
            {isOwner && details.invoices.length > 0 && (
              <div style={{ marginBottom: 36 }}>
                <h4 className="arco-label" style={{ marginBottom: 14 }}>{tb("invoices_heading")}</h4>
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 16,
                  paddingBottom: 10, borderBottom: "1px solid var(--arco-light-grey)",
                }}>
                  <span className="arco-eyebrow">{tb("col_date")}</span>
                  <span className="arco-eyebrow">{tb("col_total")}</span>
                  <span className="arco-eyebrow">{tb("col_status")}</span>
                  <span className="arco-eyebrow" style={{ textAlign: "right" }}>{tb("col_actions")}</span>
                </div>
                {details.invoices.map((inv) => (
                  <div
                    key={inv.id}
                    style={{
                      display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 16,
                      alignItems: "baseline", padding: "14px 0",
                      borderBottom: "1px solid var(--arco-light-grey)", fontSize: 14,
                    }}
                  >
                    <span>{formatDate(inv.created)}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{inv.total}</span>
                    <span style={{ color: inv.status === "paid" ? "var(--text-secondary)" : "#b45309" }}>
                      {tb(`invoice_status_${inv.status}` as never)}
                    </span>
                    <span style={{ textAlign: "right" }}>
                      {inv.url ? (
                        <a href={inv.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary, #016D75)" }}>
                          {tb("view_invoice")}
                        </a>
                      ) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}


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

        {/* The plans themselves, on the page rather than behind a
            link: this is a short page, and a plan you cannot see is a
            plan you do not consider. The pricing cards are the ones the
            public pricing page uses, so the two can never disagree. */}
        <div id="plans" style={{ borderTop: "1px solid var(--arco-light-grey)", paddingTop: 40, scrollMarginTop: 80 }}>
          {/* No header, no architect strip: both are pitches aimed at
              someone deciding whether to join Arco, and this reader is
              already in. The cards themselves carry everything that is
              still relevant here. */}
          <PricingSection embedded showHeader={false} />
        </div>
      </main>

      <Footer />
    </div>
  )
}

/**
 * One usage meter: a label, a filled track with the count inside it,
 * and a value on the right. The count sits in the bar rather than above
 * it so the number and the thing it measures cannot drift apart when
 * the bar is short.
 */
