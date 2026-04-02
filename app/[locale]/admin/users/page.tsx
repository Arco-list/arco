import { redirect } from "next/navigation"

import { UsersDataTable, type AdminUserRow, type AdminUserCompany } from "@/components/users-data-table"
import type { User } from "@supabase/supabase-js"
import { isSuperAdminUser } from "@/lib/auth-utils"
import { logger } from "@/lib/logger"
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import type { Tables } from "@/lib/supabase/types"

export const dynamic = "force-dynamic"

type AdminProfileRow = Pick<
  Tables<"profiles">,
  | "id"
  | "first_name"
  | "last_name"
  | "avatar_url"
  | "admin_role"
  | "user_types"
  | "is_active"
  | "invited_by"
  | "invited_at"
  | "created_at"
  | "updated_at"
>

export default async function UsersPage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !authUser) {
    if (authError) {
      logger.auth("admin-users", "Failed to load current auth user", { error: authError.message })
    }
    redirect(`/?redirectTo=/admin/users`)
  }

  const { data: currentProfile, error: currentProfileError } = await supabase
    .from("profiles")
    .select("admin_role, user_types, is_active")
    .eq("id", authUser.id)
    .maybeSingle()

  if (currentProfileError) {
    logger.db(
      "select",
      "profiles",
      "Failed to load current admin profile in /admin/users",
      { userId: authUser.id },
      currentProfileError,
    )
    redirect(`/admin?unauthorized=users`)
  }

  if (!currentProfile || currentProfile.is_active === false || !isSuperAdminUser(currentProfile.admin_role)) {
    redirect(`/admin?unauthorized=users`)
  }

  const serviceClient = createServiceRoleSupabaseClient()

  const { data: adminProfilesData, error: adminProfilesError } = await serviceClient
    .from("profiles")
    .select(
      "id, first_name, last_name, avatar_url, admin_role, user_types, is_active, invited_by, invited_at, created_at, updated_at",
    )
    .or("user_types.cs.{admin},user_types.cs.{client}")
    .order("created_at", { ascending: true })

  if (adminProfilesError) {
    logger.db(
      "select",
      "profiles",
      "Failed to load admin profile dataset for /admin/users",
      { scope: "admin-users" },
      adminProfilesError,
    )
  }

  const adminProfiles: AdminProfileRow[] = (adminProfilesData ?? []) as AdminProfileRow[]

  const idsToFetch = new Set<string>()
  adminProfiles.forEach((profile) => {
    idsToFetch.add(profile.id)
    if (profile.invited_by) {
      idsToFetch.add(profile.invited_by)
    }
  })

  const authUserMap = new Map<string, User>()

  if (idsToFetch.size > 0) {
    const responses = await Promise.all(
      Array.from(idsToFetch).map(async (id) => ({
        id,
        response: await serviceClient.auth.admin.getUserById(id),
      })),
    )

    responses.forEach(({ id, response }) => {
      if (response.error) {
        logger.auth("admin-users", "Failed to load auth user while preparing admin table", { targetAdminId: id }, response.error)
        return
      }
      if (response.data?.user) {
        authUserMap.set(id, response.data.user)
      }
    })
  }

  const inviterIds = Array.from(
    new Set(adminProfiles.map((profile) => profile.invited_by).filter((value): value is string => Boolean(value))),
  )

  const inviterProfileMap = new Map<string, Pick<Tables<"profiles">, "id" | "first_name" | "last_name">>()
  if (inviterIds.length > 0) {
    const { data: inviterProfiles, error: inviterProfilesError } = await serviceClient
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", inviterIds)

    if (inviterProfilesError) {
      logger.db(
        "select",
        "profiles",
        "Failed to load inviter profile names for /admin/users",
        { scope: "admin-users" },
        inviterProfilesError,
      )
    } else {
      inviterProfiles?.forEach((profile) => {
        inviterProfileMap.set(profile.id, profile)
      })
    }
  }

  // Build a map of user_id → companies from all sources:
  // 1. professionals table (team members)
  // 2. companies.owner_id (company owners)
  // 3. company_members table (team memberships)
  const userCompanyMap = new Map<string, AdminUserCompany[]>()
  const allUserIds = adminProfiles.map((p) => p.id)

  const addCompany = (userId: string, company: { id: string; name: string; slug: string | null; status?: string | null }) => {
    if (!company.id || !company.name) return
    const existing = userCompanyMap.get(userId) ?? []
    if (!existing.some((c) => c.id === company.id)) {
      existing.push({ id: company.id, name: company.name, slug: company.slug ?? company.id, companyStatus: company.status ?? "unlisted", projectCount: 0 })
      userCompanyMap.set(userId, existing)
    }
  }

  if (allUserIds.length > 0) {
    const [{ data: teamMemberRows }, { data: ownedCompanies }, { data: memberRows }] = await Promise.all([
      serviceClient
        .from("professionals")
        .select("user_id, company_id, companies(id, name, slug, status)")
        .in("user_id", allUserIds),
      serviceClient
        .from("companies")
        .select("id, name, slug, owner_id, status")
        .in("owner_id", allUserIds),
      serviceClient
        .from("company_members")
        .select("user_id, company_id, companies(id, name, slug, status)")
        .in("user_id", allUserIds)
        .eq("status", "active"),
    ])

    for (const row of teamMemberRows ?? []) {
      if (!row.user_id || !row.companies) continue
      addCompany(row.user_id, row.companies as unknown as { id: string; name: string; slug: string; status: string })
    }

    for (const row of ownedCompanies ?? []) {
      if (!row.owner_id) continue
      addCompany(row.owner_id, row)
    }

    for (const row of memberRows ?? []) {
      if (!row.user_id || !row.companies) continue
      addCompany(row.user_id, row.companies as unknown as { id: string; name: string; slug: string; status: string })
    }
  }

  // Fetch project counts per company
  const allCompanyIds = Array.from(new Set(Array.from(userCompanyMap.values()).flat().map((c) => c.id)))
  if (allCompanyIds.length > 0) {
    const { data: projectCounts } = await serviceClient
      .from("project_professionals")
      .select("company_id")
      .in("company_id", allCompanyIds)

    const countMap = new Map<string, number>()
    for (const row of projectCounts ?? []) {
      if (!row.company_id) continue
      countMap.set(row.company_id, (countMap.get(row.company_id) ?? 0) + 1)
    }

    for (const companies of userCompanyMap.values()) {
      for (const company of companies) {
        company.projectCount = countMap.get(company.id) ?? 0
      }
    }
  }

  const adminRows: AdminUserRow[] = adminProfiles.map((profile) => {
    const authRecord = authUserMap.get(profile.id) ?? null
    const inviterAuth = profile.invited_by ? authUserMap.get(profile.invited_by) ?? null : null
    const inviterProfile = profile.invited_by ? inviterProfileMap.get(profile.invited_by) ?? null : null

    const profileName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim()
    const metadataName =
      typeof authRecord?.user_metadata?.full_name === "string" ? authRecord.user_metadata.full_name : ""
    const displayName = profileName || metadataName || authRecord?.email || "Admin user"

    const email = authRecord?.email ?? "unknown@example.com"
    const isClientUser = profile.user_types.includes("client") && !profile.user_types.includes("admin")
    const adminRole = isClientUser ? "client" : (profile.admin_role === "super_admin" ? "super_admin" : "admin")
    const isActive = profile.is_active !== false
    const bannedUntil = authRecord?.banned_until ?? null
    const emailConfirmedAt = authRecord?.email_confirmed_at ?? null

    let status: AdminUserRow["status"] = "active"
    if (!isActive || bannedUntil) {
      status = "inactive"
    } else if (!emailConfirmedAt) {
      status = "invited"
    }

    const invitedAt = profile.invited_at ?? authRecord?.created_at ?? null
    const invitedByName =
      inviterProfile && (inviterProfile.first_name || inviterProfile.last_name)
        ? [inviterProfile.first_name, inviterProfile.last_name].filter(Boolean).join(" ").trim()
        : typeof inviterAuth?.user_metadata?.full_name === "string"
          ? inviterAuth.user_metadata.full_name
          : null

    const invitedByEmail = inviterAuth?.email ?? null

    return {
      id: profile.id,
      displayName,
      email,
      avatarUrl: profile.avatar_url ?? null,
      companies: userCompanyMap.get(profile.id) ?? [],
      role: adminRole,
      status,
      createdAt: profile.created_at,
      lastSignInAt: authRecord?.last_sign_in_at ?? null,
      invitedAt,
      invitedByName,
      invitedByEmail,
      bannedUntil,
      isLastSuperAdmin: false,
      isSelf: profile.id === authUser.id,
    }
  })

  const activeSuperAdminsCount = adminRows.filter(
    (row) => row.role === "super_admin" && row.status === "active",
  ).length

  const hydratedRows: AdminUserRow[] = adminRows.map((row) => ({
    ...row,
    isLastSuperAdmin: row.role === "super_admin" && row.status === "active" && activeSuperAdminsCount <= 1,
  }))

  const singleActiveSuperAdmin = activeSuperAdminsCount <= 1

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <div className="discover-page-title">
        <div className="wrap">
          <UsersDataTable data={hydratedRows} singleActiveSuperAdmin={singleActiveSuperAdmin} />
        </div>
      </div>
    </div>
  )
}
