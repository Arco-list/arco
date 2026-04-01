"use server"

import { createServiceRoleSupabaseClient } from "@/lib/supabase/server"

export type Timeframe = "7d" | "30d" | "90d" | "ytd" | "all"

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
  proPublisherToInviter: string   // % of publishers that invited a professional
  proActiveToSubscriber: string   // % of active companies that subscribed
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
    case "7d": return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case "30d": return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    case "90d": return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    case "ytd": return new Date(now.getFullYear(), 0, 1)
    case "all": return null
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

export async function fetchGrowthMetrics(timeframe: Timeframe = "all"): Promise<GrowthMetrics> {
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
    supabase.from("companies").select("id, status, plan_tier, created_at"),
    supabase.from("projects").select("id, status, client_id, created_at"),
    supabase.from("project_professionals").select("id, professional_id, company_id, project_id, created_at"),
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
  const clientProfiles = profiles.filter((p: any) => p.user_types?.includes("client") && !p.user_types?.includes("professional"))

  const totalUsers = profiles.length
  const professionalUsers = professionalProfiles.length
  const clientUsers = clientProfiles.length
  const totalCompanies = allCompanies.length
  const draftCompanies = allCompanies.filter((c: any) => c.status === "draft").length
  const listedCompanies = allCompanies.filter((c: any) => c.status === "listed").length
  const unlistedCompanies = allCompanies.filter((c: any) => c.status === "unlisted").length
  const totalProjects = projects.length
  const publishedProjects = projects.filter((p: any) => p.status === "published").length
  // Unique companies with at least one published project
  const publishedProjectIds = new Set(allProjects.filter((p: any) => p.status === "published").map((p: any) => p.id))
  const publisherCompanyIds = new Set(
    allInvites.filter((i: any) => i.company_id && publishedProjectIds.has(i.project_id)).map((i: any) => i.company_id)
  )
  const publisherCompanies = publisherCompanyIds.size
  const paidCompanies = companies.filter((c: any) => c.plan_tier != null).length

  const signupsLast30d = allProfiles.filter((p: any) => new Date(p.created_at) > d30).length
  const signupsLast7d = allProfiles.filter((p: any) => new Date(p.created_at) > d7).length
  const companiesLast30d = allCompanies.filter((c: any) => new Date(c.created_at) > d30).length
  const projectsLast30d = allProjects.filter((p: any) => new Date(p.created_at) > d30).length

  // ── Cohorted conversion rates ──────────────────────────────────────────────
  // Pro cohort: professional users who signed up in this timeframe
  const proUserIds = new Set(professionalProfiles.map((p: any) => p.id))

  // Map user → company via professionals table
  const userToCompany = new Map<string, string>()
  allProfessionals.forEach((p: any) => {
    if (p.user_id && p.company_id) userToCompany.set(p.user_id, p.company_id)
  })

  // Companies owned by cohort users
  const cohortCompanyIds = new Set<string>()
  proUserIds.forEach((uid) => {
    const cid = userToCompany.get(uid)
    if (cid) cohortCompanyIds.add(cid)
  })

  // How many of those companies are listed (active)?
  const cohortActiveCompanies = allCompanies.filter(
    (c: any) => cohortCompanyIds.has(c.id) && c.status === "listed"
  )
  const cohortActiveIds = new Set(cohortActiveCompanies.map((c: any) => c.id))

  // How many of those active companies published a project?
  const companiesWithPublished = new Set<string>()
  allProjects.forEach((p: any) => {
    if (p.status === "published" && p.client_id) {
      // client_id is the user who created the project — map to company
      const cid = userToCompany.get(p.client_id)
      if (cid && cohortActiveIds.has(cid)) companiesWithPublished.add(cid)
    }
  })
  // Also check via invites (company_id on project_professionals)
  allInvites.forEach((inv: any) => {
    if (inv.company_id && cohortActiveIds.has(inv.company_id)) {
      // Check if this company's projects include published ones
      const hasPublished = allProjects.some(
        (p: any) => p.status === "published" && p.id === inv.project_id
      )
      // Simplified: just check if company has any published project
    }
  })

  // How many published companies also invited professionals?
  const companiesWithInvites = new Set<string>()
  allInvites.forEach((inv: any) => {
    if (inv.company_id && cohortActiveIds.has(inv.company_id)) {
      companiesWithInvites.add(inv.company_id)
    }
  })

  // How many cohort companies subscribed?
  const cohortSubscribed = allCompanies.filter(
    (c: any) => cohortCompanyIds.has(c.id) && c.plan_tier != null
  ).length

  // Client cohort
  const clientUserIds = new Set(clientProfiles.map((p: any) => p.id))
  // How many client signups saved something?
  const clientsWhoSaved = new Set<string>()
  allSavedProjects.forEach((s: any) => { if (clientUserIds.has(s.user_id)) clientsWhoSaved.add(s.user_id) })
  allSavedCompanies.forEach((s: any) => { if (clientUserIds.has(s.user_id)) clientsWhoSaved.add(s.user_id) })

  const cohortedRates: CohortedRates = {
    proSignupToActive: cohortRate(proUserIds.size, cohortActiveIds.size),
    proActiveToPublisher: cohortRate(cohortActiveIds.size, companiesWithPublished.size),
    proPublisherToInviter: cohortRate(companiesWithPublished.size, companiesWithInvites.size),
    proActiveToSubscriber: cohortRate(cohortActiveIds.size, cohortSubscribed),
    clientSignupToSaver: cohortRate(clientUserIds.size, clientsWhoSaved.size),
    clientSaverToInquirer: "—",
  }

  const professionals: UserFunnel = {
    visitors: null,
    signups: professionalUsers,
    companiesCreated: totalCompanies,
    projectsStarted: totalProjects,
    projectsPublished: publishedProjects,
    professionalsInvited: invites.length,
    inviterCompanies: (() => {
      // Companies that have project_professionals entries where they invited others
      // A company is an "inviter" if it owns a project that has other invited professionals
      const ownerPPs = allInvites.filter((i: any) => i.company_id)
      // Group by project_id to find projects with multiple companies
      const projectCompanies = new Map<string, Set<string>>()
      for (const pp of ownerPPs) {
        if (!projectCompanies.has(pp.project_id)) projectCompanies.set(pp.project_id, new Set())
        projectCompanies.get(pp.project_id)!.add(pp.company_id)
      }
      // Inviter = company that is on a project with other companies invited
      const inviterIds = new Set<string>()
      for (const [, companies] of projectCompanies) {
        if (companies.size > 1) companies.forEach((id) => inviterIds.add(id))
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
