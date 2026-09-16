"use client"

import { useTranslations } from "next-intl"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { PricingSection } from "@/components/pricing-section"

import { PREVIEW_LABELS, PREVIEW_STATES, type PreviewState } from "@/lib/subscriptions/preview-states"

/**
 * Plans for one company.
 *
 * Deliberately just the plan cards. Everything that changes state —
 * payment method, invoices, cancelling — lives in Stripe's hosted
 * portal, and the cards' own flow is what leads there. The subscription
 * summary, usage meters and invoice table that briefly lived here were
 * removed on 16 Sep 2026; the query helpers behind them are kept
 * (lib/subscriptions/*), because the data is still wanted — just not
 * all of it on this screen.
 */
export function BillingClient({ previewState = null }: { previewState?: string | null }) {
  const t = useTranslations("dashboard")

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

      <main style={{ flex: 1, paddingTop: 48 }}>
        {/* `embedded` drops the architects-publish-free strip below the
            cards: that is a pitch for the public pricing page, not for
            someone already inside the product. */}
        <PricingSection embedded />
      </main>

      <Footer />
    </div>
  )
}
