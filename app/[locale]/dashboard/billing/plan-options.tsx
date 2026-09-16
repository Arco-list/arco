"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

import type { CompanyBilling } from "@/lib/subscriptions/get-company-subscription"

/**
 * The plan chooser: what you have, and what else you could have.
 *
 * Lives on the billing page behind ?view=plans rather than in a modal.
 * Changing a subscription is a considered decision — people leave it
 * open, come back to it, and after choosing they travel to Stripe and
 * back. A URL survives all three; a modal survives none of them.
 */
export function PlanOptions({
  billing,
  busy,
  pending,
  onChoose,
}: {
  billing: CompanyBilling
  busy: boolean
  pending: boolean
  /** null = cancel down to Free (handled in Stripe's portal). */
  onChoose: (interval: "month" | "year" | null) => void
}) {
  const t = useTranslations("dashboard")
  const tb = useTranslations("dashboard.billing")

  const isPro = billing.plan === "pro"
  const currentInterval = billing.interval
  // Default the toggle to what they already pay for, so the card opens
  // on the plan they know rather than on a pitch.
  const [interval, setInterval] = useState<"month" | "year">(currentInterval === "month" ? "month" : "year")

  const isCurrentPro = isPro && currentInterval === interval && billing.source === "subscription"

  // One label per situation. "Upgrade" is wrong for someone moving from
  // monthly to yearly (same plan, cheaper) and for a founding company
  // (already on Pro) — say what actually happens instead.
  const proButtonLabel = isCurrentPro
    ? tb("current_plan_button")
    : billing.source === "founding"
      ? tb("action_start_paying")
      : isPro && currentInterval !== interval
        ? interval === "year" ? tb("action_switch_yearly") : tb("action_switch_monthly")
        : tb("action_upgrade")

  const proFeatures = [
    { label: t("pricing_feature_contributor"), value: tb("unlimited") },
    { label: t("pricing_feature_team") },
    { label: t("pricing_feature_analytics"), soon: true },
    { label: t("pricing_feature_arco_approved"), soon: true },
  ]

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, marginBottom: 36 }}>
      {/* ── Free ─────────────────────────────────────────────────── */}
      <div style={{ border: "1px solid var(--arco-light-grey)", borderRadius: 6, padding: "26px 28px", display: "flex", flexDirection: "column" }}>
        <h4 style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 300, margin: "0 0 4px" }}>{tb("plan_free")}</h4>
        <p className="arco-small-text" style={{ margin: "0 0 20px" }}>{tb("free_tagline")}</p>

        <p style={{ margin: "0 0 20px", display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 34, fontWeight: 300 }}>€0</span>
          <span className="arco-small-text">{tb("forever")}</span>
        </p>

        <button
          type="button"
          className="btn-tertiary"
          style={{ width: "100%", fontSize: 14, padding: "11px 20px", marginBottom: 20 }}
          onClick={() => onChoose(null)}
          disabled={pending || !isPro}
        >
          {!isPro ? tb("current_plan_button") : tb("action_downgrade")}
        </button>

        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          <FeatureLine label={t("pricing_feature_published")} value={tb("unlimited")} />
          <FeatureLine label={t("pricing_feature_contributor")} value={tb("one_project")} />
          <FeatureLine label={t("pricing_feature_company_page")} />
        </ul>
      </div>

      {/* ── Pro ──────────────────────────────────────────────────── */}
      <div style={{
        border: `1px solid ${isPro ? "var(--primary, #016D75)" : "var(--arco-light-grey)"}`,
        borderRadius: 6, padding: "26px 28px", display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
          <h4 style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 300, margin: 0 }}>Pro</h4>
          {/* The cycle toggle sits in the card it changes — the Free
              card has no cycle to choose. */}
          <div className="toggle-seg-group" style={{ display: "inline-flex", borderRadius: 999, background: "var(--arco-surface)", padding: 3 }}>
            {(["month", "year"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setInterval(opt)}
                style={{
                  border: "none", cursor: "pointer", borderRadius: 999, padding: "5px 12px",
                  fontSize: 12, whiteSpace: "nowrap",
                  background: interval === opt ? "#fff" : "transparent",
                  color: interval === opt ? "var(--text-primary)" : "var(--arco-mid-grey)",
                  boxShadow: interval === opt ? "0 1px 3px rgba(0,0,0,.08)" : "none",
                }}
              >
                {opt === "month" ? t("pricing_monthly") : t("pricing_yearly")}
              </button>
            ))}
          </div>
        </div>
        <p className="arco-small-text" style={{ margin: "0 0 20px" }}>{tb("pro_tagline")}</p>

        <p style={{ margin: "0 0 20px", display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 34, fontWeight: 300 }}>
            €{interval === "month" ? "49" : "39"}
          </span>
          <span className="arco-small-text">
            {interval === "month" ? tb("per_month_suffix") : tb("per_month_billed_yearly", { total: "468" })}
          </span>
        </p>

        <button
          type="button"
          className="btn-primary"
          style={{ width: "100%", fontSize: 14, padding: "11px 20px", marginBottom: 20, opacity: busy ? 0.6 : 1 }}
          onClick={() => onChoose(interval)}
          disabled={pending || isCurrentPro}
        >
          {proButtonLabel}
        </button>

        <p className="arco-small-text" style={{ margin: "0 0 10px" }}>{tb("everything_in_free")}</p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {proFeatures.map((f) => (
            <FeatureLine key={f.label} label={f.label} value={f.value} soon={f.soon} />
          ))}
        </ul>
      </div>
    </div>
  )
}

function FeatureLine({ label, value, soon }: { label: string; value?: string; soon?: boolean }) {
  const t = useTranslations("dashboard")
  return (
    <li style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: "var(--primary, #016D75)" }}>
        <path d="M3 8l4 4 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>
        {label}
        {value && <span style={{ color: "var(--text-secondary)" }}>{`: ${value}`}</span>}
        {soon && <span className="pricing-feature-soon" style={{ marginLeft: 8 }}>{t("pricing_feature_coming")}</span>}
      </span>
    </li>
  )
}
