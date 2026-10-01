"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Check, Info } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useAuth } from "@/contexts/auth-context"
import { trackPageView, trackUpgradeIntent } from "@/lib/tracking"
import { claimFoundingAccess, getFoundingClaimStatus, getPricingExampleListings, type PricingExampleListing } from "@/app/pricing/actions"

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

// Publishing first, credits second — the order the reader lives them.
// You arrive as an architect with your own work, and only then meet
// the other half: being named on someone else's. Leading with credits
// asked a question before the reader knew what it was about. Pro's
// list drops publishing (it is the same there) and opens on the row
// that differs, so the thing being sold still leads that card.
const FEATURE_ORDER = ["pricing_feature_published", "pricing_feature_contributor", "pricing_feature_company_page", "pricing_feature_team", "pricing_feature_analytics", "pricing_feature_arco_approved"]
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
            <Link href="/businesses/professionals" className="arco-text-link">
              <span className="arco-text-link-label">{t("pricing_link_professionals")}</span>
              <span aria-hidden>→</span>
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
  /** Starts checkout. The optional code is prefilled there rather than
   *  typed — the founding offer is reached by clicking an offer, not by
   *  remembering a password. */
  onUpgrade?: ((interval: "month" | "year", code?: string) => void) | null
  actionsBusy?: boolean
}) {
  const t = useTranslations("dashboard")
  // The same namespace the project page reads it from — the key
  // lives in project_detail, not common, and next-intl answers a
  // miss by printing the key rather than failing.
  const tProject = useTranslations("project_detail")
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
  const [foundingOpen, setFoundingOpen] = useState(false)

  // The example listings, fetched rather than drawn. Empty until they
  // arrive and empty if fewer than two exist — the section hides
  // itself rather than showing half an illustration.
  const [examples, setExamples] = useState<PricingExampleListing[]>([])
  useEffect(() => {
    getPricingExampleListings().then(setExamples).catch(() => {})
  }, [])
  useEffect(() => {
    if (!user || !hasProfessionalRole) return
    getFoundingClaimStatus().then((r) => setFoundingClaimed(r.claimed)).catch(() => {})
  }, [user, hasProfessionalRole])

  // Billing doesn't exist yet — the Pro CTA's job is to COLLECT the
  // willingness-to-pay signal (upgrade_intent) and route into the same
  // free claim flow. Logged-in professionals get their claim stamped
  // (durable counterpart of the PostHog event) + confirmation.
  // The offer is explained before it is taken. Claiming used to happen
  // on the click itself, which meant the reader agreed to something
  // they had not been told: a code, six months, and what happens after.
  const handleOpenFounding = () => {
    trackUpgradeIntent(typeof window !== "undefined" ? window.location.pathname : "pricing", billingCycle)
    setFoundingOpen(true)
  }

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
    <div
      className={sectionHeading ? undefined : "pricing-section-wrap"}
      style={sectionHeading ? { maxWidth: 940, margin: "0 auto" } : undefined}
    >

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
            {/* The footers are bottom-pinned (margin-top:auto in a shared
                subgrid row), so the buttons only line up while the block
                BELOW them is the same height in both cards. This slot is
                that block: it carries the note on the public page and
                stands empty inside the product, where only the Pro card
                still has something to say.
                Rendered on exactly the condition the Pro note uses. One
                of the two notes was once dropped on its own and the
                buttons immediately sat at different heights. */}
            {(!managing || currentPlan !== "pro") && (
              <p style={{ textAlign: "center", fontSize: 12, color: "var(--arco-light)", marginTop: 6, minHeight: 22 }}>
                {managing ? "\u00A0" : t("pricing_no_card")}
              </p>
            )}
          </div>
        </div>

        {/* Pro */}
        <div className={`pricing-card pricing-card-subgrid${proIsCurrent ? "" : " pricing-card-featured"}`}>
          {/* Shown wherever Pro is still something to choose, inside the
              product and out. It was dashboard-only, which left the
              public page — the one page whose whole job is to recommend
              a plan — without a recommendation. */}
          {!proIsCurrent && <span className="pricing-card-badge">{t("pricing_recommended")}</span>}
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
                /* The founding offer, not a bare upgrade. A company
                   reading this page is on the free plan during the
                   launch period, so "Upgrade naar Pro" asked them to
                   pay for something they can have for six months at no
                   charge — the same offer /pricing makes to the same
                   person before they sign up.
                   No modal here. Outside the product the modal explains
                   a code to someone who has to carry it into a checkout
                   they have not seen; here the checkout is one click
                   away and arrives with the code already applied, so
                   showing it would be explaining a step we just removed.
                   The code is removable there, which is what keeps the
                   plain paid route reachable. */
                <button
                  type="button"
                  onClick={() => onUpgrade?.(billingCycle === "monthly" ? "month" : "year", "FOUNDING")}
                  disabled={!onUpgrade || actionsBusy}
                  style={{
                    width: "100%", padding: "12px 24px", fontSize: 14, fontFamily: "var(--font-sans)",
                    background: "var(--primary)", border: "1px solid var(--primary)", borderRadius: 3,
                    color: "#ffffff", cursor: onUpgrade ? "pointer" : "default",
                    opacity: onUpgrade ? (actionsBusy ? 0.6 : 1) : 0.5,
                  }}
                >
                  {t("pricing_founding_cta")}
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
              <button onClick={handleOpenFounding} style={{ width: "100%", padding: "12px 24px", fontSize: 14, fontFamily: "var(--font-sans)", background: "none", border: "1px solid var(--primary)", borderRadius: 3, color: "var(--primary)", cursor: "pointer" }}>
                {t("pricing_founding_cta")}
              </button>
            )}
            {/* Shown wherever the offer is: outside the product always,
                inside it only on the card that is actually offering it —
                never under "Je huidige abonnement", where it would read
                as a condition on something already held. Its twin in the
                Free footer renders on this same condition and keeps the
                two buttons level.
                22px is one line, not two: both notes are short enough to
                stay on one at every width where the cards sit side by
                side, and reserving a second line held both buttons a
                line higher than they needed to be. Below 640px the grid
                is a single column, where height no longer has to match. */}
            {(!managing || currentPlan !== "pro") && (
              <p style={{ textAlign: "center", fontSize: 12, color: "var(--arco-light)", marginTop: 6, minHeight: 22 }}>
                {t("pricing_founding_limit")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* The founding offer, explained before it is taken.
          FOUNDING is a real code — checkout resolves it to 100% off
          for FREE_MONTHS, which is six — so the headline and the
          thing it promises cannot drift apart. */}
      {foundingOpen && (
        <div className="popup-overlay" onClick={() => setFoundingOpen(false)}>
          <div className="popup-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="popup-header">
              <h3 className="arco-section-title">{t("pricing_founding_modal_title")}</h3>
              <button
                type="button"
                className="popup-close"
                onClick={() => setFoundingOpen(false)}
                aria-label="Sluiten"
              >
                ✕
              </button>
            </div>

            <p className="arco-eyebrow" style={{ marginBottom: 8 }}>
              {t("pricing_founding_modal_code_label")}
            </p>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText("FOUNDING").then(
                  () => toast.success(t("pricing_founding_modal_copied")),
                  () => {},
                )
              }}
              style={{
                width: "100%", padding: "14px 16px", marginBottom: 16,
                fontFamily: "var(--font-mono, ui-monospace), monospace",
                fontSize: 20, letterSpacing: "0.12em", fontWeight: 500,
                color: "var(--primary)", background: "#f0f7f6",
                border: "1px dashed var(--primary)", borderRadius: 3,
                cursor: "pointer",
              }}
            >
              FOUNDING
            </button>

            <p className="arco-body-text" style={{ marginBottom: 20 }}>
              {t("pricing_founding_modal_body")}
            </p>

            <button
              type="button"
              onClick={() => { setFoundingOpen(false); handleClaimFounding() }}
              style={{
                width: "100%", padding: "12px 24px", fontSize: 14,
                fontFamily: "var(--font-sans)", background: "var(--primary)",
                border: "1px solid var(--primary)", borderRadius: 3,
                color: "#fff", cursor: "pointer",
              }}
            >
              {t("pricing_founding_modal_cta")}
            </button>
          </div>
        </div>
      )}

      {/* Credit example — the product is a credit on a photographed
          project; SHOW it, using the exact card design from the project
          detail page's "Vermelde professionals" section (credit-card /
          credit-icon classes). Left = a live (Pro) credit, right = the
          locked state an unpaid second credit will get.

          Left out inside the product: it exists to explain what a credit
          IS to someone who has never seen one. A company managing its
          own plan has them on its own page already. */}
      <div hidden={managing || examples.length < 2} style={{ margin: "56px auto 0", maxWidth: 560 }}>
        <h3 className="arco-section-title" style={{ textAlign: "center", marginBottom: 16 }}>{t("pricing_credit_example_title")}</h3>
        <p className="arco-body-text" style={{ textAlign: "center", maxWidth: 480, margin: "0 auto 32px" }}>{t("pricing_credit_example_caption")}</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
          {examples.map((company) => (
            /* The project page's credit card, same markup and the same
               classes — this is the thing being explained, so it
               should not be a drawing of it.
               `object-contain`, not cover: a logo is a shape, and
               cropping one to fill a circle cuts the name off.
               Linked, and in a new tab: the card carries an arrow, and
               a card that looks like a door and is not is worse than
               one that promises nothing — but this is the page asking
               for a signup, so proving the listing is real should not
               cost the reader their place. */
            <a
              key={company.slug}
              className="credit-card"
              href={`/professionals/${company.slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="arco-eyebrow">{company.serviceLabel ?? ""}</span>

              <div className="credit-icon">
                {company.logoUrl && (
                  <Image src={company.logoUrl} alt={company.name} fill className="object-contain" />
                )}
              </div>

              <h3 className="arco-label">{company.name}</h3>
              {company.projectCount > 0 && (
                <p className="credit-card-projects">
                  <span className="credit-card-projects-label">
                    {tProject("projects_count", { count: company.projectCount })}
                  </span>
                  <ArrowRight className="credit-card-arrow" size={14} strokeWidth={1.5} aria-hidden />
                </p>
              )}
            </a>
          ))}
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
        <Link href="/businesses/architects" className="arco-text-link">
          <span className="arco-text-link-label">{t("pricing_architect_strip_link")}</span>
          <span aria-hidden>→</span>
        </Link>
      </div>
      </div>
      )}
    </>
  )
}
