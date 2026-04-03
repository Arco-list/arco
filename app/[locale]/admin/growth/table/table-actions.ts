"use server"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

export type Timeframe = "days" | "weeks" | "months" | "years"

export type MetricRow = {
  key: string
  label: string
  definition?: string
  driver: "acquisition" | "retention" | "monetization" | "churn"
  total: number
  datapoints: number[] // 8 data points (7 completed + 1 rolling)
  labels: string[]     // 8 labels
  subs: Array<{ key: string; label: string; definition?: string; total: number; datapoints: number[] }>
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

/** Get 8 bucket boundaries: 7 completed periods + 1 rolling (current) period */
function getBuckets(tf: Timeframe): { starts: Date[]; ends: Date[]; labels: string[] } {
  const now = new Date()
  const starts: Date[] = []
  const ends: Date[] = []
  const labels: string[] = []

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
        start = new Date(now.getTime() - (7 - i) * WEEK_MS)
        start.setHours(0, 0, 0, 0)
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
    supabase.from("companies").select("id, status, plan_tier, created_at, updated_at"),
    supabase.from("projects").select("id, status, client_id, created_at, updated_at"),
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

  // Drafts = ALL companies ever created (every company starts as draft)
  const draftDates = makeDates(companies)
  const drafts = bucket8(draftDates, buckets)

  // Listed = companies that have been listed (status is listed, unlisted, or deactivated — they all passed through listed)
  // Use updated_at as the "when they became listed" timestamp
  const listedStatuses = ["listed", "unlisted", "deactivated"]
  const activeDates = makeDatesByUpdated(companies, (c) => listedStatuses.includes(c.status))
  const actives = bucket8(activeDates, buckets)

  // Current totals and bucketed data for supporting metrics
  const totalListed = companies.filter((c: any) => c.status === "listed").length
  const totalUnlisted = companies.filter((c: any) => c.status === "unlisted").length
  const unlistedDates = makeDatesByUpdated(companies, (c) => c.status === "unlisted")
  const unlisted = bucket8(unlistedDates, buckets)

  const allCompanyDates = makeDates(companies)
  const allCompanies = bucket8(allCompanyDates, buckets)

  // Published = ALL projects that have been published (status published — they stay counted even if archived later)
  const publishedDates = makeDates(projects, (p) => p.status === "published")
  const publishers = bucket8(publishedDates, buckets)

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

  // Unique publishers (companies with published projects) in the time range
  const publishedInRange = projects.filter((p: any) => p.status === "published" && p.client_id && p.created_at && new Date(p.created_at) >= from)
  const publisherClientIds = new Set(publishedInRange.map((p: any) => p.client_id))
  const projectsPerPublisher = publisherClientIds.size > 0 ? Math.round((publishedInRange.length / publisherClientIds.size) * 10) / 10 : 0

  // Projects/publisher per bucket
  function bucketProjectsPerPublisher(): number[] {
    const published = projects.filter((p: any) => p.status === "published" && p.client_id && p.created_at)
    return buckets.starts.map((_, i) => {
      const inBucket = published.filter((p: any) => { const d = new Date(p.created_at); return d >= buckets.starts[i] && d < buckets.ends[i] })
      const uniq = new Set(inBucket.map((p: any) => p.client_id))
      return uniq.size > 0 ? Math.round((inBucket.length / uniq.size) * 10) / 10 : 0
    })
  }
  const projectsPerPublisherSeries = bucketProjectsPerPublisher()

  const inviteDates = makeDates(invites, (i) => !i.is_project_owner)
  const inviters = bucket8(inviteDates, buckets)

  // Invites per published project
  const nonOwnerInvites = invites.filter((i: any) => !i.is_project_owner)
  const publishedProjectIds = new Set(projects.filter((p: any) => p.status === "published").map((p: any) => p.id))
  const invitesPerProject = publishedProjectIds.size > 0 ? Math.round((nonOwnerInvites.length / publishedProjectIds.size) * 10) / 10 : 0

  // Invited companies that are not claimed (company exists but status is draft/unlisted or no owner)
  const invitedCompanyIds = new Set(nonOwnerInvites.map((i: any) => i.company_id).filter(Boolean))
  const unclaimedInvitedCompanies = companies.filter((c: any) => invitedCompanyIds.has(c.id) && c.status === "draft").length

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
      key: "pro_visitors", label: "Visitors", definition: "Unique visitors to /businesses pages", driver: "acquisition",
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
      key: "drafts", label: "Drafts", definition: "Unique companies created", driver: "acquisition",
      total: draftDates.length, ...drafts,
      subs: [],
    },
    {
      key: "actives", label: "Listed", definition: "Unique first time listed companies", driver: "retention",
      total: activeDates.length, ...actives,
      subs: [
        { key: "total_listed", label: "Total Listed", definition: "Total listed companies", total: totalListed, datapoints: actives.datapoints },
        { key: "total_unlisted", label: "Total Unlisted", definition: "Total unlisted companies", total: totalUnlisted, datapoints: unlisted.datapoints },
      ],
    },
    {
      key: "responders", label: "Responders", definition: "Unique companies that received an inquiry", driver: "retention",
      total: 0, datapoints: empty8, labels,
      subs: [
        { key: "replies", label: "Replies", definition: "Total replies sent to client inquiries", total: 0, datapoints: empty8 },
      ],
    },
    {
      key: "publishers", label: "Publishers", definition: "Unique companies that published one or more projects", driver: "retention",
      total: publishedDates.length, ...publishers,
      subs: [
        { key: "projects_per_publisher", label: "Projects/publisher", definition: "Avg. published projects per publishing company", total: projectsPerPublisher, datapoints: projectsPerPublisherSeries },
        { key: "total_in_progress", label: "Total in progress", definition: "Total projects with status draft (being edited)", total: totalDraftProjects, datapoints: draftProjects.datapoints },
        { key: "total_in_review", label: "Total in review", definition: "Total projects submitted for review", total: totalInProgress, datapoints: inProgress.datapoints },
      ],
    },
    {
      key: "inviters", label: "Inviters", definition: "Unique companies that invited one or more professionals on a project", driver: "retention",
      total: inviteDates.length, ...inviters,
      subs: [
        { key: "invites_per_project", label: "Invites/project", definition: "Professionals invited per published project", total: invitesPerProject, datapoints: empty8 },
        { key: "total_invited_unclaimed", label: "Total invited", definition: "Total invited companies that are not claimed", total: unclaimedInvitedCompanies, datapoints: empty8 },
      ],
    },
    {
      key: "subscribers", label: "Subscribers", definition: "Unique first time subscriptions", driver: "monetization",
      total: subscribedDates.length, ...subscribers,
      subs: [
        { key: "mrr", label: "MRR", definition: "Monthly recurring revenue", total: 0, datapoints: empty8 },
      ],
    },
    {
      key: "renewals", label: "Renewers", definition: "Unique subscribers that renewed their plan", driver: "monetization",
      total: 0, datapoints: empty8, labels,
      subs: [
        { key: "renewed", label: "Renewed", definition: "Subscriptions renewed this period", total: 0, datapoints: empty8 },
      ],
    },
    {
      key: "expansions", label: "Expanders", definition: "Unique subscribers that upgraded to a higher plan", driver: "monetization",
      total: 0, datapoints: empty8, labels,
      subs: [
        { key: "upgrades", label: "Upgrades", definition: "Subscribers that moved to a higher tier", total: 0, datapoints: empty8 },
      ],
    },
    {
      key: "contractions", label: "Contractors", definition: "Unique subscribers that downgraded to a lower plan", driver: "monetization",
      total: 0, datapoints: empty8, labels,
      subs: [
        { key: "downgrades", label: "Downgrades", definition: "Subscribers that moved to a lower tier", total: 0, datapoints: empty8 },
      ],
    },
    {
      key: "churn", label: "Churners", definition: "Unique companies that cancelled or let their subscription expire", driver: "churn",
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
      key: "client_visitors", label: "Visitors", definition: "Unique visitors browsing projects and professionals pages", driver: "acquisition",
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
      key: "client_signups", label: "Signups", definition: "New client accounts created", driver: "acquisition",
      total: clientSignupDates.length, ...clientSignups,
      subs: [
        { key: "google", label: "Google", definition: "Signups via Google OAuth", total: 0, datapoints: empty8 },
        { key: "email", label: "Email", definition: "Signups via email/password", total: 0, datapoints: empty8 },
      ],
    },
    {
      key: "sharers", label: "Sharers", definition: "Unique clients that shared a project or professional", driver: "retention",
      total: 0, datapoints: empty8, labels,
      subs: [
        { key: "shares_per_client", label: "Shares/client", definition: "Average shares per active sharer", total: 0, datapoints: empty8 },
        { key: "projects_shared", label: "Projects shared", definition: "Total projects shared", total: 0, datapoints: empty8 },
        { key: "professionals_shared", label: "Professionals shared", definition: "Total professionals shared", total: 0, datapoints: empty8 },
      ],
    },
    {
      key: "savers", label: "Savers", definition: "Unique clients that saved a project or professional", driver: "retention",
      total: uniqueSavers, ...uniqueSaversBucketed,
      subs: [
        { key: "saves_per_client", label: "Saves/client", definition: "Average saves per active saver", total: savesPerClient, datapoints: savesPerClientSeries },
        { key: "projects_saved", label: "Projects saved", definition: "Total projects saved", total: savedProjectDates.length, datapoints: savers.datapoints },
        { key: "pros_saved", label: "Professionals saved", definition: "Total professionals saved", total: savedCompanyDates.length, datapoints: savedPros.datapoints },
      ],
    },
    {
      key: "inquirers", label: "Contacters", definition: "Unique clients that contacted a professional via the platform", driver: "retention",
      total: 0, datapoints: empty8, labels,
      subs: [
        { key: "contacted", label: "Professionals contacted", definition: "Unique professionals contacted by clients", total: 0, datapoints: empty8 },
      ],
    },
  ]

  return { rows, labels }
}
