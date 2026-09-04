import { AdminCompaniesDataTable, type AdminCompanyRow } from "@/components/admin-companies-data-table"
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import type { Tables } from "@/lib/supabase/types"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

type ServiceOption = {
  id: string
  name: string
  parentId: string | null
  sortOrder: number | null
}

type AdminCompanyMetricsRow = {
  company_id: string
  professional_count: number
  projects_linked: number
}

async function loadAdminCompaniesData() {
  const supabase = await createServerSupabaseClient()

  // Parallel queries
  const [companiesQuery, metricsQuery, servicesQuery, projectProfessionalsQuery, unclaimedInvitesQuery, companyMembersQuery, companyContactsQuery] =
    await Promise.all([
      // Real marketplace entities: anything that entered directly, was
      // admin-added, or was peer-invited — plus any company that has
      // reached the claimed lifecycle (Draft onwards) regardless of
      // source. This lets Apollo cold-imports that later claim (e.g.
      // ARCHIE, RA STUDIO) surface here while pre-claim Apollo rows
      // stay confined to /admin/sales.
      supabase
        .from("companies")
        .select(
          "id, name, slug, status, city, country, is_verified, is_featured, domain, logo_url, website, email, services_offered, primary_service_id, owner_id, created_at, listed_at, auto_approve_projects, source, first_touch_source, audience, seo_indexed, seo_indexation_state, seo_impressions_28d, seo_clicks_28d, seo_ctr_28d, seo_position_28d"
        )
        .or("source.in.(direct,manual,invited),status.in.(invited,verified,created,owned,listed,unlisted,deactivated)"),
      supabase
        .from("company_metrics")
        .select("company_id, professional_count, projects_linked"),
      // Professional categories only (Architect, Builder, etc.) — the
      // Project category_type covers building types (Apartment,
      // Bungalow) which don't belong in a service filter. parent_id +
      // sort_order power the grouped dropdown ("Design & Planning" →
      // Architect, Interior Designer, …).
      supabase
        .from("categories")
        .select("id, name, slug, can_publish_projects, parent_id, sort_order")
        .eq("is_active", true)
        .eq("category_type", "Professional")
        .order("sort_order", { ascending: true, nullsFirst: false }),
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
      // Company members — to identify which companies have been claimed.
      // Filter to team roles so sales leads (role='contact') don't count.
      supabase
        .from("company_contacts")
        .select("company_id")
        .in("role", ["owner", "admin", "member"])
        .eq("status", "active"),
      // Membership contacts (owners / admins / members) joined to persons.
      // Role-filtered in the QUERY, not just the mapping: sales leads
      // (role='contact') dominate this table (1,200+ rows) and an
      // unbounded select silently truncates at PostgREST's 1,000-row cap
      // with arbitrary ordering — real owners randomly vanished from the
      // Users column once the pipeline grew past the cap.
      supabase
        .from("company_contacts")
        .select("id, company_id, role, status, last_contacted_at, next_follow_up_at, notes, person:persons(id, first_name, last_name, email, phone, phone_country_code, source, auth_user_id)")
        .in("role", ["owner", "admin", "member"]),
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
  if (companyContactsQuery.error) {
    logger.error("Failed to load company contacts", { table: "company_contacts" }, companyContactsQuery.error)
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
      servicesOptions.push({
        id: service.id,
        name: service.name,
        parentId: service.parent_id ?? null,
        sortOrder: service.sort_order ?? null,
      })
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
      })
    }
  }

  // Contributors pulled in by each anchor: non-owner credits on projects
  // this company OWNS, split accepted (live/listed) vs still-invited —
  // the per-anchor tagging metric. Photographer credits are documentation,
  // not trades — excluded from the counts.
  const photographerServiceIds = new Set(
    (servicesQuery.data ?? [])
      .filter((c) => (c as { slug?: string | null }).slug === "photographer")
      .map((c) => c.id),
  )
  const photographerCompanyIds = new Set(
    (companiesQuery.data ?? [])
      .filter((c) => c.primary_service_id && photographerServiceIds.has(c.primary_service_id))
      .map((c) => c.id),
  )
  const projectOwnerCompany = new Map<string, string>()
  for (const row of projectProfessionalsQuery.data ?? []) {
    const project = row?.project as unknown as { id: string } | null
    if (row?.is_project_owner && row.company_id && project?.id) {
      projectOwnerCompany.set(project.id, row.company_id as string)
    }
  }
  const companyTeamAccepted = new Map<string, number>()
  const companyTeamInvited = new Map<string, number>()
  for (const row of projectProfessionalsQuery.data ?? []) {
    if (!row?.company_id || row.is_project_owner) continue
    if (photographerCompanyIds.has(row.company_id)) continue
    const project = row.project as unknown as { id: string } | null
    const ownerId = project?.id ? projectOwnerCompany.get(project.id) : undefined
    if (!ownerId) continue
    if (row.status === "listed" || row.status === "live_on_page") {
      companyTeamAccepted.set(ownerId, (companyTeamAccepted.get(ownerId) ?? 0) + 1)
    } else if (row.status === "invited") {
      companyTeamInvited.set(ownerId, (companyTeamInvited.get(ownerId) ?? 0) + 1)
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

  // Bucket company_contacts by company_id, role-sorted (owner → admin →
  // member → contact). Joined-in persons rows surface name/email/auth state.
  const ROLE_ORDER: Record<string, number> = { owner: 0, admin: 1, member: 2, contact: 3 }
  type RawContactRow = {
    id: string
    company_id: string
    role: string
    status: string | null
    last_contacted_at: string | null
    next_follow_up_at: string | null
    notes: string | null
    person: {
      id: string
      first_name: string | null
      last_name: string | null
      email: string
      phone: string | null
      phone_country_code: string | null
      source: string | null
      auth_user_id: string | null
    } | null
  }
    // Channel per company: the CONSUMED claim token is the authority for
  // funnel claims (what actually converted, upgrades included); rows
  // without one fall back to the source mapping. 'direct' refines via
  // first-touch attribution into seo/social/referral/shares.
  const { data: consumedTokens } = await supabase
    .from("claim_tokens" as never)
    .select("company_id, channel, consumed_at")
    .not("consumed_at", "is", null)
  const consumedChannelByCompany = new Map<string, string>()
  for (const t of (consumedTokens ?? []) as unknown as { company_id: string; channel: string | null; consumed_at: string }[]) {
    if (t.channel && !consumedChannelByCompany.has(t.company_id)) consumedChannelByCompany.set(t.company_id, t.channel)
  }
  const CHANNEL_FROM_SOURCE: Record<string, string> = { invited: "invite", manual: "showcase", apollo: "outreach", direct: "direct" }
  const DIRECT_REFINE: Record<string, string> = { google: "seo", social: "social", referral: "referral", shares: "shares" }
  // Ranking mirrors resolveClaimChannel: a project credit beats the
  // entry source — an Apollo import that later gets credited IS an
  // invite-channel company (that credit is what the funnel will ride),
  // regardless of how the row originally entered the database.
  const deriveCompanyChannel = (
    source: string | null,
    firstTouch: string | null,
    consumed: string | null,
    hasInviteCredit: boolean,
    hasAcceptedContributorCredit: boolean,
    claimed: boolean,
    status: string | null,
    isPhotographer: boolean,
  ): string => {
    // Photographers exist on Arco ONLY by being assigned on a project —
    // the invite channel by construction. Their rows often carry source
    // 'manual' (created from the details-bar assignment) and a credit
    // that is already live, so neither the source mapping nor the
    // pending-credit rule catches them.
    //
    // Claimed vs unclaimed read credits differently. UNCLAIMED: a
    // pending credit marks the pipeline the row sits in. CLAIMED: only
    // an ACCEPTED contributor credit signals an invite conversion — a
    // pending tag on an existing customer (Bongers, invited on a
    // client's project long after their own signup) says nothing about
    // how they were acquired. Owner rows never count: owning a project
    // is publishing, not being invited.
    let ch = consumed
      ?? (isPhotographer ? "invite" : null)
      ?? (claimed
        ? (hasAcceptedContributorCredit ? "invite" : null)
        : ((hasInviteCredit || status === "invited") ? "invite" : null))
      ?? CHANNEL_FROM_SOURCE[source ?? ""]
      ?? "direct"
    if (ch === "platform") ch = "direct"
    if (ch === "direct") ch = DIRECT_REFINE[firstTouch ?? ""] ?? "direct"
    return ch
  }

  const contactsByCompany = new Map<string, Array<{
    id: string
    personId: string
    name: string | null
    email: string
    phone: string | null
    phoneCountryCode: string | null
    source: string | null
    role: "owner" | "admin" | "member" | "contact"
    status: string | null
    authUserId: string | null
    lastContactedAt: string | null
    nextFollowUpAt: string | null
    notes: string | null
  }>>()
  for (const row of (companyContactsQuery.data ?? []) as RawContactRow[]) {
    if (!row?.company_id || !row.person) continue
    // /admin/companies shows USERS only — people with an auth account
    // linked to this company. Sales leads (role='contact') and invited-
    // but-not-yet-signed-up members live in /admin/sales. An unclaimed
    // admin-added company just gets an empty Users cell.
    if (!row.person.auth_user_id) continue
    if (row.role === "contact") continue
    const fullName = [row.person.first_name, row.person.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() || null
    const list = contactsByCompany.get(row.company_id) ?? []
    list.push({
      id: row.id,
      personId: row.person.id,
      name: fullName,
      email: row.person.email,
      phone: row.person.phone,
      phoneCountryCode: row.person.phone_country_code,
      source: row.person.source,
      role: row.role as "owner" | "admin" | "member" | "contact",
      status: row.status,
      authUserId: row.person.auth_user_id,
      lastContactedAt: row.last_contacted_at,
      nextFollowUpAt: row.next_follow_up_at,
      notes: row.notes,
    })
    contactsByCompany.set(row.company_id, list)
  }
  for (const list of contactsByCompany.values()) {
    list.sort((a, b) => {
      const roleDiff = (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99)
      if (roleDiff !== 0) return roleDiff
      return (a.name ?? a.email).localeCompare(b.name ?? b.email)
    })
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
    const isUnclaimed = (company.status === "unlisted" || company.status === "created") && !claimedCompanyIds.has(company.id) && !company.owner_id

    // For claimed companies: use owner profile; for unclaimed: use invited email
    const ownerProfile = !isUnclaimed && company.owner_id ? ownerProfileMap.get(company.owner_id) : null
    const ownerName = ownerProfile
      ? [ownerProfile.first_name, ownerProfile.last_name].filter(Boolean).join(" ").trim() || null
      : null

    // Status shown in the table: unclaimed unlisted/created rows read as
    // "invited" (they were auto-created from project invites). Channel
    // derivation MUST use this same derived value — deriving from the
    // raw DB status let the Status column say Invited while the Channel
    // column said Showcase for the same row.
    const displayStatus = isUnclaimed ? ("invited" as const) : company.status

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
      status: displayStatus,
      ownerName: isUnclaimed ? null : ownerName,
      ownerEmail: isUnclaimed
        ? (invitedEmail ?? null)
        : ((company as any).owner_id ? ownerEmailMap.get((company as any).owner_id) ?? null : null),
      ownerAvatarUrl: isUnclaimed ? null : (ownerProfile?.avatar_url ?? null),
      projectsAccepted: companyProjectsAccepted.get(company.id) ?? 0,
      projectsPending: companyProjectsPending.get(company.id) ?? 0,
      teamAccepted: companyTeamAccepted.get(company.id) ?? 0,
      teamInvited: companyTeamInvited.get(company.id) ?? 0,
      projects: companyProjectsList.get(company.id) ?? [],
      createdAt: company.created_at ?? null,
      logoUrl: company.logo_url ?? null,
      isVerified: Boolean(company.is_verified),
      isFeatured: Boolean(company.is_featured),
      contactEmail: company.email ?? null,
      website: company.website ?? null,
      servicesOffered: serviceIds,
      primaryServiceId: company.primary_service_id ?? null,
      city: company.city ?? null,
      country: company.country ?? null,
      hasPublishedProjects: (companyProjectsList.get(company.id) ?? []).some(
        (p) => p.projectStatus === "published" && (p.inviteStatus === "listed" || p.inviteStatus === "live_on_page"),
      ),
      listedAt: (company as { listed_at?: string | null }).listed_at ?? null,
      canPublishProjects: serviceIds.some((id) => publishableCategoryIds.has(id)),
      autoApproveProjects: Boolean((company as any).auto_approve_projects),
      source: company.source ?? null,
      isPhotographer: (company as { audience?: string | null }).audience === "pro",
      channel: deriveCompanyChannel(
        company.source ?? null,
        (company as { first_touch_source?: string | null }).first_touch_source ?? null,
        consumedChannelByCompany.get(company.id) ?? null,
        (companyProjectsList.get(company.id) ?? []).some((p) => !p.isProjectOwner && p.inviteStatus === "invited"),
        (companyProjectsList.get(company.id) ?? []).some((p) => !p.isProjectOwner && (p.inviteStatus === "live_on_page" || p.inviteStatus === "listed")),
        Boolean(company.owner_id),
        String(displayStatus ?? ""),
        (company as { audience?: string | null }).audience === "pro",
      ),
      contacts: contactsByCompany.get(company.id) ?? [],
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
        teamAccepted: 0,
        teamInvited: 0,
        channel: "invite",
        isPhotographer: false,
        projects: [],
        createdAt: data.latestInvitedAt,
        logoUrl: null,
        isVerified: false,
        isFeatured: false,
        contactEmail: null,
        website: null,
        servicesOffered: [],
        primaryServiceId: null,
        city: null,
        country: null,
        hasPublishedProjects: false,
        listedAt: null,
        canPublishProjects: false,
        autoApproveProjects: false,
        source: null,
        contacts: [],
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
    // Horizontal-overflow clip lives on the admin layout wrapper so
    // every admin page inherits the same guard against mobile pan.
    <div className="min-h-screen bg-white">
      <div className="discover-page-title">
        <div className="wrap">
          <AdminCompaniesDataTable data={mergedRows} serviceOptions={servicesOptions} />
        </div>
      </div>
    </div>
  )
}
