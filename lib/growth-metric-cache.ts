import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"

/**
 * Sync PostHog-sourced growth metrics into the metric_cache Supabase
 * table at FOUR granularities — day / week / month / year. Each
 * granularity is queried natively by PostHog so the resulting count
 * is the true unique-actor count for that bucket size (a visitor who
 * returns on 3 different days of March is 1 monthly unique here, not
 * 3 summed daily uniques).
 *
 * Used by:
 *   - /api/cron/sync-growth-metrics — nightly Vercel cron
 *   - syncGrowthMetricsAction       — manual "Sync" button on the
 *                                      Growth Model page
 *
 * Sync window per granularity:
 *   day   → rolling 30 days   (covers PostHog identity-merge tail)
 *   week  → rolling 6 weeks
 *   month → rolling 3 months
 *   year  → rolling 2 years
 * Older periods are effectively immutable. Empty cache for a metric
 * → one-shot 2-year backfill so every granularity is populated.
 *
 * Why each granularity has its own row instead of "store daily, sum
 * at read time": PostHog uniques don't sum. A user active on Mon+Tue
 * is 2 daily uniques but 1 weekly unique. Caching pre-aggregated
 * uniques per bucket is the only way to get correct numbers at any
 * view size without re-querying PostHog at read time.
 */

const POSTHOG_API_URL = "https://eu.posthog.com"
const POSTHOG_PROJECT_ID = "104218"

export type Granularity = "day" | "week" | "month" | "year"

const GRANULARITIES: Granularity[] = ["day", "week", "month", "year"]

/** Rolling re-fetch window per granularity. The cron re-fetches the
 *  last N periods every run; anything older is treated as immutable. */
const ROLLING_PERIODS: Record<Granularity, number> = {
  day: 30,
  week: 6,
  month: 3,
  year: 2,
}

/** First-time backfill — generous so every granularity has history. */
const BACKFILL_DAYS = 730 // 2 years

/** Metrics this cache covers. Add new keys here as you wire more
 *  PostHog-backed rows. Each key needs a HogQL branch in
 *  buildHogQLQuery below. */
export const CACHED_METRIC_KEYS = [
  // Visitors — bucketed unique person_ids on $pageview, with optional
  // URL predicate. client_visitors is the unfiltered total; the rest
  // are URL-filtered subsets used by the Dashboard funnel cards and
  // the Model's per-source breakdowns.
  //
  // Pro-side channel split (all subsets of pro_visitors):
  //   apollo_visitors    — /businesses/architects + ref=     (Outreach)
  //   showcase_visitors  — /businesses/architects + inviteEmail=
  //                                                          (Showcase /
  //                        prospect-* claim_url goes through this path)
  //   invite_visitors    — /businesses/professionals + inviteEmail=
  //                                                          (Invite series
  //                        new-professional-* claim_url)
  // Sales attribution = apollo_visitors + showcase_visitors (Sales =
  // Outreach + Showcase). Keeping the two as separate cache keys means
  // both the channel breakdown and the Sales aggregate stay accurate.
  "client_visitors",
  "pro_visitors",
  "apollo_visitors",
  "showcase_visitors",
  "invite_visitors",
  // Share-driven traffic — recipients arriving via a tagged share URL
  // (utm_source=share). The share-modal stamps these on every share
  // before the URL leaves the user's hand, so the recipient's
  // pageview carries the UTM regardless of which messenger / mail
  // client / mobile app delivered it. Pairs with the existing
  // `sharers` metric to compute a WOM-loop K-factor.
  "client_visitors_share",
  // Arco-email-driven traffic. Each Arco email tags its CTAs with
  // utm_source=arco_<audience>&utm_medium=email&utm_campaign=<template>;
  // these cache keys then filter pageviews by audience.
  //   - pro_visitors_email    transactional emails to pros (project-live,
  //                            team-invite, domain-verification, etc.)
  //                            Excludes Sales (already in apollo/showcase)
  //                            and Invites (already in invite_visitors).
  //   - client_visitors_email Lifecycle / marketing emails to clients,
  //                            combined with webmail-referrer matches so
  //                            "Email" on the client side covers both
  //                            Arco-sent emails AND other webmail clicks.
  "pro_visitors_email",
  // Pro-side channel breakdowns. Same source-category predicates as
  // their client counterparts but path-restricted to /businesses/* so
  // they sum consistently into the parent pro_visitors total. The
  // Share key uses utm_source=share rather than a referring-domain
  // category, since shares can travel via any channel.
  "pro_visitors_direct",
  "pro_visitors_google",
  "pro_visitors_social",
  "pro_visitors_referral",
  "pro_visitors_share",
  // Sales / Invites first-touch — keyed on PostHog Custom Channel
  // Types ($initial_channel_type). Replaces the prior Supabase-sourced
  // Sales/Invites counts in the Pro visitors row so the 8 channel subs
  // sum to the parent total by construction.
  "pro_visitors_sales",
  "pro_visitors_invites",
  // New-pro signups attributed by FIRST-TOUCH channel, mirroring the
  // pro_visitors subs. Used both as standalone counts under the New
  // Pros row and as CR numerators under each Pro visitor sub
  // (visitors-from-X → new-pros-from-X). Identifies "pro signup"
  // via person.properties.user_types LIKE '%professional%', so
  // dual-role users count here as long as they have professional set.
  "new_pros_sales",
  "new_pros_invites",
  "new_pros_email",
  "new_pros_direct",
  "new_pros_google",
  "new_pros_social",
  "new_pros_referral",
  "new_pros_share",
  // Engagement — unique person_ids on the named custom event.
  "sharers",
  "contacters",
  "responders",
  // Share counts — total events fired (not unique users). Combined
  // with `sharers` at read time to derive shares-per-client.
  "project_shares",
  "professional_shares",
  // Visitor source breakdowns — same definition as client_visitors
  // but filtered by per-pageview $referring_domain bucketed into the
  // five canonical channels (Direct / Organic search / Social /
  // Email / Referral). Powers the Model's source sub-rows and the
  // Dashboard's "Top sources" card.
  "client_visitors_direct",
  "client_visitors_google",
  "client_visitors_social",
  "client_visitors_email",
  "client_visitors_referral",
  // Total client signups — unique persons with user_signed_up event
  // and event-level user_type='client'. Sourced from PostHog (not
  // Supabase) so the parent Signups row reconciles exactly with its
  // channel breakdown, which is the same query split by referrer.
  "client_signups",
  // Signup source breakdowns — user_signed_up events filtered by
  // person.properties.$initial_referring_domain (first-touch
  // attribution preserved by PostHog). Numerator for the Model's
  // per-source CR rows.
  "client_signups_direct",
  "client_signups_google",
  "client_signups_social",
  "client_signups_email",
  "client_signups_referral",
  // Share-driven signups — first-touch came via a tagged share URL.
  // PostHog persists $initial_utm_source on the person record at
  // first identify, so even if the user comes back days later via a
  // different channel to actually sign up, attribution sticks with
  // the original share.
  "client_signups_share",
] as const
export type CachedMetricKey = (typeof CACHED_METRIC_KEYS)[number]

export type SyncResult = {
  metric: CachedMetricKey
  granularity: Granularity
  windowPeriods: number
  upserted: number
  error?: string
}

/** Run the sync for every (metric, granularity) pair. Granularities
 *  within a metric run in parallel (4-way) for speed; metrics still
 *  run serially to keep total PostHog request concurrency bounded
 *  (4 in flight at any moment, not 36). Errors are captured per-pair;
 *  the function never throws so one PostHog failure doesn't block
 *  the rest. */
export async function syncAllCachedMetrics(
  supabase: SupabaseClient,
): Promise<SyncResult[]> {
  const all: SyncResult[] = []
  for (const metric of CACHED_METRIC_KEYS) {
    const perGranularity = await Promise.all(
      GRANULARITIES.map(async (granularity) => {
        try {
          return await syncMetric(supabase, metric, granularity)
        } catch (err) {
          logger.error("growth-metric-cache: sync threw", { metric, granularity, error: String(err) })
          return { metric, granularity, windowPeriods: 0, upserted: 0, error: String(err) } as SyncResult
        }
      }),
    )
    all.push(...perGranularity)
  }
  return all
}

async function syncMetric(
  supabase: SupabaseClient,
  metric: CachedMetricKey,
  granularity: Granularity,
): Promise<SyncResult> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY
  if (!apiKey) {
    return { metric, granularity, windowPeriods: 0, upserted: 0, error: "POSTHOG_PERSONAL_API_KEY not set" }
  }

  // Empty cache for this (metric, granularity) → one-shot 2-year
  // backfill. We probe by counting rows in the last 2 buffer periods
  // so a single dropped cron doesn't accidentally retrigger backfill.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase as any)
    .from("metric_cache")
    .select("metric_key", { count: "exact", head: true })
    .eq("metric_key", metric)
    .eq("granularity", granularity)
  const hasData = (count ?? 0) > 0
  const lookbackDays = hasData ? rollingWindowDays(granularity) : BACKFILL_DAYS
  const windowPeriods = hasData ? ROLLING_PERIODS[granularity] : Math.ceil(BACKFILL_DAYS / approxDaysPerPeriod(granularity))

  const rows = await queryPostHogPeriodicValues(apiKey, metric, granularity, lookbackDays)
  if (rows.length === 0) {
    return { metric, granularity, windowPeriods, upserted: 0 }
  }

  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("metric_cache")
    .upsert(
      rows.map((r) => ({
        metric_key: metric,
        granularity,
        period_start: r.periodStart,
        value: r.value,
        synced_at: now,
      })),
      { onConflict: "metric_key,granularity,period_start" },
    )
  if (error) {
    return { metric, granularity, windowPeriods, upserted: 0, error: error.message }
  }
  return { metric, granularity, windowPeriods, upserted: rows.length }
}

function rollingWindowDays(granularity: Granularity): number {
  return ROLLING_PERIODS[granularity] * approxDaysPerPeriod(granularity)
}

function approxDaysPerPeriod(granularity: Granularity): number {
  switch (granularity) {
    case "day": return 1
    case "week": return 7
    case "month": return 31
    case "year": return 366
  }
}

/**
 * HogQL: bucketed uniques per period for the requested metric +
 * granularity. The bucket-start function is chosen so the cache rows
 * align with calendar boundaries (Monday for weeks; first-of-month;
 * Jan 1 for years) — same anchoring the Dashboard's bucketKey helper
 * uses, so reads line up bucket-for-bucket.
 */
async function queryPostHogPeriodicValues(
  apiKey: string,
  metric: CachedMetricKey,
  granularity: Granularity,
  lookbackDays: number,
): Promise<Array<{ periodStart: string; value: number }>> {
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
  const sinceIso = since.toISOString().slice(0, 10)

  const bucketFn: Record<Granularity, string> = {
    day: "toStartOfDay(timestamp)",
    // Mode 1 = Monday-anchored ISO week. PostHog/ClickHouse default
    // is Sunday-anchored which would drift labels by 1 day.
    week: "toStartOfWeek(timestamp, 1)",
    month: "toStartOfMonth(timestamp)",
    year: "toStartOfYear(timestamp)",
  }

  const query = buildHogQLQuery(metric, bucketFn[granularity], sinceIso)
  const res = await fetch(`${POSTHOG_API_URL}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    logger.error("growth-metric-cache: posthog query failed", { metric, granularity, status: res.status, body })
    return []
  }
  const data = await res.json()
  const rows: Array<[string, number]> = data.results ?? []
  return rows
    .map(([periodStr, value]) => ({ periodStart: periodStr.slice(0, 10), value: Number(value) || 0 }))
    .filter((r) => r.periodStart.length === 10)
}

// Internal-team filter — strip @arcolist.com sessions from every
// query so planning numbers reflect real user activity. PostHog's
// "Web Analytics" surface uses the same exclusion via project
// settings, so the two should agree (modulo identity-merge lag).
const NOT_INTERNAL_TEAM = `(person.properties.email IS NULL OR person.properties.email NOT ILIKE '%@arcolist.com%')`

// Self-referral filter — exclude pageviews whose referring domain is
// one of our own surfaces. Internal navigation (clicking around on
// arcolist.com) shows up in PostHog's Referrers panel as visits from
// www.arcolist.com, inflating "referrers". Dev/preview traffic
// (localhost, *.vercel.app, vercel.com) is even noisier — every
// developer / preview deploy creates new anonymous persons. Applied
// as a base filter on every visitor query so the same exclusion runs
// across client_visitors, pro_visitors, and all channel subs.
//
// Direct visits ($referring_domain IS NULL / '$direct') are NOT
// excluded — they have no referrer to filter on.
const NOT_SELF_REFERRAL = `(properties.$referring_domain IS NULL OR (
  properties.$referring_domain NOT ILIKE '%arcolist.com%'
  AND properties.$referring_domain NOT ILIKE '%localhost%'
  AND properties.$referring_domain NOT ILIKE '%vercel.app%'
  AND properties.$referring_domain NOT ILIKE '%vercel.com%'
  AND properties.$referring_domain NOT ILIKE '%github.com%'
))`

// Source categorisation — mirrors the groupSources() logic the
// Dashboard route previously used at read time. Each channel is a
// HogQL predicate fragment; pageviews and signups share this map by
// substituting the property path (per-event $referring_domain vs
// person-level $initial_referring_domain). accounts.google.com is
// excluded everywhere because it's the OAuth callback host — those
// visitors aren't from Google search, they're mid-login.
const SOURCE_CATEGORIES = ["direct", "google", "social", "email", "referral"] as const
type SourceCategory = (typeof SOURCE_CATEGORIES)[number]
function sourceCategoryPredicate(category: SourceCategory, refPath: string): string {
  // The five categories cover the four "named" sources plus a catch-all
  // Referral bucket. Order matters: Referral is the negative complement
  // of all the others, so it has to know what the others matched.
  const isDirect = `${refPath} IS NULL OR ${refPath} = '' OR ${refPath} = '$direct'`
  const isGoogle = `(${refPath} ILIKE '%google.%' OR ${refPath} ILIKE '%bing.%' OR ${refPath} ILIKE '%duckduckgo.%' OR ${refPath} ILIKE '%ecosia.%' OR ${refPath} ILIKE '%yahoo.%' OR ${refPath} ILIKE '%brave.%' OR ${refPath} ILIKE '%qwant.%' OR ${refPath} ILIKE '%startpage.%') AND ${refPath} NOT ILIKE '%accounts.google.com%'`
  const isSocial = `${refPath} ILIKE '%linkedin.%' OR ${refPath} ILIKE '%facebook.%' OR ${refPath} ILIKE '%instagram.%' OR ${refPath} ILIKE '%twitter.%' OR ${refPath} ILIKE '%x.com%' OR ${refPath} ILIKE '%pinterest.%'`
  const isEmail = `${refPath} ILIKE '%mail.%' OR ${refPath} ILIKE '%outlook.%'`
  // Anything that isn't direct / google / social / email and isn't on
  // the skip list ends up in Referral. accounts.google.com is in the
  // skip list because of the OAuth-callback note above; localhost/
  // vercel.app/vercel.com/github.com are dev/preview/PR noise;
  // arcolist.com is self-referral from internal navigation.
  const skipList = `${refPath} NOT ILIKE '%localhost%' AND ${refPath} NOT ILIKE '%vercel.app%' AND ${refPath} NOT ILIKE '%vercel.com%' AND ${refPath} NOT ILIKE '%accounts.google.com%' AND ${refPath} NOT ILIKE '%arcolist.com%' AND ${refPath} NOT ILIKE '%github.com%'`
  switch (category) {
    case "direct": return `(${isDirect})`
    case "google": return `(${isGoogle})`
    case "social": return `(${isSocial})`
    case "email": return `(${isEmail})`
    case "referral":
      return `(${refPath} IS NOT NULL AND ${refPath} != '' AND ${refPath} != '$direct' AND NOT (${isGoogle}) AND NOT (${isSocial}) AND NOT (${isEmail}) AND ${skipList})`
  }
}

function buildHogQLQuery(metric: CachedMetricKey, bucketExpr: string, sinceIso: string): string {
  // Visitors: $pageview with optional URL predicate, unique person_id.
  // The 4 visitor metrics differ only in their URL filter — keep them
  // as separate switch cases so future per-metric tweaks (e.g. excluding
  // /admin pages from client_visitors) don't fan out into all four.
  switch (metric) {
    case "client_visitors":
      // Unfiltered — matches PostHog Web Analytics' "Unique visitors".
      return uniqueVisitorsQuery(bucketExpr, sinceIso, "1 = 1")
    case "pro_visitors":
      // Visits to the architect-recruitment landing pages.
      return uniqueVisitorsQuery(bucketExpr, sinceIso, `properties.$current_url ILIKE '%/businesses%'`)
    case "apollo_visitors":
      // Pro pages reached via Apollo Outreach link (?ref= present).
      // Path is /businesses/architects since the Outreach CTA points
      // architects to the recruitment landing.
      return uniqueVisitorsQuery(
        bucketExpr,
        sinceIso,
        `properties.$current_url ILIKE '%/businesses/architects%' AND properties.$current_url ILIKE '%ref=%'`,
      )
    case "showcase_visitors":
      // Pro pages reached via Showcase (prospect-*) claim_url. Same
      // /businesses/architects path as Outreach but uses inviteEmail=
      // as its identifying param. Path distinguishes it from the
      // Invite series, which goes to /businesses/professionals.
      return uniqueVisitorsQuery(
        bucketExpr,
        sinceIso,
        `properties.$current_url ILIKE '%/businesses/architects%' AND properties.$current_url ILIKE '%inviteEmail=%'`,
      )
    case "invite_visitors":
      // Pro pages reached via professional-invite (new-professional-*)
      // claim_url. /businesses/professionals path distinguishes from
      // Showcase, which shares the inviteEmail= param but lives at
      // /businesses/architects.
      return uniqueVisitorsQuery(
        bucketExpr,
        sinceIso,
        `properties.$current_url ILIKE '%/businesses/professionals%' AND properties.$current_url ILIKE '%inviteEmail=%'`,
      )
    case "client_visitors_share":
      return firstTouchChannelQuery(bucketExpr, sinceIso, `= 'share'`)
    // All 8 pro_visitors channel subs use first-touch attribution via
    // session.$channel_type (re-evaluated at query time against the
    // current PostHog Custom Channel Type rules). Each person gets
    // exactly one first-touch channel, so the 8 subs partition the
    // parent pro_visitors set and sum to it by construction.
    // /businesses URL filter keeps the scope identical to parent.
    case "pro_visitors_sales":
      return firstTouchChannelQuery(bucketExpr, sinceIso, `= 'sales'`, `properties.$current_url ILIKE '%/businesses%'`)
    case "pro_visitors_invites":
      return firstTouchChannelQuery(bucketExpr, sinceIso, `= 'invites'`, `properties.$current_url ILIKE '%/businesses%'`)
    case "pro_visitors_email":
      return firstTouchChannelQuery(bucketExpr, sinceIso, `= 'email'`, `properties.$current_url ILIKE '%/businesses%'`)
    case "pro_visitors_direct":
      return firstTouchChannelQuery(bucketExpr, sinceIso, `= 'direct'`, `properties.$current_url ILIKE '%/businesses%'`)
    case "pro_visitors_google":
      return firstTouchChannelQuery(bucketExpr, sinceIso, `= 'google'`, `properties.$current_url ILIKE '%/businesses%'`)
    case "pro_visitors_social":
      return firstTouchChannelQuery(bucketExpr, sinceIso, `= 'social'`, `properties.$current_url ILIKE '%/businesses%'`)
    case "pro_visitors_share":
      return firstTouchChannelQuery(bucketExpr, sinceIso, `= 'share'`, `properties.$current_url ILIKE '%/businesses%'`)
    case "pro_visitors_referral":
      return firstTouchChannelQuery(bucketExpr, sinceIso, `= 'referral'`, `properties.$current_url ILIKE '%/businesses%'`)

    // New-pro signups by first-touch channel — mirrors the pro_visitors
    // subs. Numerator for the Pro visitors per-source CR rows
    // (visitors-from-X → new-pros-from-X).
    case "new_pros_sales":
      // First touched a Sales landing — Outreach (?ref=) or Showcase
      // (?inviteEmail= on /businesses/architects).
      return proSignupQuery(
        bucketExpr,
        sinceIso,
        `person.properties.$initial_current_url ILIKE '%/businesses/architects%' AND (person.properties.$initial_current_url ILIKE '%ref=%' OR person.properties.$initial_current_url ILIKE '%inviteEmail=%')`,
      )
    case "new_pros_invites":
      // First touched a project-invite landing.
      return proSignupQuery(
        bucketExpr,
        sinceIso,
        `person.properties.$initial_current_url ILIKE '%/businesses/professionals%' AND person.properties.$initial_current_url ILIKE '%inviteEmail=%'`,
      )
    case "new_pros_email":
      // First touched an Arco pro transactional email (project-live,
      // team-invite, etc.) — tagged utm_source=arco_pro&utm_medium=email.
      return proSignupQuery(
        bucketExpr,
        sinceIso,
        `person.properties.$initial_utm_source = 'arco_pro' AND person.properties.$initial_utm_medium = 'email'`,
      )
    case "new_pros_direct":
      return proSignupQuery(bucketExpr, sinceIso, sourceCategoryPredicate("direct", "person.properties.$initial_referring_domain"))
    case "new_pros_google":
      return proSignupQuery(bucketExpr, sinceIso, sourceCategoryPredicate("google", "person.properties.$initial_referring_domain"))
    case "new_pros_social":
      return proSignupQuery(bucketExpr, sinceIso, sourceCategoryPredicate("social", "person.properties.$initial_referring_domain"))
    case "new_pros_referral":
      return proSignupQuery(bucketExpr, sinceIso, sourceCategoryPredicate("referral", "person.properties.$initial_referring_domain"))
    case "new_pros_share":
      // First touched a tagged share URL.
      return proSignupQuery(
        bucketExpr,
        sinceIso,
        `person.properties.$initial_utm_source = 'share'`,
      )

    // Engagement — unique person_ids per period for a custom event.
    case "sharers":
      return uniqueActorsQuery(bucketExpr, sinceIso, `event IN ('project_shared', 'professional_shared')`)
    case "contacters":
      return uniqueActorsQuery(bucketExpr, sinceIso, `event = 'professional_contacted'`)
    case "responders":
      // lead_responded isn't wired in product yet — query returns 0
      // until trackLeadResponded starts firing. Scaffolded so the
      // cache is ready when the event lands.
      return uniqueActorsQuery(bucketExpr, sinceIso, `event = 'lead_responded'`)

    // Share counts — total event fires (not unique users). Combined
    // with the `sharers` cache at read time to derive shares-per-client.
    case "project_shares":
      return totalEventsQuery(bucketExpr, sinceIso, `event = 'project_shared'`)
    case "professional_shares":
      return totalEventsQuery(bucketExpr, sinceIso, `event = 'professional_shared'`)

    // Client visitor channel subs — same shape as the pro_visitors
    // ones above but without the /businesses URL filter. First-touch
    // session.$channel_type evaluated at query time, so the 6 subs
    // partition the parent client_visitors set. Sales / Invites are
    // pro-side channels — persons first-touched there don't appear in
    // any client-visitor sub (kept out of the catch-all Referral too).
    case "client_visitors_direct":
      return firstTouchChannelQuery(bucketExpr, sinceIso, `= 'direct'`)
    case "client_visitors_google":
      return firstTouchChannelQuery(bucketExpr, sinceIso, `= 'google'`)
    case "client_visitors_social":
      return firstTouchChannelQuery(bucketExpr, sinceIso, `= 'social'`)
    case "client_visitors_email":
      return firstTouchChannelQuery(bucketExpr, sinceIso, `= 'email'`)
    case "client_visitors_referral":
      return firstTouchChannelQuery(bucketExpr, sinceIso, `= 'referral'`)

    // Signup source breakdowns — user_signed_up events grouped by the
    // signing-up user's *first-touch* referring domain. PostHog stamps
    // this as person.properties.$initial_referring_domain when the
    // anonymous session is first seen, so even if the user comes back
    // from a different source to actually sign up, attribution sticks
    // with the original visit. This is what makes per-source CR
    // meaningful — we're comparing "visits from X" to "signups whose
    // first touch was X."
    // user_type filter: the user_signed_up event carries the user
    // type at signup time as properties.user_type ('client' |
    // 'professional'). Without this filter, the channel subs would
    // also count pro signups attributed to that channel, pushing
    // sub totals OVER the parent Signups row (which only counts
    // client profiles in Supabase). Event-level filter beats
    // person.properties.user_types LIKE '%client%' here because the
    // event is immutable — the person record can change later if a
    // user becomes dual-role.
    case "client_signups":
      // Parent total — sums to the 5 mutually-exclusive source
      // categories below (Direct/SEO/Social/Email/Referral). Shares
      // overlaps the channel buckets so it isn't part of the sum.
      return uniqueActorsQuery(bucketExpr, sinceIso, `event = 'user_signed_up' AND properties.user_type = 'client'`)
    case "client_signups_direct":
      return uniqueActorsQuery(bucketExpr, sinceIso, `event = 'user_signed_up' AND properties.user_type = 'client' AND ${sourceCategoryPredicate("direct", "person.properties.$initial_referring_domain")}`)
    case "client_signups_google":
      return uniqueActorsQuery(bucketExpr, sinceIso, `event = 'user_signed_up' AND properties.user_type = 'client' AND ${sourceCategoryPredicate("google", "person.properties.$initial_referring_domain")}`)
    case "client_signups_social":
      return uniqueActorsQuery(bucketExpr, sinceIso, `event = 'user_signed_up' AND properties.user_type = 'client' AND ${sourceCategoryPredicate("social", "person.properties.$initial_referring_domain")}`)
    case "client_signups_email":
      return uniqueActorsQuery(bucketExpr, sinceIso, `event = 'user_signed_up' AND properties.user_type = 'client' AND ${sourceCategoryPredicate("email", "person.properties.$initial_referring_domain")}`)
    case "client_signups_referral":
      return uniqueActorsQuery(bucketExpr, sinceIso, `event = 'user_signed_up' AND properties.user_type = 'client' AND ${sourceCategoryPredicate("referral", "person.properties.$initial_referring_domain")}`)
    case "client_signups_share":
      // First-touch utm_source on the person record. Captures
      // signups whose first session arrived via a tagged share URL,
      // even if they signed up much later from a different source.
      return uniqueActorsQuery(
        bucketExpr,
        sinceIso,
        `event = 'user_signed_up' AND properties.user_type = 'client' AND person.properties.$initial_utm_source = 'share'`,
      )

    default: {
      const _exhaustive: never = metric
      throw new Error(`Unhandled cached metric: ${_exhaustive}`)
    }
  }
}

function uniqueVisitorsQuery(bucketExpr: string, sinceIso: string, urlPredicate: string): string {
  return `
    SELECT toString(${bucketExpr}) AS period,
           count(DISTINCT person_id) AS value
    FROM events
    WHERE event = '$pageview'
      AND timestamp >= toDateTime('${sinceIso}')
      AND (${urlPredicate})
      AND ${NOT_INTERNAL_TEAM}
      AND ${NOT_SELF_REFERRAL}
    GROUP BY period
    ORDER BY period
  `
}

function uniqueActorsQuery(bucketExpr: string, sinceIso: string, eventPredicate: string): string {
  return `
    SELECT toString(${bucketExpr}) AS period,
           count(DISTINCT person_id) AS value
    FROM events
    WHERE ${eventPredicate}
      AND timestamp >= toDateTime('${sinceIso}')
      AND ${NOT_INTERNAL_TEAM}
    GROUP BY period
    ORDER BY period
  `
}

/**
 * First-touch channel categorization in HogQL. Mirrors `categorizeFirstTouch`
 * in lib/source-attribution.ts so capture-time and read-time agree on
 * how a person is bucketed. Reads:
 *   - person.properties.$initial_current_url     (Sales / Invites paths)
 *   - person.properties.$initial_utm_source      (Share / Arco emails)
 *   - person.properties.$initial_referring_domain (search / social / referral)
 *
 * PostHog stamps these at first identify and they're stable across
 * sessions, so historical attribution works without depending on
 * Custom Channel Type rules being applied retroactively (which we
 * verified PostHog does NOT do for our project).
 *
 * Precedence (higher → lower):
 *   share > sales > invites > email > direct > google > social > referral
 * Same as the TS helper so capture/backfill agree on edge cases.
 */
const FIRST_TOUCH_CHANNEL_EXPR = `
  multiIf(
    person.properties.$initial_utm_source = 'share', 'share',
    person.properties.$initial_current_url ILIKE '%/businesses/architects%'
      AND (person.properties.$initial_current_url ILIKE '%ref=%' OR person.properties.$initial_current_url ILIKE '%inviteEmail=%'), 'sales',
    person.properties.$initial_current_url ILIKE '%/businesses/professionals%'
      AND person.properties.$initial_current_url ILIKE '%inviteEmail=%', 'invites',
    person.properties.$initial_utm_source ILIKE 'arco_%'
      OR person.properties.$initial_referring_domain ILIKE '%mail.%'
      OR person.properties.$initial_referring_domain ILIKE '%outlook.%', 'email',
    person.properties.$initial_referring_domain IS NULL
      OR person.properties.$initial_referring_domain = ''
      OR person.properties.$initial_referring_domain = '$direct', 'direct',
    person.properties.$initial_referring_domain ILIKE '%google.%'
      OR person.properties.$initial_referring_domain ILIKE '%bing.%'
      OR person.properties.$initial_referring_domain ILIKE '%duckduckgo.%'
      OR person.properties.$initial_referring_domain ILIKE '%yahoo.%'
      OR person.properties.$initial_referring_domain ILIKE '%ecosia.%'
      OR person.properties.$initial_referring_domain ILIKE '%brave.%'
      OR person.properties.$initial_referring_domain ILIKE '%qwant.%'
      OR person.properties.$initial_referring_domain ILIKE '%startpage.%', 'google',
    person.properties.$initial_referring_domain ILIKE '%linkedin.%'
      OR person.properties.$initial_referring_domain ILIKE '%facebook.%'
      OR person.properties.$initial_referring_domain ILIKE '%instagram.%'
      OR person.properties.$initial_referring_domain ILIKE '%twitter.%'
      OR person.properties.$initial_referring_domain ILIKE '%x.com%'
      OR person.properties.$initial_referring_domain ILIKE '%pinterest.%', 'social',
    'referral'
  )
`

function firstTouchChannelQuery(
  bucketExpr: string,
  sinceIso: string,
  channelPredicate: string,
  extraPredicate?: string,
): string {
  const extra = extraPredicate ? `AND (${extraPredicate})` : ""
  return `
    SELECT toString(${bucketExpr}) AS period,
           count(DISTINCT person_id) AS value
    FROM events
    WHERE event = '$pageview'
      AND timestamp >= toDateTime('${sinceIso}')
      AND (${FIRST_TOUCH_CHANNEL_EXPR}) ${channelPredicate}
      ${extra}
      AND ${NOT_INTERNAL_TEAM}
      AND ${NOT_SELF_REFERRAL}
    GROUP BY period
    ORDER BY period
  `
}

function totalEventsQuery(bucketExpr: string, sinceIso: string, eventPredicate: string): string {
  return `
    SELECT toString(${bucketExpr}) AS period,
           count() AS value
    FROM events
    WHERE ${eventPredicate}
      AND timestamp >= toDateTime('${sinceIso}')
      AND ${NOT_INTERNAL_TEAM}
    GROUP BY period
    ORDER BY period
  `
}

/** Pro signup query keyed on a first-touch predicate. Counts distinct
 *  person_ids that fired user_signed_up with user_types containing
 *  'professional', filtered by the channel they originally arrived
 *  on (PostHog stamps $initial_* person properties at first identify
 *  and locks them, so attribution follows the user even if they
 *  return weeks later from a different source). */
function proSignupQuery(bucketExpr: string, sinceIso: string, firstTouchPredicate: string): string {
  return `
    SELECT toString(${bucketExpr}) AS period,
           count(DISTINCT person_id) AS value
    FROM events
    WHERE event = 'user_signed_up'
      AND timestamp >= toDateTime('${sinceIso}')
      AND person.properties.user_types LIKE '%professional%'
      AND (${firstTouchPredicate})
      AND ${NOT_INTERNAL_TEAM}
    GROUP BY period
    ORDER BY period
  `
}

/**
 * Read cached values for a metric at the requested granularity.
 * Returns a Map keyed by ISO period_start (YYYY-MM-DD). Caller
 * indexes into the map using bucket boundaries from its own view
 * (e.g. monthly buckets for the Growth Model page).
 */
export async function loadCachedMetric(
  supabase: SupabaseClient,
  metric: CachedMetricKey,
  granularity: Granularity,
  fromPeriod: string,
): Promise<Map<string, number>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("metric_cache")
    .select("period_start, value")
    .eq("metric_key", metric)
    .eq("granularity", granularity)
    .gte("period_start", fromPeriod)
  if (error) {
    logger.warn("growth-metric-cache: load failed", { metric, granularity, error: error.message })
    return new Map()
  }
  const map = new Map<string, number>()
  for (const row of (data ?? []) as Array<{ period_start: string; value: number }>) {
    map.set(row.period_start, Number(row.value) || 0)
  }
  return map
}

/** Last sync timestamp across all (metric, granularity) pairs.
 *  Surfaced in the Growth Model header for staleness display. */
export async function lastSyncedAt(supabase: SupabaseClient): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("metric_cache")
    .select("synced_at")
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as { synced_at: string } | null)?.synced_at ?? null
}
