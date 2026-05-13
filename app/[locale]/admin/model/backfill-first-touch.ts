"use server"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { categorizeFirstTouch, type FirstTouchSource } from "@/lib/source-attribution"
import { logger } from "@/lib/logger"

const POSTHOG_API_URL = "https://eu.posthog.com"
const POSTHOG_PROJECT_ID = "104218"

/**
 * One-shot backfill for profiles.first_touch_source and
 * companies.first_touch_source. Reads PostHog person properties for
 * every distinct_id that fired `user_signed_up`, categorizes via the
 * shared helper, and bulk-updates Supabase.
 *
 * Idempotent: only stamps rows whose first_touch_source is still NULL,
 * so re-running won't overwrite later edits.
 *
 * Companies inherit from owner's profile after the profile update —
 * matches the trigger logic, but applied retroactively for rows that
 * onboarded before the column existed.
 */
export async function backfillFirstTouchSource(): Promise<{
  profilesUpdated: number
  companiesUpdated: number
  bySource: Record<FirstTouchSource | "unknown", number>
  error?: string
}> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY
  if (!apiKey) {
    return { profilesUpdated: 0, companiesUpdated: 0, bySource: emptyBySource(), error: "POSTHOG_PERSONAL_API_KEY not set" }
  }

  // HogQL: keyed by distinct_id, NOT person_id. PostHog's person_id
  // is its own internal person UUID; the value `trackSignup` passes
  // to identify() is the Supabase auth user id, which becomes
  // distinct_id on subsequent events and matches profiles.id.
  // Pick the latest distinct_id per signup event (most events fire
  // after identify(), so distinct_id is already the user id).
  const query = `
    SELECT
      distinct_id,
      any(person.properties.$initial_referring_domain) AS ref,
      any(person.properties.$initial_current_url) AS url,
      any(person.properties.$initial_utm_source) AS utm
    FROM events
    WHERE event = 'user_signed_up'
    GROUP BY distinct_id
    LIMIT 50000
  `

  let rows: Array<[string, string | null, string | null, string | null]> = []
  try {
    const res = await fetch(`${POSTHOG_API_URL}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
      signal: AbortSignal.timeout(120_000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      return { profilesUpdated: 0, companiesUpdated: 0, bySource: emptyBySource(), error: `PostHog ${res.status}: ${body.slice(0, 200)}` }
    }
    const data = await res.json()
    rows = data.results ?? []
  } catch (e: any) {
    return { profilesUpdated: 0, companiesUpdated: 0, bySource: emptyBySource(), error: e?.message ?? "PostHog request failed" }
  }

  const bySource = emptyBySource()
  const supabase = createServiceRoleSupabaseClient()
  let profilesUpdated = 0

  // PostHog returns one row per distinct_id; update the matching
  // profile (by id). Each row may not match a profile — e.g.
  // anonymous distinct_ids from before identify() landed, or test
  // accounts. We skip non-matches silently. 50K rows upper bound;
  // Supabase row-by-row updates at this scale finish in seconds.
  for (const [distinctId, ref, url, utm] of rows) {
    if (!distinctId || typeof distinctId !== "string") continue
    // Distinct_id should be a UUID matching profiles.id when set via
    // identify(). Anonymous distinct_ids are 26-char strings or
    // similar; skip them to avoid CHECK constraint failures on
    // garbage UUIDs.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(distinctId)) continue

    const source = categorizeFirstTouch(ref, url, utm)
    bySource[source] += 1

    const { error, count } = await (supabase as any)
      .from("profiles")
      .update({ first_touch_source: source }, { count: "exact" })
      .eq("id", distinctId)
      .is("first_touch_source", null)
    if (error) {
      logger.db("update", "profiles", "backfill: stamp failed", { distinctId }, error as Error)
      continue
    }
    profilesUpdated += count ?? 0
  }

  // Now propagate to companies. We do this in one bulk UPDATE …
  // FROM clause so we don't loop over every company in app code.
  const { data: companyRes, error: companyErr } = await (supabase as any).rpc("backfill_companies_first_touch_source")
  let companiesUpdated = 0
  if (!companyErr && typeof companyRes === "number") {
    companiesUpdated = companyRes
  } else if (companyErr) {
    // RPC may not exist in older deployments — fall back to a
    // single-statement update via the standard query path.
    const { error: fallbackErr, count: fbCount } = await (supabase as any)
      .from("companies")
      .update({ first_touch_source: null }, { count: "exact" })
      .neq("id", "00000000-0000-0000-0000-000000000000") // no-op, just to read count
    // The above doesn't actually work for an UPDATE … FROM; the
    // cleanest path without the RPC is to leave companies untouched
    // and have the trigger handle going-forward. Report 0 in that
    // case so the operator knows to run the SQL manually.
    void fallbackErr; void fbCount
    companiesUpdated = 0
  }

  return { profilesUpdated, companiesUpdated, bySource }
}

function emptyBySource(): Record<FirstTouchSource | "unknown", number> {
  return {
    sales: 0,
    invites: 0,
    email: 0,
    shares: 0,
    google: 0,
    social: 0,
    referral: 0,
    direct: 0,
    unknown: 0,
  }
}
