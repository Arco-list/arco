import { redirect } from "next/navigation"

import { AdminSidebar } from "@/components/admin-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { UsersDataTable, type AdminUserRow } from "@/components/users-data-table"
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
    redirect(`/login?redirectTo=/admin/users`)
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
      "id, first_name, last_name, admin_role, user_types, is_active, invited_by, invited_at, created_at, updated_at",
    )
    .contains("user_types", ["admin"])
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

  const adminRows: AdminUserRow[] = adminProfiles.map((profile) => {
    const authRecord = authUserMap.get(profile.id) ?? null
    const inviterAuth = profile.invited_by ? authUserMap.get(profile.invited_by) ?? null : null
    const inviterProfile = profile.invited_by ? inviterProfileMap.get(profile.invited_by) ?? null : null

    const profileName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim()
    const metadataName =
      typeof authRecord?.user_metadata?.full_name === "string" ? authRecord.user_metadata.full_name : ""
    const displayName = profileName || metadataName || authRecord?.email || "Admin user"

    const email = authRecord?.email ?? "unknown@example.com"
    const adminRole = profile.admin_role === "super_admin" ? "super_admin" : "admin"
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
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/admin">Admin Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Users</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <Separator className="w-full" />
        <div className="flex flex-1 flex-col gap-4 p-4">
          <UsersDataTable data={hydratedRows} singleActiveSuperAdmin={singleActiveSuperAdmin} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
