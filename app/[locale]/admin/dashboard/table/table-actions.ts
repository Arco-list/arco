"use server"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { getSubscriberFacts } from "@/lib/subscriptions/subscriber-stats"
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

/**
 * Where a number comes from, shown as a pill beside its label.
 *
 * Not decoration: the three behave differently and the reader has to
 * know which they are looking at. A PostHog count is anonymous browser
 * identities, inflated while visitors sit on memory persistence. A
 * server number is a row in our own tables. A residual is whatever the
 * rows above did not claim, so every attribution failure lands in it
 * and it reads high rather than low.
 */
export type MetricSource = "posthog" | "supabase" | "residual"

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
  extraCRs?: Array<{ label: string; numerator: number[]; denominator: number[]; definition?: string; immatureFromIndex?: number }>
  /** Cohorted replacement for the view-built inline CR: members bucketed
   *  by first touch, numerator = ever converted. Table view renders this
   *  instead of deriving "to <next row>" when present. */
  cohortInlineCR?: { label: string; numerator: number[]; denominator: number[]; definition?: string; immatureFromIndex?: number }
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
    customCR?: { label: string; numerator: number[]; denominator: number[]; definition?: string; immatureFromIndex?: number }
    /** Optional set of absolute-value rows rendered underneath this sub
     *  at CR-row size (10px). Each row carries its own label, per-bucket
     *  values and a tone — "muted" reads as grey, "accent" as teal. Use
     *  for supporting absolute metrics that aren't conversion rates
     *  (e.g. SEO impressions / clicks alongside CTR under Ranked pros). */
    valueRows?: Array<{ label: string; values: number[]; tone?: "muted" | "accent"; format?: "integer" | "percent" | "decimal"; definition?: string }>
    /** Render valueRows above the sub's CR rows instead of below. */
    valueRowsFirst?: boolean
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

/** Supabase/PostgREST caps every response at 1,000 rows regardless of
 *  .limit(). Every "read the whole table" query here must page or the
 *  growth metrics silently undercount as tables grow past 1,000 rows
 *  (first bitten by the 1,000-prospect Apollo import). Returns the
 *  familiar { data } shape so call sites stay unchanged. */
async function fetchAllRows<T = any>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message?: string } | null }>,
  hardCap = 50_000,
): Promise<{ data: T[]; error: { message?: string } | null }> {
  const rows: T[] = []
  for (let from = 0; from < hardCap; from += 1000) {
    const { data, error } = await build(from, Math.min(from + 999, hardCap - 1))
    if (error) return { data: rows, error }
    const page = (data ?? []) as T[]
    rows.push(...page)
    if (page.length < 1000) break
  }
  return { data: rows, error: null }
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
    claimArrivalsResult,
    publishableCategoriesResult,
    outboundLogsResult,
    allContactsResult,
  ] = await Promise.all([
    fetchAllRows((f, t) => supabase.from("profiles").select("id, user_types, created_at, first_touch_source").order("id").range(f, t)),
    fetchAllRows((f, t) => supabase.from("companies").select("id, status, created_at, updated_at, owner_id, seo_indexed, onboarded_at, listed_at, seo_indexed_at, first_touch_source, primary_service_id, seo_impressions_28d, seo_clicks_28d").order("id").range(f, t)),
    fetchAllRows((f, t) => supabase.from("projects").select("id, status, client_id, created_at, updated_at, published_at, seo_indexed, seo_impressions_28d, seo_clicks_28d").order("id").range(f, t)),
    fetchAllRows((f, t) => supabase.from("project_professionals").select("id, professional_id, company_id, is_project_owner, project_id, created_at, invited_email, invited_at, landing_visited_at, status, responded_at, updated_at").order("id").range(f, t)),
    fetchAllRows((f, t) => supabase.from("saved_projects").select("user_id, project_id, created_at").order("created_at").range(f, t)),
    fetchAllRows((f, t) => supabase.from("saved_companies").select("user_id, company_id, created_at").order("created_at").range(f, t)),
    fetchAllRows((f, t) => supabase.from("prospects").select("id, email, company_id, apollo_contact_id").order("id").range(f, t)),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fetchAllRows((f, t) => (supabase as any).from("claim_arrivals").select("channel, email, created_at").order("id").range(f, t)),
    supabase.from("categories").select("id, slug").in("slug", PUBLISHABLE_SERVICE_SLUGS),
    // Outbound metric inputs — manual logs from admin/companies and the
    // Sales page. 'note' is excluded (observations, not outbound
    // activity); 'no_answer' outcomes are excluded too — the metric
    // measures *successful* contact, not attempts. Each log row carries
    // EITHER company_contact_id (new admin/companies path) OR
    // prospect_id (Sales page legacy path); we resolve to person_id
    // downstream via whichever FK is present.
    fetchAllRows((f, t) => supabase.from("outbound_contact_log")
      .select("created_at, kind, outcome, company_contact_id, prospect_id")
      .neq("kind", "note")
      .or("outcome.is.null,outcome.neq.no_answer")
      .gte("created_at", from.toISOString())
      .order("created_at")
      .range(f, t)),
    fetchAllRows((f, t) => supabase.from("company_contacts").select("id, person_id, company_id").order("id").range(f, t)),
  ])

  const profiles = (profilesResult.data ?? []) as any[]
  const companies = (companiesResult.data ?? []) as any[]
  const projects = (projectsResult.data ?? []) as any[]
  const invites = (invitesResult.data ?? []) as any[]
  const savedProjects = (savedProjectsResult.data ?? []) as any[]
  const savedCompanies = (savedCompaniesResult.data ?? []) as any[]
  const prospects = (prospectsResult.data ?? []) as any[]
  const outboundLogs = (outboundLogsResult.data ?? []) as any[]
  const allContacts = (allContactsResult.data ?? []) as any[]
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
    "client_visitors_ai",
    "client_visitors_paid",
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
    // Empty map, not a crash, for a key this loader does not carry.
    // CACHED_KEYS above and CACHED_METRIC_KEYS in growth-metric-cache
    // are two hand-kept lists of the same thing: one says what gets
    // synced, the other what gets loaded here. Adding a channel to the
    // first and forgetting the second took the whole dashboard down
    // with "Cannot read properties of undefined (reading 'get')" —
    // a rendering bug reported as a blank page, for a metric nobody
    // had asked for yet. A key that is missing, or simply never synced,
    // should read as zero.
    const map = cacheByKey[key] ?? new Map<string, number>()
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
  // Visitor source breakdowns — first-class sub-rows under the
  // Visitors leading metric.
  const clientVisitorsDirectBucketed = bucketize("client_visitors_direct")
  const clientVisitorsAiBucketed = bucketize("client_visitors_ai")
  const clientVisitorsPaidBucketed = bucketize("client_visitors_paid")
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

  // Publishable pros — same cumulative-listed snapshot, narrowed to
  // pros whose primary service can publish project portfolios
  // (Architect / Interior Designer / Photographer / Garden designer).
  // Other service categories (contractors, suppliers, etc.) get
  // invited to projects but don't publish their own. Denominator for
  // the "% Publishing" CR: of pros currently eligible to publish, how
  // many published at least one project in the period.

  // ── Total Listed Pros, and how many of them are contributors ─────────
  //
  // Demoted from a headline to a supporting metric when New Pros and
  // Listed Pros merged. A cumulative count is not a conversion, and a
  // funnel that leads with one invites the reader to celebrate
  // accumulation — the number only ever goes up.
  //
  // Listed rather than all claimed pros, and deliberately: it is the
  // same population % Ranked divides into, so the two supporting
  // metrics can be read against each other instead of against two
  // different denominators sitting one row apart.
  //
  // Contributors are pros whose primary service cannot publish a
  // portfolio: contractors, suppliers, craftspeople. They reach the
  // platform by being credited on somebody else's project rather than
  // by publishing their own, so the share of them describes what kind
  // of network this is becoming — and it is the same split that used
  // to be read backwards off Publishable pros.
  const totalListedSnapshot = listedSnapshotSeries[listedSnapshotSeries.length - 1] ?? 0
  const contributorProsSnapshotSeries = buckets.ends.map((bucketEnd) =>
    companies.filter((c: any) =>
      c.status === "listed"
      && claimedCompanies(c)
      && c.listed_at != null
      && !publishableCategoryIds.has(c.primary_service_id)
      && new Date(c.listed_at) <= bucketEnd,
    ).length,
  )

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

  // SEO supporting metrics — 28-day rolling totals aggregated across
  // listed + indexed pros. `seo_impressions_28d` / `seo_clicks_28d` are
  // refreshed nightly per company by /api/cron/sync-gsc-indexation,
  // which ALSO appends the aggregate to seo_metric_snapshots (one row
  // per day per scope). Historical buckets read the snapshot nearest
  // their bucket end; the rolling bucket uses the live per-row sums.
  // Buckets before the first snapshot (pre Aug 2026) render as dots.
  // CTR is recomputed from summed clicks ÷ impressions per bucket so
  // it weights by traffic, not a flat average.
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
  // True per-bucket sums from seo_daily_metrics (daily GSC rows,
  // path-filtered per scope). Replaces the earlier rolling-28d snapshot
  // sampling, which rendered a 4x-wide overlapping window as if it were
  // the bucket's own traffic. The last (partial) bucket sums whatever
  // days GSC has finalized so far.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: seoDailyRows } = await (supabase as any)
    .from("seo_daily_metrics")
    .select("metric_date, scope, impressions, clicks")
    .order("metric_date")
  const seoSnapshotSeries = (
    scope: "projects" | "companies",
    _liveImpressions: number,
    _liveClicks: number,
    _liveCtr: number,
  ): { impressions: number[]; clicks: number[]; ctr: number[] } => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = ((seoDailyRows ?? []) as any[])
      .filter((r) => r.scope === scope)
      .map((r) => ({
        date: new Date(`${r.metric_date}T12:00:00Z`),
        imp: Number(r.impressions) || 0,
        clicks: Number(r.clicks) || 0,
      }))
    const impressions: number[] = []
    const clicks: number[] = []
    const ctr: number[] = []
    buckets.starts.forEach((start, i) => {
      const end = buckets.ends[i]
      let imp = 0
      let clk = 0
      for (const r of rows) {
        if (r.date >= start && r.date < end) {
          imp += r.imp
          clk += r.clicks
        }
      }
      impressions.push(imp)
      clicks.push(clk)
      ctr.push(imp > 0 ? Math.round((clk / imp) * 100) : 0)
    })
    return { impressions, clicks, ctr }
  }
  const prosSeoSeries = seoSnapshotSeries("companies", totalSeoImpressions, totalSeoClicks, aggregateCtrPct)
  const seoImpressionsSeries = prosSeoSeries.impressions
  const seoClicksSeries = prosSeoSeries.clicks
  const seoCtrSeries = prosSeoSeries.ctr

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
  // 14/15 currently-indexed projects have published_at = NULL (early
  // rows never got the timestamp stamped) — using strict published_at
  // dropped them from the cumulative snapshot, and Ranked Projects
  // read as "1" instead of the real 15. Fall back to created_at when
  // published_at is missing so pre-stamp rows still land in a bucket.
  const publishedTsForBucket = (p: any): Date | null => {
    const iso = p.published_at ?? p.created_at ?? null
    if (!iso) return null
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? null : d
  }
  // Same fallback shape for New Pros. `onboarded_at` is stamped by a
  // trigger on the first draft→non-draft transition, but rows created
  // directly at status='listed' (bypassing draft) miss that path and
  // land here with a NULL onboarded_at. Fall back to listed_at, then
  // created_at, so pre-stamp rows still bucket.
  const onboardedTsForBucket = (c: any): Date | null => {
    const iso = c.onboarded_at ?? c.listed_at ?? c.created_at ?? null
    if (!iso) return null
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const totalPublishedSnapshotSeries = buckets.ends.map((bucketEnd) =>
    projects.filter((p: any) => {
      if (p.status !== "published") return false
      const ts = publishedTsForBucket(p)
      return ts !== null && ts <= bucketEnd
    }).length,
  )
  const totalPublishedSnapshot = totalPublishedSnapshotSeries[totalPublishedSnapshotSeries.length - 1] ?? 0

  // Indexed published projects — same cumulative snapshot narrowed to
  // currently seo_indexed=true rows. Numerator for "% Ranked Projects".
  const indexedPublishedSnapshotSeries = buckets.ends.map((bucketEnd) =>
    projects.filter((p: any) => {
      if (p.status !== "published") return false
      if (p.seo_indexed !== true) return false
      const ts = publishedTsForBucket(p)
      return ts !== null && ts <= bucketEnd
    }).length,
  )
  const totalIndexedPublishedSnapshot = indexedPublishedSnapshotSeries[indexedPublishedSnapshotSeries.length - 1] ?? 0

  // SEO supporting metrics for projects — same snapshot-backed series
  // as the pros version (historical buckets from seo_metric_snapshots,
  // live sums in the rolling bucket).
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
  const projectsSeoSeries = seoSnapshotSeries("projects", totalProjectImpressions, totalProjectClicks, projectAggregateCtrPct)
  const projectImpressionsSeries = projectsSeoSeries.impressions
  const projectClicksSeries = projectsSeoSeries.clicks
  const projectCtrSeries = projectsSeoSeries.ctr

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
  // Contributors accepted — non-owner invite rows whose status moved past
  // 'invited': the pro responded and picked how to appear (unlisted /
  // listed / live_on_page). None of the accept flows stamp responded_at
  // yet, so fall back to updated_at as the acceptance moment — imprecise
  // if the row is edited later (e.g. cover photo changes), acceptable at
  // current volumes.
  const acceptanceDate = (pp: any): Date | null => {
    const ts = pp.responded_at ?? pp.updated_at
    return ts ? new Date(ts) : null
  }
  const acceptedRows = nonOwnerInvites.filter((pp: any) => pp.status && pp.status !== "invited")
  const bucketByAcceptance = (rows: any[]): number[] =>
    buckets.starts.map((_, i) => {
      let n = 0
      for (const pp of rows) {
        const d = acceptanceDate(pp)
        if (d && d >= buckets.starts[i] && d < buckets.ends[i]) n++
      }
      return n
    })
  // ── New contributors, and the invites they came from ─────────────────
  //
  // Unique COMPANIES, dated by their first acceptance — not accepted
  // credit rows. A firm credited on four projects is one contributor
  // who arrived once; counting rows made the funnel's last retention
  // step rise with the enthusiasm of a single architect.
  //
  // These overlap New Pros on purpose, and it is worth knowing which
  // half: accepting a credit on a published project auto-lists the
  // company (lib/companies/sync-listed-status.ts), so a contributor
  // that has CLAIMED its page is stamped with listed_at and shows up
  // in New Pros too. One that never claimed has no owner, fails
  // onboardingCompleted, and appears here only. The two rows are
  // therefore not disjoint and were never meant to be — this is the
  // same company arriving through a different door.
  const firstAcceptanceByCompany = new Map<string, Date>()
  for (const pp of acceptedRows as any[]) {
    const d = acceptanceDate(pp)
    const cid = pp.company_id ? String(pp.company_id) : null
    if (!d || !cid) continue
    const prev = firstAcceptanceByCompany.get(cid)
    if (!prev || d < prev) firstAcceptanceByCompany.set(cid, d)
  }

  // Unique companies first invited in each bucket, and how many of
  // them ever accepted. Per company rather than per invite: the rate
  // asks whether a firm responded, and three tags of the same firm is
  // one firm deciding once.
  const firstInviteByCompany = new Map<string, Date>()
  for (const pp of nonOwnerInvites as any[]) {
    if (!pp.created_at || !pp.company_id) continue
    const d = new Date(pp.created_at)
    if (Number.isNaN(d.getTime())) continue
    const cid = String(pp.company_id)
    const prev = firstInviteByCompany.get(cid)
    if (!prev || d < prev) firstInviteByCompany.set(cid, d)
  }
  const totalUniqueInvited = [...firstInviteByCompany.values()].filter((d) => d >= from).length
  // Which projects carry a credit at all, how many each, and which
  // were published inside a given bucket. Shared by the two series
  // below; the rows that used to own these helpers are gone.
  const creditedProjectIds = new Set<string>(
    nonOwnerInvites.map((pp: any) => pp.project_id).filter(Boolean),
  )
  const creditCountByProject = new Map<string, number>()
  for (const pp of nonOwnerInvites as any[]) {
    if (!pp.project_id) continue
    creditCountByProject.set(pp.project_id, (creditCountByProject.get(pp.project_id) ?? 0) + 1)
  }
  const publishedInBucket = (i: number): any[] =>
    projects.filter((p: any) => {
      if (p.status !== "published" || !p.published_at) return false
      const d = new Date(p.published_at)
      return d >= buckets.starts[i] && d < buckets.ends[i]
    })

  // ── Accepted credits, cumulative ─────────────────────────────────────
  //
  // Sits under Total Projects, so it is bucketed the way Total
  // Projects is: every published project up to the bucket end, not
  // the ones published inside it. A cumulative parent with a
  // per-period child would have the rate wandering against a
  // denominator that never moves the same way.
  //
  // ACCEPTED, not invited. The pair on the parent row counts credits
  // sent; these count credits the other company said yes to. The gap
  // between them is the acceptance rate doing its work, and reading
  // both is how you tell "nobody is being credited" from "nobody is
  // responding".
  const acceptedProjectIds = new Set<string>(
    acceptedRows.map((pp: any) => pp.project_id).filter(Boolean).map(String),
  )
  const acceptedCountByProject = new Map<string, number>()
  for (const pp of acceptedRows as any[]) {
    if (!pp.project_id) continue
    const k = String(pp.project_id)
    acceptedCountByProject.set(k, (acceptedCountByProject.get(k) ?? 0) + 1)
  }
  const publishedUpTo = (bucketEnd: Date): any[] =>
    projects.filter((p: any) => {
      if (p.status !== "published") return false
      const ts = publishedTsForBucket(p)
      return ts !== null && ts <= bucketEnd
    })
  const projectsWithAcceptedSeries = buckets.ends.map((bucketEnd) =>
    publishedUpTo(bucketEnd).filter((p: any) => acceptedProjectIds.has(String(p.id))).length,
  )
  // Averaged over every published project, including those with no
  // accepted credit — the percentage beside it already says how many
  // have one, so dividing by only those would make the two say the
  // same thing twice.
  const acceptedPerProjectSeries = buckets.ends.map((bucketEnd) => {
    const published = publishedUpTo(bucketEnd)
    if (published.length === 0) return 0
    const credits = published.reduce(
      (sum: number, p: any) => sum + (acceptedCountByProject.get(String(p.id)) ?? 0), 0,
    )
    // Two decimals, not one. At current volume this average is a few
    // hundredths — 0.047 rounds to 0.0 on one decimal, and the table
    // renders a bare 0 as "·", so the row appeared to have no value at
    // all. A metric that reads as broken when it is merely small
    // teaches the reader to distrust the column.
    return Math.round((credits / published.length) * 100) / 100
  })

  // ── Credits on the projects published in each period ─────────────────
  //
  // Per-period, not cumulative, because they hang under New Projects
  // and New Projects is a flow. Both read the same cohort the parent
  // counts — projects published INSIDE the bucket — so the rate cannot
  // exceed 100% and the average is about the same projects.
  //
  // The pair answers two different questions and needs both. The
  // average is depth: when an owner credits anyone, how many trades do
  // they name. The percentage is breadth: how many owners credit
  // anyone at all. A single number hides whichever half is failing —
  // an average of 2.0 reads healthy whether every project credits two
  // people or a fifth of them credit ten.
  const newProjectsWithContributorsSeries = buckets.starts.map((_, i) =>
    publishedInBucket(i).filter((p: any) => creditedProjectIds.has(p.id)).length,
  )
  const creditsPerNewProjectSeries = buckets.starts.map((_, i) => {
    const published = publishedInBucket(i)
    if (published.length === 0) return 0
    const credits = published.reduce(
      (sum: number, p: any) => sum + (creditCountByProject.get(p.id) ?? 0), 0,
    )
    return Math.round((credits / published.length) * 10) / 10
  })
  const creditsPerNewProjectTotal = (() => {
    const all = projects.filter((p: any) =>
      p.status === "published" && p.published_at && new Date(p.published_at) >= from,
    )
    if (all.length === 0) return 0
    const credits = all.reduce(
      (sum: number, p: any) => sum + (creditCountByProject.get(p.id) ?? 0), 0,
    )
    return Math.round((credits / all.length) * 10) / 10
  })()

  // ── Subscribers ───────────────────────────────────────────────────────
  //
  // Three shapes from one set of facts, and they are not the same
  // shape. New Subscribers is a FLOW: who started inside each bucket.
  // Total Subscribers and MRR are STOCKS: who was holding Pro at the
  // END of each bucket, which is how Listed Pros is already counted.
  // Mixing the two is how a monetization row ends up showing growth
  // that is really just accumulation.
  const subscriberFacts = await getSubscriberFacts()

  const subscribers = bucket8(
    subscriberFacts
      .map((f) => (f.startedAt ? new Date(f.startedAt) : null))
      .filter((d): d is Date => d !== null && !Number.isNaN(d.getTime())),
    buckets,
  )

  const heldAtBucketEnd = (i: number) => {
    const end = buckets.ends[i]
    return subscriberFacts.filter((f) => {
      if (!f.startedAt) return false
      const start = new Date(f.startedAt)
      if (Number.isNaN(start.getTime()) || start >= end) return false
      if (!f.endedAt) return true
      const stop = new Date(f.endedAt)
      return Number.isNaN(stop.getTime()) || stop >= end
    })
  }

  const totalSubscribersSeries = new Array(8).fill(0).map((_, i) => heldAtBucketEnd(i).length)
  const mrrSeries = new Array(8).fill(0).map((_, i) =>
    heldAtBucketEnd(i).reduce((sum, f) => sum + f.monthlyCents, 0),
  )
  // Rounded to whole euros here, because the table renders plain
  // integers: handing it cents would print 5929 where the card prints
  // €59.
  const mrrEuroSeries = mrrSeries.map((c) => Math.round(c / 100))
  const avgMrrEuroSeries = mrrSeries.map((c, i) =>
    totalSubscribersSeries[i] > 0 ? Math.round(c / totalSubscribersSeries[i] / 100) : 0,
  )

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

  // New actives — the balancing item that closes the identity above:
  // clients active this period who weren't active last period and aren't
  // re-engaged returns, i.e. first-time actives. Without this sub the
  // visible rows (Retained + Re-engaged + Newly dormant) can't reconcile
  // to the parent MAU number.
  const newActiveClientsSeries = activeClientsSeries.map((v, i) =>
    i === 0 ? 0 : Math.max(0, v - retainedClientsSeries[i] - reEngagedClientsSeries[i]),
  )
  const totalNewActiveClients = newActiveClientsSeries[newActiveClientsSeries.length - 1] ?? 0

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
  const { data: salesEventsRaw } = await fetchAllRows((f, t) => (supabase as any)
    .from("email_events")
    .select("recipient_email, occurred_at")
    .eq("event_type", "sent")
    .eq("campaign_kind", "sales_outbound")
    .gte("occurred_at", from.toISOString())
    .order("occurred_at")
    .range(f, t))
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
  const { data: salesVisitEventsRaw } = await fetchAllRows((f, t) => (supabase as any)
    .from("prospect_events")
    .select("prospect_id, created_at")
    .eq("event_type", "prospect.landing_visited")
    .gte("created_at", from.toISOString())
    .order("created_at")
    .range(f, t))
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
  // The combined `allContactEvents` / `prosContactedSeries` /
  // `totalProsContacted` merge Sales + Invites + Outbound. Outbound
  // events are only available after the outbound resolution block
  // below, so those constants are declared there.

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

  // New Pros: companies that completed onboarding (left the Created
  // state) in the period, bucketed by companies.onboarded_at — a DB
  // trigger stamps this on the first 'created' → beyond transition (with
  // historical rows backfilled via LEAST(created_at, updated_at)).
  // Previously bucketed by updated_at, which moved on every admin edit
  // and bunched recently-edited pros onto the current bucket.
  // A company counts as a New Pro once a professional owns it. The
  // separate "complete onboarding" step was removed from the product —
  // the signup flow ends with a complete company page (status 'created'),
  // which goes live when a project is approved. Drafts therefore count
  // as New Pros; "% Listed (ever)" under the row shows how many made it
  // to listed, which is the metric to push.
  const onboardingCompleted = (c: any) => c.owner_id != null

  // ── Outbound metric ─────────────────────────────────────────────────
  // Sourced from manual logs in `outbound_contact_log` (the admin
  // Contacts cell "Log outbound" action). Each log row references a
  // company_contact; we resolve to person_id, then bucket the FIRST
  // outbound touch per person per bucket so the same person logged
  // twice in a week counts once.
  //
  // Overlaps with the other Pro visitors channels by design — see the
  // metric definition for the double-count caveat. Apollo drip emails
  // are NOT yet logged here; will appear automatically once the drip
  // queue writes outbound_contact_log rows on send.
  // Person lookups for outbound resolution. Logs reference EITHER
  // company_contact_id (new path) OR prospect_id (Sales page legacy
  // path). One persons fetch covers both: id, email, auth_user_id.
  const { data: personsForOutbound } = await fetchAllRows((f, t) => supabase
    .from("persons")
    .select("id, email, auth_user_id")
    .order("id")
    .range(f, t))
  const personIdByEmail = new Map<string, string>()
  const personIdByAuthUserId = new Map<string, string>()
  for (const p of personsForOutbound ?? []) {
    if (p.id && p.email) personIdByEmail.set(p.email.toLowerCase(), p.id)
    if (p.id && p.auth_user_id) personIdByAuthUserId.set(p.auth_user_id, p.id)
  }
  const contactById = new Map<string, { person_id: string; company_id: string }>()
  for (const cc of allContacts) {
    if (cc?.id) contactById.set(cc.id, { person_id: cc.person_id, company_id: cc.company_id })
  }
  // Resolve a log row → person_id. Tries company_contact first; falls
  // back to prospect.email → persons.email match.
  const prospectById = new Map<string, { email: string | null }>()
  for (const pr of prospects) {
    if (pr?.id) prospectById.set(pr.id, { email: pr.email ?? null })
  }
  const resolvePersonId = (log: any): string | null => {
    if (log.company_contact_id) {
      const link = contactById.get(log.company_contact_id)
      if (link?.person_id) return link.person_id
    }
    if (log.prospect_id) {
      const pr = prospectById.get(log.prospect_id)
      const email = pr?.email?.toLowerCase()
      if (email) {
        const pid = personIdByEmail.get(email)
        if (pid) return pid
      }
    }
    return null
  }
  // Convert each resolvable outbound log into a ContactEvent (email +
  // date), so Outbound folds into `allContactEvents` cleanly and the
  // Pros-contacted parent dedups a pro touched via Sales + Invites +
  // Outbound in the same period to a single count. Also keep the
  // by-person date map for the New-Pros-from-Outbound CR below.
  const personEmailById = new Map<string, string>()
  for (const p of personsForOutbound ?? []) {
    if (p.id && p.email) personEmailById.set(p.id, p.email.toLowerCase())
  }
  const outboundContactEvents: ContactEvent[] = []
  const outboundDatesByPerson = new Map<string, Date>()
  for (const log of outboundLogs) {
    const personId = resolvePersonId(log)
    if (!personId) continue
    const email = personEmailById.get(personId)
    if (!email) continue
    const date = new Date(log.created_at)
    outboundContactEvents.push({ email, date })
    const existing = outboundDatesByPerson.get(personId)
    if (!existing || date < existing) outboundDatesByPerson.set(personId, date)
  }
  const outboundContactedSeries = bucketUniqueByEmail(outboundContactEvents)
  const totalOutboundContacted = totalUniqueByEmail(outboundContactEvents)

  // Combined: dedupe across ALL three sources per bucket (a pro touched
  // via Sales + Invites + Outbound in the same period still counts
  // once). Used as the Pros-contacted parent total + series.
  const allContactEvents = [...salesContactEvents, ...inviteContactEvents, ...outboundContactEvents]
  const prosContactedSeries = bucketUniqueByEmail(allContactEvents)
  const totalProsContacted = totalUniqueByEmail(allContactEvents)

  // The old "New Pros from Outbound" series lived here, bucketed by
  // onboarded_at. It is now outboundCompanyIds further down, bucketed
  // by listed_at like every other channel on that row.

  // Apollo channel: companies whose id is referenced by a prospect with an
  // apollo_contact_id (i.e. they came in via the Apollo outbound sequence).
  const apolloCompanyIds = new Set<string>(
    prospects
      .filter((p: any) => p.apollo_contact_id && p.company_id)
      .map((p: any) => p.company_id as string),
  )
  const apolloNewProDates = companies
    .filter((c: any) => onboardingCompleted(c) && apolloCompanyIds.has(c.id))
    .map(onboardedTsForBucket)
    .filter((d): d is Date => d !== null && d >= from)
  const apolloNewPros = bucket8(apolloNewProDates, buckets)

  // "Other": all other channels (organic, invites, direct, social) — once
  // first-session attribution is wired into companies, this can split further.
  const otherNewProDates = companies
    .filter((c: any) => onboardingCompleted(c) && !apolloCompanyIds.has(c.id))
    .map(onboardedTsForBucket)
    .filter((d): d is Date => d !== null && d >= from)
  const otherNewPros = bucket8(otherNewProDates, buckets)

  // ── Per-source breakdowns from first_touch_source ───────────────
  // Both client_signups_<channel> and new_pros_<channel> previously
  // came from PostHog HogQL queries with first-touch attribution at
  // read time. After migration 164 the source is stamped on the row
  // at creation (profiles for signups, companies for new pros, the
  // company inherits from owner). Counting rows grouped by
  // first_touch_source means channels and parent measure the same
  // thing — channels sum to parent by construction.
  // Mirrors FirstTouchSource in lib/source-attribution.ts. Order here
  // is rendering order for the client rows: Direct, SEO, Social, AI,
  // Shares, Referral, Email, Paid. Sales and Invites are pro-side and
  // never render on a client row.
  type FirstTouchKey = "sales" | "invites" | "direct" | "google" | "social" | "ai" | "shares" | "referral" | "email" | "paid"
  const FIRST_TOUCH_KEYS: FirstTouchKey[] = ["sales", "invites", "direct", "google", "social", "ai", "shares", "referral", "email", "paid"]

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
      direct: new Array(8).fill(0), google: new Array(8).fill(0),
      social: new Array(8).fill(0), ai: new Array(8).fill(0),
      shares: new Array(8).fill(0), referral: new Array(8).fill(0),
      email: new Array(8).fill(0), paid: new Array(8).fill(0),
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
  const CLIENT_CHANNELS: readonly FirstTouchKey[] = ["direct", "google", "social", "ai", "shares", "referral", "email", "paid"]
  const clientSignupsBySource = bucketBySource(
    profiles,
    (p) => p.created_at ? new Date(p.created_at) : null,
    (p) => p.user_types?.includes("client"),
    CLIENT_CHANNELS,
  )

  // New pros by source — bucketed by companies.listed_at, because the
  // parent counts pros that went LIVE in the period. Channels bucketed
  // by onboarding while the parent counted listings would have given
  // subs that do not sum to their own total, which is the one thing
  // this row has always guaranteed.
  const listedTsForBucket = (c: any): Date | null =>
    c.listed_at ? new Date(c.listed_at) : null
  // newProsBySource stood here — companies.first_touch_source split
  // eight ways. New Pros no longer renders those channels (the field is
  // NULL for 3138 of 3159 rows), and nothing else read it. bucketBySource
  // itself stays: the client Signups row still uses it.

  // Per-source totals: sum of the 8-period series for the "total" column.
  function totalsBySource(s: Record<FirstTouchKey, number[]>): Record<FirstTouchKey, number> {
    return FIRST_TOUCH_KEYS.reduce((acc, k) => {
      acc[k] = s[k].reduce((a, b) => a + b, 0)
      return acc
    }, {} as Record<FirstTouchKey, number>)
  }
  const clientSignupsBySourceTotals = totalsBySource(clientSignupsBySource)

  // ── Click-through-based New Pros for Sales / Invites ─────────────
  // Count new pros (companies onboarded in the period) whose owner
  // clicked at least one Outreach/Showcase or Invite email — same
  // server-side click signal that drives the Pros contacted →
  // Visitors funnel on /admin/sales. Replaces the first-touch-based
  // Sales/Invites counts under New Pros so this row reads "did our
  // outreach end-to-end work" rather than "first marketing touch".
  // The Direct adjustment this used to mention is gone: the precedence
  // chain below gives the partition for free, instead of subtracting one
  // channel's count from another's to force the subs to add up.

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

  // The Invites channel under New Pros is CREDITED, not clicked.
  //
  // It used to be the click set above, and that made the channel read
  // as a tenth of itself. The stamp behind those clicks only fired on
  // /businesses/professionals, and once invite mails started carrying
  // a /claim link almost nobody passed the place that was watching:
  // September had 58 claim tokens issued against 1 recorded visit,
  // and 5 companies that arrived by credit showed up here as 1.
  //
  // Holding an accepted credit is the durable fact — written when the
  // pro says yes, not when a particular URL happens to be the one they
  // opened. The click signal stays exactly where it is honest: the
  // visitor step, which is asking about clicks.
  //
  // This is what used to be the New contributors row, and it counts
  // identically — same companies, same listed_at, same acceptance
  // test — so folding it in here moved the number rather than
  // redefining it.
  const inviteCreditedCompanyIds = new Set<string>(firstAcceptanceByCompany.keys())

  // Companies whose owner we reached by outbound at any point. Built as
  // an id set like the other two so it can run through the same
  // bucketing — the old version dated these by onboarded_at while every
  // sibling used listed_at, which meant the Outbound sub answered a
  // different question from the row it sat in.
  const outboundCompanyIds = new Set<string>()
  for (const c of companies as any[]) {
    if (!onboardingCompleted(c) || !c.owner_id) continue
    const personId = personIdByAuthUserId.get(c.owner_id)
    if (personId && outboundDatesByPerson.has(personId)) outboundCompanyIds.add(String(c.id))
  }

  /**
   * New pros in a bucket that belong to `member`, minus anything already
   * claimed by a higher-priority loop.
   *
   * @param exclude  Sets that outrank this one. A company in both counts
   *   once, there.
   */
  function bucketNewProsBySet(member: Set<string>, exclude: Set<string>[] = []): number[] {
    // Bucket by the SAME timestamp the parent New Pros row uses:
    // listed_at, the moment the page went live.
    return buckets.starts.map((_, i) =>
      companies.filter((c: any) => {
        const id = String(c.id)
        if (!onboardingCompleted(c) || !member.has(id)) return false
        if (exclude.some((set) => set.has(id))) return false
        const ts = listedTsForBucket(c)
        return ts !== null && ts >= buckets.starts[i] && ts < buckets.ends[i]
      }).length,
    )
  }

  /**
   * Invites › Sales › Organic, with Outbound beside them.
   *
   * The three loops genuinely overlap — since April, 4 of 27 new pros
   * sit in both Invites and Sales, and 3 of the 4 we phoned were in
   * Sales too. Without an order the subs would add up to more than the
   * row they sit under, which is what the old Direct adjustment was
   * patching around.
   *
   * Invites outranks Sales because a firm that accepted a credit
   * arrived through that credit whatever else we were sending it.
   *
   * OUTBOUND IS NOT IN THE CHAIN. A phone call is not a channel a pro
   * arrives through; it is something we did to a pro who was already
   * somewhere in the funnel — usually one the other loops had reached
   * first. Forcing it into the split would make it look small (one
   * company, the only one no other loop touched) while hiding that we
   * had actually called four. So it counts everyone it touched,
   * overlaps included, and sits after the split rather than inside it.
   *
   * Which means Organic reads "neither Invites nor Sales reached them",
   * not "we did nothing" — and the Outbound figure beside it says how
   * many of those we phoned anyway. Read Outbound as "touched by",
   * never as "thanks to": it works on firms that were already
   * converting, so its rate flatters itself.
   */
  const newProsInvitesSeries = bucketNewProsBySet(inviteCreditedCompanyIds)
  const newProsInvitesTotal = newProsInvitesSeries.reduce((a, b) => a + b, 0)
  const newProsSalesSeries = bucketNewProsBySet(salesClickerCompanyIds, [inviteCreditedCompanyIds])
  const newProsSalesTotal = newProsSalesSeries.reduce((a, b) => a + b, 0)
  const newProsOutboundSeries = bucketNewProsBySet(outboundCompanyIds)
  const newProsOutboundTotal = newProsOutboundSeries.reduce((a, b) => a + b, 0)

  // The residual, and deliberately computed last: every attribution
  // failure above lands here, so it reads high rather than low, and it
  // is only trustworthy while the two loops are measured well.
  const newProsOrganicSeries = buckets.starts.map((_, i) =>
    companies.filter((c: any) => {
      const id = String(c.id)
      if (!onboardingCompleted(c) || !c.listed_at) return false
      if (inviteCreditedCompanyIds.has(id) || salesClickerCompanyIds.has(id)) return false
      const ts = listedTsForBucket(c)
      return ts !== null && ts >= buckets.starts[i] && ts < buckets.ends[i]
    }).length,
  )
  const newProsOrganicTotal = newProsOrganicSeries.reduce((a, b) => a + b, 0)

  // Parent client_signups series — count client profiles bucketed by
  // created_at. Same denominator the channels derive from, so subs
  // sum to parent exactly.
  /**
   * Signups, in three layers, because one number could not carry it.
   *
   * THE PARENT COUNTS ACCOUNTS, matching /users exactly — that page
   * filters on 'client' or 'admin' too. Keeping them equal is the
   * point: the two screens are read side by side, and a headline that
   * disagreed would cost more than it explained.
   *
   * But 'client' does not mean demand. It means "has an account":
   * everyone who signs up gets it, and the claim flow APPENDS
   * 'professional' later (app/[locale]/claim/actions.ts). So of the 36
   * profiles carrying 'client', 27 are pros — 25 of them owning a
   * company. Left whole, Visitors → Signups would divide by a
   * population that is mostly supply.
   *
   * Hence the middle layer: owns a company or not. That is a fact about
   * what somebody did, not a flag that accumulated on their profile.
   *
   * Then three states under the client half, not eight channels. Seven
   * of those eight read zero and will keep reading zero until the
   * first-touch stamp exists; shown as rows they say "nobody comes from
   * here", which is a different claim from "we never looked". What the
   * three say instead is how much of this we can attribute at all —
   * the question that has an answer at this volume.
   */
  const companyOwnerIds = new Set<string>(
    companies.filter((c: any) => c.owner_id).map((c: any) => String(c.owner_id)),
  )
  const accountProfiles = profiles.filter((p: any) =>
    p.created_at
    && (p.user_types?.includes("client") || p.user_types?.includes("admin")),
  )
  const datesOf = (rows: any[]): Date[] =>
    rows.map((p: any) => new Date(p.created_at)).filter((d: Date) => d >= from)

  const clientSignupDates = datesOf(accountProfiles)
  const clientSignupsBucketedDb = bucket8(clientSignupDates, buckets)

  const proAccountProfiles = accountProfiles.filter((p: any) => companyOwnerIds.has(String(p.id)))
  const clientOnlyProfiles = accountProfiles.filter((p: any) => !companyOwnerIds.has(String(p.id)))
  const proAccountsBucketed = bucket8(datesOf(proAccountProfiles), buckets)
  const clientOnlyBucketed = bucket8(datesOf(clientOnlyProfiles), buckets)

  // Attributed / Direct / Unknown. Anything that is neither empty nor
  // 'direct' counts as attributed, so the three add up to the client
  // half exactly — including the odd pro-loop value on a profile that
  // never owned a company.
  const signupStateBucketed = (want: "attributed" | "direct" | "unknown") =>
    bucket8(datesOf(clientOnlyProfiles.filter((p: any) => {
      const src = p.first_touch_source ? String(p.first_touch_source) : ""
      const state = !src ? "unknown" : src === "direct" ? "direct" : "attributed"
      return state === want
    })), buckets)
  const signupsAttributed = signupStateBucketed("attributed")
  const signupsDirect = signupStateBucketed("direct")
  const signupsUnknown = signupStateBucketed("unknown")

  // Open drafts (snapshot at each bucket end): companies created before
  // bucket end that are still in 'created' status today. Approximate — we
  // don't track historical status, so a company that went created → listed
  // → created would be miscounted. Acceptable for v1.
  function bucketOpenDraftsAt(bucketEnd: Date): number {
    return companies.filter((c: any) =>
      c.status === "created" && c.owner_id != null && new Date(c.created_at) < bucketEnd,
    ).length
  }
  const openDraftsSeries = buckets.ends.map(bucketOpenDraftsAt)
  const totalOpenDrafts = openDraftsSeries[openDraftsSeries.length - 1] ?? 0

  // Unlisted snapshot at each bucket end: companies created before bucket
  // end that are currently in 'unlisted' status. Same v1 caveat as Open
  // drafts (approximates current state for past dates).

  // Pro-visitor channel remainder — the parent is raw PostHog uniques
  // (link-scanners included), while Sales/Invites deliberately use the
  // clean server-side click logs. The difference used to vanish
  // silently (Apr: subs summed 24 under a parent of 113). Surface it
  // as an explicit "Other" sub so the mismatch is legible instead of
  // looking like broken math.
  const proVisitorSubSeries = [
    proVisitorsSalesBucketed.series, proVisitorsInvitesBucketed.series,
    proVisitorsEmailBucketed.series, proVisitorsDirectBucketed.series,
    proVisitorsGoogleBucketed.series, proVisitorsSocialBucketed.series,
    proVisitorsReferralBucketed.series, proVisitorsShareBucketed.series,
  ]
  const proVisitorsOtherSeries = proVisitorsBucketed.series.map((total, i) =>
    Math.max(0, total - proVisitorSubSeries.reduce((sum, arr) => sum + (arr[i] ?? 0), 0)),
  )
  const proVisitorsOtherTotal = proVisitorsOtherSeries.reduce((a, b) => a + b, 0)

  // ── Cohorted "ever" rates ────────────────────────────────────────────
  // Cohort members bucket by their FIRST touch; the numerator counts
  // members that ever converted (any time up to now). Numerator ⊆
  // denominator, so rates can't exceed 100% and don't bleed across
  // cohorts. Young cohorts under-read — buckets ending within the last
  // 30 days are flagged immature and rendered grey by the table view.
  const COHORT_DEF = "Cohorted by first touch; conversions counted whenever they happen. Grey = cohort still maturing."
  const cohortImmatureFromIndex = (() => {
    const cutoff = Date.now() - 30 * DAY_MS
    const idx = buckets.ends.findIndex((end) => end.getTime() > cutoff)
    return idx === -1 ? buckets.ends.length : idx
  })()
  const bucketIndexOf = (d: Date): number => {
    for (let i = 0; i < buckets.starts.length; i++) {
      if (d >= buckets.starts[i] && d < buckets.ends[i]) return i
    }
    return -1
  }
  function cohortByFirstTouch(events: ContactEvent[], converted: Set<string>): { denom: number[]; num: number[] } {
    const firstByKey = new Map<string, Date>()
    for (const ev of events) {
      const cur = firstByKey.get(ev.email)
      if (!cur || ev.date < cur) firstByKey.set(ev.email, ev.date)
    }
    const denom = buckets.starts.map(() => 0)
    const num = buckets.starts.map(() => 0)
    firstByKey.forEach((d, key) => {
      const i = bucketIndexOf(d)
      if (i === -1) return
      denom[i]++
      if (converted.has(key)) num[i]++
    })
    return { denom, num }
  }

  // Ever-visited sets from the email-keyed server-side click logs.
  const everVisitedSalesEmails = new Set(salesVisitEmailEvents.map((ev) => ev.email))
  const everVisitedInviteEmails = new Set(inviteVisitEvents.map((ev) => ev.email))
  const everVisitedEmails = new Set([...everVisitedSalesEmails, ...everVisitedInviteEmails])

  // Pros contacted → ever visited (parent + per-channel cohorts).
  // Sales + Invites only, NOT allContactEvents.
  //
  // Outbound is a phone call, a meeting, a LinkedIn message — there is
  // no landing to arrive at and no click to log, so an outbound-
  // contacted pro can never appear in everVisitedEmails. Including them
  // in the denominator meant dividing by a population that was
  // structurally unable to convert on this step, which pushed the rate
  // down by exactly as much as outbound grew.
  //
  // Outbound is not missing a number because of that: it runs straight
  // from contacted to New Pros on its own sub, which is the honest
  // shape. A funnel step only means something when the order is fixed,
  // and outbound deliberately works on firms that are already visitors
  // — measuring "contacted → visitor" there would mostly be recording
  // a conversion that happened before the call.
  const clickableContactEvents = [...salesContactEvents, ...inviteContactEvents]
  const contactedCohort = cohortByFirstTouch(clickableContactEvents, everVisitedEmails)
  const salesContactedCohort = cohortByFirstTouch(salesContactEvents, everVisitedSalesEmails)
  const inviteContactedCohort = cohortByFirstTouch(inviteContactEvents, everVisitedInviteEmails)

  // "Ever created" — the email's linked company (via prospects.company_id
  // or the invite row's company_id) completed onboarding at any point.
  const onboardedCompanyIds = new Set(companies.filter(onboardingCompleted).map((c: any) => String(c.id)))
  const prospectEmailToCompanyId = new Map<string, string>()
  for (const p of prospects) {
    if (p.email && p.company_id) prospectEmailToCompanyId.set(String(p.email).toLowerCase(), String(p.company_id))
  }
  const inviteEmailToCompanyIds = new Map<string, string[]>()
  for (const inv of invites as any[]) {
    if (!inv.is_project_owner && inv.invited_email && inv.company_id) {
      const em = String(inv.invited_email).toLowerCase()
      const arr = inviteEmailToCompanyIds.get(em) ?? []
      arr.push(String(inv.company_id))
      inviteEmailToCompanyIds.set(em, arr)
    }
  }
  const emailEverCreated = (em: string): boolean => {
    const viaProspect = prospectEmailToCompanyId.get(em)
    if (viaProspect && onboardedCompanyIds.has(viaProspect)) return true
    return (inviteEmailToCompanyIds.get(em) ?? []).some((cid) => onboardedCompanyIds.has(cid))
  }
  const everCreatedSalesEmails = new Set([...everVisitedSalesEmails].filter(emailEverCreated))
  const everCreatedInviteEmails = new Set([...everVisitedInviteEmails].filter(emailEverCreated))
  const outboundEverCreatedEmails = new Set(outboundContactEvents.map((ev) => ev.email).filter(emailEverCreated))
  const outboundCohort = cohortByFirstTouch(outboundContactEvents, outboundEverCreatedEmails)
  // Clicker cohorts (bucketed by FIRST VISIT) → ever created.
  const salesClickerCohort = cohortByFirstTouch(salesVisitEmailEvents, everCreatedSalesEmails)
  const inviteClickerCohort = cohortByFirstTouch(inviteVisitEvents, everCreatedInviteEmails)

  // Contributors invited → ever accepted (unit = invite row, cohort by
  // invite date; matches the row's displayed per-bucket denominator).
  // The per-INVITE cohort that fed the old "% Accepted (ever)" is gone.
  // Its replacement below counts firms deciding rather than tags sent,
  // which is the question the rate was always read as answering.
  // Sits here rather than beside its own series: bucketIndexOf is
  // declared further down, and the other cohort pairs already live
  // together.
  const uniqueInvitedCohortDenom = buckets.starts.map(() => 0)
  const uniqueInvitedEverAcceptedNum = buckets.starts.map(() => 0)
  for (const [cid, d] of firstInviteByCompany) {
    const i = bucketIndexOf(d)
    if (i === -1) continue
    uniqueInvitedCohortDenom[i]++
    if (firstAcceptanceByCompany.has(cid)) uniqueInvitedEverAcceptedNum[i]++
  }

  // New Pros itself: claimed pros bucketed by listed_at, the moment
  // their page went live. What used to be two cohort pairs here — one
  // for "% Listed (ever)", one for "% Published (ever)" — went with
  // the merge and with the removal of that second rate. The row keeps
  // the count and lets the supporting metrics carry the ratios.
  //
  // The contributor count that used to be computed in this same loop
  // is now the Invites channel sub, built from inviteCreditedCompanyIds
  // above. Same companies on the same conditions — it reads as a
  // channel rather than as a row of its own, which is what it always
  // was: of the pros that went live, these arrived by being credited
  // on somebody else's project.
  const listedCohortDenom = buckets.starts.map(() => 0)
  for (const c of companies as any[]) {
    if (!onboardingCompleted(c)) continue
    if (c.listed_at) {
      const j = bucketIndexOf(new Date(c.listed_at))
      if (j !== -1) listedCohortDenom[j]++
    }
  }

  /**
   * Pro visitors — arrivals on /claim.
   *
   * The step used to be "a session that touched /businesses", counted
   * in PostHog, with rates underneath it computed from server-side
   * click logs. Two systems, two units, one percentage: that is how the
   * Invites channel came to show nineteen visitors above a rate worked
   * out on one.
   *
   * /claim fixes that by knowing the channel at the door — a signed
   * token carries it, and its absence is the platform route — so all
   * three channels are one event in one table. It also measures a
   * better thing: /businesses/architects is a page you can land on by
   * accident, while "put your firm on Arco" is a button you press on
   * purpose.
   *
   * Outbound has no channel here, deliberately. A phone call has no
   * landing, and outbound works on firms that are already visitors, so
   * a visitor step for it would mostly record a conversion that
   * happened before the call. Its rate runs straight from contacted to
   * New Pros instead.
   *
   * UNITS DIFFER BY NECESSITY, and this is the one seam left: the token
   * channels dedupe by the address the token was issued to, while the
   * platform route has no identity to dedupe on and counts arrivals.
   * A refresh on the organic side therefore counts twice. Closing that
   * needs either a cookie (consent) or an IP-derived key (a decision
   * about personal data), so it stays an open question rather than a
   * silent choice.
   */
  const claimArrivals = (claimArrivalsResult.data ?? []) as {
    channel?: string | null; email?: string | null; created_at?: string | null
  }[]

  type ArrivalChannel = "invites" | "sales" | "organic"
  const arrivalChannelOf = (row: { channel?: string | null }): ArrivalChannel => {
    const c = String(row.channel ?? "")
    if (c === "invite") return "invites"
    if (c === "outreach" || c === "showcase") return "sales"
    return "organic"
  }

  const bucketArrivals = (channel: ArrivalChannel | "all"): number[] =>
    buckets.starts.map((_, i) => {
      const seenEmails = new Set<string>()
      let anonymous = 0
      for (const row of claimArrivals) {
        if (!row.created_at) continue
        if (channel !== "all" && arrivalChannelOf(row) !== channel) continue
        const d = new Date(row.created_at)
        if (Number.isNaN(d.getTime()) || d < buckets.starts[i] || d >= buckets.ends[i]) continue
        const email = row.email?.trim().toLowerCase()
        if (email) seenEmails.add(email)
        else anonymous++
      }
      return seenEmails.size + anonymous
    })

  const proVisitorsSeries = bucketArrivals("all")
  const proVisitorsTotal = proVisitorsSeries.reduce((a, b) => a + b, 0)
  const claimInvitesSeries = bucketArrivals("invites")
  const claimSalesSeries = bucketArrivals("sales")
  const claimOrganicSeries = bucketArrivals("organic")
  const sumOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

  const rows: MetricRow[] = [
    // ── Professionals ──────────────────────────────────────────────────
    {
      key: "pros_contacted", label: "Pros Contacted", definition: "Unique pros contacted via Sales, Invites or Outbound", source: "supabase" as MetricSource, driver: "acquisition",
      total: totalProsContacted, datapoints: prosContactedSeries, labels,
      // Both rates below count Sales + Invites only — the two loops that
      // send somebody to a page. Outbound is excluded from the
      // denominator as well as the numerator, so this stopped being a
      // "lower bound" and became a rate over the population it actually
      // describes. Outbound's own conversion lives on its sub, running
      // straight to New Pros.
      inlineCRNumerator: { total: 0, datapoints: contactedVisitorsSeries },
      cohortInlineCR: {
        label: "to Pro Visitors (ever)",
        numerator: contactedCohort.num,
        denominator: contactedCohort.denom,
        definition: "Of pros first contacted by Sales or Invites, the share that ever reached a landing. Outbound is left out on both sides: a phone call has no landing. " + COHORT_DEF,
        immatureFromIndex: cohortImmatureFromIndex,
      },
      subs: [
        {
          key: "invites_contacted", label: "Invites", definition: "Unique companies invited to be credited on a project. Counts firms, not invites — the same firm credited three times is one. Photographers carry no e-mail address and never appear.",
          source: "supabase" as MetricSource,
          total: totalInviteContacted, datapoints: inviteContactedSeries,
          // Cohorted: of pros first invited in the bucket, the share
          // that ever hit their invite landing (landing_visited_at,
          // stamped server-side — scanner traffic can't inflate it).
          customCR: { label: "to Pro Visitors (ever)", numerator: inviteContactedCohort.num, denominator: inviteContactedCohort.denom, definition: COHORT_DEF, immatureFromIndex: cohortImmatureFromIndex },
        },
        {
          key: "sales_contacted", label: "Sales", definition: "Unique pros contacted via Outreach (Apollo cold) or Showcase",
          source: "supabase" as MetricSource,
          total: totalSalesContacted, datapoints: salesContactedSeries,
          // Cohorted: of pros first Sales-contacted in the bucket, the
          // share that ever clicked through to a landing.
          customCR: { label: "to Pro Visitors (ever)", numerator: salesContactedCohort.num, denominator: salesContactedCohort.denom, definition: COHORT_DEF, immatureFromIndex: cohortImmatureFromIndex },
        },
        {
          key: "outbound_contacted", label: "Outbound",
          definition: "Distinct pros reached via manual outbound activity (call, meeting, LinkedIn, manual email — excludes notes and no-answer attempts).",
          source: "supabase" as MetricSource,
          total: totalOutboundContacted, datapoints: outboundContactedSeries,
          // No server-side "outbound visitor" event exists, so this
          // cohort converts straight to "ever created" — of pros first
          // outbound-touched in the bucket, the share whose company
          // ever completed onboarding.
          customCR: { label: "to New Pros (ever)", numerator: outboundCohort.num, denominator: outboundCohort.denom, definition: COHORT_DEF, immatureFromIndex: cohortImmatureFromIndex },
        },
      
      ],
    },
    {
      // Pro visitors — landing on /claim, not browsing /businesses.
      //
      // The /businesses step is gone. It counted PostHog sessions in a
      // different unit from every rate attached to it, it swept in
      // anyone who wandered onto a marketing page, and its eight
      // channel subs were six parts dead field. What replaced it is one
      // server-side event with the channel already on it.
      key: "pro_visitors", label: "Pro Visitors", definition: "Pros who landed on /claim. Recorded server-side the moment they arrive, before the page decides what to show; mail-scanner hits are filtered out by country and user agent.", source: "supabase" as MetricSource, driver: "acquisition",
      total: proVisitorsTotal, datapoints: proVisitorsSeries, labels,
      subs: [
        { key: "invites", label: "Invites", definition: "Claim links from a project-invite mail. Deduped by the address the token was issued to.", source: "supabase" as MetricSource,
          total: sumOf(claimInvitesSeries), datapoints: claimInvitesSeries ,
          customCR: { label: "to New Pros", numerator: newProsInvitesSeries, denominator: claimInvitesSeries, definition: "Share of this period's claim arrivals that became a New Pro. A period ratio, not a cohort — arrivals and listings are counted in the same bucket." }},
        { key: "sales", label: "Sales", definition: "Claim links from Outreach or Showcase mail. Deduped by the address the token was issued to.", source: "supabase" as MetricSource,
          total: sumOf(claimSalesSeries), datapoints: claimSalesSeries ,
          customCR: { label: "to New Pros", numerator: newProsSalesSeries, denominator: claimSalesSeries, definition: "Share of this period's claim arrivals that became a New Pro. A period ratio, not a cohort — arrivals and listings are counted in the same bucket." }},
        { key: "organic", label: "Organisch", definition: "Arrivals with no token — the platform route. No identity to dedupe on, so this counts arrivals where the two above count people.", source: "supabase" as MetricSource,
          total: sumOf(claimOrganicSeries), datapoints: claimOrganicSeries ,
          customCR: { label: "to New Pros", numerator: newProsOrganicSeries, denominator: claimOrganicSeries, definition: "Share of this period's claim arrivals that became a New Pro. A period ratio, not a cohort — arrivals and listings are counted in the same bucket." }},
        // No Outbound sub, deliberately: a phone call has no landing,
        // and outbound targets firms that are already visitors. Its
        // conversion runs from contacted straight to New Pros.
      ],
    },
    {
      // New Pros and Listed Pros merged. Listed Pros was a cumulative
      // snapshot sitting in a conversion table: it could only rise, it
      // answered a different question from every row around it, and it
      // made the funnel read as a scoreboard. What remains is the flow
      // — pros that went LIVE in this period — with the totals demoted
      // to supporting metrics where a total belongs.
      //
      // "New" therefore means newly listed, not newly registered. A
      // company page that exists but was never approved is not yet a
      // pro anyone can find, which is the same line New Projects draws
      // between a draft and a publication.
      key: "new_pros", label: "New Pros", definition: "Pros whose page went live in the period. Counted on listing, not on registration: a company page still waiting for its first approved project is not yet findable.", source: "supabase" as MetricSource, driver: "acquisition",
      total: listedCohortDenom.reduce((a: number, b: number) => a + b, 0), datapoints: listedCohortDenom, labels,
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
        // Invites › Sales › Outbound › Organic. One pro, one loop:
        // each sub counts only what the loops above it did not claim,
        // so the four add up to the row exactly and no company is
        // counted twice.
        //
        // The five first-touch channels that used to sit here — Email,
        // SEO, Social, Referral, Shares — are gone. They read from
        // companies.first_touch_source, which is NULL for 3138 of 3159
        // rows, so all five were structurally zero and Direct silently
        // absorbed every unknown. Five channels reading "nobody comes
        // from here" is a worse answer than not asking. They come back
        // when the first-touch stamp is captured server-side.
        { key: "invites", label: "Invites", definition: "New pros that went live holding an accepted credit. Dated by listed_at, so a firm that accepts and never claims does not count. Photographers excluded.", source: "supabase" as MetricSource,
          total: newProsInvitesTotal, datapoints: newProsInvitesSeries },
        { key: "sales", label: "Sales", definition: "New pros whose owner clicked a Sales landing and hold no accepted credit.", source: "supabase" as MetricSource,
          total: newProsSalesTotal, datapoints: newProsSalesSeries },
        { key: "outbound", label: "Outbound", definition: "New pros we reached by outbound. OVERLAPPING — not part of the split above, so the four do not add up. Read as 'touched by', never 'thanks to'.", source: "supabase" as MetricSource,
          total: newProsOutboundTotal, datapoints: newProsOutboundSeries },
        { key: "organic", label: "Organisch", definition: "New pros that neither Invites nor Sales reached. A residual, so every attribution failure above lands here and it reads high rather than low.", source: "residual" as MetricSource,
          total: newProsOrganicTotal, datapoints: newProsOrganicSeries },
        // ── Supporting, not channels ──────────────────────────────
        //
        // Both are cumulative snapshots: they count every pro live at
        // the end of each period, not the ones that arrived in it. That
        // is why they sit under the flow rather than in it — a rate
        // between a flow and a stock divides two different populations,
        // which is the mistake % Ranked used to make from the parent
        // row.
        {
          key: "total_pros",
          label: "Total Listed Pros",
          definition: "Every pro live at the end of each period. A cumulative snapshot, and the denominator for % Ranked below.",
          source: "supabase" as MetricSource,
          total: totalListedSnapshot,
          datapoints: listedSnapshotSeries,
          customCR: {
            label: "% Contributor",
            numerator: contributorProsSnapshotSeries,
            denominator: listedSnapshotSeries,
          },
        },
        {
          key: "ranked_pros",
          label: "Ranked Pros",
          definition: "Listed pros currently indexed by Google (cumulative snapshot at each bucket end).",
          source: "supabase" as MetricSource,
          total: totalIndexedListedSnapshot,
          datapoints: indexedListedSnapshotSeries,
          customCR: {
            label: "% Ranked",
            numerator: indexedListedSnapshotSeries,
            denominator: listedSnapshotSeries,
          },
          valueRows: [
            { label: "Impressions", values: seoImpressionsSeries, tone: "muted", format: "integer" as const },
            { label: "CTR",         values: seoCtrSeries,         tone: "accent", format: "percent" as const },
            { label: "Clicks",      values: seoClicksSeries,      tone: "muted", format: "integer" as const },
          ],
        },
      ],
    },
    {
      // Leading metric flipped to New Projects (Publishers demoted to a
      // sub) — published volume is the primary retention signal, unique
      // publisher count is supporting context.
      //
      // The key stays `published_projects`. It is internal, it is what
      // the CR suppression list and two comments refer to, and renaming
      // it would be three edits to change nothing anyone can see.
      //
      // "New" here means newly live, not newly drafted — the definition
      // says so, because the name alone could be read either way and a
      // draft nobody approved is not a project on the platform.
      key: "published_projects", label: "New Projects", definition: "Projects that went live in the period. Counted on publication, not on creation: a draft waiting for approval is not yet a project anyone can find.", source: "supabase" as MetricSource, driver: "retention",
      total: publishedProjectDates.length, ...publishedProjectsBuckets,
      subs: [
        {
          // The network motor, in one line. Publishers and
          // Projects/publisher sat here before and answered a question
          // about the publishing side; this answers the one that
          // actually compounds — whether a new project brings other
          // companies onto the platform with it.
          key: "invites_per_project",
          label: "Invites per New Project",
          definition: "Average number of contributors credited on the projects published in the period, counted across every new project including the ones that credit nobody.",
          source: "supabase" as MetricSource,
          total: creditsPerNewProjectTotal,
          datapoints: creditsPerNewProjectSeries,
          customCR: {
            label: "% Invited Contributors",
            numerator: newProjectsWithContributorsSeries,
            denominator: publishedProjectsBuckets.datapoints,
          },
        },
        // Cumulative snapshot — all published projects ever, as of each
        // bucket end. Also the denominator for % Ranked below, so the
        // two supporting metrics read against the same population.
        {
          key: "total_projects",
          label: "Total Projects",
          definition: "Cumulative count of all published projects as of the end of each period. Also the denominator for % Ranked below, so the two supporting metrics read against the same population.",
          source: "supabase" as MetricSource,
          total: totalPublishedSnapshot,
          datapoints: totalPublishedSnapshotSeries,
          customCR: {
            label: "% Contributors",
            numerator: projectsWithAcceptedSeries,
            denominator: totalPublishedSnapshotSeries,
            definition: "Share of published projects carrying a credit a contributor accepted — the loop closing, not the ask being made. Photographers excluded, and they are most of the acceptances.",
          },
          valueRows: [
            { label: "Contributors per Project (accepted)", values: acceptedPerProjectSeries, tone: "accent", format: "decimal" as const,
              definition: "Accepted credits per published project, averaged over every project including those with none. Breadth is the percentage above; this is depth." },
          ],
        },
        {
          // Ranked projects — published projects Google has indexed.
          // The % Ranked rate moved down here from Total Projects, the
          // same way it did on New Pros: the count and the rate it
          // produces belong on one line rather than a row apart.
          key: "ranked_projects",
          label: "Ranked Projects",
          definition: "Published projects currently indexed by Google (cumulative snapshot at each bucket end).",
          source: "supabase" as MetricSource,
          total: totalIndexedPublishedSnapshot,
          datapoints: indexedPublishedSnapshotSeries,
          customCR: {
            label: "% Ranked",
            numerator: indexedPublishedSnapshotSeries,
            denominator: totalPublishedSnapshotSeries,
          },
          valueRows: [
            { label: "Impressions", values: projectImpressionsSeries, tone: "muted", format: "integer" },
            { label: "CTR",         values: projectCtrSeries,         tone: "accent", format: "percent" },
            { label: "Clicks",      values: projectClicksSeries,      tone: "muted", format: "integer" },
          ],
        },
      ],
    },
    {
      key: "subscribers", label: "New Subscribers", definition: "Companies that became subscribers in the period — a first paid subscription, or founding access claimed. One company counts once, on the earlier of the two.", source: "supabase" as MetricSource, driver: "monetization",
      total: subscribers.datapoints.reduce((a: number, b: number) => a + b, 0), ...subscribers,
      // Supporting metrics, not stages. The parent is a FLOW — who
      // arrived in each bucket — and these three are what the arrivals
      // add up to: a stock at the end of each bucket, and what it
      // earns. As sibling rows the chain drew conversion rates between
      // a count of companies and a sum of euros.
      //
      // No Paying / Founding split: Avg. MRR already carries it. Every
      // founding member sits in that denominator at zero, so the gap
      // between the average and the €49 list price is the free share,
      // read off one number instead of compared across two.
      subs: [
        { key: "total_subscribers", label: "Total Subscribers", definition: "Companies holding Pro at the end of each period — paying plus founding. A cumulative snapshot, counted the same way as Listed Pros, not a per-period flow.", total: totalSubscribersSeries[7] ?? 0, datapoints: totalSubscribersSeries },
        { key: "mrr", label: "MRR", definition: "Monthly recurring revenue in euros, net of VAT, at the end of each period. A yearly plan counts as a twelfth of its price per month, so switching cycles does not make revenue jump. Founding members contribute nothing.", total: mrrEuroSeries[7] ?? 0, datapoints: mrrEuroSeries },
        { key: "avg_mrr", label: "Avg. MRR", definition: "MRR divided by total subscribers, so total × average = MRR. Reads below the €49 list price by exactly the share of subscribers paying nothing.", total: avgMrrEuroSeries[7] ?? 0, datapoints: avgMrrEuroSeries },
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
        { key: "direct", label: "Direct", definition: "Client visitors with no referrer (typed URL, bookmark, app-to-app)", total: clientVisitorsDirectBucketed.total, datapoints: clientVisitorsDirectBucketed.series },
        { key: "google", label: "SEO", definition: "Client visitors from search engines", total: clientVisitorsGoogleBucketed.total, datapoints: clientVisitorsGoogleBucketed.series },
        { key: "social", label: "Social", definition: "Client visitors from social networks (LinkedIn, Facebook, Instagram, X, Pinterest)", total: clientVisitorsSocialBucketed.total, datapoints: clientVisitorsSocialBucketed.series },
        { key: "ai", label: "AI", definition: "Visitors handed over by an assistant: ChatGPT, Perplexity, Claude, Gemini, Copilot. Matched before the search list, so Gemini does not read as organic search.", total: clientVisitorsAiBucketed.total, datapoints: clientVisitorsAiBucketed.series },
        { key: "shares", label: "Shares", definition: "Client visitors arriving via a tagged share URL (utm_source=share)", total: clientVisitorsShareBucketed.total, datapoints: clientVisitorsShareBucketed.series },
        { key: "referral", label: "Referral", definition: "Client visitors from another website", total: clientVisitorsReferralBucketed.total, datapoints: clientVisitorsReferralBucketed.series },
        { key: "email", label: "Email", definition: "Client visitors from Arco email (utm_source=arco_*) or a webmail referrer", total: clientVisitorsEmailBucketed.total, datapoints: clientVisitorsEmailBucketed.series },
        { key: "paid", label: "Paid", definition: "Visitors from paid placement (utm_source=paid_* or arco_paid). No spend yet; the slot exists so the first campaign lands in its own row.", total: clientVisitorsPaidBucketed.total, datapoints: clientVisitorsPaidBucketed.series },
      ],
    },
    {
      key: "client_signups", label: "Signups", definition: "Accounts created in the period — 'client' or 'admin', the same filter /users uses. Note that 'client' means 'has an account', not 'is demand'.", source: "supabase" as MetricSource, driver: "acquisition",
      total: clientSignupDates.length, ...clientSignupsBucketedDb,
      subs: [
        { key: "pro_accounts", label: "Pros", definition: "Accounts that own a company. Supply, and already counted on the pro track.", source: "supabase" as MetricSource,
          total: datesOf(proAccountProfiles).length, datapoints: proAccountsBucketed.datapoints },
        { key: "client_accounts", label: "Clients", definition: "Accounts that own no company. The denominator for Visitors → Signups.", source: "supabase" as MetricSource,
          total: datesOf(clientOnlyProfiles).length, datapoints: clientOnlyBucketed.datapoints,
          valueRows: [
            { label: "Toegewezen", values: signupsAttributed.datapoints, tone: "muted", format: "integer" as const,
              definition: "A channel is known: SEO, Social, AI, Shares, Referral, Email or Paid. Collapsed into one row while seven would all read zero." },
            { label: "Direct", values: signupsDirect.datapoints, tone: "muted", format: "integer" as const,
              definition: "We saw the arrival and it carried nothing — no referrer, no utm." },
            { label: "Onbekend", values: signupsUnknown.datapoints, tone: "muted", format: "integer" as const,
              definition: "We never saw the arrival. Everything from before the first-touch stamp lands here. Distinct from Direct on purpose." },
          ],
        },
      ],
    },
    {
      key: "active_clients", label: "Monthly Active Clients", definition: "Unique clients active in the trailing 30 days", source: "posthog" as MetricSource, driver: "retention",
      total: totalActiveClients, datapoints: activeClientsSeries, labels,
      // % Sharers / % Savers / % Contacters stood here. All three
      // divided by the same denominator and said the same kind of
      // thing three times, directly under a row that already carries
      // four states of its own. The counts still exist as their own
      // rows further down, where the denominator is visible.
      subs: [
        {
          key: "new_active_clients", label: "New Active Clients",
          definition: "First-time actives: clients active this period who weren't active last period and aren't re-engaged returns. Balancing item so MAU = Retained + New + Re-engaged.",
          source: "posthog" as MetricSource, total: totalNewActiveClients, datapoints: newActiveClientsSeries,
        },
        {
          key: "retained_clients", label: "Retained Clients",
          definition: "Clients active this period that were also active last period (MAU prior − Newly dormant)",
          source: "posthog" as MetricSource, total: totalRetainedClients, datapoints: retainedClientsSeries,
          customCR: { label: "% Retained", numerator: retainedClientsSeries, denominator: priorMACSeries },
        },
        {
          key: "re_engaged_clients", label: "Re-engaged Clients",
          definition: "Clients back after 30+ days inactive. % = Re-engaged ÷ (clients seen in last 12 months − prior MAU).",
          source: "posthog" as MetricSource, total: totalReEngagedClients, datapoints: reEngagedClientsSeries,
          customCR: { label: "% Re-activated", numerator: reEngagedClientsSeries, denominator: priorDormantSeries },
        },
        {
          key: "newly_dormant_clients", label: "Newly Dormant Clients",
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
        { key: "shares_per_client", label: "Shares/Client", definition: "Average shares per active sharer", source: "posthog" as MetricSource, total: sharesPerClientTotal, datapoints: sharesPerClientSeries },
        { key: "projects_shared", label: "Projects Shared", definition: "Total projects shared", source: "posthog" as MetricSource, total: projectSharesBucketed.total, datapoints: projectSharesBucketed.series },
        { key: "professionals_shared", label: "Professionals Shared", definition: "Total professionals shared", source: "posthog" as MetricSource, total: professionalSharesBucketed.total, datapoints: professionalSharesBucketed.series },
      ],
    },
    {
      key: "savers", label: "Savers", definition: "Unique clients that saved a project or professional", source: "supabase" as MetricSource, driver: "retention",
      total: uniqueSavers, ...uniqueSaversBucketed,
      subs: [
        { key: "saves_per_client", label: "Saves/Client", definition: "Average saves per active saver", source: "supabase" as MetricSource, total: savesPerClient, datapoints: savesPerClientSeries },
        { key: "projects_saved", label: "Projects Saved", definition: "Total projects saved", source: "supabase" as MetricSource, total: savedProjectDates.length, datapoints: savers.datapoints },
        { key: "pros_saved", label: "Professionals Saved", definition: "Total professionals saved", source: "supabase" as MetricSource, total: savedCompanyDates.length, datapoints: savedPros.datapoints },
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
        { key: "contacted", label: "Professionals Contacted", definition: "Unique professionals contacted by clients", source: "posthog" as MetricSource, total: 0, datapoints: empty8 },
      ],
    },
  ]

  return { rows, labels }
}
