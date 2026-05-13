"use server"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

export type Timeframe = "days" | "weeks" | "months" | "years"

export type UserFunnel = {
  visitors: number | null
  signups: number
  companiesCreated: number
  projectsStarted: number
  projectsPublished: number
  professionalsInvited: number
  inviterCompanies: number
  invitesAcceptedPct: string
  subscribed: number
  savedProjects: number
  savesPerClient: number
  contactedProfessional: number
}

// Cohorted conversion rates: "of users who signed up in this period, how many did X?"
export type CohortedRates = {
  // Professional cohort: users who signed up as professional in this timeframe
  proSignupToActive: string       // % of pro signups that created a listed company
  proActiveToPublisher: string    // % of active companies that published a project
  proPublisherToInviter: string   // K-factor: avg invites per publishing project (>100% expected)
  proActiveToSubscriber: string   // % of active companies that subscribed
  // Cross-funnel: any signup in cohort (pro or client) → created a draft company.
  // Captures the visitor → signup → draft path including users who signed up
  // without picking a role and only later created a company. This is what the
  // SEO loop measures as Step 4 (signup → draft).
  signupToDraft: string
  // Client cohort: users who signed up as client in this timeframe
  clientSignupToSaver: string     // % of client signups that saved something
  clientSaverToInquirer: string   // placeholder
}

export type GrowthMetrics = {
  timeframe: Timeframe
  totalUsers: number
  professionalUsers: number
  clientUsers: number
  totalCompanies: number
  draftCompanies: number
  listedCompanies: number
  unlistedCompanies: number
  totalProjects: number
  publishedProjects: number
  publisherCompanies: number
  totalInvites: number
  paidCompanies: number
  signupsLast30d: number
  signupsLast7d: number
  companiesLast30d: number
  projectsLast30d: number
  professionals: UserFunnel
  clients: UserFunnel
  cohortedRates: CohortedRates
  weeklySignups: Array<{ week: string; count: number }>
  weeklyProjects: Array<{ week: string; count: number }>
}

function getTimeframeCutoff(tf: Timeframe): Date | null {
  const now = new Date()
  switch (tf) {
    case "days": return new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000)
    case "weeks": return new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000)
    case "months": return new Date(now.getFullYear(), now.getMonth() - 8, now.getDate())
    case "years": return null
  }
}

function inRange(dateStr: string, cutoff: Date | null): boolean {
  if (!cutoff) return true
  return new Date(dateStr) >= cutoff
}

function cohortRate(cohortSize: number, converted: number): string {
  if (!cohortSize || cohortSize === 0) return "—"
  return `${Math.round((converted / cohortSize) * 100)}%`
}

export async function fetchGrowthMetrics(timeframe: Timeframe = "months"): Promise<GrowthMetrics> {
  const supabase = createServiceRoleSupabaseClient()
  const cutoff = getTimeframeCutoff(timeframe)

  const [
    profilesResult,
    companiesResult,
    projectsResult,
    invitesResult,
    savedProjectsResult,
    savedCompaniesResult,
    // For cohort analysis: need to link users to companies
    professionalsResult,
  ] = await Promise.all([
    supabase.from("profiles").select("id, user_types, created_at"),
    supabase.from("companies").select("id, status, plan_tier, created_at, owner_id"),
    supabase.from("projects").select("id, status, client_id, created_at, updated_at, published_at"),
    supabase.from("project_professionals").select("id, professional_id, company_id, project_id, created_at, is_project_owner"),
    supabase.from("saved_projects").select("user_id, project_id, created_at"),
    supabase.from("saved_companies").select("user_id, company_id, created_at"),
    supabase.from("professionals").select("user_id, company_id"),
  ])

  const allProfiles = (profilesResult.data ?? []) as any[]
  const allCompanies = (companiesResult.data ?? []) as any[]
  const allProjects = (projectsResult.data ?? []) as any[]
  const allInvites = (invitesResult.data ?? []) as any[]
  const allSavedProjects = (savedProjectsResult.data ?? []) as any[]
  const allSavedCompanies = (savedCompaniesResult.data ?? []) as any[]
  const allProfessionals = (professionalsResult.data ?? []) as any[]

  // Filter by timeframe
  const profiles = allProfiles.filter((p: any) => inRange(p.created_at, cutoff))
  const companies = allCompanies.filter((c: any) => inRange(c.created_at, cutoff))
  const projects = allProjects.filter((p: any) => inRange(p.created_at, cutoff))
  const invites = allInvites.filter((i: any) => inRange(i.created_at, cutoff))
  const savedProjects = allSavedProjects.filter((s: any) => inRange(s.created_at, cutoff))
  const savedCompanies = allSavedCompanies.filter((s: any) => inRange(s.created_at, cutoff))

  // Unique savers
  const saverUserIds = new Set<string>()
  savedProjects.forEach((s: any) => { if (s.user_id) saverUserIds.add(s.user_id) })
  savedCompanies.forEach((s: any) => { if (s.user_id) saverUserIds.add(s.user_id) })
  const uniqueSavers = saverUserIds.size

  const now = new Date()
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const professionalProfiles = profiles.filter((p: any) => p.user_types?.includes("professional"))
  const clientProfiles = profiles.filter((p: any) => p.user_types?.includes("client"))

  const totalUsers = profiles.length
  const professionalUsers = professionalProfiles.length
  const clientUsers = clientProfiles.length
  const totalCompanies = allCompanies.length
  // Drafts = claimed companies created in the timeframe. Scraped/unclaimed
  // companies (owner_id null) sit outside the funnel.
  const claimedCompany = (c: any) => c.owner_id != null
  const draftCompanies = companies.filter(claimedCompany).length
  // Listed = claimed companies whose current status is exactly 'listed'.
  // Earlier code lumped 'unlisted' / 'deactivated' in on the assumption that
  // they "all passed through listed", but 'unlisted' also covers scraped
  // companies that never reached listed.
  const listedCompanies = allCompanies.filter((c: any) => c.status === "listed" && claimedCompany(c)).length
  const unlistedCompanies = allCompanies.filter((c: any) => c.status === "unlisted").length
  const totalProjects = projects.length
  const publishedProjects = projects.filter((p: any) => p.status === "published").length
  // Unique companies that own at least one project published in the period.
  // Uses projects.published_at (stamped by migration 143's trigger). Rows
  // with NULL published_at — every project that was already published
  // before the migration — are intentionally skipped.
  const projectIdToOwner = new Map<string, string>()
  for (const pp of allInvites) {
    if (!pp.is_project_owner || !pp.project_id || !pp.company_id) continue
    if (!projectIdToOwner.has(pp.project_id)) {
      projectIdToOwner.set(pp.project_id, pp.company_id)
    }
  }
  const publisherCompanyIds = new Set<string>()
  for (const p of allProjects) {
    if (p.status !== "published") continue
    if (!p.published_at || !inRange(p.published_at, cutoff)) continue
    const owner = projectIdToOwner.get(p.id)
    if (owner) publisherCompanyIds.add(owner)
  }
  const publisherCompanies = publisherCompanyIds.size
  const paidTiers = ["pro", "premium", "enterprise"]
  const paidCompanies = companies.filter((c: any) => paidTiers.includes(c.plan_tier)).length

  const signupsLast30d = allProfiles.filter((p: any) => new Date(p.created_at) > d30).length
  const signupsLast7d = allProfiles.filter((p: any) => new Date(p.created_at) > d7).length
  const companiesLast30d = allCompanies.filter((c: any) => new Date(c.created_at) > d30).length
  const projectsLast30d = allProjects.filter((p: any) => new Date(p.created_at) > d30).length

  // ── All-time conversion rates ─────────────────────────────────────────────
  // Conversion rates use all-time data, not the timeframe-filtered cohort.
  // Cohort sizes are too small at current scale (~10s of signups) for
  // weekly/monthly windows to be meaningful — they'd swing wildly between 0%
  // and 200% on noise. All-time rates are stable and don't change when the
  // timeframe selector toggles. The "Volume" cards above still respect the
  // timeframe; only the conversion arrows are all-time.

  // Map user → company via professionals table (all-time)
  const userToCompany = new Map<string, string>()
  allProfessionals.forEach((p: any) => {
    if (p.user_id && p.company_id) userToCompany.set(p.user_id, p.company_id)
  })

  // Pro user set, all-time
  const allProfessionalProfilesArr = allProfiles.filter((p: any) => p.user_types?.includes("professional"))
  const allClientProfilesArr = allProfiles.filter((p: any) => p.user_types?.includes("client"))
  const proUserIds = new Set(allProfessionalProfilesArr.map((p: any) => p.id))
  const clientUserIds = new Set(allClientProfilesArr.map((p: any) => p.id))

  // Companies owned by pro users (all-time)
  const cohortCompanyIds = new Set<string>()
  proUserIds.forEach((uid) => {
    const cid = userToCompany.get(uid)
    if (cid) cohortCompanyIds.add(cid)
  })

  // Listed (active) subset
  const cohortActiveCompanies = allCompanies.filter(
    (c: any) => cohortCompanyIds.has(c.id) && c.status === "listed"
  )
  const cohortActiveIds = new Set(cohortActiveCompanies.map((c: any) => c.id))

  // Listed companies that published a project
  const companiesWithPublished = new Set<string>()
  allProjects.forEach((p: any) => {
    if (p.status === "published" && p.client_id) {
      const cid = userToCompany.get(p.client_id)
      if (cid && cohortActiveIds.has(cid)) companiesWithPublished.add(cid)
    }
  })

  // Listed companies that invited any professional. Intersected with
  // companiesWithPublished below to give a true publisher → inviter rate
  // (capped at 100%) rather than the K-factor multiplier the old code
  // produced when comparing two independent set sizes.
  const companiesWithInvites = new Set<string>()
  allInvites.forEach((inv: any) => {
    if (inv.company_id && cohortActiveIds.has(inv.company_id)) {
      companiesWithInvites.add(inv.company_id)
    }
  })
  const publishersWhoAlsoInvited = new Set<string>()
  companiesWithPublished.forEach((id) => {
    if (companiesWithInvites.has(id)) publishersWhoAlsoInvited.add(id)
  })

  // Active → subscribed: must intersect with listed for a true conversion.
  // Earlier code used cohortCompanyIds (listed or not) which could exceed
  // 100% when a paid company never reached "listed".
  const activeAndSubscribed = allCompanies.filter(
    (c: any) => cohortActiveIds.has(c.id) && paidTiers.includes(c.plan_tier)
  ).length

  // Cross-funnel signup → draft. Counts ALL signups (any role) whose user_id
  // maps to a claimed company. Captures the visit → signup → draft path
  // including users who signed up without picking a role and only later
  // created a company.
  const signupsWithDraft = allProfiles.filter((p: any) => {
    const cid = userToCompany.get(p.id)
    if (!cid) return false
    const company = allCompanies.find((c: any) => c.id === cid)
    return company && claimedCompany(company)
  }).length

  // Client signups (all-time) who saved any project or company. clientUserIds
  // already declared above with the all-time set; we just need the savers
  // intersection here.
  const clientsWhoSaved = new Set<string>()
  allSavedProjects.forEach((s: any) => { if (clientUserIds.has(s.user_id)) clientsWhoSaved.add(s.user_id) })
  allSavedCompanies.forEach((s: any) => { if (clientUserIds.has(s.user_id)) clientsWhoSaved.add(s.user_id) })

  const cohortedRates: CohortedRates = {
    proSignupToActive: cohortRate(proUserIds.size, cohortActiveIds.size),
    proActiveToPublisher: cohortRate(cohortActiveIds.size, companiesWithPublished.size),
    proPublisherToInviter: cohortRate(companiesWithPublished.size, publishersWhoAlsoInvited.size),
    proActiveToSubscriber: cohortRate(cohortActiveIds.size, activeAndSubscribed),
    signupToDraft: cohortRate(allProfiles.length, signupsWithDraft),
    clientSignupToSaver: cohortRate(clientUserIds.size, clientsWhoSaved.size),
    clientSaverToInquirer: "—",
  }

  const professionals: UserFunnel = {
    visitors: null,
    signups: professionalUsers,
    companiesCreated: totalCompanies,
    projectsStarted: totalProjects,
    projectsPublished: publishedProjects,
    professionalsInvited: invites.filter((i: any) => !i.is_project_owner).length,
    inviterCompanies: (() => {
      // An inviter is the project-owner company of a project that received at
      // least one non-owner project_professionals row created in the period.
      // (`invites` is already filtered by created_at within the timeframe.)
      const inviterIds = new Set<string>()
      for (const pp of invites) {
        if (pp.is_project_owner) continue
        const owner = projectIdToOwner.get(pp.project_id)
        if (owner) inviterIds.add(owner)
      }
      return inviterIds.size
    })(),
    invitesAcceptedPct: (() => {
      // Invited companies (not the project owner) that claimed their profile
      const invitedCompanyIds = new Set(allInvites.filter((i: any) => i.company_id).map((i: any) => i.company_id))
      const acceptedCount = allCompanies.filter((c: any) => invitedCompanyIds.has(c.id) && c.owner_id).length
      return invitedCompanyIds.size > 0 ? `${Math.round((acceptedCount / invitedCompanyIds.size) * 100)}%` : "0%"
    })(),
    subscribed: paidCompanies,
    savedProjects: 0,
    savesPerClient: 0,
    contactedProfessional: 0,
  }

  const clients: UserFunnel = {
    visitors: null,
    signups: clientUsers,
    companiesCreated: 0,
    projectsStarted: 0,
    projectsPublished: 0,
    professionalsInvited: 0,
    subscribed: 0,
    savedProjects: uniqueSavers,
    savesPerClient: uniqueSavers > 0 ? Math.round(((savedProjects.length + savedCompanies.length) / uniqueSavers) * 10) / 10 : 0,
    contactedProfessional: 0,
  }

  const weeklySignups = buildWeeklyTrend(allProfiles.map((p: any) => p.created_at), 12)
  const weeklyProjects = buildWeeklyTrend(
    allProjects.filter((p: any) => p.status === "published").map((p: any) => p.created_at),
    12
  )

  return {
    timeframe,
    totalUsers,
    professionalUsers,
    clientUsers,
    totalCompanies,
    draftCompanies,
    listedCompanies,
    unlistedCompanies,
    totalProjects,
    publishedProjects,
    publisherCompanies,
    totalInvites: invites.length,
    paidCompanies,
    signupsLast30d,
    signupsLast7d,
    companiesLast30d,
    projectsLast30d,
    professionals,
    clients,
    cohortedRates,
    weeklySignups,
    weeklyProjects,
  }
}

function buildWeeklyTrend(dates: string[], weeks: number): Array<{ week: string; count: number }> {
  const now = new Date()
  const result: Array<{ week: string; count: number }> = []
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000)
    const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000)
    const count = dates.filter((d) => {
      const date = new Date(d)
      return date >= weekStart && date < weekEnd
    }).length
    result.push({
      week: weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count,
    })
  }
  return result
}
