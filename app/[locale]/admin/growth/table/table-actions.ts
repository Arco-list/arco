"use server"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

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
  subs: Array<{ key: string; label: string; definition?: string; source?: MetricSource; total: number; datapoints: number[] }>
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

  const [
    profilesResult,
    companiesResult,
    projectsResult,
    invitesResult,
    savedProjectsResult,
    savedCompaniesResult,
    prospectsResult,
  ] = await Promise.all([
    supabase.from("profiles").select("id, user_types, created_at"),
    supabase.from("companies").select("id, status, plan_tier, created_at, updated_at, owner_id, seo_indexed"),
    supabase.from("projects").select("id, status, client_id, created_at, updated_at, published_at, seo_indexed"),
    supabase.from("project_professionals").select("id, professional_id, company_id, is_project_owner, project_id, created_at, invited_email, invited_at"),
    supabase.from("saved_projects").select("user_id, project_id, created_at"),
    supabase.from("saved_companies").select("user_id, company_id, created_at"),
    supabase.from("prospects").select("company_id, apollo_contact_id"),
  ])

  const profiles = (profilesResult.data ?? []) as any[]
  const companies = (companiesResult.data ?? []) as any[]
  const projects = (projectsResult.data ?? []) as any[]
  const invites = (invitesResult.data ?? []) as any[]
  const savedProjects = (savedProjectsResult.data ?? []) as any[]
  const savedCompanies = (savedCompaniesResult.data ?? []) as any[]
  const prospects = (prospectsResult.data ?? []) as any[]

  // Helper to filter and bucket by created_at
  const makeDates = (items: any[], filter?: (item: any) => boolean) =>
    (filter ? items.filter(filter) : items).map((i: any) => new Date(i.created_at)).filter((d: Date) => d >= from)

  // Helper to bucket by updated_at (for status transitions)
  const makeDatesByUpdated = (items: any[], filter?: (item: any) => boolean) =>
    (filter ? items.filter(filter) : items).map((i: any) => new Date(i.updated_at ?? i.created_at)).filter((d: Date) => d >= from)

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

  // Listed = claimed companies whose current status is exactly 'listed'.
  // Bucketed by updated_at as a proxy for the listing date. The previous
  // `listedStatuses` set lumped 'unlisted' in (assuming "they all passed
  // through listed"), but 'unlisted' is overloaded — it also covers scraped
  // companies that never reached listed.
  const activeDates = makeDatesByUpdated(companies, (c) => c.status === "listed" && claimedCompanies(c))
  const actives = bucket8(activeDates, buckets)

  // Current totals and bucketed data for supporting metrics
  const totalListed = companies.filter((c: any) => c.status === "listed").length
  const totalUnlisted = companies.filter((c: any) => c.status === "unlisted").length
  const unlistedDates = makeDatesByUpdated(companies, (c) => c.status === "unlisted")
  const unlisted = bucket8(unlistedDates, buckets)

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
  // % Companies ranked: of companies that became listed in this period, what
  // share is currently indexed by Google (seo_indexed = true). seo_indexed
  // is refreshed nightly by /api/cron/sync-gsc-indexation. Treats NULL as
  // not-yet-measured — counts toward the denominator but not the numerator,
  // which matches the lifecycle dashboard convention.
  const indexedListedDates = makeDatesByUpdated(
    companies,
    (c) => c.status === "listed" && claimedCompanies(c) && c.seo_indexed === true,
  )
  const indexedListedBuckets = bucket8(indexedListedDates, buckets)
  const rankedCompaniesPctSeries = activeDates.length > 0
    ? actives.datapoints.map((listedInBucket: number, i: number) => {
        const indexedInBucket = indexedListedBuckets.datapoints[i] ?? 0
        return listedInBucket > 0 ? Math.round((indexedInBucket / listedInBucket) * 100) : 0
      })
    : (Array(8).fill(0) as number[])
  const rankedCompaniesPct = activeDates.length > 0
    ? Math.round((indexedListedDates.length / activeDates.length) * 100)
    : 0

  // Total published projects (published_at falls in the period). Different
  // from the Publishers metric, which counts unique COMPANIES.
  const publishedProjectDates = projects
    .filter((p) => p.status === "published" && p.published_at)
    .map((p) => new Date(p.published_at))
    .filter((d: Date) => d >= from)
  const publishedProjectsBuckets = bucket8(publishedProjectDates, buckets)

  // % Projects ranked: of projects published in this period, what share is
  // indexed by Google.
  const indexedPublishedDates = projects
    .filter((p) => p.status === "published" && p.published_at && p.seo_indexed === true)
    .map((p) => new Date(p.published_at))
    .filter((d: Date) => d >= from)
  const indexedPublishedBuckets = bucket8(indexedPublishedDates, buckets)
  const rankedProjectsPctSeries = publishedProjectDates.length > 0
    ? publishedProjectsBuckets.datapoints.map((publishedInBucket: number, i: number) => {
        const indexedInBucket = indexedPublishedBuckets.datapoints[i] ?? 0
        return publishedInBucket > 0 ? Math.round((indexedInBucket / publishedInBucket) * 100) : 0
      })
    : (Array(8).fill(0) as number[])
  const rankedProjectsPct = publishedProjectDates.length > 0
    ? Math.round((indexedPublishedDates.length / publishedProjectDates.length) * 100)
    : 0

  // Inviters: unique project-owner companies whose projects received any
  // non-owner project_professionals row created in the bucket window. The
  // previous implementation bucketed invite events, so a single project that
  // invited 3 pros looked like 3 inviters.
  const nonOwnerInvites = invites.filter((i: any) => !i.is_project_owner)
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

  const clientSignupDates = makeDates(profiles, (p) => p.user_types?.includes("client"))
  const clientSignups = bucket8(clientSignupDates, buckets)

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
  const inviteContactEvents: ContactEvent[] = invites
    .filter((i: any) => i.invited_email && i.invited_at)
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
  // Combined: dedupe across BOTH sources per bucket (a pro contacted via
  // Sales and Invites in the same period still counts once).
  const allContactEvents = [...salesContactEvents, ...inviteContactEvents]
  const prosContactedSeries = bucketUniqueByEmail(allContactEvents)
  const totalProsContacted = totalUniqueByEmail(allContactEvents)

  // New Pros: companies that completed onboarding (left draft state) in
  // the period, bucketed by updated_at as a proxy for "left draft" date.
  const onboardingCompleted = (c: any) => c.status !== "draft" && c.owner_id != null
  const newProDates = makeDatesByUpdated(companies, onboardingCompleted)
  const newPros = bucket8(newProDates, buckets)

  // Apollo channel: companies whose id is referenced by a prospect with an
  // apollo_contact_id (i.e. they came in via the Apollo outbound sequence).
  const apolloCompanyIds = new Set<string>(
    prospects
      .filter((p: any) => p.apollo_contact_id && p.company_id)
      .map((p: any) => p.company_id as string),
  )
  const apolloNewProDates = makeDatesByUpdated(companies, (c: any) =>
    onboardingCompleted(c) && apolloCompanyIds.has(c.id),
  )
  const apolloNewPros = bucket8(apolloNewProDates, buckets)

  // "Other": all other channels (organic, invites, direct, social) — once
  // first-session attribution is wired into companies, this can split further.
  const otherNewProDates = makeDatesByUpdated(companies, (c: any) =>
    onboardingCompleted(c) && !apolloCompanyIds.has(c.id),
  )
  const otherNewPros = bucket8(otherNewProDates, buckets)

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
      subs: [
        { key: "sales_contacted", label: "Sales pros contacted", definition: "Unique pros contacted via Sales (Apollo, Arco-curated)", source: "supabase" as MetricSource, total: totalSalesContacted, datapoints: salesContactedSeries },
        { key: "invites_contacted", label: "Invites pros contacted", definition: "Unique pros invited via project invites", source: "supabase" as MetricSource, total: totalInviteContacted, datapoints: inviteContactedSeries },
      ],
    },
    {
      key: "pro_visitors", label: "Pro visitors", definition: "Unique visitors to /businesses pages", source: "posthog" as MetricSource, driver: "acquisition",
      total: 0, datapoints: empty8, labels,
      subs: [
        { key: "sales_apollo", label: "Sales (Apollo)", definition: "Visitors from Apollo outbound campaigns", total: 0, datapoints: empty8 },
        { key: "invites", label: "Invites", definition: "Visitors from project invite emails", total: 0, datapoints: empty8 },
        { key: "direct", label: "Direct", definition: "Typed URL, bookmark, or no referrer", total: 0, datapoints: empty8 },
        { key: "google", label: "Organic search", definition: "Google, Bing, DuckDuckGo, Yahoo, Ecosia, Brave, Qwant, Startpage", total: 0, datapoints: empty8 },
        { key: "social", label: "Social", definition: "LinkedIn, Facebook, Instagram, X, Pinterest", total: 0, datapoints: empty8 },
        { key: "email", label: "Email", definition: "Gmail, Outlook, email clients", total: 0, datapoints: empty8 },
        { key: "referral", label: "Referral", definition: "Other websites linking to Arco", total: 0, datapoints: empty8 },
      ],
    },
    {
      key: "new_pros", label: "New Pros", definition: "Unique pros that completed onboarding", source: "supabase" as MetricSource, driver: "acquisition",
      total: newProDates.length, ...newPros,
      subs: [
        { key: "apollo", label: "Apollo", definition: "New pros sourced from Apollo outbound", source: "supabase" as MetricSource, total: apolloNewProDates.length, datapoints: apolloNewPros.datapoints },
        { key: "other", label: "Other", definition: "New pros from organic, invites, direct, and other channels", source: "supabase" as MetricSource, total: otherNewProDates.length, datapoints: otherNewPros.datapoints },
        { key: "open_drafts", label: "Open drafts", definition: "Pros currently in draft — onboarding not yet completed", source: "supabase" as MetricSource, total: totalOpenDrafts, datapoints: openDraftsSeries },
      ],
    },
    {
      key: "actives", label: "Listed Pros", definition: "Unique first time listed pros", source: "supabase" as MetricSource, driver: "retention",
      total: activeDates.length, ...actives,
      subs: [
        { key: "unlisted_pros", label: "Unlisted pros", definition: "Pros currently in unlisted state", source: "supabase" as MetricSource, total: totalUnlistedSnapshot, datapoints: unlistedSnapshotSeries },
        { key: "ranked_companies", label: "% Companies ranked", definition: "% of pros listed in this period that are indexed by Google", total: rankedCompaniesPct, datapoints: rankedCompaniesPctSeries },
      ],
    },
    {
      key: "publishers", label: "Publishers", definition: "Unique companies that published at least one project in the period", source: "supabase" as MetricSource, driver: "retention",
      total: totalPublishersInWindow, ...publishers,
      subs: [
        { key: "published_projects", label: "Published projects", definition: "Total projects published in the period", total: publishedProjectDates.length, datapoints: publishedProjectsBuckets.datapoints },
        { key: "ranked_projects", label: "% Projects ranked", definition: "% of projects published in this period that are indexed by Google", total: rankedProjectsPct, datapoints: rankedProjectsPctSeries },
        { key: "projects_per_publisher", label: "Projects/publisher", definition: "Avg. published projects per publishing company", total: projectsPerPublisher, datapoints: projectsPerPublisherSeries },
      ],
    },
    {
      key: "inviters", label: "Inviters", definition: "Unique companies that invited one or more professionals on a project", source: "supabase" as MetricSource, driver: "retention",
      total: totalInvitersInWindow, ...inviters,
      subs: [
        { key: "invites_per_project", label: "Invites/project", definition: "Avg. professionals invited per inviting project", total: invitesPerProject, datapoints: invitesPerProjectSeries },
        { key: "total_invited", label: "Total invited", definition: "Total invitations sent in the period", total: totalInvited, datapoints: totalInvitedSeries },
      ],
    },
    {
      key: "responders", label: "Responders", definition: "Unique companies that received an inquiry", source: "posthog" as MetricSource, driver: "retention",
      total: 0, datapoints: empty8, labels,
      subs: [
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
      total: 0, datapoints: empty8, labels,
      subs: [
        { key: "direct", label: "Direct", definition: "Typed URL, bookmark, or no referrer", total: 0, datapoints: empty8 },
        { key: "google", label: "Organic search", definition: "Google, Bing, DuckDuckGo, Yahoo, Ecosia, Brave, Qwant, Startpage", total: 0, datapoints: empty8 },
        { key: "social", label: "Social", definition: "LinkedIn, Facebook, Instagram, X, Pinterest", total: 0, datapoints: empty8 },
        { key: "email", label: "Email", definition: "Gmail, Outlook, email clients", total: 0, datapoints: empty8 },
        { key: "referral", label: "Referral", definition: "Other websites linking to Arco", total: 0, datapoints: empty8 },
      ],
    },
    {
      key: "client_signups", label: "Signups", definition: "New client accounts created", source: "supabase" as MetricSource, driver: "acquisition",
      total: clientSignupDates.length, ...clientSignups,
      subs: [
        { key: "google", label: "Google", definition: "Signups via Google OAuth", total: 0, datapoints: empty8 },
        { key: "email", label: "Email", definition: "Signups via email/password", total: 0, datapoints: empty8 },
      ],
    },
    {
      key: "active_clients", label: "Monthly active clients", definition: "Unique clients active in the trailing 30 days", source: "posthog" as MetricSource, driver: "retention",
      total: totalActiveClients, datapoints: activeClientsSeries, labels,
      subs: [
        { key: "re_engaged_clients", label: "Re-engaged clients", definition: "Clients that returned after 30+ days of inactivity", source: "posthog" as MetricSource, total: totalReEngagedClients, datapoints: reEngagedClientsSeries },
        { key: "newly_dormant_clients", label: "Newly dormant clients", definition: "Clients that crossed the 30-day inactivity threshold", source: "posthog" as MetricSource, total: totalDormantClients, datapoints: dormantClientsSeries },
      ],
    },
    {
      key: "sharers", label: "Sharers", definition: "Unique clients that shared a project or professional", source: "posthog" as MetricSource, driver: "retention",
      total: 0, datapoints: empty8, labels,
      subs: [
        { key: "shares_per_client", label: "Shares/client", definition: "Average shares per active sharer", source: "posthog" as MetricSource, total: 0, datapoints: empty8 },
        { key: "projects_shared", label: "Projects shared", definition: "Total projects shared", source: "posthog" as MetricSource, total: 0, datapoints: empty8 },
        { key: "professionals_shared", label: "Professionals shared", definition: "Total professionals shared", source: "posthog" as MetricSource, total: 0, datapoints: empty8 },
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
      total: 0, datapoints: empty8, labels,
      subs: [
        { key: "contacted", label: "Professionals contacted", definition: "Unique professionals contacted by clients", source: "posthog" as MetricSource, total: 0, datapoints: empty8 },
      ],
    },
  ]

  return { rows, labels }
}
