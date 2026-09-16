"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { useLocale, useTranslations } from "next-intl"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

import type { CompanyBilling } from "@/lib/subscriptions/get-company-subscription"
import { FREE_CONTRIBUTOR_LIMIT, type ProjectUsage } from "@/lib/subscriptions/usage-types"
import type { BillingDetails } from "@/lib/subscriptions/billing-details-types"
import { PREVIEW_LABELS, PREVIEW_STATES } from "@/lib/subscriptions/preview-states"
import { AdminTabs } from "@/components/admin/admin-tabs"
import { PricingSection } from "@/components/pricing-section"
import { UsageBar } from "@/components/usage-bar"
import { openPortalAction, startCheckoutAction } from "@/lib/subscriptions/actions"

/**
 * The subscription screen for one company: which plan, what it shows,
 * what it costs, what was paid.
 *
 * Reads only — every state-changing route (upgrade, payment method,
 * cancellation, invoices) hands off to Stripe's own hosted pages.
 * Building those screens ourselves would mean re-implementing PCI-shaped
 * flows for no gain.
 */
export function SubscriptionScreen({
  companyName,
  isOwner,
  billing,
  usage,
  details,
  previewState = null,
  isAdmin = false,
  chrome = "dashboard",
}: {
  companyName: string
  isOwner: boolean
  billing: CompanyBilling
  usage: ProjectUsage
  details: BillingDetails
  /** Set only for an admin viewing a synthetic state. */
  previewState?: string | null
  /** Admins get the preview switcher on their own page too. */
  isAdmin?: boolean
  /**
   * Which shell the page is mounted in. "admin" drops the dashboard
   * header and footer because the admin layout supplies its own — the
   * page itself is identical either way, which is what makes reviewing
   * it in admin worth anything.
   */
  chrome?: "dashboard" | "admin"
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

  // The plan as a thing you can be "in", without the billing cycle the
  // heading carries: "inbegrepen in Pro (per jaar)" reads as a parenthesis
  // about the wrong noun.
  const planName = isPro ? "Pro" : tb("plan_free")

  // On Pro the two kinds collapse into one number: everything the
  // company has on Arco, none of it held back.
  const totalProjects = usage.publishedCount + usage.contributorTotal

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

  const inAdmin = chrome === "admin"

  return (
    <div
      className={`bg-white flex flex-col${inAdmin ? "" : " min-h-screen"}`}
      style={inAdmin ? undefined : { paddingTop: 60 }}
    >
      {!inAdmin && (
        <Header navLinks={[
          { href: "/dashboard/listings", label: t("listings") },
          { href: "/dashboard/company", label: t("company") },
          { href: "/dashboard/team", label: t("team") },
          { href: "/dashboard/inbox", label: t("inbox") },
          { href: "/dashboard/billing", label: t("subscription") },
        ]} />
      )}

      {/* Admin-only switcher, in the admin tab bar's own clothes: the
          same second-nav layer every admin page uses, so a state is a
          place you can link to and come back from rather than a toggle.
          The first tab clears ?preview= — that is the admin's own real
          subscription, which is also worth being able to reach. */}
      {isAdmin && (
        <AdminTabs
          param="preview"
          title="Preview"
          tabs={[
            { key: "live", label: "Live" },
            ...PREVIEW_STATES.map((s) => ({ key: s, label: PREVIEW_LABELS[s] })),
          ]}
          active={previewState ?? "live"}
        />
      )}

      <div className="discover-page-title">
        <div className="wrap">
          <h2 className="arco-section-title">{tb("title")}</h2>
        </div>
      </div>

      <main style={{ flex: 1 }}>
        {/* .discover-results carries 80px of tail padding for grid
            pages that end here. This page continues, so that padding
            becomes a hole above the next section's title. */}
        <div className="discover-results" style={{ paddingBottom: 24 }}>
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
                   On Free the two kinds of project are two meters,
                   because the pricing model draws a line between them:
                   publishing is unlimited, credits are what Pro unlocks.
                   On Pro that line is gone, so drawing it anyway would
                   invite the reader to look for a difference that no
                   longer exists — one bar, all their work. */}
            <div style={{ marginBottom: 36, display: "flex", flexDirection: "column", gap: 24 }}>
              {isPro ? (
                <UsageBar
                  label={tb("projects_noun", { count: totalProjects })}
                  count={totalProjects}
                  fillPct={totalProjects > 0 ? 100 : 0}
                  endLabel={tb("unlimited_included", { plan: planName })}
                  unbounded
                />
              ) : (
                <>
                  {/* A company that cannot publish (a photographer, say)
                      gets only the credit meter — an empty publisher bar
                      would imply a limit that does not apply to them. */}
                  {usage.canPublish && (
                    <UsageBar
                      label={tb("published_noun", { count: usage.publishedCount })}
                      count={usage.publishedCount}
                      fillPct={usage.publishedCount > 0 ? 100 : 0}
                      endLabel={tb("unlimited_included", { plan: planName })}
                      unbounded
                    />
                  )}

                  <UsageBar
                    label={tb("contributor_noun", { count: usage.contributorTotal })}
                    count={usage.contributorTotal}
                    fillPct={usage.contributorTotal > 0 ? 100 : 0}
                    unbounded
                    // The dimmed stretch past this point is what the
                    // company has but the public cannot see.
                    lockedFromPct={
                      usage.contributorTotal === 0
                        ? null
                        : (62 * usage.contributorVisible) / usage.contributorTotal
                    }
                    lockedLabel={usage.contributorHidden > 0 ? tb("hidden_in_bar", { count: usage.contributorHidden }) : null}
                    // The allowance, stated whether or not it has been
                    // used: an empty bar is exactly where it matters.
                    markerLabel={tb("free_count", { count: FREE_CONTRIBUTOR_LIMIT })}
                    endLabel={tb("upgrade_for_unlimited")}
                    // The same route as the banner's upgrade button. Only
                    // the owner can take it, so for anyone else the words
                    // stay words.
                    onEndLabelClick={
                      isOwner
                        ? () => go("primary", () => startCheckoutAction(billing.interval === "month" ? "month" : "year"))
                        : null
                    }
                  />
                </>
              )}
            </div>

            {!isOwner && (
              <p className="arco-small-text" style={{ marginBottom: 24 }}>{tb("owner_only")}</p>
            )}

          </div>
        </div>

        {/* The plans themselves, on the page rather than behind a
            link: this is a short page, and a plan you cannot see is a
            plan you do not consider. The pricing cards are the ones the
            public pricing page uses, so the two can never disagree. */}
        {/* Carries the page gutter itself: it sits outside the wrap
            above, and the pricing block no longer brings one of its
            own now that it renders as a section here. */}
        <div id="plans" className="wrap" style={{ paddingBottom: 56, scrollMarginTop: 80 }}>
          {/* No pitch header, no architect strip: both are aimed at
              someone deciding whether to join Arco, and this reader is
              already in. What stays is a plain section heading, like
              Payment and Invoices below it. */}
          <PricingSection
            embedded
            showHeader={false}
            sectionHeading={tb("plans_heading")}
            currentPlan={isPro ? "pro" : "free"}
            // The cycle comes from the toggle in the cards, so the price
            // the reader just looked at is the one they get billed.
            onUpgrade={isOwner ? (interval) => go("primary", () => startCheckoutAction(interval)) : null}
            onDowngrade={isOwner ? () => go("portal", openPortalAction) : null}
            actionsBusy={pending}
          />
        </div>

        {/* Payment and invoices sit under the plan chooser: what you
            pay and what you paid only mean something once you know
            which plan you are on. */}
        <div className="wrap" style={{ paddingBottom: 80 }}>
          {/* ── Payment ──────────────────────────────────────────── */}
          {/* Shown for every owner, card or no card. A billing page
              that hides these until the first payment reads as half
              built, and "no payment method yet" is itself an answer to
              the question the reader came with. */}
          {isOwner && (
            <div style={{ marginBottom: 36 }}>
              <h4 className="arco-subsection-title" style={{ marginBottom: 14 }}>{tb("payment_heading")}</h4>
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
                {/* The portal only exists once Stripe knows this
                    company; before that there is nothing to open. */}
                {billing.stripeCustomerId && (
                  <button
                    type="button"
                    className="btn-tertiary"
                    style={{ fontSize: 13, padding: "8px 16px" }}
                    onClick={() => go("portal", openPortalAction)}
                    disabled={pending}
                  >
                    {tb("update")}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Invoices ─────────────────────────────────────────── */}
          {isOwner && (
            <div style={{ marginBottom: 36 }}>
              <h4 className="arco-subsection-title" style={{ marginBottom: 14 }}>{tb("invoices_heading")}</h4>
              {details.invoices.length === 0 && (
                <div style={{
                  padding: "14px 0", fontSize: 14, color: "var(--text-secondary)",
                  borderTop: "1px solid var(--arco-light-grey)",
                  borderBottom: "1px solid var(--arco-light-grey)",
                }}>
                  {tb("no_invoices")}
                </div>
              )}
              <div hidden={details.invoices.length === 0} style={{
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
      </main>

      {!inAdmin && <Footer />}
    </div>
  )
}

/**
 * One usage meter: a label, a filled track with the count inside it,
 * and a value on the right. The count sits in the bar rather than above
 * it so the number and the thing it measures cannot drift apart when
 * the bar is short.
 */
