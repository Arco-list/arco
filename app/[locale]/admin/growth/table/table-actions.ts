"use server"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

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
  ] = await Promise.all([
    supabase.from("profiles").select("id, user_types, created_at"),
    supabase.from("companies").select("id, status, plan_tier, created_at, updated_at, owner_id"),
    supabase.from("projects").select("id, status, client_id, created_at, updated_at, published_at"),
    supabase.from("project_professionals").select("id, professional_id, company_id, is_project_owner, project_id, created_at"),
    supabase.from("saved_projects").select("user_id, project_id, created_at"),
    supabase.from("saved_companies").select("user_id, company_id, created_at"),
  ])

  const profiles = (profilesResult.data ?? []) as any[]
  const companies = (companiesResult.data ?? []) as any[]
  const projects = (projectsResult.data ?? []) as any[]
  const invites = (invitesResult.data ?? []) as any[]
  const savedProjects = (savedProjectsResult.data ?? []) as any[]
  const savedCompanies = (savedCompaniesResult.data ?? []) as any[]

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

  const rows: MetricRow[] = [
    // ── Professionals ──────────────────────────────────────────────────
    {
      key: "pro_visitors", label: "Visitors", definition: "Unique visitors to /businesses pages", source: "posthog" as MetricSource, driver: "acquisition",
      total: 0, datapoints: empty8, labels,
      subs: [
        { key: "sales_apollo", label: "Sales (Apollo)", definition: "Visitors from Apollo outbound campaigns", total: 0, datapoints: empty8 },
        { key: "invites", label: "Invites", definition: "Visitors from project invite emails", total: 0, datapoints: empty8 },
        { key: "direct", label: "Direct", definition: "Typed URL, bookmark, or no referrer", total: 0, datapoints: empty8 },
        { key: "google", label: "Organic search", definition: "Google search (organic)", total: 0, datapoints: empty8 },
        { key: "social", label: "Social", definition: "LinkedIn, Facebook, Instagram, X, Pinterest", total: 0, datapoints: empty8 },
        { key: "email", label: "Email", definition: "Gmail, Outlook, email clients", total: 0, datapoints: empty8 },
        { key: "referral", label: "Referral", definition: "Other websites linking to Arco", total: 0, datapoints: empty8 },
      ],
    },
    {
      key: "drafts", label: "Drafts", definition: "Unique companies created", source: "supabase" as MetricSource, driver: "acquisition",
      total: draftDates.length, ...drafts,
      subs: [],
    },
    {
      key: "actives", label: "Listed", definition: "Unique first time listed companies", source: "supabase" as MetricSource, driver: "retention",
      total: activeDates.length, ...actives,
      subs: [],
    },
    {
      key: "publishers", label: "Publishers", definition: "Unique companies that published at least one project in the period", source: "supabase" as MetricSource, driver: "retention",
      total: totalPublishersInWindow, ...publishers,
      subs: [
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
    {
      key: "renewals", label: "Renewers", definition: "Unique subscribers that renewed their plan", source: "supabase" as MetricSource, driver: "monetization",
      total: 0, datapoints: empty8, labels,
      subs: [
        { key: "renewed", label: "Renewed", definition: "Subscriptions renewed this period", total: 0, datapoints: empty8 },
      ],
    },
    {
      key: "expansions", label: "Expanders", definition: "Unique subscribers that upgraded to a higher plan", source: "supabase" as MetricSource, driver: "monetization",
      total: 0, datapoints: empty8, labels,
      subs: [
        { key: "upgrades", label: "Upgrades", definition: "Subscribers that moved to a higher tier", total: 0, datapoints: empty8 },
      ],
    },
    {
      key: "contractions", label: "Contractors", definition: "Unique subscribers that downgraded to a lower plan", source: "supabase" as MetricSource, driver: "monetization",
      total: 0, datapoints: empty8, labels,
      subs: [
        { key: "downgrades", label: "Downgrades", definition: "Subscribers that moved to a lower tier", total: 0, datapoints: empty8 },
      ],
    },
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
        { key: "google", label: "Organic search", definition: "Google search (organic)", total: 0, datapoints: empty8 },
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
