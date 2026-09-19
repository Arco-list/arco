"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, Info, Lock } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useAuth } from "@/contexts/auth-context"
import { trackPageView, trackUpgradeIntent } from "@/lib/tracking"
import { claimFoundingAccess, getFoundingClaimStatus } from "@/app/pricing/actions"

// Billing toggle + Free/Pro cards + architects-are-free note, extracted
// from the dashboard pricing page so public surfaces (the /pricing route,
// the /businesses/professionals landing where invited contributors
// arrive) can show the price before signup. Translation keys stay under
// the "dashboard" namespace — single source of truth for pricing copy.
const FEATURE_KEYS = [
  // Same shape as the credits row: the quantity leads. Publishing is
  // the thing Free gives away, so it says so as an act rather than as a
  // value behind a label.
  { labelKey: "pricing_feature_published", freeKey: "pricing_publish_free", proKey: "pricing_publish_free", freeAccentKey: "pricing_unlimited", proAccentKey: "pricing_unlimited", freeBool: true, proBool: true, tooltipKey: "pricing_feature_published_tooltip", tooltipTitleKey: null },
  // The one row the whole plan turns on, so its values say the
  // difference in words: one of your credits against all of them.
  { labelKey: "pricing_feature_contributor", freeKey: "pricing_credits_free", proKey: "pricing_credits_pro", freeAccentKey: "pricing_credits_free_accent", proAccentKey: "pricing_credits_pro_accent", freeBool: true, proBool: true, tooltipKey: "pricing_feature_contributor_tooltip", tooltipTitleKey: null },
  { labelKey: "pricing_feature_company_page", freeKey: null, proKey: null, freeBool: true, proBool: true, tooltipKey: "pricing_feature_company_page_tooltip", tooltipTitleKey: null },
  { labelKey: "pricing_feature_team", freeKey: null, proKey: null, freeBool: false, proBool: true, tooltipKey: "pricing_feature_team_tooltip", tooltipTitleKey: null },
  { labelKey: "pricing_feature_analytics", freeKey: null, proKey: null, freeBool: false, proBool: true, tooltipKey: "pricing_feature_analytics_tooltip", tooltipTitleKey: null, comingSoon: true },
  { labelKey: "pricing_feature_arco_approved", freeKey: null, proKey: null, freeBool: false, proBool: true, tooltipKey: "pricing_feature_arco_approved_tooltip", tooltipTitleKey: "pricing_feature_arco_approved_tooltip_title", comingSoon: true },
] as const

// One shared order on both cards so the rows align line-for-line —
// contributor credits (the thing being sold) at the top, the Free
// card's included features grouped above its dashes.
const FEATURE_ORDER = ["pricing_feature_contributor", "pricing_feature_published", "pricing_feature_company_page", "pricing_feature_team", "pricing_feature_analytics", "pricing_feature_arco_approved"]
const orderedFeatures = () =>
  FEATURE_ORDER.map((k) => FEATURE_KEYS.find((f) => f.labelKey === k)!).filter(Boolean)

/**
 * What Free actually gives, and what Pro adds on top of it.
 *
 * Stacked rather than mirrored: a row of dashes down the Free card
 * lists what a reader does NOT get, which is a strange thing to show
 * someone on the plan. Pro repeats only what differs — a feature Free
 * lacks, or one it has on smaller terms (one credit against unlimited)
 * — under "everything in Free, and". Nothing is said twice.
 */
const freeFeatures = () => orderedFeatures().filter((f) => f.freeBool)
const proExtras = () =>
  orderedFeatures().filter((f) => !f.freeBool || f.proKey !== f.freeKey)

/**
 * Contributor claim CTA — full-width grey band (.how-section treatment).
 * Rendered AFTER the FAQ as the page's closing ask: the FAQ resolves
 * objections, this converts the reader who made it to the bottom.
 * `showLandingLink` is off on /businesses/professionals where the link
 * would be self-referential.
 */
export function PricingContributorCta({ showLandingLink = true }: { showLandingLink?: boolean }) {
  const t = useTranslations("dashboard")
  const { user, profile } = useAuth()
  const userTypes = profile?.user_types as string[] | null
  const hasProfessionalRole = userTypes?.includes("professional") ?? false

  // Acquisition ask — pointless for logged-in professionals, who
  // already have their company page (e.g. the dashboard pricing page).
  if (user && hasProfessionalRole) return null

  return (
    // No top margin — a margin here opens a gap between the (white) FAQ
    // above and this grey band, exposing the page background as a stray
    // strip. The FAQ's own bottom padding provides the whitespace.
    <section className="how-section" style={{ textAlign: "center" }}>
      <div className="wrap" style={{ maxWidth: 860 }}>
        <h3 className="arco-section-title" style={{ marginBottom: 12 }}>{t("pricing_contrib_cta_title")}</h3>
        <p className="arco-body-text" style={{ maxWidth: 440, margin: "0 auto 20px" }}>
          {t("pricing_contrib_cta_body")}
        </p>
        {/* Straight to the /claim funnel — it handles signed-out
            visitors itself, so no login modal detour anymore. */}
        <Link href="/claim" style={{ display: "inline-block", padding: "12px 28px", fontSize: 14, fontFamily: "var(--font-sans)", background: "var(--primary)", border: "1px solid var(--primary)", borderRadius: 3, color: "#ffffff" }}>
          {t("pricing_contrib_cta_button")}
        </Link>
        {showLandingLink && (
          <div style={{ marginTop: 14 }}>
            <Link href="/businesses/professionals" className="text-link-plain">
              {t("pricing_link_professionals")} →
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}

export function PricingSection({
  embedded = false,
  /** Off inside the dashboard: the page already has a title, and
   *  "Eenvoudige, transparante abonnementen" is a pitch for someone
   *  deciding whether to join — not for a company already inside. */
  showHeader = true,
  sectionHeading = null,
  currentPlan = null,
  onUpgrade = null,
  actionsBusy = false,
}: {
  embedded?: boolean
  showHeader?: boolean
  /**
   * Turns the block into a section of a page the reader is already on:
   * the heading and the billing toggle share one row, and the cards sit
   * flush with the page's left edge instead of centred in their own
   * column. Used on the plan page, where these are one section among
   * several and must line up with the rest.
   */
  sectionHeading?: string | null
  /**
   * The plan this company is actually on. Setting it flips the cards
   * from selling to managing: the badge marks where you are instead of
   * what we recommend, the accent moves to the card you can act on, and
   * the acquisition furniture (no-card-needed, the founding pitch)
   * comes off — none of it is addressed to someone already inside.
   */
  currentPlan?: "free" | "pro" | null
  /** Takes the cycle the reader has selected, so the card and the
   *  checkout can never promise different prices. */
  onUpgrade?: ((interval: "month" | "year") => void) | null
  actionsBusy?: boolean
}) {
  const t = useTranslations("dashboard")
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly")
  const { user, profile } = useAuth()

  const proPrice = billingCycle === "yearly" ? 39 : 49

  const userTypes = profile?.user_types as string[] | null
  const hasProfessionalRole = userTypes?.includes("professional") ?? false

  // Key pages get a manual pageview (autocapture is off). Tracked from
  // the real path rather than a constant: this section also renders
  // inside the subscription screen.
  useEffect(() => {
    if (typeof window !== "undefined") trackPageView(window.location.pathname.replace(/^\/(nl|en)(?=\/)/, ""))
  }, [])

  const handleStartFree = () => {
    if (user && hasProfessionalRole) {
      window.location.href = "/dashboard/listings"
      return
    }
    // The /claim funnel replaces the modal AND the login detour: it
    // collects the account on its own second step, so signed-out
    // visitors go straight in.
    window.location.href = "/claim"
  }

  // Whether this professional's company already claimed founding access
  // (persisted on companies.founding_claimed_at, so the button state
  // survives reloads and other devices).
  const [foundingClaimed, setFoundingClaimed] = useState(false)
  useEffect(() => {
    if (!user || !hasProfessionalRole) return
    getFoundingClaimStatus().then((r) => setFoundingClaimed(r.claimed)).catch(() => {})
  }, [user, hasProfessionalRole])

  // Billing doesn't exist yet — the Pro CTA's job is to COLLECT the
  // willingness-to-pay signal (upgrade_intent) and route into the same
  // free claim flow. Logged-in professionals get their claim stamped
  // (durable counterpart of the PostHog event) + confirmation.
  const handleClaimFounding = () => {
    trackUpgradeIntent(typeof window !== "undefined" ? window.location.pathname : "pricing", billingCycle)
    if (user && hasProfessionalRole) {
      setFoundingClaimed(true)
      claimFoundingAccess().catch(() => {})
      toast.success(t("pricing_founding_toast"))
      return
    }
    handleStartFree()
  }

  const managing = currentPlan != null

  // The plan you are on says so quietly and offers nothing: a button
  // that does nothing is worse than no button. Sized like one anyway,
  // so both cards' footers keep the same baseline.
  const currentPlanNote = (
    <div style={{
      width: "100%", padding: "12px 24px", fontSize: 14, fontFamily: "var(--font-sans)",
      border: "1px solid var(--arco-rule)", borderRadius: 3, boxSizing: "border-box",
      color: "var(--arco-light)", textAlign: "center", cursor: "default",
    }}>
      {t("pricing_your_plan")}
    </div>
  )

  // Recommended while there is something to recommend. Once the reader
  // is on Pro there is nothing to point at, so the badge and the accent
  // border both go and the card simply states where they are.
  const proIsCurrent = currentPlan === "pro"

  // Always centred under whatever heading the context supplies.
  const cycleToggle = (
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
  )

  return (
    <>
    {/* Centred in the page rather than flush left: the cards are a
        block to compare, not a row to scan across, and the page around
        them is far wider than they should ever be. */}
    {/* 940 rather than 860: at the narrower measure a feature row like
        "Onbeperkt projectvermeldingen" wrapped, which broke the line-for-line
        pairing the two cards are built on. The prose below keeps its own
        reading width. */}
    <div className={sectionHeading ? undefined : "wrap"} style={{ maxWidth: 940, margin: sectionHeading ? "0 auto" : undefined }}>

      {sectionHeading && (
        <h3 className="arco-section-title" style={{ textAlign: "center", marginBottom: 20 }}>
          {sectionHeading}
        </h3>
      )}

      {/* Header — page title on /pricing, section title when embedded
          in a landing page, nothing at all in the dashboard. */}
      {showHeader && (
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
      )}

      {/* Billing toggle */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
        {cycleToggle}
      </div>

      {/* Pricing cards */}
      <div className="pricing-grid">

        {/* Free */}
        <div className="pricing-card pricing-card-subgrid">
          {/* Header mirrors the Pro card's exact stack (label / price /
              meta / desc) with matching heights, so the descriptions and
              everything below them line up across the two cards. */}
          <div className="pricing-card-header">
            <p className="pricing-card-label">{t("pricing_free")}</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, minHeight: 48 }}>
              <h2 className="pricing-card-price">€0</h2>
            </div>
            <p style={{ fontSize: 12, color: "var(--arco-light)", marginTop: 6, minHeight: 18 }}>{t("pricing_free_meta")}</p>
            <p className="arco-small-text" style={{ marginTop: 8, minHeight: 42 }}>{t("pricing_free_desc")}</p>
          </div>

          <div className="pricing-card-features">
            {/* Its own intro, so both lists start on the same line and
                the rows across the two cards stay paired. */}
            <p className="pricing-feature-intro">{t("pricing_you_start_with")}</p>
            {freeFeatures().map((f) => {
              const included = true
              const label = t(f.labelKey as any)
              const valueStr = f.freeKey ? t(f.freeKey as any) : null
              // A quantity that leads its own sentence rather than
              // trailing a label after a colon — the one row where the
              // number IS the difference between the two plans.
              const accent = "freeAccentKey" in f && f.freeAccentKey ? t(f.freeAccentKey as any) : null
              return (
                <div key={f.labelKey} className={`pricing-feature${!included ? " disabled" : ""}`}>
                  {included ? (
                    <Check size={16} style={{ color: "var(--arco-mid-grey)", flexShrink: 0 }} />
                  ) : (
                    <span style={{ width: 16, height: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--arco-rule)" }}>—</span>
                  )}
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {accent ? (
                      <span>
                        <strong style={{ fontWeight: 500, color: "var(--arco-black)" }}>{accent}</strong>{" "}
                        {valueStr}
                      </span>
                    ) : valueStr ? `${label}: ${valueStr}` : label}
                    {f.tooltipKey && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" aria-label={`More info: ${label}`} style={{ display: "inline-flex", alignItems: "center", border: "none", background: "transparent", padding: 0, cursor: "help", color: "var(--arco-light)" }}>
                            <Info size={13} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-left">
                          <div className="arco-tooltip-title">
                            {t((f.tooltipTitleKey ?? f.labelKey) as any)}
                          </div>
                          <div>{t(f.tooltipKey as any)}</div>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="pricing-card-footer">
            {/* Once Pro (founding) is claimed, Pro is the current plan —
                the Free card flips to "Included in Pro" instead of
                wrongly claiming to be the current plan. */}
            {managing ? (
              /* Only ever a statement here. Going back to Free is
                 cancelling, and cancelling says what it costs you — so
                 it lives in its own section with those words, not
                 behind a button on a price card. */
              currentPlan === "free" ? currentPlanNote : <span />
            ) : user && hasProfessionalRole ? (
              <button disabled style={{ width: "100%", padding: "12px 24px", fontSize: 14, fontFamily: "var(--font-sans)", background: "none", border: "1px solid var(--arco-rule)", borderRadius: 3, color: "var(--arco-light)", cursor: "default" }}>
                {foundingClaimed ? t("pricing_included_in_pro") : t("pricing_current_plan")}
              </button>
            ) : (
              /* Primary on the public page: a visitor with no company
                 cannot buy Pro yet — creating the page IS the first
                 step, and both buttons lead there anyway. */
              <button onClick={handleStartFree} style={{ width: "100%", padding: "12px 24px", fontSize: 14, fontFamily: "var(--font-sans)", background: "var(--primary)", border: "1px solid var(--primary)", borderRadius: 3, color: "#ffffff", cursor: "pointer" }}>
                {t("pricing_get_started")}
              </button>
            )}
            {/* Same note height as the Pro footer (2 lines) so
                margin-top:auto pins both buttons to the same y. Both
                notes are pitches at someone still deciding to join, so
                inside the product both come off — together, which keeps
                the footers level. */}
            {!managing && (
              <p style={{ textAlign: "center", fontSize: 12, color: "var(--arco-light)", marginTop: 8, minHeight: 36 }}>
                {t("pricing_no_card")}
              </p>
            )}
          </div>
        </div>

        {/* Pro */}
        <div className={`pricing-card pricing-card-subgrid${proIsCurrent ? "" : " pricing-card-featured"}`}>
          {managing && !proIsCurrent && <span className="pricing-card-badge">{t("pricing_recommended")}</span>}
          <div className="pricing-card-header">
            <p className="pricing-card-label" style={{ color: "var(--primary)" }}>{t("pricing_pro")}</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, minHeight: 48 }}>
              <h2 className="pricing-card-price">€{proPrice}</h2>
              <span style={{ fontSize: 14, color: "var(--arco-light)" }}>{t("pricing_per_month")}</span>
            </div>
            {/* One quiet meta line replaces the bulky billed-annually pill
                + separate VAT note. Same height slot as the Free card's
                meta line, keeping both cards on the same grid. */}
            <p style={{ fontSize: 12, color: "var(--arco-light)", marginTop: 6, minHeight: 18 }}>
              {billingCycle === "yearly" ? t("pricing_meta_yearly", { amount: "€468" }) : t("pricing_ex_vat")}
            </p>
            <p className="arco-small-text" style={{ marginTop: 8, minHeight: 42 }}>{t("pricing_pro_desc")}</p>
          </div>

          <div className="pricing-card-features">
            <p className="pricing-feature-intro">{t("pricing_everything_in_free")}</p>
            {proExtras().map((f) => {
              const label = t(f.labelKey as any)
              const valueStr = f.proKey ? t(f.proKey as any) : null
              const accent = "proAccentKey" in f && f.proAccentKey ? t(f.proAccentKey as any) : null
              return (
                <div key={f.labelKey} className="pricing-feature">
                  <Check size={16} style={{ color: "var(--primary)", flexShrink: 0 }} />
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {accent ? (
                      <span>
                        <strong style={{ fontWeight: 500, color: "var(--primary)" }}>{accent}</strong>{" "}
                        {valueStr}
                      </span>
                    ) : valueStr ? `${label}: ${valueStr}` : label}
                    {"comingSoon" in f && f.comingSoon && (
                      <span className="pricing-feature-soon">{t("pricing_feature_coming")}</span>
                    )}
                    {f.tooltipKey && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" aria-label={`More info: ${label}`} style={{ display: "inline-flex", alignItems: "center", border: "none", background: "transparent", padding: 0, cursor: "help", color: "var(--primary)" }}>
                            <Info size={13} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-left">
                          <div className="arco-tooltip-title">
                            {t((f.tooltipTitleKey ?? f.labelKey) as any)}
                          </div>
                          <div>{t(f.tooltipKey as any)}</div>
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
                route into the same free claim flow. Once claimed, the
                button flips to a quiet confirmed state. Inside the
                product none of that applies: billing does exist there,
                so the button is the real one, in the same words the
                plan banner uses. */}
            {managing ? (
              // The toggle above these cards compares prices; it does not
              // move anyone's money. Switching cycle is an act, and acts
              // live in the manage section with the other rows that
              // change something.
              currentPlan === "pro" ? currentPlanNote : (
                <button
                  type="button"
                  onClick={() => onUpgrade?.(billingCycle === "monthly" ? "month" : "year")}
                  disabled={!onUpgrade || actionsBusy}
                  style={{
                    width: "100%", padding: "12px 24px", fontSize: 14, fontFamily: "var(--font-sans)",
                    background: "var(--primary)", border: "1px solid var(--primary)", borderRadius: 3,
                    color: "#ffffff", cursor: onUpgrade ? "pointer" : "default",
                    opacity: onUpgrade ? (actionsBusy ? 0.6 : 1) : 0.5,
                  }}
                >
                  {t("billing.action_upgrade")}
                </button>
              )
            ) : foundingClaimed ? (
              <button disabled style={{ width: "100%", padding: "12px 24px", fontSize: 14, fontFamily: "var(--font-sans)", background: "#f0f7f6", border: "1px solid var(--primary)", borderRadius: 3, color: "var(--primary)", cursor: "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Check size={16} />
                {t("pricing_founding_claimed")}
              </button>
            ) : (
              /* Outline, not primary: it goes to the same signup as the
                 Free card. Two equally loud buttons for one destination
                 is a choice the reader does not actually have. */
              <button onClick={handleClaimFounding} style={{ width: "100%", padding: "12px 24px", fontSize: 14, fontFamily: "var(--font-sans)", background: "none", border: "1px solid var(--primary)", borderRadius: 3, color: "var(--primary)", cursor: "pointer" }}>
                {t("pricing_claim_founding")}
              </button>
            )}
            {!managing && (
              <p style={{ textAlign: "center", fontSize: 12, color: "var(--arco-light)", marginTop: 8, minHeight: 36 }}>
                {t("pricing_coming_soon")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Credit example — the product is a credit on a photographed
          project; SHOW it, using the exact card design from the project
          detail page's "Vermelde professionals" section (credit-card /
          credit-icon classes). Left = a live (Pro) credit, right = the
          locked state an unpaid second credit will get.

          Left out inside the product: it exists to explain what a credit
          IS to someone who has never seen one. A company managing its
          own plan has them on its own page already. */}
      <div hidden={managing} style={{ margin: "56px auto 0", maxWidth: 560 }}>
        <h3 className="arco-section-title" style={{ textAlign: "center", marginBottom: 16 }}>{t("pricing_credit_example_title")}</h3>
        {/* Same copy treatment as the body under the page header. */}
        <p className="arco-body-text" style={{ textAlign: "center", maxWidth: 480, margin: "0 auto 32px" }}>{t("pricing_credit_example_caption")}</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
          {/* Live credit — mirrors the real credit-card. Dark circle with
              a white mark, like a real company logo tile. */}
          <div className="credit-card">
            <span className="arco-eyebrow" style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}>{t("pricing_mock_role_kitchen")}</span>
            {/* Dummy letterform logo — geometric "v" mark in a dark
                roundel, same visual language as real company logos
                (cf. Kraal architecten's "k" roundel). */}
            <div className="credit-icon" style={{ background: "#22304e" }}>
              <svg viewBox="0 0 100 100" width="100" height="100" aria-hidden="true">
                <rect x="34" y="29" width="13" height="42" rx="6.5" fill="#f5f3ee" transform="rotate(-20 40.5 50)" />
                <rect x="53" y="29" width="13" height="42" rx="6.5" fill="#f5f3ee" transform="rotate(20 59.5 50)" />
                <circle cx="73" cy="31" r="6" fill="#f5f3ee" />
              </svg>
            </div>
            <h3 className="arco-label" style={{ marginBottom: 6 }}>Van Dijk Keukens</h3>
            <p className="arco-card-subtitle" style={{ marginBottom: 12 }}>{t("pricing_mock_projects_live")}</p>
            <span className="text-link-plain">{t("pricing_mock_view_portfolio")} →</span>
          </div>
          {/* Locked credit — same card, diminished: greyed logo mark with
              a small lock badge on the circle. */}
          <div className="credit-card" style={{ cursor: "default" }}>
            <span className="arco-eyebrow" style={{ marginBottom: 16, display: "flex", justifyContent: "center", opacity: 0.55 }}>{t("pricing_mock_role_pool")}</span>
            <div style={{ position: "relative", width: 100, margin: "0 auto 16px" }}>
              {/* Dummy letterform logo — geometric "b" mark, greyed. */}
              <div className="credit-icon" style={{ margin: 0, background: "#e8e8e6" }}>
                <svg viewBox="0 0 100 100" width="100" height="100" aria-hidden="true">
                  <rect x="34" y="26" width="13" height="48" rx="6.5" fill="#a1a1a0" />
                  <circle cx="58" cy="59" r="14" fill="none" stroke="#a1a1a0" strokeWidth="10" />
                </svg>
              </div>
              <div style={{ position: "absolute", right: 0, bottom: 0, width: 30, height: 30, borderRadius: "50%", background: "#ffffff", border: "1px solid #e8e8e6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Lock size={14} style={{ color: "#6b6b68" }} />
              </div>
            </div>
            <h3 className="arco-label" style={{ marginBottom: 6, color: "#a1a1a0" }}>B&amp;W Zwembadbouw</h3>
            <p className="arco-card-subtitle" style={{ marginBottom: 12, opacity: 0.55 }}>1 project</p>
            <span style={{ fontSize: 12, border: "1px solid var(--primary)", color: "var(--primary)", borderRadius: 999, padding: "4px 12px", display: "inline-block" }}>{t("pricing_mock_unlock")}</span>
          </div>
        </div>
      </div>
    </div>

      {/* Architect hero section — standalone /pricing only. On the
          professionals landing the audience is contributors; the
          architects-publish-free story lives on their own landing. */}
      {!embedded && (
      <div className="wrap" style={{ maxWidth: 860 }}>
      <div style={{ margin: "56px 0 0", padding: "40px 32px", background: "var(--arco-off-white)", borderRadius: 8, textAlign: "center" }}>
        <p className="arco-eyebrow" style={{ marginBottom: 12 }}>
          {t("pricing_for_architects")}
        </p>
        <h3 className="arco-section-title" style={{ marginBottom: 12 }}>{t("pricing_publishing_free")}</h3>
        <p className="arco-body-text" style={{ maxWidth: 480, margin: "0 auto 16px" }}>
          {t("pricing_publishing_free_body")}
        </p>
        <Link href="/businesses/architects" className="text-link-plain">
          {t("pricing_architect_strip_link")} →
        </Link>
      </div>
      </div>
      )}
    </>
  )
}
