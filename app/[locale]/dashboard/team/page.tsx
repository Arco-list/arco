import { redirect } from "next/navigation"

import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server"
import { getActiveCompanyId } from "@/lib/active-company"
import { TeamPageClient } from "./team-page-client"
import { claimPendingTeamInvitesAction } from "./actions"

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

  // 2. No owned company — check cookie for membership
  if (!company) {
    const activeId = await getActiveCompanyId()
    if (activeId) {
      const { data: membership } = await supabase
        .from("company_members")
        .select("company_id, companies(id, name)")
        .eq("company_id", activeId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle()

      if (membership?.companies) {
        company = membership.companies as unknown as { id: string; name: string; owner_id: string | null }
      }
    }
  }

  // 3. Fallback: first team membership (oldest first)
  if (!company) {
    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id, role, companies(id, name, owner_id)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (membership?.companies) {
      company = membership.companies as unknown as { id: string; name: string; owner_id: string | null }
    }
  }

  if (!company) redirect("/create-company")

  // Ensure isOwner is set when we resolved via cookie/membership paths
  if (!isOwner && company.owner_id === user.id) {
    isOwner = true
  }

  // Fetch all team members with profile data (service role bypasses RLS)
  const { data: members } = await serviceClient
    .from("company_members")
    .select(`
      id,
      company_id,
      user_id,
      email,
      role,
      status,
      invited_at,
      invited_by,
      joined_at,
      profiles:user_id(first_name, last_name, avatar_url)
    `)
    .eq("company_id", company.id)
    .order("created_at", { ascending: true })

  // Ensure the company owner appears as an admin row even if they're not in
  // company_members. The owner is the source of truth for "team admin".
  const enrichedMembers = [...(members ?? [])]
  if (company.owner_id && !enrichedMembers.some((m) => m.user_id === company!.owner_id)) {
    try {
      const { data: { user: ownerUser } } = await serviceClient.auth.admin.getUserById(company.owner_id)
      const { data: ownerProfile } = await serviceClient
        .from("profiles")
        .select("first_name, last_name, avatar_url")
        .eq("id", company.owner_id)
        .maybeSingle()
      enrichedMembers.unshift({
        id: `owner-${company.owner_id}`,
        company_id: company.id,
        user_id: company.owner_id,
        email: ownerUser?.email ?? "",
        role: "admin",
        status: "active",
        invited_at: ownerUser?.created_at ?? new Date().toISOString(),
        invited_by: null,
        joined_at: ownerUser?.created_at ?? null,
        profiles: ownerProfile ?? null,
      } as (typeof enrichedMembers)[number])
    } catch {
      // Non-fatal — owner row just won't appear if lookup fails
    }
  }

  // For pending invites (no user_id), try to find profiles by email
  const pendingEmails = enrichedMembers
    .filter(m => !m.user_id && m.email)
    .map(m => m.email)

  if (pendingEmails.length > 0) {
    // Look up each pending email via Supabase auth admin API
    for (const member of enrichedMembers) {
      if (member.user_id || !member.email) continue
      try {
        const { data: { user: foundUser } } = await serviceClient.auth.admin.getUserByEmail(member.email)
        if (foundUser) {
          const { data: profile } = await serviceClient
            .from("profiles")
            .select("first_name, last_name, avatar_url")
            .eq("id", foundUser.id)
            .maybeSingle()
          if (profile) {
            ;(member as any).profiles = {
              first_name: profile.first_name,
              last_name: profile.last_name,
              avatar_url: profile.avatar_url,
            }
          }
        }
      } catch {
        // Non-fatal — user might not exist
      }
    }
  }

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
