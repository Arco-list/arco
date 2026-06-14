import { redirect } from "next/navigation"

import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { getActiveCompanyId } from "@/lib/active-company"
import { TeamPageClient } from "./team-page-client"
import { claimPendingTeamInvitesAction } from "./actions"

// Team-role contacts only. 'contact' is the sales/lead bucket — excluded.
const TEAM_ROLES = ["owner", "admin", "member"] as const

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ company_id?: string }>
}) {
  const { company_id: companyIdParam } = await searchParams
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) throw new Error(userError.message)
  if (!user) redirect("/login?redirectTo=/dashboard/team")

  const serviceClient = createServiceRoleSupabaseClient()

  // Auto-claim any pending team invites for this user
  try {
    await claimPendingTeamInvitesAction(user.id)
  } catch {
    // Non-fatal
  }

  // Find company: URL param (priority) → owned → cookie → membership
  let company: { id: string; name: string; owner_id: string | null } | null = null
  let isOwner = false

  // 0. URL param takes priority (from company switcher)
  if (companyIdParam) {
    const { data: paramCompany } = await serviceClient
      .from("companies")
      .select("id, name, owner_id")
      .eq("id", companyIdParam)
      .maybeSingle()
    if (paramCompany) {
      company = { id: paramCompany.id, name: paramCompany.name, owner_id: paramCompany.owner_id }
      isOwner = paramCompany.owner_id === user.id
    }
  }

  // 1. Owned company (oldest first)
  if (!company) {
    const { data: ownedCompany } = await supabase
      .from("companies")
      .select("id, name, owner_id")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (ownedCompany) {
      company = ownedCompany
      isOwner = true
    }
  }

  // 2. No owned company — check cookie for membership via company_contacts
  if (!company) {
    const activeId = await getActiveCompanyId()
    if (activeId) {
      const { data: contact } = await serviceClient
        .from("company_contacts")
        .select("company_id, person:persons!inner(auth_user_id), company:companies(id, name, owner_id)")
        .eq("company_id", activeId)
        .in("role", TEAM_ROLES as unknown as string[])
        .eq("person.auth_user_id", user.id)
        .maybeSingle()

      const matched = contact?.company as unknown as { id: string; name: string; owner_id: string | null } | null
      if (matched) company = matched
    }
  }

  // 3. Fallback: first team membership (oldest first)
  if (!company) {
    const { data: contact } = await serviceClient
      .from("company_contacts")
      .select("created_at, role, person:persons!inner(auth_user_id), company:companies(id, name, owner_id)")
      .eq("person.auth_user_id", user.id)
      .in("role", TEAM_ROLES as unknown as string[])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    const matched = contact?.company as unknown as { id: string; name: string; owner_id: string | null } | null
    if (matched) company = matched
  }

  if (!company) redirect("/create-company")

  if (!isOwner && company.owner_id === user.id) {
    isOwner = true
  }

  // Pull team contacts (owner/admin/member) joined to persons. Each row is
  // a (company, person) link; persons.auth_user_id tells us whether the
  // contact has signed up. The legacy `MemberRow` shape is reconstructed
  // below so the client doesn't have to change.
  const { data: contacts } = await serviceClient
    .from("company_contacts")
    .select(`
      id,
      company_id,
      role,
      status,
      invited_at,
      invited_by,
      joined_at,
      created_at,
      person:persons(id, first_name, last_name, email, auth_user_id)
    `)
    .eq("company_id", company.id)
    .in("role", TEAM_ROLES as unknown as string[])
    .order("created_at", { ascending: true })

  // Hydrate avatar_url from profiles for signed-up persons. persons.avatar
  // is intentionally absent in the new model — avatars stay on profiles.
  const profileIds = (contacts ?? [])
    .map((c: any) => c.person?.auth_user_id)
    .filter((id: string | null): id is string => Boolean(id))

  const avatarByProfileId = new Map<string, string | null>()
  if (profileIds.length > 0) {
    const { data: profiles } = await serviceClient
      .from("profiles")
      .select("id, avatar_url")
      .in("id", profileIds)
    for (const p of profiles ?? []) {
      avatarByProfileId.set(p.id, p.avatar_url ?? null)
    }
  }

  type MemberRow = {
    id: string
    company_id: string
    user_id: string | null
    email: string
    role: string
    status: string
    invited_at: string
    invited_by: string | null
    joined_at: string | null
    profiles: {
      first_name: string | null
      last_name: string | null
      avatar_url: string | null
    } | null
  }

  const enrichedMembers: MemberRow[] = (contacts ?? []).map((c: any) => ({
    id: c.id,
    company_id: c.company_id,
    user_id: c.person?.auth_user_id ?? null,
    email: c.person?.email ?? "",
    // Legacy MemberRow.role is just admin/member. Owner is shown via the
    // separate isOwner flag + the row's badge; collapse 'owner' to 'admin'
    // here so existing UI permission checks stay correct.
    role: c.role === "owner" ? "admin" : c.role,
    status: c.status ?? "active",
    invited_at: c.invited_at ?? c.created_at,
    invited_by: c.invited_by,
    joined_at: c.joined_at,
    profiles: c.person
      ? {
          first_name: c.person.first_name,
          last_name: c.person.last_name,
          avatar_url: c.person.auth_user_id
            ? avatarByProfileId.get(c.person.auth_user_id) ?? null
            : null,
        }
      : null,
  }))

  return (
    <TeamPageClient
      companyId={company.id}
      companyName={company.name}
      members={enrichedMembers}
      isOwner={isOwner}
      currentUserId={user.id}
    />
  )
}
