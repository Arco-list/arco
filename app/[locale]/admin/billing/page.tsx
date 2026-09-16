import { redirect } from "next/navigation"

import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { PREVIEW_STATES, PREVIEW_LABELS, PREVIEW_NOTES } from "@/lib/subscriptions/preview-states"

export const dynamic = "force-dynamic"

async function requireAdmin(): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login?redirectTo=/admin/billing")
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_types")
    .eq("id", user.id)
    .maybeSingle()
  const types = Array.isArray(profile?.user_types) ? profile!.user_types : []
  if (!types.includes("admin")) redirect("/")
}

/**
 * Billing — the admin's way into the new plan page, plus the live count
 * of who is on what.
 *
 * The new page lives at /dashboard/billing and will replace the current
 * Abonnementen page once it is finished. Until then both exist side by
 * side, and this is where you open the new one in any state without
 * creating a real subscription.
 */
export default async function AdminBillingPage() {
  await requireAdmin()
  const supabase = createServiceRoleSupabaseClient()

  const [{ data: subs }, { count: foundingCount }] = await Promise.all([
    supabase.from("subscriptions" as never).select("status, billing_interval"),
    supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .not("founding_claimed_at", "is", null),
  ])

  const rows = (subs ?? []) as { status: string; billing_interval: string | null }[]
  const byStatus = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="wrap" style={{ paddingTop: 100, paddingBottom: 80, maxWidth: 860 }}>
      <h1 className="arco-page-title" style={{ marginBottom: 8 }}>Billing</h1>
      <p className="arco-body-text" style={{ marginBottom: 40, color: "var(--text-secondary)" }}>
        The new plan page lives at <code>/dashboard/billing</code>. It is built beside the current
        Abonnementen page and replaces it once finished — nothing routes to it yet except the links
        below.
      </p>

      {/* ── Live state ──────────────────────────────────────────── */}
      <h2 className="arco-section-title" style={{ marginBottom: 16 }}>Where companies stand</h2>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 48 }}>
        <div style={{ border: "1px solid var(--arco-light-grey)", borderRadius: 6, padding: "14px 18px", minWidth: 140 }}>
          <p className="arco-eyebrow" style={{ marginBottom: 6 }}>Founding</p>
          <p className="arco-card-title">{foundingCount ?? 0}</p>
        </div>
        {Object.entries(byStatus).length === 0 ? (
          <div style={{ border: "1px solid var(--arco-light-grey)", borderRadius: 6, padding: "14px 18px", minWidth: 140 }}>
            <p className="arco-eyebrow" style={{ marginBottom: 6 }}>Subscriptions</p>
            <p className="arco-card-title">0</p>
          </div>
        ) : (
          Object.entries(byStatus).map(([status, n]) => (
            <div key={status} style={{ border: "1px solid var(--arco-light-grey)", borderRadius: 6, padding: "14px 18px", minWidth: 140 }}>
              <p className="arco-eyebrow" style={{ marginBottom: 6 }}>{status}</p>
              <p className="arco-card-title">{n}</p>
            </div>
          ))
        )}
      </div>

      {/* ── Preview the page in every state ─────────────────────── */}
      <h2 className="arco-section-title" style={{ marginBottom: 8 }}>Preview the page</h2>
      <p className="arco-body-text" style={{ marginBottom: 24, color: "var(--text-secondary)" }}>
        Each link opens the real page against a synthetic state, through the same code path as live
        data. Nothing is written, and the states are only honoured for an admin.
      </p>

      <div style={{ borderTop: "1px solid var(--arco-light-grey)" }}>
        {PREVIEW_STATES.map((state) => (
          <a
            key={state}
            href={`/dashboard/billing?preview=${state}`}
            style={{
              display: "flex", gap: 20, alignItems: "baseline", justifyContent: "space-between",
              padding: "14px 0", borderBottom: "1px solid var(--arco-light-grey)",
              textDecoration: "none", color: "inherit",
            }}
          >
            <span style={{ minWidth: 230, fontSize: 14 }}>{PREVIEW_LABELS[state]}</span>
            <span className="arco-small-text" style={{ flex: 1 }}>{PREVIEW_NOTES[state]}</span>
            <span style={{ color: "var(--primary, #016D75)", fontSize: 13, whiteSpace: "nowrap" }}>Open →</span>
          </a>
        ))}
      </div>
    </div>
  )
}
