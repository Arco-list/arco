import { AdminCompaniesDataTable, type AdminCompanyRow } from "@/components/admin-companies-data-table"
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import type { Tables } from "@/lib/supabase/types"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

type ServiceOption = {
  id: string
  name: string
}

type AdminCompanyMetricsRow = {
  company_id: string
  professional_count: number
  projects_linked: number
  average_rating: number | null
  total_reviews: number
}

async function loadAdminCompaniesData() {
  const supabase = await createServerSupabaseClient()

  // Parallel queries
  const [companiesQuery, metricsQuery, servicesQuery, projectProfessionalsQuery, unclaimedInvitesQuery, companyMembersQuery] =
    await Promise.all([
      supabase
        .from("companies")
        .select(
          "id, name, slug, status, plan_tier, city, country, is_verified, is_featured, domain, logo_url, website, email, services_offered, primary_service_id, plan_expires_at, owner_id, created_at, auto_approve_projects, seo_indexed, seo_indexation_state, seo_impressions_28d, seo_clicks_28d, seo_ctr_28d, seo_position_28d"
        ),
      supabase
        .from("company_metrics")
        .select("company_id, professional_count, projects_linked, average_rating, total_reviews"),
      supabase.from("categories").select("id, name, can_publish_projects").eq("is_active", true).order("name", { ascending: true }),
      // All project_professionals with a company_id — get status + invited services + project details
      supabase
        .from("project_professionals")
        .select("id, company_id, status, invited_email, invited_service_category_ids, is_project_owner, project:projects(id, title, slug, status)")
        .not("company_id", "is", null),
      // Unclaimed invites: no professional_id AND no company_id
      supabase
        .from("project_professionals")
        .select("id, invited_email, invited_at, status, project:projects(title, status)")
        .is("professional_id", null)
        .is("company_id", null),
      // Company members — to identify which companies have been claimed
      supabase
        .from("company_members")
        .select("company_id")
        .eq("status", "active"),
    ])

  if (companiesQuery.error) {
    logger.error("Failed to load companies", { table: "companies" }, companiesQuery.error)
    throw new Error("Failed to load companies data")
  }
  if (metricsQuery.error) {
    logger.error("Failed to load company metrics", { view: "company_metrics" }, metricsQuery.error)
  }
  if (servicesQuery.error) {
    logger.error("Failed to load services", { table: "categories" }, servicesQuery.error)
  }
  if (projectProfessionalsQuery.error) {
    logger.error("Failed to load project professionals", { table: "project_professionals" }, projectProfessionalsQuery.error)
  }
  if (unclaimedInvitesQuery.error) {
    logger.error("Failed to load unclaimed invites", { table: "project_professionals" }, unclaimedInvitesQuery.error)
  }
  if (companyMembersQuery.error) {
    logger.error("Failed to load company members", { table: "company_members" }, companyMembersQuery.error)
  }

  const companies = (companiesQuery.data ?? []).filter(
    (company): company is Tables<"companies"> => Boolean(company?.id)
  )

  // Build service name lookup and publishable categories set
  const serviceNameMap = new Map<string, string>()
  const servicesOptions: ServiceOption[] = []
  const publishableCategoryIds = new Set<string>()
  for (const service of servicesQuery.data ?? []) {
    if (service?.id && service?.name) {
      serviceNameMap.set(service.id, service.name)
      servicesOptions.push({ id: service.id, name: service.name })
      if (service.can_publish_projects) {
        publishableCategoryIds.add(service.id)
      }
    }
  }

  // Build metrics lookup
  const metricsByCompany = new Map<string, AdminCompanyMetricsRow>()
  for (const row of metricsQuery.data ?? []) {
    if (row?.company_id) {
      metricsByCompany.set(row.company_id, {
        company_id: row.company_id,
        professional_count: typeof row.professional_count === "number" ? row.professional_count : 0,
        projects_linked: typeof row.projects_linked === "number" ? row.projects_linked : 0,
        total_reviews: typeof row.total_reviews === "number" ? row.total_reviews : 0,
        average_rating:
          typeof row.average_rating === "number" ? Number(Number(row.average_rating).toFixed(2)) : null,
      })
    }
  }

  // Build per-company project counts, details, invite services, and invite emails
  type LinkedProject = { id: string; ppId: string; title: string; slug: string | null; projectStatus: string; inviteStatus: string; isProjectOwner: boolean }
  const companyProjectsAccepted = new Map<string, number>()
  const companyProjectsPending = new Map<string, number>()
  const companyProjectsList = new Map<string, LinkedProject[]>()
  const companyInviteServices = new Map<string, string[]>()
  const companyInviteEmail = new Map<string, string>()
  for (const row of projectProfessionalsQuery.data ?? []) {
    if (!row?.company_id) continue
    const companyId = row.company_id as string
    if (row.status === "listed" || row.status === "live_on_page") {
      companyProjectsAccepted.set(companyId, (companyProjectsAccepted.get(companyId) ?? 0) + 1)
    } else if (row.status === "invited") {
      companyProjectsPending.set(companyId, (companyProjectsPending.get(companyId) ?? 0) + 1)
    }
    // Collect project details
    const project = row.project as unknown as { id: string; title: string; slug: string | null; status: string } | null
    if (project?.id) {
      const existing = companyProjectsList.get(companyId) ?? []
      if (!existing.some((p) => p.id === project.id)) {
        existing.push({
          id: project.id,
          ppId: row.id as string,
          title: project.title ?? "Untitled project",
          slug: project.slug ?? null,
          projectStatus: project.status ?? "draft",
          inviteStatus: row.status as string,
          isProjectOwner: Boolean(row.is_project_owner),
        })
        companyProjectsList.set(companyId, existing)
      }
    }
    // Collect service category IDs from invites (for unclaimed companies)
    if (Array.isArray(row.invited_service_category_ids)) {
      const existing = companyInviteServices.get(companyId) ?? []
      for (const id of row.invited_service_category_ids) {
        if (typeof id === "string" && !existing.includes(id)) {
          existing.push(id)
        }
      }
      companyInviteServices.set(companyId, existing)
    }
    // Collect invited email (for unclaimed companies — use first one found)
    if (row.invited_email && !companyInviteEmail.has(companyId)) {
      companyInviteEmail.set(companyId, row.invited_email as string)
    }
  }

  // Build set of companies that have active team members (= "claimed")
  const claimedCompanyIds = new Set<string>()
  for (const row of companyMembersQuery.data ?? []) {
    if (row?.company_id) {
      claimedCompanyIds.add(row.company_id as string)
    }
  }

  // Fetch owner profiles
  const ownerIds = Array.from(
    new Set(companies.map((c) => c.owner_id).filter((id): id is string => Boolean(id)))
  )
  const ownerProfileMap = new Map<
    string,
    Pick<Tables<"profiles">, "id" | "first_name" | "last_name" | "avatar_url">
  >()
  const ownerEmailMap = new Map<string, string>()

  if (ownerIds.length > 0) {
    const { data: ownerProfiles, error: ownerProfilesError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, avatar_url")
      .in("id", ownerIds)

    if (ownerProfilesError) {
      logger.error("Failed to load owner profiles", { table: "profiles" }, ownerProfilesError)
    } else {
      for (const profile of ownerProfiles ?? []) {
        ownerProfileMap.set(profile.id, profile)
      }
    }

    // Fetch owner auth emails for draft companies (company email may not be set yet)
    const serviceRole = createServiceRoleSupabaseClient()
    for (const oid of ownerIds) {
      const { data: userData } = await serviceRole.auth.admin.getUserById(oid)
      if (userData?.user?.email) {
        ownerEmailMap.set(oid, userData.user.email)
      }
    }
  }

  // Build company rows
  const companyRows: AdminCompanyRow[] = companies.map((company) => {
    // Detect unclaimed companies: unlisted + no active team members
    // These were auto-created from project invites — owner_id is the project client, not the professional
    const isUnclaimed = (company.status === "unlisted" || company.status === "draft") && !claimedCompanyIds.has(company.id) && !company.owner_id

    // For claimed companies: use owner profile; for unclaimed: use invited email
    const ownerProfile = !isUnclaimed && company.owner_id ? ownerProfileMap.get(company.owner_id) : null
    const ownerName = ownerProfile
      ? [ownerProfile.first_name, ownerProfile.last_name].filter(Boolean).join(" ").trim() || null
      : null

    // For unclaimed companies, get services from invite data instead of company.services_offered
    let serviceIds: string[]
    let resolvedServices: string[]
    if (isUnclaimed) {
      serviceIds = companyInviteServices.get(company.id) ?? []
      resolvedServices = serviceIds
        .map((id) => serviceNameMap.get(id))
        .filter((name): name is string => Boolean(name))
    } else {
      serviceIds = Array.isArray(company.services_offered)
        ? company.services_offered.filter((v): v is string => typeof v === "string")
        : []
      // Fall back to primary_service_id if services_offered is empty
      if (serviceIds.length === 0 && company.primary_service_id) {
        serviceIds = [company.primary_service_id]
      }
      resolvedServices = serviceIds
        .map((id) => serviceNameMap.get(id))
        .filter((name): name is string => Boolean(name))
    }

    // For unclaimed companies: domain from invited email, owner email from invited email
    const invitedEmail = isUnclaimed ? (companyInviteEmail.get(company.id) ?? company.email) : null
    const domain = isUnclaimed
      ? (invitedEmail?.includes("@") ? invitedEmail.split("@")[1] : company.domain) ?? null
      : company.domain ?? null

    return {
      id: company.id,
      type: "company" as const,
      name: company.name,
      slug: company.slug ?? null,
      services: resolvedServices,
      domain,
      status: isUnclaimed ? ("invited" as const) : company.status,
      ownerName: isUnclaimed ? null : ownerName,
      ownerEmail: isUnclaimed
        ? (invitedEmail ?? null)
        : ((company as any).owner_id ? ownerEmailMap.get((company as any).owner_id) ?? null : null),
      ownerAvatarUrl: isUnclaimed ? null : (ownerProfile?.avatar_url ?? null),
      projectsAccepted: companyProjectsAccepted.get(company.id) ?? 0,
      projectsPending: companyProjectsPending.get(company.id) ?? 0,
      projects: companyProjectsList.get(company.id) ?? [],
      createdAt: company.created_at ?? null,
      logoUrl: company.logo_url ?? null,
      isVerified: Boolean(company.is_verified),
      isFeatured: Boolean(company.is_featured),
      planTier: company.plan_tier,
      planExpiresAt: company.plan_expires_at ?? null,
      contactEmail: company.email ?? null,
      website: company.website ?? null,
      servicesOffered: serviceIds,
      primaryServiceId: company.primary_service_id ?? null,
      city: company.city ?? null,
      country: company.country ?? null,
      hasPublishedProjects: (companyProjectsList.get(company.id) ?? []).some(
        (p) => p.projectStatus === "published" && (p.inviteStatus === "listed" || p.inviteStatus === "live_on_page"),
      ),
      canPublishProjects: serviceIds.some((id) => publishableCategoryIds.has(id)),
      autoApproveProjects: Boolean((company as any).auto_approve_projects),
      seoIndexed: (company as any).seo_indexed ?? null,
      seoIndexationState: (company as any).seo_indexation_state ?? null,
      seoImpressions28d: (company as any).seo_impressions_28d ?? null,
      seoClicks28d: (company as any).seo_clicks_28d ?? null,
      seoCtr28d: (company as any).seo_ctr_28d != null ? Number((company as any).seo_ctr_28d) : null,
      seoPosition28d: (company as any).seo_position_28d != null ? Number((company as any).seo_position_28d) : null,
    }
  })

  // Build invite rows (grouped by email)
  const invitesByEmail = new Map<
    string,
    { count: number; latestInvitedAt: string | null }
  >()
  for (const row of unclaimedInvitesQuery.data ?? []) {
    if (!row?.invited_email) continue
    const existing = invitesByEmail.get(row.invited_email)
    if (!existing) {
      invitesByEmail.set(row.invited_email, {
        count: 1,
        latestInvitedAt: row.invited_at,
      })
    } else {
      existing.count += 1
      if (
        row.invited_at &&
        (!existing.latestInvitedAt || new Date(row.invited_at) > new Date(existing.latestInvitedAt))
      ) {
        existing.latestInvitedAt = row.invited_at
      }
    }
  }

  const inviteRows: AdminCompanyRow[] = Array.from(invitesByEmail.entries()).map(
    ([email, data]) => {
      const emailDomain = email.includes("@") ? email.split("@")[1] : null

      return {
        id: `invite-${email}`,
        type: "invite" as const,
        name: email,
        slug: null,
        services: [],
        domain: emailDomain ?? null,
        status: "invited" as const,
        ownerName: null,
        ownerEmail: null,
        ownerAvatarUrl: null,
        projectsAccepted: 0,
        projectsPending: data.count,
        projects: [],
        createdAt: data.latestInvitedAt,
        logoUrl: null,
        isVerified: false,
        isFeatured: false,
        planTier: "basic" as const,
        planExpiresAt: null,
        contactEmail: null,
        website: null,
        servicesOffered: [],
        primaryServiceId: null,
        city: null,
        country: null,
        hasPublishedProjects: false,
        canPublishProjects: false,
        autoApproveProjects: false,
        seoIndexed: null,
        seoIndexationState: null,
        seoImpressions28d: null,
        seoClicks28d: null,
        seoCtr28d: null,
        seoPosition28d: null,
      }
    }
  )

  // Merge: companies first, then invites
  const mergedRows = [...companyRows, ...inviteRows]

  return { mergedRows, servicesOptions }
}

export default async function AdminProfessionalsPage() {
  const { mergedRows, servicesOptions } = await loadAdminCompaniesData()

  return (
    <div className="min-h-screen bg-white">
      <div className="discover-page-title">
        <div className="wrap">
          <AdminCompaniesDataTable data={mergedRows} serviceOptions={servicesOptions} />
        </div>
      </div>
    </div>
  )
}
