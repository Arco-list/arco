"use server"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

export type Timeframe = "7d" | "30d" | "90d" | "ytd" | "all"

export type MetricRow = {
  key: string
  label: string
  driver: "acquisition" | "retention" | "monetization" | "churn"
  total: number
  datapoints: number[] // 6 data points
  labels: string[]     // 6 labels
  subs: Array<{ key: string; label: string; total: number; datapoints: number[] }>
}

function getRange(tf: Timeframe): { from: Date; bucketCount: 6; interval: "day" | "week" | "month" } {
  const now = new Date()
  switch (tf) {
    case "7d": return { from: new Date(now.getTime() - 7 * 86400000), bucketCount: 6, interval: "day" }
    case "30d": return { from: new Date(now.getTime() - 30 * 86400000), bucketCount: 6, interval: "week" } // ~5 day buckets
    case "90d": return { from: new Date(now.getTime() - 90 * 86400000), bucketCount: 6, interval: "week" }
    case "ytd": return { from: new Date(now.getFullYear(), 0, 1), bucketCount: 6, interval: "month" }
    case "all": return { from: new Date(2024, 0, 1), bucketCount: 6, interval: "month" }
  }
}

function bucket6(dates: Date[], from: Date): { datapoints: number[]; labels: string[] } {
  const now = new Date()
  const totalMs = now.getTime() - from.getTime()
  const bucketMs = totalMs / 6

  const datapoints = [0, 0, 0, 0, 0, 0]
  const labels: string[] = []

  for (let i = 0; i < 6; i++) {
    const start = new Date(from.getTime() + i * bucketMs)
    const end = new Date(from.getTime() + (i + 1) * bucketMs)
    labels.push(start.toLocaleDateString("en-US", { month: "short", day: "numeric" }))
    datapoints[i] = dates.filter((d) => d >= start && d < end).length
  }

  return { datapoints, labels }
}

export async function fetchMetricTable(timeframe: Timeframe = "all"): Promise<{ rows: MetricRow[]; labels: string[] }> {
  const supabase = createServiceRoleSupabaseClient()
  const { from } = getRange(timeframe)

  const [
    profilesResult,
    companiesResult,
    projectsResult,
    invitesResult,
    savedProjectsResult,
    savedCompaniesResult,
  ] = await Promise.all([
    supabase.from("profiles").select("id, user_types, created_at"),
    supabase.from("companies").select("id, status, plan_tier, created_at"),
    supabase.from("projects").select("id, status, client_id, created_at"),
    supabase.from("project_professionals").select("id, professional_id, company_id, created_at"),
    supabase.from("saved_projects").select("user_id, project_id, created_at"),
    supabase.from("saved_companies").select("user_id, company_id, created_at"),
  ])

  const profiles = (profilesResult.data ?? []) as any[]
  const companies = (companiesResult.data ?? []) as any[]
  const projects = (projectsResult.data ?? []) as any[]
  const invites = (invitesResult.data ?? []) as any[]
  const savedProjects = (savedProjectsResult.data ?? []) as any[]
  const savedCompanies = (savedCompaniesResult.data ?? []) as any[]

  // Helper to filter and bucket
  const makeDates = (items: any[], filter?: (item: any) => boolean) =>
    (filter ? items.filter(filter) : items).map((i: any) => new Date(i.created_at)).filter((d: Date) => d >= from)

  // Generate labels from first bucket call
  const { labels } = bucket6([], from)

  // ── Professional metrics ──────────────────────────────────────────────

  const proSignupDates = makeDates(profiles, (p) => p.user_types?.includes("professional"))
  const proSignups = bucket6(proSignupDates, from)

  const draftDates = makeDates(companies, (c) => c.status === "draft")
  const drafts = bucket6(draftDates, from)

  const activeDates = makeDates(companies, (c) => c.status === "listed")
  const actives = bucket6(activeDates, from)

  const unlistedDates = makeDates(companies, (c) => c.status === "unlisted")
  const unlisted = bucket6(unlistedDates, from)

  const allCompanyDates = makeDates(companies)
  const allCompanies = bucket6(allCompanyDates, from)

  const publishedDates = makeDates(projects, (p) => p.status === "published")
  const publishers = bucket6(publishedDates, from)

  const allProjectDates = makeDates(projects)
  const allProjects = bucket6(allProjectDates, from)

  const inviteDates = makeDates(invites)
  const inviters = bucket6(inviteDates, from)

  const subscribedDates = makeDates(companies, (c) => c.plan_tier != null)
  const subscribers = bucket6(subscribedDates, from)

  // ── Client metrics ────────────────────────────────────────────────────

  const clientSignupDates = makeDates(profiles, (p) => p.user_types?.includes("client") && !p.user_types?.includes("professional"))
  const clientSignups = bucket6(clientSignupDates, from)

  const savedProjectDates = makeDates(savedProjects)
  const savers = bucket6(savedProjectDates, from)

  const savedCompanyDates = makeDates(savedCompanies)
  const savedPros = bucket6(savedCompanyDates, from)

  const empty6 = [0, 0, 0, 0, 0, 0]

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
  const uniqueSaversBucketed = bucketUniqueSavers(allSaveEvents, from)

  function bucketUniqueSavers(events: any[], rangeFrom: Date): { datapoints: number[]; labels: string[] } {
    const now = new Date()
    const totalMs = now.getTime() - rangeFrom.getTime()
    const bucketMs = totalMs / 6
    const datapoints = [0, 0, 0, 0, 0, 0]
    const labels: string[] = []

    for (let i = 0; i < 6; i++) {
      const start = new Date(rangeFrom.getTime() + i * bucketMs)
      const end = new Date(rangeFrom.getTime() + (i + 1) * bucketMs)
      labels.push(start.toLocaleDateString("en-US", { month: "short", day: "numeric" }))
      const usersInBucket = new Set<string>()
      events.forEach((e: any) => {
        const d = new Date(e.created_at)
        if (d >= start && d < end && e.user_id) usersInBucket.add(e.user_id)
      })
      datapoints[i] = usersInBucket.size
    }

    return { datapoints, labels }
  }

  const rows: MetricRow[] = [
    // ── Professionals ──────────────────────────────────────────────────
    {
      key: "pro_visitors", label: "Visitors", driver: "acquisition",
      total: 0, datapoints: empty6, labels: proSignups.labels,
      subs: [
        { key: "sales_apollo", label: "Sales (Apollo)", total: 0, datapoints: empty6 },
        { key: "invites", label: "Invites", total: 0, datapoints: empty6 },
        { key: "direct", label: "Direct", total: 0, datapoints: empty6 },
        { key: "google", label: "Organic search", total: 0, datapoints: empty6 },
        { key: "social", label: "Social", total: 0, datapoints: empty6 },
        { key: "email", label: "Email", total: 0, datapoints: empty6 },
        { key: "referral", label: "Referral", total: 0, datapoints: empty6 },
      ],
    },
    {
      key: "drafts", label: "Draft", driver: "acquisition",
      total: draftDates.length, ...drafts,
      subs: [],
    },
    {
      key: "actives", label: "Listed", driver: "retention",
      total: activeDates.length, ...actives,
      subs: [
        { key: "unlisted", label: "Unlisted", total: unlistedDates.length, datapoints: unlisted.datapoints },
      ],
    },
    {
      key: "responders", label: "Responders", driver: "retention",
      total: 0, datapoints: empty6, labels: proSignups.labels,
      subs: [
        { key: "replies", label: "Replies", total: 0, datapoints: empty6 },
      ],
    },
    {
      key: "publishers", label: "Publishers", driver: "retention",
      total: publishedDates.length, ...publishers,
      subs: [
        { key: "total_projects", label: "Projects", total: allProjectDates.length, datapoints: allProjects.datapoints },
      ],
    },
    {
      key: "inviters", label: "Inviters", driver: "retention",
      total: inviteDates.length, ...inviters,
      subs: [
        { key: "pros_invited", label: "Pros invited", total: inviteDates.length, datapoints: inviters.datapoints },
      ],
    },
    {
      key: "trials", label: "Trials", driver: "retention",
      total: 0, datapoints: empty6, labels: proSignups.labels,
      subs: [
        { key: "started", label: "Started", total: 0, datapoints: empty6 },
      ],
    },
    {
      key: "subscribers", label: "Subscribers", driver: "monetization",
      total: subscribedDates.length, ...subscribers,
      subs: [
        { key: "mrr", label: "MRR", total: 0, datapoints: empty6 },
      ],
    },
    {
      key: "renewals", label: "Renewals", driver: "monetization",
      total: 0, datapoints: empty6, labels: proSignups.labels,
      subs: [
        { key: "renewed", label: "Renewed", total: 0, datapoints: empty6 },
      ],
    },
    {
      key: "expansions", label: "Expansions", driver: "monetization",
      total: 0, datapoints: empty6, labels: proSignups.labels,
      subs: [
        { key: "upgrades", label: "Upgrades", total: 0, datapoints: empty6 },
      ],
    },
    {
      key: "contractions", label: "Contractions", driver: "monetization",
      total: 0, datapoints: empty6, labels: proSignups.labels,
      subs: [
        { key: "downgrades", label: "Downgrades", total: 0, datapoints: empty6 },
      ],
    },
    {
      key: "churn", label: "Churn", driver: "churn",
      total: 0, datapoints: empty6, labels: proSignups.labels,
      subs: [
        { key: "lost", label: "Lost", total: 0, datapoints: empty6 },
      ],
    },
    // Separator
    {
      key: "_sep", label: "", driver: "acquisition",
      total: 0, datapoints: empty6, labels: proSignups.labels,
      subs: [],
    },
    // ── Clients ────────────────────────────────────────────────────────
    {
      key: "client_visitors", label: "Visitors", driver: "acquisition",
      total: 0, datapoints: empty6, labels: proSignups.labels,
      subs: [
        { key: "direct", label: "Direct", total: 0, datapoints: empty6 },
        { key: "google", label: "Organic search", total: 0, datapoints: empty6 },
        { key: "social", label: "Social", total: 0, datapoints: empty6 },
        { key: "email", label: "Email", total: 0, datapoints: empty6 },
        { key: "referral", label: "Referral", total: 0, datapoints: empty6 },
      ],
    },
    {
      key: "client_signups", label: "Signups", driver: "acquisition",
      total: clientSignupDates.length, ...clientSignups,
      subs: [
        { key: "google", label: "Google", total: 0, datapoints: empty6 },
        { key: "email", label: "Email", total: 0, datapoints: empty6 },
      ],
    },
    {
      key: "client_actives", label: "Actives", driver: "retention",
      total: 0, datapoints: empty6, labels: proSignups.labels,
      subs: [
        { key: "pages_per_session", label: "2+ pages/session", total: 0, datapoints: empty6 },
      ],
    },
    {
      key: "sharers", label: "Sharers", driver: "retention",
      total: 0, datapoints: empty6, labels: proSignups.labels,
      subs: [
        { key: "shares_per_client", label: "Shares/client", total: 0, datapoints: empty6 },
        { key: "projects_shared", label: "Projects shared", total: 0, datapoints: empty6 },
        { key: "professionals_shared", label: "Professionals shared", total: 0, datapoints: empty6 },
      ],
    },
    {
      key: "savers", label: "Savers", driver: "retention",
      total: uniqueSavers, ...uniqueSaversBucketed,
      subs: [
        { key: "saves_per_client", label: "Saves/client", total: savesPerClient, datapoints: empty6 },
        { key: "projects_saved", label: "Projects saved", total: savedProjectDates.length, datapoints: savers.datapoints },
        { key: "pros_saved", label: "Professionals saved", total: savedCompanyDates.length, datapoints: savedPros.datapoints },
      ],
    },
    {
      key: "inquirers", label: "Inquirers", driver: "retention",
      total: 0, datapoints: empty6, labels: proSignups.labels,
      subs: [
        { key: "contacted", label: "Professionals contacted", total: 0, datapoints: empty6 },
      ],
    },
  ]

  return { rows, labels: proSignups.labels }
}
