"use server"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import {
  loadCachedMetric,
  type CachedMetricKey,
  type Granularity,
} from "@/lib/growth-metric-cache"

const POSTHOG_API_URL = "https://eu.posthog.com"
const POSTHOG_PROJECT_ID = "104218"

/**
 * Pull (person_id, day) pairs for `$pageview` events by logged-in users of
 * a given type, grouped to one row per person per day. Returns a map of
 * person_id → list of activity dates.
 *
 * Used as the source of truth for MAC / MAP / Re-engaged / Newly dormant.
 * Returns an empty map if POSTHOG_PERSONAL_API_KEY isn't set or the query
 * fails — caller surfaces this as zero counts (no Supabase fallback, since
 * mixing sources produces misleading numbers).
 *
 * Bot/test account filtering: excludes pageviews from emails ending in
 * @arcolist.com (internal team) so the row reflects real users only.
 * Anonymous visitors are already excluded by the user_types filter.
 */
async function fetchActivityEvents(lookbackStart: Date, userType: "client" | "professional"): Promise<Map<string, Date[]>> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY
  if (!apiKey) return new Map()

  const lookbackIso = lookbackStart.toISOString().slice(0, 19) // 'YYYY-MM-DDTHH:MM:SS'
  // userType is whitelisted (literal union type) so safe to interpolate
  const query = `
    SELECT person_id, toStartOfDay(timestamp) AS day
    FROM events
    WHERE event = '$pageview'
      AND timestamp >= toDateTime('${lookbackIso}')
      AND person.properties.user_types LIKE '%${userType}%'
      AND (person.properties.email IS NULL OR person.properties.email NOT ILIKE '%@arcolist.com%')
    GROUP BY person_id, day
  `

  try {
    const res = await fetch(`${POSTHOG_API_URL}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) {
      console.error("[growth-table] posthog client activity query failed", res.status, await res.text().catch(() => ""))
      return new Map()
    }
    const data = await res.json()
    const rows: Array<[string, string]> = data.results ?? []
    const byClient = new Map<string, Date[]>()
    for (const [personId, dayStr] of rows) {
      if (!personId || !dayStr) continue
      const d = new Date(dayStr)
      if (!byClient.has(personId)) byClient.set(personId, [])
      byClient.get(personId)!.push(d)
    }
    return byClient
  } catch (err) {
    console.error("[growth-table] posthog client activity query threw", err)
    return new Map()
  }
}

export type Timeframe = "days" | "weeks" | "months" | "years"

export type MetricSource = "posthog" | "supabase"

export type MetricRow = {
  key: string
  label: string
  definition?: string
  source?: MetricSource
  driver: "acquisition" | "retention" | "monetization" | "churn"
  total: number
  datapoints: number[] // 8 data points (7 completed + 1 rolling)
  labels: string[]     // 8 labels
  /** Optional self-contained CR rows rendered at the top of this row's
   *  expansion (above the subs). Unlike the auto-inline CR to the next
   *  funnel row, these declare their own label/numerator/denominator —
   *  used for parent→other-metric ratios like MAC → Sharers/Savers/Contacters. */
  extraCRs?: Array<{ label: string; numerator: number[]; denominator: number[] }>
  /** Optional numerator override for the auto-inline CR (parent → next
   *  funnel row). When present, the inline CR uses this series as the
   *  numerator instead of the next row's own datapoints. Used when the
   *  next row's count includes channels outside the parent's scope —
   *  e.g. pros_contacted → pro_visitors should only credit Sales /
   *  Invites visitors, not the full pro_visitors total which adds
   *  Direct / SEO / Social. Keeping the auto-inline CR (vs. an
   *  extraCRs entry) preserves the per-sub CR labels that read
   *  "to {next.label} from {sub.label}". */
  inlineCRNumerator?: { total: number; datapoints: number[] }
  subs: Array<{
    key: string
    label: string
    definition?: string
    source?: MetricSource
    total: number
    datapoints: number[]
    /** Optional numerator for an inline per-sub CR row in the Model
     *  view. When present, the model-client renders a "↳ X%" row
     *  underneath this sub using `total`/`datapoints` as the
     *  denominator. Today this carries source-attributed signups for
     *  the Visitors sources, but the shape is generic so other
     *  sections can opt in. */
    crNumerator?: { total: number; datapoints: number[] }
    /** Optional self-contained CR row rendered underneath this sub.
     *  Unlike `crNumerator` (which expresses "this sub → parent's
     *  next-funnel-step"), `customCR` declares its own label,
     *  numerator and denominator. Used for accounting ratios like
     *  % Retained / % Churn / % Re-activated under MAU, where the
     *  denominator isn't `datapoints` and the row isn't a funnel
     *  conversion. */
    customCR?: { label: string; numerator: number[]; denominator: number[] }
    /** Optional set of absolute-value rows rendered underneath this sub
     *  at CR-row size (10px). Each row carries its own label, per-bucket
     *  values and a tone — "muted" reads as grey, "accent" as teal. Use
     *  for supporting absolute metrics that aren't conversion rates
     *  (e.g. SEO impressions / clicks alongside CTR under Ranked pros). */
    valueRows?: Array<{ label: string; values: number[]; tone?: "muted" | "accent"; format?: "integer" | "percent" }>
  }>
}

const DAY_MS = 86400000
const WEEK_MS = 7 * DAY_MS

/** Get the start of 8 periods ago (7 completed + current rolling period) */
function getRange(tf: Timeframe): Date {
  const now = new Date()
  switch (tf) {
    case "days": return new Date(now.getTime() - 8 * DAY_MS)
    case "weeks": return new Date(now.getTime() - 8 * WEEK_MS)
    case "months": return new Date(now.getFullYear(), now.getMonth() - 8, now.getDate())
    case "years": return new Date(now.getFullYear() - 8, now.getMonth(), now.getDate())
  }
}

/** Snap a date to the Monday of its ISO 8601 week (00:00 local). */
function startOfIsoWeek(d: Date): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  // getDay(): Sun=0, Mon=1, ..., Sat=6. Map so Mon=0, Sun=6.
  const dow = (out.getDay() + 6) % 7
  out.setDate(out.getDate() - dow)
  return out
}

/** Get 8 bucket boundaries: 7 completed periods + 1 rolling (current) period */
function getBuckets(tf: Timeframe): { starts: Date[]; ends: Date[]; labels: string[] } {
  const now = new Date()
  const starts: Date[] = []
  const ends: Date[] = []
  const labels: string[] = []

  // For weeks, anchor every bucket to the Monday of the current ISO week
  // so the 8 buckets line up with calendar weeks instead of "now − 7×N days"
  // (which would shift labels to whatever day-of-week `now` happens to be).
  const currentMonday = tf === "weeks" ? startOfIsoWeek(now) : null

  for (let i = 0; i < 8; i++) {
    let start: Date, end: Date
    switch (tf) {
      case "days":
        start = new Date(now.getTime() - (7 - i) * DAY_MS)
        start.setHours(0, 0, 0, 0)
        end = new Date(start.getTime() + DAY_MS)
        labels.push(start.toLocaleDateString("en-US", { month: "short", day: "numeric" }))
        break
      case "weeks":
        start = new Date(currentMonday!.getTime() - (7 - i) * WEEK_MS)
        end = new Date(start.getTime() + WEEK_MS)
        labels.push(start.toLocaleDateString("en-US", { month: "short", day: "numeric" }))
        break
      case "months":
        start = new Date(now.getFullYear(), now.getMonth() - (7 - i), 1)
        end = new Date(now.getFullYear(), now.getMonth() - (7 - i) + 1, 1)
        labels.push(start.toLocaleDateString("en-US", { month: "short", year: "2-digit" }))
        break
      case "years":
        start = new Date(now.getFullYear() - (7 - i), 0, 1)
        end = new Date(now.getFullYear() - (7 - i) + 1, 0, 1)
        labels.push(start.getFullYear().toString())
        break
    }
    starts.push(start)
    ends.push(i === 7 ? now : end) // Last bucket ends at now (rolling)
  }

  return { starts, ends, labels }
}

function bucket8(dates: Date[], buckets: { starts: Date[]; ends: Date[] }): { datapoints: number[]; labels: string[] } {
  const datapoints = new Array(8).fill(0)
  for (let i = 0; i < 8; i++) {
    datapoints[i] = dates.filter((d) => d >= buckets.starts[i] && d < buckets.ends[i]).length
  }
  return { datapoints, labels: [] } // labels are set from getBuckets
}

export async function fetchMetricTable(timeframe: Timeframe = "months"): Promise<{ rows: MetricRow[]; labels: string[] }> {
  const supabase = createServiceRoleSupabaseClient()
  const from = getRange(timeframe)
  const buckets = getBuckets(timeframe)

  // Service categories whose pros can publish project portfolios. The
  // marketplace has many more service categories (contractors,
  // suppliers, etc.) but those don't publish — they get invited.
  // Stored as slugs to keep the source of truth in code; the
  // categories table provides UUIDs for primary_service_id lookups.
  const PUBLISHABLE_SERVICE_SLUGS = ["architect", "interior-designer", "photographer", "garden-designer"]

  const [
    profilesResult,
    companiesResult,
    projectsResult,
    invitesResult,
    savedProjectsResult,
    savedCompaniesResult,
    prospectsResult,
    publishableCategoriesResult,
  ] = await Promise.all([
    supabase.from("profiles").select("id, user_types, created_at, first_touch_source"),
    supabase.from("companies").select("id, status, plan_tier, created_at, updated_at, owner_id, seo_indexed, onboarded_at, listed_at, seo_indexed_at, first_touch_source, primary_service_id, seo_impressions_28d, seo_clicks_28d"),
    supabase.from("projects").select("id, status, client_id, created_at, updated_at, published_at, seo_indexed, seo_impressions_28d, seo_clicks_28d"),
    supabase.from("project_professionals").select("id, professional_id, company_id, is_project_owner, project_id, created_at, invited_email, invited_at, landing_visited_at"),
    supabase.from("saved_projects").select("user_id, project_id, created_at"),
    supabase.from("saved_companies").select("user_id, company_id, created_at"),
    supabase.from("prospects").select("id, email, company_id, apollo_contact_id"),
    supabase.from("categories").select("id, slug").in("slug", PUBLISHABLE_SERVICE_SLUGS),
  ])

  const profiles = (profilesResult.data ?? []) as any[]
  const companies = (companiesResult.data ?? []) as any[]
  const projects = (projectsResult.data ?? []) as any[]
  const invites = (invitesResult.data ?? []) as any[]
  const savedProjects = (savedProjectsResult.data ?? []) as any[]
  const savedCompanies = (savedCompaniesResult.data ?? []) as any[]
  const prospects = (prospectsResult.data ?? []) as any[]
  const publishableCategoryIds = new Set<string>(
    (publishableCategoriesResult.data ?? []).map((c: any) => c.id as string),
  )
  // Categories whose pros are excluded from the Invited Pros funnel.
  // Photographers tend to be hired contractors (commissioned to shoot
  // the project) rather than collaborators invited to contribute, so
  // counting them inflates the "invites" signal without reflecting
  // the network effect we're trying to measure.
  const EXCLUDE_FROM_INVITED_SLUGS = new Set(["photographer"])
  const excludedFromInvitedCategoryIds = new Set<string>(
    (publishableCategoriesResult.data ?? [])
      .filter((c: any) => EXCLUDE_FROM_INVITED_SLUGS.has(c.slug))
      .map((c: any) => c.id as string),
  )
  const excludedFromInvitedCompanyIds = new Set<string>(
    companies
      .filter((c: any) => c.primary_service_id && excludedFromInvitedCategoryIds.has(c.primary_service_id))
      .map((c: any) => c.id as string),
  )

  // Read every PostHog-sourced metric from the metric_cache at the
  // granularity matching the requested timeframe. PostHog uniques
  // don't sum, so we pull pre-aggregated bucket values rather than
  // summing daily rows. Empty cache → zero series (bootstrap signal
  // that someone needs to run the initial sync from /admin/model).
  const cacheGranularity: Granularity =
    timeframe === "days" ? "day"
    : timeframe === "weeks" ? "week"
    : timeframe === "years" ? "year"
    : "month"
  const cacheFromIso = from.toISOString().slice(0, 10)
  // Local-component key extraction so the lookup works even in non-UTC
  // dev environments (toISOString() would drift by ±1 day when local
  // midnight straddles UTC midnight).
  const periodKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

  // Fetch all cached metrics in parallel — small index lookups, ~30ms
  // total. Cheaper than serial chains, identical result shape.
  const CACHED_KEYS: CachedMetricKey[] = [
    "client_visitors",
    "pro_visitors",
    "client_signups_share",
    "client_visitors_share",
    "pro_visitors_email",
    "pro_visitors_direct",
    "pro_visitors_google",
    "pro_visitors_social",
    "pro_visitors_referral",
    "pro_visitors_share",
    "pro_visitors_sales",
    "pro_visitors_invites",
    "new_pros_sales",
    "new_pros_invites",
    "new_pros_email",
    "new_pros_direct",
    "new_pros_google",
    "new_pros_social",
    "new_pros_referral",
    "new_pros_share",
    "sharers",
    "project_shares",
    "professional_shares",
    "contacters",
    "responders",
    // Visitor source breakdowns
    "client_visitors_direct",
    "client_visitors_google",
    "client_visitors_social",
    "client_visitors_email",
    "client_visitors_referral",
    // Total client signups — PostHog-sourced parent that sums to the
    // 5 mutually-exclusive channel buckets below.
    "client_signups",
    // Signup source breakdowns — numerators for per-source CR rows
    "client_signups_direct",
    "client_signups_google",
    "client_signups_social",
    "client_signups_email",
    "client_signups_referral",
  ]
  const cacheMaps = await Promise.all(
    CACHED_KEYS.map((k) => loadCachedMetric(supabase, k, cacheGranularity, cacheFromIso)),
  )
  const cacheByKey: Record<CachedMetricKey, Map<string, number>> = Object.fromEntries(
    CACHED_KEYS.map((k, i) => [k, cacheMaps[i]]),
  ) as Record<CachedMetricKey, Map<string, number>>

  // Bucketize: cache key → 8-element series aligned to the table's
  // bucket starts. Sum is the "total" displayed alongside the series;
  // for unique metrics this overcounts cross-bucket returners (a
  // monthly-unique counted in Jan + Feb shows as 2 in the year total).
  // The Table view labels this column "Total" — acceptable as a
  // ballpark; when we add a window-grained cache row for the same
  // metric the total reads from that instead.
  const bucketize = (key: CachedMetricKey) => {
    const map = cacheByKey[key]
    const series = buckets.starts.map((start) => map.get(periodKey(start)) ?? 0)
    const total = series.reduce((a, b) => a + b, 0)
    return { series, total }
  }
  const clientVisitorsBucketed = bucketize("client_visitors")
  const proVisitorsBucketed = bucketize("pro_visitors")
  // Sales / Invite visitors are now sourced from Supabase server-side
  // logs (prospect_events for Sales, project_professionals.landing_visited_at
  // for Invites). The invite_visitors / apollo_visitors / showcase_visitors
  // cache keys are still maintained for the lifecycle dashboard but no
  // longer feed this table.
  // Sales visitors are now sourced from prospect_events (see
  // salesVisitorsSeriesDb below) — the previous PostHog apollo +
  // showcase pageview sum included link-scanner traffic and inflated
  // the count past the contacted denominator. The apollo_visitors /
  // showcase_visitors cache keys are still maintained for the
  // lifecycle dashboard but no longer feed this table.
  const sharersBucketed = bucketize("sharers")
  const projectSharesBucketed = bucketize("project_shares")
  const professionalSharesBucketed = bucketize("professional_shares")
  const contactersBucketed = bucketize("contacters")
  const respondersBucketed = bucketize("responders")
  // Visitor source breakdowns — first-class sub-rows under the
  // Visitors leading metric.
  const clientVisitorsDirectBucketed = bucketize("client_visitors_direct")
  const clientVisitorsGoogleBucketed = bucketize("client_visitors_google")
  const clientVisitorsSocialBucketed = bucketize("client_visitors_social")
  const clientVisitorsEmailBucketed = bucketize("client_visitors_email")
  const clientVisitorsReferralBucketed = bucketize("client_visitors_referral")
  // Share-driven traffic — visitors arriving via a tagged share URL.
  // Orthogonal to the Direct/Google/Social/Email/Referral split: a
  // share visit also has a referrer that lands in one of those, so
  // share counts overlap with the channel breakdown above. Surfaced
  // as a separate sub so the WOM-loop signal is visible alongside.
  const clientVisitorsShareBucketed = bucketize("client_visitors_share")
  // Arco-pro transactional email traffic (project-live, team-invite, etc.).
  // Tagged with utm_source=arco_pro&utm_medium=email by the renderer.
  // Excludes Sales/Invites (those tag as utm_source=arco — neutral —
  // and have their own path-based metrics).
  const proVisitorsEmailBucketed = bucketize("pro_visitors_email")
  // Pro referring-domain channel breakdowns + Share. All path-restricted
  // to /businesses/* so they sum into the parent pro_visitors total.
  const proVisitorsDirectBucketed = bucketize("pro_visitors_direct")
  const proVisitorsGoogleBucketed = bucketize("pro_visitors_google")
  const proVisitorsSocialBucketed = bucketize("pro_visitors_social")
  const proVisitorsReferralBucketed = bucketize("pro_visitors_referral")
  const proVisitorsShareBucketed = bucketize("pro_visitors_share")
  const proVisitorsSalesBucketed = bucketize("pro_visitors_sales")
  const proVisitorsInvitesBucketed = bucketize("pro_visitors_invites")
  // proVisitorsSalesBucketed / proVisitorsInvitesBucketed measure
  // FIRST-touch attribution — only count people whose very first
  // pageview was on a Sales/Invites URL. They're kept around for
  // reference but the Pro visitors row uses the server-side click
  // logs (Supabase prospect_events / project_professionals) instead,
  // since those count the more useful "did this pro click an
  // Outreach email" signal. See proVisitorsDirectAdjustedSeries below.
  // New-pro signups by first-touch channel. Numerators for Pro
  // visitors per-source CR rows and standalone subs under New Pros.
  const newProsSalesBucketed = bucketize("new_pros_sales")
  const newProsInvitesBucketed = bucketize("new_pros_invites")
  const newProsEmailBucketed = bucketize("new_pros_email")
  const newProsDirectBucketed = bucketize("new_pros_direct")
  const newProsGoogleBucketed = bucketize("new_pros_google")
  const newProsSocialBucketed = bucketize("new_pros_social")
  const newProsReferralBucketed = bucketize("new_pros_referral")
  const newProsShareBucketed = bucketize("new_pros_share")
  // Share-driven signups — first-touch utm_source=share on the
  // person record. Pairs with the Shares sub under client_visitors
  // to compute a share→signup conversion.
  const clientSignupsShareBucketed = bucketize("client_signups_share")
  // PostHog-sourced parent total — same query as the channel
  // breakdowns minus the source filter, so sum-of-channels ≡ parent
  // by construction.
  const clientSignupsBucketed = bucketize("client_signups")
  // Signup source breakdowns — used by the Model's per-source CR
  // rows (sub.attributedSignups → divided by sub.datapoints).
  const clientSignupsDirectBucketed = bucketize("client_signups_direct")
  const clientSignupsGoogleBucketed = bucketize("client_signups_google")
  const clientSignupsSocialBucketed = bucketize("client_signups_social")
  const clientSignupsEmailBucketed = bucketize("client_signups_email")
  const clientSignupsReferralBucketed = bucketize("client_signups_referral")
  // Shares-per-client = total shares ÷ unique sharers, one decimal.
  // Derived at read time from cached counts rather than cached as its
  // own metric — it's a ratio that can't be aggregated meaningfully
  // across granularities anyway.
  const sharesPerClientSeries = sharersBucketed.series.map((sharers, i) => {
    if (!sharers) return 0
    const totalShares = projectSharesBucketed.series[i] + professionalSharesBucketed.series[i]
    return Math.round((totalShares / sharers) * 10) / 10
  })
  const sharesPerClientTotal = sharersBucketed.total > 0
    ? Math.round(
        ((projectSharesBucketed.total + professionalSharesBucketed.total) / sharersBucketed.total) * 10,
      ) / 10
    : 0

  // Helper to filter and bucket by created_at
  const makeDates = (items: any[], filter?: (item: any) => boolean) =>
    (filter ? items.filter(filter) : items).map((i: any) => new Date(i.created_at)).filter((d: Date) => d >= from)

  // Helper to bucket by a named transition timestamp column. Use this
  // when you want the moment a specific transition happened —
  // onboarded_at, listed_at, seo_indexed_at, etc — so admin edits to
  // unrelated columns don't move the date. Stamped by DB triggers on
  // the actual transition; rows where the column is NULL are skipped.
  const makeDatesByColumn = (items: any[], col: string, filter?: (item: any) => boolean) =>
    (filter ? items.filter(filter) : items)
      .filter((i: any) => i[col] != null)
      .map((i: any) => new Date(i[col]))
      .filter((d: Date) => d >= from)

  // Backward-compatible shim — keep the old name for the onboarded_at
  // call sites we already migrated.
  const makeDatesByOnboarded = (items: any[], filter?: (item: any) => boolean) =>
    makeDatesByColumn(items, "onboarded_at", filter)

  // Generate labels from first bucket call
  const labels = buckets.labels

  // ── Professional metrics ──────────────────────────────────────────────

  const proSignupDates = makeDates(profiles, (p) => p.user_types?.includes("professional"))
  const proSignups = bucket8(proSignupDates, buckets)

  // Drafts = companies created in the period that have been claimed by a
  // real user (owner_id != null). Scraped/unclaimed companies (e.g. invited
  // contributors that haven't signed up yet) sit outside the funnel and
  // shouldn't inflate the draft count.
  const claimedCompanies = (c: any) => c.owner_id != null
  const draftDates = makeDates(companies, claimedCompanies)
  const drafts = bucket8(draftDates, buckets)

  // Listed Pros — cumulative snapshot at each bucket end. Counts pros
  // currently in 'listed' state whose listed_at falls on or before the
  // bucket boundary. Stable: a company that goes listed → unlisted →
  // listed again still has its original listed_at, and an admin edit
  // doesn't move the timestamp. The previous flow definition (newly
  // listed in this period) is gone — we report Listed Pros as a stock,
  // matching the Unlisted Pros sub directly underneath it.
  const listedSnapshotSeries = buckets.ends.map((bucketEnd) =>
    companies.filter((c: any) =>
      c.status === "listed"
      && claimedCompanies(c)
      && c.listed_at != null
      && new Date(c.listed_at) <= bucketEnd,
    ).length,
  )
  const totalListedSnapshot = listedSnapshotSeries[listedSnapshotSeries.length - 1] ?? 0

  // Publishable pros — same cumulative-listed snapshot, narrowed to
  // pros whose primary service can publish project portfolios
  // (Architect / Interior Designer / Photographer / Garden designer).
  // Other service categories (contractors, suppliers, etc.) get
  // invited to projects but don't publish their own. Denominator for
  // the "% Publishing" CR: of pros currently eligible to publish, how
  // many published at least one project in the period.
  const publishableProsSnapshotSeries = buckets.ends.map((bucketEnd) =>
    companies.filter((c: any) =>
      c.status === "listed"
      && claimedCompanies(c)
      && c.listed_at != null
      && publishableCategoryIds.has(c.primary_service_id)
      && new Date(c.listed_at) <= bucketEnd,
    ).length,
  )
  const totalPublishableProsSnapshot = publishableProsSnapshotSeries[publishableProsSnapshotSeries.length - 1] ?? 0

  // Current totals and bucketed data for supporting metrics
  const totalListed = companies.filter((c: any) => c.status === "listed").length
  const totalUnlisted = companies.filter((c: any) => c.status === "unlisted").length

  const allCompanyDates = makeDates(companies)
  const allCompanies = bucket8(allCompanyDates, buckets)

  const allProjectDates = makeDates(projects)
  const allProjects = bucket8(allProjectDates, buckets)

  // Current totals for supporting metrics
  const inProgressDates = makeDates(projects, (p) => p.status === "in_progress")
  const inProgress = bucket8(inProgressDates, buckets)

  const draftProjectDates = makeDates(projects, (p) => p.status === "draft")
  const draftProjects = bucket8(draftProjectDates, buckets)

  const totalInProgress = projects.filter((p: any) => p.status === "in_progress").length
  const totalDraftProjects = projects.filter((p: any) => p.status === "draft").length
  const totalPublished = projects.filter((p: any) => p.status === "published").length

  // ── Publishers: unique COMPANIES that own at least one published project in the period.
  //
  // The previous implementation used projects.client_id (the user who uploaded
  // the project) as the publisher key, which was wrong on two counts:
  //   1. It counted unique users, not unique companies — two team members
  //      from the same studio uploading one project each looked like 2 publishers.
  //   2. The "Publishers" bucket was actually counting individual published
  //      projects, not unique publishing companies.
  //
  // The owning company lives in project_professionals where is_project_owner = true.
  const projectIdToOwnerCompany = new Map<string, string>()
  for (const link of invites) {
    if (!link.is_project_owner || !link.project_id || !link.company_id) continue
    if (!projectIdToOwnerCompany.has(link.project_id)) {
      projectIdToOwnerCompany.set(link.project_id, link.company_id)
    }
  }

  // For each published project, derive (companyId, publishedAt) using the
  // published_at column stamped by migration 143's trigger. Rows with NULL
  // published_at — every project that was already published before the
  // migration — are intentionally skipped so the metric isn't polluted by
  // an updated_at proxy.
  type PublishedRow = { companyId: string; publishedAt: Date }
  const publishedRows: PublishedRow[] = []
  for (const p of projects) {
    if (p.status !== "published") continue
    const companyId = projectIdToOwnerCompany.get(p.id)
    if (!companyId) continue
    if (!p.published_at) continue
    publishedRows.push({ companyId, publishedAt: new Date(p.published_at) })
  }

  // Publishers per bucket: count distinct company_ids whose published date
  // falls inside the bucket window.
  function bucketUniquePublishers(): number[] {
    return buckets.starts.map((_, i) => {
      const seen = new Set<string>()
      for (const row of publishedRows) {
        if (row.publishedAt >= buckets.starts[i] && row.publishedAt < buckets.ends[i]) {
          seen.add(row.companyId)
        }
      }
      return seen.size
    })
  }
  const publishersBucketed = bucketUniquePublishers()
  // Use the bucket8-shaped object so the existing rendering keeps working.
  const publishers = { datapoints: publishersBucketed, labels: [] as string[] }

  // Total unique publishers in the whole window
  const allPublisherCompanyIds = new Set(
    publishedRows
      .filter((r) => r.publishedAt >= from)
      .map((r) => r.companyId),
  )
  const totalPublishersInWindow = allPublisherCompanyIds.size
  const publishedInRangeCount = publishedRows.filter((r) => r.publishedAt >= from).length
  const projectsPerPublisher =
    totalPublishersInWindow > 0
      ? Math.round((publishedInRangeCount / totalPublishersInWindow) * 10) / 10
      : 0

  // Projects/publisher per bucket: avg published projects per unique
  // publishing company *in that bucket*.
  function bucketProjectsPerPublisher(): number[] {
    return buckets.starts.map((_, i) => {
      const inBucket = publishedRows.filter(
        (r) => r.publishedAt >= buckets.starts[i] && r.publishedAt < buckets.ends[i],
      )
      const uniq = new Set(inBucket.map((r) => r.companyId))
      return uniq.size > 0 ? Math.round((inBucket.length / uniq.size) * 10) / 10 : 0
    })
  }
  const projectsPerPublisherSeries = bucketProjectsPerPublisher()

  // ── SEO indexation supporting metrics ─────────────────────────────────────
  // Indexed Listed Pros — cumulative snapshot at each bucket end. Counts
  // pros currently in 'listed' state with seo_indexed=true whose
  // seo_indexed_at falls on or before the bucket boundary. Numerator
  // for the "% Ranked Pros" CR rendered below Listed Pros. seo_indexed
  // is refreshed nightly by /api/cron/sync-gsc-indexation; pros whose
  // status is unlisted now (even if previously listed and indexed)
  // are excluded — the CR measures the share of CURRENTLY listed pros
  // that are ranked, not the historical cumulative rank rate.
  const indexedListedSnapshotSeries = buckets.ends.map((bucketEnd) =>
    companies.filter((c: any) =>
      c.status === "listed"
      && claimedCompanies(c)
      && c.seo_indexed === true
      && c.seo_indexed_at != null
      && new Date(c.seo_indexed_at) <= bucketEnd,
    ).length,
  )
  const totalIndexedListedSnapshot = indexedListedSnapshotSeries[indexedListedSnapshotSeries.length - 1] ?? 0

  // SEO supporting metrics — current 28-day rolling totals aggregated
  // across listed + indexed pros. `seo_impressions_28d` / `seo_clicks_28d`
  // are refreshed nightly per company by /api/cron/sync-gsc-indexation;
  // we only have the latest 28d window stored, not per-bucket history,
  // so these only populate the *last* bucket — earlier columns render
  // as dots (formatNumber(0) → "·"). CTR is recomputed from the summed
  // clicks ÷ impressions so it weights by traffic, not a flat average.
  const rankedPros = companies.filter((c: any) =>
    c.status === "listed" && claimedCompanies(c) && c.seo_indexed === true,
  )
  const totalSeoImpressions = rankedPros.reduce(
    (sum: number, c: any) => sum + (Number(c.seo_impressions_28d) || 0), 0,
  )
  const totalSeoClicks = rankedPros.reduce(
    (sum: number, c: any) => sum + (Number(c.seo_clicks_28d) || 0), 0,
  )
  const aggregateCtrPct = totalSeoImpressions > 0
    ? Math.round((totalSeoClicks / totalSeoImpressions) * 100)
    : 0
  const lastBucketOnly = (value: number) =>
    buckets.ends.map((_, i) => (i === buckets.ends.length - 1 ? value : 0))
  const seoImpressionsSeries = lastBucketOnly(totalSeoImpressions)
  const seoClicksSeries = lastBucketOnly(totalSeoClicks)
  const seoCtrSeries = lastBucketOnly(aggregateCtrPct)

  // Total published projects (published_at falls in the period). Different
  // from the Publishers metric, which counts unique COMPANIES.
  const publishedProjectDates = projects
    .filter((p) => p.status === "published" && p.published_at)
    .map((p) => new Date(p.published_at))
    .filter((d: Date) => d >= from)
  const publishedProjectsBuckets = bucket8(publishedProjectDates, buckets)

  // Total Projects — cumulative snapshot at each bucket end. Counts
  // every published project with published_at <= bucket end,
  // regardless of indexation. Denominator for "% Ranked Projects".
  const totalPublishedSnapshotSeries = buckets.ends.map((bucketEnd) =>
    projects.filter((p: any) =>
      p.status === "published"
      && p.published_at
      && new Date(p.published_at) <= bucketEnd,
    ).length,
  )
  const totalPublishedSnapshot = totalPublishedSnapshotSeries[totalPublishedSnapshotSeries.length - 1] ?? 0

  // Indexed published projects — same cumulative snapshot narrowed to
  // currently seo_indexed=true rows. Numerator for "% Ranked Projects".
  const indexedPublishedSnapshotSeries = buckets.ends.map((bucketEnd) =>
    projects.filter((p: any) =>
      p.status === "published"
      && p.seo_indexed === true
      && p.published_at
      && new Date(p.published_at) <= bucketEnd,
    ).length,
  )
  const totalIndexedPublishedSnapshot = indexedPublishedSnapshotSeries[indexedPublishedSnapshotSeries.length - 1] ?? 0

  // SEO supporting metrics for projects — current 28-day rolling totals
  // aggregated across published + indexed projects. Same caveat as the
  // pros version: GSC data is a rolling-window snapshot per project, so
  // values only populate the last bucket.
  const rankedProjects = projects.filter((p: any) =>
    p.status === "published" && p.seo_indexed === true,
  )
  const totalProjectImpressions = rankedProjects.reduce(
    (sum: number, p: any) => sum + (Number(p.seo_impressions_28d) || 0), 0,
  )
  const totalProjectClicks = rankedProjects.reduce(
    (sum: number, p: any) => sum + (Number(p.seo_clicks_28d) || 0), 0,
  )
  const projectAggregateCtrPct = totalProjectImpressions > 0
    ? Math.round((totalProjectClicks / totalProjectImpressions) * 100)
    : 0
  const projectImpressionsSeries = lastBucketOnly(totalProjectImpressions)
  const projectClicksSeries = lastBucketOnly(totalProjectClicks)
  const projectCtrSeries = lastBucketOnly(projectAggregateCtrPct)

  // Inviters: unique project-owner companies whose projects received any
  // non-owner project_professionals row created in the bucket window. The
  // previous implementation bucketed invite events, so a single project that
  // invited 3 pros looked like 3 inviters.
  // Photographers excluded — see excludedFromInvitedCompanyIds note
  // above. is_project_owner=true rows are always excluded (those are
  // the inviters, not invitees).
  const nonOwnerInvites = invites.filter(
    (i: any) => !i.is_project_owner && !excludedFromInvitedCompanyIds.has(i.company_id),
  )
  function bucketUniqueInviters(): number[] {
    return buckets.starts.map((_, i) => {
      const owners = new Set<string>()
      for (const pp of nonOwnerInvites) {
        if (!pp.created_at) continue
        const d = new Date(pp.created_at)
        if (d < buckets.starts[i] || d >= buckets.ends[i]) continue
        const owner = projectIdToOwnerCompany.get(pp.project_id)
        if (owner) owners.add(owner)
      }
      return owners.size
    })
  }
  const invitersBucketed = bucketUniqueInviters()
  const inviters = { datapoints: invitersBucketed, labels: [] as string[] }

  // Companies that BOTH published a project AND invited at least one
  // pro in the same period. Numerator for "% Inviting" under
  // Publishers — of the companies that published this period, what
  // share also reached for collaboration. Reuses the publishedRows
  // and nonOwnerInvites datasets so we don't re-bucket from raw.
  const publishersInvitingBucketed = buckets.starts.map((_, i) => {
    const publisherIds = new Set<string>()
    for (const row of publishedRows) {
      if (row.publishedAt >= buckets.starts[i] && row.publishedAt < buckets.ends[i]) {
        publisherIds.add(row.companyId)
      }
    }
    const both = new Set<string>()
    for (const pp of nonOwnerInvites) {
      if (!pp.created_at) continue
      const d = new Date(pp.created_at)
      if (d < buckets.starts[i] || d >= buckets.ends[i]) continue
      const owner = projectIdToOwnerCompany.get(pp.project_id)
      if (owner && publisherIds.has(owner)) both.add(owner)
    }
    return both.size
  })

  // Total unique inviters across the whole window
  const totalInvitersInWindow = (() => {
    const owners = new Set<string>()
    for (const pp of nonOwnerInvites) {
      const owner = projectIdToOwnerCompany.get(pp.project_id)
      if (owner) owners.add(owner)
    }
    return owners.size
  })()

  // Period-scope the invites for the supporting metrics — `invites` (and
  // therefore `nonOwnerInvites`) is the unfiltered all-time array so the
  // per-project map above could see owners correctly. Drop to the window
  // for the in-period averages and totals.
  const nonOwnerInvitesInPeriod = nonOwnerInvites.filter(
    (pp: any) => pp.created_at && new Date(pp.created_at) >= from,
  )

  // Invites per published project — only count published projects that
  // actually received at least one invite in the period, so the average
  // reflects "how many pros does an inviting project end up with" rather
  // than diluting across non-inviting projects.
  const publishedProjectIds = new Set(projects.filter((p: any) => p.status === "published").map((p: any) => p.id))
  const invitesByProject = new Map<string, number>()
  for (const pp of nonOwnerInvitesInPeriod) {
    if (!publishedProjectIds.has(pp.project_id)) continue
    invitesByProject.set(pp.project_id, (invitesByProject.get(pp.project_id) ?? 0) + 1)
  }
  const projectsWithInvites = invitesByProject.size
  const totalInvitesOnPublished = Array.from(invitesByProject.values()).reduce((a, b) => a + b, 0)
  const invitesPerProject = projectsWithInvites > 0
    ? Math.round((totalInvitesOnPublished / projectsWithInvites) * 10) / 10
    : 0

  // Sparkline: invites/project per bucket window — same denominator rule
  // (only inviting projects in that bucket count).
  function bucketInvitesPerProject(): number[] {
    return buckets.starts.map((_, i) => {
      const byProject = new Map<string, number>()
      for (const pp of nonOwnerInvitesInPeriod) {
        if (!publishedProjectIds.has(pp.project_id)) continue
        const d = new Date(pp.created_at)
        if (d < buckets.starts[i] || d >= buckets.ends[i]) continue
        byProject.set(pp.project_id, (byProject.get(pp.project_id) ?? 0) + 1)
      }
      const projs = byProject.size
      const total = Array.from(byProject.values()).reduce((a, b) => a + b, 0)
      return projs > 0 ? Math.round((total / projs) * 10) / 10 : 0
    })
  }
  const invitesPerProjectSeries = bucketInvitesPerProject()

  // Total invited: count of invitations sent in the period.
  const totalInvited = nonOwnerInvitesInPeriod.length

  // Sparkline: total invited per bucket window.
  function bucketTotalInvited(): number[] {
    return buckets.starts.map((_, i) => {
      let count = 0
      for (const pp of nonOwnerInvitesInPeriod) {
        const d = new Date(pp.created_at)
        if (d >= buckets.starts[i] && d < buckets.ends[i]) count++
      }
      return count
    })
  }
  const totalInvitedSeries = bucketTotalInvited()

  const paidTiers = ["pro", "premium", "enterprise"]
  const subscribedDates = makeDates(companies, (c) => paidTiers.includes(c.plan_tier))
  const subscribers = bucket8(subscribedDates, buckets)

  // ── Client metrics ────────────────────────────────────────────────────

  const savedProjectDates = makeDates(savedProjects)
  const savers = bucket8(savedProjectDates, buckets)

  const savedCompanyDates = makeDates(savedCompanies)
  const savedPros = bucket8(savedCompanyDates, buckets)

  const empty8 = [0, 0, 0, 0, 0, 0, 0, 0]

  // Unique savers — combine saved projects + saved companies, dedupe by user_id
  const allSaveEvents = [
    ...savedProjects.filter((s: any) => s.created_at && new Date(s.created_at) >= from),
    ...savedCompanies.filter((s: any) => s.created_at && new Date(s.created_at) >= from),
  ]
  const saverUserIds = new Set<string>()
  allSaveEvents.forEach((s: any) => { if (s.user_id) saverUserIds.add(s.user_id) })
  const uniqueSavers = saverUserIds.size
  const totalSaves = savedProjectDates.length + savedCompanyDates.length
  const savesPerClient = uniqueSavers > 0 ? Math.round((totalSaves / uniqueSavers) * 10) / 10 : 0

  // Bucket unique savers per period (first save per user per bucket)
  const uniqueSaversBucketed = bucketUniqueSavers(allSaveEvents)

  function bucketUniqueSavers(events: any[]): { datapoints: number[]; labels: string[] } {
    const datapoints = buckets.starts.map((_, i) => {
      const users = new Set<string>()
      events.forEach((e: any) => {
        const d = new Date(e.created_at)
        if (d >= buckets.starts[i] && d < buckets.ends[i] && e.user_id) users.add(e.user_id)
      })
      return users.size
    })
    return { datapoints, labels: buckets.labels }
  }

  function bucketSavesPerClient(events: any[]): number[] {
    return buckets.starts.map((_, i) => {
      const users = new Set<string>()
      let saves = 0
      events.forEach((e: any) => {
        const d = new Date(e.created_at)
        if (d >= buckets.starts[i] && d < buckets.ends[i]) {
          saves++
          if (e.user_id) users.add(e.user_id)
        }
      })
      return users.size > 0 ? Math.round((saves / users.size) * 10) / 10 : 0
    })
  }

  const savesPerClientSeries = bucketSavesPerClient(allSaveEvents)

  // ── Client engagement metrics: Active / Dormant / Re-engaged ──────────
  //
  // "Active" = a client with at least one engagement signal in the bucket
  // period. The bucket size is set by the timeframe selector, so this
  // naturally renders as DAC (days) / WAC (weeks) / MAC (months) / YAC (years)
  // depending on what the user picked.
  //
  // Engagement signals available from Supabase today: profile creation
  // (signup), saved_projects, saved_companies. PostHog pageviews would be
  // the more accurate "active" definition but require a separate query —
  // tracked here as a v1 approximation. When PostHog $pageview-by-user is
  // wired in, swap the events list below.
  // Pull client activity events from PostHog ($pageview by logged-in clients).
  // Lookback is a fixed 12 months regardless of the timeframe selector — the
  // dormancy/re-engagement logic needs to see a user's *prior* activity to
  // detect a 30+ day gap, and a "weeks" view that only pulled 86d of history
  // would miss every re-engagement event whose preceding event was older
  // than that. 12 months is enough for nearly all real patterns and stays
  // cheap at current event volumes (per-(person,day) grouping). PostHog
  // person_id is the key; it's stable across sessions for logged-in users.
  //
  // No Supabase fallback: if PostHog is unavailable we'd rather show zero
  // (with the source label as PostHog) than mix in signup+save proxy data,
  // which produces misleading "active client" numbers that look real.
  const phLookbackStart = new Date(Date.now() - 365 * DAY_MS)
  const eventsByClient = await fetchActivityEvents(phLookbackStart, "client")

  // All three of MAC / Dormant / Re-engaged use a fixed 30-day rolling window
  // *regardless* of the table's timeframe selector. The trendline shows how
  // each metric moves over the 8 buckets, but the *definition* doesn't shift
  // with the selector — MAC is always "active in the trailing 30d as of this
  // bucket's end". For days/weeks the line moves smoothly; for years it
  // collapses to nearly-flat (since a 30d window inside a 1-year bucket is
  // small) which is the honest read.
  const ACTIVE_WINDOW_DAYS = 30
  const DORMANCY_DAYS = 30

  // MAC at each bucket end: unique clients with any pageview in the
  // trailing 30 days.
  function bucketMACSeries(): number[] {
    return buckets.ends.map((bucketEnd) => {
      const windowStart = new Date(bucketEnd.getTime() - ACTIVE_WINDOW_DAYS * DAY_MS)
      let count = 0
      eventsByClient.forEach((dates) => {
        if (dates.some((d) => d >= windowStart && d < bucketEnd)) count++
      })
      return count
    })
  }
  const activeClientsSeries = bucketMACSeries()
  const totalActiveClients = activeClientsSeries[activeClientsSeries.length - 1] ?? 0

  // Re-engaged is a FLOW metric: each user's return-after-dormancy is counted
  // once, in the bucket where the return event actually fell. (The previous
  // snapshot version double-counted across the 30-day rolling window.)
  const reEngagementEvents: Date[] = []
  eventsByClient.forEach((dates) => {
    const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime())
    for (let i = 1; i < sorted.length; i++) {
      const gapMs = sorted[i].getTime() - sorted[i - 1].getTime()
      if (gapMs >= DORMANCY_DAYS * DAY_MS) {
        reEngagementEvents.push(sorted[i])
      }
    }
  })
  function bucketReEngagedSeries(): number[] {
    return buckets.starts.map((_, i) =>
      reEngagementEvents.filter((d) => d >= buckets.starts[i] && d < buckets.ends[i]).length,
    )
  }
  const reEngagedClientsSeries = bucketReEngagedSeries()
  const totalReEngagedClients = reEngagementEvents.filter((d) => d >= from).length

  // Newly Dormant is a FLOW metric: users who tipped over the 30-day
  // inactivity threshold during the bucket. Counted once per dormancy event
  // (a user can become dormant, re-engage, and become dormant again — that's
  // two separate flow events). The "dormancy moment" is `eventDate + 30d`,
  // when there's no further event before that. Future dormancy moments
  // (events not yet aged 30d) are excluded.
  const newlyDormantEvents: Date[] = []
  const nowTs = Date.now()
  eventsByClient.forEach((dates) => {
    const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime())
    for (let i = 0; i < sorted.length; i++) {
      const dormancyMoment = new Date(sorted[i].getTime() + DORMANCY_DAYS * DAY_MS)
      if (dormancyMoment.getTime() > nowTs) continue
      const next = sorted[i + 1]
      if (!next || next.getTime() > dormancyMoment.getTime()) {
        newlyDormantEvents.push(dormancyMoment)
      }
    }
  })
  function bucketNewlyDormantSeries(): number[] {
    return buckets.starts.map((_, i) =>
      newlyDormantEvents.filter((d) => d >= buckets.starts[i] && d < buckets.ends[i]).length,
    )
  }
  const dormantClientsSeries = bucketNewlyDormantSeries()
  const totalDormantClients = newlyDormantEvents.filter((d) => d >= from).length

  // Quizlet-style MAU accounting under the dropdown:
  //   Ending MAU(t) = Retained(t) + Re-engaged(t) + New(t)
  //   Retained(t)  = MAU(t-1) - NewlyDormant(t)   ← clean identity
  // Period 0 has no prior MAU, so Retained / its CR are undefined.
  const retainedClientsSeries = activeClientsSeries.map((_, i) =>
    i === 0 ? 0 : Math.max(0, activeClientsSeries[i - 1] - dormantClientsSeries[i]),
  )
  const totalRetainedClients = retainedClientsSeries[retainedClientsSeries.length - 1] ?? 0

  // Denominators for the inline accounting CRs:
  //   % Retained = Retained / MAU(t-1)
  //   % Churn    = NewlyDormant / MAU(t-1)
  //   % Re-activated = Re-engaged / DormantPool(t-1)
  // DormantPool(t-1) ≈ clients with any activity in the 12-month lookback
  // before bucket.starts[i] minus MAU(t-1). It's an internally consistent
  // proxy — not "registered base" (we don't track that here) — but it's
  // the right shape for "of the pool that could come back, how many did".
  const priorMACSeries = activeClientsSeries.map((_, i) => (i === 0 ? 0 : activeClientsSeries[i - 1]))
  const knownClientsAtBucketStart: number[] = buckets.starts.map((start) => {
    let count = 0
    eventsByClient.forEach((dates) => {
      if (dates.some((d) => d < start)) count++
    })
    return count
  })
  const priorDormantSeries = knownClientsAtBucketStart.map((known, i) =>
    i === 0 ? 0 : Math.max(0, known - activeClientsSeries[i - 1]),
  )

  // ── Pro lifecycle metrics ─────────────────────────────────────────────

  // Pros contacted: unique pros reached via Sales (Apollo + Resend
  // 'prospect-*' sends, both materialized into email_events with
  // campaign_kind='sales_outbound') or Invites (project_professionals.
  // invited_email). Dedupe by lowercased email *within* each bucket — a
  // pro emailed 5 times in one period counts once, but the same pro
  // contacted in two different periods shows up in both.
  //
  // Sales source is email_events: one row per send, so a multi-touch
  // sequence shows up correctly in every bucket where a touch landed
  // (rather than only the most recent, which was the prospects.
  // last_email_sent_at limitation).
  type ContactEvent = { email: string; date: Date }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: salesEventsRaw } = await (supabase as any)
    .from("email_events")
    .select("recipient_email, occurred_at")
    .eq("event_type", "sent")
    .eq("campaign_kind", "sales_outbound")
    .gte("occurred_at", from.toISOString())
  const salesContactEvents: ContactEvent[] = (salesEventsRaw ?? [])
    .filter((r: any) => r.recipient_email && r.occurred_at)
    .map((r: any) => ({
      email: String(r.recipient_email).toLowerCase(),
      date: new Date(r.occurred_at),
    }))
  // Exclude is_project_owner=true rows — those are the project
  // creators (the inviters), not the invitees. Including them treats
  // owners as "contacted" pros and inflates the count.
  const inviteContactEvents: ContactEvent[] = invites
    .filter((i: any) => !i.is_project_owner && i.invited_email && i.invited_at)
    .map((i: any) => ({
      email: String(i.invited_email).toLowerCase(),
      date: new Date(i.invited_at),
    }))

  function bucketUniqueByEmail(events: ContactEvent[]): number[] {
    return buckets.starts.map((_, i) => {
      const set = new Set<string>()
      for (const ev of events) {
        if (ev.date >= buckets.starts[i] && ev.date < buckets.ends[i]) set.add(ev.email)
      }
      return set.size
    })
  }
  function totalUniqueByEmail(events: ContactEvent[]): number {
    const set = new Set<string>()
    for (const ev of events) {
      if (ev.date >= from) set.add(ev.email)
    }
    return set.size
  }

  const salesContactedSeries = bucketUniqueByEmail(salesContactEvents)
  const totalSalesContacted = totalUniqueByEmail(salesContactEvents)
  const inviteContactedSeries = bucketUniqueByEmail(inviteContactEvents)
  const totalInviteContacted = totalUniqueByEmail(inviteContactEvents)

  // Sales visitor count from prospect_events instead of PostHog. The
  // PostHog $pageview source over-counts because email link scanners
  // (Outlook Safe Links, Gmail link inspection, AV proxies) prefetch
  // the URL as anonymous persons before the recipient sees the mail.
  // prospect_events.landing_visited is logged server-side keyed on
  // prospect_id, so it matches the email-keyed contacted denominator
  // and the ratio can never exceed 100%.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: salesVisitEventsRaw } = await (supabase as any)
    .from("prospect_events")
    .select("prospect_id, created_at")
    .eq("event_type", "prospect.landing_visited")
    .gte("created_at", from.toISOString())
  type VisitEvent = { prospectId: string; date: Date }
  const salesVisitEvents: VisitEvent[] = (salesVisitEventsRaw ?? [])
    .filter((r: any) => r.prospect_id && r.created_at)
    .map((r: any) => ({ prospectId: String(r.prospect_id), date: new Date(r.created_at) }))
  function bucketUniqueByProspectId(events: VisitEvent[]): number[] {
    return buckets.starts.map((_, i) => {
      const set = new Set<string>()
      for (const ev of events) {
        if (ev.date >= buckets.starts[i] && ev.date < buckets.ends[i]) set.add(ev.prospectId)
      }
      return set.size
    })
  }
  function totalUniqueByProspectId(events: VisitEvent[]): number {
    const set = new Set<string>()
    for (const ev of events) {
      if (ev.date >= from) set.add(ev.prospectId)
    }
    return set.size
  }
  const salesVisitorsSeriesDb = bucketUniqueByProspectId(salesVisitEvents)
  const salesVisitorsTotalDb = totalUniqueByProspectId(salesVisitEvents)

  // Invite visitor count from project_professionals.landing_visited_at
  // (set by /businesses/professionals on first matching visit). Same
  // motivation as the Sales-side switch: PostHog $pageview counts
  // include link-scanner traffic, which pushed the invite-CR over
  // 100%. Email-keyed server-side timestamp = honest funnel.
  const inviteVisitEvents: ContactEvent[] = invites
    .filter((i: any) => !i.is_project_owner && i.invited_email && i.landing_visited_at)
    .map((i: any) => ({
      email: String(i.invited_email).toLowerCase(),
      date: new Date(i.landing_visited_at),
    }))
  const inviteVisitorsSeriesDb = bucketUniqueByEmail(inviteVisitEvents)
  const inviteVisitorsTotalDb = totalUniqueByEmail(inviteVisitEvents)

  // Adjusted Direct series for the Pro visitors row. The Sales and
  // Invites subs read server-side click logs (a more useful "did this
  // pro click our email" signal than first-touch PostHog), but those
  // persons typically have first-touch = Direct (came in via direct
  // URL/typed before getting our email). We'd double-count them if
  // we didn't subtract. Floored at 0 in case the subtraction goes
  // negative for any bucket (rare but possible if attribution drifts
  // across user-type categorisations).
  const proVisitorsDirectAdjustedSeries = proVisitorsDirectBucketed.series.map((v, i) => {
    const subtract = (salesVisitorsSeriesDb[i] ?? 0) + (inviteVisitorsSeriesDb[i] ?? 0)
    return Math.max(0, v - subtract)
  })
  const proVisitorsDirectAdjustedTotal = proVisitorsDirectAdjustedSeries.reduce((a, b) => a + b, 0)
  // Combined: dedupe across BOTH sources per bucket (a pro contacted via
  // Sales and Invites in the same period still counts once).
  const allContactEvents = [...salesContactEvents, ...inviteContactEvents]
  const prosContactedSeries = bucketUniqueByEmail(allContactEvents)
  const totalProsContacted = totalUniqueByEmail(allContactEvents)

  // Pros contacted → Pro visitors CR uses ONLY the channels we
  // actually contacted through (Sales + Invites), not the full
  // pro_visitors total. Same dedup principle as Pros contacted: a
  // pro who visited both a Sales and an Invite landing in the same
  // period counts once. Sales visits are keyed by prospect_id, so we
  // map them back to email via the prospects table to merge cleanly
  // with invite visits (already email-keyed).
  const prospectIdToEmail = new Map<string, string>()
  for (const p of prospects) {
    if (p.id && p.email) {
      prospectIdToEmail.set(String(p.id), String(p.email).toLowerCase())
    }
  }
  const salesVisitEmailEvents: ContactEvent[] = salesVisitEvents
    .map((ev) => {
      const email = prospectIdToEmail.get(ev.prospectId)
      return email ? { email, date: ev.date } : null
    })
    .filter((ev): ev is ContactEvent => ev !== null)
  const allContactedVisitEvents = [...salesVisitEmailEvents, ...inviteVisitEvents]
  const contactedVisitorsSeries = bucketUniqueByEmail(allContactedVisitEvents)

  // New Pros: companies that completed onboarding (left draft state) in
  // the period, bucketed by companies.onboarded_at — a DB trigger
  // stamps this on the first 'draft' → non-draft transition (with
  // historical rows backfilled via LEAST(created_at, updated_at)).
  // Previously bucketed by updated_at, which moved on every admin edit
  // and bunched recently-edited pros onto the current bucket.
  const onboardingCompleted = (c: any) => c.status !== "draft" && c.owner_id != null
  const newProDates = makeDatesByOnboarded(companies, onboardingCompleted)
  const newPros = bucket8(newProDates, buckets)

  // Apollo channel: companies whose id is referenced by a prospect with an
  // apollo_contact_id (i.e. they came in via the Apollo outbound sequence).
  const apolloCompanyIds = new Set<string>(
    prospects
      .filter((p: any) => p.apollo_contact_id && p.company_id)
      .map((p: any) => p.company_id as string),
  )
  const apolloNewProDates = makeDatesByOnboarded(companies, (c: any) =>
    onboardingCompleted(c) && apolloCompanyIds.has(c.id),
  )
  const apolloNewPros = bucket8(apolloNewProDates, buckets)

  // "Other": all other channels (organic, invites, direct, social) — once
  // first-session attribution is wired into companies, this can split further.
  const otherNewProDates = makeDatesByOnboarded(companies, (c: any) =>
    onboardingCompleted(c) && !apolloCompanyIds.has(c.id),
  )
  const otherNewPros = bucket8(otherNewProDates, buckets)

  // ── Per-source breakdowns from first_touch_source ───────────────
  // Both client_signups_<channel> and new_pros_<channel> previously
  // came from PostHog HogQL queries with first-touch attribution at
  // read time. After migration 164 the source is stamped on the row
  // at creation (profiles for signups, companies for new pros, the
  // company inherits from owner). Counting rows grouped by
  // first_touch_source means channels and parent measure the same
  // thing — channels sum to parent by construction.
  type FirstTouchKey = "sales" | "invites" | "email" | "shares" | "google" | "social" | "referral" | "direct"
  const FIRST_TOUCH_KEYS: FirstTouchKey[] = ["sales", "invites", "email", "shares", "google", "social", "referral", "direct"]

  function bucketBySource(
    items: any[],
    dateAccessor: (i: any) => Date | null,
    filter: (i: any) => boolean,
    /** Channels accepted by the caller's row. Sources outside this
     *  list roll into "direct" so channel subs always sum to parent.
     *  Defaults to all 8 (for the pro side). The client side passes
     *  the 6-channel list (no sales/invites — those are pro-side). */
    allowed: readonly FirstTouchKey[] = FIRST_TOUCH_KEYS,
  ): Record<FirstTouchKey, number[]> {
    const allowedSet = new Set<FirstTouchKey>(allowed)
    const out: Record<FirstTouchKey, number[]> = {
      sales: new Array(8).fill(0), invites: new Array(8).fill(0),
      email: new Array(8).fill(0), shares: new Array(8).fill(0),
      google: new Array(8).fill(0), social: new Array(8).fill(0),
      referral: new Array(8).fill(0), direct: new Array(8).fill(0),
    }
    for (const it of items) {
      if (!filter(it)) continue
      // NULL / unknown / disallowed first_touch_source rolls into
      // "direct" so the rendered channel subs always sum to the
      // parent count. Disallowed = sources we never render for this
      // caller (e.g. a client with first_touch_source='sales' from
      // landing on /businesses/architects before signing up).
      const raw = it.first_touch_source as FirstTouchKey | null
      const src: FirstTouchKey = raw && allowedSet.has(raw) ? raw : "direct"
      const d = dateAccessor(it)
      if (!d) continue
      for (let i = 0; i < 8; i++) {
        if (d >= buckets.starts[i] && d < buckets.ends[i]) {
          out[src][i] += 1
          break
        }
      }
    }
    return out
  }

  // Channels rendered under the client Signups row. Sales / Invites
  // are pro-side acquisition channels — a "client" with first_touch_source
  // of 'sales' or 'invites' arrived on /businesses/* first and signed
  // up as a client later; roll them into Direct so the 6 channel
  // subs sum to the parent.
  const CLIENT_CHANNELS: readonly FirstTouchKey[] = ["direct", "google", "social", "email", "referral", "shares"]
  const clientSignupsBySource = bucketBySource(
    profiles,
    (p) => p.created_at ? new Date(p.created_at) : null,
    (p) => p.user_types?.includes("client"),
    CLIENT_CHANNELS,
  )

  // New pros by source — bucketed by companies.onboarded_at.
  const newProsBySource = bucketBySource(
    companies,
    (c) => c.onboarded_at ? new Date(c.onboarded_at) : null,
    onboardingCompleted,
  )

  // Per-source totals: sum of the 8-period series for the "total" column.
  function totalsBySource(s: Record<FirstTouchKey, number[]>): Record<FirstTouchKey, number> {
    return FIRST_TOUCH_KEYS.reduce((acc, k) => {
      acc[k] = s[k].reduce((a, b) => a + b, 0)
      return acc
    }, {} as Record<FirstTouchKey, number>)
  }
  const clientSignupsBySourceTotals = totalsBySource(clientSignupsBySource)
  const newProsBySourceTotals = totalsBySource(newProsBySource)

  // ── Click-through-based New Pros for Sales / Invites ─────────────
  // Count new pros (companies onboarded in the period) whose owner
  // clicked at least one Outreach/Showcase or Invite email — same
  // server-side click signal that drives the Pros contacted →
  // Visitors funnel on /admin/sales. Replaces the first-touch-based
  // Sales/Invites counts under New Pros so this row reads "did our
  // outreach end-to-end work" rather than "first marketing touch".
  // Direct is adjusted below to remove the overlap (most Sales /
  // Invites clickers had first-touch = Direct).

  // prospect_id → company_id, for joining click events to companies.
  const prospectIdToCompanyId = new Map<string, string>()
  for (const p of prospects) {
    if (p.id && p.company_id) {
      prospectIdToCompanyId.set(String(p.id), String(p.company_id))
    }
  }

  // Companies whose owner clicked a Sales landing at any point.
  const salesClickerCompanyIds = new Set<string>()
  for (const ev of salesVisitEvents) {
    const cid = prospectIdToCompanyId.get(ev.prospectId)
    if (cid) salesClickerCompanyIds.add(cid)
  }
  // Companies whose owner clicked an Invite landing at any point.
  // project_professionals.company_id is the recipient pro's company,
  // so this captures the right join directly.
  const inviteClickerCompanyIds = new Set<string>()
  for (const inv of invites as any[]) {
    if (!inv.is_project_owner && inv.landing_visited_at && inv.company_id) {
      inviteClickerCompanyIds.add(String(inv.company_id))
    }
  }

  function bucketNewProsByClickSet(clickerIds: Set<string>): number[] {
    return buckets.starts.map((_, i) =>
      companies.filter((c: any) =>
        onboardingCompleted(c)
        && c.onboarded_at
        && clickerIds.has(String(c.id))
        && new Date(c.onboarded_at) >= buckets.starts[i]
        && new Date(c.onboarded_at) < buckets.ends[i],
      ).length,
    )
  }
  const newProsSalesClickerSeries = bucketNewProsByClickSet(salesClickerCompanyIds)
  const newProsSalesClickerTotal = newProsSalesClickerSeries.reduce((a, b) => a + b, 0)
  const newProsInvitesClickerSeries = bucketNewProsByClickSet(inviteClickerCompanyIds)
  const newProsInvitesClickerTotal = newProsInvitesClickerSeries.reduce((a, b) => a + b, 0)

  // Direct adjusted: original first-touch direct minus Sales+Invites
  // clickers (who currently fall into Direct because most have
  // first_touch_source='direct' — they typed the URL before clicking
  // our email). Floored at 0. Same shape as proVisitorsDirectAdjusted.
  const newProsDirectAdjustedSeries = newProsBySource.direct.map((v, i) => {
    const subtract = (newProsSalesClickerSeries[i] ?? 0) + (newProsInvitesClickerSeries[i] ?? 0)
    return Math.max(0, v - subtract)
  })
  const newProsDirectAdjustedTotal = newProsDirectAdjustedSeries.reduce((a, b) => a + b, 0)

  // Parent client_signups series — count client profiles bucketed by
  // created_at. Same denominator the channels derive from, so subs
  // sum to parent exactly.
  const clientSignupDates = profiles
    .filter((p: any) => p.user_types?.includes("client") && p.created_at)
    .map((p: any) => new Date(p.created_at))
    .filter((d: Date) => d >= from)
  const clientSignupsBucketedDb = bucket8(clientSignupDates, buckets)

  // Open drafts (snapshot at each bucket end): companies created before
  // bucket end that are still in 'draft' status today. Approximate — we
  // don't track historical status, so a company that became draft → listed
  // → draft would be miscounted. Acceptable for v1.
  function bucketOpenDraftsAt(bucketEnd: Date): number {
    return companies.filter((c: any) =>
      c.status === "draft" && c.owner_id != null && new Date(c.created_at) < bucketEnd,
    ).length
  }
  const openDraftsSeries = buckets.ends.map(bucketOpenDraftsAt)
  const totalOpenDrafts = openDraftsSeries[openDraftsSeries.length - 1] ?? 0

  // Unlisted snapshot at each bucket end: companies created before bucket
  // end that are currently in 'unlisted' status. Same v1 caveat as Open
  // drafts (approximates current state for past dates).
  function bucketUnlistedAt(bucketEnd: Date): number {
    return companies.filter((c: any) =>
      c.status === "unlisted" && c.owner_id != null && new Date(c.created_at) < bucketEnd,
    ).length
  }
  const unlistedSnapshotSeries = buckets.ends.map(bucketUnlistedAt)
  const totalUnlistedSnapshot = unlistedSnapshotSeries[unlistedSnapshotSeries.length - 1] ?? 0

  const rows: MetricRow[] = [
    // ── Professionals ──────────────────────────────────────────────────
    {
      key: "pros_contacted", label: "Pros contacted", definition: "Unique pros contacted via Sales or Invites", source: "supabase" as MetricSource, driver: "acquisition",
      total: totalProsContacted, datapoints: prosContactedSeries, labels,
      // Override the auto-inline "to Pro visitors" CR's numerator with
      // Sales + Invites visitors (email-keyed, deduped across both
      // sources). The contacted denominator only covers pros we
      // reached via Sales or Invites, so a fair "what % clicked
      // through" must compare against the same channels — not Direct /
      // SEO / Social traffic that wasn't part of the outreach motion.
      // Keeping the auto-inline CR (vs. an extraCRs entry) preserves
      // the per-sub CRs underneath ("to Pro visitors from Sales /
      // Invites") which depend on inlineCRTo being present.
      inlineCRNumerator: { total: 0, datapoints: contactedVisitorsSeries },
      subs: [
        {
          key: "sales_contacted", label: "Sales", definition: "Unique pros contacted via Outreach (Apollo cold) or Showcase",
          source: "supabase" as MetricSource,
          total: totalSalesContacted, datapoints: salesContactedSeries,
          // Numerator: Sales-attributed Pro visitors (Outreach + Showcase
          // traffic). Denominator (sub.datapoints) is sales-contacted
          // pros, giving "what fraction of pros we Sales-contacted
          // actually clicked through to the site."
          crNumerator: { total: salesVisitorsTotalDb, datapoints: salesVisitorsSeriesDb },
        },
        {
          key: "invites_contacted", label: "Invites", definition: "Unique pros invited via project invites",
          source: "supabase" as MetricSource,
          total: totalInviteContacted, datapoints: inviteContactedSeries,
          // Invite-attributed visitors come from
          // project_professionals.landing_visited_at, stamped server-side
          // when the recipient hits /businesses/professionals with their
          // inviteEmail. Email-keyed, so the ratio reconciles with the
          // invited-pros denominator and link-scanner traffic can't
          // inflate it past 100%.
          crNumerator: { total: inviteVisitorsTotalDb, datapoints: inviteVisitorsSeriesDb },
        },
      ],
    },
    {
      key: "pro_visitors", label: "Pro visitors", definition: "Unique visitors to /businesses pages", source: "posthog" as MetricSource, driver: "acquisition",
      total: proVisitorsBucketed.total, datapoints: proVisitorsBucketed.series, labels,
      subs: [
        // Sales = Outreach (Apollo cold via ?ref=) + Showcase (prospect-*
        // claim_url via ?inviteEmail= on /businesses/architects).
        // Aggregated into a single sub here; the Outreach/Showcase split
        // is implementation detail you don't usually want to scan past.
        // Drill in by querying the apollo_visitors / showcase_visitors
        // cache keys directly when needed.
        // Each sub carries a crNumerator pointing at the matching
        // new_pros_<channel> count. The Model renders a per-source CR
        // row underneath ("to New Pros from Sales", etc.) so you can
        // see channel-level visit→signup conversion.
        // Sales and Invites under Pro visitors now use PostHog's
        // $initial_channel_type via the Custom Channel Type rules.
        // Each person belongs to exactly one channel — so the 8 subs
        // sum to parent pro_visitors. The Pros contacted row still
        // counts Supabase-sourced Sales/Invites visitors (email-keyed,
        // matches the email-keyed contacted denominator); that's a
        // different metric ("of the pros we emailed, how many clicked")
        // and stays Supabase to avoid bot/scanner noise.
        // Sales and Invites count actual click-throughs from the
        // server-side logs (prospect_events.landing_visited /
        // project_professionals.landing_visited_at). These are *any-
        // visit* counts, not first-touch — measures the more useful
        // "did the email work" signal. Direct below is reduced by
        // these counts so the 8 subs still sum to parent.
        // CR numerators all read `newProsBySource.<channel>` so the
        // "to New Pros from X" rate matches the New Pros row's
        // displayed sub value one row down. Both source from
        // companies.first_touch_source (Supabase, populated via the
        // FirstTouchStamper hook + onboarded trigger).
        { key: "sales", label: "Sales", definition: "Pros who clicked through to a Sales landing (Outreach or Showcase). Sourced from prospect_events server-side, not PostHog first-touch — measures click-through, not initial acquisition channel.",
          source: "supabase" as MetricSource,
          total: salesVisitorsTotalDb, datapoints: salesVisitorsSeriesDb,
          crNumerator: { total: newProsSalesClickerTotal, datapoints: newProsSalesClickerSeries } },
        { key: "invites", label: "Invites", definition: "Pros who clicked through to an invite landing. Sourced from project_professionals.landing_visited_at server-side.",
          source: "supabase" as MetricSource,
          total: inviteVisitorsTotalDb, datapoints: inviteVisitorsSeriesDb,
          crNumerator: { total: newProsInvitesClickerTotal, datapoints: newProsInvitesClickerSeries } },
        { key: "email", label: "Email", definition: "Pro visitors from Arco transactional emails (project-live, team-invite, domain-verification, etc.)",
          total: proVisitorsEmailBucketed.total, datapoints: proVisitorsEmailBucketed.series,
          crNumerator: { total: newProsBySourceTotals.email, datapoints: newProsBySource.email } },
        // Direct first-touch reduced by Sales+Invites click-throughs.
        // Most Sales/Invites clickers first-touched as Direct (typed
        // URL / bookmark before getting our email), so they show up
        // in BOTH the server-side Sales/Invites count and PostHog's
        // first-touch Direct count. Subtraction removes the overlap
        // so the 8 subs sum to parent. Floored at 0 in case the
        // subtraction over-shoots (rare).
        { key: "direct", label: "Direct", definition: "Pros whose first touch was Direct (typed URL, bookmark, or no referrer), excluding those who later clicked an Outreach or Invite email (counted under Sales / Invites instead).",
          total: proVisitorsDirectAdjustedTotal, datapoints: proVisitorsDirectAdjustedSeries,
          crNumerator: { total: newProsDirectAdjustedTotal, datapoints: newProsDirectAdjustedSeries } },
        { key: "google", label: "SEO", definition: "Pro visitors from search engines (Google, Bing, DuckDuckGo, Yahoo, Ecosia, Brave, Qwant, Startpage)",
          total: proVisitorsGoogleBucketed.total, datapoints: proVisitorsGoogleBucketed.series,
          crNumerator: { total: newProsBySourceTotals.google, datapoints: newProsBySource.google } },
        { key: "social", label: "Social", definition: "Pro visitors from social networks (LinkedIn, Facebook, Instagram, X, Pinterest)",
          total: proVisitorsSocialBucketed.total, datapoints: proVisitorsSocialBucketed.series,
          crNumerator: { total: newProsBySourceTotals.social, datapoints: newProsBySource.social } },
        { key: "referral", label: "Referral", definition: "Pro visitors from other websites linking to Arco",
          total: proVisitorsReferralBucketed.total, datapoints: proVisitorsReferralBucketed.series,
          crNumerator: { total: newProsBySourceTotals.referral, datapoints: newProsBySource.referral } },
        { key: "shares", label: "Shares", definition: "Pro visitors from a tagged share URL (utm_source=share)",
          total: proVisitorsShareBucketed.total, datapoints: proVisitorsShareBucketed.series,
          crNumerator: { total: newProsBySourceTotals.shares, datapoints: newProsBySource.shares } },
      ],
    },
    {
      key: "new_pros", label: "New Pros", definition: "Unique pros that completed onboarding", source: "supabase" as MetricSource, driver: "acquisition",
      total: newProDates.length, ...newPros,
      // Channel breakdown counts companies grouped by
      // companies.first_touch_source (inherited from the owner's
      // profile at onboarding). Channels and parent are now both
      // Supabase-sourced and bucketed by the same field, so the subs
      // sum to the parent total by construction.
      // Sales / Invites: server-side click-through counts (companies
      // whose owner clicked an Outreach/Invite email at any point AND
      // completed onboarding in the period). Other 6 channels: first-
      // touch from companies.first_touch_source. Direct is adjusted
      // down by the Sales+Invites click count to remove the overlap
      // — same trick used on the Pro visitors row.
      subs: [
        { key: "sales", label: "Sales", definition: "New pros whose owner clicked through a Sales landing (Outreach or Showcase) at some point. Server-side click signal, not first-touch attribution.", source: "supabase" as MetricSource,
          total: newProsSalesClickerTotal, datapoints: newProsSalesClickerSeries },
        { key: "invites", label: "Invites", definition: "New pros whose owner clicked through a project-invite landing. Server-side click signal.", source: "supabase" as MetricSource,
          total: newProsInvitesClickerTotal, datapoints: newProsInvitesClickerSeries },
        { key: "email", label: "Email", definition: "New pros whose first touch was an Arco transactional email (utm_source=arco_pro)", source: "supabase" as MetricSource,
          total: newProsBySourceTotals.email, datapoints: newProsBySource.email },
        { key: "direct", label: "Direct", definition: "New pros whose first touch was Direct (typed URL, bookmark, or no referrer), excluding those who later clicked an Outreach or Invite email (counted under Sales / Invites instead).", source: "supabase" as MetricSource,
          total: newProsDirectAdjustedTotal, datapoints: newProsDirectAdjustedSeries },
        { key: "google", label: "SEO", definition: "New pros whose first touch was a search engine", source: "supabase" as MetricSource,
          total: newProsBySourceTotals.google, datapoints: newProsBySource.google },
        { key: "social", label: "Social", definition: "New pros whose first touch was a social network", source: "supabase" as MetricSource,
          total: newProsBySourceTotals.social, datapoints: newProsBySource.social },
        { key: "referral", label: "Referral", definition: "New pros whose first touch was another website", source: "supabase" as MetricSource,
          total: newProsBySourceTotals.referral, datapoints: newProsBySource.referral },
        { key: "shares", label: "Shares", definition: "New pros whose first touch was a tagged share URL", source: "supabase" as MetricSource,
          total: newProsBySourceTotals.shares, datapoints: newProsBySource.shares },
        { key: "open_drafts", label: "Open drafts", definition: "Pros currently in draft — onboarding not yet completed", source: "supabase" as MetricSource, total: totalOpenDrafts, datapoints: openDraftsSeries },
      ],
    },
    {
      key: "actives", label: "Listed Pros", definition: "Pros currently in listed state as of the end of each period (cumulative snapshot). Stamped by listed_at on the first transition into 'listed'.", source: "supabase" as MetricSource, driver: "retention",
      total: totalListedSnapshot, datapoints: listedSnapshotSeries, labels,
      // Parent-level CR — share of currently-listed pros that are
      // currently indexed by Google. The earlier "to Publishers" CR
      // moved underneath the Publishable pros sub, where the
      // denominator (only pros eligible to publish) makes the rate
      // meaningful — comparing publishers to ALL listed pros (incl.
      // contractors / suppliers who can't publish anyway) understates
      // the real publishing motion.
      extraCRs: [
        { label: "% Ranked Pros", numerator: indexedListedSnapshotSeries, denominator: listedSnapshotSeries },
      ],
      subs: [
        {
          key: "publishable_pros",
          label: "Publishable pros",
          definition: "Listed pros whose primary service can publish project portfolios (Architect, Interior Designer, Photographer, Garden designer). Cumulative snapshot at each bucket end.",
          source: "supabase" as MetricSource,
          total: totalPublishableProsSnapshot,
          datapoints: publishableProsSnapshotSeries,
          customCR: {
            label: "% Publishing",
            numerator: publishersBucketed,
            denominator: publishableProsSnapshotSeries,
          },
        },
        { key: "unlisted_pros", label: "Unlisted pros", definition: "Pros currently in unlisted state", source: "supabase" as MetricSource, total: totalUnlistedSnapshot, datapoints: unlistedSnapshotSeries },
        {
          // Ranked pros — listed pros that Google has actually indexed.
          // Same cumulative snapshot series used by the parent-level
          // % Ranked Pros CR, surfaced here as an absolute count with
          // the supporting SEO metrics (Impressions / CTR / Clicks)
          // rendered underneath as value rows.
          key: "ranked_pros",
          label: "Ranked pros",
          definition: "Listed pros currently indexed by Google (cumulative snapshot at each bucket end). Numerator for the % Ranked Pros CR shown under Listed Pros.",
          source: "supabase" as MetricSource,
          total: totalIndexedListedSnapshot,
          datapoints: indexedListedSnapshotSeries,
          valueRows: [
            { label: "Impressions", values: seoImpressionsSeries, tone: "muted", format: "integer" },
            { label: "CTR",         values: seoCtrSeries,         tone: "accent", format: "percent" },
            { label: "Clicks",      values: seoClicksSeries,      tone: "muted", format: "integer" },
          ],
        },
      ],
    },
    {
      // Leading metric flipped to Published projects (Publishers demoted
      // to a sub) — published volume is the primary retention signal,
      // unique publisher count is supporting context.
      key: "published_projects", label: "Published projects", definition: "Total projects published in the period", source: "supabase" as MetricSource, driver: "retention",
      total: publishedProjectDates.length, ...publishedProjectsBuckets,
      subs: [
        {
          key: "publishers",
          label: "Publishers",
          definition: "Unique companies that published at least one project in the period",
          total: totalPublishersInWindow,
          datapoints: publishersBucketed,
          // Of the publishers in this period, what % also invited at
          // least one other professional to one of their projects.
          // Numerator: companies that BOTH published AND invited in the
          // same bucket. Denominator: publishers.
          customCR: {
            label: "% Inviting",
            numerator: publishersInvitingBucketed,
            denominator: publishersBucketed,
          },
        },
        { key: "projects_per_publisher", label: "Projects/publisher", definition: "Avg. published projects per publishing company", total: projectsPerPublisher, datapoints: projectsPerPublisherSeries },
        // Cumulative snapshot — all published projects ever, as of
        // each bucket end. The "% Ranked Projects" CR below this sub
        // shows the share that's currently indexed by Google
        // (numerator from the same projects table, filtered to
        // seo_indexed=true).
        {
          key: "total_projects",
          label: "Total Projects",
          definition: "Cumulative count of all published projects as of the end of each period",
          source: "supabase" as MetricSource,
          total: totalPublishedSnapshot,
          datapoints: totalPublishedSnapshotSeries,
          customCR: {
            label: "% Ranked Projects",
            numerator: indexedPublishedSnapshotSeries,
            denominator: totalPublishedSnapshotSeries,
          },
        },
        {
          // Ranked projects — published projects that Google has indexed.
          // Same cumulative series used by % Ranked Projects under Total
          // Projects, exposed as an absolute count with supporting SEO
          // metrics (Impressions / CTR / Clicks) underneath. Mirrors the
          // Ranked pros sub under Listed Pros.
          key: "ranked_projects",
          label: "Ranked projects",
          definition: "Published projects currently indexed by Google (cumulative snapshot at each bucket end). Numerator for the % Ranked Projects CR shown under Total Projects.",
          source: "supabase" as MetricSource,
          total: totalIndexedPublishedSnapshot,
          datapoints: indexedPublishedSnapshotSeries,
          valueRows: [
            { label: "Impressions", values: projectImpressionsSeries, tone: "muted", format: "integer" },
            { label: "CTR",         values: projectCtrSeries,         tone: "accent", format: "percent" },
            { label: "Clicks",      values: projectClicksSeries,      tone: "muted", format: "integer" },
          ],
        },
      ],
    },
    {
      // Leading metric flipped to Invited Pros (Inviters demoted to a
      // sub) — invitation volume is the primary retention signal,
      // unique inviter count is supporting context. Same shape as the
      // Publishers→Published projects flip directly above.
      key: "invited_pros", label: "Invited Pros", definition: "Total professionals invited in the period", source: "supabase" as MetricSource, driver: "retention",
      total: totalInvited, datapoints: totalInvitedSeries, labels: [] as string[],
      subs: [
        { key: "inviters", label: "Inviters", definition: "Unique companies that invited one or more professionals on a project", total: totalInvitersInWindow, datapoints: invitersBucketed },
        { key: "invites_per_project", label: "Invites/project", definition: "Avg. professionals invited per inviting project", total: invitesPerProject, datapoints: invitesPerProjectSeries },
      ],
    },
    {
      key: "responders", label: "Responders", definition: "Unique companies that received an inquiry", source: "posthog" as MetricSource, driver: "retention",
      total: respondersBucketed.total, datapoints: respondersBucketed.series, labels,
      subs: [
        // lead_responded event isn't wired in product yet — counts stay
        // 0 until trackLeadResponded starts firing. Cache is ready when
        // the event lands; no code change needed at that point.
        { key: "replies", label: "Replies", definition: "Total replies sent to client inquiries", total: 0, datapoints: empty8 },
      ],
    },
    {
      key: "subscribers", label: "Subscribers", definition: "Unique first time subscriptions", source: "supabase" as MetricSource, driver: "monetization",
      total: subscribedDates.length, ...subscribers,
      subs: [
        { key: "mrr", label: "MRR", definition: "Monthly recurring revenue", total: 0, datapoints: empty8 },
      ],
    },
    // Renewers / Expanders / Contractors removed from the table view.
    // They were placeholder rows with no real data and they no longer
    // appear in the lifecycle view either. Will return as supporting
    // metrics on the Subscribers card when subscription billing is wired.
    {
      key: "churn", label: "Churners", definition: "Unique companies that cancelled or let their subscription expire", source: "supabase" as MetricSource, driver: "churn",
      total: 0, datapoints: empty8, labels,
      subs: [
        { key: "lost", label: "Lost", definition: "Companies that left the platform", total: 0, datapoints: empty8 },
      ],
    },
    // Separator
    {
      key: "_sep", label: "", driver: "acquisition",
      total: 0, datapoints: empty8, labels,
      subs: [],
    },
    // ── Clients ────────────────────────────────────────────────────────
    {
      key: "client_visitors", label: "Visitors", definition: "Unique visitors across the entire site (matches PostHog Web Analytics)", source: "posthog" as MetricSource, driver: "acquisition",
      total: clientVisitorsBucketed.total, datapoints: clientVisitorsBucketed.series, labels,
      subs: [
        // Each source sub carries its visitor volume (denominator) +
        // a crNumerator with source-attributed signups (numerator).
        // The model-client renders a per-source CR row underneath
        // using these two series. Signup attribution comes from
        // PostHog's $initial_referring_domain person property so a
        // visitor who first arrived from Google and signed up two
        // weeks later still credits Google.
        {
          key: "direct", label: "Direct", definition: "Typed URL, bookmark, or no referrer",
          total: clientVisitorsDirectBucketed.total, datapoints: clientVisitorsDirectBucketed.series,
          crNumerator: { total: clientSignupsDirectBucketed.total, datapoints: clientSignupsDirectBucketed.series },
        },
        {
          key: "google", label: "SEO", definition: "Visitors from search engines (Google, Bing, DuckDuckGo, Yahoo, Ecosia, Brave, Qwant, Startpage)",
          total: clientVisitorsGoogleBucketed.total, datapoints: clientVisitorsGoogleBucketed.series,
          crNumerator: { total: clientSignupsGoogleBucketed.total, datapoints: clientSignupsGoogleBucketed.series },
        },
        {
          key: "social", label: "Social", definition: "LinkedIn, Facebook, Instagram, X, Pinterest",
          total: clientVisitorsSocialBucketed.total, datapoints: clientVisitorsSocialBucketed.series,
          crNumerator: { total: clientSignupsSocialBucketed.total, datapoints: clientSignupsSocialBucketed.series },
        },
        {
          key: "email", label: "Email", definition: "Visitors from Arco client emails (utm_source=arco_client) OR other email clients (Gmail, Outlook web)",
          total: clientVisitorsEmailBucketed.total, datapoints: clientVisitorsEmailBucketed.series,
          crNumerator: { total: clientSignupsEmailBucketed.total, datapoints: clientSignupsEmailBucketed.series },
        },
        {
          key: "referral", label: "Referral", definition: "Other websites linking to Arco",
          total: clientVisitorsReferralBucketed.total, datapoints: clientVisitorsReferralBucketed.series,
          crNumerator: { total: clientSignupsReferralBucketed.total, datapoints: clientSignupsReferralBucketed.series },
        },
        // Shares — share-driven traffic regardless of channel. Sits
        // alongside the 5 channel categories rather than inside them
        // because share visits overlap (a Direct-bucketed visit can
        // also be a Share visit if the user came via a copied link).
        // crNumerator = share-attributed signups (utm_source=share on
        // person.properties.$initial_utm_source) for the
        // "to Signups from Shares" CR rendered underneath.
        {
          key: "share", label: "Shares", definition: "Visitors arriving from a tagged share URL (utm_source=share). Overlaps the channel categories above — a share visit also has a referrer.",
          total: clientVisitorsShareBucketed.total, datapoints: clientVisitorsShareBucketed.series,
          crNumerator: { total: clientSignupsShareBucketed.total, datapoints: clientSignupsShareBucketed.series },
        },
      ],
    },
    {
      key: "client_signups", label: "Signups", definition: "Client profiles created in the period. Channel subs count the same rows grouped by profiles.first_touch_source so they sum to this total by construction.", source: "supabase" as MetricSource, driver: "acquisition",
      total: clientSignupDates.length, ...clientSignupsBucketedDb,
      subs: [
        { key: "direct", label: "Direct", definition: "Signups whose first touch was direct (no referrer)", source: "supabase" as MetricSource,
          total: clientSignupsBySourceTotals.direct, datapoints: clientSignupsBySource.direct },
        { key: "google", label: "SEO", definition: "Signups whose first touch was a search engine", source: "supabase" as MetricSource,
          total: clientSignupsBySourceTotals.google, datapoints: clientSignupsBySource.google },
        { key: "social", label: "Social", definition: "Signups whose first touch was a social network", source: "supabase" as MetricSource,
          total: clientSignupsBySourceTotals.social, datapoints: clientSignupsBySource.social },
        { key: "email", label: "Email", definition: "Signups whose first touch was an email (webmail referrer or Arco email UTM)", source: "supabase" as MetricSource,
          total: clientSignupsBySourceTotals.email, datapoints: clientSignupsBySource.email },
        { key: "referral", label: "Referral", definition: "Signups whose first touch was another website", source: "supabase" as MetricSource,
          total: clientSignupsBySourceTotals.referral, datapoints: clientSignupsBySource.referral },
        { key: "share", label: "Shares", definition: "Signups whose first touch was a tagged share URL", source: "supabase" as MetricSource,
          total: clientSignupsBySourceTotals.shares, datapoints: clientSignupsBySource.shares },
      ],
    },
    {
      key: "active_clients", label: "Monthly active clients", definition: "Unique clients active in the trailing 30 days", source: "posthog" as MetricSource, driver: "retention",
      total: totalActiveClients, datapoints: activeClientsSeries, labels,
      extraCRs: [
        { label: "% Sharers", numerator: sharersBucketed.series, denominator: activeClientsSeries },
        { label: "% Savers", numerator: uniqueSaversBucketed.datapoints, denominator: activeClientsSeries },
        { label: "% Contacters", numerator: contactersBucketed.series, denominator: activeClientsSeries },
      ],
      subs: [
        {
          key: "retained_clients", label: "Retained clients",
          definition: "Clients active this period that were also active last period (MAU prior − Newly dormant)",
          source: "posthog" as MetricSource, total: totalRetainedClients, datapoints: retainedClientsSeries,
          customCR: { label: "% Retained", numerator: retainedClientsSeries, denominator: priorMACSeries },
        },
        {
          key: "re_engaged_clients", label: "Re-engaged clients",
          definition: "Clients back after 30+ days inactive. % = Re-engaged ÷ (clients seen in last 12 months − prior MAU).",
          source: "posthog" as MetricSource, total: totalReEngagedClients, datapoints: reEngagedClientsSeries,
          customCR: { label: "% Re-activated", numerator: reEngagedClientsSeries, denominator: priorDormantSeries },
        },
        {
          key: "newly_dormant_clients", label: "Newly dormant clients",
          definition: "Clients that crossed the 30-day inactivity threshold",
          source: "posthog" as MetricSource, total: totalDormantClients, datapoints: dormantClientsSeries,
          customCR: { label: "% Churn", numerator: dormantClientsSeries, denominator: priorMACSeries },
        },
      ],
    },
    {
      key: "sharers", label: "Sharers", definition: "Unique clients that shared a project or professional", source: "posthog" as MetricSource, driver: "retention",
      total: sharersBucketed.total, datapoints: sharersBucketed.series, labels,
      subs: [
        { key: "shares_per_client", label: "Shares/client", definition: "Average shares per active sharer", source: "posthog" as MetricSource, total: sharesPerClientTotal, datapoints: sharesPerClientSeries },
        { key: "projects_shared", label: "Projects shared", definition: "Total projects shared", source: "posthog" as MetricSource, total: projectSharesBucketed.total, datapoints: projectSharesBucketed.series },
        { key: "professionals_shared", label: "Professionals shared", definition: "Total professionals shared", source: "posthog" as MetricSource, total: professionalSharesBucketed.total, datapoints: professionalSharesBucketed.series },
      ],
    },
    {
      key: "savers", label: "Savers", definition: "Unique clients that saved a project or professional", source: "supabase" as MetricSource, driver: "retention",
      total: uniqueSavers, ...uniqueSaversBucketed,
      subs: [
        { key: "saves_per_client", label: "Saves/client", definition: "Average saves per active saver", source: "supabase" as MetricSource, total: savesPerClient, datapoints: savesPerClientSeries },
        { key: "projects_saved", label: "Projects saved", definition: "Total projects saved", source: "supabase" as MetricSource, total: savedProjectDates.length, datapoints: savers.datapoints },
        { key: "pros_saved", label: "Professionals saved", definition: "Total professionals saved", source: "supabase" as MetricSource, total: savedCompanyDates.length, datapoints: savedPros.datapoints },
      ],
    },
    {
      key: "inquirers", label: "Contacters", definition: "Unique clients that contacted a professional via the platform", source: "posthog" as MetricSource, driver: "retention",
      total: contactersBucketed.total, datapoints: contactersBucketed.series, labels,
      subs: [
        // "Professionals contacted" needs a separate cached metric for
        // unique target-pro counts per period — different person_id
        // axis than the actor cache (contacters counts senders, this
        // would count recipients). Leave as placeholder for now.
        { key: "contacted", label: "Professionals contacted", definition: "Unique professionals contacted by clients", source: "posthog" as MetricSource, total: 0, datapoints: empty8 },
      ],
    },
  ]

  return { rows, labels }
}
