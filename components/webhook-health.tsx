import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

/**
 * When Stripe last reached us.
 *
 * The one thing on this page nobody could see. Everything the
 * subscription screen shows about money is fed by a webhook, and a
 * webhook that stops does not announce itself — it simply leaves the
 * mirror on yesterday's answer while Stripe moves on. During one day of
 * testing it stopped twice: once because the CLI's session expired
 * mid-run, once because nobody had started the listener at all. Both
 * looked exactly like broken features, and cost hours before anyone
 * thought to check the delivery log.
 *
 * `stripe_events` already recorded the answer — a row per claimed
 * event, stamped `processed_at` when its handler finished. Nothing read
 * it. This reads it.
 *
 * Deliberately not an alert. A red banner on a page an admin visits is
 * enough to notice a listener that died an hour ago; catching one that
 * dies at three in the morning needs somewhere to send a message, and
 * that is a decision about tooling rather than a line of code.
 */

/** Beyond this, a quiet webhook is more likely broken than idle. */
const STALE_AFTER_HOURS = 24

function ago(from: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - from.getTime()) / 60_000)
  if (minutes < 1) return "zojuist"
  if (minutes < 60) return `${minutes} min geleden`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} uur geleden`
  return `${Math.floor(hours / 24)} dagen geleden`
}

export async function WebhookHealth() {
  const supabase = createServiceRoleSupabaseClient()

  const [{ data: last }, { count: stuckCount }] = await Promise.all([
    supabase
      .from("stripe_events")
      .select("type, processed_at")
      .not("processed_at", "is", null)
      .order("processed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Claimed but never finished. The handler deletes its own row when
    // it throws, so Stripe can retry — a row left half-done means the
    // process died between the claim and the delete, which no retry
    // will ever pick up.
    supabase
      .from("stripe_events")
      .select("id", { count: "exact", head: true })
      .is("processed_at", null),
  ])

  const processedAt = (last as { processed_at?: string | null } | null)?.processed_at
  const lastType = (last as { type?: string | null } | null)?.type
  const now = new Date()
  const when = processedAt ? new Date(processedAt) : null
  const stale = !when || now.getTime() - when.getTime() > STALE_AFTER_HOURS * 3_600_000

  return (
    <div className="wrap" style={{ marginTop: 40 }}>
      <h4 className="arco-subsection-title" style={{ marginBottom: 10 }}>Stripe-webhook</h4>
      <div className="billing-row billing-row--single-line" style={{ borderTop: "1px solid var(--arco-light-grey)" }}>
        <span style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span
            className="status-pill-dot"
            style={{ background: stale ? "var(--destructive)" : "var(--primary)", borderRadius: "50%" }}
          />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {when
              ? <>Laatste gebeurtenis {ago(when, now)}{lastType ? <span style={{ color: "var(--text-secondary)" }}>{` · ${lastType}`}</span> : null}</>
              : "Nog nooit een gebeurtenis verwerkt"}
          </span>
        </span>
        {(stuckCount ?? 0) > 0 && (
          <span style={{ fontSize: 13, color: "var(--destructive)" }}>
            {stuckCount} vastgelopen
          </span>
        )}
      </div>
    </div>
  )
}
